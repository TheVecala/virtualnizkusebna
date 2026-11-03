# VZ2.1.1 — popisek, tempo a takt celé skladby

## Chování

- Údaje patří celé skladbě, nezávisle na nahrávkách, mapě a timestampech.
- Pod názvem jsou všechna tempa a takty, vedle nich tužka pro společnou úpravu.
  Nevyplněná skladba nabízí pouze `+ Popisek` oprávněným uživatelům.
- Na desktopu zůstává výběr skladby pouze v levém katalogu. Nad panely jsou
  jen údaje skladby; výběr nad nimi je viditelný na mobilu a tabletu.
- Popisek zobrazuje dva řádky s možností rozbalení. Text je prostý, bez HTML.
- Tempo podporuje pořadí i opakování: `120 / 132,5 / 120`. Povolen je rozsah
  1–999 BPM a nejvýše dvě desetinná místa. Hodnoty odděluje lomítko.
- Takty lze vybrat z vlastní nabídky nebo napsat: `4/4 + 3/4 + 4/4`.
  Čitatel 1–32, jmenovatel 1, 2, 4, 8, 16, 32 nebo 64. Každý seznam má
  nejvýše 32 hodnot; podrobnosti průběhu patří do popisku (nejvýše 10 000 znaků).
- V katalogu skladeb jsou drobná čísla BPM, bez taktu a popisku.
- Kompaktní přehled má předvolby viditelné ihned. `Popisky skladeb` zobrazí
  všechny vyplněné údaje; `Vlastní výběr` je při otevření stránky sbalený.
  Předvolba zachovává výběr konkrétních položek. Ruční změna označí stav `Vlastní`.
  Samotné přepnutí předvolby nenačítá server; data načte `Vytvořit výpis`.
- Práva jsou stejná jako při úpravě názvu skladby: admin, nebo vlastník
  s oprávněním `rename_val`. Host má pouze čtení. API kontroluje CSRF a revizi
  celku. Konflikt umožňuje porovnání a výslovné převzetí nové revize bez ztráty
  konceptu. Změna se zapisuje do deníku jako `song.details_updated`.

## Databáze a nasazení na alfu

Použít `_pomocne/migrations/010_vz2_song_details.sql` po migracích 001–009.
Přidává tři nepovinné sloupce do `vz2_collections`: `song_description` (TEXT),
`song_tempos` a `song_meters` (JSON pole). Existující řádky začínají s NULL;
API je vrací jako prázdný text a prázdné seznamy. Počet tabulek se nemění.
SQL lze opakovat; neobsahuje UPDATE ani přepis dat. Migrace se nespouští z webu.

1. Zálohovat společnou DB a aktuální soubory/config alfy. Ověřit stav migrací
   v cílové DB, zejména 009; číslo verze webu samo o sobě stav DB nedokládá.
2. V servisním okně spustit 010 **jednou nad společnou DB**, před nahráním nové
   aplikace. Alfa a beta nad stejnou DB nepotřebují dvě samostatné migrace.
3. Nahrát obsah `1_soubory/` úplného balíčku. SQL a návody z `2_migrace/`
   nepatří do veřejného webu. Zachovat serverový `config.php` včetně připojení
   a SITE_URL; v dodaném `config.vz2.php` změnit VZ2_ENVIRONMENT na `alpha`
   před vypnutím maintenance. Cesty a dataset zůstávají stejné.
4. Ověřit přihlášení, zobrazení/přidání/úpravu údajů skladby, BPM v katalogu,
   předvolbu Popisky skladeb, původní přehledy a ukládání timestampů.
   Preflight nově kontroluje sloupce migrace 010.
5. Uschovat manifest a zaznamenat ruční změnu prostředí. Migrační SQL zůstává
   při případném návratu k předchozí verzi aplikace: nové sloupce nemažte,
   obsahují uživatelské údaje a předchozímu kódu nepřekážejí.

Balíček sestavuje `_pomocne/tools/vz2_release.js`, včetně samostatného SQL
010, tohoto návodu a SHA-256 v manifestu. Označení VZ2.1.1 je označením této
verze balíčku, nikoli tvrzením o již provedeném nasazení na hosting.

## Ověření

- `VZ2_TEST_SUITE=song-details`: izolovaná MariaDB + skutečné HTTP/PHP,
  migrace opakovaná nad vyplněnými daty, validace, práva, konflikty, mazání
  nepovinných hodnot, katalog, deník a Kompaktní přehled.
- Stejná sada obsahuje Chromium: mobil 320/390 a desktop, nabídka taktů,
  rozbalení popisku, BPM v katalogu, síťová chyba, porovnání revizí,
  předvolby, vlastní výběr, bezpečné zobrazení textu a čtení hostem.
- `VZ2_TEST_SUITE=overview VZ2_TEST_BROWSER=overview`: stávající přehledy,
  předvolby, mapy, intervaly a rozložení.
- `VZ2_TEST_SUITE=timestamp-intervals VZ2_TEST_BROWSER=timestamps`: migrace
  010 a nový katalog nesmí ovlivnit ukládání značek a přehrávače.
