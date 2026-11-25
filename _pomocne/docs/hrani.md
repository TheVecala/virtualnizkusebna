# Hráčské zobrazení

Vstup: `hrani.php` nebo odkaz **Hraní** v nabídce Další možnosti zkušebny.
Základem je aktuální beta VZ2, nikoli stará single-band aplikace.
Používá společnou session a kontrolu osobních účtů / hosta, aktivní kolekce
typu `song`, jejich databázové pořadí, aktuální verze dokumentů a diskusi VZ2.
Audio a přílohy zpřístupňuje přes chráněný endpoint `php/ajax/vz2_files.php`.
Vícestopé nahrávky otevírá ve stávajícím mixéru. Chybějící a smazané soubory
označuje bez nefunkčního přehrávače nebo odkazu.

Datové čtení probíhá v read-only transakci. Neprovádí migrace, databázové ani
souborové zápisy. Nastavení vzhledu ukládá do localStorage. Výběr skladby je
v URL a nemění výběr v běžné zkušebně.

## Rozvržení

- Kompaktní / Přehled / Velká tlačítka: hustota detailu.
- Běžné / Na zeď: nezávislá velikost pro sledování z dálky.
- Na úzkých displejích detail vynechává globální hlavičku; přepínač hustoty
  i návrat do seznamu zůstávají přímo v detailu.
- Přepnutí vzhledu nepřestavuje přehrávače. Otevření jiné skladby nebo návrat
  do seznamu přehrávání zastaví. V jeden okamžik hraje nejvýše jedna nahrávka.

Nové rozvržení lze přidat do pole `layouts` v `js/hrani.js`, přidat jeho
tlačítko v `hrani.php` a CSS pod `body[data-layout="…"]`.

## Lokální vizuální kontrola bez PHP

Spustit `node _pomocne/tools/preview-hrani.cjs` a otevřít `http://127.0.0.1:8786/preview`.
Server naslouchá pouze na loopbacku. Používá skutečnou šablonu, CSS a JavaScript,
ale vrací výhradně ukázkové skladby a krátké tiché audio. Neověřuje PHP,
přihlášení, oprávnění ani skutečnou databázi. Není určený k nasazení.

Kontrolovat hledání bez diakritiky, návrat se zachovaným filtrem, předchozí/další
skladbu, dlouhé názvy, prázdné podklady, přepínání všech hustot a režim Na zeď.
Náhled nabízí šířky 390, 768, 1280 a 1920 px.

## Kontrola na PHP serveru před nasazením

Vyžaduje stejný PHP 8.1+, mysqli, databázi a chráněné úložiště jako beta VZ2.
Bez databáze vrací chybový stav; nevrací se ke starým složkám VZ1.

1. `php -l hrani.php` a `php -l php/hrani_data.php`.
2. Ověřit přímý vstup bez přihlášení, přihlášení a HTTP 401 u dat po odhlášení.
3. Ověřit pořadí a názvy reálných skladeb, české názvy souborů a jejich přehrávání.
4. Ověřit aktuální verze textu/tabulatury a posledních 20 poznámek z diskuse.
5. Datový požadavek s neznámým ID, zkouškou nebo mazanou kolekcí vrací HTTP 404;
   neplatné ID HTTP 400. POST vrací HTTP 405.
6. Současně otevřít správu zkušebny a Hraní: výběr skladby se nesmí navzájem měnit.

Izolovaný integrační test: nastavit `PHP_BIN`, `VZ2_TEST_DB_PORT` samostatné
testovací MariaDB (nikoli produkční databáze) a `VZ2_TEST_SUITE=hrani`,
pak spustit `node _pomocne/tests/vz2_integration.test.js`.

Žebříčky pokusů, hodnocení, A/B porovnávání a synchronizace nástěnného displeje
nejsou součástí této první verze.
