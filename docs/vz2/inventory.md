# VZ2 – inventura kódu, etapa 1

Ověřeno čtením checkoutu `cd26bd8b011e94f9da34a685653c8e0333e104f2`, 16. 9. 2026.
Jde o zjištění z kódu, nikoli potvrzení stavu hostingu. Cesty níže jsou relativní
ke kořeni repozitáře. Návrhová rozhodnutí jsou v [design.md](design.md).

## Funkce a všechny nalezené zápisové cesty

| Funkce | Aktuální soubory | Současné úložiště / chování | Požadovaná změna |
|---|---|---|---|
| Osobní přihlášení, obnova identity | `php/loginbox4.php`, `php/auth.php`, `config.php`, `php/login/connect.php` | `users`, `auth_settings`; session `logged_in_single`, `user_id`, `user_name`, `role`, otisk hesla. Login zapisuje `users.last_login`. Config obnovuje aktivitu/roli a zneplatňuje staré session. | Zachovat účty, session a login; všem VZ2 endpointům společný bootstrap, UTF-8 a ověření identity před zpracováním. |
| Legacy přihlášení / odhlášení | `php/login/login.php`, `php/login/logout.php`, `php/inc/navrat.php` | Starý login čte `uzivatele` a MD5, nastavuje `id`, `prihlasen`, kontext kapely; není zdrojem osobní identity. Logout ruší session. Návrat používá `SITE_URL`. | VZ2 nesmí přijímat legacy `id`/`jmeno` jako autora. Odstranění staré cesty až ve vymezeném úklidu; ověřit, že VZ2 bootstrap starou session odmítá. Zachovat lokální návratové adresy. |
| Administrace členů a hosta | `admin.php`, `php/auth.php`, `migrations/001_personal_accounts.sql` | Insert/update `users`, update `auth_settings`; CSRF, admin, transakce, společný zámek `auth_settings.id=1`, ochrana posledního admina a kolize hesel. Účty se deaktivují, nemažou. | Ve stejné transakci přidat deník změn jména/role/aktivity/hosta/hesla (jen druh změny). Při degradaci sebe logovat původního ověřeného aktéra. |
| Přehled úložiště | `php/inc/admin_storage.php`, `php/inc/admin_storage_view.php`, `admin.php` | Read-only rekurzivní přehled souborů, cache reportu v session; POST `storage_refresh` má CSRF. | Samostatně zobrazit VZ2 kořen, pending operace a staré kořeny; přehled nesmí automaticky mazat. Refresh není obsahová změna do deníku. |
| Výběr skladby/zkoušky a seznam | `index.php`, `php/inc/content_context.php`, `php/ajax/ajax_slozky.php`, `php/ajax/zmenit_slozku_ajax.php`, `js/main.js`, `js/workspace.js` | `scandir`, názvy složek, `data/nazev_valu.txt`, `poradi.json`; sekce `uploads`/`zkousky`, výběr se zapisuje do session a pamatuje zvlášť. | SQL `vz2_collections`, ID místo slugu; výběr bez nutné fyzické složky. POST výběru ověřuje existující ID a CSRF, výběr se neloguje. |
| Vytvoření skladby/zkoušky | `php/actions/vytvorit_adresar.php` | `create_val`; `mkdir`, kopie dvou TXT šablon, soubor názvu, runtime `CREATE TABLE` diskuse; bez vlastníka a CSRF. | SQL kolekce + diskusní vlákno v transakci; dokumenty až při prvním uložení, šablonu nabídnout v editoru. Disk až při prvním uploadu. |
| Přejmenování celku | `php/actions/prejmenovat_val.php` | `rename_val`; fyzické `rename`, úprava JSON pořadí/názvu, `RENAME TABLE`, přepis `recording_notes.file_path`. | Jen SQL title + revize + deník, vlastník/admin; žádné fyzické přejmenování ani DDL. |
| Úplné smazání celku | `php/actions/smazat_val.php` | `delete_val`; odhad prázdnosti počtem položek, maže texty i historii a adresář, `DROP TABLE` diskuse. | Výhradně admin, explicitní potvrzení s revizí, řízené smazání konkrétních SQL potomků a evidovaných souborů; deník přežije. |
| Pořadí | `php/ajax/uloz_poradi.php`, `js/main.js` | `reorder`, zápis přijatého pole do sekčního `poradi.json`; bez revize/CSRF/ověření všech členů seznamu. | SQL sort_order a revize seznamu, transakční zámek scope, přesná množina ID a kontrola duplicit. Sdílené pořadí celků je výslovná výjimka z vlastnictví. |
| Běžný upload, nahrávání z UI | `php/actions/upload_uni.php`, `php/modals.php`, `js/main.js` | `upload`; cesta dle session, kontrola přípony, kolize jména, `move_uploaded_file`. Povolené audio MP3/WAV/OGG/FLAC/AAC i PDF/TXT/JPG/JPEG/PNG/GIF. Volitelně čte `maily_<kapela>` a posílá mail. | Explicitní collection_id, CSRF, validace obsahu, staging, SQL autorství a operace; oddělené audio a přílohy. Tlačítko REC samo nedokládá funkční ukládací tok – při implementaci ověřit browserovou obsluhu, neposílat v této etapě maily. |
| Výpis a stažení souborů | `php/ajax/ajax_nahravky.php`, `js/main.js` | Výpis podle disku, audio a ostatní přílohy společně, popisky z `recording_notes`; přímé URL, download a offline kopie. | SQL výpis nahrávek i příloh, stav odstraněného/chybějícího audia; autorizované ID URL souboru podporující Range. |
| Přesun souboru | `php/actions/presunout_soubor.php` | `move_file`; zdroj přichází z POST, `rename` audia a peaks, přepis SQL cest; cílová kolize není bezpečně ošetřena. | ID nahrávky/přílohy a cílové kolekce, vlastník/admin, pouze logický přesun SQL. Žádná uživatelská zdrojová cesta. |
| Odstranění souboru | `php/actions/smazat_soubor.php` | `delete_file`; `unlink` souboru a peaks; SQL zápisy zůstávají, ale nahrávka zmizí z výpisu podle disku. | Samostatná akce odstranit audio, zachovat řádky a délku; ID, vlastník/admin, CSRF, stav operace, kdo/kdy, deník. |
| Timestampy looperu – list/count/add/update/delete | `php/ajax/ajax_nahravka_poznamky.php`, `js/main.js` | Runtime `CREATE TABLE recording_notes`; `file_path VARCHAR(1000)`, `cas BIGINT` v ms, typ 0/1/2, autor text `SESSION[jmeno]` nebo „uživatel“. CRUD mimo popisek ověřuje jen neprázdnou roli; update/delete jen podle ID. | `vz2_timestamps`, recording_id, stabilní users.id, právo comment + vlastnictví, revize, CSRF, ověření vazby ID na nahrávku. |
| Popisky | Stejný endpoint, `php/ajax/ajax_nahravky.php`, `js/main.js` | `cas=-1`, `popisek_set` má právo `edit_recording_label`, nikoli vlastníka; bez revize, samostatného autorství a unikátnosti popisku. Platí i pro neaudio přílohy. | Samostatné summary u nahrávky a popisek u přílohy, vlastní původní autor/editor, bez záporného času. |
| Looper: intervaly, seznam, kopírování/export | `js/main.js`, `php/ajax/export_timestampy.php`, `index.php`, `php/modals.php` | `collectTimestampData`, `findTimestampLoopEndMs`: řazení ms/id, pouze pozdější začátky, konec podle duration; export TXT bere path a zahrnuje popisek; JS kopíruje filtrované typy do tabulky. | Zachovat ovládání a pravidla; společný panel timestampů nad SQL, serverový export dle ID a klientsko-přehrávačový adaptér. |
| Peaks | `php/ajax/nacist_peaks.php`, `php/ajax/ulozit_peaks.php`, `js/main.js` | `.peaks.json` vedle audia, duration v sekundách float. Endpointy bez configu; zápis jen kontrola role a prefixu cesty, bez CSRF. | Cache podle file ID + hash + verze algoritmu v odděleném adresáři; canonical duration v SQL, ne pouze v cache. Host cache lokálně počítá, serverově nezapisuje. |
| Multitrack seznam/detail/URL | `php/ajax/multitracky.php`, `php/inc/multitracky.php`, `php/inc/multitrack_config.php`, `multitrack.php` | `multitracky/<slug>/multitrack.json`, cesta/slug je ID, JSON seznam stop; samostatný pohled `index.php?view=multitrack`. Starý vstup přesměrovává. | Stejná tabulka recordings, kind=multitrack nezávislý na počtu stop, povinná kolekce; JSON pouze odpověď API, ne katalog na disku. |
| Multitrack upload | `php/actions/upload_multitrack.php`, `php/inc/multitracky.php` | Login, upload, CSRF, kontrola počtu stop, podpisu MP3/WAV/FLAC a stejného formátu, staging a rename; už jedna stopa dovolena. Slug nesmí kolidovat ani s archivním zápisem. | Zachovat validace a atomické zveřejnění sady, nahradit manifest SQL stopami a číselným ID. |
| Multitrack zápisy a souhrn | `php/ajax/multitrack_notes.php`, `php/inc/multitrack_notes.php`, `js/multitrack-notes.js` | `multitrack_zapisy/<id>.json`; flock, revision/HTTP 409, author=`user_name` zachován při editaci, náhodná ID položek, typ chapter/note, desetinné sekundy. Bez users.id a vlastnictví; summary bez autora. | Společné SQL timestampy v ms a recording summary, HTTP 409 se zachováním rozepsaného textu; žádná další evidence. |
| Multitrack odstranění audia | `php/ajax/multitrack_notes.php`, `php/inc/multitrack_notes.php` | Archiv JSON před unlink stop, manifest audioDeleted. Fallback při chybě čtení manifestu může vydávat archiv jako audioDeleted i při neočekávané ztrátě. Délka není garantovaně uchována v archivu. | Zaznamenaný úmysl a postup operace v SQL; rozlišit missing od deleted, persistentní délka a stopy, oprávnění vlastníka/admina. |
| Výběr multitracku | `php/ajax/ulozit_pracovni_polozku.php`, `js/workspace.js` | Session last_multitrack_id, ověření seznamu; endpoint nenačítá config a kontrola potřebuje globální PRAVA, které zde nejsou inicializovány. | Společný bootstrap a výběr podle recording_id; žádná obsahová změna do deníku. |
| Diskuse + Nápady – čtení/vkládání/editace/mazání | `php/ajax/ajax_diskuse.php`, `php/ajax/ajax_napady.php`, `php/ajax/vlozit_komentar.php`, `php/ajax/upravit_komentar.php`, `php/ajax/smazat_komentar.php`, `php/inc/discussion_context.php`, `js/main.js`, `js/workspace.js` | Tabulky `diskuse_<kapela>_<slug>`, `zkousky_<kapela>_<slug>`, `napady_<kapela>`, `mt_diskuse_<hash>`. `cas INT` je identifikátor, není PK; name z formuláře. Změny vyžadují comment, bez vlastnictví; CSRF je navíc jen v multitrackové větvi. Čtení někdy vytváří tabulku. | Jediné threads/posts, post.id, serverový autor, CSRF a revize; diskuse jen u kolekce nebo Nápadů. V Mixéru ukázat diskusi rodičovské kolekce, žádné recording vlákno. |
| Texty/tabulatury – čtení a raw editor | `php/ajax/ajax_text.php`, `php/ajax/ajax_text_raw.php`, `php/ajax/ajax_tabelatura.php`, `php/ajax/ajax_tabelatura_raw.php`, `js/main.js`, `php/modals.php` | `texty/akordy.txt`, `texty/tabelatura.txt`, volba podle session; jen role, bez configu. | Document ID + kolekce + druh, společné ověření i u čtení, obsah plain text a escapování na výstupu. |
| Texty/tabulatury – ukládání a historie | `php/actions/vlozit_akordy.php`, `php/actions/vlozit_tabelaturu.php`, `php/ajax/ajax_history.php` | edit_text; kopie do `_history/<typ>_<čas na sekundy>.txt`, automaticky jen 20 záloh, přepis aktuálního souboru; bez autora, CAS/CSRF. Historie čte seznam a konkrétní obsah. | SQL neměnné verze, FK na aktuální revizi, společná transakce a konflikt 409. Všechny verze dostupné stránkováním, žádné promazávání. |
| Deep-linky a navigace | `index.php`, `php/loginbox4.php`, `js/main.js`, `js/workspace.js`, `multitrack.php` | `sekce,val,nahravka,time` (ms), MT `view,id`; validace proti fyzickému seznamu a zachování query přes login; UI layout pro pohledy zvlášť. | `v=2&recording_id=…&time_ms=…` nebo collection_id, validace SQL, archiv se otevře i bez audia; nové klíče UI. |
| Offline poslech / download | `js/main.js`, `js/multitrack.js` | IndexedDB `zkusebna-audio-cache` / `audio-files`; `audio-v1:<absolutní URL>`, `multitrack-v1:<id>:manifest` a track URL. Kompletní sada, mazání offline kopie, export blobu jako soubor. | Nový namespace v2 + dataset + prostředí + file ID/hash; zachovat cache i samostatný download, žádný import staženého souboru jako zdroje přehrávače. |

## Důkazy a konflikty s cílovým chováním

1. `config.php:13–15` dává hostovi prázdnou mapu práv. Přesto
   `php/ajax/ajax_nahravka_poznamky.php:7,143–216` propouští hostovu neprázdnou
   roli do add/update/delete. Host má `user_id=null`; nelze mu přiřadit osobního
   autora. Řešení: VZ2 všechny obsahové zápisy hosta odmítne 403. Je to oprava
   nesouladu endpointu s mapou práv, ne zavedení anonymního autora.
2. `ulozit_peaks.php:18,69` umožňuje zápis odvozené cache pouze podle role.
   Návrh neuděluje hostovi nové serverové zápisy; peaks může počítat do paměti.
3. Pouhé include `connect.php` může načíst config až PO původní kontrole role
   (`ajax_diskuse`, `ajax_napady`, export). Zneplatnění session tak nemusí být
   následované novou kontrolou. Raw texty, historie, seznam složek a peaks
   konfiguraci vůbec nenačítají. Nutná je kontrola po bootstrapu všude, ne
   pouze přidání include na konec. Výpis audia načítá DB podmíněně podle souborů.
4. Vlastník zatím prakticky není evidován; oprávnění jsou rolová. Ověřený člen
   může měnit cizí komentář, timestamp, text či multitrackový zápis. U textů to
   cílově zůstává dovoleno, u ostatního ne. Vlastnictví rodiče nenahrazuje
   vlastnictví nahrávky/timestampu/příspěvku.
5. `vlozit_komentar.php:23` přijímá jméno formuláře; `recording_notes` užívá jiné
   session jméno než osobní login. Multitrack zachovává jméno, ale ne stabilní ID.
   Žádné z těchto jmen se nemá migrovat či vydávat za ověřeného autora VZ2.
6. Přejmenování/přesuny mění cesty; odstranění běžného audia skryje stále
   existující zápisy. `smazat_val.php` předpokládá, že bez souborů nejsou poznámky,
   což není pravda po předchozím unlink. SQL model tento předpoklad nepřebírá.
7. Univerzální upload obsahuje neaudio přílohy a volitelné maily. VZ2 proto
   návrhově zahrnuje malou tabulku příloh; jejich upload/download/přesun/popisek
   se nemají tiše ztratit. Stávající mailový seznam nemá v checkoutu doloženou
   migraci. Zachování volby oznámení vyžaduje před nasazením ověření tabulky;
   jde o vedlejší efekt až po úspěšném uploadu, ne důvod odvolat uložený obsah.
8. V checkoutu nejsou soubory `user/…` (jsou ignorované), ani živé hostingové
   konfigurace obou webů. `index.php:26–27,62` dokládá pouze relativní rozložení
   `user/kapela/471707760/{uploads,zkousky}`; multitrack přidává `multitracky`
   a `multitrack_zapisy`. Sousední adresář nazvaný main nedokládá nasazení alfy.
9. Jediná sledovaná SQL migrace je `001_personal_accounts.sql`: users.id je
   **INT UNSIGNED**, InnoDB. Živé schema se z ní neodvozuje bez kontroly hostingu.
   `docs/migrace-osobnich-uctu.md` dokládá dřívější lokální PHP 8.5.10 a MariaDB
   11.4.5, nikoli verze nyní běžící na hostingu.
10. V kódu není společný deník. Oprávnění jsou PHP mapa, nemají vlastní SQL
    editor. Audit změny role/hosta je proveditelný v administraci; ruční změna
    mapy práv v configu vyžaduje při nasazení samostatný zaznamenaný krok.
11. `php/modals.php:522` obsahuje record_button, ale vyhledání record_button,
    MediaRecorder, Recorder a getUserMedia v lokálním JS/PHP neodhalilo jeho
    nahrávací obsluhu. REC proto nelze označit za ověřenou funkční zápisovou
    cestu. Je to existující nejasnost UI, nikoli důvod slibovat opravu rekordéru
    v etapě 1 nebo při návrhu vypnout běžný upload.

## Rozsah prohlídky

Prohlédnuty soubory v `php/actions`, `php/ajax`, relevantní `php/inc`, auth,
login/config/index/admin, JS looperu, multitracku a workspace, modály, migrace
a provozní dokumentace. Vyhledány i zápisy souborů, DML a runtime DDL napříč
PHP. Testy pod `tests/` jsou podklad k budoucím scénářům, nikoli důkaz nového
provedeného testu. Žádný endpoint ani produkční DB nebyly spuštěny.
