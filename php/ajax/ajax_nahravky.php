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
        if (substr($f, 0, 1) === ".") continue;
        if (substr($f, -11) === '.peaks.json') continue; // WaveSurfer cache — nezobrazovat
        $soubory[] = $f;
    }
}

// ── Popisky nahrávek (jeden dotaz pro celý vál, ne N+1) ──
$popisky = [];
$mohu_upravit_popisek = in_array($_SESSION['role'] ?? '', ['muzikant', 'admin']);
if (!empty($soubory)) {
    include "../login/connect.php";
    $prefix_cesty = "user/" . $kapela . "/" . $befelemepesseveze . "/uploads/" . $slozka_souboru . "/";
    $cesty_escaped = array_map(function($f) use ($mysqli, $prefix_cesty) {
        return "'" . $mysqli->real_escape_string($prefix_cesty . $f) . "'";
    }, $soubory);
    $res_popisky = $mysqli->query("
        SELECT file_path, poznamka
        FROM recording_notes
        WHERE cas = -1 AND file_path IN (" . implode(',', $cesty_escaped) . ")
    ");
    if ($res_popisky) {
        while ($rp = $res_popisky->fetch_assoc()) {
            $popisky[$rp['file_path']] = $rp['poznamka'];
        }
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
    cursor: pointer;
    transition: background-color .15s ease;
    border-radius: 4px; 
}

.nahravka-hlavni:hover
{
    background: rgba(127,191,255,.10);
}

/* Obal pro popisek + název souboru (nahrazuje dřívější přímé umístění .nahravka-nazev) */
.nahravka-popis-wrap {
  flex: 1;
  min-width: 0;
}

/* Popisek — primární, hned viditelný text (název souboru může být zavádějící) */
.nahravka-popisek {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: bold;
  color: #e0e0e0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.popisek-text {
  overflow: hidden;
  text-overflow: ellipsis;
}
.popisek-prazdny {
  color: #888;
  font-weight: normal;
  font-style: italic;
}
.popisek-edit-btn {
  background: none;
  border: none;
  color: #888;
  font-size: 12px;
  cursor: pointer;
  padding: 0 2px;
  flex-shrink: 0;
  opacity: 0.6;
  transition: opacity .15s, color .15s;
}
.popisek-edit-btn:hover { opacity: 1; color: var(--barva); }

/* Inline editace popisku */
.popisek-edit-wrap {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-top: 2px;
}
.popisek-edit-input {
  flex: 1;
  min-width: 0;
  background: #1a1d20;
  border: 1px solid #4a5060;
  border-radius: 4px;
  color: #e0e0e0;
  font-size: 13px;
  padding: 3px 7px;
  box-sizing: border-box;
}
.popisek-edit-input:focus { outline: none; border-color: var(--barva); }
.popisek-save-btn, .popisek-cancel-btn {
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 11px;
  cursor: pointer;
  flex-shrink: 0;
}
.popisek-save-btn {
  background: #2a3a10; border: 1px solid var(--barva); color: var(--barva);
}
.popisek-save-btn:disabled { opacity: 0.5; cursor: default; }
.popisek-cancel-btn {
  background: none; border: 1px solid #555; color: #888;
}
.popisek-cancel-btn:hover { border-color: #888; color: #aaa; }

/* Název souboru — teď jen podřádek, sekundární informace */
.nahravka-nazev {
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
   
  margin-top: 2px;
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

/* Textové tlačítko – používá se pro "Přidat poznámku" uvnitř poznámkového panelu */
.fbtn {
  background: #2a3a10;
  color: #<?php echo $barva; ?>;
  border: 1px solid #<?php echo $barva; ?>;
  border-radius: 5px;
  width: 100%;
  padding: 7px 4px;
  font-size: 11px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: .5px;
  text-align: center;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  transition: all .15s;
}
.fbtn:hover { background: #<?php echo $barva; ?>; color: #202428; }

/* Ikonové tlačítko — sloupec ikona + popisek */
.icon-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 4px;
  border-radius: 5px;
  cursor: pointer;
  border: 1px solid #3a3e44;
  background: #1e2226;
  color: #<?php echo $barva; ?>;
  transition: border-color .15s, background .15s;
  text-decoration: none; /* pro <a> verzi */
  box-sizing: border-box;
  min-width: 0;
}

.icon-btn i {
  font-size: 18px;
  line-height: 1;
}

.icon-btn span {
  font-size: 9px;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: .4px;
  color: #888;
  white-space: nowrap;
}

.icon-btn:hover {
  border-color: #<?php echo $barva; ?>;
  background: #2a3a10;
  text-decoration: none;
  color: #<?php echo $barva; ?>;
}

/* Smazat — červená varianta */
.icon-btn.del {
  color: #ff5555;
}

.icon-btn.del:hover {
  border-color: #633030;
  background: #341c1c;
  color: #ff5555;
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
    $popisek  = $popisky[$cesta_fs] ?? '';
    
    $id_roletky = "roletka_" . $i;
  ?>
    <div class="nahravka-box">
      
      <div class="nahravka-hlavni">
        <div class="nahravka-popis-wrap">
        <div class="nahravka-nazev" title="<?php echo htmlspecialchars($soub); ?>">
            <?php echo $je_audio ? '<img src="meat/ikona_kazeta.png" alt="" style="width: 16px; height: 16px; object-fit: contain; flex-shrink: 0;">' : '📄'; ?> <?php echo htmlspecialchars($soub); ?>
        </div>
		<div class="nahravka-popisek" data-cesta="<?php echo htmlspecialchars($cesta_fs, ENT_QUOTES); ?>">
            <?php if ($popisek !== ''): ?>
              <span class="popisek-text"><?php echo htmlspecialchars($popisek); ?></span>
            <?php else: ?>
              <span class="popisek-text popisek-prazdny">bez popisku</span>
            <?php endif; ?>
            <?php if ($mohu_upravit_popisek): ?>
              <button class="popisek-edit-btn" title="upravit popisek">✏</button>
            <?php endif; ?>
          </div>

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
            <button class="icon-btn looper-btn"
                    data-cesta="<?php echo htmlspecialchars($cesta, ENT_QUOTES); ?>"
                    data-nazev="<?php echo htmlspecialchars($soub, ENT_QUOTES); ?>"
                    title="Otevřít křivku nahrávky"
                    aria-label="Looper">
              <i class="ti ti-activity" aria-hidden="true"></i>
              <span>Looper</span>
            </button>
            <button class="icon-btn poznamky-btn"
                    data-cesta="<?php echo htmlspecialchars($cesta_fs, ENT_QUOTES); ?>"
                    title="Zobrazit timestampy"
                    aria-label="Poznámky">
              <i class="ti ti-flag" aria-hidden="true"></i>
              <span>Poznámky</span>
            </button>
          <?php endif; ?>

          <button class="icon-btn presunout-btn"
                  data-soubor="<?php echo htmlspecialchars($cesta_fs, ENT_QUOTES); ?>"
                  data-nazev="<?php echo htmlspecialchars($soub, ENT_QUOTES); ?>"
                  data-toggle="modal" 
                  data-target="#modal_presunout"
                  title="Přesunout do jiné skladby"
                  aria-label="Přesun">
            <i class="ti ti-arrow-right" aria-hidden="true"></i>
            <span>Přesun</span>
          </button>

          <a class="icon-btn"
             href="<?php echo htmlspecialchars($cesta, ENT_QUOTES); ?>" 
             download="<?php echo htmlspecialchars($soub, ENT_QUOTES); ?>"
             title="Stáhnout"
             aria-label="Stáhnout"
             onclick="return confirm('Opravdu stáhnout soubor: <?php echo htmlspecialchars($soub, ENT_QUOTES); ?>?');">
            <i class="ti ti-download" aria-hidden="true"></i>
            <span>Stáhnout</span>
          </a>

          <button class="icon-btn del smazat-btn" 
                  data-soubor="<?php echo htmlspecialchars($cesta_fs, ENT_QUOTES); ?>"
                  data-nazev="<?php echo htmlspecialchars($soub, ENT_QUOTES); ?>"
                  data-toggle="modal" 
                  data-target="#modal_delete"
                  title="Smazat"
                  aria-label="Smazat">
            <i class="ti ti-trash" aria-hidden="true"></i>
            <span>Smazat</span>
          </button>

        </div>
		
		<div class="poznamky-panel"
			 data-cesta="<?php echo htmlspecialchars($cesta_fs, ENT_QUOTES); ?>"
			 style="display:none;margin-top:12px;">

			<div class="poznamky-seznam"></div>

		 

        </div>
        
      </div>
      
    </div>
  <?php endforeach; ?>

<?php endif; ?>