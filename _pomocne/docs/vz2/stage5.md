# Etapa 5 — dokončená beta a následné nahrazení alfy

20. 9. 2026, výchozí commit `d8fd9722d4777b0cac7a413031215076792d30bc`.
Uživatel potvrdil funkčnost etapy 4 na betě. Upřesnil postup: nejprve plně
funkční beta, potom úprava jejího vzhledu a teprve následně nahrazení alfy.
Etapa 5 je uložená v commitu `4de4c3e`. Uživatel potvrdil nahrání na betu
a zapnutí `VZ2_ONLY`. Anonymní HTTP kontrola potvrdila přihlašovací stránku
(200), zablokovaný starý endpoint `php/ajax/ajax_history.php` (410) a ochranu
VZ2 API bez přihlášení (401). Uživatel následně dodal úspěšný živý preflight
`2026-09-20.5` (podrobnosti níže). Závěrečná ruční kontrola UI po aktualizaci
a přepnutí alfy ještě nejsou potvrzené.

Aktuální upřesnění uživatele: starou zkušebnu zachovat pro porovnávání na
samostatné subdoméně, bez uživatelského obsahu a bez dodatečného hesla Apache.
Pracovní návrh názvu je `zkusebna-old.dusanovakapela.cz`; dosud nebyla založena.
Původní přihlášení aplikace tím není zrušeno. Příprava prázdné ukázky není
pokynem ke smazání současných dat. Viz `_pomocne/docs/vz2/legacy-comparison.md`.

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

### Živý preflight bety — 20. 9. 2026

Výstup dodaný uživatelem: `ok: true`, všech **18 kontrol úspěšných**.

- PHP 8.1.32, 64 bit; MariaDB 11.4.12-MariaDB-log.
- DB `18810_virtualni_zkusebna`, 13 přesných VZ2 tabulek s InnoDB,
  vynucování CHECK a diskusní body typu MEDIUMTEXT z migrace 003.
- Aplikační spojení používá `STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION`,
  přestože globální režim zůstává pouze `NO_ENGINE_SUBSTITUTION`.
- Načtená konfigurace: `environment=beta`, `writes_enabled=true`, `vz2_only=true`;
  SITE_URL odpovídá `https://zkusebna_beta.dusanovakapela.cz`.
- Storage `/data/www/18810/dusanovakapela_cz/_vz2_storage`, známý dataset
  `vz2-77d212fe03d7f048f909029c1023cc8ab49bbee48dcda5a4`, režim `http-denied`.
- Všech 5 dostupných souborů je čitelných a má velikost podle SQL;
  celkem 67 804 306 bajtů, `invalid_count=0`. Nejde o porovnání hashů obsahu.
- Žádné nedokončené souborové operace; aktuální verze dokumentů existují,
  aktivní správce a globální vlákno Nápady existují. Revize pořadí: song 12,
  rehearsal 2; nejde o požadavek vrátit je na počáteční hodnotu 1.
- Cookie parametry: path `/`, domain prázdná, `secure=false`, `httponly=false`.
  Tyto atributy preflight zatím pouze vypisuje, nezahrnuje je do výsledku `ok`.
  Následná úprava v [session.md](session.md) byla nasazena na betu. Lokální
  testy přihlášení/odhlášení prošly a živý anonymní HTTPS GET potvrdil
  Set-Cookie s příznaky Secure, HttpOnly a SameSite=Lax.

Uživatel potvrdil odstranění `tools/vz2_preflight.php`; následná anonymní HTTP
kontrola dne 20. 9. 2026 ověřila stav 404. Úklid dočasné diagnostiky je hotový.
Původní alfa zůstává beze změny, dokončení
funkcí bety předchází práci na CSS a pozdějšímu předání alfě.

### Lokální ověření

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

Aktuální pořadí podle uživatele:

1. V tomto vlákně dokončit funkce a provozní ověření nové VZ2 na betě.
   Současná alfa zatím zůstává v provozu beze změny.
2. V samostatném budoucím vlákně upravit CSS a grafické zobrazení bety.
   Toto vlákno zatím nebylo založeno; vzhled se teď nepředělává.
3. Před nahrazením alfy připravit starou verzi na `old` podle
   `legacy-comparison.md`, bez uživatelského obsahu a bez hesla Apache.
   Příprava může probíhat během práce na vzhledu, ale současnou alfu do
   závěrečného předání ponechat dostupnou.
4. Až bude beta ověřená funkčně i vzhledově a `old` připravené, uživatel
   zkopíruje tuto finální betu na alfu. Přenést i finální CSS a další assety.

Podrobný postup je v `_pomocne/deploy/vz2-stage5/README.cs.md`. Nevyžaduje novou migraci.
Beta zatím běží s `VZ2_ONLY=true` a povolenými zápisy. Samotné dokončení
funkční kontroly není pokynem k přepnutí alfy před úpravou vzhledu.
Konfigurace budoucí kopie má odpovídat nové adrese a prostředí.
Úložiště a DB zůstávají společné; po předání beta pouze pro čtení. Při přepnutí
je nutné nechat doběhnout staré požadavky, nejen přepsat konstantu.

`node _pomocne/tools/vz2_release.js <novy-adresar> beta` vytvoří přírůstkový FTP balíček
od uvedeného výchozího commitu. Režim `full` vytvoří kompletní provozní kód
z ověřené bety pro pozdější nahrazení alfy. V obou režimech je preflight oddělený
jako dočasná kontrola. Manifest obsahuje SHA-256 každého souboru; žádný režim
nečte ani nebalí `config.php`, `config.vz2.php`, SQL, Git nebo userdata.
Výstupní adresář musí být nový. ZIP lze vytvořit standardním Compress-Archive.
Dosavadní balíčky etapy 5 předcházejí plánované úpravě CSS. Pro konečné
nahrazení alfy vytvořit nový kompletní balíček z finální ověřené verze bety.

Předčasně se neodstraňují staré soubory/tabulky. Samostatný úklid popisuje
`_pomocne/docs/vz2/cleanup.md`; integrace navigace Mixéru zůstává etapou 6.
