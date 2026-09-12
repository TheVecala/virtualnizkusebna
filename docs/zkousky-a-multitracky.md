# Zkoušky a multitracky

## Zkoušky

Přepínač Skladby / Zkoušky v bočním panelu (na mobilu v seznamu skladeb)
otevírá stejnou stránku s `sekce=uploads` nebo `sekce=zkousky`. Ostatní panely
i looper zůstávají stejné. Výběr složky se pamatuje pro každou sekci zvlášť.

Adresáře kapely jsou `user/<kapela>/<identita>/uploads` a sousední `zkousky`.
Kořen `zkousky` vznikne při vytvoření první zkoušky. Texty, tabulatury,
historie, pořadí i uploady používají vybraný adresář. Diskuse zkoušek mají
vlastní prefix tabulek `zkousky_`; stávající `diskuse_` se nemění.
Timestampy a popisky již rozlišuje plná cesta k audio souboru.

`php/inc/content_context.php` přijímá pouze tyto dvě hodnoty sekce.
Požadavky stránky nesou sekci explicitně, včetně běžného uploadu přes XHR.
Odkazy na looper obsahují i sekci; starší odkazy bez sekce míří do skladeb.

## Multitracky

Tlačítko v horní liště otevře samostatný pohled a pozastaví běžné audio.
Návrat pozastaví multitrack a obnoví předchozí pohled. Načtený mix se zachová.
Horní přehrávač obsahuje hlavní hlasitost; mix se rozbaluje jen u více stop.
Upload přijímá již jednu stopu. Levý panel vybírá sadu, pravý obsahuje shrnutí,
začátky skladeb či pokusů a poznámky zařazené podle jejich časů.

Původní `multitrack.php` používá stejné sdílené PHP části jako hlavní stránka,
takže zůstává dostupný i samostatný vstup.

Zápisy jsou v `user/<kapela>/<identita>/multitrack_zapisy/<id>.json`.
Nepotřebují migraci databáze. Ukládání kontroluje přihlášení, právo `comment`,
CSRF token a revizi zápisu; souběžná úprava vrací HTTP 409 a zachová rozepsaný
text v prohlížeči. Autor pochází z přihlášeného účtu.

Akce **Odstranit audio, zachovat zápis** vyžaduje právo `delete_file` a potvrzení.
Před odstraněním stop uloží archiv. Manifest zůstane označený `audioDeleted`.
Časové odkazy archivovaného zápisu jsou neaktivní, zápis lze dále upravovat.
Zápisy zůstanou v seznamu i po externím odstranění celé složky multitracku.
Jejich ID nelze znovu použít pro nový upload, aby se nepřiřadily jinému audiu.
Existující offline kopie v jiných prohlížečích se smazáním na serveru nemažou.

Přehled úložiště v administraci započítává zkoušky i zápisy.

## Ověření

Základní kontroly:

```sh
node tests/multitrack_contract.test.js
node tests/multitrack_sample_rate.test.js
node tests/multitrack_browser_smoke.test.js
php tests/admin_storage_test.php
```

`tests/workspace_integration.test.js` používá dočasnou kopii aplikace, vlastní
testovací session a náhodnou databázi na výslovně zadané lokální testovací
MariaDB. Produkční konfiguraci nepoužívá. Vyžaduje Node, Playwright,
Chromium/Edge a proměnné `PHP_BIN`, `WORKSPACE_TEST_DB_PORT` a případně
`WORKSPACE_TEST_DB_PASS` (testovací uživatel `root`). Výchozí port 3306 odmítne.

```sh
node tests/workspace_integration.test.js
```

Test kontroluje izolaci adresářů a diskusí, úpravy textu, vytvoření zkoušky,
jednostopý upload, oprávnění, CSRF, konflikty zápisu, přehrávač, časové odkazy,
mobilní přepínání a uchování zápisu po odstranění audia. Screenshoty zůstávají
v dočasném adresáři vypsaném testem. Test neověřuje produkční přihlášení ani
reálnou synchronizaci dlouhých vícestopých nahrávek na cílových zařízeních.
