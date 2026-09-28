# Mapa skladby V1 — ruční nasazení

Mapa nahrazuje panel Tabulatura, zachovává čtyři obsahová tlačítka a nastavení
rozložení. Jedna Mapa patří celé skladbě, všem jejím nahrávkám společně. Současná
prostá tabulatura a její historie zůstávají v DB; neprovádí se automatický převod.

## Pozdější úprava rozhraní

Pokud je už Mapa V1 na betě nasazená, pro tuto úpravu stačí nahrát současně
`css/vz2.css`, `js/vz2-song-map-model.js` a `js/vz2-song-map.js` do původních cest.
Databázová migrace se neopakuje. Po nahrání ověřit vytvoření první série taktů
bez výběru sekce, přepínání „Vybrat takt“ / „Změnit typ taktu“, použití druhu
teprve kliknutím do Mapy, Zpět vpravo vedle režimů, nabídku akcí až po výběru
taktu, tlačítka pro přidání pod paletou, přepínač úprav přímo nad Mapou,
zobrazení typu na tlačítku Přidat takt a nezávislé posouvání Mapy.

## Pořadí nasazení

1. Ověřit aktuální živou DB a zálohu: jde o současnou společnou DB VZ2, nikoli
   novou prázdnou databázi. Přečíst SHOW CREATE TABLE vz2_documents,
   vz2_document_versions, vz2_collections a users; potvrdit prefix a FK.
2. Před migrací má documents.kind obsahovat lyrics_chords / tablature, případně
   již song_map. Pokud obsahuje další vlastní druhy, nepoužívat migraci 004
   bez úpravy zachovávající tyto druhy.
3. Spustit celý `_pomocne/migrations/004_vz2_song_map.sql` ručně na jednom spojení
   a zastavit při první chybě. Příkaz nic nekopíruje, nemaže ani nevytváří mapy;
   přidá třetí druh dokumentu. Staré dokumenty ani číselné pořadí ENUM se nemění.
4. Nahrát současně následující běhové soubory do jejich původních cest:

   - `vz2.php`
   - `css/vz2.css`
   - `js/vz2-song-map-model.js`
   - `js/vz2-song-map.js`
   - `js/vz2-content.js`
   - `js/vz2-layout.js`
   - `js/vz2.js`
   - `php/inc/vz2_song_map.php`
   - `php/inc/vz2_content.php`
   - `php/ajax/vz2_content.php`

5. Aktualizovaný `_pomocne/tools/vz2_preflight.php` lze nahrát pouze jako dočasnou
   administrační čtecí kontrolu podle stávajícího postupu nasazení, ne kopírovat
   celou složku `_pomocne/` do webu. Ověřuje i ENUM z migrace 004. Po kontrole
   dočasnou diagnostiku odstranit stejným postupem jako při předchozích nasazeních.
6. Ověřit na betě osobní účet s edit_text a hosta: nová skladba bez Mapy, první
   takt bez povinné sekce, poslech, Undo, uložení, reload, Detail, historie a mobilní rastr.
   Zkontrolovat i Text, Diskusi, Looper a Mixér. Bez změny konfigurace účtů/storage.

Migrace nebyla tímto vývojem spuštěna na živém hostingu. Testovací DB byla privátní
místní MariaDB 11.4.5. Místní PHP je 8.5.10; kód je psaný pro PHP 8.1, kontrola
na cílovém PHP 8.1 hostingu je ještě součástí nasazení.

## Uložení a návrat

Každé Uložit mapu vytvoří jednu verzi dokumentu se všemi sekcemi, takty a detaily.
Detail se ukládá pouze do pracovní Mapy. Konflikt zachová rozepsané změny, obnovení
historické verze vytvoří další verzi. Autosave ani samostatné mazání Mapy neexistuje.

Pro návrat UI použít původní běhové soubory. **Nevracet ENUM na dva druhy, pokud
už existují song_map dokumenty:** ponechat rozšířené schéma a data včetně historie.
Předchozí UI tyto dokumenty neotevírá; staré tabulatury jsou stále dostupné původnímu UI.
Neprovádět DROP ani mazání mapových verzí jako součást návratu.

## Lokální ověření

Samostatná testovací MariaDB na localhost portu jiném než 3306 a PHP s mysqli/iconv:

```powershell
$env:PHP_BIN = 'C:\cesta\php.exe'
$env:VZ2_TEST_DB_PORT = '33329'
# NODE_PATH nastavte jen pokud Playwright není v běžné cestě modulů.
$env:VZ2_TEST_BROWSER = 'songmap' # '1' také spustí ostatní browser regrese
& $env:PHP_BIN _pomocne/tests/vz2_song_map.php
node _pomocne/tests/vz2_song_map.test.js
node _pomocne/tests/vz2_integration.test.js
```

Integrační runner vytvoří vlastní náhodně pojmenovanou DB, privátní kopii webu
a testovací účty. Nenačítá produkční config. Po dokončení odstraní svoji DB;
diagnostika a snímky zůstanou v uvedeném dočasném adresáři.
