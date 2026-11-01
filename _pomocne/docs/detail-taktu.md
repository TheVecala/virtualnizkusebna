# Detail taktu – implementace a ověření

Výchozí repozitář: `TheVecala/virtualnizkusebna`, lokální větev `work` bez upstreamu.
Výchozí HEAD: `4217f6a795c6c78bbe42056357d5b07ff9e2f956`, pracovní strom před úpravami čistý.
První `git fetch origin beta` zablokoval síťový sandbox. Práce pokračovala z výslovně zadaného commitu;
opakovaný fetch se síťovým přístupem potvrdil tentýž commit na `origin/beta`. Bez přepínání větve či resetu.

## Chování a data

- Nový detail je prázdný. Šablona vznikne jen tlačítkem Předvyplnit; neprázdný draft včetně samotných mezer vyžaduje potvrzení. Náhradu vrátí jedna akce Zpět.
- Nabídka obsahuje 2/4, 3/4, 4/4, 5/4, 6/4, 3/8, 6/8, 7/8, 9/8 a 12/8. Dvouřádkové záhlaví 12/8 má desítky nad jednotkami. Nástrojové řádky obsahují pouze pomlčky, žádné přednastavené údery.
- Metrum pro generování používá pouze `sessionStorage`, klíč `vz2.song-map.bar-detail.template-meter`. Výchozí hodnota je 4/4, při chybě úložiště se používá paměť. Uložený text se neparsuje a neovlivňuje výběr.
- Textarea používá monospace bez ligatur a zalamování; dlouhé řádky se posouvají vodorovně. Font lze měnit po 2 px mezi 12 a 28 px. Metrum ani font nemění text či dirty stav.
- Přepis, Delete a Backspace respektují grafémy a hranice řádků. Výběr se nahrazuje přesně, Enter a víceřádkový paste umožňují strukturální úpravy. Editor má společnou historii pro přepis, paste, cut, composition a šablony; podporuje Zpět/Znovu tlačítky i Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z a Ctrl+Y. Přetažení textu je zakázáno.
- Obsah zůstává jediným textovým `bar.detail` v JSON snapshotu stávajícího `vz2_document_versions.body`. **Žádná migrace ani samostatné SQL pole metra.** Mezery, prázdné řádky a libovolný text se zachovávají, CRLF/CR se v editoru konzistentně normalizují na LF bez falešného dirty stavu. Text se nezkracuje, platí dosavadní limity 64 KiB/detail a 1 MiB/mapa.
- **Uložit detail nyní čeká na SQL uložení nové verze celé mapy**, včetně případných dalších rozpracovaných změn mapy. Dialog toto chování uvádí. Používá stávající endpoint, oprávnění, CSRF, kontrolu revize a transakční historii.
- Otevření, změna metra/fontu a předvyplnění nic nezapisují do SQL ani historie. Indikace vychází pouze z textu poslední serverové verze a pravidla `typeof text === 'string' && text.trim().length > 0`. Neuložený text ani kopie indikaci nepřidávají; po úspěšném uložení prázdného či whitespace-only textu zmizí.
- Zavření a odchod s rozepsaným detailem nabízí Uložit / Zahodit změny / Zůstat. Chyba serveru nebo konflikt ponechá editor i draft otevřený; u konfliktu lze použít existující porovnání verzí. Zahození nezapisuje do SQL. Obnova/zavření stránky používá stávající `beforeunload` ochranu.
- Mapa zachovává rozložení, ovládání, pořadí a navigaci. Změněna je indikace uloženého detailu a ochrana navigace při otevřeném detailu. Hosté a historické náhledy jsou pouze ke čtení.

## Relevantní soubory

- `js/vz2-bar-detail.js`: generátor, session preference, Unicode přepis a obsluha vstupu/historie.
- `js/vz2-song-map.js`: dialog, SQL uložení přes stávající mapové verzování, indikace a ochrany.
- `css/vz2.css`: styly omezené na Detail taktu.
- `vz2.php`: načtení nového modulu s verzováním URL podle změny souboru.
- `_pomocne/tests/vz2_bar_detail.test.js`: generování všech meter, preference, indikace a přepis.
- `_pomocne/tests/vz2_bar_detail.browser.js`: nový prohlížečový test se skutečným PHP a SQL.
- `_pomocne/tests/vz2_song_map.browser.js`: původní regrese přizpůsobená přímému ukládání detailu.
- `_pomocne/tests/vz2_integration.test.js`: cílené spuštění mapových a detailových testů přes `VZ2_TEST_SUITE=songmap`.

## Provedené ověření

- `node _pomocne/tests/vz2_bar_detail.test.js`: PASS; všech 10 meter, preference včetně selhání zápisu do úložiště, indikace a 20 textových operací včetně emoji a kombinujících znaků.
- `node _pomocne/tests/vz2_song_map.test.js`: PASS stávajícího modelu mapy.
- `php _pomocne/tests/vz2_song_map.php`: PASS, 33 kontrol validace a zachování dat.
- `php -l vz2.php`, syntaxe obou změněných JS modulů a `git diff --check`: PASS.
- Cílená integrační sada: PASS, 15 skupin kontrol v Chromium + PHP + MariaDB 11.8.6, izolovaná dočasná databáze a kopie aplikace. Zahrnuje původní mapové regresní testy (šířky 1440, 1024, 768, 390 a 320 px), ukládání a historii, oprávnění a CSRF, konflikty, rollback, generování/undo, skutečné psaní a clipboard přes klávesnici, cut/výběry, font a kurzor, selhání uložení, whitespace indikaci, doslovné `<script>`, navigation guard a skutečný desktopový `beforeunload` dialog při reloadu.
- Composition byla ověřena vstupní cestou Chromium přes CDP (`Input.imeSetComposition` + `Input.insertText`), neodvolatelný insert/delete také syntetickými beforeinput/input událostmi. Nejde o ověření fyzické mobilní klávesnice.
- Vizuálně zkontrolován mobilní screenshot šířky 390 px; prohlížeč ověřil vodorovné posouvání editoru bez rozšíření stránky.

Příklad spuštění (cesty upravit podle prostředí):

```sh
PHP_BIN=/workspace/cloud-setup/bin/php VZ2_TEST_DB_PORT=13306 VZ2_TEST_SUITE=songmap PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node _pomocne/tests/vz2_integration.test.js
```

## Praktické limity

Nebylo možné ověřit fyzické Android/iOS zařízení, systémové IME, dotykový výběr a mobilní clipboard ani nativní kontextovou nabídku paste. Firefox/Safari nebyly spuštěny. Zmenšení viewportu a CDP composition tato ověření nenahrazují. Před nasazením je vhodné projít odpovídající akceptační scénáře na podporovaných telefonech. `beforeunload` může prohlížeč, zejména při ukončení mobilní aplikace, vynechat; žádné automatické SQL ukládání jej nesupluje. Libovolné Unicode znaky nemusí mít v monospace fontu stejnou vizuální šířku.
