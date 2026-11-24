# Společný přechod Mapy skladby na schéma 2

Alfa a beta používají stejnou databázi. Přechod a případný návrat se provádí pro obě instalace během jedné odstávky. Nástroj aktualizuje jen `vz2_document_versions.body` u dokumentů `song_map`, včetně historických revizí a archivovaných skladeb. Změny tabulek, indexů a klíčů nejsou součástí převodu. Nově uložená nebo obnovená revize mapy má vždy schéma 2. Platný požadavek dříve otevřeného klienta se schématem 1 server převede před uložením.

## Převod

| Staré údaje | Schéma 2 |
| --- | --- |
| Hi-hat nebo Ride | Zachová se nástroj, značka se samostatně nepřidává. |
| Hi-hat nebo Ride s Crashem | Crash na jednotce 1 i při neznámém metru. |
| F1–F3 s podkladem | Zachová se nástroj a původní stupeň v `unresolved_fill`. |
| Samostatný F4 | `unresolved_fill: 4`, podklad zůstane neurčený. |
| Neurčený takt, Pauza, Stop | Zachová se význam celého taktu. |
| Metrum V1 | `meter: null`. |
| Již uložené schéma 2 | Obsah zůstane bajtově shodný. |

Zachovají se identifikátory a pořadí sekcí a taktů, názvy, textové detaily, prázdné mapy, identifikátory dokumentů, čísla revizí, autoři i časy. Neplatný snapshot, chybějící vazba, změna názvu způsobená normalizací nebo překročení limitu 1 MiB zastaví převod.

## Před odstávkou

1. Dohledejte skutečné manifesty obou instalací. Porovnejte identity DB z obou serverových konfigurací a potvrďte, že jde o jedinou instanci a schéma. Zjistěte, kdo další do této DB zapisuje.
2. Ověřte PHP 8.1 nebo vyšší s `mysqli`, verzi MariaDB, schéma dokumentů, verze migrací 001–010 a přístup k obnově zálohy. Na izolované obnovené kopii proveďte úplnou zkoušku včetně Hraní, Přehledu, úpravy map, historie a návratu.
3. Spusťte čtecí inventuru proti ověřenému cíli. Uloží počty a otisky před a po převodu. Volba `--details` přidá jeden řádek JSON pro každou revizi, poslední řádek je souhrn. Výstup neobsahuje texty map ani databázové heslo. Pokud kontrola zjistí anomálii, rozhodněte o ní před odstávkou.

Nástroj spouštějte přes CLI z checkoutu stejné revize jako nasazovaný balíček, mimo veřejný web. Připojení se zadává výslovně proměnnými `VZ2_MAP_DB_HOST`, `VZ2_MAP_DB_PORT`, `VZ2_MAP_DB_NAME`, `VZ2_MAP_DB_USER` a `VZ2_MAP_DB_PASSWORD` z chráněné konfigurace prostředí.

```sh
php _pomocne/tools/vz2_song_map_migrate.php --check --details > mapy-pred.jsonl
```

## Odstávka a převod

1. Zapněte bariéru na webserveru v obou instalacích. Zastavte další zapisující klienty a nechte doběhnout začaté požadavky. Zkontrolujte přímé požadavky na API a na Hraní/Přehled i zápis ze stránky otevřené před odstávkou. Přesměrování v `index.php` pokrývá jen tento vstup.
2. Vytvořte konzistentní zálohu společné DB a ověřte její obnovu na izolovaném cíli. Uložte oba původní aplikační balíčky a jejich serverové konfigurace.
3. Při zastavených zápisech zopakujte čtecí inventuru na ostré DB, ověřte její cílovou identitu a schvalte nový `before_sha256`. Otisk je vázaný na databázový server a název schématu. Otisk z testovací kopie nebude pro ostrou databázi platný.
4. Spusťte převod jednou. Transakce uzamkne mapové revize, znovu spočítá plán, ověří původní obsah jednotlivých revizí a před potvrzením porovná skutečný výsledek s očekávaným otiskem. Při chybě se vrátí celá transakce. Výstup `updated` je počet převedených revizí.

```sh
php _pomocne/tools/vz2_song_map_migrate.php --apply "$VZ2_MAP_APPROVED_SHA"
php _pomocne/tools/vz2_song_map_migrate.php --check --details > mapy-po.jsonl
```

5. Potvrďte nulový počet revizí V1, shodu nového `before_sha256` s očekávaným `after_sha256`, kontinuitu revizí ověřovaných v manifestu a počty map, sekcí a taktů. Vedle mapových kontrol porovnejte nemapové revize s předmigračním exportem.
6. Nasaďte připravený balíček na alfu a betu. Zachovejte odlišnosti serverové konfigurace a ověřte skutečně načítané soubory podle manifestu. Při trvající odstávce ověřte v obou instalacích práva, zobrazení map, Hraní a Přehled, uložení, konflikt revizí a obnovu historie. Zápisové kontroly směřujte na vyhrazenou testovací skladbu. Teprve po úspěchu otevřete provoz.

## Návrat

Při chybě zůstává údržba zapnutá. Před potvrzením změn převod ukončí transakci bez zápisu. Po potvrzení obnovte původní hodnoty `body` podle klíčů revizí z ověřené zálohy a doložte shodu původního otisku. Když nelze bezpečně omezit rozsah obnovy, obnovte celou DB z ověřeného snímku. Obnovte obě původní verze aplikace a jejich konfigurace. Při návratu po otevření provozu nejdříve zajistěte revize vzniklé po přechodu, aby se při obnově neztratily.

Zkoušku převodu se syntetickými daty spouští izolovaná sada `VZ2_TEST_SUITE=songmap-migration`. Následují sady `songmap`, `hrani` a `overview` pro kompatibilitu čtení a zápisu.
