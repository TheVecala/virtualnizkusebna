# Etapa 3 — společné časové zápisy

Stav 19. 9. 2026: implementováno a lokálně ověřeno, připraveno k nahrání na betu.
Výchozí commit uživatele `a009d195f10706c2d26a47842f32ac07b357a61f` byl během
práce přejmenováním zprávy nahrazen `28f3f4f91cc793cc2d2b70f6d5c07c7bf3ade0b9`;
rozdíl jejich stromů je prázdný. Uživatel následně commitnul etapu 3 jako `28d3c87a`.

## Oprava otevření Mixéru po 28d3c87a

Odkaz `index.php?v=2&view=mixer` odkryl Mixér pod katalogem. Jakmile se katalog
asynchronně naplnil, odsunul Mixér mimo první obrazovku. V reprodukčním testu
začínal panel až na y=1861 px; uživateli tak po okamžiku zdánlivě zmizel.

`vz2.php` nyní nastaví viditelnost obou částí už v HTML: v pohledu Mixér je
katalog skrytý a Mixér viditelný od začátku. Pohled Skladby a zkoušky zůstává
beze změny. Na betě stačí nahradit **pouze `vz2.php`**; SQL ani konfigurace se nemění.

Nový prohlížečový regresní test před opravou selhal na poloze panelu; po opravě
ověřuje jeho viditelnost po načtení katalogu, otevření vícestopé nahrávky a návrat
do katalogu. Celá integrační sada s prohlížečem: **91 PASS**, PHP lint a diff check PASS.

## Hotové funkce

- Jeden PHP modul `php/inc/vz2_timestamps.php` pro katalog, běžný přehrávač i Mixér.
  Endpoint `php/ajax/vz2_timestamps.php`: GET list/export podle `recording_id`,
  POST create/update/delete s CSRF, osobní identitou a aktuálními právy.
- Společný panel `js/vz2-timestamps.js` v katalogu i Mixéru. Oba pohledy sdílejí
  odpovědi stejného endpointu. Nevzniká druhé úložiště ani zápis do legacy JSON.
  Tři typy, čas v milisekundách, přidání a návrat na čas, opakované přidávání,
  editace/smazání, filtrování typů pro tabulku do schránky a serverový TXT export.
- Interval začátku skladby končí dalším striktně pozdějším začátkem skladby;
  pasáž další pasáží nebo začátkem skladby. Poznámky ani shodné časy konec
  nevymezují. Poslední úsek končí známou délkou nahrávky; bez ní smyčka není aktivní.
- Adaptéry HTML audio a WebAudio používají ms na rozhraní. Nahrávka bez audia
  ponechává seznam/editor/export; přehrávací tlačítka jsou neaktivní. U částečné
  sady Mixér vyžaduje potvrzení přehrání dostupných stop a ukazuje varování.
  Serverem označenou chybějící stopu nepřehrává ze staré offline kopie.
- Samostatné autorství souhrnu je viditelné v katalogu. Úprava pouze názvu už
  nepřisuzuje nezměněný souhrn novému editorovi; původní autor zůstává zachován.

## Souběžné změny, práva a audit

Čtení seznamu a export používají konzistentní SQL snapshot. Zápis v jedné
transakci zamkne rodiče, zkontroluje `timestamps_revision` a při update/delete
také `revision` konkrétního zápisu, provede změnu, zvýší revizi seznamu a zapíše
deník. Selhání kterékoliv části vrátí celou transakci. Revize metadat nahrávky
se tím nemění; její souhrn používá vlastní dosavadní cestu `recording_update`.

Člen s právem `comment` může přidávat i do cizí nahrávky; mění a maže jen vlastní
zápisy. Admin může všechny. Host pouze čte/exportuje. Vlastník nahrávky nezískává
práva k cizím zápisům. Autor/editor pochází ze session, identita je zachována
i po deaktivaci účtu. Zápisy respektují `VZ2_WRITES_ENABLED` a rozpracované mazání.

HTTP 409 ponechá rozepsaný formulář. Uživatel může načíst aktuální obsah
k porovnání a výslovně přijmout jeho revizi pro další uložení svého textu.
Nedochází k automatickému přepsání či opakování zápisu s novou revizí.
Formulář přežije i obnovení katalogu při návratu online. Lokálně se ukládá pouze
preference typu a opakovaného přidávání, nikoliv další kopie SQL zápisů.

## Ověření

- `_pomocne/tests/vz2_integration.test.js` s `VZ2_TEST_BROWSER=1`: **90 PASS**. Privátní
  dočasná kopie aplikace, vlastní testovací databáze, PHP 8.5.10 a MariaDB 11.4.5
  s nestriktním globálním výchozím režimem. Živé přihlašovací údaje se nenačítají.
- Nový integrační modul `_pomocne/tests/vz2_timestamps.integration.js`: práva, CSRF,
  read-only režim, cizí rodič, neplatné časy a Unicode limity, stejné časy,
  konflikty revizí, dvěma klienty provedené přidání se stejnou revizí, rollback
  při vynuceném selhání auditu, autorství a deaktivace, souhrn, smazané audio,
  neznámá délka, export a bezpečný název souboru, audit po úplném odstranění.
- `_pomocne/tests/vz2_timestamps.browser.js`: skutečné stránky a HTTP v headless Edge
  přes Playwright. Bezpečné vykreslení textu, zachování draftu při 409 i obnově
  katalogu, porovnání a nové uložení, opakované přidávání, návrat na čas, smyčka
  v obou přehrávačích, tabulka do schránky, TXT download, společné zobrazení,
  částečný Mixér, stav bez audia, šířky 1440/390 px bez vodorovného přesahu.
  Žádné chyby JavaScriptu. Snímky byly vizuálně zkontrolovány.
- `_pomocne/tests/vz2_timestamps.test.js`: PASS — hranice intervalů, shodné body,
  neznámý konec, přesné převody ms, neplatný vstup, typový filtr a tabulátory.
- Původní `multitrack_contract.test.js` (45 DOM ID),
  `multitrack_sample_rate.test.js`, `multitrack_browser_smoke.test.js`: PASS.
- PHP lint změněných PHP, JS syntax a `git diff --check`: PASS.

Příklad spuštění (MariaDB musí být připravená na vyhrazeném lokálním portu):

```powershell
$env:PHP_BIN = 'C:\cesta\php.exe'
$env:VZ2_TEST_DB_PORT = '33328'
$env:VZ2_TEST_EXPECT_NONSTRICT_DEFAULT = '1'
$env:VZ2_TEST_BROWSER = '1'
# Playwright musí být dostupný přes node_modules nebo NODE_PATH.
# Volitelně PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH pro nainstalovaný Chromium/Edge.
node _pomocne/tests/vz2_integration.test.js
node _pomocne/tests/vz2_timestamps.test.js
```

Na hostingu běží PHP 8.1.32; nová etapa tam ještě nebyla ověřena. Kód používá
API dostupné v PHP 8.1. Audio testů je syntetické; nejde o poslechový test kapely.
Smyčka vrací transport pomocí časovače prohlížeče, není to bezešvé studiové
smyčkování přesné na vzorek. Časovače může prohlížeč na pozadí zpomalit.

## Nasazení

Viz `_pomocne/deploy/vz2-stage3/README.cs.md`. Balíček obsahuje pouze devět provozních
souborů pro současnou betu. Nemění konfiguraci, storage ani databázové schéma;
migrace 002 se neopakuje. Neobsahuje diagnostické endpointy ani testy.
Původní alfu a její legacy timestampové/JSON obsluhy tato etapa nenahrazuje.
Dokumenty, diskuse a Nápady patří do další etapy.
