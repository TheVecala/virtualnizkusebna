# Pomocné soubory zkušebny

Tato složka je součástí stejného Git repozitáře jako web, ale její obsah se
nenahrává do kořene webu. Soubory mimo `_pomocne/` tvoří zdrojový strom webu,
s výjimkou metadat Gitu a lokálně ignorovaných souborů.

- `docs/` — návrhy, záznamy ověření a postupy.
- `deploy/` — návody a podklady pro ruční nasazení.
- `migrations/` — SQL změny databáze, které se provádějí samostatně.
- `tests/` — lokální testy.
- `tools/` — lokální nástroje a dočasné diagnostické soubory.
- `.codex-remote-attachments/` — obrázky přiložené k práci v Codexu.

Příklad přípravy úplného FTP balíčku z kořene repozitáře:

```sh
node _pomocne/tools/vz2_release.js CESTA_K_NOVEMU_ADRESARI full
```

Do kořene webu patří pouze obsah `1_soubory/` z balíčku. Ostatní položky
balíčku jsou návody, manifest a případné dočasné kontroly určené pro výslovné
jednorázové použití. Při přímém kopírování pracovního adresáře na FTP složku
`_pomocne/` vynechte.
