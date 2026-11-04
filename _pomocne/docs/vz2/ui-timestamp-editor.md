# Editor časových značek po migraci 009 — návrh A5

Uživatelem schválené rozmístění z 2. 11. 2026, cílová větev
`feature/uprava_UI_po_revizi`, základ `7950be5`.

## Chování

- Přidat značku otevírá společný editor s přímou volbou Pokus / Pasáž /
  Poznámka. Úpravy existujícího záznamu jeho typ nemění. Nespárované starší
  konce zachovávají dosavadní samostatný postup opravy.
- Telefon: obrazovka s pevnou hlavičkou, křivkou, ovládáním a spodním uložením;
  mezi nimi se posouvá formulář. Desktop: stejný editor ve vystředěném dialogu.
  Změny visualViewport při otevření klávesnice zmenšují dostupnou plochu,
  křivku i horní ovládání. Zavření se při změněných údajích ptá na zahození.
- Čas je přímo v křivce, délka vedle časové osy. Jediný řádek obsahuje
  −5 s, přehrát/pauza, +5 s, oddálit a přiblížit. Neobsahuje samostatné
  přehrání úseku ani opakování. Editor ovládá stejný zdroj jako jeho hostitel,
  sám nevytváří další audio přehrávač.
- Zoom se soustředí na aktuální přehrávací pozici; hranice smějí zmizet
  mimo záběr. Na krajích nahrávky se okno přiblížení omezí na její délku.
  Klepnutí do křivky posune přehrávání, tažení posouvá přiblížený výřez.
  Šipky na klávesnici posouvají o sekundu; Home/End na kraj nahrávky.
- Hranice mají společný řádek: čas začátku, Nastavit, čas konce, Nastavit,
  ikona jemného doladění. Nenastavený konec zobrazuje pomlčku. Nadpis editoru
  zůstává jen pro čtečky obrazovky; v hlavičce je název nahrávky a zavření.
- Nastavit zachytí aktuální pozici jako hranici. Klepnutí na čas hranice
  tam přesune přehrávač. Otevření a uložení samo o sobě přehrávání ani pozici
  nemění. Počáteční čas a dokončení otevřeného úseku se zachytí před načítáním
  seznamu. Změna textu neovlivní skryté milisekundy.
- Jemné doladění obsahuje kroky ±1 s, ±0,1 s a volitelné přesné časové pole.
  Neúplný úsek lze uložit bez konce. Neplatný rozsah se nesmí tiše opravit.
- Všechny čtyři nabídky editoru jsou vlastní (skladba, typ pasáže, rodičovský
  pokus a rozpracovaný úsek). Dlouhé seznamy mají vyhledávání a vlastní posun.
  Nabídka používá role listbox/option, šipky, Escape a návrat focusu; je ve
  vrstvě dialogu, aby ji neořízl posuv formuláře.
- Doplňující poznámku otevírá malé + vedle názvu. Vyplněná poznámka tlačítko
  zvýrazní. Samotná bodová poznámka má přímo pole Text a jediný čas.
- Pod názvem je malý rolovací přehled skutečně uložených timestampů. Nejde
  o další editor. Příslušnost pasáže určuje explicitní rodič, nikoli čas.
- Konflikt revizí zachová koncept a nabídne načtení aktuální verze a její
  výslovné převzetí. Chyba spojení zachová vyplněná pole.
- Úspěšné uložení nechá editor otevřený a zobrazí „Uloženo“. Další značka
  stejného typu začíná na aktuální pozici přehrávače, bez názvu, poznámky a konce.
  Skladba a typ pasáže zůstávají vybrané; rodič pasáže se určí podle nového času.
  Seznam značek se obnoví a další zápis použije novou revizi. To platí i po
  úpravě existující značky. Přehrávání a zoom pokračují beze změny; editor
  uživatel zavře křížkem.

## Zapojení

`js/vz2-timestamp-editor.js` zajišťuje společný formulář a zápisy přes existující
`Vz2TimestampStore`. `js/vz2-timestamp-controls.js` poskytuje vlastní nabídky,
časovou osu a ovládání hostitelského přehrávače. Vzhled je samostatně v
`css/vz2-timestamp-editor.css`, načítaném v `index.php` a `useky.php`.

Adaptéry karet, Looperu, Mixéru a Úseků doplňují přípravu, přehrát/pauzu,
stav přehrávání a zdroj křivky. Pro jednotlivé soubory se použijí lokální či
serverové peaks; chybějící křivku lze spočítat z audia získaného přes
`Vz2Downloads` a uložit do stávajícího lokálního úložiště. Mixér poskytuje
obálku již dekódovaných stop bez druhého stahování audia. Při nedostupné
křivce zůstávají časová osa i dostupné ovládání funkční. Zavření editoru ruší
jeho načítání a obsluhy, nikoliv přehrávání hostitele.

Backend, ID záznamů, oprávnění a databázové schéma se nemění. Nová SQL migrace
není potřeba. Pro nasazení musí být zahrnuty i nové JS/CSS soubory.

## Ověření

- `vz2_annotation_editor.browser.test.js`: zachycení před asynchronním načtením,
  sdílený transport, ukotvení zoomu, vlastní nabídky, poznámka, reference,
  přesnost, neplatné časy, konflikt, síťový výpadek, telefon/desktop,
  landscape a zmenšená plocha jako při klávesnici.
- `vz2_timestamps.browser.js` v integrační sadě `timestamp-intervals`:
  skutečné PHP/HTTP/izolovaná MariaDB, 26 kontrol včetně vazeb, konfliktů,
  mobilu, reálného Looperu a Mixéru, waveformu a samostatných Úseků.
- Samostatné sady poznámek, společných služeb, modelu, segmentů a exportů.

Vizuální snímky skutečného UI vznikají v `_pomocne/dist/ui-a5/`.
Mobilní kontroly běží v Chromium; fyzické iOS/Android zařízení není součástí
lokální automatizace. Na produkční hosting ani databázi se nesahá.
