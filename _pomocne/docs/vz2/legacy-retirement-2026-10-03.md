# Vyřazení původní zkušebny z nové alfy

Stav 3. 10. 2026. Uživatel potvrdil, že původní zkušebna je dostupná na
samostatné subdoméně `zkusebna_old`. Nyní požaduje inventuru původních souborů
k odstranění z aktuální alfy; čištění nových souborů bude následovat samostatně.
Názvy: **Virtuální zkušebna** pro aplikaci, **Zkušebna DK!** pro singleband instalaci.

Tento dokument je statická inventura lokálního checkoutu, nikoli kontrola
obsahu živého serveru. Při jejím vytvoření se nemazal ani neměnil provozní kód.
Subdoména staré zkušebny se neupravovala. Podrobný seznam relativních cest
je v `legacy-retirement-files-2026-10-03.txt` ve stejném adresáři.

## Soubory k odstranění společně s odstavením staré větve

| Skupina | Počet | Účel |
| --- | ---: | --- |
| `php/actions/` | 9 | Staré uploady, přesuny, mazání, texty a složky. |
| Staré endpointy `php/ajax/` | 21 | Původní nahrávky, diskuse, nápady, texty, peaks a multitracky. |
| Staré PHP helpery, modály a login/logout | 12 | Devět helperů z `php/inc/`, `php/modals.php`, `php/login/login.php` a `logout.php`. |
| Staré JavaScripty | 5 | `main.js`, `workspace.js`, `multitrack-notes.js`, `help-drawer.js`, lokální jQuery. |
| Staré styly | 4 | `main.css`, `workspace.css`, `sticky-footer-navbar.css`, `cover.css`. |
| `fonts/` | 5 | Nepoužívaná sada Glyphicons. |
| Verzované podklady `data/` | 32 | Původní šablony akordů/tabulatury, ikony a pozadí. Nejsou to uživatelská data. |
| Nepotřebné obrázky `meat/` | 29 | `dalsi/`, tři původní obrázkové návody, dvě ikony složek a vinyl. |
| **Celkem** | **117** | **1 469 604 B, přibližně 1,47 MB bez komprese.** |

Ve zbylém vlastním provozním kódu nebyly nalezeny odkazy na tyto soubory,
kromě vazeb ve staré větvi `index.php`, která se musí současně odstranit.
Kontrola zahrnovala i relativní PHP includes a názvy souborů. Shodné jméno
`drinking2.png` má zachovaná ikona `meat/drinking2.png` i nepoužívaný obrázek
`meat/dalsi/drinking2.png`; jde o různé cesty, zachovává se první.

Odebráním staré větve zmizí také její CDN importy Bootstrapu, jQuery, Popperu,
WaveSurferu včetně Regions/Zoom, SortableJS a idb-keyval. Nová zkušebna je už
nenačítá, takže uvedená velikost není úspora jejího současného prvního načtení.
Tabler Icons se používají dál a patří do pozdější optimalizace nové verze.

## Soubory, které se musí upravit, nikoli celé smazat

1. **`index.php`:** zachovat vstupní URL a přepsat na vstup do VZ2. Odstranit
   celý původní HTML/PHP obsah a podmínku výběru staré aplikace. Parametr
   `v=1` už nesmí spouštět původní verzi; ověřit i běžné URL a přímé odkazy.
2. **`vz2.php`:** odstranit lokální odkaz „Původní zkušebna“, který dnes
   podmíněně vede na `index.php`. Případný odkaz na samostatnou starou
   instalaci je jiná věc a vyžaduje její skutečnou úplnou URL.
3. **`admin.php`, `php/inc/admin_storage.php`, `php/inc/admin_storage_view.php`:**
   zachovat správu účtů a přehled VZ2. Odstranit starou větev skenování
   adresářů `user/`, cache a akci `storage_refresh` pro původní úložiště.
   `admin_vz2_storage_report` a společné formátování velikostí zůstávají.
4. **`php/auth.php` a konfigurace režimu:** při přechodu na trvale novou
   aplikaci sjednotit chování dosud podmíněné `VZ2_ONLY`. Zachovat kontrolu
   přístupu; její odstranění není součást úklidu. Neměnit připojení k DB,
   účty ani nastavení úložiště jen kvůli odstraňování starého UI.
5. **`_pomocne/tools/vz2_release.js`:** aktualizovat sestavování balíčku
   a dodat explicitní seznam odstraněných souborů pro nasazení. Současný
   skript balí sledované soubory z obou generací, má historické režimy a
   sám nemaže dříve nasazené soubory na serveru.

**`multitrack.php` je zvláštní případ:** dnes již obsahuje jen přesměrování
do `index.php?view=multitrack` s volitelným `id`. Neobsahuje původní přehrávač.
Lze jej odstranit jako 118. soubor, pokud se ruší i tato stará vstupní URL;
jinak ponechat malý kompatibilní redirect. Není zahrnut v seznamu 117 souborů.
Staré identifikátory obsahu nelze automaticky považovat za identifikátory VZ2.

## Co zachovat

- `vz2.php`, `php/ajax/vz2.php`, `vz2_content.php`, `vz2_files.php`,
  `vz2_peaks.php`, `vz2_timestamps.php` a všechny helpery `php/inc/vz2_*.php`.
- `php/auth.php`, `php/inc/session.php`, **`php/loginbox4.php`** a
  **`php/login/connect.php`**. Loginbox byl již převeden na nový vzhled bez
  starých knihoven. `connect.php` používá současné přihlašování přes `auth_db()`.
  Celá složka `php/login/` se proto smazat nesmí.
- `js/vz2*.js`, `css/vz2.css`, **`js/multitrack.js` a `css/multitrack.css`**.
  Mixér používá nová aplikace. Staré modální větve uvnitř společného skriptu
  či nepoužívaný `vz2-permissions.js` se řeší až při následném čištění nových
  souborů, ne odstraněním celého mixéru.
- Administraci, `help.php`, `js/help.js`, `css/help.css`, `css/admin.css`.
  Část obsahu nápovědy je historická; aktualizovat text, nikoli smazat nápovědu.
- Z `meat/`: `drinking2.png`, `ikona_diskuse.png`, `ikona_kazeta.png`,
  `ikona_kombo.png`, `ikona_nahravky.png`, `ikona_napady.png`,
  `ikona_skladby.png`, `ikona_text.png`. Používá je VZ2 nebo společný mixér.
- Serverovou knihovnu getID3 v `php/vendor/`, používanou při čtení metadat audia.
- `config.php`, případnou serverovou `config.vz2.php`, ochranná pravidla serveru,
  favicon, `404.html`, `maintenance.html`.
- Veškeré účty, databáze a uživatelská data. Tento seznam se nevztahuje na
  `user/`, `_vz2_storage`, zálohy ani soubory samostatné subdomény. Případná
  likvidace historického obsahu má vlastní inventuru podle `cleanup.md`.

## Testy a pomocné soubory

`_pomocne/` není součást veřejného runtime. Historické migrace, dokumentaci
a postupy lze zachovat jako archiv; není důvod je plošně mazat.

- Staré testy `workspace_integration.test.js`, `workspace_navigation_contract.test.js`
  a `offline_audio_download_contract.test.js` jsou vázané na původní UI.
  Vyřadit z aktivní sady spolu s odstraněným kódem, případně archivovat.
- `multitrack_contract.test.js` kombinuje staré PHP a společný mixér:
  rozdělit, zachovat relevantní kontroly nového mixéru.
- `multitrack_sample_rate.test.js` testuje zachovaný společný skript;
  zachovat. `multitrack_browser_smoke.test.js` obsahuje i staré modal/upload
  scénáře; zachovat relevantní přehrávání a upravit historické scénáře.
- `auth_integration.php` kopíruje i staré soubory; upravit sestavení fixture
  a ponechat ověření současných účtů a přihlášení.
- `admin_storage_test.php` testuje hlavně starý průchod adresáři;
  přizpůsobit rozsahu zachované administrace.
- `vz2_integration.test.js` kopíruje mimo jiné `data/` a `fonts/`,
  `vz2_cutover.integration.js` prochází `php/actions/` a testuje blokaci
  starých endpointů. Upravit pro odstraněné adresáře a ověřit nepřístupnost
  původních URL i nemožnost návratu na starou aplikaci přes `v=1`.
- Diagnostika starého úložiště (`vz2_storage_probe_legacy.php` a její test)
  může zůstat jako offline historie; nebalit ji do nasazení alfy.

## Pořadí realizace a ověření

1. Upravit vstup, odkazy a sdílené větve administrace; odstranit přesně
   uvedené staré soubory v jednom konzistentním kroku.
2. Aktualizovat testy a balicí skript. Prověřit přihlášení/odhlášení,
   administraci, přímé odkazy, katalog, přehrávání, mixér, upload, obsah,
   diskuse, nápady, offline režim a pomalý start.
3. Připravit nasazení pouze do kořene nové alfy s explicitním seznamem
   zastaralých cest. Ověřit skutečný document root, aby se úklid nedotkl
   `zkusebna_old`. Pouhé FTP přepsání existujících souborů nestačí.
4. Po nasazení zkontrolovat nové i odstraněné URL a absenci PHP chyb.
   Potom navázat samostatným čištěním nového kódu a knihoven.

PHP ani prohlížečové testy se při této dokumentační inventuře nespouštěly;
provozní soubory se nezměnily. Počty a velikosti vycházejí z existujících
verzovaných souborů, nikoli z odhadu obsahu hostingu.
