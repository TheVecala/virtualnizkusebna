# Etapa 4 — dokumenty, verze a diskuse

20. 9. 2026. Navazuje na `01cec177d42587c5a9f69457d3d61a970f3feea4`.
Implementace a místní ověření jsou hotové. Uživatel následně potvrdil funkčnost
na živé betě a uložil tuto etapu do `d8fd9722`.

## Funkce

U každé skladby i zkoušky jsou dostupné „Text a akordy“, „Tabulatura“ a „Diskuse“.
Nahoře je společná sekce „Nápady“. Mixér otevírá diskusi své rodičovské skladby
nebo zkoušky. Dokumenty i diskuse fungují také u celku bez nahrávek.

Každý celek má nejvýše jeden dokument každého ze dvou druhů. První otevření
nic nevytváří; dokument vznikne prvním uložením. Text se ukládá doslova, včetně
odsazení a konců řádků, a zobrazuje se v editoru s neproporcionálním písmem.
Dokument má název, původního autora, posledního editora a UTC časy. Limit obsahu
je 1 MiB UTF-8; prázdný dokument se neukládá.

Každé uložení vloží novou verzi. Historie nabízí stránky po 20 verzích a čtení
libovolné starší verze. Obnovení převezme obsah vybrané verze na serveru a vytvoří
další verzi s aktuálním editorem. Původní verze se neupravují ani neprořezávají.
Verzovaný je obsah; obnovení ponechává současný název dokumentu. Historie se
odstraňuje pouze při explicitním úplném smazání její kolekce administrátorem.

Diskuse používá jedno stabilní vlákno na celek, Nápady jedno globální vlákno.
Příspěvky se stránkují po 20 od nejnovějších, každý má vlastní ID, revizi,
autora/editor a časy. Člen může přispívat i do cizí kolekce; upravuje a maže jen
vlastní příspěvky. Admin může všechny, host pouze čte. Dokumenty jsou společné:
každý člen s `edit_text` je může uložit nebo obnovit, nezávisle na autorovi.
Deaktivované autory UI označuje a jejich dřívější obsah ponechává čitelný.

## SQL a ochrany

Nový modul `php/inc/vz2_content.php` obsluhuje dokumenty i diskuse přes JSON
endpoint `php/ajax/vz2_content.php`. Čtení používá konzistentní snapshot.
Zápisy používají dosavadní `vz2_write`: obnovení identity, kontrolu zápisového
přepínače, práva, zámky rodiče a atomický zápis obsahu spolu s deníkem.

Dokument ukládá `current_revision` z klienta, při prvním uložení 0. První insert
dokumentu, první verze a ukazatel na ni jsou v jedné transakci. Souběžný první
save vytvoří právě jeden dokument. Další save/restore zamkne dokument a
porovná revizi i vazbu ID na kolekci a druh. Původní autor se nepřepisuje.

Každý zápis diskuse explicitně nese `thread_id`; edit/delete navíc `post_id`
a revizi. Server ověří vazbu příspěvku na vlákno. Výběr v session neřídí cíl
zápisu. Paralelní přidání ponechá oba nové příspěvky; editace stejné položky
se zastaralou revizí vrací 409. Odstraňovaný celek nepřijímá nové zápisy.

Formulář při 409 ponechá rozepsaný text. Aktuální obsah lze nejprve načíst
k porovnání a teprve dalším potvrzením přijmout jeho revizi pro nové uložení.
Obnovení katalogu formulář nezničí, zavření s konceptem vyžaduje potvrzení.
Za běžícího požadavku se formulář nezavírá a opakované odeslání je blokované.
HTML v obsahu se zobrazuje jako text, nikoliv jako vykonatelné značky.

Deník zachycuje `document.version_created` (včetně čísla obnoveného zdroje),
`discussion.post_created`, `discussion.post_updated`, `discussion.post_deleted`.
Neukládá celý obsah dokumentů ani příspěvků. Selhání auditu odvolá obsahový zápis.
Úplné smazání kolekce využívá dosavadní mazání dokumentů/verzí a diskusních
příspěvků; globální Nápady a audit zachovává.

### Doplňková migrace 003

Původní `vz2_discussion_posts.body` byl `TEXT` (nejvýše 65 535 bajtů).
Požadovaných 20 000 Unicode znaků může zabrat až 80 000 bajtů. Soubor
`migrations/003_vz2_discussion_body.sql` proto pouze rozšiřuje tento sloupec
na `MEDIUMTEXT NOT NULL`, se zachováním obsahu. Před DDL nastaví strict SQL
pro konkrétní spojení a zachová ostatní SQL modes. V aplikaci zůstává limit
20 000 znaků. Opětovné provedení stejného rozšíření je neškodné.

Počet tabulek zůstává 13. Migrace 002 ani konfigurace se nemění. Migruje se
stávající sdílená databáze `18810_virtualni_zkusebna`, nikoliv prázdná `18810_VZ2`.

## Ověření

- `tests/vz2_integration.test.js` s `VZ2_TEST_BROWSER=1`: **117 PASS**. Izolovaná
  dočasná kopie aplikace, vlastní testovací DB, PHP 8.5.10, MariaDB 11.4.5
  s nestriktním globálním SQL režimem, headless Edge přes Playwright.
- Nový `tests/vz2_content.integration.js`: čtení bez založení dokumentu,
  host/anon/CSRF/read-only, chybný druh/text/limit, souběžný první save,
  společná editace a nezměněný původní autor, zastaralá revize/cizí rodič,
  čtení staré verze, obnova jako nová, rollback prvního i dalšího save při
  selhání auditu, stránkování 23 verzí, 1 MiB Unicode dokument, oddělená vlákna,
  20 000 emoji v příspěvku, práva vlastníka/admina, konflikt edit/delete,
  rollback všech tří operací příspěvků, deaktivace, paralelní přidání,
  stránkování příspěvků, stabilní adresování a úplné smazání při zachování Nápadů.
- Nový `tests/vz2_content.browser.js`: skutečný editor, konflikt a porovnání,
  historie a obnovení, koncept při obnovení katalogu, oddělení tabulatur,
  bezpečné zobrazení značek, členská práva u příspěvků, jejich editace/konflikt/
  smazání, Nápady, hostův režim čtení dokumentů a historie, oddělení kolekcí,
  propojení diskuse z Mixéru, zobrazení 1440 a 390 px bez vodorovného přesahu.
  Snímky dokumentu a mobilní diskuse byly vizuálně zkontrolovány. Žádné JS chyby.
- Původní prohlížečové testy etapy 3 jsou součástí uvedených 117 kontrol.
  `vz2_timestamps.test.js`, `multitrack_contract.test.js` (45 DOM ID),
  `multitrack_sample_rate.test.js`, `multitrack_browser_smoke.test.js`: PASS.
- PHP lint všech nových/změněných PHP, JS syntax a `git diff --check`: PASS.

```powershell
$env:PHP_BIN = 'C:\cesta\php.exe'
$env:VZ2_TEST_DB_PORT = '33328' # samostatná lokální testovací MariaDB
$env:VZ2_TEST_EXPECT_NONSTRICT_DEFAULT = '1'
$env:VZ2_TEST_BROWSER = '1'
# Playwright v node_modules nebo NODE_PATH; volitelně PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH.
node tests/vz2_integration.test.js
```

Na hostingu běží PHP 8.1.32; implementace používá API dostupné v PHP 8.1,
ale tato etapa tam ještě ověřena nebyla. Testovací databáze byly odstraněny.
Živá databáze, konfigurace ani uživatelské soubory nebyly při vývoji měněny.
Původní legacy editory a diskuse se automaticky nepřevádějí.

Nasazení a návrat na předchozí runtime: `deploy/vz2-stage4/README.cs.md`.
