# Audit knihoven a načítaných souborů — 3. 10. 2026

## Rozsah a způsob kontroly

Statická kontrola aktuálního checkoutu: 92 vlastních provozních souborů PHP,
JavaScript, CSS a HTML (bez konfigurace s přihlašovacími údaji, uživatelských dat,
pomocných testů a zdrojů dodavatele getID3). Zkontrolovány vstupní stránky,
odkazy na styly a skripty, použití knihoven i HTML vracené AJAX endpointy.
U getID3 zkontrolován způsob zapojení a dokumentace dodané s knihovnou.

Jde o audit zdrojů, nikoli měření aktuálního provozního serveru. Údaje o gzip
jsou lokální výpočty; neověřují konfiguraci komprese na hostingu. Při auditu
nebyly změněny ani odstraněny provozní soubory.

## Co se skutečně načítá

| Část | Závislosti | Závěr |
| --- | --- | --- |
| Přihlášení (`php/loginbox4.php`) | Vlastní styly přímo v HTML, žádný JavaScript | Bez externích knihoven a dodatečných CSS souborů. |
| VZ2 (`vz2.php`) | 9 vlastních JS souborů, `css/vz2.css`, `css/multitrack.css`, Tabler Icons z CDN | Žádný jQuery, Bootstrap, Popper, WaveSurfer ani SortableJS. Jediná externí klientská knihovna je sada ikon. |
| Administrace (`admin.php`) | `css/help.css`, `css/admin.css` | Bez externích knihoven. Sdílený styl nápovědy dodává používané proměnné, hlavičku a rozložení. |
| Nápověda (`help.php`) | Tabler Icons, vlastní `help.css` a `help.js` | Ikony i JS se používají. Část JS pro hledání zůstala bez vstupního pole, ale navigace a obsluha vložené nápovědy zůstávají aktivní. |
| Stará zkušebna (starší větev `index.php`) | jQuery, Popper, Bootstrap CSS/JS, WaveSurfer + Regions + Zoom, idb-keyval, SortableJS, Tabler Icons | Knihovny mají konkrétní použití; nelze je prostě odebrat a zachovat starou aplikaci. |
| `multitrack.php` | Přesměrování do `index.php` | Sám nevykresluje stránku a nenačítá klientské knihovny. |
| `404.html`, `maintenance.html` | Vlastní vložené styly | Bez externích knihoven. |

`index.php:5–8` před vykreslením starého HTML přechází do VZ2 při `v=2`
nebo zapnutém `VZ2_ONLY`. Přítomnost starých CDN odkazů dále v souboru proto
neznamená, že se stahují při otevření VZ2. Aktuální nastavení produkčního
serveru tento audit neověřoval.

## Nejvýznamnější optimalizace: Tabler Icons

`vz2.php:113` načítá kompletní webfontovou sadu Tabler 3.19.0. Stejná sada je
ve staré zkušebně a nápovědě. Ikony jsou používané, ale sada je pro aplikaci
zbytečně široká. Dříve stažená místní kopie `tabler-icons.woff2` této verze má
864 648 bajtů (asi 865 kB); není to nově změřený přenos z produkce.

V souborech VZ2 bylo nalezeno 24 různých úplných literálů `ti-*`, další názvy
se skládají dynamicky, například v nabídce akcí nahrávky. Při nahrazení je
nutné zahrnout i tyto názvy, stavy přehrávání, fullscreen a ikony nápovědy.

Doporučení: nahradit celý font malou lokální sadou skutečně používaných SVG
ikon nebo vytvořit podmnožinu fontu. Pouhé přesunutí celého fontu z CDN na
server neodstraní jeho velikost. Úspora se projeví zejména při prvním načtení
bez cache. Na dokončení načítání ikon se v novém úvodním systému nečeká,
jejich přenos ale stále spotřebovává připojení.

## Souborové zbytky bez nalezeného provozního odkazu

| Soubor / sada | Velikost | Zjištění |
| --- | ---: | --- |
| `js/jquery-3.7.1.min.js` | 87 535 B | Lokální kopie není nikde připojena. Stará aplikace používá CDN variantu. |
| `fonts/glyphicons-halflings-regular.*` | 216 008 B celkem | Pět starých fontových souborů; žádný odkaz ani používání tříd Glyphicons ve vlastním provozním kódu. |
| `css/cover.css` | 1 145 B | Po úpravě loginu není odnikud načítán. |
| `js/vz2-permissions.js` | 2 165 B | Není připojen do stránky a žádný jiný provozní soubor nevolá `Vz2Permissions`. |

Tyto položky jsou kandidáti na úklid repozitáře a balíčku, nikoli zdroj
současného zpomalení prohlížeče. Celkem jde o 306 853 B. Závěr se vztahuje
na prohledaný checkout; neprokazuje, že na soubory neodkazuje jiná instalace.

## Další menší kandidáti

- `css/sticky-footer-navbar.css` (730 B) se stále načítá pouze ve staré
  větvi `index.php:179`. Stránka již nepoužívá jeho `.footer`; spodní
  navigace používá jiné třídy. Původní `body { margin-bottom: 60px }`
  přepisuje `css/main.css:18` na `margin: 0`. Zůstává obecné pravidlo pro
  `html`, takže před vyřazením ověřit rozložení staré verze.
- `css/multitrack.css` obsahuje pozůstatky samostatné multitrack stránky:
  `.multitrack-page`, `#mt-page`, `.mt-heading`, `.mt-kicker`. Její vstupní
  PHP nyní jen přesměrovává. Celý stylesheet ale obsahuje také potřebné
  styly mixéru a nelze jej odebrat z VZ2.
- `js/help.js` stále obsahuje obsluhu `help-search` a `search-status`,
  jejichž prvky v `help.php` nejsou. Skript má jen 2 446 B a zároveň
  aktivně obsluhuje navigaci a Escape ve vložené nápovědě, proto nejde
  o zbytečný celý soubor.
- `js/multitrack.js` (91 102 B; lokálně 19 480 B gzip) obsahuje i podporu
  starých jQuery modalů a uploadu. VZ2 používá samotný mixér, takže celý
  soubor není nadbytečný. Oddělení staré obsluhy nebo načtení mixéru až
  při otevření by vyžadovalo úpravu inicializace a testy přímých odkazů.

Všech devět skriptů načítaných VZ2 dohromady: 254 720 B bez komprese,
63 513 B při samostatné lokální gzip kompresi. Nejde o naměřené časy startu.

## Knihovny, které zachovat

- Stará aplikace: jQuery používá `js/main.js` pro události a AJAX;
  Bootstrap pro modální okna a rozbalování. Popper potřebuje dropdown
  nabídka z `php/ajax/ajax_nahravky.php:420`, i když není vidět přímo
  v hlavním HTML. Závislost dropdownu na Popper potvrzuje také
  [dokumentace Bootstrapu 4](https://getbootstrap.com/docs/4.0/getting-started/introduction/#js).
- WaveSurfer, Regions a Zoom se skutečně vytvářejí v `js/main.js:2615`
  a následujících řádcích. SortableJS řadí skladby (`js/main.js:2042`).
  idb-keyval obstarává offline soubory. Ve VZ2 jej nahrazuje vlastní
  1 426B adaptér `js/vz2-cache.js`; nejde o duplicitní CDN import.
- Serverová knihovna getID3 je používána v
  `php/inc/vz2_audio_metadata.php:15` pro MP3 a WAV. Načítá se až v rámci
  analýzy souboru, neposílá se návštěvníkovi a není zátěží počátečního
  stahování stránky. Dodaná sada je již omezená na čtecí moduly.

## Doporučené pořadí

1. Zmenšit Tabler na používané ikony pro skutečnou úsporu přenosu.
2. Uklidit neodkazované soubory uvedené výše.
3. Oddělit nepoužívané styly a případně obsluhu starého mixéru.
4. Teprve po rozhodnutí o úplném vyřazení staré aplikace odstranit její
   závislosti jako celek. VZ2 je už nyní nenačítá.
