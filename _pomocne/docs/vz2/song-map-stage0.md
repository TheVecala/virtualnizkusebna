# Mapa skladby — Etapa 0: inventura a návrh integrace

Datum: 27. 9. 2026. Inventura schválena následným upřesněním uživatele: jedna Mapa
patří celé skladbě a uložení použije první variantu, `kind=song_map`.

Upřesnění uživatele: Mapa skladby nahradí současnou Tabulaturu v UI. Nebude
novým pátým panelem; v menu zůstanou čtyři tlačítka obsahových panelů.

## 1. Ověřený stav repozitáře

- Větev: `feature/supertabelatura`.
- Výchozí commit: `2d983a835e07e6a9b256116b9ca14efd90d70570`.
- Poslední commit: `Finish detaily_zobrazení_VZ2.0`, 27. 9. 2026 10:54:04 +0200.
- Před inventurou čistý pracovní strom. Nebyla nalezena existující implementace Mapy.
- Nebyl nalezen `AGENTS.md` v projektu ani v kontrolovaných nadřazených adresářích.
- Konvence pomocných souborů jsou v `_pomocne/README.md`: dokumentace, migrace,
  testy a nástroje patří do `_pomocne/`, pouze běhové soubory do webového stromu.
- Před každou další etapou bude znovu ověřena větev, HEAD a pracovní změny.

## 2. Databáze: co bylo a nebylo ověřeno

Schéma bylo ověřeno proti aktuálním SQL migracím a PHP dotazům tohoto commitu.
**Aktuální živá DB nebyla přímo ověřena.** V prostředí není PHP ani MariaDB/MySQL
klient na PATH, nejsou nastavené `PHP_BIN` / `VZ2_TEST_DB_PORT` a v checkoutu není
`config.vz2.php`. Historické protokoly hostingu nejsou důkazem dnešního schématu.
Nebyla spuštěna žádná migrace ani zápis do DB.

Před nasazením migrace je nutný aktuální čtecí preflight: vybraná DB, verze serveru,
`SHOW CREATE TABLE` pro users / documents / versions / collections, skutečné hodnoty
ENUM, existující FK, strict režim a konzistence ukazatelů aktuálních verzí. Stávající
nástroj `_pomocne/tools/vz2_preflight.php` je čtecí, ale celý potřebný návrh tabulek
nevypisuje. Nelze nyní označit živou DB za prověřenou ani migraci za připravenou
k okamžitému spuštění na hostingu.

Relevantní tabulky podle současných zdrojů:

| Tabulka | Současné použití |
| --- | --- |
| `users` | Osobní účty, `id INT UNSIGNED`, jméno, role, aktivita |
| `auth_settings` | Nastavení hosta a ověření účtů |
| `vz2_collections` | Stabilní ID celku, `kind=song/rehearsal`, název, stav a pořadí |
| `vz2_recordings` | Stabilní ID nahrávky, rodič `collection_id`, single/multitrack |
| `vz2_documents` | Jeden dokument daného druhu na celek, `current_revision` |
| `vz2_document_versions` | Neměnné tělo verze, autor a UTC čas, PK `(document_id, revision)` |
| `vz2_activity_log` | Deník s aktérem a stabilním ID cíle |
| `vz2_collection_orders` | Zámky a revize katalogu používané společnou zápisovou transakcí |
| `vz2_file_operations` | Rozpracované operace, které mohou blokovat editaci celku |

Migrace `002_vz2.sql` vytváří 13 VZ2 tabulek s prefixem `vz2_`, InnoDB,
utf8mb4 a FK na osobní účty. Migrace `003_vz2_discussion_body.sql` rozšiřuje
tělo diskusních příspěvků na MEDIUMTEXT. Číslo případné nové migrace je podle
aktuálního stromu 004, musí se znovu ověřit před etapou 1.

## 3. Současné verzování a oprávnění

`php/inc/vz2_content.php` implementuje čtení dokumentu, stránkovanou historii,
uložení a obnovení. `vz2_document_write()` běží přes `vz2_write()` v transakci,
zamyká celek a dokument, kontroluje očekávanou aktuální revizi a při konfliktu
vrací HTTP 409. Vloží novou verzi, přepne `current_revision` a zapíše deník.
Obnovení staré verze vytváří novou verzi. Autor verze má FK na `users.id`.
Server ukládá UTC, frontend zobrazuje čas v Europe/Prague a označuje neaktivní účty.

Dokumenty aktuálně dovolují jen `lyrics_chords` / `tablature`. Validátor těla
očekává neprázdný prostý UTF-8 text do 1 MiB. Strukturovanou Mapu tedy nelze
bez úpravy validace pouze poslat současnému editoru tabulatury.

Přístup používá `php/auth.php`, session, obnovení aktivního účtu a CSRF.
Role osobních účtů jsou admin/muzikant, host je zvláštní čtecí přístup.
Právo `edit_text` dovoluje muzikantům upravovat dokumenty společně, není omezeno
jen na autora dokumentu. Admin má výjimku, host nesmí zapisovat. Zápisy musí být
povoleny `VZ2_WRITES_ENABLED`, celek aktivní a bez blokující souborové operace.
**Návrh:** Mapu řídit stejným `edit_text`, nikoli právem přejmenovat vlastní nahrávku.
Oprávnění vždy znovu ověřit na serveru, neodvozovat je jen z viditelnosti tlačítka.

## 4. Frontend, dialogy a řazení

| Soubor | Relevantní odpovědnost |
| --- | --- |
| `vz2.php` | Shell VZ2, panely, konfigurace oprávnění, dialogy a načítání JS/CSS |
| `js/vz2.js` | Katalog, změna skladby/nahrávky, historie URL a integrace panelů |
| `js/vz2-content.js` | Dokumenty, historie, diskuse, pracovní dirty stav, náhledy |
| `js/vz2-layout.js` | Desktop/tablet/mobil, seznam panelů a mobilní navigace |
| `css/vz2.css` | Vlastní styly panelů, společné dialogy a responzivní layout |
| `php/inc/vz2_core.php` | DB, transakce, stabilní ID, oprávnění, deník |
| `php/inc/vz2_content.php` | Dokumenty a jejich verze |
| `php/ajax/vz2_content.php` | Čtecí/zápisové JSON API, přihlášení, CSRF a chyby |
| `php/inc/vz2_storage.php` | Odstranění rodičovského celku včetně dokumentů/verzí |

VZ2 používá nativní `<dialog>`, `.dialog-header`, `.modal-close`, backdrop a
`.vz2-content-dialog`. Funkce pro otevírání obsahových dialogů jsou uzavřené
uvnitř modulu; veřejná univerzální komponenta pro potvrzení neexistuje. Některé
operace používají `confirm()`/`prompt()`. Mapě navrhuji nativní dialogy se stejnými
styly; malý společný pomocník lze vyčlenit při implementaci, bez přestavby ostatního UI.
Pro sekce a přepis detailů bude potvrzení v dialogu, pro neuloženou Mapu přesný
text a akce `Zůstat` / `Zahodit změny`. Zavření přes Escape musí projít stejnou ochranou.

VZ2 má čtyři panely, desktop od 1200 px, mobil do 767 px a dvojici panelů na tabletu.
Mapa nahradí panel Tabulatura. Navigace bude Nahrávky / Text / Mapa / Diskuse;
počet panelů a validace maximálně čtyř panelů zůstanou zachované. Pro kompatibilitu
uloženého layoutu doporučuji ponechat interní klíč slotu `tablature`, změnit jeho
viditelný název a obsah. Klíč layoutu není druh uloženého dokumentu: nová Mapa
stále používá `song_map`. Desktop, tablet i mobil musí používat tentýž slot.

SortableJS používá stará zkušebna v `js/main.js`, načtení je ve staré větvi `index.php`
z CDN s `@latest`. VZ2 ho nenačítá a řadí tlačítky ↑/↓. Pro Mapu doporučuji nejprve
stejná dostupná tlačítka pro sekce i takty. Zadání požaduje přesuny; DnD je možnost.
Pokud bude přidán DnD, jen v UPRAVIT, takty pouze uvnitř sekce, s úchopem a mobilní
ochranou scrollu; případná knihovna v konkrétní verzi, nikoli starý `@latest`.

Současné `canNavigate()` hlídá přehrávač, ne Mapu. Ochranu Mapy je potřeba zapojit
do změny celku, historie prohlížeče, zavření editoru a odhlášení. Při zavření/reloadu
celé stránky lze použít `beforeunload`, ale prohlížeč řídí vlastní text a tlačítka;
přesný požadovaný dialog lze zajistit uvnitř aplikace, ne v systémovém potvrzení.

## 5. Rozhodnutí před etapou 1

### A. K čemu Mapa patří

**Doporučeno:** `vz2_collections.id` s `kind=song`. Jedna Mapa skladby je dostupná
u všech jejích nahrávek; změna názvu nebo souboru ji neovlivní. Smazání/přesun jedné
nahrávky Mapu skladby nesmaže/nepřesune. Samostatnou Mapu pro zkouškový celek návrh
automaticky nepřidává.

**Alternativa:** `vz2_recordings.id`. Každá nahrávka má vlastní Mapu a historii;
vyžaduje samostatné SQL řešení vazby, protože současné dokumenty patří celku.
Jde o funkční rozdíl, ne o zaměnitelnou technickou volbu. Je třeba potvrdit rozsah.

### B. Uložení sekcí a taktů

**Doporučeno:** rozšířit existující dokumenty o `kind=song_map` a ukládat validovaný
JSON snapshot do `vz2_document_versions.body`. Žádné nové tabulky. Mapa má SQL ID
dokumentu; sekce a takty mají stabilní náhodná ID uvnitř snapshotu, která se nemění
při přesunu, přejmenování nebo přečíslování. Při duplikování se všechna příslušná ID
vygenerují znovu. JSON obsahuje celou sémantiku, pořadí a detaily. Není to pouze
soubor zobrazovaných symbolů. Vhodné pro malý editor ukládající výhradně celé verze.

**Alternativa:** samostatné `vz2_song_maps`, `vz2_song_map_versions`,
`vz2_song_map_sections`, `vz2_song_map_bars`, s relačními ID a vazbami. Umožní SQL
dotazy na jednotlivé takty a snadnější budoucí FK z časové synchronizace, ale přidává
správu identity napříč snapshoty, další migraci, dotazy a integrační mazání.
Verzování by převzalo stávající transakční princip, nikoli tabulky dokumentů.
Rozdíl v budoucích SQL vazbách je významný, proto doporučenou variantu nepovažuji
za automaticky odsouhlasenou.

## 6. Konkrétní doporučený SQL a obsahový model

Pouze návrh SQL, tento příkaz nebyl uložen jako migrace ani spuštěn:

```sql
ALTER TABLE vz2_documents
    MODIFY kind ENUM('lyrics_chords','tablature','song_map') NOT NULL;
```

Stávající UNIQUE `(collection_id,kind)` zajistí jednu Mapu na skladbu. Stávající
FK `(id,current_revision)` ukazuje na konzistentní aktuální snapshot; autor a čas
zůstanou v `vz2_document_versions`. Stávající FK na users a celek se nemění.
Podle aktuálního schématu není potřebná změna typu MEDIUMTEXT ani nová tabulka.
Při migraci se nemění stávající číselné pořadí ENUM hodnot. Validace JSON patří
do větve serverového validátoru pro Mapu; prostý text zůstane ostatním dokumentům.

Struktura těla verze:

```json
{
  "schema_version": 1,
  "sections": [
    {
      "id": "4bc91fb279ae467e8b7e786c6f94f1be",
      "name": "Refrén 1",
      "bars": [
        {
          "id": "d60e56ea8d364c848fc2b18bfce54012",
          "base": "hihat",
          "fill": 0,
          "crash": true,
          "special": null,
          "detail": "HH | x-x-x-x-\nSN | --o---o-\nBD | o---o---"
        }
      ]
    }
  ]
}
```

- `base`: null / hihat / ride; `fill`: 0–4; `crash`: boolean;
  `special`: null / unknown / pause / stop. Symbol není uložený význam.
- F4 bez groove má base=null, fill=4; speciální stavy mají base=null, fill=0,
  crash=false. V1 přijímá pouze kombinace palety, ne libovolný Crash + Fill.
- Pořadí v polích určuje pořadí sekcí/taktů. Číslo taktu se počítá při vykreslení.
- ID jsou 32 hex znaků, unikátní v Mapě; server ověří duplicity a formát.
- Detail je prostý UTF-8 text bez hudební interpretace, zachová mezery a nové řádky.
  Vykreslení přes textContent, ne HTML.
- Před uložením server ověří schema_version, tvar, hodnoty, limity názvů/detailů,
  počet objektů a celkový limit těla. Konkrétní limity budou stanoveny v etapě 1.
- Budoucí vazba na čas může použít stabilní ID taktu a novou verzi schématu; dnes
  se žádné časové ani metrické údaje neukládají. Přímý relační FK na JSON takt není možný.

## 7. Integrace a pracovní chování

Panel `Mapa skladby` nahradí současný panel Tabulatura, včetně jeho místa v desktopové
a mobilní navigaci a ve výběru panelů na tabletu. Žádný pátý panel ani samostatné
navigační tlačítko Tabulatury. Nový čistý JS modul pro pracovní Mapu, její render
a Undo; PHP validátor pro strukturované tělo. Pro uložené verze se použije stávající
API dokumentů, historie, očekávaná revize, CSRF a transakční deník.

Případné dosavadní dokumenty `kind=tablature` a jejich historie zůstanou v DB
zachované. Nahrazení panelu neopravňuje k jejich smazání ani k automatické hudební
interpretaci nebo převodu textu na takty. Nová strukturovaná Mapa použije vlastní
druh `song_map`; existující text nelze bez uživatelského přiřazení převést na Detaily
konkrétních taktů. Návrh nepřidává samostatný panel pro starou Tabulaturu.

Výchozí MAPA bez palety a běžně bez čísel taktů. Osm taktů na řádek, mezera po
čtvrtém, i na mobilu. Detail v nativním dialogu. UPRAVIT má paletu, vložení ? před/za,
mazání jednotlivého taktu bez potvrzení, sekce, kopírování detailu a přesuny.
ZÁPIS POSLECHEM má přesnou jednoklikovou paletu a čekající hranici sekce. První
sekci musí zvolit uživatel; další sekce při poslechu vznikne až s prvním taktem.

Undo budou jednoduché kopie pracovního stavu před operací, včetně výběru a hranice
sekce. Undo vytvoření jediné položky nové sekce odstraní i sekci a vrátí kurzor
na konec předchozí. Kopírování detailu a duplikace sekcí jsou nezávislé fyzické kopie.

Uložit detail mění pouze pracovní stav. Uložit mapu vytváří jednu novou verzi celé
Mapy. Bez autosave. Historie má náhled starého stavu a obnovení jako novou verzi,
shodně s dokumenty. HTTP 409 zachová pracovní změny a nabídne porovnání; žádné
tiché přepsání cizí verze. Žádná akce pro samostatné mazání celé Mapy.

## 8. Předpokládané soubory a etapy

Nové:

- `_pomocne/migrations/004_vz2_song_map.sql` — po schválení a kontrole živého schématu.
- `php/inc/vz2_song_map.php` — validace a pomocné operace se snapshotem.
- `js/vz2-song-map.js` — stav, rastr, režimy, sekce, takty, detail a Undo.
- `_pomocne/tests/vz2_song_map.test.js`, `.integration.js`, `.browser.js`.
- Navazující protokoly v `_pomocne/docs/vz2/` a předání v `_pomocne/deploy/`.

Změněné:

- `php/inc/vz2_content.php` — povolený druh a validace Mapy, historie/obnovení.
- `vz2.php`, `js/vz2-layout.js`, `css/vz2.css` — nahrazení obsahu a názvu slotu
  Tabulatura Mapou, čtyři tlačítka navigace, dialogy, mobil.
- `js/vz2.js`, podle integrace `js/vz2-content.js` — načtení a ochrana při navigaci.
- `_pomocne/tools/vz2_preflight.php` — čtecí ověření nové možnosti dokumentu.
- Stávající integrační a browser testy — příprava migrované testovací DB a regrese.

Etapy 1–7 zůstanou podle zadání: data → zobrazení → editor → detail → poslech
→ ukládání/historie → mobil/integrace. Před každou etapou kontrola HEAD; po ní
report změn, DB, testů, omezení a případného nového commitu.

Ověření zahrne stabilitu ID, hranice sekcí, nezávislost kopií, Undo, čekající sekci,
jednoklikový zápis, atomické verze, konflikt dvou editorů, selhání zápisu deníku,
host/muzikant/admin a CSRF. Browser kontroly pokryjí 8 taktů včetně mobilu,
Escape/navigaci s dirty stavem, čtení historie, zachování čtyř panelů a uloženého
layoutu, zachování původních dat tabulatur a regresi textu, diskuse a přehrávače.
Připravené integrační testy projektu vyžadují samostatnou testovací MariaDB a PHP;
nikdy se nesmí spouštět proti konfigurované produkční DB.

## 9. Report Etapy 0

1. Výchozí commit: `2d983a835e07e6a9b256116b9ca14efd90d70570`.
2. Výsledný commit nebyl vytvořen; běhové soubory beze změny.
3. Nový pouze tento dokument `_pomocne/docs/vz2/song-map-stage0.md`.
4. DB změny: žádné; ani nebyla vytvořena migrační implementace.
5. Dokončeno: inventura aktuálních zdrojů a návrh integrace se dvěma rozhodnutími.
6. Ověřeno čtením: Git, migrace, PHP model, práva, API, historie, frontend,
   dialogy, řazení, odstranění rodiče a testovací infrastruktura. Funkční testy
   nebyly spouštěny; živé schéma nebylo aktuálně přístupné.
7. Rozhodnutí o vazbě a SQL modelu následně potvrzená uživatelem. Před DB nasazením
   zůstává potřebná živá čtecí kontrola schématu. Navazuje Etapa 1.
8. Zapracované upřesnění: Mapa nahrazuje Tabulaturu v UI, zůstávají čtyři tlačítka.
   Uživatel poté výslovně potvrdil vazbu na skladbu a rozšíření dokumentů o song_map.
