# Kompaktní UI – etapa 2

Základ ověřen před zahájením: větev `feature/zobrazeni_VZ2.0`, uživatelem
vytvořený commit `22d999a0514353d7d522da7da752b89a9f4f1e7a` (`etapa 1`),
čistý pracovní strom. Nevytvářel se duplicitní commit první etapy.

## Změny

- `js/vz2.js`: nezávislé rozbalování karet tlačítkem s `aria-expanded`
  a `aria-controls`. Stav otevřených ID je jen v paměti aktuální stránky;
  obnovení katalogu jej zachová, reload jej vymaže. Sbalení nemění audio
  element, jeho pozici ani přehrávání a samo nespouští žádný nástroj.
- Běžná nahrávka má v rozbaleném těle původní HTML audio přehrávač.
  Offline kopie, odkazy na čas, úpravy, přesuny, mazání a pořadí jsou
  v menu `⋮`; jednotlivé soubory mají obdobné menu pro název a pořadí stop.
  Timestampy, filtry, exporty a smyčky zůstávají v těle karty.
- Menu používají nativní `details/summary` a rozbalují se uvnitř panelu,
  takže je neodřízne scrollovací kontejner ani úzká šířka panelu.
- Přílohy používají stejný typ menu. Uploadový formulář je ve sbalitelné
  sekci „+ Přidat nahrávku / přílohu“.
- `css/vz2.css`: kompaktní hlavičky, čitelné stavy nahrávek, jednotné menu,
  menší mezery formulářů a dialogů, olivové hlavní akce a zachované dotykové
  plochy na mobilu/tabletu. Významové barvy timestampů se nemění.

Mixér je do etapy 3 stále vložený v kartě mimo její sbalitelné tělo, aby
zůstal dostupný i při reloadu přímého odkazu. Tlačítko „Otevřít Mixér“ je
samostatné a pouhé rozbalení karty Mixér nenačítá. „Otevřít“ pro běžné
audio bude napojeno na Looper při jeho zavedení v etapě 3; v aktuální VZ2
Looper dosud neexistuje. Backend, API, DB, oprávnění a audio jádra se nemění.

## Kontroly

- `tests/vz2_timestamps.browser.js` a `tests/vz2_navigation.browser.js`:
  stávající regresní scénáře nyní nejprve rozbalují kartu; původní kontroly
  timestampů, konfliktů, exportu, smyček a navigace zůstaly zachovány.
- Nový `tests/vz2_recordings.browser.js`, zapojený do integrační sady:
  více otevřených karet, běžné audio, zachování pozice při sbalení,
  žádné automatické otevření Mixéru, offline uložení/odebrání, časový odkaz,
  přejmenování, přesun, stav po refreshi/reloadu, mobil a práva hosta.
- `node --check`, `git diff --check`, timestampové unit testy, kontrakt
  Mixéru (45 DOM ID) a kontrakt stahování offline audia: PASS.
- Integrační sada `tests/vz2_integration.test.js` s `VZ2_TEST_BROWSER=1`:
  **183/183 PASS** na dočasné kopii webu s oddělenou MariaDB 11.4.5 na
  portu 33329. Nové browser testy prošly včetně kliknutí na skutečné
  nativní Play na mobilní šířce; běžící web ani jeho data se nepoužily.
- Znovu prošly všechny šířky etapy 1: 360, 390, 767, 768, 1024, 1199,
  1200, 1280, 1440 a 1920 px. Vizuálně prohlédnut desktop se sbalenými
  kartami a mobil s rozbalenou kartou včetně HTML audio přehrávače.
- Nebyla přidána migrace ani Bootstrap komponenta. Upraveny jsou dva
  aplikační soubory (`js/vz2.js`, `css/vz2.css`), tři existující testové
  soubory a dva nové soubory (tento dokument a browser test nahrávek).

Commit této etapy čeká na samostatné schválení podle bodu 12 zadání.
