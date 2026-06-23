<?php
session_start();
error_reporting(0);

if (empty($_SESSION['role'])) { echo ''; exit; }

$kapela            = $_SESSION['kapela']                     ?? "";
$befelemepesseveze = $_SESSION['befelemepesseveze']          ?? "";
$slozka_souboru    = $_SESSION['slozka_souboru_k_zobrazeni'] ?? "";
$sekce             = "uploads";

$cesta_slozky = "../../user/" . $kapela . "/" . $befelemepesseveze . "/" . $sekce . "/" . $slozka_souboru . "/";

$povolene_audio = ['mp3', 'wav', 'ogg', 'flac', 'aac'];
$povolene_vse   = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'pdf', 'txt', 'jpg', 'jpeg', 'png', 'gif'];

$soubory = [];
if (!empty($slozka_souboru) && is_dir($cesta_slozky)) {
    foreach (scandir($cesta_slozky) as $f) {
        if ($f === "." || $f === ".." || is_dir($cesta_slozky . $f)) continue;
        if ($f === "." || substr($f, 0, 1) === ".") continue;
        $soubory[] = $f;
    }
}

$barva = $_SESSION['barva1'] ?? "a7ac38";
?>

<style>
/* Jednotný styl pro řádek nahrávky */
.nahravka-box {
  background: #25292e;
  border: 1px solid #3a3e44;
  border-radius: 6px;
  margin-bottom: 8px;
  padding: 10px 12px;
}

/* Hlavní viditelný řádek: Název + Jedno tlačítko */
.nahravka-hlavni {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

/* Zajištění, že se dlouhý název souboru nikdy nezalomí a elegantně se zkrátí */
.nahravka-nazev {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
  color: #e0e0e0;
}

/* Styling pro velké otočné šipkové tlačítko */
.btn-nastaveni {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 26px; /* Extra velké a dobře viditelné */
  line-height: 1;
  cursor: pointer;
  outline: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
  
  /* Plynulá animace otočení a změny barvy */
  transition: transform 0.25s ease-in-out, color 0.15s;
  
  /* Výchozí stav: ROZBALENO (šipka míří nahoru) */
  transform: rotate(180deg); 
}

.btn-nastaveni:focus, .btn-nastaveni:active {
  outline: none;
}

/* Stav: ZABALENO / SKRYTO (šipka se otočí dolů) */
.btn-nastaveni.collapsed {
  transform: rotate(0deg); 
}

/* Zvýraznění při najetí myší */
.btn-nastaveni:hover {
  color: var(--barva);
}


/* Výsuvná plocha (panel pod názvem) */
.nahravka-vysuvna {
  margin-top: 10px;
  border-top: 1px solid #34383e;
  padding-top: 10px;
}

/* NOVÉ: Flexbox kontejner pro roztažení tlačítek po celé šířce */
.vysuvna-tlacitka {
  display: flex;
  gap: 6px;
  width: 100%;
  margin-top: 10px;
}

/* Automaticky rozdělí šířku roletky rovnoměrně mezi všechny potomky (button i odkaz) */
.vysuvna-tlacitka > button,
.vysuvna-tlacitka > a {
  flex: 1;
  min-width: 0;
}

/* UNIVERZÁLNÍ TEXTOVÉ TLAČÍTKO */
.fbtn {
  background: #2a3a10 !important;
  color: #<?php echo $barva; ?> !important;
  border: 1px solid #<?php echo $barva; ?> !important;
  border-radius: 5px;
  width: 100%; /* Vyplní celou šířku přidělenou flexboxem (důležité uvnitř tagu <a>) */
  
  /* Výška se nyní plně přizpůsobuje velikosti písma a paddingu */
  padding: 8px 2px; 
  font-size: 11px; /* Kompaktní velikost, aby se nápisy vešly i na menší mobily */
  font-weight: bold;
  text-transform: uppercase; /* Jednotný vzhled velkých písmen */
  text-align: center;
  letter-spacing: 0.5px;
  
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

.fbtn:active, .fbtn:hover {
  background: #<?php echo $barva; ?> !important;
  color: #202428 !important;
}

/* Speciální barvy pro tlačítko SMAZAT */
.fbtn.smazat-btn {
  color: #ff5555 !important;
  border-color: #633030 !important;
  background: #341c1c !important;
}
.fbtn.smazat-btn:active, .fbtn.smazat-btn:hover {
  background: #ff5555 !important;
  color: #202428 !important;
}
</style>

<?php if (empty($slozka_souboru)): ?>
  <div style="color:#888; font-size:12px; padding:12px; text-align:center;">Vyberte skladbu ze seznamu.</div>

<?php elseif (empty($soubory)): ?>
  <div style="color:#888; font-size:12px; padding:12px; text-align:center;">Žádné soubory v této skladbě.</div>

<?php else: ?>
  
  <?php 
  foreach ($soubory as $i => $soub): 
    $cesta    = "user/" . $kapela . "/" . $befelemepesseveze . "/uploads/" . $slozka_souboru . "/" . $soub;
    $cesta_fs = "user/" . $kapela . "/" . $befelemepesseveze . "/uploads/" . $slozka_souboru . "/" . $soub;
    $ext      = strtolower(pathinfo($soub, PATHINFO_EXTENSION));
    $je_audio = in_array($ext, $povolene_audio);
    
    $id_roletky = "roletka_" . $i;
  ?>
    <div class="nahravka-box">
      
      <div class="nahravka-hlavni">
        <div class="nahravka-nazev" title="<?php echo htmlspecialchars($soub); ?>">
          <?php echo $je_audio ? '<img src="meat/ikona_kazeta.png" alt="" style="width: 32px; height: 32px; object-fit: contain; flex-shrink: 0;">' : '📄'; ?> <?php echo htmlspecialchars($soub); ?>
        </div>
        <div>
          <button class="btn-nastaveni collapsed" 
        data-toggle="collapse" 
        data-target="#<?php echo $id_roletky; ?>" 
        aria-expanded="false" 
        title="Možnosti">
  ﹀
          </button>
        </div>
      </div>

      <div id="<?php echo $id_roletky; ?>" class="collapse nahravka-vysuvna">
        
        <?php if ($je_audio): ?>
          <div class="vysuvna-prehravac">
            <audio controls style="width: 100%; height: 40px;">
              <?php 
              $mime_typy = ['mp3' => 'audio/mpeg', 'wav' => 'audio/wav', 'ogg' => 'audio/ogg', 'flac' => 'audio/flac', 'aac' => 'audio/aac'];
              $m_type = $mime_typy[$ext] ?? 'audio/mpeg';
              ?>
              <source src="<?php echo htmlspecialchars($cesta); ?>?t=<?php echo time(); ?>" type="<?php echo $m_type; ?>">
            </audio>
          </div>
        <?php endif; ?>

        <div class="vysuvna-tlacitka">
          
          <?php if ($je_audio): ?>
            <button class="fbtn looper-btn"
                    data-cesta="<?php echo htmlspecialchars($cesta, ENT_QUOTES); ?>"
                    data-nazev="<?php echo htmlspecialchars($soub, ENT_QUOTES); ?>"
                    title="Otevřít křivku nahrávky">Looper</button>
			<button class="fbtn poznamky-btn"
                    data-cesta="<?php echo htmlspecialchars($cesta_fs, ENT_QUOTES); ?>"
                    title="zobrazit prudící seznam">Poznámky</button>		
					
          <?php endif; ?>

          <button class="fbtn presunout-btn"
                  data-soubor="<?php echo htmlspecialchars($cesta_fs, ENT_QUOTES); ?>"
                  data-nazev="<?php echo htmlspecialchars($soub, ENT_QUOTES); ?>"
                  data-toggle="modal" 
                  data-target="#modal_presunout" 
                  title="Přesunout do jiné skladby">Přesun</button>

          <a href="<?php echo htmlspecialchars($cesta, ENT_QUOTES); ?>" 
             download="<?php echo htmlspecialchars($soub, ENT_QUOTES); ?>"
             onclick="return confirm('Opravdu stáhnout soubor: <?php echo htmlspecialchars($soub, ENT_QUOTES); ?>?');">
            <button class="fbtn" title="Stáhnout">Stáhnout</button>
          </a>

          <button class="fbtn smazat-btn" 
                  data-soubor="<?php echo htmlspecialchars($cesta_fs, ENT_QUOTES); ?>"
                  data-nazev="<?php echo htmlspecialchars($soub, ENT_QUOTES); ?>"
                  data-toggle="modal" 
                  data-target="#modal_delete" 
                  title="Smazat">Smazat</button>

        </div>
		
		<div class="poznamky-panel"
			 data-cesta="<?php echo htmlspecialchars($cesta_fs, ENT_QUOTES); ?>"
			 style="display:none;margin-top:12px;">

			<div class="poznamky-seznam"></div>

			<?php if ($je_audio): ?>
			<button class="fbtn pridat-poznamku-btn"
					data-cesta="<?php echo htmlspecialchars($cesta_fs, ENT_QUOTES); ?>">
				Přidat poznámku k aktuálnímu času
			</button>
			<?php endif; ?>

        </div>
        
      </div>
      
    </div>
  <?php endforeach; ?>

<?php endif; ?>