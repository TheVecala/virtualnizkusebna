# VZ2 — etapa 4, dokumenty a diskuse

Pro současnou betu z commitu `01cec177`. Balíček obsahuje šest provozních
souborů a jednu doplňkovou SQL migraci. Neobsahuje konfiguraci ani hesla.

## 1. Databáze — nejprve migrace 003

Před změnou schématu použijte aktuální zálohu databáze.

V databázové administraci vyberte **18810_virtualni_zkusebna** a spusťte celý
soubor `2_sql/003_vz2_discussion_body.sql` (importem nebo vložením do SQL okna).
Rozšiřuje pouze pole pro text diskusního příspěvku, aby se vešlo 20 000 znaků
i při použití emoji. Dosavadní data zachovává.

**Migraci 002 neopakujte. Databázi 18810_VZ2 nepoužívejte.**

Pro kontrolu můžete poté spustit:

```sql
SELECT DATABASE();
SHOW COLUMNS FROM vz2_discussion_posts LIKE 'body';
```

Výsledkem má být databáze `18810_virtualni_zkusebna` a typ pole `mediumtext`.
Při chybě migrace zatím nenahrávejte další soubory a pošlete chybovou zprávu.
SQL soubor nenahrávejte do veřejné složky na FTP.

## 2. Soubory na FTP

Obsah složky `1_soubory` nahrajte do `zkusebna_beta` se zachováním podsložek
a přepsáním stejných názvů. Samotnou obalovou složku `1_soubory` nekopírujte.
Nejprve lze přenést složky `php`, `js`, `css`, soubor `vz2.php` jako poslední.
Pokračujte v prohlížeči až po dokončení všech přenosů.

```text
php/inc/vz2_content.php
php/ajax/vz2_content.php
js/vz2-content.js
js/vz2.js
css/vz2.css
vz2.php
```

`config.php` ani `config.vz2.php` neměňte. Nic se nenahrává do `tools` ani
do privátního úložiště. Balíček nepatří na starší alfu.

## 3. Ověření na betě

Otevřete `index.php?v=2` a obnovte stránku přes Ctrl+F5.

1. U skladby nebo zkoušky otevřete **Text a akordy**, něco uložte a poté změňte.
   V **Historii verzí** zobrazte první verzi a obnovte ji jako novou.
2. Vyzkoušejte **Tabulaturu** a přidání, úpravu a smazání vlastního příspěvku
   v **Diskusi**. Dokumenty a diskuse fungují také bez audia.
3. V horní liště otevřete **Nápady**. Jsou společné, oddělené od jednotlivých diskusí.
4. V Mixéru po výběru nahrávky vede tlačítko **Diskuse ke skladbě / zkoušce**
   do stejné diskuse jako tlačítko u jejího celku v katalogu.

Člen může společné dokumenty upravovat. V diskusi mění jen své příspěvky;
admin všechny a host pouze čte. Konflikt nezahodí rozepsaný text: nejprve
zobrazte aktuální verzi k porovnání, pak případně přijměte její revizi a uložte.

## Případný návrat

Obnovte `vz2.php`, `js/vz2.js`, `css/vz2.css` z předchozí bety a odeberte tři
nové soubory `js/vz2-content.js`, `php/inc/vz2_content.php`, `php/ajax/vz2_content.php`.
**Sloupec MEDIUMTEXT ponechte; nezužujte jej zpět.** Je kompatibilní s předchozím
runtime a chrání již uložené delší příspěvky. Dokumenty, verze a diskuse v SQL
ponechte pro budoucí návrat nové verze.

Místní ověření: 117 integračních/prohlížečových kontrol, regresní testy
timestampů a Mixéru, PHP lint a JS syntax. Na živém hostingu se ověřuje až nyní.
