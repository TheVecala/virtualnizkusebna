# VZ2 – ověření návrhu a předávací scénáře

## Co se ověřuje v první etapě

Datum: 16. 9. 2026. Větev `feature/zkusebna2.0`.
Výchozí i výsledný HEAD: `cd26bd8b011e94f9da34a685653c8e0333e104f2`.
Po fetchi origin je vzdálená feature větev stejná (0 ahead / 0 behind).
Před bloky úprav byla opakována kontrola větve/HEAD/pracovního stromu.

Výsledkem jsou čtyři nové necommitnuté soubory:

* `docs/vz2/design.md` – model, práva, transakce, úložiště, přechod, etapy.
* `docs/vz2/inventory.md` – aktuální soubory, úložiště, writery a konflikty.
* `docs/vz2/schema-draft.sql` – neaplikované schéma, 13 nových tabulek.
* `docs/vz2/verification.md` – tento protokol a scénáře.

Kontrola návrhu zahrnuje konzistenci FK/typů a indexů, ukazatele na správnou
verzi dokumentu, zachování autorství, revizí, oddělení audia od timestampů,
globálních Nápadů od kolekcí, chování při částečném unlink/uploadu a zachování
logu po smazání. Doplněna statickou kontrolou deklarací SQL a souborových odkazů.
Žádný sledovaný runtime PHP/JS/CSS ani původní migrace nebyly změněny.

Výsledek provedené jednorázové statické kontroly v Node.js:

* 13 CREATE TABLE, všechny s prefixem vz2_ a InnoDB.
* 34 FK: existující cílové tabulky/sloupce, shodné deklarované typy, odkazované
  PK/UNIQUE klíče, všude ON DELETE/UPDATE RESTRICT; users.id porovnán s migrací.
* 52 unikátních názvů constraints, všechny nejvýše 64 znaků.
* Žádné DROP/TRUNCATE/DELETE ani změna users v SQL návrhu.
* 79 odkazů na existující soubory ve sloupci inventury a 4 relativní dokumentové
  odkazy existují. Jde o výskyty odkazů, ne 79 různých souborů.
* `git diff --no-index --check -- NUL <soubor>` prošel pro všechny čtyři nové
  soubory; `git diff --name-only` je prázdný, nové soubory jsou untracked.

Tato kontrola je jednoduchá kontrola struktury deklarací, **není SQL parser
MariaDB ani test vykonání DDL**. Nespouštěly se runtime testy nezměněné aplikace.

**Není ověřeno:** provedení DDL a běhová syntaxe na MariaDB, skutečné hostingové
schema users/auth_settings, hostingové PHP/MariaDB verze, diskové cesty/sdílení
alfy a bety, funkčnost nových endpointů (neexistují), skutečné uploady, e-maily,
recovery a prohlížečové scénáře. PHP/MariaDB klient nejsou dostupné v PATH této
relace a nebyla poskytnuta izolovaná DB; produkční připojení z configu nebylo
použito. Historicky doložená lokální PHP 8.5.10/MariaDB 11.4.5 z dokumentace
není výsledek tohoto běhu ani potvrzení verze hostingu.

SQL používá běžné InnoDB FK, ENUM, CHECK, DATETIME a indexy; nepoužívá JSON
datový typ, generované sloupce, triggery ani verzi specifické časové tabulky.
Záměr je kompatibilita s doloženou MariaDB 11.4.5. Bez běhu na cílové DB to není
certifikace syntaxe nebo výkonu. CHECK musí být zapnuté a skutečně vynucované,
strict SQL mode musí odmítat neplatné ENUM/hodnoty; to patří do preflightu.
Na hostingu s jinou verzí nejdřív zopakovat izolované ověření pro danou verzi.

SQL nepoužívá IF NOT EXISTS: kolize názvu tabulky má zastavit neuvážené opakování,
ne skrýt odlišné schéma. DDL není jedna rollbackovatelná transakce; částečně
provedený draft se nesmí znovu slepě pustit. V této etapě se nic neaplikovalo.

## Budoucí izolované ověření SQL

Připravit prázdnou lokální databázi s výslovným testovacím připojením a odděleným
root/datasetem. Žádné include produkčního config.php. V ní aplikovat kopii
`migrations/001_personal_accounts.sql`, potom schválený schema draft. Testovací
uživatele vytvořit jen v této izolované DB, nikdy v produkční users jako fiktivní
autory. Doložit skutečné SELECT VERSION a sql_mode.

1. `SHOW CREATE TABLE` všech 13 tabulek, kontrola InnoDB, utf8mb4, typů a FK.
2. Vložení kolekce bez potomků a disku projde. Neexistující users.id nebo
   collection_id selže. Deaktivace autora neporuší FK; delete autora s obsahem
   je odmítnutý. Záměrně odmítnout NULL created_by.
3. Ověřit XOR thread.collection_id/global_key: oba NULL, oba vyplněné,
   duplicitní Nápady i druhé vlákno téže kolekce jsou odmítnuté.
4. Dokument založit přes NULL ukazatel jen uvnitř transakce, vložit verzi 1,
   nastavit ukazatel a commit. Odkaz na cizí/neexistující revizi selže.
   Rollback při chybě loggeru zanechá původní current_revision i obsah.
5. Odstranění audio souboru nemůže kaskádově smazat timestamp. Úplný delete
   nahrávky s potomky bez řízeného postupu selže díky RESTRICT.
6. Po explicitním odstranění potomků a cíle zůstanou activity_log i operation
   snapshoty. Dokument lze odstranit pořadím ukazatel=NULL → verze → dokument.
7. Neplatné záporné/velké ms, nulové revision, deleted bez autora/času a
   duplicitní relativní cesty se odmítnou. Všechny FK mají odpovídající typy.
8. Ve dvou DB spojeních ověřit CAS, pořadí a dokumentové konflikty; jedna z
   konkurenčních editací se musí odmítnout, ne tiše přepsat první. Aplikační
   validace navíc ověří single=1 stopa a time<=duration, což samotné FK neumí.

## Budoucí koncové scénáře na betě

Tyto scénáře jsou připravené k implementaci, **nyní nebyly spuštěny**. Použít
dva osobní členy A/B, admina a hosta, samostatné session a testovací audio.

| Scénář | Kroky a očekávaný výsledek |
|---|---|
| Skladba bez audia | A vytvoří skladbu a zkoušku, obnoví stránku, otevře odkaz dle ID. Obě se zobrazí bez fyzické složky a bez nahrávky. Mají autora, čas, pořadí a log. |
| Upload + přejmenování | A nahraje single i jednostopý multitrack do kolekce B. Ověřit kind, vlastní autorství a délku. Přejmenovat nahrávku a vlastní kolekci; ID, souborová cesta, hash a deep-link zůstanou. Dva stejné názvy nesmí přepsat existující soubor. |
| Přesun | A přesune vlastní nahrávku do cizí aktivní kolekce. Recording/file/timestamp ID a cesty zůstanou, log obsahuje oba rodiče. Smazání původní kolekce adminem nepřijde o přesunuté audio. |
| Odstranění audia | Přidat summary/timestampy a zjistit délku; A odstraní své audio. Záznam, názvy stop, délka, zápisy a autorství zůstanou v původním seznamu, UI „Audio odstraněno“, žádný play/seek/loop. Lze číst/editovat podle práv i exportovat. Kolekce nezmizí. |
| Neočekávaná ztráta | V izolovaném rootu odsunout testovací soubor mimo evidovanou cestu bez delete operace. UI ukáže missing, ne audioDeleted; vrácení souboru obnoví dostupnost. Nedostupný celý root se hlásí jako chyba úložiště a blokuje mazání. |
| Vlastní/cizí HTTP | B zkusí UI i přímým POST editovat nebo odstranit A nahrávku/timestamp/příspěvek; 403. Podvrhne recording_id vůči timestamp_id a kolekci, name i user_id: žádná změna/autorství. Přidat vlastní zápis do cizí kolekce s comment smí. Bez práva, bez CSRF nebo host se zápisem dostane 403. |
| Deaktivace/session | Deaktivovat A nebo změnit jeho heslo/roli v adminu; další přímý VZ2 GET/POST musí znovu ověřit session. Legacy id/jmeno/prihlasen se neuznávají jako osobní login. Host stále čte podle dosavadního přístupu. |
| Společný text | A i B načtou dokument revize N, A uloží N+1, B dostane 409 a jeho rozepsaný text zůstane. Po obnovení může vytvořit N+2. Autor dokumentu se nemění, každá verze má autora/čas, více než 20 verzí zůstane dostupných. |
| Adminská editace | Admin upraví A položku/souhrn i timestamp. created_by a summary_created_by zůstanou, updated_by odpovídá adminovi a deník zaznamená správný cíl. |
| Pořadí a souběh | Člen s reorder seřadí i cizí kolekce; nesmí tím změnit název/autora. Dva souběžné reorder požadavky se stejnou revizí: jeden 409. Duplicitní, chybějící nebo cizí ID z jiného scope odmítnout. U stop cizí nahrávky musí vlastnictví blokovat změnu. |
| Úplné smazání | Člen včetně vlastníka dostane 403 i přímým HTTP. Admin bez potvrzení/revize není připuštěn; s potvrzením odstraní cíl a potomky. Deník se čitelně zobrazí i bez cílové položky a neaktivního autora. Nápady jiných kolekcí zůstanou. |
| Timestampové intervaly | Body 0 song_start, 10000 passage, 15000 note, 20000 passage, 30000 song_start, duration 45000: intervaly 0–30000, 10000–20000, 20000–30000, 30000–45000. Shodný ms neukončí interval. Oba přehrávače a export používají stejná ID a celé ms. |
| Diskuse | Dva příspěvky ve stejné sekundě mají různá ID. Editace jednoho neovlivní druhý. V Mixéru se otevře vlákno kolekce, ne recording thread. Změna výběru během POST nepřesměruje komentář. |
| Offline a linky | Uložit kompletní sadu v2 offline, přejmenovat/přesunout online a ověřit stále stejná file ID/hash. Starý v1 cache klíč se nenačte jako v2. Po zjištěném deleted se nehraje lokální blob; odpojený druhý browser se o smazání dozví až online. Login zachová v2 deep-link, odstraněné audio zobrazí informace, úplně smazané ID jasnou chybu. Download zůstává výstupem. |
| Přílohy | PDF/TXT/obrázek uložit vedle nahrávky, upravit vlastní popisek, stáhnout a přesunout. Nevznikne audio recording ani timestamp. Podvržený MIME, executable a cesta ven z rootu se odmítnou. |
| Selhání uploadu | Odmítnutá stopa, disk full, souborová kolize, pád po rename před SQL commitem: žádné přepsání starého audia, žádná active neúplná sada ani falešný log. Retry stejného request_key nevytvoří duplikát. |
| Selhání mazání | Vynutit chybu unlink druhé stopy/cache, potom pád mezi unlink a commitem. UI přizná částečný stav, metadata zůstanou. Oprava/retry dokončí jen zbývající kroky, jednotlivé úspěchy se v deníku neduplikují. |
| Účty a audit | Vytvořit/deaktivovat člena, změnit roli i hosta. Obsahový log se zapíše v téže transakci, neobsahuje heslo/hash/token. Selhání logu odvolá SQL změnu. Ověřit ochranu posledního admina a oba environment údaje. |
| Přechod alfa/beta | Ověřit marker datasetu/root, oba návraty SITE_URL a login. Při oddělených discích zamknout zápisy, porovnat hash každého available souboru, převést writer na alfu; zastaralá beta kopie nesmí dál obsluhovat společný katalog. |

## Předání do etapy 2

Závazné funkční otázky jsou vyřešené zadáním. Doplnit se mají jen reálné
hostingové údaje z design.md §9, ověřit SQL v izolaci a potvrdit návrh při
přípravě další etapy. Do té doby tento draft není nasazovací migrace. Etapa 1
končí dokumentací; neproběhl commit, push, merge, nasazení ani úklid obsahu.
