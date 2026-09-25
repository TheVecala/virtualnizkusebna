# VZ2 – etapa 2: SQL katalog, soubory a provozní předání

Datum: 17. 9. 2026. Navazuje na schválený návrh v `design.md` a pokyn pokračovat
na commitu `cd26bd8b`. Jde o implementaci základu, nikoli o dokončení všech etap VZ2.

Aktualizace 18. 9. 2026: etapa 2 je již commitnutá jako `73f8f37`.
Uživatel doložil živý hosting a zálohy. Aktuální provozní fakta, úprava strict SQL
a zbývající podmínky storage jsou v [hosting-verification.md](hosting-verification.md).
Níže uvedený stav repozitáře a testovací protokol zachycují původní předání 17. 9.
Navazující balíček pro ověření úložiště na Blueboardu a nové požadované konfigurační
hodnoty popisuje [storage.md](storage.md); živé ověření dosud neproběhlo.

## Stav repozitáře

- Skutečná větev: `feature/zkusebna2.0`.
- Výchozí i výsledný HEAD: `cd26bd8b011e94f9da34a685653c8e0333e104f2`.
- Fetch origin proběhl; při zahájení lokální i vzdálená feature větev souhlasily
  (0 ahead / 0 behind). Před úpravami a při pokračování byl kontrolován skutečný HEAD.
- Veškeré níže uvedené změny jsou necommitnuté. Nevznikl commit, push ani nasazení.
- Čtyři necommitnuté dokumenty etapy 1 byly přítomné již před touto etapou a zůstávají.

## Dodané chování

Nový pohled `index.php?v=2` používá pouze SQL katalog VZ2. Bez soukromého
`config.vz2.php` je vypnutý. Původní pohled a obsah zůstávají dostupné; zapnutá VZ2
má odkaz v původním menu. Nové a staré nahrávky se neslučují ani nemigrují.

- Skladby a zkoušky vznikají bez audia a bez adresáře. Mají stabilní ID, autora,
  název a pořadí; vytvoření založí také prázdné SQL diskusní vlákno pro etapu 4.
- Upload běžné nebo vícestopé nahrávky vyžaduje cílovou kolekci. Jednostopý mix
  zůstává druhem `multitrack`. PDF, UTF-8 TXT, JPEG, PNG a GIF jsou samostatné přílohy.
- Audio má ID, hash, původní jméno, velikost a délku z metadat souboru. Délka celého
  mixu je maximum délek jeho stop. Názvy stop, nahrávek, popisky, přesuny a pořadí
  se ukládají do SQL; přejmenování ani přesun nemění fyzickou cestu.
- Autor přichází z obnovené osobní session. Cizí kolekce smí přijmout vlastní upload,
  ale vlastník kolekce tím nezískává autorství nahrávky. Adminská editace původního
  autora nepřepíše. Popisek eviduje prvního autora a posledního editora samostatně.
- Server kontroluje CSRF, právo i vlastnictví. Host jen čte. Společné pořadí kolekcí
  a nahrávek smí měnit člen s právem `reorder`; pořadí stop navíc vyžaduje vlastnictví
  nahrávky nebo admina. Starší revize vrací HTTP 409; editor zachová rozepsaný text.
- Odebrání audia zachová nahrávku, délku, popisek a existující SQL timestampy.
  `deleted` se liší od neočekávaného `missing`. Úplné smazání nahrávky či kolekce
  vyžaduje admina a potvrzení názvem; odstraní příslušné informace, nikoli deník.
- Změna obsahu a její audit jsou v jedné SQL transakci. Totéž platí pro správu účtů
  a přístupu hosta, když je VZ2 zapnutá. Deník je stránkovaný, dostupný jen adminovi,
  obsahuje jméno aktéra, UTC čas, prostředí, druh změny, stabilní ID a název cíle.
  Hesla, hashe hesel ani tokeny se nelogují.
- Souborový endpoint ověřuje aktuální login, vazbu a dostupnost souboru, podporuje
  HTTP Range i HEAD a nepřijímá uživatelskou cestu. Přílohy vynucují stažení.
- Mixér čte tentýž SQL katalog. Při otevření znovu načte stav serveru; známá odstraněná
  či neúplná sada se nepřehraje ani z cache. Chybějící stopa se neztratí ze seznamu
  identity sady. Obnovení katalogu nebo návrat online zneplatní neaktuální přehrávač.
- Odkazy používají `recording_id` a celočíselný čas `time_ms`; fungují i přes login.
  Druh nahrávky rozhoduje o otevření Mixéru. Samotný `view=mixer` otevře jeho panel.
- Offline bloby používají novou IndexedDB `zkusebna-vz2-cache` a klíče
  `vz2:<dataset>:<environment>:audio:<file-id>:<sha256>`. Stejně oddělený je snapshot
  metadat Mixéru. Správa offline souborů ukazuje velikosti, umožňuje stažení a lokální
  odebrání, i když už serverový záznam neexistuje. Původní cache se nečte ani nemaže.

## Souborový protokol a obnova

Všechny cesty jsou relativní k soukromému rootu, s kontrolou jeho markeru a komponent
cesty. Cíle používají čitelné slugy a SQL ID. Aplikace nezakládá root a neprochází staré
audio. Kořen nesmí ležet v žádném veřejném webrootu ani ve starých audio adresářích.

Upload ověří soubory, přesune je do `.staging/<request-key>/`, v krátké transakci
rezervuje záznamy a souborovou operaci. Následuje dokončení souborů a aktivace celé
nahrávky. Stejný request key vrátí tutéž operaci; změněný obsah či sada se odmítne.
`.locks/<operation-id>.lock` chrání pracovníka před dvojím spuštěním. Hash se ověří
i při opakování již dokončených položek před finální aktivací.

Aktualizace po živé diagnostice: Blueboard zde nemá dostupnou funkci `link()`.
Původní implementaci s hardlinkem nahradilo výhradní vytvoření cíle `fopen('xb')`,
streamované kopírování a kontrola SHA-256 před odstraněním stagingu. Existující cíl
se nepřepisuje; flock zůstává požadavkem. Podrobnosti včetně místa navíc a obnovy
po tvrdém přerušení kopie jsou v `storage.md`.

Mazání nejdřív uloží přesný seznam souborů a znepřístupní je. Po každém úspěšném
unlinku uloží výsledek a audit; až nakonec dokončí SQL změnu. Při chybě zůstávají
operace a její položky dohledatelné, bez nepravdivé zprávy o dokončení. UI nabízí
„Dokončit“ původnímu aktérovi nebo adminovi; znovu ověřuje aktuální oprávnění.
Dokončení plného smazání stále vyžaduje admina. Opakování nevytváří duplicitní log.

Po pádu před rezervací SQL může zůstat osiřelý staging/claim bez operace. Etapa 2
neobsahuje automatický garbage collector. Při údržbě nejprve zastavit uploady,
zkontrolovat neexistenci odpovídajícího request key v `vz2_file_operations` a
vyloučit běžící PHP požadavek; teprve pak ručně řešit konkrétní osiřelý adresář.
Nemazat plošně `.staging`, `.locks` ani soubory používané pending operací. Prázdné
adresáře a malé lock/claim soubory aplikace průběžně nemaže. Obnova ztraceného
stagingu vyžaduje zálohu či konkrétní administrátorský zásah; retry nevymyslí chybějící bytes.

## Nasazení – dosud neprovedeno

1. Zálohy a základní hostingové kontroly doložil uživatel 18. 9.; viz navazující
   protokol. Nový kód potřebuje **64bit PHP
   alespoň 8.1, mysqli s get_result a iconv**, InnoDB, strict SQL a vynucené CHECK.
   Lokálně je ověřena MariaDB 11.4.5; doložený hosting má MariaDB 11.4.12 a PHP 8.1.32.
   Výchozí SQL režim hostingu není strict. `auth_db()` při zapnuté VZ2 nastavuje
   požadované session režimy před první aplikační operací, včetně loginu a administrace.
2. Ověřit `users.id INT UNSIGNED PRIMARY KEY` a InnoDB. Zkontrolovat, zda již neexistují
   `vz2_` tabulky. Ručně **jednou** aplikovat `_pomocne/migrations/002_vz2.sql` do správné DB.
   Neměnit users ani auth_settings. DDL není automatická migrace při návštěvě webu
   ani opakovatelný opravný skript; při částečném DDL selhání nejprve zjistit stav,
   nespouštět soubor naslepo znovu. `schema-draft.sql` je historický návrh, ne druhá migrace.
   Použít stávající `18810_virtualni_zkusebna`, nikoli prázdnou `18810_VZ2`.
   Upravený migrační soubor začíná `SET SESSION sql_mode` a výpisem databáze/režimu;
   spouštět celý soubor na jednom spojení se zastavením při chybě. Neprovádět pouze DDL část.
3. **Nejprve dořešit storage:** alfa a beta jsou podsložky jednoho veřejného kořene,
   který je současně hranicí open_basedir. Původní doporučení „mimo oba weby“
   samo o sobě neznamená soukromý adresář. Změna open_basedir pro neveřejný root,
   nebo serverem blokovaný adresář uvnitř společného kořene, musí být samostatně
   navržena a prakticky ověřena; viz navazující protokol. Pak teprve vytvořit
   `.vz2-storage-id` s vlastním dataset key; ověřit, že root nelze číst veřejným HTTP.
   Nastavit přístup PHP procesu, ověřit výhradní kopírování, flock a dostatek místa v kvótě.
4. Podle `_pomocne/config.vz2.example.php` vytvořit soukromý ignorovaný `config.vz2.php`.
   Zpočátku `VZ2_ENABLED=true`, `VZ2_WRITES_ENABLED=false`, prostředí `beta` a ověřený
   root/dataset. Neměnit DB údaje, SITE_URL ani MAIL_FROM v původní konfiguraci.
5. Spustit CLI `php _pomocne/tools/vz2_preflight.php` nebo po přihlášení administrátora
   otevřít `/tools/vz2_preflight.php` v prohlížeči. Kontrola jen čte,
   nevytváří DB ani marker. Kontroluje runtime, users, přesné názvy 13 tabulek, seed pořadí
   a root. Nenahrazuje revizi kompletního živého DDL, přímého HTTP přístupu ani
   ověření veřejného rootu a souborového protokolu. Je určena po migraci; před ní je FAIL tabulek očekávaný.
6. Po splnění podmínek povolit zápisy jen betě a provést scénáře z tohoto dokumentu.
   Pozor: read-only VZ2 blokuje i změny účtů v této instanci, aby nevznikaly změny bez
   auditní transakce. Druhý starý web účty stále umí měnit bez VZ2 auditu; pro úplný
   audit musí všechny zapisující administrace dostat nový kód, nebo se tam zápisy zastaví.

Alfa a beta mají podle zadání společnou DB; to **neprokazuje společný disk**. Dataset
marker je ochrana před chybným rootem, nikoli synchronizační mechanismus. Je-li root
společný, musí obě instance používat stejné soubory a zámky. Jsou-li disky oddělené,
převzetí alfou potřebuje servisní okno, zastavení zápisů, dokončení operací, kopii
nového rootu a kontrolu každého available souboru proti SQL (počet, velikost, hash).
SQL obsah se znovu nevytváří. Beta se starou kopií disku pak nesmí dál obsluhovat VZ2;
vypnout nebo přesměrovat. Podrobný přechod a rollback jsou v `design.md`, oddíl 9.

## Formáty a hranice této etapy

Aktualizace 2026-09-25: omezení MP3/WAV popsaná níže byla rozšířena
[opravou čtení formátů](audio-formats.md). Limity velikosti, délky a sad zůstávají.

Server čte délky bez shellu/ffmpegu: RIFF WAV PCM/float, FLAC STREAMINFO, MP3 Layer III
po rámcích, AAC ADTS a Ogg Vorbis/Opus jedné logické streamové řady. Mixér přijímá
WAV/FLAC/MP3 stejného formátu v celé sadě. Free-format MP3, APE tagy, řetězený Ogg,
M4A/MP4 a WAV RF64 nejsou implementované. Kontrola metadat není plný dekodér;
skutečná přehratelnost se ověřuje prohlížečem. Nejvýše 7 dní audia; výchozí limit
512 MiB na soubor a 32 stop lze snížit konfigurací. Platí i PHP/proxy/serverové
limity a paměť pro dekódování v prohlížeči. Testy ověřily WAV; reálné vzorky ostatních
formátů na cílových prohlížečích a limity hostingu zbývají ověřit před zapnutím.

Rozhraní timestampů je zatím pouze čtecí; jejich CRUD, export, společný looper a jeho
napojení na SQL patří do etapy 3. Běžná nahrávka nyní používá nativní audio přehrávač;
nový VZ2 pohled zatím nemá starý waveform/looper. Dokumenty, verze, diskuse a Nápady
mají schéma a připravené vazby, ale ne editační UI (etapa 4). Playlisty nevznikly.

Uploadové emaily v novém VZ2 pohledu nejsou zapojené. Živé schéma `maily_<kapela>` a
konfigurace odesílání nejsou doložené; nejde o změnu starého uploadu. Zapojení vyžaduje
ověřit stávající adresáty a volbu odeslání. Původní looper, diskuse, exporty, cache a
uploady zůstávají jen v původním pohledu a pracují s původním obsahem.

Offline cache není service worker: nezaručuje studený start celé aplikace bez sítě.
Již otevřený Mixér může při síťové nedostupnosti použít snapshot a kompletní bloby;
HTTP zamítnutí serverem nezamění za offline stav. Návrat online obnoví SQL stav.
Jiný odpojený prohlížeč nemůže zjistit vzdálené smazání okamžitě. Správa cache nemění
server a neimportuje ručně stažené soubory jako další přehrávací zdroj. Bloby a
snapshoty sdílejí jeden object store s oddělenými klíči (drobné upřesnění návrhu).

## Provedené ověření

Izolované testy běžely na PHP 8.5.10 / MariaDB 11.4.5, port DB 33328, oddělený datový
adresář a náhodné testovací databáze. Nová sada vytváří konfiguraci od nuly, nenačítá
produkční config. DB, webroot i media root jsou oddělené; testovací databáze se po
skončení ruší. Produkční DDL, účty ani audio nebyly měněny.

- `_pomocne/tests/vz2_integration.test.js`: **39 kontrol PASS**, reálné HTTP přes PHP.
  Migrace 13 tabulek a preflight; anonym/host/CSRF; vlastnictví v přímém HTTP;
  CAS 409; neměnný autor adminské editace; upload do cizí kolekce; idempotence a
  odmítnutí změněných bytes; délka, Range, download autentizace; jednoznačný typ mixu;
  příloha; společné pořadí; odstranění audia se zachováním timestampů/popisku/délky;
  adminské plné smazání; trvalý audit; chybějící audio; simulované selhání filesystemu
  a opakované dokončení bez duplicit; účet+audit v transakci; marker; deaktivace;
  smazání cyklu dokument/verze; zachování globálních Nápadů; neúplná sada stop.
- Původní `_pomocne/tests/auth_integration.php`: **lifecycle 25 PASS, guest 19 PASS** s VZ2
  vypnutou. Původní testovací kopie postrádala dnešní require závislosti; seznam byl
  doplněn. Bootstrap/all neběžely: `create_first_admin.php` už ve výchozím checkoutu
  není. Chybějící bootstrap se toleruje pouze ve skupinách, které jej netestují.
- `multitrack_contract.test.js`: PASS, 45 DOM ID. `multitrack_sample_rate.test.js`: PASS.
  Automatický `multitrack_browser_smoke.test.js` byl SKIP kvůli chybějícímu Playwright;
  není započítán jako úspěšný prohlížečový test.
- Ručně v in-app prohlížeči na dočasném lokálním serveru: login admina, vytvoření a
  přejmenování prázdné skladby, načtení dvou WAV stop z SQL, posun přehrávání a mute,
  uložení offline kopie a přehled její velikosti, přímý odkaz na 00:05 vícestopé
  nahrávky. Při šířce 390 px nebyl vodorovný přesah hlavní stránky. Testovací audio
  bylo syntetické ticho; nejde o poslechový test reálné kapely ani test všech browserů.
- PHP lint všech 14 změněných/nových PHP souborů, JS syntax a `git diff --check`: PASS.

Příklad spuštění na vlastním izolovaném serveru:

```powershell
$env:PHP_BIN = 'C:\cesta\k\php.exe'
$env:VZ2_TEST_DB_PORT = '33328' # vyhrazená místní testovací MariaDB, nikdy 3306
node _pomocne/tests/vz2_integration.test.js
$env:AUTH_TEST_DB_PORT = '33328'
$env:AUTH_TEST_SUITE = 'lifecycle'
& $env:PHP_BIN tests/auth_integration.php
```

Tento testovací protokol zachycuje stav 17. 9. Následně doložená hostingová fakta
a aktuálně zbývající kontroly shrnuje `hosting-verification.md`.

## Změněné soubory

Upravené: `.gitignore`, `config.php`, `index.php`, `admin.php`, `php/auth.php`,
`js/multitrack.js`, `_pomocne/tests/auth_integration.php`.

Nové v etapě 2: `_pomocne/config.vz2.example.php`, `_pomocne/migrations/002_vz2.sql`, `vz2.php`,
`css/vz2.css`, `js/vz2.js`, `js/vz2-cache.js`, `php/ajax/vz2.php`,
`php/ajax/vz2_files.php`, `php/inc/vz2_core.php`, `php/inc/vz2_catalog.php`,
`php/inc/vz2_media.php`, `php/inc/vz2_storage.php`, `tools/vz2_preflight.php`,
`_pomocne/tests/vz2_integration.test.js`, `_pomocne/docs/vz2/stage2.md`.

Z dřívější etapy stále necommitnuté: `_pomocne/docs/vz2/design.md`, `_pomocne/docs/vz2/inventory.md`,
`_pomocne/docs/vz2/schema-draft.sql`, `_pomocne/docs/vz2/verification.md`. Tyto čtyři dokumenty popisují
historickou analýzu etapy 1; její výrok o nezměněném runtime není protokolem etapy 2.
