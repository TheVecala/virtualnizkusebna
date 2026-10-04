# Odstranění původní aplikace z bety

Tento balíček patří do současné nové aplikace na `zkusebna_beta`.
Větev `alpha` a hlavní web ještě obsahují původní aplikaci. Samostatná stará
subdoména se tímto balíčkem neupravuje. Zdroj úklidu: `feature/VZ1_cleanup`,
výchozí commit `560688d`. Přesný obsah balíčku dokládá `manifest.json`.

## Aktualizace bety

1. Ověřte cílový document root bety a uchovejte obnovitelnou kopii jejího kódu.
2. Aktualizaci proveďte v servisním okně: staré soubory i nové soubory musí tvořit
   jeden konzistentní celek. Do cíle nahrajte obsah `1_soubory/`.
3. V TOMTÉŽ kořeni odstraňte pouze jednotlivé relativní cesty z `removed-files.txt`.
   Chybějící soubor přeskočte. Nemažte celé adresáře ani další neznámé soubory.
   Pouhé přepsání přes FTP původní endpointy neodstraní.
4. Zachovejte serverové `config.php`, `config.vz2.php`, ochranná pravidla,
   databázi, `user/`, `_vz2_storage`, zálohy a samostatnou starou instalaci.
   Balíček neobsahuje konfiguraci, migrace ani nástroj pro vzdálené mazání.
5. Ověřte přihlášení, odhlášení, účty a role, katalog, upload, Looper, Mixér,
   obsah a mapu, timestampy, diskusi, historii a offline kopie.
   `/`, `index.php`, `?v=1`, `?v=2` a `vz2.php` otevírají novou aplikaci.
   Odstraněné PHP endpointy včetně `multitrack.php` musí vracet 404/410.

`VZ2_ONLY` už aplikace nepoužívá. Pokud je v soukromé konfiguraci, jeho hodnota
nic nepřepíná; lze jej odstranit. `VZ2_ENABLED`, režim zápisu, identita datasetu
ani kontrola přístupu ke storage se tímto úklidem nemění. Současný kód používá
migrace 001–005, včetně historie zkoušení. Před nasazením ověřte, že už na betě jsou;
úklid sám žádnou SQL migraci neprovádí.

## Pozdější přesun na hlavní web / www

Jde o samostatný následný krok. Plán je přejmenovat adresář aplikace na FTP,
upravit SITE_URL v serverovém config.php a ponechat fyzická data na místě.
Před změnou ověřte směrování domény na přejmenovaný adresář a konfiguraci VZ2:

- VZ2_STORAGE_ROOT a VZ2_DATASET_KEY musí dál označovat totéž úložiště a dataset.
- VZ2_PUBLIC_ROOT označuje společný veřejný kořen hostingu, nikoli automaticky
  adresář konkrétní instalace. Měnit jen pokud se skutečně mění tato hranice.
- VZ2_ENVIRONMENT určuje audit a oddělení cache. Změnu beta → alpha naplánujte
  se spuštěním hlavního webu; neprovádí ji tento balíček.
- Ověřte ochranu úložiště přes všechny nové veřejné aliasy a Range přehrávání.
- Nová doména má vlastní přihlašovací cookies a offline úložiště prohlížeče.
  Uživatelé se znovu přihlásí a potřebné offline kopie si uloží na nové adrese.

Starý obsah a staré SQL tabulky lze odstranit teprve podle samostatné inventury
skutečného serveru a jejich vazeb. Seznam removed-files.txt obsahuje jen kód
aplikace a statické podklady, nikdy uživatelské soubory.
