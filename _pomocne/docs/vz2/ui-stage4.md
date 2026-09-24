# Kompaktní UI – etapa 4

Výchozí stav: větev `feature/zobrazeni_VZ2.0`, commit `ed9982e`
(`Etapa 3: společný Looper a Mixér`), čistý pracovní strom. Commit třetí
etapy vznikl po výslovném schválení uživatelem.

## Změny a soubory

- `vz2.php`: samostatná oblast Nápadů vedle běžné obsahové oblasti.
  Původní obrázky a přiřazení mobilních postaviček zůstávají zachované.
- `js/vz2-content.js`: editor globální diskuse se pro Nápady vykresluje
  do této oblasti. Používá stejné API, práva, revize příspěvků,
  porovnání konfliktů, stránkování a mazání jako dosud. Nápady nejsou
  dialogem ani pátým panelem. Návrat editor pouze skryje; rozepsaný text,
  otevřená úprava a porovnání zůstávají v paměti stránky. Reload je neukládá;
  při neuložené změně funguje ochrana před opuštěním stránky.
- `js/vz2-layout.js`: Nápady dočasně nahradí všechny obsahové panely.
  Návrat obnoví předchozí desktopovou množinu, tabletovou dvojici nebo
  mobilní panel. Samotné otevření Nápadů nepřepisuje lokální preference.
  Mobilní postavička označuje aktivní sekci. Menu lze zavřít kliknutím
  mimo ně nebo klávesou Escape; Escape vrátí focus na jejich tlačítko.
- `js/vz2-player.js`: při otevření Nápadů se aktivní nástroj sbalí,
  aniž by se zastavil nebo ztratil pozici. Návrat obnoví jeho předchozí
  sbalení, pokud jde stále o tentýž nástroj a nahrávku.
- `js/vz2.js`: navigace do jiné skladby, historie prohlížeče a vytvoření
  nové skladby vracejí běžnou pracovní plochu. Rozepsané Nápady zůstávají
  dostupné při opětovném otevření.
- `css/vz2.css`: vlastní posouvání Nápadů, zalamování dlouhých textů,
  kompaktní záhlaví a společné barvy. Na mobilu je vstup do Nápadů přes
  spodní postavičku; horní lišta tím získává místo pro název skladby.
  Formulářové vstupy mají 16px písmo a posuvníky dostatečnou výšku pro dotyk.
  Doplněno mapování barevných proměnných stávajících prvků Mixéru.
- `_pomocne/tests/vz2_ideas.browser.js`: nové scénáře pracovní plochy Nápadů.
  `_pomocne/tests/vz2_content.browser.js` kontroluje sdílení a práva Nápadů na novém
  místě; `_pomocne/tests/vz2_integration.test.js` zapojuje nové scénáře.

V upravovaném UI nejsou načítány Bootstrap komponenty ani jQuery;
dialogy a menu používají nativní HTML. Sdílený `multitrack.css` nadále
obsahuje také pravidla pro starou samostatnou stránku Mixéru; nesouvisející
legacy stránka se v této etapě nepřepisuje. Backend, API, databáze,
autentizace a zvukové jádro Mixéru jsou beze změny.

## Ověření

- Samostatný integrační běh s browser scénáři Nápadů: **152/152 PASS**.
- Nové scénáře ověřují zachování konceptu a panelových voleb, hrající
  Looper při vstupu a návratu, šířky 360, 390, 767, 768, 1024, 1199,
  1200, 1280, 1440 a 1920 px, vlastní posouvání, dlouhý text, mobilní
  navigaci, odeslání při výšce 320 px a zavírání menu. Zvlášť ověřují
  souběžnou editaci: konflikt zachová text i po návratu do panelů,
  explicitní přijetí revize dovolí uložit změnu a následně ji smazat.
- Vizuálně prohlédnut desktop 1440 × 900 a mobil 390 × 844 s Nápady,
  rozepsaným textem, dlouhým příspěvkem a sbaleným Looperem.
- JavaScript syntaxe, PHP lint a `git diff --check`: PASS.
- Závěrečná celá integrační sada s `VZ2_TEST_BROWSER=1`: **191/191 PASS**,
  včetně stávajících scénářů dokumentů, oprávnění, nahrávek, timestampů,
  navigace, synchronizace Mixéru, uvolnění audio zdrojů a všech nových
  scénářů Nápadů. Diagnostika a screenshoty jsou v dočasném adresáři
  `vz2-integration-SnENnx`.

Testy používají dočasnou kopii webu a izolovanou MariaDB na portu 33329;
produkční data se nepoužívají. Mobilní šířky a zmenšení viewportu byly
ověřeny v Chromium, nikoli na fyzickém telefonu se systémovou klávesnicí.

Commit etapy 4 čeká na samostatné schválení podle bodu 12 zadání.
