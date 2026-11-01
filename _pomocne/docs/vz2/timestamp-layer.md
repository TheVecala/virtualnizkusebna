# Společná vrstva timestampů (kontrakt 1)

Implementace navazuje na `170190292a1080e9f97e972f14c96ccf2f80d169` z větve
`feature/změna_přihlašování`. Nahrazuje odvozování konce pasáží další značkou.
Mapa skladby nadále popisuje ideální strukturu; žádná změna pokusu ji neupravuje.
Přiřazování k taktům Mapy a hodnocení provedení nejsou součástí této etapy.

## Kontrakt pro další pohledy

Timestamp API i katalog vracejí `annotation_version: 1` a `annotations`.
`entries` (API) a `timestamps` (katalog) zůstávají pro kompatibilitu.
Nové vizualizace používají `Vz2TimestampModel.items(recording, context)`.
Modul `js/vz2-timestamp-model.js` nevyžaduje DOM, přehrávač ani síť.
Serverovou projekci poskytuje `php/inc/vz2_timestamp_model.php`; shodu s fallbackem
pro starší offline data ověřuje `vz2_timestamp_model.test.js`.

| Pole | Význam |
| --- | --- |
| `id` | Stabilní `t<id počáteční značky>`, shodné ve všech pohledech |
| `recording_id`, `timestamp_id`, `end_timestamp_id` | Trvalé odkazy; konec pokusu je nadále samostatná párovaná značka |
| `kind` | `take`, `passage`, `note`, `boundary` (nespárovaný starší konec) |
| `start_ms`, `end_ms` | Celé ms; `null` konec nikdy nenahrazuje odhad |
| `status` | `complete`, `open`, `point`, `orphan` |
| `parent_id` | Explicitní vazba pasáže na pokus; může být `null` |
| `song_id`, `song_title` | Skladba pokusu; pasáž ji přebírá z rodiče |
| `passage_type` | `intro`, `verse`, `chorus`, `bridge`, `solo`, `outro`, `custom` |
| `label`, `note_text` | Název/popisek a samostatná poznámka |
| `can_edit`, `can_delete` | Oprávnění k celému objektu, včetně obou hranic pokusu |
| `source`, `end_source` | Původní značky včetně revizí, textů a autorství; konec pokusu zachovává i původní poznámku |

`Vz2SegmentsModel` přidává pouze údaje o ose a rozložení. Seznam timestampů,
Looper, Mixér, waveform a exporty používají stejná pravidla intervalů.
Barvy, zoom, filtry a vizuální řádky jsou záležitostí pohledu.
Časové překryvy a mezery jsou povolené. Samotná poloha neurčuje příslušnost
pasáže k pokusu. Editor nabídne rodiče, je-li pro aktuální čas jediný;
při více kandidátech vybírá uživatel. Starší pasáže zůstávají bez konce
a bez dodatečně odhadnuté vazby.

## Čtení a zápis

`GET php/ajax/vz2_timestamps.php?recording_id=…` vrací i nabídku `songs`,
`default_song_id`, oprávnění a `timestamps_revision`.

`POST` JSON s CSRF hlavičkou podporuje:

- `save_interval`: `recording_id`, `timestamps_revision`, `kind` (`song_start`
  nebo `passage`), `time_ms`, `end_time_ms` (může být `null`), `body`,
  `note_text`; pro pokus `song_collection_id`, pro pasáž `passage_type`
  a `parent_timestamp_id`. Úprava přidá `id` začátku a jeho `revision`.
- `delete_interval`: ID začátku, jeho revize a revize seznamu. Pokus odstraní
  včetně párovaného konce. Historie nebo přiřazené pasáže odstranění blokují;
  nejdřív je potřeba vazby výslovně odebrat.
- Dosavadní `create/update/delete` zůstávají pro body a kompatibilitu.
  Používají stejné validace a transakce. Neumožňují obejít vazby intervalu.

`Vz2Timestamps.save(id, fields)` provede zápis a zveřejní aktuální výsledek.
`getList`, `getItems`, `reload` zpřístupňují data ostatním částem aplikace.
Událost `vz2:timestamps-updated` nese celý výsledek API. Otevřené panely stejné
nahrávky se aktualizují; hostitel nového pohledu aktualizuje svůj model touto
událostí. Samostatná karta používá Obnovit data. Neexistuje druhé úložiště.

Editor ukládá obě hranice společně. Při poslechu lze uložit začátek a později
použít Ukončit pokus/pasáž nebo vybrat rozpracovaný úsek v editoru.
Časy lze zachytit z přehrávače, posunout o sekundu nebo zadat ručně;
úprava textu neztrácí skryté milisekundy. Při konfliktu HTTP 409 zůstává
celý formulář zachovaný a aktuální verze se načítá k výslovnému porovnání.
`openIntervalEditor(panel, kind, item, finish, draft)` přijímá i předvybraný
rozsah `draft.time_ms` / `draft.end_time_ms` pro budoucí ovládání waveformu.

## Uložení a invarianty

Pokus používá stávající dvojici `song_start`/`song_end` a stabilní ID.
Pasáž používá jednu značku `passage` s `time_ms` a `end_time_ms`.
`song_collection_id` na začátku pokusu je zdroj pravdy pro přiřazení skladby.
`parent_timestamp_id` odkazuje na začátek pokusu ve stejné nahrávce.

Konec je vždy větší než začátek a nepřekračuje známou délku nahrávky.
Přiřazená pasáž musí ležet uvnitř pokusu. Posun kterékoliv hranice znovu
ověří děti; žádná hranice se tiše neořízne. Otevřené úseky nemají smyčku.
Změna se provádí pod zámkem nahrávky s kontrolou revize, oprávnění,
autorství a auditu v jedné transakci.

Dokončený přiřazený pokus ve zkoušce automaticky vytvoří řádek Historie.
Změna skladby zachová jeho ID; existující výstřižek jiné skladby vyžaduje
nejprve odpojení. Odebrání přiřazení zachová případný samostatný výstřižek.
Přidávání/odebírání pokusů přímo v Historii aktualizuje stejné přiřazení
a revizi timestampů. Odstranění audia zachová všechny údaje.
Skladba použitá i otevřeným pokusem se při mazání archivuje.

## Migrace a nasazení

1. Záloha společné DB a kontrola nasazovaného commitu/manifestu.
2. V údržbě ručně spustit `_pomocne/migrations/009_timestamp_intervals.sql`
   po migracích 001–008. Aplikace migraci nespouští.
3. Migrace zachová ID, autorství i hranice pokusů. Z Historie doplní přiřazení
   skladeb na začátky pokusů. Staré pasáže dostanou typ `custom` a žádný
   vymyšlený konec. Opakované spuštění nezmění už vyplněné konce ani typy.
4. Nasadit všechny změněné PHP/JS/CSS včetně nových modulů a obou stránek.
   Nasazení kódu bez migrace není podporované. Spustit nový preflight,
   který ověřuje přítomnost sloupců migrace 009.
5. Ověřit přiřazení skladby, pasáž s koncem, starší pasáž bez konce,
   historii, smyčku a export. Beta a alfa sdílejí DB, proto je potřeba
   koordinovat nasazení obou aplikací.

Produkční DB ani hosting tato implementace nemění. Testy běží v izolované DB.

## Ověření

```sh
node _pomocne/tests/vz2_timestamps.test.js
node _pomocne/tests/vz2_segments.test.js
PHP_BIN=/cesta/php node _pomocne/tests/vz2_timestamp_model.test.js
PHP_BIN=/cesta/php VZ2_TEST_DB_PORT=13306 node _pomocne/tests/vz2_integration.test.js
PHP_BIN=/cesta/php VZ2_TEST_DB_PORT=13306 VZ2_TEST_SUITE=timestamp-intervals VZ2_TEST_BROWSER=timestamps node _pomocne/tests/vz2_integration.test.js
node _pomocne/tests/vz2_segments.browser.test.js
node _pomocne/tests/vz2_offline.browser.test.js
node _pomocne/tests/vz2_looper_drawer.browser.test.js
```

Pro browser testy lze nastavit `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
Testy pokrývají společný PHP/JS kontrakt, neúplné i překrývající se pasáže,
hranice, vazby, oprávnění, konflikt revizí, rollback auditu včetně Historie,
desktop/mobil, Mixér, starší data, export a přehrávání offline.

## Sdílená obsluha pohledů a stahování

Nad kontraktem 1 jsou samostatné moduly:

- `Vz2TimestampStore` (`js/vz2-timestamp-store.js`): `load/reload`, `peek`,
  `items`, `subscribe`, `save`, `saveInterval`, `saveNote`, `remove`, `select`.
  Souběžná čtení stejné nahrávky sdílejí požadavek; starší odpověď nemůže
  přepsat novější revizi. Ověření oprávnění a zápis zůstávají na serveru.
  Zápis vrací potvrzená data a aktualizuje odběratele i dosavadní událost
  `vz2:timestamps-updated`. `select` vyvolá `vz2:timestamp-selected` s dvojicí
  `recording_id`, `item_id`; samotný výběr nic nepřehrává.
- `Vz2TimestampEditor.open({recording_id, kind, item_id, adapter, finish, draft})`
  (`js/vz2-timestamp-editor.js`): společný editor pokusů a pasáží. Nevyžaduje
  seznam timestampů ani jeho DOM. Nový pohled předá ID nebo nový rozsah
  `draft.time_ms/end_time_ms`. Načte revizi, oprávnění a nabídky z API.
  Konflikt zachová formulář a vyžaduje výslovné převzetí aktuální revize.
  Bodové poznámky zpracuje tentýž vstup s `kind: 'note'` nebo `item_id` poznámky.
  Samostatný `Vz2NoteEditor` (`js/vz2-note-editor.js`) zajišťuje jejich formulář,
  kontrolu revize, přesnost času a konflikty. Volitelné připojení k hostiteli
  zachovává dokované a mobilní ovládání seznamu; pro otevření z jiného pohledu
  žádný seznam ani jeho DOM nepotřebuje.
- `Vz2TimestampPlayback` (`js/vz2-timestamp-playback.js`): `play(adapter,item,
  {repeat,owner,onError})`, `stop`, `state`. Adaptér poskytuje `playRange`,
  `currentTimeMs`, `canPlay`, volitelně `isLoading` a `pause`. `stop` ruší
  řízení úseku, nikoli automaticky audio. Seznam/Looper/Mixér i Úseky sdílejí
  řízení smyčky. Aktualizace názvu nepřeruší smyčku; změna hranic aktualizuje
  její rozsah a odstranění intervalu smyčku vypne.
- `Vz2Downloads` (`js/vz2-downloads.js`): `local`, `read`, `source`, `enqueue`,
  `plan`, `enqueueRecordings`, `snapshot`, `subscribe/watch`, `cancel`,
  `removeKey`, `inventory`, `clear`. Využívá stávající IndexedDB i klíče
  prostředí/ID/hash, bez migrace či duplikace existujících kopií.
  Získávání audia pro přehrávače popisuje kontrakt níže.
- `Vz2DownloadsPanel.mount(host,getCatalog)` poskytuje výběr kolekce a nahrávek,
  plán objemu před stažením, frontu, opakování, rušení, soupis místních souborů,
  úplnost sad a odhad zbývajícího prostoru. `open()` obnoví katalog a stav.

Úseky (`useky.php`) nyní umějí přímo vytvořit, upravit, dokončit či odstranit
interval, vytvořit/upravit bodovou poznámku, využít místní audio a spravovat stahování. Nová stránka nepotřebuje
modul seznamu `vz2-timestamps.js`. Změna dat zachová aktuální výběr a zdroj audia.
Samostatné karty prohlížeče nadále obnovují timestampy tlačítkem Obnovit data.

### Společné získávání audia

Karty nahrávek, Looper, Mixér, režim Auto i Úseky vybírají zdroj přes
`Vz2Downloads`. Pohledy nepřistupují přímo k uloženému audiu. Looper si nadále
samostatně spravuje pomocné waveform peaks; starší samostatné použití Mixéru
bez VZ2 zachovává původní formát úložiště.

- Vstup `file` odpovídá souboru z katalogu: `id`, `sha256`, `url`, `byte_size`.
  Mixér převádí svůj popis stopy na tentýž formát. Místní kopie se hledá podle
  prostředí, ID a hashe verze. Při známé velikosti musí počet bajtů odpovídat;
  neúplná kopie se pro přehrávání přeskočí. Starší metadata bez velikosti
  zůstávají podporovaná. Obsah velkých souborů se při kontrole znovu nehashuje.
- `local(file)` vrací platný místní `Blob` nebo `null`; chybu IndexedDB
  předává volajícímu. Používá se při ukládání a zjišťování dostupnosti.
- `read(file, {download, signal, onProgress})` vrací `{blob, local,
  storageError}`. Výchozí `download: false` pouze ověří místní kopii.
  `download: true` při chybějící kopii načte celý soubor do paměti a ověří
  velikost, jak potřebuje Mixér pro dekódování. Samotné čtení nic neukládá.
  Chyba úložiště neblokuje síťový zdroj; `storageError` je příznak pro UI.
- `source(file, options)` přidává `url` a idempotentní `release()`.
  Pro místní blob vytvoří objektovou URL; jinak vrací původní síťovou URL,
  ze které si audio element načítá podle potřeby. Looper si při chybějících
  peaks vyžádá `download: true` a dostane URL i blob načtený do paměti.
  `local` znamená původ z IndexedDB, nikoli pouze existenci blob URL.
- Hostitel uvolňuje zdroj při výměně nebo zavření přehrávače. Opožděný
  výsledek po změně výběru také uvolní. `AbortSignal` zastaví plný síťový
  přenos a zabrání zahájení přenosu po opožděném čtení z úložiště.
  Tento signál neovlivňuje samostatnou frontu `enqueue`.

Přepnutí již běžícího poslechu na právě uložený blob dál zajišťuje
`Vz2Offline.useBlob`: zachovává pozici, přehrávání/pauzu i rychlost.
Obnovení připojení samo nepřepíná zdroj rozehraného audia. Stávající kopie
se nemigrují ani automaticky nemažou; nové vizualizace použijí stejné API.

### Pravidla stahování

Fronta běží sekvenčně a nezávisí na otevřeném přehrávači. Opakované požadavky
na stejný soubor sdílejí úlohu; již uložený soubor správné velikosti se přeskočí.
Kontroluje se úplnost stažení a dokončení zápisu do IndexedDB. Kontrola všech
souborů v přehledu neprovádí dekódování ani načítání audia do ArrayBufferů.
Dokončené úlohy nezadržují své audio bloby v paměti fronty.

Chyba jedné stopy ponechá ostatní soubory uložené. Mixér s aktuálními metadaty
určuje úplnost podle skutečné dostupnosti všech stop, takže rozpozná i sadu
staženou hromadně mimo Mixér. Starší manifesty a audio se nemažou při zavedení
služby. Chyba kvóty nabízí odstranění místních kopií, žádné automatické mazání.
Odstranění místní kopie neovlivňuje server ani právě přehrávanou blob URL.

Fronta je společná uvnitř jedné stránky. Opuštění stránky přeruší nehotový
přenos; lehké údaje o nehotových úlohách se uchovají v `sessionStorage` stejné
karty. Po obnovení se nabídne ruční opakování, nic se samo nestahuje. Dokončené
soubory zůstanou v IndexedDB. Opakování nehotového souboru začíná od začátku;
pokračování po bajtech ani koordinace front mezi kartami nejsou implementované.

Tato etapa nepřidává úplný offline start aplikace, offline editaci ani další
SQL migraci. Nadále platí požadavek migrace 009 z předchozí etapy. Mapa skladby
se nemění. Fronta metadat timestampů pro offline synchronizaci neexistuje.

### Dodatečné ověření

`_pomocne/tests/vz2_shared_services.browser.test.js` ověřuje deduplikaci,
hromadné ukládání, částečnou sadu, opakování, rušení, místní zdroj, opožděné
čtení revize a samostatný editor s konfliktem. Integrační browser test timestampů
ověřuje úpravu přímo v Úsecích bez modulu seznamu, zachování smyčky a stažení
celé zkoušky. Offline regresní test kontroluje dokončení fronty po zavření Looperu.

`_pomocne/tests/vz2_audio_sources.browser.test.js` ověřuje zdroj podle verze
a prostředí, neúplnou kopii, chybu úložiště, načtení bez automatického zápisu,
chyby HTTP i přerušeného přenosu, zrušení po opožděném čtení a uvolnění URL.
`vz2_offline.browser.test.js` navíc ověřuje místní zdroj a neúplné kopie
v reálných přehrávačích, rušení načítání Mixéru a tvorbu peaks z paměti Looperu.


### Přehled a režim Auto

Kompaktní Přehled používá `vz2_timestamp_annotations` pro každou nahrávku.
Jeho položky typu `marker` nesou normalizované druhy `take/passage/note/boundary`,
ID, skutečný začátek/konec, stav, typ pasáže, rodiče a skladbu. Zachovává `time_ms`
jako alias začátku pro kompatibilitu textového výstupu. Syrové SQL zdroje se
neposílají; poznámka a autorství konce jsou v `end_body/end_author/end_at`.
Párovaný pokus je jeden řádek. Otevřené pasáže mají „Doplnit konec“ a staré
nespárované konce zůstávají viditelné. Filtry `*_marker_song_start/song_end`
zůstaly pod původními klíči, ale nyní znamenají pokusy / nespárované konce.
Přehled zůstává pouze pro čtení, bez audia a mediálních URL; Mapa se nemění.

Režim Auto načítá timestampy přes Store a vykresluje pokusy z Model.items.
Ukazuje oba známé časy a přiřazenou skladbu. `Model.activeTakes(recording,ms)`
vrací dokončené pokusy v intervalu `[start_ms,end_ms)`. Mezera neoznačuje žádný
pokus, překryv označí všechny odpovídající pokusy, otevřený pokus se nikdy
nepovažuje za nekonečný interval. Zůstává kliknutelný a označený „bez konce“.
Aktualizace názvu či hranic neznovunačítá audio. Rychlá hodnocení používají
Store.addQuickNote; změna se nedotýká ukládání ani výběru místního audia.

Doplňkové testy: `vz2_note_editor.browser.test.js` (samostatný formulář,
revize, oprávnění, výpadek, mobil), `vz2_overview_intervals.browser.js` (volá
integrační sada overview) a scénáře režimu Auto v `vz2_offline.browser.test.js`.
