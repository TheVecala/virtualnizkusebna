<?php session_start();
error_reporting(0);
require_once 'config.php';

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
  cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  transition: background .15s;
}
#topbar-val:hover { background: var(--border); }
#topbar-val::after {
  content: '';
  width: 0; height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid var(--muted);
  flex-shrink: 0;
}
.topnav { display: flex; gap: 2px; margin-left: auto; }
.topbar-mob-actions { display: none; gap: 2px; margin-left: auto; }
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
#nav-napady-tab {
  display: none; align-items: center; gap: 2px;
  color: var(--muted); font-size: 12px; padding: 5px 8px; text-decoration: none;
}
#nav-napady-tab.active { color: var(--barva); }

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

/* ── LOOPER BAR VÝRAZNÝ A VELKÝ ── */
#looper-bar {
  background: var(--tmava); 
  border-bottom: 1px solid var(--border);
  padding: 12px 16px; 
  display: flex; 
  flex-direction: column; 
  align-items: stretch; 
  gap: 12px; 
  flex-shrink: 0;
  transition: all .2s;
}
#looper-bar.hidden { display: none; }

.looper-ovladani-rada {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
}

.lctrl { display: flex; gap: 6px; flex-shrink: 0; }
.wave-btn {
  background: var(--card); border: 1px solid var(--border); color: var(--text);
  border-radius: 5px; padding: 6px 12px; cursor: pointer; font-size: 14px; transition: all .15s;
}
.wave-btn:hover, .wave-btn.on { border-color: var(--barva); color: var(--barva); }

#waveform-container{
    position:relative;
}

#looper-time{
    position:absolute;
    top:4px;
    right:8px;
    z-index:20;
    font-size:10px;
    font-family:monospace;
    color:rgba(255,255,255,.80);
    background:rgba(0,0,0,.25);
    padding:2px 5px;
    border-radius:4px;
    pointer-events:none;
    user-select:none;
	display: none;
}
#waveform-container .wf-placeholder {
  position: absolute; inset: 0; display: flex; align-items: center;
  padding: 0 12px; color: var(--muted); font-size: 12px;
}
#waveform { width: 100%; height: 100%; }

.lname {
  font-size: 13px; color: var(--text); font-weight: bold;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; 
  flex: 1; text-align: center;
}
.lclose {
  background: none; border: none; color: var(--muted); cursor: pointer;
  font-size: 22px; line-height: 1; padding: 0 4px; flex-shrink: 0;
}
.lclose:hover { color: var(--text); }

#looper-header{

    display:flex;
    align-items:center;
    justify-content:space-between;

    padding:6px 10px;

    background:#2b3035;
    border-bottom:1px solid #3d4349;
}

.looper-left{

    display:flex;
    align-items:center;
    gap:12px;
}

.looper-title{

    color:var(--barva);
    font-weight:700;
    letter-spacing:1px;
    white-space:nowrap;
}

.looper-buttons{

    display:flex;
    align-items:center;
    gap:5px;
}
 
.looper-right{

    display:flex;
    align-items:center;
    gap:5px;
}

#looper-content{

    padding:8px;

    overflow:hidden;

    max-height:600px;

    opacity:1;

    transition:
        max-height .18s ease,
        opacity .15s ease,
        padding .18s ease;
}

#looper-content.hidden{

    max-height:0;

    opacity:0;

    padding-top:0;
    padding-bottom:0;

    overflow:hidden;
}
#looper-notes{

    margin-top:10px;
}

/* ── CONTENT AREA ── */
#content-area { flex: 1; display: flex; overflow: hidden; }

.panel {
  display: flex; flex-direction: column; overflow: hidden;
  border-right: 1px solid var(--border);
}
.panel:last-child { border-right: none; }
#panel-text       { flex: 2; }
#panel-tabelatura { flex: 2; } /* Nový panel Tabelatura */
#panel-nahravky   { flex: 2; }
#panel-diskuse    { flex: 1.5; }
#panel-napady     { flex: 1.5; display: none; }

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
.btn-locked { opacity: 0.38; cursor: not-allowed !important; pointer-events: none; }
.btn-locked::after { content: ' 🔒'; font-size: 9px; }
.btn-vz.danger { background: #5a1a1a; border-color: #8a3a3a; color: #ff9999; }
.btn-vz.rec { animation: pulse 2s infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.75} }
.btn-vz.primary { background: #2a3a10; border-color: var(--barva); color: var(--barva); }

/* ── BOTTOM NAV ── */
#bottom-nav, #bottom-nav-tab {
  display: none; position: fixed; bottom: 0; left: 0; right: 0;
  height: var(--bottom-h); background: var(--tmava);
  border-top: 1px solid var(--border); z-index: 1000;
  justify-content: space-around; align-items: stretch;
}
.bnav {
  flex: 1; display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 4px; color: var(--muted); font-size: 10px;
  cursor: pointer; border: none; background: none; transition: all .15s;
  padding: 6px 0; text-align: center; line-height: 1.3;
}
.bnav img.bi {
  width: 24px;
  height: 24px;
  object-fit: contain;
  // opacity: 0.55;
  transition: all .15s ease-in-out;
}
.bnav:hover img.bi {
  opacity: 0.85;
}
.bnav.active { color: var(--accent); }
.bnav.active img.bi {
  opacity: 1;
  filter: drop-shadow(0 0 5px var(--accent));
}

/* ── SKLADBY (mobil): vizuálně oddělené od panelových tlačítek ── */
#bn-skladby {
  color: var(--barva);
  border: 1px solid var(--border);
  border-radius: 8px;
  margin: 5px 2px 5px 6px;
  background: rgba(255,255,255,0.03);
  flex-shrink: 0;
}
#bn-skladby + .bnav {
  border-left: 1px solid var(--border);
  margin-left: 3px;
}
/* bn-skladby nesdílí yellow active highlight */
#bn-skladby.active { color: var(--barva) !important; }

/* ── TABLET: dvě poloviny dolní lišty, každá se 4 tlačítky pro svůj panel ── */
.tab-footer { display: flex; flex: 1; }
.tab-footer .bnav { flex: 1; }
.tab-footer-divider { width: 1px; background: var(--border); flex-shrink: 0; margin: 8px 0; }

/* Val drawer (mobil) */
#val-drawer {
  display: none; position: fixed; bottom: var(--bottom-h); left: 0; 
  background: var(--tmava); border-top: 1px solid var(--border);
  max-height: calc(100vh - var(--top-h) - var(--bottom-h)); overflow-y: auto; z-index: 999; padding: 8px;
}
#val-drawer.open { display: block; }
.dval {
  display: flex; align-items: center; gap: 8px; padding: 10px 12px;
  border-radius: 6px; color: var(--muted); cursor: pointer; font-size: 13px; transition: all .15s;
}
.dval:hover { background: var(--card); color: var(--text); }
.dval.active { color: var(--barva); background: var(--card); }
.dval .val-nazev { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dval .val-actions { display: flex; gap: 3px; flex-shrink: 0; }
.drawer-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); padding: 4px 12px 8px; }


/* ── RESPONZIVNÍ ROZHRANÍ (MEDIA QUERIES) ── */

/* 1. MALÝ MOBIL (na výšku, do 767px): Pouze jeden panel */
@media (max-width: 767px) {
  #sidebar { display: none; }
  #main { margin-left: 0; margin-bottom: var(--bottom-h); height: calc(100vh - var(--top-h) - var(--bottom-h)); }
  #bottom-nav { display: flex; }
  #bottom-nav-tab { display: none; }
  .topnav { display: none; }
  .topbar-mob-actions { display: flex; }
  #nav-napady-tab { display: none; }
  #topbar-val { font-size: 11px; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #content-area { flex-direction: column; }
  .panel { display: none !important; border-right: none; border-bottom: 1px solid var(--border); }
  .panel.mob-active { display: flex !important; }
  #napady-fields { display: none; }
  #napady-fields.open { display: block; }
  #napady-toggle-btn { display: block !important; }
}

/* 2. STŘEDNÍ VARIANT (768px až 1199px): Přesně dva panely vedle sebe! */
@media (min-width: 768px) and (max-width: 1199px) {
  #sidebar { display: none; }
  #main { margin-left: 0; margin-bottom: var(--bottom-h); height: calc(100vh - var(--top-h) - var(--bottom-h)); }
  #bottom-nav { display: none; }
  #bottom-nav-tab { display: flex; }
  .topnav { display: none; }
  .topbar-mob-actions { display: flex; }
  #nav-napady-tab { display: inline-flex; }
  #content-area { flex-direction: row; }

  /* Skryjeme výchozí zobrazení všech */
  .panel { display: none !important; width: 50%; }

  /* Levá polovina — kterýkoli ze 4 typů obsahu, řízeno footerem levého panelu */
  #content-area[data-left="text"] #panel-text,
  #content-area[data-left="tabelatura"] #panel-tabelatura,
  #content-area[data-left="nahravky"] #panel-nahravky,
  #content-area[data-left="diskuse"] #panel-diskuse {
    display: flex !important; order: 1;
  }

  /* Pravá polovina — nezávisle na levé, řízeno footerem pravého panelu */
  #content-area[data-right="text"] #panel-text,
  #content-area[data-right="tabelatura"] #panel-tabelatura,
  #content-area[data-right="nahravky"] #panel-nahravky,
  #content-area[data-right="diskuse"] #panel-diskuse {
    display: flex !important; order: 2;
  }

  /* Nápady: solo režim přes celou šířku (otevřeno z horní lišty), nahrazuje obě poloviny */
  #content-area[data-napady-open] #panel-text,
  #content-area[data-napady-open] #panel-tabelatura,
  #content-area[data-napady-open] #panel-nahravky,
  #content-area[data-napady-open] #panel-diskuse {
    display: none !important;
  }
  #content-area[data-napady-open] #panel-napady {
    display: flex !important; width: 100%; order: 0;
  }
}

/* 3. DESKTOP (od 1200px): tři panely vedle sebe + trvalý sidebar */
@media (min-width: 1200px) {
  #sidebar { display: flex; }
  #main { margin-left: var(--sidebar-w); }
  #bottom-nav { display: none; }
  #bottom-nav-tab { display: none; }
  #content-area { flex-direction: row; }
  #topbar-val { cursor: default; pointer-events: none; }
  #topbar-val::after { display: none; }
  #panel-text, #panel-tabelatura, #panel-nahravky { display: flex; }
  #panel-diskuse { display: none; }
}

/* 4. XL (od 1800px): čtyři panely — přidají se i poznámky */
@media (min-width: 1800px) {
  #panel-diskuse { display: flex; }
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

.poznamky-loading
{
    padding: 12px;
    text-align: center;
    color: #999;
    font-style: italic;
}

.note-row
{
    transition: background-color .15s ease;
    border-radius: 4px;
	 cursor: pointer;
}

.note-row:hover
{
    background: rgba(127,191,255,.12);
}

.note-edit,
.note-delete
{
    opacity: .7;
    transition: opacity .15s;
}

.note-row:hover .note-edit,
.note-row:hover .note-delete
{
    opacity: 1;
}

.poznamky-toolbar
{
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
}

.poznamky-toolbar .fbtn
{
    flex: 0 1 180px;
}

/* ===========================
   Infografika looperu
   =========================== */

.looper-guide
{
    max-width: 520px;
    margin: 8px auto;
    font-size: 13px;
}

.looper-guide-row
{
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 6px 0;
}

.guide-text
{
    flex: 0 0 46%;
    line-height: 1.35;
}

.guide-arrow
{
    flex: 0 0 24px;
    text-align: center;
    font-size: 18px;
    color: #888;
}

.guide-preview
{
    flex: 1;
    min-height: 58px;

    border: 1px solid #555;
    border-radius: 6px;

    background: rgba(255,255,255,.03);
}

.guide-down
{
    text-align: center;
    font-size: 18px;
    color: #777;
    margin: 2px 0;
}

/* ---------- Mobil ---------- */

@media (max-width:700px)
{
    .looper-guide
    {
        font-size: 12px;
    }

    .guide-preview
    {
        min-height: 46px;
    }

    .guide-arrow
    {
        flex-basis: 18px;
        font-size: 16px;
    }

    .guide-down
    {
        font-size: 16px;
    }
}

#guide-preview-list
{
    display: flex;
    align-items: center;
    justify-content: center;
}

.guide-file
{
    display: flex;
    align-items: center;
    gap: 6px;

    padding: 4px 8px;

    border: 1px solid #555;
    border-radius: 4px;

    background: rgba(255,255,255,.05);

    font-size: 11px;
}

.guide-file img
{
    width: 18px;
    height: 18px;
    object-fit: contain;
}

#guide-preview-looper
{
    display:flex;
    align-items:center;
    justify-content:center;
}

.guide-looper-btn
{
    padding:4px 10px;
    border:1px solid #555;
    border-radius:5px;

    background:#333;
    color:#fff;

    font-size:11px;
    cursor:default;
    pointer-events:none;
} 

#guide-preview-wave
{
    display:flex;
    justify-content:center;
    align-items:center;
}
 
 
#guide-preview-wave
{
    display: flex;
    align-items: center;
    justify-content: center;
}

.guide-wave-image
{
    display: block;

    width: 100%;
    max-width: 170px;
    height: auto;

    border-radius: 4px;
} 
</style>
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
    <a href="#" class="active" id="nav-text"       onclick="toggleDesktopPanel('text',this);return false">text</a>
    <a href="#" class="active" id="nav-tabelatura" onclick="toggleDesktopPanel('tabelatura',this);return false">tabelatura</a>
    <a href="#" class="active" id="nav-nahravky"   onclick="toggleDesktopPanel('nahravky',this);return false">nahrávky</a>
    <a href="#" class="active" id="nav-diskuse"    onclick="toggleDesktopPanel('diskuse',this);return false">poznámky</a>
    <a href="#" id="nav-napady"                    onclick="toggleDesktopPanel('napady',this);return false">
      nápady <span class="napady-badge">DK</span>
    </a>
    <a href="#" data-toggle="modal" data-target="#myModal" style="color:var(--muted)">about</a>
    <a href="#" data-toggle="modal" data-target="#modal_logout" style="color:var(--muted)">odhlásit</a>
  </nav>
  <div class="topbar-mob-actions">
    <a href="#" id="nav-napady-tab" onclick="tabletNapady(this);return false">nápady <span class="napady-badge">DK</span></a>
    <a href="#" data-toggle="modal" data-target="#myModal" style="color:var(--muted);font-size:12px;padding:5px 8px;text-decoration:none;">about</a>
    <a href="#" data-toggle="modal" data-target="#modal_logout" style="color:var(--muted);font-size:12px;padding:5px 8px;text-decoration:none;">odhlásit</a>
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
                    onclick="looperLoop()">⟳</button>

            <button class="wave-btn"
                    onclick="looperRestart()">↺</button>

        </div>

    </div>



    <div class="looper-right">

        <button class="wave-btn"
                id="btn-collapse"
                onclick="looperToggle()">▭</button>

        <button class="wave-btn"
                onclick="looperZavrit()">✕</button>

    </div>

</div>

    <!-- OBSAH -->
    <div id="looper-content" class="hidden">
        <div id="waveform-container">
	        <div id="looper-time">
               00:00 / 00:00
            </div>

<div id="wf-placeholder">

    <div class="looper-guide">

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

        </div>

        <div id="looper-notes"></div>

    </div>

</div>

  <!-- CONTENT AREA (Přidán výchozí atribut data-active-panel pro správný start 2-panelové verze) -->
  <div id="content-area" data-active-panel="text">

    <!-- PANEL TEXT -->
    <div class="panel mob-active" id="panel-text">
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

    <!-- PANEL NAHRÁVKY -->
    <div class="panel" id="panel-nahravky">
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
<?php require "meat/modals.php"; ?>

<!-- ── BOTTOM NAV ── -->
<div id="bottom-nav">
  <button class="bnav" id="bn-skladby" onclick="toggleValDrawer()">
    <img src="meat/ikona_skladby.png" class="bi" alt="skladby">skladby
  </button>
  <button class="bnav active" id="bn-text" onclick="mobilePanel('text',this)">
    <img src="meat/ikona_text.png" class="bi" alt="text">text
  </button>
  <button class="bnav" id="bn-tabelatura" onclick="mobilePanel('tabelatura',this)">
    <img src="meat/drinking2.png" class="bi" alt="tabelatura">taby
  </button>
  
  <button class="bnav" id="bn-nahravky" onclick="mobilePanel('nahravky',this)">
    <img src="meat/ikona_nahravky.png" class="bi" alt="nahrávky">nahrávky
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
    <button class="bnav active" data-panel="text" onclick="tabletPick('left','text',this)">
      <img src="meat/ikona_text.png" class="bi" alt="text">text
    </button>
    <button class="bnav" data-panel="tabelatura" onclick="tabletPick('left','tabelatura',this)">
      <img src="meat/drinking2.png" class="bi" alt="tabelatura">taby
    </button>
    <button class="bnav" data-panel="nahravky" onclick="tabletPick('left','nahravky',this)">
      <img src="meat/ikona_nahravky.png" class="bi" alt="nahrávky">nahrávky
    </button>
    <button class="bnav" data-panel="diskuse" onclick="tabletPick('left','diskuse',this)">
      <img src="meat/ikona_diskuse.png" class="bi" alt="diskuse">diskuse
    </button>
  </div>
  <div class="tab-footer-divider"></div>
  <div class="tab-footer" id="tab-footer-right">
    <button class="bnav" data-panel="text" onclick="tabletPick('right','text',this)">
      <img src="meat/ikona_text.png" class="bi" alt="text">text
    </button>
    <button class="bnav active" data-panel="tabelatura" onclick="tabletPick('right','tabelatura',this)">
      <img src="meat/drinking2.png" class="bi" alt="tabelatura">taby
    </button>
    <button class="bnav" data-panel="nahravky" onclick="tabletPick('right','nahravky',this)">
      <img src="meat/ikona_nahravky.png" class="bi" alt="nahrávky">nahrávky
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

<!-- ── SKRIPTY ── -->
<script src="https://code.jquery.com/jquery-3.7.1.min.js" crossorigin="anonymous"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js" crossorigin="anonymous"></script>
<script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js" crossorigin="anonymous"></script>

<!-- Aktuální a stabilní verze WaveSurfer.js v7 -->
<script src="https://unpkg.com/wavesurfer.js@7"></script>
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
    
    function aktivovatSortable(idKontejneru, tridaPolozky) {
        var el = document.getElementById(idKontejneru);
        if (el) {
            var sortable = Sortable.create(el, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                delay: 150, // Zpoždění pro myš i mobil
                delayOnTouchOnly: true, // delay se aplikuje jen na dotyk, ne na myš
                // Povolíme tahání POUZE pro prvky s touto třídou (hlavička zůstane přibitá)
                draggable: '.' + tridaPolozky,
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

    // Aktivujeme přetahování a předáme třídy písniček
    aktivovatSortable('val-drawer', 'dval');           // Mobilní menu
    aktivovatSortable('sidebar-playlist', 'val-item'); // Desktopový panel
});
</script>

<!-- OVLÁDÁNÍ A INICIALIZACE WAVESURFER LOOPERU (s peaks cachováním) -->
<script>
var wavesurfer = null;
var isLooping = false;
var looperCurrentFile = null;

/**
 * Vytvoří a inicializuje WaveSurfer instanci.
 *
 * @param {string} cesta     - relativní URL audio souboru
 * @param {object|null} peaksData - { peaks: [[...]], duration: X } nebo null
 */
function initWaveSurfer(cesta, peaksData) {
    var barvaKapely = getComputedStyle(document.documentElement)
                        .getPropertyValue('--barva').trim() || '#a7ac38';

    var wsConfig = {
        container:     '#waveform',
        waveColor:     '#b8b8b8',
        progressColor: barvaKapely,
        cursorColor:   '#ffffff',
        cursorWidth:   2,
        barWidth:      2,
        barGap:        1,
        barRadius:     1,
        height:        98,
        url:           cesta
    };

    // Pokud máme uložené peaks, předáme je WaveSurferu →
    // audio se NEKÓDUJE znovu, vykreslení je okamžité
    var maPeaks = peaksData &&
                  Array.isArray(peaksData.peaks) &&
                  peaksData.peaks.length > 0 &&
                  peaksData.duration > 0;

    if (maPeaks) {
        wsConfig.peaks    = peaksData.peaks;
        wsConfig.duration = peaksData.duration;
    }

    wavesurfer = WaveSurfer.create(wsConfig);

    wavesurfer.on('ready', function() {
        $('#wf-placeholder').hide();
		$('#looper-time').show();
        wavesurfer.play();
        var delka = wavesurfer.getDuration();

		$('#looper-time').text(
			formatTime(0) + ' / ' + formatTime(delka)
		);
        // Peaks ještě nebyly uloženy → exportujeme a pošleme na server
        if (!maPeaks) {
            var peaks    = wavesurfer.exportPeaks();
            var duration = wavesurfer.getDuration();

            if (Array.isArray(peaks) && peaks.length > 0 && duration > 0) {
                $.ajax({
                    url:         'php/ajax/ulozit_peaks.php',
                    method:      'POST',
                    contentType: 'application/json',
                    data:        JSON.stringify({ cesta: cesta, peaks: peaks, duration: duration }),
                    error: function() {
                        console.warn('[Looper] Peaks se nepodařilo uložit.');
                    }
                });
            }
        }
    });

    wavesurfer.on('play', function() {
        $('#btn-play').addClass('on');
        $('#btn-pause').removeClass('on');
    });

    wavesurfer.on('pause', function() {
        $('#btn-play').removeClass('on');
        $('#btn-pause').addClass('on');
    });

    wavesurfer.on('finish', function() {
        if (isLooping) {
            wavesurfer.play();
        } else {
            $('#btn-play').removeClass('on');
            $('#btn-pause').addClass('on');
        }
    });
	
	wavesurfer.on('timeupdate', function(sec){

    $('#looper-time').text(

        formatTime(sec)

        +

        ' / '

        +

        formatTime(
            wavesurfer.getDuration()
        )

    );

});
}

// Odpojení jakýchkoliv starých click eventů na looper-btn a připojení nových
$(document).off('click', '.looper-btn').on('click', '.looper-btn', function() {
    var cesta = $(this).data('cesta');
    var nazev = $(this).data('nazev');

    looperCurrentFile = cesta;
    loadLooperNotes(cesta);

    // Zobrazíme looper bar a resetujeme stav
    $('#looper-bar').removeClass('hidden');
	$('#looper-content').removeClass('hidden');
    $('#btn-collapse').html('▭');
    $('#lname').text(nazev);
    $('#wf-placeholder').text('načítám nahrávku...').show();

    isLooping = false;
    $('#btn-loop').removeClass('on');

    if (wavesurfer) {
        wavesurfer.destroy();
        wavesurfer = null;
    }

    // Zkusíme načíst uložené peaks ze serveru.
    // .done()  → peaks existují → WaveSurfer vykreslí okamžitě bez dekódování audia
    // .fail()  → peaks neexistují (404) nebo chyba → standardní dekódování, peaks se poté uloží
    $.getJSON('php/ajax/nacist_peaks.php', { cesta: cesta })
        .done(function(peaksData) {
            initWaveSurfer(cesta, peaksData);
        })
        .fail(function() {
            initWaveSurfer(cesta, null);
        });
});

/* --- Globální funkce pro tlačítka v looper-baru --- */
function formatTime(sec)
{
    sec = Math.floor(sec);

    let m = Math.floor(sec / 60);
    let s = sec % 60;

    return (
        (m < 10 ? '0' : '') + m +
        ':' +
        (s < 10 ? '0' : '') + s
    );
}

function looperPlay() {
    if (wavesurfer) wavesurfer.play();
}

function looperPause() {
    if (wavesurfer) wavesurfer.pause();
}

function looperRestart() {
    if (wavesurfer) {
        wavesurfer.setTime(0);
        wavesurfer.play();
    }
}

function looperLoop() {
    isLooping = !isLooping;
    if (isLooping) {
        $('#btn-loop').addClass('on');
    } else {
        $('#btn-loop').removeClass('on');
    }
}

function looperToggle()
{
    $('#looper-content').toggleClass('hidden');

    if ($('#looper-content').hasClass('hidden'))
    {
        $('#btn-collapse').html('▼');
    }
    else
    {
        $('#btn-collapse').html('▲');
    }
}

function looperZavrit() {
    if (wavesurfer) {
        wavesurfer.pause();
        wavesurfer.destroy();
        wavesurfer = null;
		$('#wf-placeholder').show();
	
    }
    looperCurrentFile = null;
    $('#looper-notes').hide().empty();
  	//$('#looper-content').removeClass('hidden');
    $('#btn-collapse').html('▼');
    $('#looper-time').text('00:00 / 00:00').hide();
    $('#looper-content').addClass('hidden');
    isLooping = false;
    $('#btn-loop').removeClass('on');
	

}

if ($('#looper-content').hasClass('hidden'))
{
    $('#btn-collapse').html('▼');
}
else
{
    $('#btn-collapse').html('▲');
}

</script>

<!-- ── BEZPEČNÝ FALLBACK PRO NAVIGAČNÍ FUNKCE ── -->
<script>
$(document).on('click', '.bnav', function() {
    var id = $(this).attr('id');
    if (!id || id === 'bn-skladby') return;
    var panelId = id.replace('bn-', '');
    $('#content-area').attr('data-active-panel', panelId);
});

if (typeof mobilePanel === 'undefined') {
    window.mobilePanel = function(panelId, btn) {
        $('.panel').removeClass('mob-active');
        $('#panel-' + panelId).addClass('mob-active');

        $('.bnav:not(#bn-skladby)').removeClass('active');
        if (btn) {
            $(btn).addClass('active');
        } else {
            $('#bn-' + panelId).addClass('active');
        }
        VZ.aktivniMobPanel = panelId;
        $('#val-drawer').removeClass('open');
        $('#content-area').attr('data-active-panel', panelId);
    };
}

if (typeof toggleValDrawer === 'undefined') {
    window.toggleValDrawer = function() {
        $('#val-drawer').toggleClass('open');
    };
}

if (typeof tabletPick === 'undefined') {
    window.tabletPick = function(strana, panelId, btn) {
        var druha = strana === 'left' ? 'right' : 'left';
        if (typeof VZ === 'undefined') return;
        VZ.tabPanels = VZ.tabPanels || { left: 'text', right: 'tabelatura' };
        var aktualni = VZ.tabPanels;

        if (aktualni[druha] === panelId) {
            aktualni[druha] = aktualni[strana];
            $('#tab-footer-' + druha + ' .bnav').removeClass('active');
            $('#tab-footer-' + druha + ' .bnav[data-panel="' + aktualni[druha] + '"]').addClass('active');
        }
        aktualni[strana] = panelId;

        var $ca = $('#content-area');
        $ca.removeAttr('data-napady-open');
        $ca.attr('data-left', aktualni.left);
        $ca.attr('data-right', aktualni.right);
        $('#nav-napady-tab').removeClass('active');

        if (btn) {
            $('#tab-footer-' + strana + ' .bnav').removeClass('active');
            $(btn).addClass('active');
        }
    };
}

if (typeof tabletNapady === 'undefined') {
    window.tabletNapady = function(link) {
        var jeOtevreno = $(link).hasClass('active');
        if (jeOtevreno) {
            $(link).removeClass('active');
            $('#content-area').removeAttr('data-napady-open');
        } else {
            $(link).addClass('active');
            $('#content-area').attr('data-napady-open', '1');
        }
    };
}

if (typeof toggleDesktopPanel === 'undefined') {
    window.toggleDesktopPanel = function(panelId, btn) {
        var $panel = $('#panel-' + panelId);
        var $btn   = $(btn);
        if ($panel.is(':visible')) {
            $panel.hide();
            $btn.removeClass('active');
        } else {
            $panel.css('display', 'flex');
            $btn.addClass('active');
        }
    };
}

if (typeof napodyToggle === 'undefined') {
    window.napodyToggle = function() {
        $('#napady-fields').toggleClass('open');
    };
}

if (typeof switchVal === 'undefined') {
    window.switchVal = function(valId, nazev, element) {
        $('#progress-bar').addClass('loading');
        $('.val-item').removeClass('active');
        if (element) {
            $(element).addClass('active');
        } else {
            $('.val-item[data-id="' + valId + '"]').addClass('active');
        }
        $('#val-drawer').removeClass('open');
        
        $.ajax({
            url: 'php/nastav_val.php',
            method: 'POST',
            data: { val: valId },
            success: function() {
                VZ.aktualniVal = valId;
                VZ.aktualniNazev = nazev;
                $('#topbar-val').text(nazev);
                $('#diskuse-val-label').text(nazev);
                location.reload(); 
            },
            error: function() {
                $('#progress-bar').removeClass('loading');
                $('#topbar-val').text(nazev);
                $('#diskuse-val-label').text(nazev);
            }
        });
    };
}

if (typeof otevritPrejmenovani === 'undefined') {
    window.otevritPrejmenovani = function(id, nazev) {
        $('#modal_prejmenovat input[name="slozka"]').val(id);
        $('#modal_prejmenovat input[name="novy_nazev"]').val(nazev);
        $('#modal_prejmenovat').modal('show');
    };
}

if (typeof otevritSmazani === 'undefined') {
    window.otevritSmazani = function(id) {
        $('#modal_smazat input[name="slozka"]').val(id);
        $('#modal_smazat').modal('show');
    };
}

if (typeof otevritEditText === 'undefined') {
    // Upravený fallback s parametrem typ
    window.otevritEditText = function(typ) {
        $('#modal_zmenit_text').modal('show');
    };
}

function loadLooperNotes(filePath)
{
    $.post(
        'php/ajax/ajax_nahravka_poznamky.php',
        {
            akce: 'list',
            file_path: filePath,
            looper: 1
        },
        function(html)
        {
            $('#looper-notes')
                .html(html)
                .show();
        }
    );
}

 function jumpToTimestamp(ms, filePath)
{
    $('.poznamky-panel').each(function() {

        if ($(this).data('cesta') !== filePath)
        {
            return;
        }

        let audio = $(this)
            .closest('.nahravka-vysuvna')
            .find('audio')[0];

        if (audio)
        {
            audio.currentTime = ms / 1000;
        }
    });
}




</script>

<script src="meat/main.js"></script>

</body>
</html>