# Etapa 5 — dokončená beta a následné nahrazení alfy

20. 9. 2026, výchozí commit `d8fd9722d4777b0cac7a413031215076792d30bc`.
Uživatel potvrdil funkčnost etapy 4 na betě. Upřesnil postup: nejprve plně
funkční beta, potom jí nahradit alfu; kompatibilita se současnou alfou se neřeší.
Živá aktualizace této etapy ani přepnutí alfy dosud nebyly potvrzené.

## Co se změnilo

Volitelná konstanta `VZ2_ONLY=true` otevře VZ2 přímo na indexu, odstraní odkaz
na starou aplikaci a zablokuje její samostatné PHP endpointy. `?v=1` blokaci
neobejde. Guard běží při obnovení identity; staré AJAXy, které dosud konfiguraci
nečetly, ji nyní načítají před prací. Vypnutá či nedefinovaná konstanta zachovává
dosavadní beta chování do dokončení FTP přenosu a ručního zapnutí.

Administrace před každým vstupem znovu ověřuje osobní identitu. V režimu VZ2
počítá přehled Server z nového katalogu, nepředpokládá starý adresář kapely
a neprezentuje volné místo celého serveru jako hostingovou kvótu.

Dočasný preflight ověřuje také migraci 003, vlákno Nápady, aktuální verze
dokumentů, aktivního správce, nedokončené souborové operace a dostupnost/velikost
evidovaných souborů. Uvádí prostředí, SITE_URL, režim zápisu a parametry cookie
bez hodnoty session. Je pouze pro správce nebo CLI a sám zápisy nezapíná.
Neověřuje hashe souborů ani všechny veřejné aliasy; dřívější živé ověření
privátního úložiště platí pro nezměněné cesty a HTTP pravidla.

## Ověření

Výsledek: **167 integračních kontrol prošlo**, včetně HTTP, skutečné SQL DB,
dvou kopií webu a browser scénářů. Prošly také testy osobních účtů (25), hostů
(19), původního přehledu úložiště (26; symlinky přeskočené kvůli oprávnění OS),
Mixéru v prohlížeči, jeho DOM kontraktu a sample-rate parseru, timestampů
a offline stahování. Syntaxe změněných PHP souborů i `git diff --check` v pořádku.
Vizuálně ověřena nová administrace a mobilní pohled hosta.

Integrační sada vytváří vlastní náhodnou testovací DB na samostatné lokální
MariaDB a vlastní privátní storage. Produkční konfiguraci nenačítá. Testuje
celé etapy 2–4 včetně prohlížeče a nově dvě kopie aplikace nad stejnými daty:
čtení a stejné audio bajty, rozlišení cache, přenos jediného zapisujícího
prostředí, správu účtů s auditem, všech 30 starých AJAX/action endpointů,
kontroly poškozeného či nedokončeného stavu a návrat zápisů na betu při zachování
obsahu vytvořeného alfou. Nové browser scénáře používají hlavní adresu bez `v=2`
a přihlášení/odhlášení správce, muzikanta a hosta.

Lokální PHP je 8.5.10, MariaDB 11.4.5 s nestriktním globálním režimem;
hosting PHP 8.1.32 a MariaDB 11.4.12 byl dříve ověřen uživatelem. Lokální test
nenahrazuje závěrečnou kontrolu na hostingu. Kód zachovává syntaxi PHP 8.1.

## Nasazení a předání

Podrobný postup je v `deploy/vz2-stage5/README.cs.md`. Nevyžaduje novou migraci.
Nejprve beta s `VZ2_ONLY=true` a povolenými zápisy, až po ověření kompletní
kopie jejího kódu na alfu. Konfigurace kopie má odpovídat nové adrese a prostředí.
Úložiště a DB zůstávají společné; po předání beta pouze pro čtení. Při přepnutí
je nutné nechat doběhnout staré požadavky, nejen přepsat konstantu.

`node tools/vz2_release.js <novy-adresar> beta` vytvoří přírůstkový FTP balíček
od uvedeného výchozího commitu. Režim `full` vytvoří kompletní provozní kód
z ověřené bety pro pozdější nahrazení alfy. V obou režimech je preflight oddělený
jako dočasná kontrola. Manifest obsahuje SHA-256 každého souboru; žádný režim
nečte ani nebalí `config.php`, `config.vz2.php`, SQL, Git nebo userdata.
Výstupní adresář musí být nový. ZIP lze vytvořit standardním Compress-Archive.

Předčasně se neodstraňují staré soubory/tabulky. Samostatný úklid popisuje
`docs/vz2/cleanup.md`; integrace navigace Mixéru zůstává etapou 6.
