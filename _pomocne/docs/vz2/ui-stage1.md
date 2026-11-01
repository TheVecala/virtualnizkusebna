# Kompaktní UI – audit a etapa 1

Výchozí stav ověřen: `feature/zobrazeni_VZ2.0`, HEAD
`79f7054cb6facded9b6d773874639bc1c43a5c59`, čistý pracovní strom.
Historická předloha `6ef87325` byla čtena pouze přes `git show`.

## Mapa změn

| Současný prvek | Cílové umístění | Soubory |
| --- | --- | --- |
| Hlavička a běžně rolovaná stránka | Kompaktní topbar, rámec vysoký jako viewport | `vz2.php`, `css/vz2.css` |
| Seznam kolekcí a trvalý formulář | Sidebar; pod 1200 px výběrový dialog; formulář v samostatném dialogu | `vz2.php`, `js/vz2.js`, `js/vz2-layout.js` |
| Katalog, přílohy, upload, nedokončené operace | Samostatně rolovaný panel Nahrávky | `vz2.php`, `js/vz2.js` |
| Text, tabulatura, diskuse v modalech | Tři obsahové panely s náhledem a současnými editory | `js/vz2-content.js`, `vz2.php` |
| Chybějící panelové preference VZ2 | Oddělené volby desktop/tablet/mobil; tabletový swap | `js/vz2-layout.js` |
| Mobilní navigace původní aplikace | Stejné obrázky a přiřazení v nové VZ2 | `vz2.php`, `css/vz2.css` |
| Deník a offline soubory pod katalogem | Rolované pomocné plochy se zavřením | `vz2.php`, `css/vz2.css` |

## Rozdíly proti předpokladům zadání

- VZ2 nepoužívá původní panelové rendery ani Looper. Text, tabulatura a
  diskuse mají funkční modální editory v `vz2-content.js`. Etapa 1 přidává
  náhledy nad stejnými API; editace, historie a řešení konfliktů zůstávají
  v současných editorech. Není přebíráno staré AJAXové řešení.
- Looper existuje pouze v legacy `index.php` / `main.js`. Ve třetí etapě
  bude nutné oddělit jeho UI/audio adaptér pro identifikátory VZ2; nestačí
  přesunout existující VZ2 komponentu. Zde se jeho jádro nekopíruje.
- Mixér je nyní vložen přímo do karty nahrávky. Takto zůstává do etapy 3.
- Mobilní postavičky jsou v aktuálním legacy `index.php`, nikoli `vz2.php`.
- VZ2 již nepoužívá Bootstrap. Nový rámec využívá nativní CSS, JS a dialog.
- Nápady zůstávají v této etapě ve stávajícím editoru; vlastní pracovní
  plocha je předmětem etapy 4.

Backend, migrace, oprávnění, endpointy a audio jádro jsou mimo tuto změnu.
Každá implementační etapa má být samostatně ověřena a její commit čeká
na odsouhlasení uživatelem podle dodaného zadání.

## Provedená etapa 1

- Rámec `100dvh` s fallbackem `100vh`, pevnou horní/spodní navigací
  v rámci flex layoutu a samostatně rolovanými panely.
- Desktop: 1–4 stejně široké panely v pevném pořadí; poslední nelze zavřít.
- Tablet: právě dva panely, volby v záhlaví, automatické prohození a
  zachování klávesnicového focusu v měněné polovině.
- Mobil: jeden panel, původní přiřazení šesti postaviček v navigaci.
- Tři oddělené preference v localStorage s prefixem aktuálního prostředí;
  neplatný nebo nedostupný storage obnoví výchozí volby.
- Sidebar na desktopu; stejný seznam přesunutý do nativního dialogu pod
  1200 px. Nová skladba/zkouška se vytváří samostatným dialogem.
- Pořadí kolekcí a operace nad vybranou kolekcí v menu `⋮`.
- Texty, tabulatury a diskuse mají bezpečně textově vykreslené náhledy;
  editory se otevírají z panelů. Po zavření editoru se náhledy obnoví.
- Deník a offline správa jsou dostupné z menu v horní liště a mají vlastní
  posouvání a tlačítko zavření.

Změněné aplikační soubory: `vz2.php`, `css/vz2.css`, `js/vz2.js`,
`js/vz2-content.js`; nový `js/vz2-layout.js`.
Změněné testy: `_pomocne/tests/vz2_content.browser.js`,
`_pomocne/tests/vz2_cutover.integration.js`, `_pomocne/tests/vz2_integration.test.js`;
nový `_pomocne/tests/vz2_layout.browser.js`. Nový tento audit/ověřovací dokument.

## Ověření 21. 9. 2026

- PHP lint `vz2.php`, JS syntaxe všech tří upravených aplikačních skriptů
  a `git diff --check`: bez chyb.
- `node _pomocne/tests/vz2_timestamps.test.js`: PASS.
- `node _pomocne/tests/multitrack_contract.test.js`: PASS, 45 DOM identifikátorů.
- `node _pomocne/tests/offline_audio_download_contract.test.js`: PASS.
- `node _pomocne/tests/vz2_integration.test.js` s `VZ2_TEST_BROWSER=1`: **179/179 PASS**.
  Běh používal soukromou dočasnou kopii aplikace, PHP, MariaDB 11.4.5 na
  vyhrazeném lokálním portu 33329 a headless Chromium/Edge; žádnou konfiguraci
  ani data běžícího webu. Testovací SQL migrace běžely pouze v dočasné DB;
  zdrojové migrace se nezměnily.
- Prohlížeč ověřil 360, 390, 767, 768, 1024, 1199, 1200, 1280, 1440 a
  1920 px: počty panelů, rovnoměrné šířky, absence horizontálního i
  vertikálního scrollu dokumentu, viditelnost mobilní navigace.
- Ověřeno oddělené posouvání, ukládání všech tří voleb přes reload a resize,
  prohazování na tabletu, blokace zavření posledního desktopového panelu,
  neplatné uložené hodnoty, mobilní vytváření kolekce a přesun sidebaru.
- Nízká výška a zmenšení viewportu na 390 × 300 px během vyplňování dialogu
  prošly. Fyzická mobilní klávesnice ani Safari nebyly tímto během ověřeny.
- Vizuálně prohlédnuté screenshoty: mobil 390 px, tablet 768 px, desktop
  1440 px. Karty jsou záměrně stále původně rozbalené; jejich kompaktní
  skládání patří do etapy 2.
- Regresní prohlížečové testy zachovaly kontroly konfliktů, historie,
  oprávnění, timestampů, smyček, navigace Mixéru, deep linků, přihlášení,
  odhlášení a administrace. Přizpůsobeny byly vstupní selektory novému UI.

Etapy 2–4 nejsou součástí tohoto commitu. Etapa 1 čeká na schválení commitu;
výchozí HEAD zůstává `79f7054c`.
