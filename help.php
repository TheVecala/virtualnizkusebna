<?php $embedded = ($_GET['embedded'] ?? '') === '1'; ?>
<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Kompletní nápověda k aplikaci Virtuální zkušebna.">
  <title>Nápověda · Virtuální zkušebna</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css">
  <link rel="stylesheet" href="css/help.css?v=<?= filemtime(__DIR__ . '/css/help.css') ?>">
  <script src="js/help.js?v=<?= filemtime(__DIR__ . '/js/help.js') ?>" defer></script>
</head>
<body<?= $embedded ? ' class="help-embedded"' : '' ?>>
  <a class="skip-link" href="#obsah">Přeskočit na obsah</a>
  <header class="help-header">
    <a class="help-brand" href="index.php"><span>ZKUŠEBNA</span><small>NÁPOVĚDA</small></a>
    <a class="back-link" href="index.php"><i class="ti ti-arrow-left" aria-hidden="true"></i> Zpět do zkušebny</a>
  </header>

 

  <div class="help-layout">
    <aside class="help-nav" aria-label="Obsah nápovědy">
      <strong>Na této stránce</strong>
      <nav>
        <a href="#zacatek" class="active">Začínáme</a>
        <a href="#skladby">Vály</a>
        <a href="#nahravky">Nahrávky</a>
        <a href="#looper">Looper</a>
        <a href="#multitracky">Multitracky</a>
        <a href="#materialy">Texty a tabulatury</a>
        <a href="#spoluprace">Spolupráce</a>
        <a href="#offline">Offline režim</a>
        <a href="#zarizeni">Mobil a tablet</a>
        <a href="#faq">Časté otázky</a>
      </nav>
      <div class="nav-tip"><i class="ti ti-bulb"></i><span><b>Tip</b> Nápovědu otevřeš kdykoli z horní nabídky. Nebuď kokot.</span></div>
    </aside>

    <main id="obsah" class="help-content">
      <h1 id="help-title" class="help-panel-title">Jak používat zkušebnu</h1>
      <div id="no-results" class="no-results" hidden><i class="ti ti-mood-empty"></i><h2>Nic jsme nenašli</h2><p>Zkuste kratší nebo obecnější výraz.</p></div>

      <section id="zacatek" class="help-section searchable">
        <div class="section-heading"><span class="section-icon"><i class="ti ti-rocket"></i></span><div><p>01</p><h2>Začínáme</h2></div></div>
        <p class="lead">Zkušebna drží na jednom místě vály, nahrávky, texty, tabulatury i domluvu kapely.</p>
        <div class="steps">
          <article><span>1</span><div><h3>Vyberte vál</h3><p>Vlevo klikněte na vál. Na telefonu otevřete seznam tlačítkem <b>Skladby</b> dole.</p></div></article>
          <article><span>2</span><div><h3>Otevřete panel</h3><p>Zvolte Nahrávky, Text, Tabelaturu, Diskusi nebo Nápady. Obsah se vždy vztahuje k právě vybranénu válu; Nápady jsou pro celou kapelu.</p></div></article>
          <article><span>3</span><div><h3>Začněte poslouchat</h3><p>Spusťte nahrávku běžným přehrávačem, nebo ji otevřete v looperu pro detailní práci s pasážemi.</p></div></article>
        </div>
        <div class="callout"><i class="ti ti-info-circle"></i><p><b>Nevidíte některé tlačítko aktivní?</b> Dostupné akce závisejí na vaší roli. Zamčené tlačítko označuje, že danou změnu může provést člen s vyšším oprávněním, tedy Vecala.</p></div>
      </section>

      <section id="skladby" class="help-section searchable">
        <div class="section-heading"><span class="section-icon"><i class="ti ti-playlist"></i></span><div><p>02</p><h2>Vály</h2></div></div>
        <div class="feature-grid">
          <article><i class="ti ti-square-rounded-plus"></i><h3>Novej vál</h3><p>Klikněte na <b>+ nová</b>, zadejte název a potvrďte. Vál dostane vlastní prostor pro všechny materiály.</p></article>
          <article><i class="ti ti-arrows-sort"></i><h3>Pořadí</h3><p>Vály můžete v seznamu přetáhnout. Nové pořadí se automaticky uloží celé kapele.</p></article>
          <article><i class="ti ti-pencil"></i><h3>Přejmenování</h3><p>Najeďte na vál a použijte ikonu tužky. Obsah válu zůstane zachován.</p></article>
          <article><i class="ti ti-trash"></i><h3>Smazání</h3><p>Ikona koše otevře potvrzení. Mazání je nevratné a odstraní také související soubory.</p></article>
        </div>
      </section>

      <section id="nahravky" class="help-section searchable">
        <div class="section-heading"><span class="section-icon"><i class="ti ti-music"></i></span><div><p>03</p><h2>Nahrávky</h2></div></div>
        <div class="split-copy"><div><h3>Nahrání souboru</h3><p>V panelu Nahrávky zvolte <b>vložit</b>, vyberte zvukový soubor a potvrďte. U nahrávky lze upravit popisek, přesunout ji do jiného válu nebo ji smazat.</p></div><div><h3>Rychlý záznam</h3><p>Tlačítko <b>REC</b>   zatím  nefunguje.</p></div></div>
        <div class="warning"><i class="ti ti-microphone"></i><p><b>Mikrofon nefunguje?</b> Zkontrolujte oprávnění webu v adresním řádku, správný vstup a to, zda mikrofon nepoužívá jiná aplikace.</p></div>
      </section>

      <section id="looper" class="help-section searchable">
        <div class="section-heading"><span class="section-icon"><i class="ti ti-repeat"></i></span><div><p>04</p><h2>Looper</h2></div></div>
        <p class="lead">Looper je pracovní přehrávač pro rozbor a přesné označování nahrávky.</p>
        <div class="looper-demo" aria-label="Přehled ovládání looperu">
          <div class="demo-wave"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
          <div class="demo-controls"><b><i class="ti ti-player-skip-back"></i><small>začátek</small></b><b><i class="ti ti-rewind-backward-5"></i><small>−5 s</small></b><b class="primary"><i class="ti ti-player-play-filled"></i><small>přehrát</small></b><b><i class="ti ti-rewind-forward-5"></i><small>+5 s</small></b><b><i class="ti ti-repeat"></i><small>smyčka</small></b></div>
        </div>
        <div class="feature-grid three">
          <article><h3>Výběr pasáže</h3><p>Tažením ve zvukové vlně označte úsek. Zapněte smyčku a vybraná část se bude opakovat.</p></article>
          <article><h3>Timestampy</h3><p>K přesnému času přidejte začátek válu, pasáž nebo poznámku. Záznam lze později upravit a exportovat.</p></article>
          <article><h3>Sdílení místa</h3><p>V nabídce looperu zvolte <b>Kopírovat odkaz</b>. Odkaz otevře stejnou nahrávku na aktuální pozici.</p></article>
          <article><h3>Přiblížení</h3><p>Tlačítky + a − zvětšete časovou osu a trefte přesný nástup nebo chybu.</p></article>
          <article><h3>Celá obrazovka</h3><p>V nabídce zapněte celou obrazovku pro více prostoru při práci se zvukovou vlnou.</p></article>
          <article><h3>Export</h3><p>Timestampy zkopírujte jako tabulku s vybranými typy, nebo stáhněte všechny do TXT.</p></article>
        </div>
      </section>

      <section id="multitracky" class="help-section searchable">
        <div class="section-heading"><span class="section-icon"><i class="ti ti-adjustments"></i></span><div><p>05</p><h2>Multitracky</h2></div></div>
        <p class="lead">Multitrack slouží ke společnému kontrolnímu poslechu jedné nebo více souběžných stop. Nahrávka může obsahovat celou zkoušku s více vály.</p>
        <div class="steps">
          <article><span>1</span><div><h3>Otevření nahrávky</h3><p>V horní liště klikněte na <b>Multitracky</b> a v panelu <b>Nahrávky</b> vyberte záznam. Běžné audio se pozastaví. Tlačítko <b>Zpět do zkušebny</b> vrátí předchozí pohled a pozastaví multitrack. Přepínač Skladby / Zkoušky patří k běžné zkušebně; multitracky mají vlastní seznam.</p></div></article>
          <article><span>2</span><div><h3>Vložení multitracku</h3><p>V panelu Nahrávky zvolte <b>vložit</b>, zadejte název, vyberte soubory a potvrďte <b>VLOŽIT SADU</b>. Stačí i jedna stopa. Celá sada musí mít stejný formát: WAV, FLAC nebo MP3. Stopy připravte se společným začátkem, aby při přehrávání seděly k sobě.</p></div></article>
          <article><span>3</span><div><h3>Přehrávání a mix</h3><p>Horní přehrávač ovládá všechny stopy společně: přehrát / pozastavit, na začátek, posun o 5 sekund a časovou osu. <b>Hlasitost</b> mění celkovou úroveň. U více stop otevřete <b>Rozbalit mix</b>: posuvníky mění hlasitosti stop, <b>S</b> nechá znít vybrané sólo stopy a <b>M</b> stopu ztlumí. U jedné stopy je k dispozici jen hlavní hlasitost.</p></div></article>
        </div>
        <h3>Panely při poslechu</h3>
        <div class="feature-grid">
          <article><i class="ti ti-list"></i><h3>Obsah a časové poznámky</h3><p>Obě tlačítka jsou v <b>Obsahu</b>: <b>+ Začátek skladby / pokusu</b> označí položku osnovy, <b>+ Poznámka v aktuálním čase</b> přidá postřeh. Čas se předvyplní podle přehrávače a lze ho upravit. Poznámky se řadí pod příslušné skladby, které můžete sbalit. Kliknutí na čas, například <b>12:35 — znovu nástup refrénu</b>, přeskočí na dané místo. Položky lze upravovat a mazat.</p></article>
          <article><i class="ti ti-file-text"></i><h3>Popis</h3><p>Samostatný panel obsahuje pouze společné shrnutí poslechu: co se hrálo, co se povedlo a co opravit příště. Změny potvrďte tlačítkem <b>Uložit shrnutí</b>.</p></article>
          <article><i class="ti ti-message-circle"></i><h3>Diskuse</h3><p>Příspěvky patří k právě vybranému multitracku. Hodí se pro domluvu nad celým záznamem. Připomínku ke konkrétnímu času přidejte do Obsahu.</p></article>
          <article><i class="ti ti-bulb"></i><h3>Nápady</h3><p>Jsou společné pro celou kapelu napříč skladbami, zkouškami i multitracky. Při přepnutí pohledu zůstane zachovaný i rozepsaný nápad.</p></article>
        </div>
        <p>Na počítači zapínejte panely horní lištou. Na telefonu je přepíná spodní menu <b>Nahrávky / Obsah / Popis / Diskuse / Nápady</b>. Na tabletu lze zvolit obsah pro levou a pravou polovinu zvlášť.</p>
        <div class="split-copy">
          <div><h3>Offline poslech</h3><p>Tlačítkem <b>Uložit pro offline poslech</b> uložíte všechny zdrojové stopy do tohoto prohlížeče. Počkejte na potvrzení kompletní sady. Před odpojením otevřete stránku a načtěte seznam; načtení seznamu a ukládání zápisů potřebují připojení. <b>Odebrat offline kopii</b> uvolní místo v zařízení a soubory na serveru zachová.</p></div>
          <div><h3>Odstranění audia a archiv</h3><p>V panelu Nahrávky zvolte <b>Odstranit audio, zachovat zápis</b>. Po potvrzení se stopy smažou ze serveru, ale Obsah, časové poznámky, Popis i Diskuse zůstanou u záznamu dostupné. Zápis lze dál upravovat; přehrávání a skoky na čas už nejsou aktivní. Offline kopie v prohlížečích se tím nemažou.</p></div>
        </div>
      </section>

      <section id="materialy" class="help-section searchable">
        <div class="section-heading"><span class="section-icon"><i class="ti ti-file-music"></i></span><div><p>06</p><h2>Texty a tabulatury</h2></div></div>
        <div class="split-copy"><div><h3>Text / akordy</h3><p>Panel Text slouží pro společný text válu a akordové značky. Tlačítkem <b>změnit</b> otevřete editor a změny uložte.</p></div><div><h3>Tabulatura</h3><p>Taby zapisujte jako prostý text. Používejte neproporcionální zarovnání a pomlčky, aby struny a takty zůstaly čitelné.</p></div></div>
      </section>

      <section id="spoluprace" class="help-section searchable">
        <div class="section-heading"><span class="section-icon"><i class="ti ti-users"></i></span><div><p>07</p><h2>Spolupráce</h2></div></div>
        <div class="feature-grid">
          <article><i class="ti ti-message-circle"></i><h3>Diskuse</h3><p>Patří k aktuálnímu válu, zkoušce nebo multitracku. Hodí se pro aranže, úkoly i domluvu před další zkouškou.</p></article>
          <article><i class="ti ti-bulb"></i><h3>Nápady</h3><p>Jsou viditelné celé kapele napříč vály, zkouškami i multitracky. Přidejte text a své jméno.</p></article>
          <article><i class="ti ti-link"></i><h3>Přímý odkaz</h3><p>Sdílejte konkrétní nahrávku a čas z looperu. Příjemce se po přihlášení dostane rovnou na místo.</p></article>
          <article><i class="ti ti-lock"></i><h3>Role a práva</h3><p>Úpravy, nahrávání a mazání mohou být omezené rolí. S požadavkem na změnu práv se obraťte na správce kapely.</p></article>
        </div>
      </section>

      <section id="offline" class="help-section searchable">
        <div class="section-heading"><span class="section-icon"><i class="ti ti-cloud-down"></i></span><div><p>08</p><h2>Offline nahrávky</h2></div></div>
        <ol class="number-list"><li><b>Otevřete nahrávku v looperu.</b><span>V jeho nabídce zvolte „Uložit pro offline“.</span></li><li><b>Počkejte na dokončení.</b><span>Nezavírejte stránku, dokud aplikace nepotvrdí uložení.</span></li><li><b>Spravujte úložiště.</b><span>V horní nabídce přes „smazat offline soubory“ odstraníte jednotlivé kopie nebo vše.</span></li></ol>
        <p>U <a href="#multitracky">Multitracků</a> použijte tlačítko <b>Uložit pro offline poslech</b> přímo v jejich přehrávači. Ukládá se celá sada stop.</p>
        <div class="callout"><i class="ti ti-device-mobile"></i><p>Offline kopie zůstává pouze v tomto prohlížeči a zařízení. Soukromý režim nebo vymazání dat webu ji může odstranit.</p></div>
      </section>

      <section id="zarizeni" class="help-section searchable">
        <div class="section-heading"><span class="section-icon"><i class="ti ti-devices"></i></span><div><p>09</p><h2>Mobil a tablet</h2></div></div>
        <div class="device-cards"><article><i class="ti ti-device-mobile"></i><div><h3>Telefon</h3><p>Spodní lišta přepíná vždy jeden panel. Seznam skladeb se vysune samostatně.</p></div></article><article><i class="ti ti-device-tablet"></i><div><h3>Tablet</h3><p>Dvě poloviny obrazovky můžete nezávisle přepínat — třeba nahrávky vlevo a text vpravo.</p></div></article><article><i class="ti ti-device-desktop"></i><div><h3>Počítač</h3><p>Panely se zobrazují vedle sebe a vály zůstávají dostupné v levém sloupci.</p></div></article></div>
      </section>

      <section id="faq" class="help-section searchable">
        <div class="section-heading"><span class="section-icon"><i class="ti ti-help"></i></span><div><p>10</p><h2>Časté otázky</h2></div></div>
        <div class="faq-list">
		  <details><summary>Jsem opravdu takový kokot?<i class="ti ti-chevron-down"></i></summary><p>Ano, ale dá se na tom pracovat.</p></details>
          <details><summary>Proč nemohu něco upravit nebo smazat?<i class="ti ti-chevron-down"></i></summary><p>Akce je omezená vaší uživatelskou rolí. Zamčené tlačítko se dá zobrazit, ale změnu musí provést oprávněný člen nebo správce. Nebo jsi kokot.</p></details>
          <details><summary>Proč se nahrávka nenačte?<i class="ti ti-chevron-down"></i></summary><p>Zkontrolujte připojení, obnovte stránku a zkuste soubor znovu. U velké nahrávky může vytvoření zvukové vlny chvíli trvat, jsi netrpělivý jako mladý kokot.</p></details>
          <details><summary>Kde najdu své offline soubory?<i class="ti ti-chevron-down"></i></summary><p>V horní nabídce klikněte na „smazat offline soubory“. Otevře se přehled uložených nahrávek včetně velikosti.</p></details>
          <details><summary>Co se stane po smazání skladby?<i class="ti ti-chevron-down"></i></summary><p>Smaže se vál i jeho uložené materiály. Tato operace je nevratná, proto potvrzení čtěte pečlivě a nebuďte kokot, co si něco důležitího smaže.</p></details>
          <details><summary>Jak pošlu spoluhráči přesné místo nahrávky?<i class="ti ti-chevron-down"></i></summary><p>Přesuňte looper na požadovaný čas, otevřete jeho nabídku, zvolte kopírování odkazu a odkaz odešlete.</p></details>
        </div>
      </section>
 
	   <a href="index.php" data-help-close><i class="ti ti-arrow-left"></i> Zpět do aplikace</a>
    </main>
  </div>
  <footer><span>Virtuální zkušebna</span><a href="#help-title">Nahoru <i class="ti ti-arrow-up"></i></a></footer>
</body>
</html>
