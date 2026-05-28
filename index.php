 <?php session_start();
error_reporting(0);

// Inicializace SESSION barev
$_SESSION['barva1']     = $_SESSION['barva1']     ?? "a7ac38";
$_SESSION['barva_pozadi'] = $_SESSION['barva_pozadi'] ?? "202428";


/* ── HARDCODED CONFIGURATION PRO SINGLE-BAND VERZI ── */
// !!! TADY ZKONTROLUJ PŘESNOU SHODU S FTP (i malá/velká písmena) !!!
$single_login             = "kapela";             
$single_kapela            = "kapela";       // Název složky v user/
$single_befelemepesseveze = "471707760"; // Přesný název vnitřní složky

$globalni_heslo_kapely    = "krpole";      // Tvoje heslo pro vstup
/* ─────────────────────────────────────────────────── */


// Zpracování odeslaného formuláře z loginboxu
if (isset($_POST['submit_single'])) {
    $zadani_hesla = $_POST['heslo'] ?? '';
    
    if ($zadani_hesla === $globalni_heslo_kapely) {
        $_SESSION['logged_in_single'] = true;
        unset($_SESSION['chyba_prihlaseni_single']);
    } else {
        $_SESSION['chyba_prihlaseni_single'] = "wrong_heslo";
    }
}


// Kontrola, zda je uživatel přihlášen
if (empty($_SESSION['logged_in_single'])) {
    require "php/loginbox4.php";
    exit;
}

// Pokud přihlášen JE, podstrčíme systému identitu tvé kapely
$_SESSION['login']             = $single_login;
$_SESSION['kapela']            = $single_kapela;
$_SESSION['befelemepesseveze'] = $single_befelemepesseveze;


// Nastavit lokální proměnné
$login             = $_SESSION['login'];
$kapela            = $_SESSION['kapela']            ?? "";
$befelemepesseveze = $_SESSION['befelemepesseveze'] ?? "";
$sekce             = "uploads";
$aktualni_text     = $_SESSION['aktualni_text']     ?? "akordy.txt";
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
      integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
<link href="/css/sticky-footer-navbar.css" rel="stylesheet">
<style>
/* ── Proměnné ── */
:root {
  --barva:     #<?php echo $_SESSION['barva1'] ?>;
  --pozadi:    #<?php echo $_SESSION['barva_pozadi'] ?>;
  --tmava:     #1a1d20;
  --card:      #2a2e33;
  --border:    #3a3e44;
  --text:      #e0e0e0;
  --muted:     #888;
  --accent:    #ffc107;
  --sidebar-w: 220px;
  --bottom-h:  58px;
  --top-h:     46px;
}

*, *::before, *::after { box-sizing: border-box; }
body { background: var(--pozadi); color: var(--text); font-family: sans-serif; font-size: 14px; margin: 0; }

/* ── TOPBAR ── */
#topbar {
  position: fixed; top: 0; left: 0; right: 0; height: var(--top-h);
  background: var(--tmava); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; padding: 0 12px; gap: 10px; z-index: 1000;
}
.brand { font-weight: bold; color: var(--barva); letter-spacing: 1px; font-size: 13px; white-space: nowrap; }
.topbar-sep { color: var(--border); }
.kapela-chip { font-size: 12px; color: var(--muted); white-space: nowrap; }
#topbar-val {
  font-size: 12px; color: var(--text);
  background: var(--card); border: 1px solid var(--border);
  border-radius: 5px; padding: 2px 9px; white-space: nowrap;
}
#topbar-val::before { content: '🎵 '; }
.topnav { display: flex; gap: 2px; margin-left: auto; }
.topnav a {
  color: var(--muted); text-decoration: none; font-size: 12px;
  padding: 5px 10px; border-radius: 5px; transition: all .15s; white-space: nowrap;
}
.topnav a:hover { color: var(--text); background: var(--card); }
.topnav a.active { color: var(--accent); background: var(--card); }
.napady-badge {
  background: #2a3a10; color: #a7d050; border: 1px solid #4a6a20;
  border-radius: 8px; padding: 0 5px; font-size: 10px; margin-left: 3px;
}

/* ── SIDEBAR ── */
#sidebar {
  position: fixed; top: var(--top-h); left: 0; bottom: 0; width: var(--sidebar-w);
  background: var(--tmava); border-right: 1px solid var(--border);
  display: flex; flex-direction: column; z-index: 900; overflow: hidden;
}
.sidebar-label {
  font-size: 10px; text-transform: uppercase; letter-spacing: 1px;
  color: var(--muted); padding: 10px 14px 4px; flex-shrink: 0;
}
#sidebar-playlist { flex: 1; overflow-y: auto; padding: 0 8px; }
.val-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: 6px; cursor: pointer;
  font-size: 13px; color: var(--muted); transition: all .15s; position: relative;
}
.val-item:hover { background: var(--card); color: var(--text); }
.val-item.active { background: var(--card); color: var(--barva); font-weight: 500; }
.val-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--muted); flex-shrink: 0; }
.val-item.active .val-dot { background: var(--barva); }
.val-nazev { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.val-actions { display: none; gap: 3px; flex-shrink: 0; }
.val-item:hover .val-actions { display: flex; }
.val-actions button {
  background: none; border: 1px solid var(--border); color: var(--muted);
  border-radius: 3px; padding: 1px 5px; font-size: 10px; cursor: pointer; transition: all .15s;
}
.val-actions button:hover { color: var(--accent); border-color: var(--accent); }
.sidebar-add {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 7px 10px; border-radius: 6px; cursor: pointer;
  font-size: 12px; color: var(--muted); transition: all .15s;
  border: 1px dashed var(--border); margin: 6px 8px; flex-shrink: 0;
}
.sidebar-add:hover { border-color: var(--barva); color: var(--barva); }

/* ── MAIN ── */
#main {
  margin-left: var(--sidebar-w); margin-top: var(--top-h);
  display: flex; flex-direction: column; height: calc(100vh - var(--top-h)); overflow: hidden;
}

/* ── LOOPER BAR ── */
#looper-bar {
  background: var(--tmava); border-bottom: 1px solid var(--border);
  padding: 8px 12px; display: flex; align-items: center; gap: 8px; flex-shrink: 0;
  transition: all .2s;
}
#looper-bar.hidden { display: none; }
.lctrl { display: flex; gap: 5px; flex-shrink: 0; }
.wave-btn {
  background: var(--card); border: 1px solid var(--border); color: var(--text);
  border-radius: 5px; padding: 4px 9px; cursor: pointer; font-size: 12px; transition: all .15s;
}
.wave-btn:hover, .wave-btn.on { border-color: var(--barva); color: var(--barva); }
#waveform-container {
  flex: 1; height: 40px; background: var(--card);
  border-radius: 5px; border: 1px solid var(--border);
  position: relative; overflow: hidden; min-width: 0;
}
/* Placeholder dokud není wavesurfer */
#waveform-container .wf-placeholder {
  position: absolute; inset: 0; display: flex; align-items: center;
  padding: 0 12px; color: var(--muted); font-size: 11px;
}
#waveform { width: 100%; height: 100%; }
.lname {
  font-size: 11px; color: var(--muted); white-space: nowrap;
  max-width: 130px; overflow: hidden; text-overflow: ellipsis; flex-shrink: 0;
}
.lclose {
  background: none; border: none; color: var(--muted); cursor: pointer;
  font-size: 18px; line-height: 1; padding: 0 4px; flex-shrink: 0;
}
.lclose:hover { color: var(--text); }

/* ── CONTENT AREA ── */
#content-area { flex: 1; display: flex; overflow: hidden; }

.panel {
  display: flex; flex-direction: column; overflow: hidden;
  border-right: 1px solid var(--border);
}
.panel:last-child { border-right: none; }
#panel-text     { flex: 2; }
#panel-nahravky { flex: 2; }
#panel-diskuse  { flex: 1.5; }
#panel-napady   { flex: 1; display: none; }

.panel-header {
  padding: 8px 12px; background: var(--tmava);
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: 8px; flex-shrink: 0;
}
.panel-header h2 {
  color: var(--accent); font-weight: bold; font-size: 11px;
  text-shadow: 1px -1px 5px var(--accent); letter-spacing: 1px; margin: 0;
}
.panel-header .acts { margin-left: auto; display: flex; gap: 5px; }

.panel-body { flex: 1; overflow-y: auto; padding: 12px; }

/* Loading spinner */
.panel-loading {
  display: flex; align-items: center; justify-content: center;
  height: 80px; color: var(--muted); font-size: 12px; gap: 8px;
}
.spinner {
  width: 16px; height: 16px; border: 2px solid var(--border);
  border-top-color: var(--barva); border-radius: 50%;
  animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── BTNS ── */
.btn-vz {
  border-radius: 5px; padding: 3px 9px; font-size: 11px; cursor: pointer;
  border: 1px solid var(--border); background: var(--card); color: var(--text);
  transition: all .15s; white-space: nowrap;
}
.btn-vz:hover { border-color: var(--barva); color: var(--barva); }
.btn-vz.danger { background: #5a1a1a; border-color: #8a3a3a; color: #ff9999; }
.btn-vz.rec { animation: pulse 2s infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.75} }
.btn-vz.primary { background: #2a3a10; border-color: var(--barva); color: var(--barva); }

/* ── BOTTOM NAV ── */
#bottom-nav {
  display: none; position: fixed; bottom: 0; left: 0; right: 0;
  height: var(--bottom-h); background: var(--tmava);
  border-top: 1px solid var(--border); z-index: 1000;
  justify-content: space-around; align-items: stretch;
}
.bnav {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 2px; color: var(--muted); font-size: 10px;
  cursor: pointer; border: none; background: none; transition: all .15s;
}
.bnav .bi { font-size: 20px; }
.bnav.active { color: var(--accent); }

/* Val drawer (mobil) */
#val-drawer {
  display: none; position: fixed; bottom: var(--bottom-h); left: 0; right: 0;
  background: var(--tmava); border-top: 1px solid var(--border);
  max-height: 55vh; overflow-y: auto; z-index: 999; padding: 8px;
}
#val-drawer.open { display: block; }
.dval {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px;
  border-radius: 6px; color: var(--muted); cursor: pointer; font-size: 13px; transition: all .15s;
}
.dval:hover { background: var(--card); color: var(--text); }
.dval.active { color: var(--barva); background: var(--card); }
.drawer-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); padding: 4px 12px 8px; }

/* ── RESPONSIVE ── */
@media (max-width: 768px) {
  #sidebar { display: none; }
  #main { margin-left: 0; margin-bottom: var(--bottom-h); height: calc(100vh - var(--top-h) - var(--bottom-h)); }
  #bottom-nav { display: flex; }
  .topnav { display: none; }
  #topbar-val { font-size: 11px; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #content-area { flex-direction: column; }
  .panel { display: none !important; border-right: none; border-bottom: 1px solid var(--border); }
  .panel.mob-active { display: flex !important; }
  /* Na mobilu skrýt celý formulář, zobrazit toggle tlačítko */
  #napady-fields { display: none; }
  #napady-fields.open { display: block; }
  #napady-toggle-btn { display: block !important; }
}
@media (min-width: 769px) {
  #panel-text, #panel-nahravky, #panel-diskuse { display: flex; }
}

/* ── Progress bar ── */
#progress-bar {
  position: fixed; top: var(--top-h); left: 0; right: 0;
  height: 3px; z-index: 2000; pointer-events: none;
  opacity: 0; transition: opacity .2s;
}
#progress-bar.loading {
  opacity: 1;
  background: linear-gradient(90deg, var(--barva) 0%, #ffc107 50%, var(--barva) 100%);
  background-size: 200% 100%;
  animation: pb-slide 1.2s linear infinite;
}
#progress-bar.done {
  opacity: 0;
  background: var(--barva);
  transition: opacity .5s ease .2s;
  animation: none;
}
@keyframes pb-slide {
  0%   { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

.sortable-ghost {
  opacity: 0.4;
  background: var(--barva) !important;
  color: var(--tmava) !important;
}

</style>
</head>
<body>

<!-- Progress bar -->
<div id="progress-bar"></div>

<!-- ── TOPBAR ── -->
<div id="topbar">
  <span class="brand">VZ</span>
  <span class="topbar-sep">/</span>
  <span class="kapela-chip"><?php echo htmlspecialchars($login); ?></span>
  <span class="topbar-sep">/</span>
  <span id="topbar-val"><?php echo htmlspecialchars($nazev_valu); ?></span>
  <nav class="topnav">
    <a href="#" class="active" id="nav-main" onclick="desktopView('main',this);return false">text + nahrávky</a>
    <a href="#" id="nav-napady" onclick="desktopView('napady',this);return false">
      nápady <span class="napady-badge">kapela</span>
    </a>
    <a href="#" data-toggle="modal" data-target="#myModal" style="color:var(--muted)">about</a>
    <a href="#" data-toggle="modal" data-target="#modal_logout" style="color:var(--muted)">odhlásit</a>
  </nav>
</div>

<!-- ── SIDEBAR ── -->
 <div id="sidebar">
  <div class="sidebar-label" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px 4px;">
    <span>Skladby</span>
    <button class="btn-vz" data-toggle="modal" data-target="#modal_nova_slozka" style="padding: 2px 6px; font-size: 10px;">+ nová</button>
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
      <span class="val-dot"></span>
      <span class="val-nazev"><?php echo htmlspecialchars($nazev_s); ?></span>
      <div class="val-actions">
        <button onclick="event.stopPropagation();otevritPrejmenovani('<?php echo htmlspecialchars($s, ENT_QUOTES); ?>','<?php echo htmlspecialchars($nazev_s, ENT_QUOTES); ?>')" title="přejmenovat">✏</button>
        <button onclick="event.stopPropagation();otevritSmazani('<?php echo htmlspecialchars($s, ENT_QUOTES); ?>')" title="smazat">🗑</button>
      </div>
    </div>
    <?php endforeach; ?>
  </div>
</div>

<!-- ── MAIN ── -->
<div id="main">

  <!-- LOOPER BAR -->
  <div id="looper-bar" class="hidden">
    <div class="lctrl">
      <button class="wave-btn on" id="btn-play" onclick="looperPlay()">▶</button>
      <button class="wave-btn" id="btn-pause" onclick="looperPause()">⏸</button>
      <button class="wave-btn" onclick="looperRestart()">↩</button>
      <button class="wave-btn" id="btn-loop" onclick="looperLoop()">⟳</button>
    </div>
    <div id="waveform-container">
      <div class="wf-placeholder" id="wf-placeholder">načítám...</div>
      <div id="waveform"></div>
    </div>
    <span class="lname" id="lname">—</span>
    <button class="lclose" onclick="looperZavrit()">✕</button>
  </div>

  <!-- CONTENT AREA -->
  <div id="content-area">

    <!-- PANEL TEXT -->
    <div class="panel mob-active" id="panel-text">
      <div class="panel-header">
        <h2>TEXT</h2>
        <div class="acts">
          <button class="btn-vz" onclick="otevritEditText()">změnit</button>
        </div>
      </div>
      <div class="panel-body" id="body-text">
        <div class="panel-loading"><div class="spinner"></div>načítám...</div>
      </div>
    </div>

    <!-- PANEL NAHRÁVKY -->
    <div class="panel" id="panel-nahravky">
      <div class="panel-header">
        <h2>NAHRÁVKY</h2>
        <div class="acts">
          <button class="btn-vz" data-toggle="modal" data-target="#modal_vlozit_soubor">⬆ vložit</button>
          <button class="btn-vz danger rec" data-toggle="modal" data-target="#modal_nahrat_zvuk">⏺ REC</button>
        </div>
      </div>
      <div class="panel-body" id="body-nahravky">
        <div class="panel-loading"><div class="spinner"></div>načítám...</div>
      </div>
    </div>

    <!-- PANEL DISKUSE -->
    <div class="panel" id="panel-diskuse">
      <div class="panel-header">
        <h2>DISKUSE</h2>
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
<?php require "meat/modals.php"; ?>

<!-- ── BOTTOM NAV ── -->
<div id="bottom-nav">
  <button class="bnav active" id="bn-skladby" onclick="toggleValDrawer()">
    <span class="bi">🎵</span>skladby
  </button>
  <button class="bnav" id="bn-text" onclick="mobilePanel('text',this)">
    <span class="bi">📝</span>text
  </button>
  <button class="bnav" id="bn-nahravky" onclick="mobilePanel('nahravky',this)">
    <span class="bi">🎙</span>nahrávky
  </button>
  <button class="bnav" id="bn-diskuse" onclick="mobilePanel('diskuse',this)">
    <span class="bi">💬</span>diskuse
  </button>
  <button class="bnav" id="bn-napady" onclick="mobilePanel('napady',this)">
    <span class="bi">💡</span>nápady
  </button>
</div>

<!-- VAL DRAWER (mobil) -->
<div id="val-drawer" class="seznam-skladeb">
  
  <div class="drawer-header nodrag" style="padding: 8px 12px; border-bottom: 1px solid var(--border); margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
      <span style="font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px;">Seznam skladeb</span>
      <button class="btn-vz" data-toggle="modal" data-target="#modal_nova_slozka" onclick="document.getElementById('val-drawer').classList.remove('open')">
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
    <span>🎵</span><?php echo htmlspecialchars($nazev_s); ?>
  </div>
  <?php endforeach; ?>

</div>

<!-- ── SKRIPTY ── -->
<script src="https://code.jquery.com/jquery-3.7.1.min.js" crossorigin="anonymous"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js" crossorigin="anonymous"></script>
<script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js" crossorigin="anonymous"></script>
<!-- wavesurfer (zakomentovaný, připravený)
<script src="https://unpkg.com/wavesurfer.js"></script>
<script src="https://unpkg.com/wavesurfer.js/dist/plugin/wavesurfer.regions.min.js"></script>
-->
<script src="https://cdn.jsdelivr.net/npm/sortablejs@latest/Sortable.min.js"></script>

<script>
// Inicializace stavových proměnných z PHP — přístupné přes objekt VZ
var VZ = {
  aktualniVal:   <?php echo json_encode($slozka_souboru); ?>,
  aktualniNazev: <?php echo json_encode($nazev_valu); ?>,
  aktivniMobPanel: 'text'
};
</script>

 <script>
// Inicializace SortableJS po načtení stránky
document.addEventListener('DOMContentLoaded', function() {
    
    // Funkce, která naučí Drag & Drop jakýkoliv seznam
    function aktivovatSortable(idKontejneru) {
        var el = document.getElementById(idKontejneru);
        if (el) {
            var sortable = Sortable.create(el, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                delay: 100, 
                // delayOnTouchOnly: true, // Na myši reaguje ihned, na dotyk s malým zpožděním (aby šlo scrollovat)
                draggable: '.dval',
				filter: '.nodrag, button',
				preventOnFilter: true,
                onEnd: function (evt) {
                    var novePoradi = sortable.toArray();
                    
                    $.ajax({
                        url: '/php/uloz_poradi.php',
                        method: 'POST',
                        data: { poradi: novePoradi },
                        success: function(response) {
                            console.log('Nové pořadí bylo uloženo z panelu: ' + idKontejneru);
                        },
                        error: function() {
                            alert('Chyba při ukládání pořadí. Zkuste to znovu.');
                        }
                    });
                }
            });
        }
    }

    // Aktivujeme přetahování pro oba seznamy!
    aktivovatSortable('val-drawer');      // Mobilní menu
    aktivovatSortable('sidebar-playlist'); // Desktopový levý panel
});
</script>

<script src="/meat/main.js"></script>

</body>
</html>

