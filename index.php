<?php session_start();
error_reporting(0);
require_once 'config.php';

// Deep link poznáme už před přihlášením. Do session ukládáme pouze znovu
// sestavený lokální query string, nikdy uživatelem dodanou návratovou URL.
$deep_link_requested = isset($_GET['val']) || isset($_GET['nahravka']) || isset($_GET['time']);
if ($deep_link_requested && empty($_SESSION['logged_in_single'])) {
    $deep_link_params = [];
    foreach (['val', 'nahravka', 'time'] as $param) {
        if (isset($_GET[$param]) && is_string($_GET[$param])) {
            $deep_link_params[$param] = $_GET[$param];
        }
    }
    $_SESSION['deep_link_after_login'] = http_build_query($deep_link_params, '', '&', PHP_QUERY_RFC3986);
}

// Inicializace SESSION barev
$_SESSION['barva1']     = $_SESSION['barva1']     ?? "a7ac38";
$_SESSION['barva_pozadi'] = $_SESSION['barva_pozadi'] ?? "202428";


/* ── HARDCODED CONFIGURATION PRO SINGLE-BAND VERZI ── */
$single_kapela            = "kapela";
$single_befelemepesseveze = "471707760";
/* ────────────────────────────────────────────────── */


// Kontrola přihlášení — vše řeší loginbox4.php
if (empty($_SESSION['logged_in_single'])) {
    require "php/loginbox4.php";
    exit;
}

// Zpětná kompatibilita: session bez role (přihlášení před zavedením rolí) → muzikant
if (empty($_SESSION['role'])) {
    $_SESSION['role'] = 'muzikant';
}

// Podstrčit identitu kapely do session (jednou po přihlášení)
if (empty($_SESSION['kapela'])) {
    $_SESSION['kapela']            = $single_kapela;
    $_SESSION['befelemepesseveze'] = $single_befelemepesseveze;
}

// Nastavit lokální proměnné
$kapela            = $_SESSION['kapela']            ?? "";
$befelemepesseveze = $_SESSION['befelemepesseveze'] ?? "";
$sekce             = "uploads";
$aktualni_text     = $_SESSION['aktualni_text']     ?? "akordy.txt";
$aktualni_tab      = $_SESSION['aktualni_tab']      ?? "tabelatura.txt";
$aktualni_diskuse  = $_SESSION['diskuse']           ?? "";


// ── UPRAVENÁ LOGIKA SLOŽEK S ABSOLUTNÍ CESTOU ──
if (!empty($kapela) && !empty($befelemepesseveze)) {
    // Použijeme __DIR__ pro přesné zacílení na disk
    $slozka_slozek     = __DIR__ . "/user/" . $kapela . "/" . $befelemepesseveze . "/" . $sekce . "/";
    $pole_slozek_raw   = is_dir($slozka_slozek) ? scandir($slozka_slozek) : [];
    
    // Filtrovat jen složky, přeskočit . a ..
    $pole_slozek = [];
    foreach ($pole_slozek_raw as $s) {
        if ($s !== "." && $s !== ".." && is_dir($slozka_slozek . $s)) {
            $pole_slozek[] = $s;
        }
    }
	
$soubor_poradi = $slozka_slozek . 'poradi.json';
    if (file_exists($soubor_poradi)) {
        $vlastni_poradi = json_decode(file_get_contents($soubor_poradi), true);
        if (is_array($vlastni_poradi)) {
            usort($pole_slozek, function($a, $b) use ($vlastni_poradi) {
                $posA = array_search($a, $vlastni_poradi);
                $posB = array_search($b, $vlastni_poradi);
                
                // Pokud složka v seznamu chybí (nová skladba), dáme ji na konec
                $posA = ($posA === false) ? 9999 : $posA;
                $posB = ($posB === false) ? 9999 : $posB;
                
                return $posA <=> $posB;
            });
        }
    }
	
// --- AUTOMATICKÝ VÝBĚR SKLADBY PO PŘIHLÁŠENÍ ---
    // Pokud není vybraná žádná skladba, NEBO pokud vybraná skladba už neexistuje (např. byla smazána)
    if (empty($_SESSION['slozka_souboru_k_zobrazeni']) || !in_array($_SESSION['slozka_souboru_k_zobrazeni'], $pole_slozek)) {
        if (count($pole_slozek) > 0) {
            // Nastaví se automaticky první nalezená skladba
            $_SESSION['slozka_souboru_k_zobrazeni'] = $pole_slozek[0];
        }
    }
    
    // Propíšeme si to do lokální proměnné, aby ji mohl zbytek index.php ihned použít
    $slozka_souboru = $_SESSION['slozka_souboru_k_zobrazeni'] ?? "";	
	
} else {
    $slozka_slozek = "";
    $pole_slozek   = [];
}

// Aktuální vál (Zde v HTML kódu pak potřebujeme relativní cestu, tak si připravíme verzi pro zobrazení)
$relativni_slozka_slozek = "user/" . $kapela . "/" . $befelemepesseveze . "/" . $sekce . "/";

$slozka_souboru = $_SESSION['slozka_souboru_k_zobrazeni'] ?? ($pole_slozek[0] ?? "");
if ($slozka_souboru === "slozka_smazana" || !in_array($slozka_souboru, $pole_slozek)) {
    $slozka_souboru = $pole_slozek[0] ?? "";
    $_SESSION['slozka_souboru_k_zobrazeni'] = $slozka_souboru;
}

// Validace deep linku proti skutečnému seznamu válů a nahrávek. Přesné členství
// v $pole_slozek + basename vylučuje path traversal i načtení vedlejšího souboru.
$deep_link = null;
if ($deep_link_requested) {
    $deep_val  = isset($_GET['val']) && is_string($_GET['val']) ? $_GET['val'] : '';
    $deep_file = isset($_GET['nahravka']) && is_string($_GET['nahravka']) ? $_GET['nahravka'] : '';
    $deep_time = isset($_GET['time']) && is_string($_GET['time']) && ctype_digit($_GET['time'])
        ? (int) $_GET['time'] : 0;
    $audio_extensions = ['mp3', 'wav', 'ogg', 'flac', 'aac'];
    $valid_names = $deep_val !== '' && $deep_file !== ''
        && basename($deep_val) === $deep_val && basename($deep_file) === $deep_file
        && !str_contains($deep_val, '..') && !str_contains($deep_file, '..');
    $deep_path = $valid_names && in_array($deep_val, $pole_slozek, true)
        ? $slozka_slozek . $deep_val . '/' . $deep_file : '';
    $valid_file = $deep_path !== '' && is_file($deep_path)
        && in_array(strtolower(pathinfo($deep_file, PATHINFO_EXTENSION)), $audio_extensions, true);

    if ($valid_file) {
        $slozka_souboru = $deep_val;
        $_SESSION['slozka_souboru_k_zobrazeni'] = $deep_val;
        $deep_link = [
            'valid' => true,
            'file'  => $deep_file,
            'path'  => $relativni_slozka_slozek . $deep_val . '/' . $deep_file,
            'time'  => max(0, $deep_time),
        ];
    } else {
        $deep_link = ['valid' => false];
    }
}

// Název válu (z nazev_valu.txt pokud existuje) - upraveno o absolutní cestu
function nacti_nazev_valu($slozka_slozek, $slozka) {
    $soubor = $slozka_slozek . $slozka . "/data/nazev_valu.txt";
    if (file_exists($soubor)) {
        return trim(file_get_contents($soubor));
    }
    return $slozka;
}

$nazev_valu = nacti_nazev_valu($slozka_slozek, $slozka_souboru);
?>

<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Virtuální zkušebna</title>
<link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css"
      xintegrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css">
<link href="css/sticky-footer-navbar.css" rel="stylesheet">
<link href="css/main.css?v=<?= filemtime(__DIR__ . '/css/main.css') ?>" rel="stylesheet">

<!-- ── Dynamické proměnné z SESSION (nemohou být ve statickém main.css) ── -->
<style>
:root {
  --barva:  #<?php echo $_SESSION['barva1'] ?>;
  --pozadi: #<?php echo $_SESSION['barva_pozadi'] ?>;
}
</style>

<!-- ── SKRIPTY (defer = stahují se paralelně s parsováním HTML, spouští se v pořadí těsně před DOMContentLoaded) ── -->
<script src="https://code.jquery.com/jquery-3.7.1.min.js" crossorigin="anonymous" defer></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js" crossorigin="anonymous" defer></script>
<script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js" crossorigin="anonymous" defer></script>
<script src="https://unpkg.com/wavesurfer.js@7.12.11" defer></script>
<script src="https://unpkg.com/wavesurfer.js@7.12.11/dist/plugins/regions.min.js" defer></script>
<script src="https://unpkg.com/wavesurfer.js@7.12.11/dist/plugins/zoom.min.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/idb-keyval@6/dist/umd.js" defer></script>
<script src="https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js" defer></script>
<script src="js/main.js" defer></script>
</head>
<body>

<!-- Progress bar -->
<div id="progress-bar"></div>

<!-- ── TOPBAR ── -->
<div id="topbar">
  <span class="brand">ZKUŠEBNA</span>
  <span class="brand">/</span>
  <span class="brand">DK</span>
  <span class="brand">/</span>
  <span id="topbar-val" onclick="toggleValDrawer()"><?php echo htmlspecialchars($nazev_valu); ?></span>
  <nav class="topnav">
    <a href="#" class="active" id="nav-nahravky"   onclick="toggleDesktopPanel('nahravky',this);return false">nahrávky</a>
    <a href="#" class="active" id="nav-text"       onclick="toggleDesktopPanel('text',this);return false">text</a>
    <a href="#" class="active" id="nav-tabelatura" onclick="toggleDesktopPanel('tabelatura',this);return false">tabelatura</a>
    <a href="#" class="active" id="nav-diskuse"    onclick="toggleDesktopPanel('diskuse',this);return false">poznámky</a>
    <a href="#" id="nav-napady"                    onclick="toggleDesktopPanel('napady',this);return false">
      nápady <span class="napady-badge">DK</span>
    </a>
    <a href="#" data-toggle="modal" data-target="#myModal" style="color:var(--muted)">about</a>
    <a href="#" id="audio-cache-clear" title="Spravovat lokálně uložené nahrávky">smazat offline soubory</a>
    <a href="#" data-toggle="modal" data-target="#modal_logout" style="color:var(--muted)">odhlásit</a>
  </nav>
  <div class="topbar-mob-actions">
    <a href="#" id="nav-napady-tab" onclick="tabletNapady(this);return false">nápady <span class="napady-badge">DK</span></a>
    <details class="topbar-more-menu">
      <summary aria-label="Další možnosti" title="Další možnosti">
        <span></span><span></span><span></span>
      </summary>
      <div class="topbar-more-menu-items">
        <a href="#" data-toggle="modal" data-target="#myModal" onclick="this.closest('details').removeAttribute('open')">about</a>
        <a href="#" class="audio-cache-clear-mobile" title="Spravovat lokálně uložené nahrávky" onclick="this.closest('details').removeAttribute('open')">smazat offline soubory</a>
        <a href="#" data-toggle="modal" data-target="#modal_logout" onclick="this.closest('details').removeAttribute('open')">odhlásit</a>
      </div>
    </details>
  </div>
</div>

<!-- ── SIDEBAR ── -->
 <div id="sidebar">
  <div class="sidebar-label" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px 4px;">
    <span>Skladby</span>
    <button class="btn-vz<?= ma_pravo('create_val') ? '' : ' btn-locked' ?>" data-toggle="modal" data-target="#modal_nova_slozka" style="padding: 2px 6px; font-size: 10px;">+ nová</button>
  </div>
<div id="sidebar-playlist">
    <?php foreach ($pole_slozek as $s):
        $nazev_s = nacti_nazev_valu($slozka_slozek, $s);
        $active  = ($s === $slozka_souboru) ? ' active' : '';
    ?>
    <div class="val-item<?php echo $active; ?>"
         data-id="<?php echo htmlspecialchars($s, ENT_QUOTES); ?>"
         data-val="<?php echo htmlspecialchars($s); ?>"
         onclick="switchVal('<?php echo htmlspecialchars($s, ENT_QUOTES); ?>', '<?php echo htmlspecialchars($nazev_s, ENT_QUOTES); ?>', this)">
      <img src="meat/ikona_kombo.png" alt="" style="width: 20px; height: 20px; object-fit: contain; flex-shrink: 0;">
      <span class="val-nazev"><?php echo htmlspecialchars($nazev_s); ?></span>
      <div class="val-actions">
        <button onclick="event.stopPropagation();otevritPrejmenovani('<?php echo htmlspecialchars($s, ENT_QUOTES); ?>','<?php echo htmlspecialchars($nazev_s, ENT_QUOTES); ?>')" title="přejmenovat" class="<?= ma_pravo('rename_val') ? '' : 'btn-locked' ?>">✏</button>
        <button onclick="event.stopPropagation();otevritSmazani('<?php echo htmlspecialchars($s, ENT_QUOTES); ?>')" title="smazat" class="<?= ma_pravo('delete_val') ? '' : 'btn-locked' ?>">🗑</button>
      </div>
    </div>
    <?php endforeach; ?>
  </div>
</div>

<!-- ── MAIN ── -->
<div id="main">

  <!-- LOOPER BAR (DVOUŘÁDKOVÝ VELKÝ) -->
  <div id="looper-bar" class="collapsed">

<!-- HLAVIČKA -->
<div id="looper-header">

    <div class="looper-left">

        <div class="looper-title">
            LOOPER
        </div>

        <div class="looper-buttons">

            <button class="wave-btn on"
                    id="btn-play"
                    onclick="looperPlay()">▶</button>

            <button class="wave-btn"
                    id="btn-pause"
                    onclick="looperPause()">⏸</button>

            <button class="wave-btn"
                    id="btn-loop"
                    aria-pressed="false"
                    onclick="looperLoop()">⟳</button>

            <button class="wave-btn"
                    onclick="looperRestart()">↺</button>

 
        </div>

    </div>

    <div class="looper-right">
        <div class="looper-menu-wrap">
            <button class="wave-btn looper-menu-toggle"
                    id="btn-looper-menu"
                    type="button"
                    aria-label="Otevřít nápovědu Looperu"
                    aria-expanded="false"
                    aria-controls="looper-menu">☰</button>

            <div id="looper-menu" class="looper-menu" hidden>
                <div class="looper-menu-section">
                    <button class="looper-menu-item" id="btn-collapse" type="button" data-looper-menu-close onclick="looperToggle()">
                        <span id="btn-collapse-icon" aria-hidden="true">▭</span><span id="btn-collapse-label">Minimalizovat</span>
                    </button>
                    <button class="looper-menu-item" id="btn-looper-fullscreen" type="button" data-looper-menu-close
                            onclick="looperFullscreenToggle()" aria-label="Maximalizovat looper" aria-pressed="false">
                        <span aria-hidden="true">⛶</span><span id="btn-looper-fullscreen-label">Maximalizovat</span>
                    </button>
                    <button class="looper-menu-item" type="button" data-looper-menu-close onclick="looperZavrit()">
                        <span aria-hidden="true">✕</span><span>Zavřít</span>
                    </button>
                </div>

                <div class="looper-menu-section looper-menu-offline">
                    <span class="looper-menu-heading">Offline</span>
                    <div id="audio-cache-control" class="audio-cache-control" hidden>
                        <span id="audio-cache-status" class="audio-cache-status" aria-live="polite"></span>
                        <button type="button" id="audio-cache-toggle" class="audio-cache-toggle" aria-pressed="false">podržet</button>
                    </div>
                </div>

                <div class="looper-menu-section">
                    <div id="looper-link-control" class="audio-cache-control" hidden>
                        <button type="button" class="audio-cache-toggle" data-looper-menu-close onclick="looperCreateLink()">vytvořit odkaz</button>
                        <span id="looper-link-status" class="audio-cache-status" aria-live="polite"></span>
                    </div>
                </div>
            </div>
        </div>

    </div>

</div>

    <!-- OBSAH -->
    <div id="looper-content" class="hidden">
        <div id="waveform-container">
	        <div id="looper-file-name" title=""></div>
	        <div id="looper-time">
               00:00 / 00:00
            </div>

<div id="wf-placeholder">

    <div class="looper-guide">

        <div class="looper-guide-actions">
            <button type="button" class="wave-btn" onclick="closeLooperGuide()">Zavřít nápovědu</button>
        </div>

		<div class="looper-guide-row">
		    <div class="guide-text">
                <strong>Není vybranej žádnej vál!</strong>
            </div>
			 <div class="guide-arrow">
                ➜
            </div>
		    <div class="guide-text">
                <strong>Postupuj podle návodu!</strong>
            </div>			
		</div>
	
        <div class="looper-guide-row">

            <div class="guide-text">
                <strong>① Vyber vál ze seznamu nahrávek.</strong>
            </div>

            <div class="guide-arrow">
                ➜
            </div>

            <div class="guide-preview" id="guide-preview-list">

				 <img src="meat/guide_nahravky.jpg"
					 alt="seznam válů"
					 class="guide-wave-image">

			</div>
        </div>

        <div class="guide-down">↓</div>

        <div class="looper-guide-row">

            <div class="guide-text">
                <strong>② Klikni na tlačítko Looper.</strong>
            </div>

            <div class="guide-arrow">
                ➜
            </div>

			 <div class="guide-preview" id="guide-preview-looper">

			    <img src="meat/guide_looper.jpg"
					 alt="spustit Looper"tl
					 class="guide-wave-image">

			</div>
        </div>

        <div class="guide-down">↓</div>

        <div class="looper-guide-row">

            <div class="guide-text">
                <strong>③ Přehrávej a označuj důležitá místa v konkrétním čase.</strong><br>
            </div>

            <div class="guide-arrow">
                ➜
            </div>

            <div class="guide-preview" id="guide-preview-wave">

				<img src="meat/guide_wave.jpg"
					 alt="Přidat poznámku"
					 class="guide-wave-image">

			</div>

        </div>

    </div>

</div>

            <div id="waveform"></div>
            <div id="waveform-zoom-controls" aria-label="Přiblížení waveformu">
                <button type="button" id="waveform-zoom-out" class="waveform-zoom-button"
                        aria-label="Oddálit waveform" title="Oddálit" disabled>−</button>
                <button type="button" id="waveform-zoom-in" class="waveform-zoom-button"
                        aria-label="Přiblížit waveform" title="Přiblížit" disabled>+</button>
            </div>

        </div>

        <div id="looper-notes"></div>

    </div>

</div>

  <!-- CONTENT AREA (Přidán výchozí atribut data-active-panel pro správný start 2-panelové verze) -->
  <div id="content-area" data-active-panel="nahravky">

    <!-- PANEL NAHRÁVKY -->
    <div class="panel mob-active" id="panel-nahravky">
      <div class="panel-header">
        <h2>NAHRÁVKY</h2>
        <div class="acts">
          <button class="btn-vz<?= ma_pravo('upload') ? '' : ' btn-locked' ?>" data-toggle="modal" data-target="#modal_vlozit_soubor">⬆ vložit</button>
          <button class="btn-vz danger rec<?= ma_pravo('upload') ? '' : ' btn-locked' ?>" data-toggle="modal" data-target="#modal_nahrat_zvuk">⏺ REC</button>
        </div>
      </div>
      <div class="panel-body" id="body-nahravky">
        <div class="panel-loading"><div class="spinner"></div>načítám...</div>
      </div>
    </div>

    <!-- PANEL TEXT -->
    <div class="panel" id="panel-text">
      <div class="panel-header">
        <h2>TEXT</h2>
        <div class="acts">
          <button class="btn-vz<?= ma_pravo('edit_text') ? '' : ' btn-locked' ?>" onclick="otevritEditText('text')">změnit</button>
        </div>
      </div>
      <div class="panel-body" id="body-text">
        <div class="panel-loading"><div class="spinner"></div>načítám...</div>
      </div>
    </div>

    <!-- 🌟 PANEL TABELATURA (Nový panel, zcela identický s panelem textu) -->
    <div class="panel" id="panel-tabelatura">
      <div class="panel-header">
        <h2>TABELATURA</h2>
        <div class="acts">
          <button class="btn-vz<?= ma_pravo('edit_text') ? '' : ' btn-locked' ?>" onclick="otevritEditText('tabelatura')">změnit</button>
        </div>
      </div>
      <div class="panel-body" id="body-tabelatura">
        <div class="panel-loading"><div class="spinner"></div>načítám...</div>
      </div>
    </div>

    <!-- PANEL DISKUSE -->
    <div class="panel" id="panel-diskuse">
      <div class="panel-header">
        <h2>POZNÁMKY</h2>
        <div class="acts" id="diskuse-val-label" style="font-size:10px;color:var(--muted)">
          <?php echo htmlspecialchars($nazev_valu); ?>
        </div>
      </div>
      <div class="panel-body" id="body-diskuse">
        <div class="panel-loading"><div class="spinner"></div>načítám...</div>
      </div>
    </div>

    <!-- PANEL NÁPADY (přes celou šířku) -->
    <div class="panel" id="panel-napady">
      <div class="panel-header">
        <h2>NÁPADY <span class="napady-badge">celá kapela</span></h2>
      </div>
      <div class="panel-body" id="body-napady">
        <div class="panel-loading"><div class="spinner"></div>načítám...</div>
      </div>
      <!-- Formulář přilepen ke spodnímu okraji -->
      <div id="napady-form-wrap" style="
        border-top: 1px solid var(--border);
        background: var(--tmava);
        padding: 8px 12px;
        flex-shrink: 0;
      ">
        <form id="form_napady">
          <!-- Na mobilu toggle tlačítko -->
          <button type="button" id="napady-toggle-btn" onclick="napodyToggle()" style="
            display:none; width:100%;
            background: var(--card); border: 1px solid var(--border); color: var(--muted);
            border-radius: 5px; padding: 6px 10px; font-size: 12px; cursor: pointer;
            margin-bottom: 6px;
          ">+ nápad</button>
          <!-- Celý formulář — na mobilu skrytý -->
          <div id="napady-fields">
            <textarea id="napady_text" rows="2" placeholder="napsat nápad..." style="
              width: 100%; background: var(--pozadi); border: 1px solid var(--border);
              border-radius: 5px; color: var(--text); font-size: 12px; padding: 6px 8px;
              resize: none; font-family: sans-serif; box-sizing: border-box; display: block;
            "></textarea>
            <div style="display:flex; gap:6px; margin-top:5px; align-items:center;">
              <input id="napady_jmeno" type="text" placeholder="jméno" style="
                flex:1; background: var(--pozadi); border: 1px solid var(--border);
                border-radius: 5px; color: var(--text); font-size: 12px; padding: 4px 8px;
              ">
              <button type="submit" style="
                border-radius: 5px; padding: 4px 10px; font-size: 11px; cursor: pointer;
                border: 1px solid var(--barva); background: #2a3a10; color: var(--barva);
                white-space: nowrap;
              ">uložit</button>
            </div>
          </div>
          <div id="napady_chyba" style="color:#ff8888; font-size:11px; margin-top:4px; display:none;"></div>
        </form>
      </div>
    </div>

  </div><!-- /content-area -->
</div><!-- /main -->

<!-- ── MODALS ── -->
<?php require "php/modals.php"; ?>

<!-- ── BOTTOM NAV ── -->
<div id="bottom-nav">
  <button class="bnav" id="bn-skladby" onclick="toggleValDrawer()">
    <img src="meat/ikona_skladby.png" class="bi" alt="skladby">skladby
  </button>
  <button class="bnav active" id="bn-nahravky" onclick="mobilePanel('nahravky',this)">
    <img src="meat/ikona_nahravky.png" class="bi" alt="nahrávky">nahrávky
  </button>
  <button class="bnav" id="bn-text" onclick="mobilePanel('text',this)">
    <img src="meat/ikona_text.png" class="bi" alt="text">text
  </button>
  <button class="bnav" id="bn-tabelatura" onclick="mobilePanel('tabelatura',this)">
    <img src="meat/drinking2.png" class="bi" alt="tabelatura">taby
  </button>
  
  <button class="bnav" id="bn-diskuse" onclick="mobilePanel('diskuse',this)">
    <img src="meat/ikona_diskuse.png" class="bi" alt="diskuse">diskuse
  </button>
  <button class="bnav" id="bn-napady" onclick="mobilePanel('napady',this)">
    <img src="meat/ikona_napady.png" class="bi" alt="nápady">nápady
  </button>
</div>

<!-- ── BOTTOM NAV (TABLET: vlastní 4 tlačítka pro levý a pravý panel) ── -->
<div id="bottom-nav-tab">
  <div class="tab-footer" id="tab-footer-left">
    <button class="bnav active" data-panel="nahravky" onclick="tabletPick('left','nahravky',this)">
      <img src="meat/ikona_nahravky.png" class="bi" alt="nahrávky">nahrávky
    </button>
    <button class="bnav" data-panel="text" onclick="tabletPick('left','text',this)">
      <img src="meat/ikona_text.png" class="bi" alt="text">text
    </button>
    <button class="bnav" data-panel="tabelatura" onclick="tabletPick('left','tabelatura',this)">
      <img src="meat/drinking2.png" class="bi" alt="tabelatura">taby
    </button>
    <button class="bnav" data-panel="diskuse" onclick="tabletPick('left','diskuse',this)">
      <img src="meat/ikona_diskuse.png" class="bi" alt="diskuse">diskuse
    </button>
  </div>
  <div class="tab-footer-divider"></div>
  <div class="tab-footer" id="tab-footer-right">
    <button class="bnav" data-panel="nahravky" onclick="tabletPick('right','nahravky',this)">
      <img src="meat/ikona_nahravky.png" class="bi" alt="nahrávky">nahrávky
    </button>
    <button class="bnav active" data-panel="text" onclick="tabletPick('right','text',this)">
      <img src="meat/ikona_text.png" class="bi" alt="text">text
    </button>
    <button class="bnav" data-panel="tabelatura" onclick="tabletPick('right','tabelatura',this)">
      <img src="meat/drinking2.png" class="bi" alt="tabelatura">taby
    </button>
    <button class="bnav" data-panel="diskuse" onclick="tabletPick('right','diskuse',this)">
      <img src="meat/ikona_diskuse.png" class="bi" alt="diskuse">diskuse
    </button>
  </div>
</div>

<!-- VAL DRAWER (mobil) -->
<div id="val-drawer" class="seznam-skladeb">
  
  <div class="drawer-header nodrag" style="padding: 8px 12px; border-bottom: 1px solid var(--border); margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
      <span style="font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px;">Seznam skladeb</span>
      <button class="btn-vz<?= ma_pravo('create_val') ? '' : ' btn-locked' ?>" data-toggle="modal" data-target="#modal_nova_slozka" onclick="document.getElementById('val-drawer').classList.remove('open')">
          + nová skladba
      </button>
  </div>

<?php foreach ($pole_slozek as $s):
      $nazev_s = nacti_nazev_valu($slozka_slozek, $s);
      $active  = ($s === $slozka_souboru) ? ' active' : '';
  ?>
  <div class="dval<?php echo $active; ?>" 
       data-id="<?php echo htmlspecialchars($s, ENT_QUOTES); ?>"
       onclick="switchVal('<?php echo htmlspecialchars($s, ENT_QUOTES); ?>','<?php echo htmlspecialchars($nazev_s, ENT_QUOTES); ?>', null)">
      <img src="meat/ikona_kombo.png" alt="" style="width: 20px; height: 20px; object-fit: contain; flex-shrink: 0;">
      <span class="val-nazev"><?php echo htmlspecialchars($nazev_s); ?></span>
      <div class="val-actions">
        <button onclick="event.stopPropagation();otevritPrejmenovani('<?php echo htmlspecialchars($s, ENT_QUOTES); ?>','<?php echo htmlspecialchars($nazev_s, ENT_QUOTES); ?>')" title="přejmenovat" class="<?= ma_pravo('rename_val') ? '' : 'btn-locked' ?>">✏</button>
        <button onclick="event.stopPropagation();otevritSmazani('<?php echo htmlspecialchars($s, ENT_QUOTES); ?>')" title="smazat" class="<?= ma_pravo('delete_val') ? '' : 'btn-locked' ?>">🗑</button>
      </div>
  </div>
  <?php endforeach; ?>

</div>

<!-- ── Dynamický stav z PHP (session) — musí zůstat inline, main.js je statický soubor ── -->
<script>
var VZ = {
  aktualniVal:     <?php echo json_encode($slozka_souboru); ?>,
  aktualniNazev:   <?php echo json_encode($nazev_valu); ?>,
  deepLink:        <?php echo json_encode($deep_link, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); ?>,
  aktivniMobPanel: 'nahravky',
  pravo: {
    rename_val: <?php echo json_encode(ma_pravo('rename_val')); ?>,
    delete_val: <?php echo json_encode(ma_pravo('delete_val')); ?>
  }
};
</script>

<!-- ── Bezpečný fallback: pokud js/main.js ze zatím neznámého důvodu neproběhne (chyba sítě, CDN výpadek atd.),
     tyto funkce místo tichého selhání (ReferenceError) zobrazí uživateli srozumitelné hlášení.
     Musí zůstat INLINE (bez defer) a MIMO main.js — kdyby main.js selhal, kód uvnitř něj se stejně nespustí. ── -->
<script>
(function() {
    function vzMainJsChybi() {
        alert('Aplikace se nenačetla správně (main.js). Zkuste prosím obnovit stránku.');
    }
    [
        'mobilePanel', 'toggleValDrawer', 'tabletPick', 'tabletNapady',
        'toggleDesktopPanel', 'napodyToggle', 'switchVal',
        'otevritPrejmenovani', 'otevritSmazani', 'otevritEditText'
    ].forEach(function(fn) {
        if (typeof window[fn] === 'undefined') {
            window[fn] = vzMainJsChybi;
        }
    });
})();
</script>

</body>
</html>
