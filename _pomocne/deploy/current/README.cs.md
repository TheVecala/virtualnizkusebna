# Úplný balíček aktuální zkušebny VZ2

Zdrojový commit a přesný obsah tohoto konkrétního balíčku jsou v manifest.json.
Jde o aktualizaci existující instalace VZ2, nikoli automatickou migraci staré VZ1.

## Soubory

Do kořene cílové aplikace nahrajte obsah `1_soubory/`, se zachováním podadresářů.
Zahrnuté jsou všechny verzované aplikační soubory mimo `_pomocne/`, včetně
kořenových stránek, podpory témat, PHP, JavaScriptu, CSS a statických souborů.

`.git/`, `.gitignore`, `_pomocne/`, manifest, tento návod a removed-files.txt
nepatří do veřejného webového adresáře. Serverové `config.php` a `config.vz2.php`
se tímto balíčkem nenahrazují; zachovejte jejich nastavení a přístupové údaje.
Seznam výjimek je ve zdrojovém repozitáři v `_pomocne/vyjimky-nasazeni.md`.
`config.theme.php` mezi výjimky nepatří; nahrává se ve stejné podobě jako
v nasazované verzi Gitu.

## Postup

1. Zálohujte kód a konfigurace cílové instalace a společnou databázi. Zjistěte
   dosavadní nasazený commit nebo manifest a stav databázových migrací.
2. Před nasazením ověřte potřebné migrace podle návodu dané změny v
   `_pomocne/docs/`. Žádnou migraci balíček neprovádí automaticky.
3. V servisním okně nahrajte obsah `1_soubory/`. Zachovejte cílové konfigurace,
   ochranná pravidla webserveru, databázi, uživatelské soubory a sdílené úložiště.
   Nekopírujte v režimu, který automaticky maže ostatní soubory na serveru.
4. `removed-files.txt` obsahuje pouze známé soubory vyřazené původní VZ1.
   Při jejím dříve dokončeném odstranění je znovu řešit nemusíte. Pokud některý
   ještě existuje, ověřte cílovou instalaci a odstraňte jen tuto přesnou cestu;
   nikdy nemažte celé adresáře, uživatelské soubory nebo jinou instalaci.
5. Ověřte čerstvé přihlášení, oprávnění, nahrávky, přehrávání, přehled a úseky.
   Zdrojový strom sám nedokládá, že přenos na server skutečně proběhl úspěšně.
6. Uložte manifest tohoto nasazení mimo veřejný web. Identifikuje soubory,
   jejich SHA-256, zdrojový commit i případné necommitnuté změny při sestavení.

## Konfigurace a přihlašování

Pokud cílová instalace ještě nemá podporu témat, její config.php musí načítat
`config.theme.php`. Dále musí načítat svůj `config.vz2.php`, `php/auth.php`
a provádět `auth_refresh_session()`. Funkční serverový config nenahrazujte
nevyplněným vzorem nebo konfigurací jiné instalace.

Nové přihlašování jménem a heslem vyžaduje migraci 007 již před nahráním
PHP souborů. Migraci 008 proveďte až po ověření nového loginu na všech
instalacích nad společnou databází. Již provedené migrace neopakujte.
Po 008 se nevracejte k loginu založenému pouze na hesle. Podrobnosti jsou
v `_pomocne/docs/prihlasovani-jmenem.md` ve zdrojovém repozitáři.
