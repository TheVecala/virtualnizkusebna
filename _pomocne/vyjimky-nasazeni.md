# Výjimky ze shody Gitu a nasazeného webu

Pro alfu i betu platí, že verzované provozní soubory mají odpovídat nasazené
verzi v Gitu. Výjimkou jsou tyto dva soubory v kořeni aplikace:

- `config.php` — připojení k databázi a nastavení konkrétní instalace.
- `config.vz2.php` — serverové nastavení VZ2; tento soubor je ignorovaný Gitem.

Při nasazení oba soubory na cílovém serveru zachovejte. Nepřepisujte je
verzí z Gitu ani konfigurací jiné instalace. Potřebné změny jejich nastavení
provádějte cíleně podle návodu nasazované změny. Exportní nástroj
`tools/vz2_release.js` je do balíčku nezahrnuje a uvádí je v manifestu
v položce `preserved_server_files`.

Na web se také nekopírují `.git/`, `.gitignore` a celá složka `_pomocne/`.

`config.theme.php` mezi výjimky nepatří: je součástí aplikace a na web se
nahrává ve stejné podobě jako v nasazované verzi Gitu.
