<?php
session_start();
error_reporting(0);

if (empty($_SESSION['login'])) { echo ''; exit; }

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

/* Společný styl pro velká mobilní tlačítka uvnitř roletky */
.fbtn {
  background: #2a3a10 !important;
  color: #<?php echo $barva; ?> !important;
  border: 1px solid #<?php echo $barva; ?> !important;
  border-radius: 6px;
  width: 44px;
  height: 44px;
  font-size: 20px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  padding: 0;
}

.fbtn:active, .fbtn:hover {
  background: #<?php echo $barva; ?> !important;
  color: #202428 !important;
}

/* Výsuvná plocha (panel pod názvem) */
.nahravka-vysuvna {
  margin-top: 10px;
  border-top: 1px solid #34383e;
  padding-top: 10px;
}

/* Řádek pro tlačítka v roletce */
.vysuvna-tlacitka {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}
</style>

<?php if (empty($slozka_souboru)): ?>
  <div style="color:#888; font-size:12px; padding:12px; text-align:center;">Vyberte vál ze seznamu.</div>

<?php elseif (empty($soubory)): ?>
  <div style="color:#888; font-size:12px; padding:12px; text-align:center;">Žádné soubory v tomto válu.</div>

<?php else: ?>
  
  <?php 
  foreach ($soubory as $i => $soub): 
    $cesta    = "user/" . $kapela . "/" . $befelemepesseveze . "/uploads/" . $slozka_souboru . "/" . $soub;
    $cesta_fs = "user/" . $kapela . "/" . $befelemepesseveze . "/uploads/" . $slozka_souboru . "/" . $soub;
    $ext      = strtolower(pathinfo($soub, PATHINFO_EXTENSION));
    $je_audio = in_array($ext, $povolene_audio);
    
    // Unikátní ID pro každou roletku na základě indexu smyčky
    $id_roletky = "roletka_" . $i;
  ?>
    <div class="nahravka-box">
      
      <div class="nahravka-hlavni">
        <div class="nahravka-nazev" title="<?php echo htmlspecialchars($soub); ?>">
          <?php echo $je_audio ? '🎵' : '📄'; ?> <?php echo htmlspecialchars($soub); ?>
        </div>
        <div>
          <button class="fbtn" 
                  data-toggle="collapse" 
                  data-target="#<?php echo $id_roletky; ?>" 
                  title="Možnosti" 
                  style="background: #222e0d !important;">
            ⚙️
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
          
          <a href="<?php echo htmlspecialchars($cesta, ENT_QUOTES); ?>" 
             download="<?php echo htmlspecialchars($soub, ENT_QUOTES); ?>"
             onclick="return confirm('Opravdu stáhnout soubor: <?php echo htmlspecialchars($soub, ENT_QUOTES); ?>?');">
            <button class="fbtn" title="Stáhnout">⬇</button>
          </a>

          <button class="fbtn presunout-btn"
                  data-soubor="<?php echo htmlspecialchars($cesta_fs, ENT_QUOTES); ?>"
                  data-nazev="<?php echo htmlspecialchars($soub, ENT_QUOTES); ?>"
                  data-toggle="modal" 
                  data-target="#modal_presunout" 
                  title="Přesunout do jiné skladby">↔</button>

          <button class="fbtn smazat-btn" 
                  style="color:#ff5555; border-color:#633030;"
                  data-soubor="<?php echo htmlspecialchars($cesta_fs, ENT_QUOTES); ?>"
                  data-nazev="<?php echo htmlspecialchars($soub, ENT_QUOTES); ?>"
                  data-toggle="modal" 
                  data-target="#modal_delete" 
                  title="Smazat">🗑</button>

          <?php if ($je_audio): ?>
            <button class="fbtn looper-btn"
                    data-cesta="<?php echo htmlspecialchars($cesta, ENT_QUOTES); ?>"
                    data-nazev="<?php echo htmlspecialchars($soub, ENT_QUOTES); ?>"
                    title="Otevřít v looperu">〜</button>
          <?php endif; ?>

        </div>
        
      </div>
      
    </div>
  <?php endforeach; ?>

<?php endif; ?>