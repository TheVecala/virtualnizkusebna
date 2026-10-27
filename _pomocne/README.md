# Pomocné soubory zkušebny

Tato složka je součástí stejného Git repozitáře jako web, ale její obsah se
nenahrává do kořene webu. Mimo `_pomocne/` patří pouze soubory nasazované na web
a metadata Gitu. Pravidla pro celý projekt jsou v [AGENTS.md](AGENTS.md).

Nové pomocné soubory ukládejte také sem. Do kořene repozitáře a webových
podsložek přidávejte jen soubory potřebné pro běh stránek.

- `docs/` — návrhy, záznamy ověření a postupy.
- `deploy/` — návody a podklady pro ruční nasazení.
- `migrations/` — SQL změny databáze, které se provádějí samostatně.
- `tests/` — lokální testy.
- `tools/` — lokální nástroje a dočasné diagnostické soubory.
- `dist/` — vygenerované balíčky; ignorované Gitem.
- `.codex-previews/` — vývojové HTML náhledy.
- `.codex-remote-attachments/` — obrázky přiložené k práci v Codexu.

Příklad přípravy úplného FTP balíčku z kořene repozitáře:

```sh
node _pomocne/tools/vz2_release.js _pomocne/dist/nova-verze full
```

Do kořene webu patří pouze obsah `1_soubory/` z balíčku. Ostatní položky
balíčku jsou návody, manifest a případné dočasné kontroly určené pro výslovné
jednorázové použití. Při přímém kopírování pracovního adresáře na FTP
vynechte `.git/`, `.gitignore` a `_pomocne/` a zachovejte serverové
`config.php` a `config.vz2.php`. Složky nekopírujte v režimu, který maže
neznámé soubory na serveru.

Export automaticky zahrnuje všechny verzované soubory aplikace mimo pomocnou
složku, včetně nových kořenových stránek a `config.theme.php`. Nepotřebuje
ručně doplňovaný seznam stránek. Neočekávané neverzované soubory a chybějící
verzované soubory export zastaví, aby neúplný balíček nevypadal jako úplný.

Serverové `config.php` a `config.vz2.php` jsou dohodnuté výjimky ze shody
Gitu a webu. Jejich seznam a pravidla jsou v
[vyjimky-nasazeni.md](vyjimky-nasazeni.md). Export je vynechává a uvádí je
v manifestu; obsahují přístupové údaje a hodnoty konkrétní instalace.
`config.theme.php` je verzovaný aplikační soubor a součást úplného balíčku.

Ke každému nasazení si mimo veřejný web uložte přiložený `manifest.json`.
Obsahuje commit, cesty a SHA-256 všech dodaných souborů. Samotný název větve
nedokládá, co je skutečně nahrané na hostingu.
