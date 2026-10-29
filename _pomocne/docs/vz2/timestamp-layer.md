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
