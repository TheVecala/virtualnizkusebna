# Log vydání Zkušebny

U každého vydání evidujeme změny pro uživatele, změny databáze a skutečné datum a revizi nasazení pro alfu a betu.

## 25. 11. 2026 — Mapa skladby, Hraní a přehrávač

Vydání `c2e8557` bylo nasazeno nejdřív na betu a po ověření na alfu. Funkčnost obou prostředí potvrdil správce.

### Změny

- **Mapa skladby** má nový editor taktů, výpis detailů bez duplicit a samostatné nastavení velikosti a rozestupu ikon. Na řádku zůstává osm taktů.
- **Zápis poslechem** má osm tlačítek pro Hi-hat a Ride. Intro, sloku a refrén lze založit jedním klepnutím spolu s prvním taktem.
- **Hraní** přidává samostatné zobrazení skladeb a zkoušek, včetně mapy a detailů taktů.
- **Přehrávač** upravuje rychlé spouštění nahrávek, mobilní ovládání a rozložení Looperu.

### Databáze

Na společné databázi se převedlo 18 aktuálních a historických revizí z V1 na V2. Kontrola po převodu potvrdila 25 revizí V2 v 6 mapách. Převod zasáhl jen JSON map ve stávajícím sloupci. Historické značky F1–F4 se zachovaly a nedoložené metrum zůstalo neurčené. [Postup přechodu a návratu](docs/vz2/song-map-cutover.md)

### Nasazené revize

| Prostředí | Před vydáním | Po vydání |
| --- | --- | --- |
| Beta | `9edb1373` | `c2e8557` |
| Alfa | `24f1ea1` | `c2e8557` |
