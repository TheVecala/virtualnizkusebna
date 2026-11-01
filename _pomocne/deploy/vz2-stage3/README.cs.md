# VZ2 — etapa 3, aktualizace bety

Balíček navazuje na fungující betu z `a009d195` (stejný obsah jako `28f3f4f`).
Přidává společné časové zápisy, smyčky a export pro běžné audio i Mixér.

1. Rozbalte ZIP. Na FTP otevřete `zkusebna_beta`.
2. Obsah složky `1_soubory` nahrajte do `zkusebna_beta` se zachováním podsložek
   a přepsáním stejnojmenných souborů. Samotnou složku `1_soubory` nekopírujte.
   Přeneste všech **9 souborů**, poté pokračujte v prohlížeči.
3. Otevřete betu `index.php?v=2` a obnovte stránku pomocí Ctrl+F5.
4. U nahrávky přidejte začátek skladby a další začátek o několik sekund později.
   Vyzkoušejte Smyčku, Upravit, Kopírovat tabulku a Export TXT. Totéž lze používat
   v Mixéru; zápisy jsou společné s kartou stejné nahrávky v katalogu.

**Žádné SQL nespouštějte, konfiguraci neměňte.** Současné `config.php`,
`config.vz2.php`, úložiště a databáze zůstávají. Na starší alfu se tento balíček
nenahrává. Neobsahuje soubory do `tools`.

Pro kontrolu jiného uživatele: člen může přidávat zápisy i do cizí nahrávky,
ale upravovat/mazat jen vlastní. Admin může všechny, host pouze čte/exportuje.
Při konfliktu rozepsaný text zůstane; tlačítko nabídne aktuální verzi k porovnání.

Provozní soubory:

```text
css/vz2.css
js/multitrack.js
js/vz2.js
js/vz2-timestamps.js
php/inc/vz2_core.php
php/inc/vz2_catalog.php
php/inc/vz2_timestamps.php
php/ajax/vz2_timestamps.php
vz2.php
```

Manifest vedle složky `1_soubory` obsahuje kontrolní SHA-256. README a manifest
jsou pouze pro lokální orientaci; na FTP patří obsah `1_soubory`.

Případný návrat: obnovit šest dříve existujících souborů z předchozí bety a
odebrat tři nové soubory `js/vz2-timestamps.js`, `php/inc/vz2_timestamps.php`,
`php/ajax/vz2_timestamps.php`. Není potřeba měnit SQL ani mazat časové zápisy.
Předchozí verze je dál umí zobrazit jako seznam.
