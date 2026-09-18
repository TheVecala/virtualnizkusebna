# VZ2 – doložený hosting, zálohy a strict SQL

Datum zapracování: 18. 9. 2026. Zdroj hostingových údajů: protokol dodaný uživatelem
v této konverzaci. Agent v této fázi neprováděl vzdálenou kontrolu ani nasazení.
Tento dokument aktualizuje provozní předpoklady návrhu a předání etapy 2;
jejich původní testovací protokoly zůstávají historickým záznamem.

## Zálohy a stav před migrací – doložil uživatel

- Sdílená DB `18810_virtualni_zkusebna` je zazálohovaná.
- Zdrojové soubory alfy/bety jsou v Gitu na příslušných větvích, aktuální konfigurace
  jsou samostatně zálohované mimo Git. Lokální kopie userdata obsahuje všechna
  uživatelská data včetně obsahu mimo Git.
- Diagnostické phpinfo i `vz2-runtime-check.php` byly odstraněny z obou instalací.
- Ve sdílené DB nebyly nalezeny žádné `vz2_` tabulky, ani částečná migrace.
- Prázdná DB `18810_VZ2` se **nepoužije**. Migrace 002 patří vedle existujících
  users/auth_settings do `18810_virtualni_zkusebna`. Architektura se nemění.
- Starý uživatelský obsah se nepřevádí. Přesto je nutné jednorázově vytvořit 13
  nových tabulek pomocí `migrations/002_vz2.sql`.

## Doložené prostředí

| Oblast | Výsledek uživatelovy kontroly |
| --- | --- |
| MariaDB | `11.4.12-MariaDB-log` |
| users | `id INT UNSIGNED NOT NULL AUTO_INCREMENT`, PRIMARY KEY, další ID 7; InnoDB, utf8mb4 / utf8mb4_unicode_ci |
| auth_settings | Existuje, id PRIMARY KEY; InnoDB, utf8mb4 / utf8mb4_unicode_ci |
| CHECK | Neplatná hodnota v dočasné tabulce vyvolala chybu 4025; omezení je vynucováno |
| Výchozí SQL mode (global i session) | Pouze `NO_ENGINE_SUBSTITUTION` |
| Změna session SQL mode | Ověřeno nastavení `STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION` |
| PHP alfa i beta | 8.1.32, 64 bit, PHP_INT_SIZE 8; mysqli, get_result a iconv dostupné |
| Limity PHP | upload_max_filesize 512M, post_max_size 512M, memory_limit 512M, max_execution_time 300 s, max_file_uploads 20 |
| Kvóta prostoru | 4 404 MB z 10 000 MB, přibližně 5 596 MB zbývá |
| Kvóta souborů | 4 404 z 10 000, zbývá 5 596 |

Rozhodující je hostingová kvóta, nikoli `disk_free_space()` celého serverového disku.
Do kvóty souborů se promítnou i staging, zámky, markery a později odvozené cache.
Limit celé multipart žádosti 512M znamená, že nelze slibovat plný 512MiB soubor
plus režii ani sadu 20 souborů po 512M. Pro hosting nastavit `VZ2_MAX_TRACKS` nejvýše
20 a dořešit celkový limit uploadu/rezervu; výchozí příklad 32 není limit tohoto hostingu.

## Oprava strict SQL v kódu

Kontrola našla skutečnou mezeru: `MYSQLI_REPORT_STRICT` nastavuje chování PHP chyb,
nikoli SQL režim MariaDB. `vz2_db()` dosud nastavovalo pouze UTC.

`auth_db()` nyní při `VZ2_ENABLED === true` nastaví požadované režimy ihned po
otevření spojení a nastavení utf8mb4, ještě před jeho zpřístupněním volajícím:

```sql
SET SESSION sql_mode = CONCAT_WS(',', @@SESSION.sql_mode,
  'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION');
```

Další již aktivní režimy zachovává. Mění pouze konkrétní spojení, ne globální
nastavení sdíleného serveru. Selhání SET vyvolá chybu, není zde pokračování bez strict.
Platí i při VZ2 pouze pro čtení. Při vypnuté VZ2 se režim původní aplikace nemění.

Prověřené cesty: login a obnova session i `admin.php` používají `auth_db()`;
`vz2_db()` vrací totéž spojení pro katalog, upload, změny, deník, souborový endpoint,
obnovu operací a preflight. Nové obsluhy VZ2 neotevírají další přímé mysqli spojení.
Legacy skripty mimo VZ2 nejsou tímto tvrzením zahrnuté ani plošně přepsané.

Migrační SQL obsahuje stejné SET před prvním CREATE a poté:

```sql
SELECT DATABASE() AS migration_database, @@SESSION.sql_mode AS migration_sql_mode;
```

Před importem ověřit zvolenou DB. Spustit **celý soubor jedním spojením**, v nástroji
zastavujícím při první chybě; nepoužít pokračování přes chyby ani jen vybranou DDL
část. Kontrolní výstup musí ukazovat `18810_virtualni_zkusebna` a všechny tři režimy.
SET v jiném SQL okně nebo dřívějším PHP požadavku nestačí. DDL se automaticky
nevrací jako běžná obsahová transakce: po chybě zjistit skutečný stav před opakováním.

Preflight nyní odděleně vypisuje skutečný session režim aplikačního spojení a
informativní globální default; kontroluje všechny tři požadované režimy a CHECK.
Nestriktní globální default s korektním aplikačním session nastavením není chyba.

## Storage – otevřená následující fáze

Společný veřejný document root a zároveň `open_basedir`:
`/data/www/18810/dusanovakapela_cz`.

- Alfa: `/data/www/18810/dusanovakapela_cz/zkusebna`.
- Beta: `/data/www/18810/dusanovakapela_cz/zkusebna_beta`.
- Oba instalační kořeny byly zapisovatelné PHP procesem.

Nejde o dva samostatné veřejné kořeny. Bez změny open_basedir PHP nemůže použít
root nad společným kořenem. Dosavadní `vz2_root()` kontroluje umístění vůči vlastní
instalaci a marker, **neověřuje HTTP ochranu sousedního adresáře**. Jeho úspěch ani
úspěšný preflight nejsou důkazem soukromého storage.

Následující fáze musí zvolit a ověřit jednu z variant:

1. Hosting povolí skutečně neveřejnou cestu v open_basedir; použít ji jako root.
2. Vyhrazený root uvnitř společného veřejného kořene bude na webserveru úplně blokovaný
   proti přímému HTTP přístupu, včetně podsložek a všech domén/aliasů, které jej mohou
   obsluhovat. Typ serveru a účinnost jeho pravidel zatím doloženy nejsou; samotný
   `.htaccess`, vypnutý listing nebo náhodný název nelze považovat za důkaz ochrany.

Před vložením reálného audia ověřit přímými anonymními HTTP požadavky neškodný
kontrolní soubor v rootu i podsložce: nesmí jít stáhnout ani získat přes Range/HEAD.
Současně PHP musí marker a soubory číst/zapisovat. Ověřit hardlinky, flock a zda alfa
i beta vidí tentýž kontrolní soubor. Z doložených cest nelze samotných dovodit účinnost
HTTP pravidel nebo zámků. Konkrétní adresář, pravidla a kontrolní postup se dopracují
v této následující fázi; zde nebyl root založen, konfigurován ani označen za bezpečný.

## Lokální ověření této změny

- Výchozí i výsledný HEAD: `73f8f37fcb9f094b96ea48f42c2b02699c51b704`.
  Větev `feature/zkusebna2.0`, při začátku čistý pracovní strom. Nový commit obsahoval
  předanou etapu 2; byl prohlédnut, nepoužíval se starý předpoklad HEAD `cd26bd8b`.
- Izolovaná MariaDB 11.4.5 na portu 33328 byla spuštěna s globálním výchozím režimem
  `NO_ENGINE_SUBSTITUTION`. Živá databáze ani její připojovací údaje se netestovaly.
- Nová integrační sada: **43 kontrol PASS**. Ověřila doplnění režimů migrací z nestriktní
  session, zachování dalšího režimu, nestriktní default testovacího serveru, nastavení
  spojení auth/VZ2, odmítnutí tichého zkrácení VARCHAR a všechny dosavadní scénáře.
  Testovací DB se po běhu odstranila. PHP lokálně 8.5.10; přesná hostingová dvojice
  PHP 8.1.32 / MariaDB 11.4.12 nebyla agentem spuštěna.
- Regrese s vypnutou VZ2: lifecycle **25 PASS**, guest **19 PASS**. PHP lint obou
  upravených PHP souborů, syntax testovacího JavaScriptu a `git diff --check`: PASS.
  Dočasný DB server byl po testech vypnut.

Změněné soubory: `php/auth.php`, `migrations/002_vz2.sql`, `tools/vz2_preflight.php`,
`tests/vz2_integration.test.js`, `docs/vz2/stage2.md` a tento nový protokol.
Změny zůstávají necommitnuté. Žádný push, živá migrace ani import do `18810_VZ2` neproběhl.
