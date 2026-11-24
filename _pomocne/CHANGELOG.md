# Log vydání Zkušebny

U každého vydání evidujeme změny pro uživatele, změny databáze a skutečné datum a revizi nasazení pro alfu a betu.

## Připravované společné vydání

**Stav k 24. 11. 2026:** Příprava. Číslo a datum vydání doplníme při nasazení.

### Změny

- **Mapa skladby** má nový editor taktů, výpis detailů bez duplicit a samostatné nastavení velikosti a rozestupu ikon. Na řádku zůstává osm taktů.
- **Zápis poslechem** má osm tlačítek pro Hi-hat a Ride. Intro, sloku a refrén lze založit jedním klepnutím spolu s prvním taktem.
- **Hraní** přidává samostatné zobrazení skladeb a zkoušek, včetně mapy a detailů taktů.
- **Přehrávač** upravuje rychlé spouštění nahrávek, mobilní ovládání a rozložení Looperu.

### Databáze

Aktuální i historické revize map přejdou jednorázově z V1 na V2 během společné odstávky alfy a bety. Převod mění jen JSON map ve stávajícím sloupci. Historické značky F1–F4 se zachovají, nedoložené metrum zůstane neurčené. [Postup přechodu a návratu](docs/vz2/song-map-cutover.md)

### Výchozí revize

| Prostředí | Revize | Stav |
| --- | --- | --- |
| Alfa | `24f1ea1` | Potvrzená nasazená revize před přechodem. |
| Beta | `9edb137` | Výchozí revize bety z větve `feature/song-map-editor` po fázi 2. |

Migrační kód je připravený v commitu `758aeed`. Produkční přechod čeká na čtecí inventuru společné databáze.
