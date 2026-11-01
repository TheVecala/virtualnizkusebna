# Úseky nahrávek

Samostatná přihlášená stránka `useky.php`, dostupná z hlavní nabídky. Alternativní vizuální přehled timestampů pro jednu nahrávku nebo několik nahrávek nad sebou. Databázi nemění, není potřeba migrace.

## Společná data a význam pásů

- Čte stejný `php/ajax/vz2.php?action=catalog` jako hlavní aplikace a matice: `recordings[].timestamps`, `collections`, `recording_links`. Kompaktní výpis čte stejné databázové značky. Nevzniká druhá evidence úseků.
- Pokus vznikne pouze z `song_start` a explicitně spárovaného `song_end`. Neúplné hranice zůstávají body; známou délku nepřekročí.
- Pasáž končí na nejbližší následující strukturální značce, konci obsahujícího pokusu nebo známém konci nahrávky. Poznámka ji nezkracuje. U vnořených pokusů se použije nejužší obsahující interval. Toto je projekce panelu; stávající `Vz2Timestamps.endOf` a chování looperu se nemění.
- Poznámky jsou body. Shodné časy a překryvy mají oddělené řádky. Pokud délka není známá, osa končí poslední značkou a není vydávána za délku audia.
- Katalog nově vrací také `recording_links[].start_timestamp_id` a `end_timestamp_id`, aby přiřazení skladby nebylo závislé na shodě časů. Jde pouze o rozšíření odpovědi existujícími sloupci.
- Barvy: typ, stabilní identita skladby, identita nahrávky, jednotná. Bez přiřazené skladby je šedá. Barva není ukládána do značky.
- Společné měřítko znamená stejný čas od začátku každé nahrávky, nikoli synchronizaci podle času pořízení. Volba „Každá na celou šířku“ délky normalizuje pouze pro zobrazení.

## Rozhraní pro začlenění

Načíst `css/themes.css`, `css/vz2-segments.css`, `js/vz2-segments-model.js`, `js/vz2-segments-panel.js` v tomto pořadí. Obal nemusí používat samostatný controller `js/vz2-segments.js`.

```js
const panel = Vz2SegmentsPanel.mount(container, {
    options: { color: 'type', scale: 'shared', zoom: 1 },
    onSelect({ recording_id, recording, segment }) {
        // segment: id, timestamp_id, end_timestamp_id, kind,
        // start_ms, end_ms (null pro bod), song_id, parent_id, boundary, source
    },
    onActivate(selection) { /* dvojklik: přehrát vybraný úsek */ }
});
panel.setData(catalog.recordings, catalog);
panel.setOptions({ wave: true, compact: true });
panel.setWaveform(recordingId, { peaks, duration_ms });
panel.setPlayhead(recordingId, currentTimeMs);
panel.select(recordingId, 't' + timestampId);
panel.clearSelection();
panel.clearWaveforms();
panel.destroy();
```

Model `Vz2SegmentsModel.build(recording, catalog)` je čistá funkce použitelná i z Node.js. Přijímá `timestamps` z katalogu nebo `entries` z timestamp API. Renderer sám nic nenačítá ani nepřehrává; události a přehrávač vlastní hostitel. Data a velikosti jsou v milisekundách. Nastavení `takes`, `passages`, `notes`, `labels` pouze filtrují vykreslení.

Samostatná stránka zachytává existující událost `vz2:timestamps-updated`; pro změny z jiné karty slouží „Obnovit data“. Žádné automatické zapisování ani sdílení lokálních preferencí.

## Přehrávání a křivka

Běžné nahrávky mají přehrání/pozastavení a opakování vybraného rozsahu. Body spouštějí přehrávání od značky; nelze je opakovat jako interval. Audio se načte až při spuštění. Hranice smyčky řídí HTML audio, nejde o vzorkově přesný looper. Vícestopé nahrávky odkazují do stávajícího mixéru, nikdy nepřehrávají jen první stopu jako celek.

Volitelná wavekřivka používá výhradně existující `vz2_peaks.php` GET. Nevytváří nové peaks a nestahuje celé audio pro vykreslení. Chybějící křivka je popsaná přímo v panelu. Pro multitrack zatím chybí agregovaný průběh mixu; panel zůstává funkční bez něj.

## Ověření

```sh
node _pomocne/tests/vz2_segments.test.js
node _pomocne/tests/vz2_timestamps.test.js
node _pomocne/tests/vz2_segments.browser.test.js
```

Pro browser test je potřeba Playwright. Volitelné `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` vybere instalovaný Chromium/Edge, `SEGMENTS_SCREENSHOT_DIR` uloží desktopový a mobilní snímek. Test používá skutečná JS/CSS aktiva a izolované odpovědi API se syntetickým tichým WAV, ne produkční data. Ověřuje i absenci POST, přehrávání a smyčky, chybu načtení, přepínání pohledů, aktualizaci značek a bezpečné vykreslení textu.

V lokálním prostředí byl ověřen model a browser test v Edge. PHP/MySQL runtime zde není k dispozici, proto nebylo provedeno skutečné přihlášení a databázový integrační test. Přístupová brána stránky přebírá postup existujícího `prehled.php`.

K nasazení patří `useky.php`, `css/vz2-segments.css`, tři soubory `js/vz2-segments*.js`, změněný `index.php` a `php/inc/vz2_catalog.php`. Pomocné testy a dokumentace se na web nekopírují.
