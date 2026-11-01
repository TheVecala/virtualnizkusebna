# Mapa skladby — implementační protokol

Schváleno: jedna Mapa na skladbu (collection_id, kind=song), JSON snapshoty ve
stávajících dokumentech kind=song_map. Mapa nahrazuje slot Tabulatura, čtyři panely.
Živá DB se nemění; migrace 004 je určena k ručnímu nasazení po živé kontrole a záloze.

## Etapa 1 — datový základ

- Výchozí HEAD `2d983a835e07e6a9b256116b9ca14efd90d70570`, feature/supertabelatura.
- Nový commit nevytvořen. Kontrola větve a HEAD před etapou beze změny.
- Nové soubory: migrace 004, php/inc/vz2_song_map.php, PHP validační a HTTP
  integrační testy. Upraveny vz2_content.php, jeho AJAX chyby, preflight a test runner.
- SQL: jediná změna ENUM druhů dokumentu. Žádná nová tabulka, žádná změna users,
  žádný převod ani přepis starých tabulatur. Provedeno pouze v izolované testovací DB.
- Sémantika: base/fill/crash/special/detail, schema_version=1, stabilní 32hex ID.
  Nejvýše 200 sekcí, 8192 taktů, detail 64 KiB, celý snapshot 1 MiB. Prázdná Mapa
  je platná po vymazání obsahu; prázdné sekce nikoli. Text detailu zůstává přesný.
- Mapy pouze na song; stejné právo edit_text, CSRF, transakce, audit a konflikt 409.
  Obnovený snapshot prochází validátorem a vytvoří novou verzi.
- Ověření: PHP lint; 33 validačních kontrol prošlo. HTTP/MariaDB regresní sada
  včetně nových mapových kontrol spuštěna na privátním localhost portu 33329.
- Nalezen místní runtime mimo PATH: PHP 8.5.10 a MariaDB 11.4.5. Implementace používá
  syntaxi PHP 8.1; tento místní běh není důkazem otestování na PHP 8.1 hostingu.
- První regresní běh odhalil původní testovací předpoklad „první dokument v DB“;
  po přidání mapového testu už neplatil. Fixture opravena na konkrétní rodičovské ID
  a druh dokumentu, žádná změna běhového mazání. Opakovaný běh následuje.

## Etapa 2 — zobrazení

- Výchozí HEAD opět `2d983a835e07e6a9b256116b9ca14efd90d70570`, stejná větev.
- Nový commit nevytvořen. DB beze změny nad rámec migrace 004.
- Přidán js/vz2-song-map.js, upraven shell, obsahové náhledy, layout a CSS.
- Mapa nahrazuje Tabulaturu ve stejném interním slotu; čtyři panely a uložené
  nastavení layoutu zachovány. Prosté tabulatury a jejich historie v DB zachovány.
- Čtení Mapy, prázdný stav a sekce, pevný rastr 8 s mezerou po čtvrtém; symboly
  odvozené z významu, kompaktní bez editační palety, čtecí dialog Detailu.
- Ověření syntaxe JS a diff whitespace; browser ověření navazuje v etapě 7.

## Etapa 3 — UPRAVIT

- Kontrola větve/HEAD: feature/supertabelatura, `2d983a835e07e6a9b256116b9ca14efd90d70570`.
- Nový commit ani další DB změna. Nový js/vz2-song-map-model.js a modelový test,
  rozšířen JS editor a načítání v shellu. Backend regresní sada prošla 150 kontrolami.
- Pracovní snapshoty s Undo; výběr/paleta, vložení ? před/za, odstranění taktu,
  přesuny uvnitř sekce, přesuny sekcí, pojmenování a samostatné duplikace s novými ID.
- Mazání sekce potvrzuje nativní dialog. Řazení dostupnými tlačítky, bez DnD,
  bez zásahu do mobilního scrollu. První sekce musí být zvolena, není automatické Intro.
- Automatické názvy Sloka/Refrén 1, další kopie 2 atd. Sekce vznikne až s taktem.

## Etapa 4 — Detail taktu

- Kontrola větve/HEAD beze změny; žádný commit ani DB změna.
- Rozšířen js/vz2-song-map.js: nativní Detail, prostý text, pracovní uložení bez verze,
  výběr více cílů pro kopírování a potvrzení přepisu neprázdných Detailů.
- Změny zdroje po kopírování neovlivňují cíle. Zápis poslechem otevírá čtecí Detail.
  V režimu MAPA lze Detail přímo upravit s právem edit_text; historickou verzi
  vytvoří až následné Uložit mapu. Náhled historie a host zůstávají jen pro čtení.
- Rozepsaný Detail má vlastní ochranu před zahozením; text se vykresluje jako text.
- Modelový test ověřuje nezávislost Detailů i sekcí; browser ověření navazuje.

## Etapa 5 — ZÁPIS POSLECHEM

- Kontrola větve/HEAD beze změny, stejný výchozí commit. Žádný commit ani DB změna.
- Upraven JS editor a CSS: paleta HH/RD Crash → groove → F1–F3, samostatné F4 a ?,
  rychlé sekce, upozaděná Pauza/Stop. Každé tlačítko přidá přesně jeden takt.
- Sekce je pouze čekající volba do prvního taktu; další volba ji nahradí bez objektu.
  Zpět odstraní poslední takt a jeho novou sekci, pokud byla jediná.
- Modelový test prošel pro čekající sekce, Undo hranice, samostatné kopie a ID.

## Etapa 6 — ukládání a verze

- Kontrola větve/HEAD beze změny. Žádný commit ani další DB změna.
- JS editor: explicitní Uložit mapu, Uloženo/Neuloženo, Historie mapy s autorem
  a lokálním časem, čtecí náhled verze a obnovení jako nová verze.
- Konflikt 409 ponechá pracovní snapshot a nabízí porovnání serverové verze;
  přijetí aktuální revize je explicitní, samo neukládá ani nemaže historii.
- Ochrana při navigaci mezi skladbami, historii URL, skrytí Mapy, otevření Nápadů,
  založení nového celku a odhlášení. Nativní dialog Zůstat/Zahodit změny; beforeunload
  používá systémové potvrzení prohlížeče. Během zápisu je editace zablokovaná.
- Backend HTTP testy už ověřily konflikty, snapshoty, historii a obnovu; frontend
  prochází navazující browser kontrolou. Bez autosave a bez mazání celé Mapy.

## Etapa 7 — mobil a integrace

- Výchozí HEAD po opakovaných kontrolách stále
  `2d983a835e07e6a9b256116b9ca14efd90d70570`, feature/supertabelatura.
- Nový commit nevytvořen; implementace je v pracovním stromu. Žádná další DB
  změna. Migrace 004 provedena jen v privátních místních testovacích DB.
- Doplněny styly režimů/palet/Detailu, browser test Mapy, integrační kontrola
  přejmenování skladby a mazání rodiče. Nasazovací postup je v
  `_pomocne/deploy/vz2-song-map/README.cs.md`.
- Ochrana rozepsaného Detailu zahrnuje i beforeunload. Obnovení katalogu nesmí
  nahradit neuloženou Mapu, ani při změně/odstranění jejího rodiče na serveru.
- Browser ověřil Mapu na šířkách 1440/1024/768/390/320 px: vždy 8 taktů na řádku,
  zvětšená mezera mezi čtvrtým a pátým, žádné vodorovné přetékání. Náhledy na
  320 a 1440 px vizuálně zkontrolovány. MAPA nemá paletu ani čísla taktů.
- Browser ověřil vytvoření bez výchozího Intro, jednoklikový zápis a čekající
  sekce, speciální takty, Undo, hranice vkládání, změny sémantiky, přesuny,
  kopie, Detaily, přepisové potvrzení, historii/obnovu, konflikt dvou editorů,
  zachování konceptu při online refreshi a čtecí režim hosta.
- Regresní testy upraveny na současné sbalené karty, skutečné názvy tlačítek a
  konkrétní katalogové/DB cíle. Zastaralé selektory byly příčinou prvních neúspěšných
  běhů; běhový kód přehrávačů ani časových značek se kvůli nim neměnil.
- Test rušení načítání odstraňuje pouze vlastní testovací audio z offline cache,
  aby skutečně zahájil síťové načítání; čekání má omezený čas. Test Nápadů zahrnuje
  současné mobilní okraje panelu a explicitně zavírá výběr skladby tlačítkem.
  Závěrečný cutover browser test používá současné potvrzení odhlášení.
- Samostatný PHP validační test: 33 kontrol PASS. JS modelový test PASS.
  PHP lint změněných běhových souborů a preflightu, JS syntaxe a diff whitespace PASS.
- HTTP/MariaDB bez browserů: původní uzavřený běh PASS 150 kontrol. Závěrečný
  společný běh s celou browser sadou PASS **199 kontrol**, exit code 0.
  Zahrnuje Mapu, původní obsah, timestampy, navigaci, layout, nahrávky, oba
  přehrávače, Nápady i cutover/rollback a odhlášení všech tří rolí.
  Diagnostika a snímky: `C:\Users\hanak\AppData\Local\Temp\vz2-integration-Kn4xzf`.
  Vlastní testovací DB runner po dokončení odstranil; živá DB zůstala nedotčená.

## Omezení před nasazením

Živé schéma a migrace na hostingu dosud nejsou ověřené/provedené. Lokálně se
testovalo na PHP 8.5.10, MariaDB 11.4.5 a Chromium; cílové PHP 8.1 je potřeba
zkontrolovat při nasazení. Nejsou přidané audio timestampy, metrum, synchronizace,
autosave, nové role, nový framework ani DnD mezi sekcemi.
