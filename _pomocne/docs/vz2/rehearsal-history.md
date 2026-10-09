# Historie zkoušení – nasazení a model

Historie používá výhradně katalog VZ2. `song_collection_id` a
`rehearsal_collection_id` jsou stabilní odkazy na `vz2_collections`; cesta ve
storage není součást identity. Jeden řádek `vz2_rehearsal_plays` je jedno
zahrání. Jeho zdrojem je buď propojená dvojice značek v dlouhé nahrávce, nebo
výstřižek, případně obojí. Cizí klíče jsou `RESTRICT`, takže odstranění audia
zachovávající zápis historii nepoškodí a úplné odstranění zdrojového SQL
záznamu nemůže proběhnout tiše.

## Bezpečný postup pro betu

1. Znovu ověřit větev, commit a čistý pracovní strom nasazovaného checkoutu.
2. Spustit existující `_pomocne/tools/vz2_preflight.php` pro beta konfiguraci a
   pořídit zálohu společné databáze i storage.
3. Na jediném DB spojení zkontrolovat `SELECT DATABASE()`, `SHOW CREATE TABLE
   vz2_collections`, `vz2_timestamps`, `vz2_recordings` a `users`.
4. Na betě ručně spustit `_pomocne/migrations/005_vz2_rehearsal_history.sql`.
   Aplikace migraci nikdy nespouští. Opakované spuštění nemá mazat ani převádět
   data. Pokud předchozí verze skončila na syntaxi cizího klíče chybou 1064,
   spusťte opravený soubor znovu celý: sloupec a index používají `IF NOT EXISTS`
   a cizí klíč se přidá podmíněně podle `information_schema`.
5. Ověřit přidání začátku/konce, export úseků, dvě zahrání v jedné buňce,
   připojení výstřižku, stavy `deleted` a `missing` a archivaci skladby.
6. Teprve po beta smoke testu nasadit stejné PHP/JS/CSS do alfy. Protože beta a
   alfa sdílejí data, SQL migraci podruhé není nutné provádět; její
   opakovatelnost je pouze bezpečnostní vlastnost.

## Oprávnění a audit

Čtení odpovídá dnešnímu přihlášenému VZ2. Zápis historie používá stejné právo
`comment` jako timestampy a není dostupný hostovi; úplné odebrání kolekce dál
smí jen admin. Odebrání zahrání maže pouze řádek historie a zapisuje audit.
Skladba s historií se při adminské mazací akci označí `archived`; její nahrávky
ani audio se touto archivací nemažou. V hlavním katalogu se archivovaná skladba
nezobrazuje, v historii se zobrazuje pod aktuálním, případně snapshotovaným
názvem.

## Záměrné hranice první verze

Výběr skladby ani výstřižku se nepřidává do uploadu nebo Looperu. Server audio
nestříhá a export neposkytuje Edison/CSV automatizaci. Obecný TXT export značek
zobrazuje čas jako `mm:ss`, stejně jako TXT export úseků. Neúplné značky
export úseků vypisuje odděleně. Export pro mp3splt zachovává přesné časy.


## Pracovní plochy a maximalizace

`#workspace-surfaces` obsahuje rovnocenné pracovní plochy označené
`data-workspace`. Plocha skladby obaluje původní `#content-area` se čtyřmi
panely, historie obsahuje matici; přehrávač a katalog jsou součástí společného
rámce mimo tuto vrstvu. `Vz2Layout.showWorkspace()` přepíná viditelnost bez
odstranění obsahu panelů a bez zásahu do přehrávání. Historie při návratu
aktualizuje data, ale zachovává filtry, orientaci a posunutí matice.

Maximalizaci řídí `Vz2Layout` pro panely, historii, Nápady i přehrávač.
Ikona je přímo v hlavičce; další kliknutí nebo Escape obnoví běžné rozložení.
Přehrávač přes `registerFullscreen()` navíc zachovává sbalení, posun waveformu
a rozbalení mixu. Maximalizovaný může být vždy pouze jeden panel.


Matice obsahuje v každé buňce jediný odznak s počtem pokusů odpovídajících
aktuálnímu filtru audia. Kliknutí otevře `#history-list` s kompaktním seznamem;
každá položka ukazuje značku začátku, zdrojový soubor, výstřižek a časový úsek.
Teprve výběr položky otevře `#history-detail` včetně přehrávačů. Zavření detailu
nebo tlačítko Zpět obnoví seznam. Přidávání je dostupné ze seznamu i u prázdné
buňky; host má u prázdné buňky pouze pomlčku. Propojený úsek a jeho výstřižek
se počítají jako jeden pokus.
