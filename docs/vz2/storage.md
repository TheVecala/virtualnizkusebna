# VZ2 – příprava chráněného úložiště na Blueboardu

Stav 19. 9. 2026: připraven kód, FTP balíček a lokální testy. Alfa i beta prošly
souborovou diagnostikou se stejnou cestou, datasetem a obsahem všech pěti sond;
na přímé subdoméně storage všech 15 HTTPS kontrol vrátilo 403.
**Provozní kontrola úložiště je uzavřena pro doložené současné směrování.** Uživatel
potvrdil oddělené složky ostatních domén a žádné jejich přístupy do tohoto úložiště.
Uživatel následně oznámil úspěšný import migrace 002 a doložil čtecí výsledek
`18810_virtualni_zkusebna | 13 | 2`. Základní kontrola importu tedy prošla.
Živý preflight následně prošel všemi 12 kontrolami na PHP 8.1.32 / MariaDB
11.4.12. Při preflightu byly zápisy false. Následně uživatel potvrdil úspěšné
vytvoření skladby, upload a přehrání po pokynu povolit zápisy pouze na betě.
Základní živý funkční test i úklid diagnostiky a testovací skladby jsou dokončené;
úklid potvrdil uživatel a všechny čtyři diagnostické URL nyní vracejí 404.
Po nahrání balíčku uživatel doložil chybu `Call to undefined function link()`.
Původní požadavek na hardlinky byl proto odstraněn; aktualizace diagnostiky obsahuje
dva PHP soubory a používá původní sondy i dataset marker.
Výchozí i výsledný HEAD: `0e7b92fc4d624bd11c7fd14f74c6bd6622204723`, větev
`feature/zkusebna2.0`. Při zahájení čistý strom; aktuální změny jsou necommitnuté.

## Zvolené řešení

Uživatel potvrdil Blueboard. Pro doložený společný veřejný root/open_basedir
`/data/www/18810/dusanovakapela_cz` je připraven nový adresář `_vz2_storage`
vedle `zkusebna` a `zkusebna_beta`. Nemění staré audio ani konfigurační soubory.
Adresář je uvnitř veřejného stromu, proto přímý přístup musí zakazovat webserver:

```apache
Require all denied
```

Šablona je `deploy/vz2-storage/apache.htaccess`. Umísťuje se **pouze** do nového
`_vz2_storage/.htaccess`, nikdy do společného rootu nebo instalací. Neobsahuje
podmínku IfModule, která by mohla zákaz při chybějícím modulu tiše vypnout.
Přílohy i audio se po aktivaci čtou jen přes přihlášený PHP endpoint VZ2.

Blueboard dokumentuje práci s `.htaccess` a direktivou Require; Apache dokumentuje
`Require all denied` a závislost `.htaccess` na povolení v konfiguraci serveru.
To je podklad pro šablonu, nikoli důkaz její účinnosti na této instalaci.
Viz [Blueboard – obsah z podsložky](https://hosting.blueboard.cz/napoveda/nacitani-obsahu-z-podslozky-pro-frameworky),
[Apache – Require](https://httpd.apache.org/docs/2.4/mod/mod_authz_core.html#require)
a [Apache – .htaccess](https://httpd.apache.org/docs/2.4/howto/htaccess.html).

## Postup pro uživatele bez SSH

Stručný návod je `deploy/vz2-storage/README.cs.md` a v ZIPu `CTI_PRVNI.txt`.

1. Rozbalit balíček; z `public` nahrát novou `_vz2_storage` a kontrolní TXT soubor
   do společné složky vedle alfy/bety. Přenést i skryté soubory. Pokud adresář již
   existuje, nejprve jej prohlédnout – nový balíček nesmí přepsat existující dataset.
2. `beta-tools/vz2_storage_probe.php` nahrát do `zkusebna_beta/tools/`.
   `beta-php-inc/vz2_file_io.php` nahrát do `zkusebna_beta/php/inc/`.
   Nevyžaduje ostatní nové VZ2 obsluhy ani migraci; používá tento souborový helper, stávající config a osobní
   přihlášení přes auth.php. V prohlížeči se přihlásit do bety jako admin, otevřít
   `/tools/vz2_storage_probe.php` a spustit kontrolu tlačítkem.
3. Poslat výsledek (root, dataset, stav kontrol nebo chybu). Žádná hesla ani DB údaje.
   Následuje vnější HTTP test a ověření skutečného směrování domén/aliasů.
4. Alfa je dle následného upřesnění na `6ef87325`, proto potřebuje níže popsaný
   adaptér `vz2_storage_probe_legacy.php`, nikoli přímé spuštění moderní diagnostiky.
   Musí přečíst stejný absolutní root, dataset a obsah sond. Tím se doloží přístup
   obou instalací ke stejným souborům; nejde o test souběžných operací obou webů.

Diagnostika je dostupná jen přihlášenému adminovi. GET nic nezapisuje; POST ověřuje
CSRF, přesný obsah sond a marker, vytvoří malý vlastní `.staging/check-<random>`
adresář, prověří kopírování s výhradním vytvořením cíle a konflikt dvou otevřených flock zámků.
Scratch soubory po sobě odstraní. Neprovádí DDL ani změny obsahových DB tabulek;
autentizace používá stávající databázi účtů. Nelze zadat libovolnou webovou cestu
k prozkoumání – webová obsluha používá výhradně navržený sousední `_vz2_storage`.

## Vnější HTTP test

Pro přípravu dalšího čistého balíčku (Node 18+, nový neexistující výstupní adresář):

```text
node tools/vz2_storage_http_check.js prepare C:\temp\vz2-probes
node tools/vz2_storage_http_check.js check C:\temp\vz2-probes\manifest.json https://OVERENY-VEREJNY-KOREN/ [DALSI-ALIASY]
```

Zástupnou adresu nahradit doloženým URL odpovídajícím společnému rootu.
Kontrolní TXT vedle storage musí vrátit HTTP 200 a přesný náhodný obsah z balíčku;
teprve potom se testuje pět skutečně existujících chráněných souborů: v rootu,
podsložce, pod `skladby` s příponou WAV, `.staging` a `.cache/peaks`.
Vždy GET, HEAD a GET s Range; očekává se 403 bez prozrazení obsahu sondy.

Tester neposílá session cookie ani autentizaci. Neignoruje TLS chyby, automaticky
nenásleduje přesměrování a za důkaz ochrany nepovažuje 404, 500, výpadek, login
stránku nebo chybějící kontrolní soubor. Záměrně přísný výsledek FAIL při přesměrování
znamená, že je potřeba doložit řetězec a otestovat konkrétní cílové URL; nikoli
vypnout existující HTTPS přesměrování. Seznam adres musí zahrnout HTTP/HTTPS,
www i další aliasy, které mohou storage obsloužit. Neznámé aliasy test sám neobjeví.

SITE_URL v checkoutu je `https://zkusebna_beta.dusanovakapela.cz`. Na Blueboardu
může podsložka odpovídat subdoméně a směrování závisí na pravidlech hostingu.
Nelze prostě předpokládat, že `/` této subdomény mapuje celý společný filesystem
root nebo že jedinou cestou je `/_vz2_storage/`. Pokud neprojde veřejná kontrola,
nejprve se doloží mapování v administraci/root .htaccess nebo u podpory Blueboardu.
Nezakládat kvůli testu veřejný alias na reálné audio a nevypínat ochranu storage.
Viz [Blueboard – alias subdomény](https://hosting.blueboard.cz/napoveda/jak-nastavit-alias-subdomen).

## Průběžné živé ověření 18. 9. 2026

Uživatel dodal výsledek opravené PHP diagnostiky na betě: `ok`, `read_write`,
`exclusive_copy` a `flock` jsou true; `link_available` je false, což nový postup
podporuje. PHP 8.1.32, pět sond, root
`/data/www/18810/dusanovakapela_cz/_vz2_storage`, dataset
`vz2-77d212fe03d7f048f909029c1023cc8ab49bbee48dcda5a4`.
Toto je uživatelem doložený výsledek bety; následné ověření alfy je zapsáno níže.

Agent spustil vnější checker proti `https://dusanovakapela.cz/`. Veřejný soubor
`vz2-control-77d212fe03d7f048f909029c1023cc8ab49bbee48dcda5a4.txt`
vrátil HTTP 404 bez přesměrování (potvrzeno i samostatným GET). Checker proto
nepokračoval k chráněným sondám. Nejde o důkaz účinného zákazu přístupu: nejprve
ověřit nahrání kontrolního souboru vedle storage a skutečné mapování URL na root.
Příznak `VZ2_STORAGE_HTTP_VERIFIED` zůstává false; migrace ani zapnutí VZ2 neproběhly.

Uživatel následně potvrdil, že veřejný kontrolní TXT je na FTP vedle `_vz2_storage`.
Stejný kontrolní soubor na `https://www.dusanovakapela.cz/` rovněž vrátil 404 bez
přesměrování; hlavní stránka `https://dusanovakapela.cz/` vrací 200. Samotná existence
souboru ve společném filesystem rootu tedy zatím nedokládá jeho veřejnou URL.
Další krok: přečíst existující `.htaccess` společného kořene a podle jeho pravidel
upřesnit směrování; bez změny pravidel nebo opakovaného nahrávání sond.

### Upřesnění směrování a přímý test subdomény

Uživatel dodal snímek FTP se zapnutými skrytými soubory: ve společném kořeni jsou
`www`, `zkusebna`, `zkusebna_beta`, `_vz2_storage` a veřejný kontrolní TXT;
`.htaccess` zde vidět není. Není potřeba jej tam vytvářet. Blueboard výslovně
[dokumentuje mapování složek na subdomény](https://hosting.blueboard.cz/napoveda/jak-vytvorit-subdomenu):
`www` obsluhuje hlavní doménu i www, sourozenecké složky vlastní subdomény.
Původní předpoklad, že hlavní doména vystavuje celý společný filesystem root, byl
tedy nesprávný. Kontrolní TXT vedle složek nemusí mít URL na hlavní doméně.

Agent provedl samostatný anonymní test přímo proti
`https://_vz2_storage.dusanovakapela.cz/`: všech pět existujících sond, každá GET,
HEAD a GET s Range `bytes=0-31`, vrátilo **403** bez obsahu markeru. Stejných
15 požadavků přes HTTP vrátilo **301** na totožnou cestu a query přes HTTPS;
cílové HTTPS požadavky byly ověřeny samostatně. TLS se ověřovalo, cookies ani
autentizace se neposílaly. Výsledný JSON má čas `2026-09-18T20:22:53.934Z` a je
uložen jako `vz2-blueboard-subdomain-http-results.json` v pracovních artefaktech.

Jde o dílčí úspěch přímé subdomény, nikoli PASS původního checkeru `check`, který
předpokládá veřejnou kontrolu a storage pod jedním společným URL kořenem. Ten se
pro toto směrování nesmí použít beze změny mapování. Veřejný kontrolní TXT lze
zkopírovat do `www` pro potvrzení hlavní domény; do chráněného storage se výjimka
pro veřejné soubory nepřidává. Dosud není doložena úplnost aliasů.
`VZ2_STORAGE_HTTP_VERIFIED` zůstává false.

## Diagnostika starší alfy (6ef87325)

Uživatel upřesnil alfa commit na `6ef87325c5ab5f5a793bf1fd8c213ba19d5d6a7d`.
Kontrola Git stromu potvrdila, že tato verze nemá `php/auth.php` ani nové funkce
`auth_refresh_session()` a `auth_require_admin()`. Původní pokyn nahrát a přímo
spustit moderní diagnostiku na alfě proto nebyl kompatibilní.

Samostatný dočasný vstup `tools/vz2_storage_probe_legacy.php` používá přesně
stávající session model alfy z `index.php` a `php/loginbox4.php`: vyžaduje
`logged_in_single === true` a roli `admin`. Host, muzikant, samotná role bez
přihlášení i anonym dostanou 403. Formulář má vlastní náhodný CSRF token v session;
kontrola souborů běží jen při platném POST. Adaptér nečte config ani hesla,
neotevírá DB, nenahrazuje přihlášení a neaktivuje VZ2. Sdílenou kontrolu načítá
z moderní diagnostiky jako funkci; její moderní webový vstup se přitom nespustí.

Na alfu nahrát ze samostatného balíčku `vz2-diagnostika-alfa-6ef87325.zip` pouze:

- `zkusebna/tools/vz2_storage_probe_legacy.php`
- `zkusebna/tools/vz2_storage_probe.php`
- `zkusebna/php/inc/vz2_file_io.php`

Přihlásit se původním administrátorským přihlášením a otevřít
`https://zkusebna.dusanovakapela.cz/tools/vz2_storage_probe_legacy.php`.
Po skončení odstranit z alfy oba diagnostické vstupy v `tools`.
Případný budoucí přechod alfy na VZ2 zůstává samostatným krokem po ověření bety.

Lokálně `tests/vz2_legacy_probe.test.js`: **13 PASS** přes skutečné HTTP/PHP,
bez moderního auth/config, se session údaji odpovídajícími staré alfě a s vypnutým
`link()`. Ověřeny role, chybějící/chybný/pole CSRF token, cizí session, úspěšný POST,
úklid a selhání při chybějící sondě. PHP syntax PASS. Jde o izolovanou simulaci
session a souborů, nikoli o živé přihlášení agenta na alfě.

### Výsledek z živé alfy – doložil uživatel 19. 9. 2026

Uživatel spustil adaptér a dodal úspěšný výsledek:

```json
{
  "ok": true,
  "root": "/data/www/18810/dusanovakapela_cz/_vz2_storage",
  "dataset": "vz2-77d212fe03d7f048f909029c1023cc8ab49bbee48dcda5a4",
  "probes": 5,
  "php": "8.1.32",
  "read_write": true,
  "exclusive_copy": true,
  "link_available": false,
  "flock": true
}
```

Výsledek se shoduje s betou. Obě instalace tedy samostatně ověřily tutéž absolutní
cestu, identitu datasetu a přesný obsah pěti sond; na obou prošel zápis, kopírování
bez přepsání a lokální konflikt flock zámků. Nejde o souběžný test jednoho zámku
mezi dvěma PHP požadavky z různých instalací. Starší aplikace na alfě zůstává
na svém commitu a k ověření nebyla převáděna na VZ2. Zbývá potvrzení dalších domén
a případných aliasů; do uzavření této kontroly se veřejná ochrana neoznačí za
kompletně ověřenou. Sondy zatím ponechat pro případné další HTTP kontroly.

## Uzavření rozsahu a navazující migrace – 19. 9. 2026

Uživatel upřesnil, že `virtualnizkusebna.cz` (nepoužívaná původní aplikace),
`vecala.cz` (pokusný osobní web) a `mezi3a5.cz` (další malé weby) mají na FTP
samostatné složky vedle `dusanovakapela_cz`; podle jeho potvrzení ani jejich
subdomény do tohoto úložiště nepřistupují. Nejde tedy o nahlášené aliasy storage.
Tyto samostatné weby agent netestoval; u `vecala.cz` to uživatel také výslovně
nepožaduje. Samotný společný hosting není důvod pro procházení všech jeho webů.

Závěr platí pro aktuálně doložené mapování: obsah sond z PHP ověřen na obou
instalacích (výsledky dodal uživatel), přímá storage subdoména ověřena agentem
anonymními GET/HEAD/Range požadavky. Úplnost rozsahu vychází z uživatelova
potvrzení oddělených webů, nikoli z přístupu agenta do konfigurace webserveru.
Při budoucím přidání aliasu nebo přesměrování do storage se HTTP test opakuje.

Podklady pro provozní příznak `VZ2_STORAGE_HTTP_VERIFIED=true` jsou tím pro tuto
instalaci připravené. Reálný config nebyl změněn; obecná distribuční šablona
správně nadále obsahuje false. Diagnostika nepřepnula alfu ani betu na VZ2.

Následuje jednorázová ruční migrace **celého** `migrations/002_vz2.sql` v databázi
`18810_virtualni_zkusebna`. Prázdná `18810_VZ2` se nepoužívá. Před importem musí
stále platit doložený výchozí stav bez `vz2_` tabulek; existující tabulky se nemažou
a migrace se nespouští opakovaně. Soubor na svém vlastním spojení nejprve nastaví
strict SQL a vypíše vybranou databázi a session režim, pak vytvoří 13 tabulek.
Neobsahuje DROP ani úpravy starých tabulek či převod obsahu. Při první chybě
zastavit a vyhodnotit vzniklé tabulky; neopakovat celý import naslepo.

Po importu ověřit:

```sql
SELECT DATABASE() AS selected_database;
SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND LEFT(TABLE_NAME, 4) = 'vz2_'
ORDER BY TABLE_NAME;
SELECT kind, revision FROM vz2_collection_orders ORDER BY kind;
```

Očekává se správná původní DB, 13 tabulek a dva řádky `song`/`rehearsal` s revizí 1.
Výpis režimu z importu má všechny tři požadované režimy; pozdější SQL okno může
otevřít nové spojení a vrátit výchozí režim hostingu, což výsledek importu nevyvrací.
Migrace sama aplikaci nezapne. Poté se nasadí aktuální změny pouze na betu a ověří
její vlastní DB spojení a konfigurace se zakázanými zápisy. Alfa zůstává původní.

### Výsledek ručního importu – hlášení uživatele

Po předání migračního souboru uživatel odpověděl „Příkaz proběhl v pořádku“.
Evidujeme to jako oznámený úspěšný import; agent živé SQL nespouštěl a neviděl
jeho úplný výstup. Migraci znovu nespouštět. Před zapnutím bety ověřit výsledný
stav tímto čtecím dotazem ve stejném vybraném databázovém schématu:

```sql
SELECT DATABASE() AS databaze,
  (SELECT COUNT(*) FROM information_schema.TABLES
   WHERE TABLE_SCHEMA = DATABASE() AND LEFT(TABLE_NAME, 4) = 'vz2_') AS pocet_tabulek,
  (SELECT COUNT(*) FROM vz2_collection_orders
   WHERE kind IN ('song', 'rehearsal') AND revision = 1) AS vychozi_poradi;
```

Očekává se `18810_virtualni_zkusebna`, `13`, `2`. Jde o základní kontrolu importu,
nikoli o úplnou revizi DDL nebo důkaz strict režimu nového aplikačního spojení.
Uživatel následně poslal přesně očekávané hodnoty `18810_virtualni_zkusebna | 13 | 2`.
Následuje nasazení aktuálního kódu a konfigurace pouze na betu s vypnutými zápisy
a ověření jejího vlastního spojení.

### Připravený balíček bety a webový preflight

`deploy/vz2-beta/README.cs.md` popisuje nasazení ve dvou krocích: nejprve runtime
soubory, nakonec samostatný `config.vz2.php` s `VZ2_ENABLED=true`,
`VZ2_WRITES_ENABLED=false`, prostředím beta, ověřenou cestou a datasetem.
Provozní `VZ2_STORAGE_HTTP_VERIFIED=true` vychází z výše uzavřeného ověření.
Původní config.php s DB údaji a SITE_URL se do balíčku nekopíruje ani nepřepisuje.
Konfigurace balíčku má strop jednoho souboru 500 MiB kvůli režii pod hostingovým
limitem celého POST 512 MiB; celá vícestopá sada stále podléhá tomuto souhrnnému
limitu. Obecná ukázková konfigurace v repozitáři se tím automaticky nezapíná.

`tools/vz2_preflight.php` nově podporuje také GET přes prohlížeč. Načítá skutečnou
konfiguraci aplikace, obnovuje aktuální roli z DB a dovolí výpis pouze modernímu
administrátorovi. POST odmítne 405. Host, muzikant i anonym dostanou 403 bez
diagnostických detailů. Odpověď JSON má no-store; nevypisuje DB hesla ani syrové
chyby připojení. CLI zůstává podporováno s návratovým kódem 0/1.

Kontrola ověřuje skutečné aplikační spojení a jeho session SQL mode, nastavení
CHECK, users.id a InnoDB, přesných 13 názvů tabulek a jejich InnoDB, oba druhy
pořadí a kladné revize, dostupnost storage, dataset a ochranný soubor. Počítání
tabulek samo o sobě již nestačí. Výpis zahrnuje konkrétní DB, root, dataset,
prostředí a příznak zápisů. HTTP blokaci ani všechny detaily DDL sám neprokazuje.

Lokální integrační sada po této změně: **56 PASS**, PHP 8.5.10 / MariaDB 11.4.5
s nestriktním defaultem a zakázanou funkcí link(). Nové scénáře pokrývají webová
oprávnění, čtecí režim, zákaz obsahového zápisu, chybné názvy při stejném počtu
tabulek, chybějící seed, špatný dataset a právě odebranou administrátorskou roli.
První běh odhalil cache měněné testovací konfigurace; fixture nyní výslovně vypíná
OPcache, aby změny mezi požadavky testovala okamžitě. Produkční OPcache se nemění.
Testovací databáze byla odstraněna a lokální DB server vypnut. Živý webový
preflight zatím čeká na upload.

Předaný artefakt: `vz2-beta-pouze-cteni-0e7b92fc.zip` v pracovních artefaktech.
Obsahuje 29 runtime souborů a jednu samostatně nahrávanou konfiguraci, návod
a manifest s SHA-256 a označením necommitnutých změn. Obsah ZIPu byl porovnán
s manifestem i zdroji; neobsahuje původní config.php, connect.php, SQL ani userdata.
Vygenerovaná konfigurace byla načtena lokálním PHP: enabled=true, writes=false,
environment=beta, správný dataset, http_verified=true, max_bytes=524288000.
Žádný soubor nebyl agentem nahrán na hosting ani přepsán v živé konfiguraci.

### První živý preflight bety – konfigurace ještě není aktivní

Uživatel následně spustil webový preflight: prošlo PHP 8.1.32 / 64 bit i rozšíření
mysqli/iconv, pak kontrola skončila hlášením „VZ2 zatím není zapnutá.“ a prázdnými
details. To znamená, že v tomto požadavku `VZ2_ENABLED` není přesně true;
z tohoto výstupu se ještě neověřilo aplikační SQL spojení ani storage konfigurace.
Neurčuje sám o sobě, zda chybí soubor, jeho načtení, nebo má jinou hodnotu.

Kontrola lokálního balíčku potvrdila enabled=true a writes=false. Proto je další
krok ověřit umístění `zkusebna_beta/config.vz2.php` a doplnit případné chybějící
načtení do zachovaného živého config.php, ještě před php/auth.php / prvním DB
spojením. Konkrétní krátký blok je v `deploy/vz2-beta/README.cs.md`. Celý soubor
s přístupovými údaji se nenahrazuje lokální kopií a SQL migrace se neopakuje.

Uživatel následně potvrdil, že načítací blok už v config.php je a obě části
nasazovacího ZIPu již byly nahrány. Jeho dotaz na nenahrané soubory se týkal
seznamu změn v pracovním stromu: dokumentace, testy a config.vz2.example.php
na hosting nepatří; runtime helper, storage a preflight původní ZIP obsahoval.
Není důvod požadovat opakovaný hromadný upload ani znovu vkládat načítací blok.

Preflight verze `2026-09-19.2` proto ještě před vz2_ready() zaznamená po ověření
administrátora skutečný app_root, existenci/čitelnost config.vz2.php, jeho načtení
podle get_included_files(), existenci a typ příznaku VZ2_ENABLED a efektivní
bool hodnoty zapnutí/zápisů. Nevypisuje obsah konfigurace ani hesla a soubor
sám nenačítá, aby nezakryl chybu bootstrapu aplikace. Tato pole zůstanou dostupná
i při hlášení „VZ2 zatím není zapnutá“. Nepřihlášeným se údaje nevydávají.

Lokální integrační sada: **60 PASS**, včetně čtyř nových scénářů konfigurace
(chybí soubor; existuje ale není načten; načten před auth; načten s enabled=false).
PHP lint a diff check PASS. K uploadu je pouze aktualizovaný tools/vz2_preflight.php
v samostatném balíčku `vz2-oprava-diagnostiky-konfigurace.zip`; žádné další změny
konfigurace se do získání jeho výstupu nepožadují. Původní velký ZIP zůstává
historickým artefaktem a novou verzi preflightu je nutné aplikovat jako tento doplněk.

Výsledek verze 2026-09-19.2 dodaný uživatelem: app_root je správně
`/data/www/18810/dusanovakapela_cz/zkusebna_beta`, config_vz2_exists=true,
config_vz2_readable=true, config_vz2_loaded=false, enabled_defined=false
a writes_defined=false. Potvrzuje to existující, ale nenačtený konfigurační soubor;
nejde o zjištěnou hodnotu enabled=false uvnitř načteného souboru. Proč stávající
blok nebyl vykonán, z těchto údajů samotných neplyne.

Další konkrétní oprava se týká pouze živého `zkusebna_beta/config.php`: přidat
hned za úvodní PHP tag, před ostatní vykonávaný kód, řádek
`require_once __DIR__ . '/config.vz2.php';`. Soubor je nyní doloženě přítomný
a čitelný. Případný dosavadní pozdější blok lze ponechat, require_once zabrání
druhému načtení. Zachovat ostatní konfiguraci a hesla, upravený soubor uložit
zpět na FTP bety a opakovat preflight. Konfigurace VZ2 nadále blokuje zápisy.
Po tomto pokynu uživatel dodal úspěšný výsledek uvedený níže.

### Úspěšný živý preflight – beta pouze pro čtení

Uživatel dodal výsledek verze `2026-09-19.2` s `ok=true` a všemi 12 kontrolami OK:

- PHP 8.1.32, 64 bit, mysqli a iconv; MariaDB 11.4.12-MariaDB-log.
- Skutečná DB `18810_virtualni_zkusebna` odpovídá konfiguraci.
- Aplikační session obsahuje `STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION`;
  globální default zůstává `NO_ENGINE_SUBSTITUTION`. CHECK je zapnutý.
- users.id je INT UNSIGNED PRIMARY KEY, users i všech 13 přesně pojmenovaných VZ2
  tabulek jsou InnoDB. Pořadí song/rehearsal mají revizi 1.
- `config.vz2.php` existuje, je čitelný a načtený; VZ2_ENABLED je boolean true.
- Root `/data/www/18810/dusanovakapela_cz/_vz2_storage`, dataset
  `vz2-77d212fe03d7f048f909029c1023cc8ab49bbee48dcda5a4`, režim `http-denied`.
  Kontrola vz2_root() přijala dataset a ochranný .htaccess.
- Prostředí beta; VZ2_WRITES_ENABLED je false.

Agent poté anonymně ověřil živé nasazení CSS/JS: css/vz2.css, css/multitrack.css,
js/vz2.js, js/vz2-cache.js a js/multitrack.js vracejí 200 a jejich SHA-256 přesně
odpovídá lokálním souborům. `index.php?v=2` vrací 200, obsahové API bez přihlášení
vrací 401. Toto není ověření interaktivního rozhraní pod přihlášeným uživatelem.

Serverová příprava bety pouze pro čtení je tím doložená. Další krok je povolit
zkušební zápisy pouze na betě změnou VZ2_WRITES_ENABLED na true v jejím novém
config.vz2.php a provést malý funkční test: vytvořit TEST VZ2, nahrát krátký WAV
jako běžnou nahrávku a ověřit přehrání. Připravený syntetický soubor
`vz2-test-2s.wav` má PCM 16 bit, mono, 44.1 kHz, 2 s, 176444 bytes.
Jde zatím o předaný další postup, nikoli o doložené povolení zápisů nebo upload.
Alfa zůstává na staré verzi. Po funkčním ověření zbývá cílený úklid diagnostiky
a testovacích sond podle zdejšího seznamu; ochranný .htaccess a dataset marker zůstávají.

### Úspěšný funkční test bety a dokončený úklid

Uživatel potvrdil: „vytvoření, nahrání a přehrání fungují.“ V návaznosti na předaný
postup to dokládá základní živý cyklus nové VZ2: založení skladby, zápis nahrávky
do nové evidence a chráněného úložiště, její načtení a přehrání. Provedl jej uživatel;
agent se na živém webu nepřihlašoval a tento výsledek není testem všech rolí,
vícestopého přehrávání, souběhu nebo všech podporovaných audio formátů.

Cílený úklid podle [cleanup-live.md](cleanup-live.md) zahrnoval: testovací
skladbu TEST VZ2 odstranit přes aplikaci jako celek, aby se neobešla SQL evidence
a deník; na FTP odstranit čtyři diagnostické PHP vstupy, veřejný kontrolní TXT,
pět sond a testovací manifest. Runtime helper, .htaccess a dataset marker zůstávají.
Uživatel potvrdil dokončení slovem „uklizeno“ a uvedl, že tools neměly další obsah.
Agent potom provedl anonymní GET bez přesměrování na všechny čtyři diagnostické
adresy: alfa/tools/vz2_storage_probe_legacy.php, alfa/tools/vz2_storage_probe.php,
beta/tools/vz2_storage_probe.php a beta/tools/vz2_preflight.php. Všechny vrátily
404. Smazání sond a testovací skladby je doložené uživatelem, nikoli přímou
inspekcí FTP nebo databáze agentem. Prázdné tools mohou zůstat.

## Uzavření této fáze a návaznost

Příprava hostingu, sdíleného chráněného storage, migrace a základního živého
ověření bety včetně úklidu je uzavřena. Neznamená to dokončení dalších funkčních
etap nebo přepnutí alfy. Současná beta má VZ2 tabulky a nový izolovaný obsah,
alfa zůstává na staré aplikaci. Žádná další SQL migrace se nyní neopakuje.

Na konci této fáze: větev `feature/zkusebna2.0`, výchozí i výsledný HEAD
`0e7b92fc4d624bd11c7fd14f74c6bd6622204723`. Změny uvedené na konci dokumentu
zůstávají necommitnuté; agent nevytvořil commit ani push. Lokální ověření poslední
verze: VZ2 integrace **60 PASS**, samostatný storage test **28 PASS**, adaptér
starší alfy **13 PASS**; živé výsledky a jejich zdroje jsou uvedeny výše.

Návazná funkční etapa dle schváleného návrhu je **3 – společné SQL timestampy**:
CRUD pro běžný přehrávač i Mixér, autorství/práva/deník ve stejných transakcích,
ochrana souběžných změn pomocí revizí a HTTP 409, typy začátek skladby/pasáž/poznámka,
odvozené intervaly smyček a TXT export i po odstranění audia. Konkrétní hranice
jsou v [design.md, oddíly 4 a 8–10](design.md). Tabulka vz2_timestamps již existuje;
nevytvářet druhý katalog ani neopakovat migraci 002. Další práce musí vyjít ze
znovu ověřeného HEAD a zachovat nynější necommitnuté změny; tato fáze zatím
timestampové zápisy neimplementovala. Texty, historie a diskuse zůstávají etapou 4.

## Nové podmínky konfigurace

`config.vz2.example.php` nyní rozlišuje společný veřejný root a vlastní storage:

```php
define('VZ2_PUBLIC_ROOT', '/data/www/18810/dusanovakapela_cz');
define('VZ2_STORAGE_ROOT', '/data/www/18810/dusanovakapela_cz/_vz2_storage');
define('VZ2_STORAGE_ACCESS', 'http-denied');
define('VZ2_STORAGE_HTTP_VERIFIED', false);
```

Dataset v soukromé konfiguraci musí přesně odpovídat `.vz2-storage-id` balíčku.
Příklad má počet souborů snížený na hostingových 20. Limit celého POST 512M platí
nadále a neslibuje 20 souborů po 512M; limity plného provozu zůstávají v předání.

`vz2_root()` odmítne chybějící veřejný root, neznámý režim, nesprávný marker i
veřejnou cestu vydávanou za `private`. Režim `private` zůstává pro skutečné úložiště
mimo veřejný root (např. izolované testy); open_basedir musí takovou cestu povolovat.
Režim `http-denied` vyžaduje uložiště uvnitř společného rootu, mimo vlastní aplikaci,
výslovně pravdivé potvrzení testu a čitelný nesymlinkový `.htaccess`, jehož jediné
aktivní pravidlo je `Require all denied`. Zmizelé nebo změněné pravidlo zastaví
přístup aplikace. Šablonu lze opatřit komentáři, ne dalšími aktivními pravidly.

`VZ2_STORAGE_HTTP_VERIFIED` je **provozní prohlášení správce**, ne automatický důkaz
ani průběžný monitor. PHP neumí tímto příznakem zajistit, že webserver `.htaccess`
opravdu respektuje. Po změně hostingu, aliasů, nadřazených pravidel nebo rootu
opakovat test a do ověření ponechat VZ2 vypnutou. I zablokované PHP nemůže zastavit
přímé statické stahování při porušeném nastavení webserveru.

Až po obou kontrolách a evidenci všech adres nastavit potvrzení na true. Zapnutí
VZ2 zápisů je další krok po ruční migraci do `18810_virtualni_zkusebna` a preflightu;
nová DB `18810_VZ2` se nepoužívá. Aplikace migraci SQL sama nespouští.

## Uložení souborů bez link()

Sdílený helper `php/inc/vz2_file_io.php` používá `fopen(..., 'xb')`, streamované
kopírování, flush (a fsync, pokud je dostupné) a ověření SHA-256. Nepoužívá `link()`
ani přepisující rename. SQL drží soubory pending, dokud není dokončená celá sada;
přes PHP se částečná kopie nezpřístupní. Staging se odstraní až po ověření kopie.
Je potřeba místo navíc pro kopii právě zpracovávaného souboru, které původní hardlink
nepotřeboval; řídit se hostingovou kvótou. Kopírování je streamované, nečte celé audio do RAM.

Při zachycené chybě helper uklidí pouze cíl, který tento běh sám výhradně vytvořil.
Existující cíl nikdy nezkracuje ani nepřepisuje. Shodný hash znamená dokončenou kopii
a retry může pokračovat i po dřívějším odstranění stagingu. Odlišný obsah v cíli je
konflikt 409. Po tvrdém ukončení PHP uprostřed kopírování tedy může zůstat částečný
cíl: staging zůstává, operace není dokončená a retry odmítne cíl přepsat. Správce musí
při zastavené operaci ověřit její ID, přesné cesty a správný staging podle hashe,
přesunout konkrétní částečný cíl do karantény a potom operaci zopakovat. Neprovádí se
automatické mazání potenciálně cizího kolidujícího souboru ani plošný úklid.

## Úklid po ověření (konkrétní diagnostika)

Z obou webů odstranit diagnostický `tools/vz2_storage_probe.php`, z alfy také
`tools/vz2_storage_probe_legacy.php`. Podle manifestu
odstranit pouze konkrétní kontrolní TXT a pět sond, pak `.vz2-probe.json`.
**Ponechat `.htaccess` a `.vz2-storage-id`.** Nespouštět plošné mazání `.staging`
či `.cache`, které mohou později obsahovat rozpracované skutečné operace.

## Lokální výsledek a změněné soubory

- `tests/vz2_storage.test.js`: **28 PASS** – rozlišení kořenů, povinné potvrzení,
  zmizelé/změněné pravidlo, dataset, PHP copy/flock/úklid s `link()` zakázanou,
  kolize bez přepsání, retry dokončené kopie a odmítnutí částečného cíle; HTTP checker
  proti řízenému lokálnímu serveru odmítl 200, Range 206, HEAD 200, 404, 500,
  přesměrování, chybnou veřejnou kontrolu i prozrazení obsahu při statusu 403.
- `tests/vz2_integration.test.js`: poslední běh **60 PASS** – obsahové scénáře,
  autentizace/CSRF diagnostiky a webový preflight včetně stavu konfigurace,
  přesných tabulek, seedů, čtecího režimu a změny role. PHP 8.5.10 / MariaDB 11.4.5 na vyhrazeném
  localhost serveru s nestriktním defaultem a `disable_functions=link` v HTTP PHP.
  Testovací DB po běhu odstraněna.
- PHP/JS syntax a diff check. Živý Apache/Blueboard tímto nebyl testován;
  lokální HTTP server pouze ověřuje chování našeho testovacího nástroje.

Upravené soubory: `config.vz2.example.php`, `php/inc/vz2_storage.php`,
`tools/vz2_preflight.php`, `tests/vz2_integration.test.js`, `docs/vz2/stage2.md`,
`docs/vz2/hosting-verification.md`.
Nové: `deploy/vz2-storage/apache.htaccess`, `deploy/vz2-storage/README.cs.md`,
`tools/vz2_storage_probe.php`, `tools/vz2_storage_http_check.js`,
`tools/vz2_storage_probe_legacy.php`, `tests/vz2_legacy_probe.test.js`,
`tests/vz2_storage.test.js`, `php/inc/vz2_file_io.php`,
`deploy/vz2-beta/README.cs.md`, `docs/vz2/cleanup-live.md` a tento dokument.
Bez automatického commitu/pushe.
