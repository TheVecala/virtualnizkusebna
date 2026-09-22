# Kompaktní UI – etapa 3

Výchozí stav: větev `feature/zobrazeni_VZ2.0`, uživatelský commit
`ef793e2dd86a601430b1792ae77873a865065902` (`etapa 2`), čistý pracovní
strom. Duplicitní commit druhé etapy se nevytvářel.

## Změny a soubory

- `vz2.php`: společný prostor přehrávače nad obsahovými panely,
  společné záhlaví, transport, nabídka a ovládání Looperu.
- Nový `js/vz2-player.js`: stavy prázdný/Looper/Mixér, sbalení, zavření
  a CSS fullscreen. Návrat obnovuje sbalení, posun obsahu a rozbalení stop
  Mixéru; přehrávání ani pozice se při změně rozvržení nezahazují.
- V současné VZ2 Looper nebyl. Nový adaptér používá nativní HTML audio,
  existující timestampový modul, endpointy a offline úložiště. Waveform
  získává dekódováním audia, nabízí zoom, seek, hlasitost, smyčku a pasáže.
  Při nedostupném waveformu zůstává audio a časový posuvník použitelné.
  Stará aplikační logika ani legacy AJAX se nekopírují.
- `js/vz2.js`: samostatné „Otevřít“ u běžného audia, směrování Looperu,
  časové odkazy a přesunutí Mixéru mimo karty. Rozbalení karty samo
  žádný nástroj nespouští. Navigace při hraní nebo načítání vyžaduje
  potvrzení; odmítnutí zachová původní nástroj a přehrávání.
- Looper při ukončení ruší požadavek, timestampový adaptér, zdroj audia,
  blob URL a dekódovací kontext. Opožděný výsledek načítání neobnoví
  opuštěnou nahrávku. Mixér používá stávající `destroy` a životní cyklus
  svého audio jádra; `js/multitrack.js` se nemění.
- `css/vz2.css`: společný kompaktní vzhled, olivové Mute/Solo,
  vnitřní posouvání a fullscreen překrývající celý aplikační rámec.
- Nový `tests/vz2_player.browser.js`; aktualizované integrační,
  navigační a timestampové browser testy pro nové umístění Mixéru.

Backend, databáze, API, oprávnění ani synchronizační jádro Mixéru
se nemění. Nebyla přidána migrace ani Bootstrap komponenta.

## Ověření

- Celá integrační sada s `VZ2_TEST_BROWSER=1`: **187/187 PASS**.
  Běžela na dočasné kopii webu s oddělenou MariaDB na portu 33329;
  nepoužila produkční data. Diagnostika posledního běhu je v dočasném
  adresáři `vz2-integration-vz3HoR`.
- Nové browser scénáře: skutečný waveform, seek, sbalení/fullscreen,
  zachování přehrávání, odmítnuté i potvrzené přepnutí oběma směry,
  uvolnění zdrojů, zrušené načítání, časový odkaz po reloadu, timestampová
  pasáž, Mute/Solo a zavření do prázdné lišty.
- Zachyceny skutečné starty `AudioBufferSourceNode`: stopy Mixéru
  dostávají shodný čas startu a offset; přechod ukončuje původní zdroje.
- Šířky 360, 390, 767, 768, 1024, 1199, 1200, 1280, 1440 a 1920 px
  bez vodorovného přetečení stránky, včetně aktivního Looperu.
  Regrese rámce pokrývá také malou výšku a simulované zmenšení při klávesnici.
- Samostatné testy `multitrack_sample_rate.test.js`,
  `multitrack_browser_smoke.test.js` a `vz2_timestamps.test.js`: PASS.
- Syntaxe JavaScriptu, PHP lint a `git diff --check`: PASS.
- Vizuální kontrola screenshotů desktopového Looperu a Mixéru a mobilního
  fullscreen Looperu. Testováno v desktopovém Chromium s měněným viewportem;
  fyzický telefon a jeho systémová klávesnice nebyly ověřeny.

Etapa 4 zbývá: samostatná plocha Nápadů, mobilní dokončení a závěrečné
vizuální sjednocení. Commit etapy 3 čeká na schválení podle bodu 12 zadání.
