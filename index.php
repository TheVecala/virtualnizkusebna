<?php
declare(strict_types=1);
$maintenanceMode = false; // true = zapnuto, false = vypnuto
if ($maintenanceMode) {
    header('Location: maintenance.html', true, 302);
    exit;
}

require_once __DIR__ . '/php/inc/session.php';
app_session_start();
header('Cache-Control: no-store');
require_once __DIR__.'/config.php';
require_once __DIR__.'/php/inc/vz2_core.php';
try{
    vz2_ready();
    if(($_SESSION['logged_in_single']??false)!==true){
        $query=['v'=>'2'];
        foreach(['collection_id','recording_id','time_ms','view','kind','listen'] as $p)if(isset($_GET[$p]) && is_string($_GET[$p]))$query[$p]=$_GET[$p];
        $_SESSION['deep_link_after_login']=http_build_query($query);
        require __DIR__.'/php/loginbox4.php';return;
    }
    vz2_login();
}catch(Vz2Error $e){http_response_code($e->status);echo '<p>'.auth_h($e->getMessage()).'</p><a href="index.php">Zpět do zkušebny</a>';return;}
$write=defined('VZ2_WRITES_ENABLED') && VZ2_WRITES_ENABLED === true && !empty($_SESSION['user_id']);
$config=['csrf'=>auth_csrf_token(),'write'=>$write,'admin'=>auth_is_admin(),'canCreate'=>$write && (auth_is_admin() || ma_pravo('create_val')),
    'canUpload'=>$write && (auth_is_admin() || ma_pravo('upload')),'canReorder'=>$write && (auth_is_admin() || ma_pravo('reorder')),
    'cachePrefix'=>'vz2:'.VZ2_DATASET_KEY.':'.VZ2_ENVIRONMENT.':'];
?>
<!doctype html>
<html lang="cs" data-theme="<?= site_theme() ?>" class="vz2-booting"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Zkušebna DK!</title>
<style><?php readfile(__DIR__ . '/css/themes.css'); ?></style>
<!-- Critical startup UI stays inline: it must paint before external CSS and JS arrive. -->
<style>
html.vz2-booting { background: var(--color-boot-bg); }
html.vz2-booting body { margin: 0; overflow: hidden; }
html.vz2-booting body > :not(#vz2-boot) { visibility: hidden; }
#vz2-boot { position: fixed; inset: 0; z-index: 100000; box-sizing: border-box; padding: max(28px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left)); background: var(--color-boot-bg); color: var(--color-boot-text); font: 14px/1.6 system-ui, sans-serif; overflow: auto; transition: opacity .16s ease; }
#vz2-boot [hidden] { display: none !important; }
#vz2-boot-inner { display: flex; flex-direction: column; width: min(100%, 420px); height: 100%; min-height: 360px; max-height: 720px; margin: auto; }
#vz2-boot-brand { display: flex; align-items: center; gap: 10px; color: var(--color-text-muted); font-size: 11px; font-weight: 650; letter-spacing: .12em; }
#vz2-boot-brand b { color: var(--color-primary); font-size: 13px; letter-spacing: .03em; }
#vz2-boot-brand span { border-left: 1px solid var(--color-divider); padding-left: 10px; }
#vz2-boot-center { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; padding: 30px 0; text-align: center; }
#vz2-boot-title { margin: 0; color: var(--color-boot-text); font: 700 clamp(36px, 10vw, 54px)/1.12 system-ui, sans-serif; letter-spacing: -.045em; }
#vz2-boot-title span { color: var(--color-primary); }
#vz2-boot-subtitle { margin: 20px 0 0; color: var(--color-text-muted); font: 14px/1.7 system-ui, sans-serif; }
#vz2-boot-wave { display: flex; align-items: center; gap: 6px; height: 52px; margin-bottom: 29px; }
#vz2-boot-wave span { width: 5px; height: 12px; border-radius: 4px; background: var(--color-primary); animation: vz2-boot-pulse 1.8s ease-in-out infinite; animation-delay: -.6s; }
#vz2-boot-wave span:nth-child(2), #vz2-boot-wave span:nth-child(6) { height: 24px; animation-delay: -.4s; }
#vz2-boot-wave span:nth-child(3), #vz2-boot-wave span:nth-child(5) { height: 38px; animation-delay: -.2s; }
#vz2-boot-wave span:nth-child(4) { height: 50px; animation-delay: 0s; }
#vz2-boot-footer { min-height: 44px; text-align: center; }
#vz2-boot-status { margin: 0; color: var(--color-text-muted); font: 12px/1.65 system-ui, sans-serif; }
#vz2-boot-retry { margin-top: 14px; min-height: 44px; padding: 8px 18px; border: 1px solid var(--color-primary); border-radius: 5px; background: var(--color-primary-bg); color: var(--color-boot-text); font: 14px/1.5 system-ui, sans-serif; cursor: pointer; }
#vz2-boot-retry:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 4px; }
#vz2-boot.is-leaving { opacity: 0; pointer-events: none; }
#vz2-boot.is-failed #vz2-boot-wave span { animation: none; opacity: .5; }
@keyframes vz2-boot-pulse { 0%, 100% { transform: scaleY(.55); opacity: .6; } 50% { transform: scaleY(1); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { #vz2-boot { transition: none; } #vz2-boot-wave span { animation: none; } }
</style>
<script>
(function () {
    'use strict';
    let ready = false, failed = false, finished = false, revealing = false, delayed = false, retry = false;
    const $ = id => document.getElementById(id);
    function status() {
        if (finished || !$('vz2-boot')) return;
        $('vz2-boot').classList.toggle('is-failed', failed);
        $('vz2-boot-status').textContent = failed ? 'Zkušebnu se nepodařilo načíst. Zkus to prosím znovu.'
            : delayed ? 'Chvíli to trvá. Stále načítáme…' : 'Načítáme skladby a nahrávky…';
        $('vz2-boot-retry').hidden = !retry;
    }
    const slowTimer = setTimeout(() => { delayed = true; status(); }, 8000);
    // A stalled connection remains recoverable and may still finish on its own.
    const retryTimer = setTimeout(() => { retry = true; status(); }, 30000);
    function fail() {
        if (finished) return;
        failed = retry = true;
        clearTimeout(slowTimer); clearTimeout(retryTimer); status();
    }
    function reveal() {
        if (!ready || failed || finished || revealing) return;
        if ([...document.querySelectorAll('link[data-vz2-style]')].some(link => !link.dataset.loaded)) return;
        revealing = true;
        // Let styles and the responsive layout settle before exposing the app.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            revealing = false;
            if (failed || finished) return;
            finished = true;
            clearTimeout(slowTimer); clearTimeout(retryTimer);
            document.documentElement.classList.remove('vz2-booting');
            $('app-shell').removeAttribute('aria-busy');
            const splash = $('vz2-boot'), hadFocus = splash.contains(document.activeElement);
            splash.setAttribute('aria-hidden', 'true'); splash.inert = true;
            splash.classList.add('is-leaving');
            if (hadFocus) $('catalog-picker').focus({ preventScroll: true });
            setTimeout(() => splash.remove(), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
            document.removeEventListener('load', loaded, true);
            window.removeEventListener('error', startupError, true);
            window.removeEventListener('unhandledrejection', fail);
        }));
    }
    function loaded(event) {
        const link = event.target;
        if (!link.matches?.('link[data-vz2-style], link[data-vz2-icons]')) return;
        link.media = 'all'; link.dataset.loaded = 'true'; reveal();
    }
    function startupError(event) {
        if (event.target.matches?.('link[data-vz2-style], script[src]') || event.message) fail();
    }
    document.addEventListener('load', loaded, true);
    window.addEventListener('error', startupError, true);
    window.addEventListener('unhandledrejection', fail);
    document.addEventListener('DOMContentLoaded', status, { once: true });
    window.Vz2Boot = { ready() { ready = true; reveal(); }, fail };
}());
</script>
<link rel="stylesheet" data-vz2-style media="print" fetchpriority="high" href="css/multitrack.css?v=<?=filemtime(__DIR__.'/css/multitrack.css')?>"><link rel="stylesheet" data-vz2-style media="print" fetchpriority="high" href="css/vz2.css?v=<?=filemtime(__DIR__.'/css/vz2.css')?>">
<link rel="stylesheet" data-vz2-icons media="print" onload="this.media='all'" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css">
<link rel="stylesheet" data-vz2-style media="print" href="css/vz2-workspaces.css?v=<?=filemtime(__DIR__.'/css/vz2-workspaces.css')?>">
<link rel="stylesheet" data-vz2-style media="print" href="css/vz2-car-mode.css?v=<?=filemtime(__DIR__.'/css/vz2-car-mode.css')?>">
</head><body>
<section id="vz2-boot" aria-label="Načítání zkušebny"><div id="vz2-boot-inner">
<div id="vz2-boot-brand"><b>DK</b><span>VIRTUÁLNÍ ZKUŠEBNA</span></div>
<div id="vz2-boot-center"><div id="vz2-boot-wave" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
<h1 id="vz2-boot-title">Zkušebna<br><span>DK!</span></h1><p id="vz2-boot-subtitle">Už to najíždí.....</p></div>
<div id="vz2-boot-footer"><p id="vz2-boot-status" role="status" aria-live="polite">Načítáme skladby a nahrávky…</p><button id="vz2-boot-retry" type="button" hidden onclick="location.reload()">Zkusit znovu</button>
<noscript><style>#vz2-boot-status { display: none; } #vz2-boot-wave span { animation: none; }</style><p id="vz2-boot-noscript">Pro otevření zkušebny povol JavaScript v prohlížeči a obnov stránku.</p></noscript>
</div></div></section>
<header id="topbar"><a class="brand" href="index.php?v=2">ZKUŠEBNA DK!</a>
<nav id="workspace-navigation" aria-label="Pracovní plochy">
<button type="button" data-workspace-target="songs" aria-pressed="true">Skladby</button>
<button type="button" data-workspace-target="rehearsals" aria-pressed="false">Zkoušky</button>
<button type="button" id="show-history" data-workspace-target="history" aria-pressed="false">Matice</button>
<button type="button" id="show-ideas" data-workspace-target="ideas" aria-pressed="false">Nápady</button>
</nav>
<span class="topbar-account" title="Přihlášený účet: <?=auth_h($_SESSION['user_name']??'Host')?>"><?=auth_h($_SESSION['user_name']??'Host')?></span>
<button id="car-mode-menu-open" class="car-entry" type="button" title="Poslech v autě" aria-label="Poslech v autě"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11 7 5h10l2 6M4 11h16v8H4zM7 19v2m10-2v2M7 15h2m6 0h2"/></svg></button>
<details class="shell-menu"><summary aria-label="Další možnosti" title="Další možnosti"><span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span></summary><nav aria-label="Další možnosti">
<?php if(auth_is_admin()):?><a href="admin.php">Správa účtů</a><button id="show-log">Deník změn</button><?php endif;?>
<a href="help.php">Nápověda</a>
<button id="show-offline">Správa offline souborů</button><button id="logout">Odhlásit</button></nav></details></header>
<svg class="section-icon-definitions" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>
<symbol id="section-icon-recordings" viewBox="0 0 24 24"><path d="M3 10v4m4-8v12m4-15v18m4-13v8m4-11v14m3-9v4"/></symbol>
<symbol id="section-icon-lyrics" viewBox="0 0 24 24"><path d="M4 5h16M4 10h16M4 15h13M4 20h9"/></symbol>
<symbol id="section-icon-tablature" viewBox="0 0 24 24"><path d="m2 5 7-2 6 2 7-2v16l-7 2-6-2-7 2V5Zm7-2v16m6-14v16"/></symbol>
<symbol id="section-icon-discussion" viewBox="0 0 24 24"><path d="M4 4h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 3v-3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M7 9h10M7 13h7"/></symbol>
<symbol id="section-icon-direction" viewBox="0 0 24 24"><path d="M4 7h16m0 0-4-4m4 4-4 4M20 17H4m0 0 4-4m-4 4 4 4"/></symbol>
<symbol id="section-icon-audio" viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4Zm12 0a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12"/></symbol>
<symbol id="section-icon-filter" viewBox="0 0 24 24"><path d="M3 5h18l-7 8v5l-4 2v-7L3 5Z"/></symbol>
<symbol id="section-icon-more" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></symbol>
<symbol id="section-icon-write" viewBox="0 0 24 24"><path d="m4 17 11-11 3 3L7 20H4v-3Zm9-9 3 3M4 5h7M4 20h16"/></symbol>
<symbol id="section-icon-draw" viewBox="0 0 24 24"><path d="M16 3c-3 5-8 8-8 13a4 4 0 0 0 8 0c0-2 2-5 4-8l-4-5ZM8 16c-3 0-5 2-5 5 3 0 5-1 6-3"/></symbol>
<symbol id="section-icon-speak" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0m-7 7v3m-4 0h8"/></symbol>
</defs></svg>
<main id="app-shell" aria-busy="true"><p id="message" role="status" aria-live="polite"></p>
<?php if(!$write):?><p class="notice">Režim pouze pro čtení.</p><?php endif;?>
<section id="player-shell" aria-label="Looper a Mixér" data-mode="empty">
<div class="player-header"><div class="player-ident"><svg class="player-emblem" viewBox="0 0 36 36" aria-hidden="true"><path d="M4 18c5 0 5-10 10-10s5 20 10 20 5-10 8-10"/></svg><strong id="player-mode">Přehrávač</strong><button id="player-title" type="button" title="Přejít ke zdroji nahrávky" disabled><span id="player-title-full"></span><span id="player-title-mobile"></span></button></div>
<div class="looper-header-controls" role="group" aria-label="Ovládání přehrávání">
<button id="looper-restart" type="button" title="Na začátek" aria-label="Na začátek"><i class="ti ti-player-track-prev" aria-hidden="true"></i></button>
<button id="looper-back" type="button" title="Zpět o 5 sekund" aria-label="Zpět o 5 sekund"><i class="ti ti-player-skip-back" aria-hidden="true"></i></button>
<button id="looper-play" type="button" title="Přehrát" aria-label="Přehrát"><i class="ti ti-player-play-filled" aria-hidden="true"></i></button>
<button id="looper-forward" type="button" title="Vpřed o 5 sekund" aria-label="Vpřed o 5 sekund"><i class="ti ti-player-skip-forward" aria-hidden="true"></i></button>
<button id="looper-loop" type="button" title="Opakovat smyčku" aria-label="Opakovat smyčku" aria-pressed="false"><i class="ti ti-repeat" aria-hidden="true"></i></button>
<div class="looper-volume-control"><button id="looper-mute" type="button" title="Ztlumit zvuk" aria-label="Ztlumit zvuk" aria-pressed="false"><i class="ti ti-volume" aria-hidden="true"></i></button><input id="looper-volume" aria-label="Hlasitost" type="range" min="0" max="1" step="0.01" value="1"><output id="looper-volume-value">100%</output></div>
</div>
<button id="player-play" type="button" aria-label="Přehrát" disabled>▶</button>
<button id="player-collapse" type="button" aria-label="Sbalit přehrávač" aria-expanded="true" disabled><i class="ti ti-chevron-up" aria-hidden="true"></i></button>
<button id="player-fullscreen" class="panel-fullscreen-button" type="button" aria-label="Celá obrazovka: Looper a Mixér" title="Celá obrazovka" aria-pressed="false" disabled><i class="ti ti-maximize" aria-hidden="true"></i></button>
<details id="looper-options"><summary aria-label="Otevřít menu Looperu" title="Další možnosti" aria-controls="looper-menu"><i class="ti ti-dots-vertical" aria-hidden="true"></i></summary><div id="looper-menu">
<div id="looper-menu-actions" class="looper-menu-section"><button id="looper-offline" type="button"><i class="ti ti-download" aria-hidden="true"></i><span><span id="looper-offline-label">Uložit pro offline</span><small id="looper-offline-status">přehrávám ze sítě</small></span></button><button id="looper-copy-link" type="button"><i class="ti ti-link" aria-hidden="true"></i><span>Vytvořit odkaz na pozici</span></button><a id="looper-export"><i class="ti ti-file-export" aria-hidden="true"></i><span>Export časových značek</span></a></div>
<div id="mixer-menu-actions" class="looper-menu-section" hidden><button id="mixer-export" type="button" disabled><i class="ti ti-file-export" aria-hidden="true"></i><span>Export časových značek</span></button></div>
<div class="looper-menu-section"><button id="looper-close" class="looper-menu-danger" type="button"><i class="ti ti-x" aria-hidden="true"></i><span>Zavřít looper</span></button></div>
</div></details>
<button id="player-close" type="button" aria-label="Zavřít přehrávač" disabled>×</button></div>
<div id="player-body" hidden>
<section id="looper-panel" hidden aria-label="Looper"><p id="looper-status" role="status"></p>
<div id="looper-wave-scroll"><div id="looper-wave-track"><canvas id="looper-wave" aria-label="Průběh nahrávky; kliknutím lze nastavit čas"></canvas><div id="looper-wave-markers"></div></div><span id="looper-wave-name" aria-hidden="true"></span><div class="looper-zoom-controls"><button id="looper-zoom-out" type="button" title="Oddálit" aria-label="Oddálit">−</button><button id="looper-zoom-in" type="button" title="Přiblížit" aria-label="Přiblížit">+</button><input id="looper-zoom" aria-label="Přiblížení průběhu" type="range" min="1" max="16" step="1" value="1"></div></div>
<div class="timeline"><output id="looper-time">00:00</output><input id="looper-seek" aria-label="Čas Looperu" type="range" min="0" max="0" step="0.01" value="0"><output id="looper-duration">00:00</output></div>
<div id="looper-timestamps"></div></section>
</div></section>
<div id="workspace-frame">
<div id="mobile-dock">
<nav id="bottom-nav" aria-label="Pracovní plochy">
<button id="bn-skladby" data-workspace-target="songs" aria-pressed="true"><img src="meat/ikona_skladby.png" alt="">Skladby</button>
<button id="bn-zkousky" data-workspace-target="rehearsals" aria-pressed="false"><img src="meat/ikona_nahravky.png" alt="">Zkoušky</button>
<button id="bn-matice" data-workspace-target="history" aria-pressed="false"><img src="meat/ikona_text.png" alt="">Matice</button>
<button id="bn-napady" data-workspace-target="ideas" aria-pressed="false"><img src="meat/ikona_napady.png" alt="">Nápady</button>
</nav></div>
<div class="layout"><div id="sidebar-slot"><aside id="sidebar" aria-label="Výběr skladby nebo zkoušky"><div class="catalog-header"><h2 id="catalog-heading-mobile">Skladby</h2>
<?php if($config['canCreate']):?><button id="create-collection-open" type="button">+ Nová skladba</button><?php endif;?>
<button id="catalog-close" type="button" aria-label="Zavřít výběr" title="Zavřít výběr">×</button></div>
<h2 id="catalog-heading">Skladby</h2>
<div id="collections"></div>
</aside></div><div id="workspace">
<div id="workspace-surfaces">
<header id="collection-header" class="workspace-header">
<div class="workspace-heading"><span id="collection-kind-label">Skladby</span><div class="collection-heading-row"><h1 id="collection-title"><button id="catalog-picker" type="button" aria-haspopup="dialog" aria-controls="catalog-dialog" aria-expanded="false" title="Vybrat skladbu"><span id="collection-kind-inline">Skladba:</span><span id="collection-title-name">Načítám…</span><span class="catalog-chevron" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m4 8 8 8 8-8"/></svg></span></button></h1><button id="car-mode-collection-open" class="car-entry" type="button" title="Poslech v autě" aria-label="Poslech v autě"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 11 7 5h10l2 6M4 11h16v8H4zM7 19v2m10-2v2M7 15h2m6 0h2"/></svg></button></div></div>
<nav id="desktop-panels" class="workspace-controls" aria-label="Zobrazené panely"><button data-desktop-panel="recordings" aria-pressed="true" title="Nahrávky"><svg class="section-icon" aria-hidden="true"><use href="#section-icon-recordings"/></svg><span class="section-button-label">Nahrávky</span></button><button data-desktop-panel="lyrics" aria-pressed="true" title="Text a akordy"><svg class="section-icon" aria-hidden="true"><use href="#section-icon-lyrics"/></svg><span class="section-button-label">Text</span></button><button data-desktop-panel="tablature" aria-pressed="true" title="Mapa skladby"><svg class="section-icon" aria-hidden="true"><use href="#section-icon-tablature"/></svg><span class="section-button-label">Mapa</span></button><button data-desktop-panel="discussion" aria-pressed="false" title="Diskuse"><svg class="section-icon" aria-hidden="true"><use href="#section-icon-discussion"/></svg><span class="section-button-label">Diskuse</span></button></nav>
</header>
<section id="song-workspace" data-workspace="panels" aria-label="Pracovní plocha skladby">
<div id="content-area">
<section id="panel-recordings" class="panel" data-panel="recordings" aria-label="Nahrávky"><div class="panel-header"><svg class="section-icon panel-section-icon" aria-hidden="true"><use href="#section-icon-recordings"/></svg><h2>Nahrávky</h2><?php if($config['canUpload']):?><div class="panel-header-actions"><button id="upload-open" type="button" aria-haspopup="dialog" aria-controls="upload-dialog" hidden>Vložit</button></div><?php endif;?></div><div class="panel-body"><section id="content"><p>Načítám…</p></section>
<section id="operations" hidden><h2>Nedokončené operace</h2><div></div></section>
</div></section>
<section id="panel-lyrics" class="panel" data-panel="lyrics" aria-label="Text a akordy"><div class="panel-header"><svg class="section-icon panel-section-icon" aria-hidden="true"><use href="#section-icon-lyrics"/></svg><h2>Text a akordy</h2><div id="lyrics-actions" class="panel-header-actions"></div></div><div id="lyrics-content" class="panel-body"></div></section>
<section id="panel-tablature" class="panel" data-panel="tablature" aria-label="Mapa skladby"><div class="panel-header"><svg class="section-icon panel-section-icon" aria-hidden="true"><use href="#section-icon-tablature"/></svg><h2>Mapa skladby</h2><div id="tablature-actions" class="panel-header-actions"></div><div id="rehearsal-starts-actions" class="panel-header-actions" hidden></div></div><div id="tablature-content" class="panel-body"><div id="song-map-content"></div><div id="rehearsal-starts-content" hidden></div></div></section>
<section id="panel-discussion" class="panel" data-panel="discussion" aria-label="Diskuse"><div class="panel-header"><svg class="section-icon panel-section-icon" aria-hidden="true"><use href="#section-icon-discussion"/></svg><h2>Diskuse</h2><div id="discussion-actions" class="panel-header-actions"></div></div><div id="discussion-content" class="panel-body"></div></section>
</div></section>
<section id="history-workspace" data-workspace="history" hidden aria-label="Matice zkoušek" aria-labelledby="history-title"><header class="history-header panel-header workspace-header"><div class="history-heading"><span class="history-emblem" aria-hidden="true"><i class="ti ti-calendar-stats"></i></span><div><h2 id="history-title">Matice zkoušek</h2><p>Skladby napříč jednotlivými zkouškami</p></div></div><div id="history-controls-slot"><div id="history-controls" class="history-toolbar workspace-controls">
<button id="history-orientation" type="button" aria-pressed="false" title="Prohodit osy"><svg class="section-icon" aria-hidden="true"><use href="#section-icon-direction"/></svg><span class="desktop-label">Prohodit osy</span></button>
<label class="history-check" title="Jen s dostupným audiem"><input id="history-audio-filter" type="checkbox"><svg class="section-icon" aria-hidden="true"><use href="#section-icon-audio"/></svg><span class="desktop-label">S dostupným audiem</span></label>
<details id="history-filter" class="history-song-control"><summary><svg class="section-icon" aria-hidden="true"><use href="#section-icon-filter"/></svg><span id="history-filter-label">Všechny skladby</span><span aria-hidden="true">⌄</span></summary><div class="history-filter-menu"><label for="history-song-filter">Filtr skladeb</label><select id="history-song-filter" size="6" aria-label="Filtr skladeb"><option value="">Všechny skladby</option></select></div></details>
<details id="history-options"><summary aria-label="Další možnosti matice" title="Další možnosti" aria-controls="history-menu"><svg class="section-icon" aria-hidden="true"><use href="#section-icon-more"/></svg></summary><div id="history-menu" class="looper-menu-section"><button id="history-unassigned-open" type="button" aria-haspopup="dialog" aria-controls="history-unassigned"><i class="ti ti-list-details" aria-hidden="true"></i><span>Nezařazené úseky a výstřižky</span></button></div></details>
</div></div></header><p id="history-status" role="status" aria-live="polite"></p><div id="history-matrix" tabindex="0" aria-label="Matice historie zkoušení"></div></section>
<section id="ideas-workspace" data-workspace="ideas" hidden aria-label="Nápady" aria-labelledby="ideas-title"><header class="panel-header workspace-header"><h2 id="ideas-title">Nápady</h2><div id="ideas-controls-slot"><nav id="ideas-controls" class="workspace-controls" aria-label="Sekce nápadů"><button type="button" data-idea-section="write" aria-pressed="true" title="Piš"><svg class="section-icon" aria-hidden="true"><use href="#section-icon-write"/></svg><span>Piš</span></button><button type="button" data-idea-section="draw" aria-pressed="false" title="Kresli"><svg class="section-icon" aria-hidden="true"><use href="#section-icon-draw"/></svg><span>Kresli</span></button><button type="button" data-idea-section="speak" aria-pressed="false" title="Mluv"><svg class="section-icon" aria-hidden="true"><use href="#section-icon-speak"/></svg><span>Mluv</span></button></nav></div></header><div id="ideas-write" class="panel-body content-editor" data-idea-panel="write"></div><div id="ideas-draw" class="panel-body idea-future" data-idea-panel="draw" hidden><h3>Kresli</h3><p>Prostor pro kresby a náčrty připravujeme.</p></div><div id="ideas-speak" class="panel-body idea-future" data-idea-panel="speak" hidden><h3>Mluv</h3><p>Prostor pro hlasové nápady připravujeme.</p></div></section></div></div></div>
<div id="mobile-sections-dock">
<nav id="mobile-panels" class="workspace-controls" aria-label="Sekce skladby nebo zkoušky"><button data-mobile-panel="recordings" aria-pressed="true" aria-label="Nahrávky" title="Nahrávky"><svg class="section-icon" aria-hidden="true"><use href="#section-icon-recordings"/></svg><span class="section-button-label">Nahrávky</span></button><button data-mobile-panel="lyrics" aria-pressed="false" aria-label="Text a akordy" title="Text a akordy"><svg class="section-icon" aria-hidden="true"><use href="#section-icon-lyrics"/></svg><span class="section-button-label">Text</span></button><button data-mobile-panel="tablature" aria-pressed="false" aria-label="Mapa skladby" title="Mapa skladby"><svg class="section-icon" aria-hidden="true"><use href="#section-icon-tablature"/></svg><span class="section-button-label">Mapa</span></button><button data-mobile-panel="discussion" aria-pressed="false" aria-label="Diskuse" title="Diskuse"><svg class="section-icon" aria-hidden="true"><use href="#section-icon-discussion"/></svg><span class="section-button-label">Diskuse</span></button></nav>
</div></div>
<section id="activity" class="utility-panel" hidden aria-label="Deník změn"><div class="dialog-header"><h2>Deník změn</h2><button class="modal-close" type="button" data-close-utility="activity" aria-label="Zavřít deník" title="Zavřít deník">×</button></div><div class="log-entries"></div><button id="log-more">Starší změny</button></section>
<section id="offline-files" class="utility-panel" hidden aria-label="Offline soubory"><div class="dialog-header"><h2>Offline soubory</h2><button class="modal-close" type="button" data-close-utility="offline-files" aria-label="Zavřít offline soubory" title="Zavřít offline soubory">×</button></div><p class="offline-intro">Kopie uložené v tomto prohlížeči zůstanou dostupné i po odstranění audia ze serveru.</p><div class="offline-files-list"></div><div class="offline-footer"><button id="offline-clear" class="danger">Odebrat vše</button></div></section>
<section id="mixer-panel" class="mt-shell" hidden aria-label="Mixér vybrané nahrávky"><button id="mixer-copy-link" type="button" hidden><i class="ti ti-link" aria-hidden="true"></i><span>Vytvořit odkaz na pozici</span></button>
<p id="mixer-context"></p>
<div id="mt-notice" role="status" hidden></div>
<h3 id="mt-playing-name">Vyberte vícestopou nahrávku</h3><div id="mt-empty">Vyberte nahrávku ze seznamu.</div>
<div class="mt-internal-transport" hidden><button id="mt-restart" title="Na začátek">⏮</button><button id="mt-backward">−5 s</button>
<button id="mt-play" aria-label="Přehrát"><span id="mt-play-icon"></span> Přehrát / pauza</button><button id="mt-forward">+5 s</button>
<label>Hlasitost<input id="mt-master-volume" type="range" min="0" max="100" value="100"><output id="mt-master-value">100 %</output></label></div>
<button id="mt-offline" aria-pressed="false" hidden><i class="ti ti-download" aria-hidden="true"></i><span><span id="mt-offline-label">Uložit offline</span><small id="mt-offline-status"></small></span></button>
<div class="timeline"><output id="mt-current-time">00:00</output><input id="mt-seek" type="range" min="0" max="0" step="0.01" value="0"><output id="mt-total-time">00:00</output></div>
<div id="mixer-action-row"><button id="mt-mixer-toggle" type="button" aria-label="Rozbalit mix" aria-expanded="false" aria-controls="mt-mixer" hidden>Mix</button></div>
<div id="mt-loading-panel" hidden><p id="mt-load-summary"></p><div id="mt-track-statuses"></div><button id="mt-loading-cancel">Zrušit načítání</button></div>
<div id="mt-mixer" hidden><div id="mt-tracks"></div></div>
<div id="mixer-timestamps"></div>
</section></main>
<dialog id="catalog-dialog" aria-label="Skladby a zkoušky"><div id="catalog-dialog-slot"></div></dialog>
<?php if($config['canCreate']):?><dialog id="create-collection-dialog" aria-labelledby="create-collection-title"><form id="create-collection"><div class="dialog-header"><h2 id="create-collection-title">Nová skladba</h2><button id="create-collection-cancel" class="modal-close" type="button" aria-label="Zavřít vytvoření skladby nebo zkoušky" title="Zavřít">×</button></div><label>Nový název<input name="title" maxlength="200" required></label><p class="edit-error" role="alert"></p><div class="toolbar"><button>Vytvořit</button></div></form></dialog><?php endif;?>

<dialog id="history-list" aria-labelledby="history-list-title"><div class="dialog-header"><h2 id="history-list-title"></h2><button type="button" class="modal-close" data-history-close aria-label="Zavřít seznam">×</button></div><ul class="history-attempts"></ul><div class="history-list-footer"><button id="history-list-add" type="button">Zařadit existující úsek nebo výstřižek</button></div></dialog>
<dialog id="history-unassigned" aria-labelledby="history-unassigned-title"><div class="dialog-header"><h2 id="history-unassigned-title">Nezařazené úseky a výstřižky</h2><button type="button" class="modal-close" data-history-close aria-label="Zavřít nezařazené položky">×</button></div><div id="history-unassigned-content"></div></dialog>
<dialog id="history-add" aria-labelledby="history-add-title"><div class="dialog-header"><h2 id="history-add-title">Přidat pokus</h2><button type="button" data-history-back>Zpět</button><button type="button" class="modal-close" data-history-close aria-label="Zavřít přidávání pokusů">×</button></div><p class="history-context"></p><div class="history-candidates"></div><p class="error" role="alert"></p><p class="history-add-status" role="status" aria-live="polite"></p><div class="toolbar"><button type="button" data-history-back>Hotovo</button></div></dialog>
<dialog id="history-detail" aria-labelledby="history-detail-title"><div class="dialog-header"><div class="history-detail-heading"><p class="history-detail-context"></p><h2 id="history-detail-title"></h2></div><button type="button" class="modal-close" data-history-close aria-label="Zavřít detail a vrátit se k seznamu" title="Zpět k seznamu">×</button></div><div class="history-detail-body"></div></dialog>
<?php if($config['canUpload']):?><dialog id="upload-dialog" aria-labelledby="upload-title"></dialog><?php endif;?>
<dialog id="editor"><form id="edit-form"><div class="dialog-header"><h2>Upravit</h2><button type="button" id="edit-cancel" class="modal-close" aria-label="Zavřít úpravu" title="Zavřít">×</button></div><label>Název<input name="title" maxlength="200" required></label><label id="summary-label">Popisek<textarea name="summary" maxlength="10000" rows="5"></textarea></label><p class="edit-error" role="alert"></p><div class="toolbar"><button>Uložit</button><button type="button" id="edit-reload" hidden>Načíst aktuální verzi</button></div></form></dialog>
<dialog id="move-dialog" aria-labelledby="move-title"><form id="move-form"><div class="dialog-header"><h2 id="move-title">Přesunout <span id="move-item-title"></span></h2><button type="button" id="move-cancel" class="modal-close" aria-label="Zavřít přesun" title="Zavřít">×</button></div><p id="move-links-info" class="muted" hidden></p><label>Cílová skladba nebo zkouška<select name="collection_id" required></select></label><p class="edit-error" role="alert"></p><div class="toolbar"><button type="submit">Potvrdit přesun</button></div></form></dialog>
<dialog id="logout-dialog" aria-labelledby="logout-title"><span class="logout-icon" aria-hidden="true">🎸</span><p id="logout-title">Opravdu chceš opustit zkušebnu?</p><p id="logout-error" class="edit-error" role="alert" hidden></p><button id="logout-confirm" type="button">zpět do reálného světa</button><button id="logout-cancel" type="button">zůstat ve zkušebně</button></dialog>
<dialog id="player-help-dialog" aria-labelledby="player-help-title"><div class="dialog-header"><h2 id="player-help-title">Nápověda přehrávače</h2><button id="player-help-close" class="modal-close" type="button" aria-label="Zavřít nápovědu">×</button></div><p>Nejprve vyberte nahrávku ze seznamu a otevřete ji v Looperu nebo Mixéru.</p><p class="muted">Podrobnou nápovědu doplníme později.</p></dialog>
<div id="car-mode" role="dialog" aria-modal="true" aria-label="Poslech v autě" hidden>
<div class="car-screen"><audio id="car-audio" preload="metadata" playsinline hidden></audio><header class="car-header"><small class="car-mode-label"><span>REŽIM</span><span>POSLECHU</span></small><button id="car-folder" type="button">Vybrat složku</button><button id="car-close" type="button" aria-label="Zavřít režim poslechu"><span aria-hidden="true">×</span></button></header>
<div class="car-recording-row"><strong id="car-recording-name">Vybrat nahrávku</strong><button id="car-recording" type="button">Změnit</button></div>
<div class="car-transport"><div class="car-time"><output id="car-position">00:00</output><output id="car-duration">00:00</output></div><input id="car-seek" type="range" min="0" max="0" step="0.1" value="0" aria-label="Pozice přehrávání"><div class="car-controls"><button id="car-back" type="button" aria-label="Zpět o 10 sekund">−10 s</button><button id="car-play" type="button" aria-label="Přehrát"><span class="car-play-icon" aria-hidden="true"></span></button><button id="car-forward" type="button" aria-label="Vpřed o 10 sekund">+10 s</button></div></div>
<div class="car-rating"><span>Ohodnotit aktuální místo</span><button id="car-up" type="button" aria-label="Palec nahoru">👍</button><button id="car-down" type="button" aria-label="Palec dolů">👎</button></div><p id="car-status" role="status" aria-live="polite"></p><section class="car-chapters"><h2>Začátky skladeb</h2><div id="car-chapter-list"></div></section></div>
<div id="car-picker" class="car-picker" role="dialog" aria-modal="true" aria-label="Výběr nahrávky" hidden><div class="car-picker-sheet"><div class="car-picker-handle" aria-hidden="true"></div><div class="car-picker-head"><button id="car-picker-folder" type="button"><small>AKTUÁLNÍ SLOŽKA · ZMĚNIT</small><strong>Vybrat složku</strong></button><button id="car-picker-close" type="button" aria-label="Zavřít výběr">×</button></div><p id="car-picker-hint">Vyber nahrávku. Přehrávání spustíš tlačítkem Play.</p><div id="car-picker-recordings" class="car-picker-list"></div><div id="car-picker-folders" hidden><div class="car-kind-tabs"><button type="button" data-car-kind="song">Skladby</button><button type="button" data-car-kind="rehearsal">Zkoušky</button></div><div id="car-picker-folder-list" class="car-picker-list"></div></div></div></div>
</div>
<dialog id="time-link-dialog" aria-labelledby="time-link-title"><form method="dialog"><div class="dialog-header"><h2 id="time-link-title">Odkaz na pozici</h2><button type="button" id="time-link-close" class="modal-close" aria-label="Zavřít">×</button></div><label class="time-link-option"><input id="time-link-car" type="checkbox"> Na mobilu otevřít v režimu poslechu</label><p>Odkaz otevře nahrávku na aktuálním čase. Přehrávání se spustí stiskem Play.</p><p id="time-link-status" role="status"></p><div class="toolbar"><button id="time-link-copy" type="button">Kopírovat odkaz</button></div></form></dialog>
<script>window.VZ2=<?=json_encode($config,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_QUOT|JSON_HEX_APOS)?>;
window.MULTITRACK_CONFIG={listUrl:'php/ajax/vz2.php?action=mixer',detailUrl:'php/ajax/vz2.php?action=mixer&id={id}',cacheDb:'zkusebna-vz2-cache',cacheStore:'audio',cachePrefix:window.VZ2.cachePrefix,requireFreshMetadata:true};</script>
<script defer src="js/vz2-cache.js"></script><script defer src="js/multitrack.js?v=<?=filemtime(__DIR__.'/js/multitrack.js')?>"></script><script defer src="js/vz2-timestamps.js?v=<?=filemtime(__DIR__.'/js/vz2-timestamps.js')?>"></script><script defer src="js/vz2-song-map-model.js?v=<?=filemtime(__DIR__.'/js/vz2-song-map-model.js')?>"></script><script defer src="js/vz2-bar-detail.js?v=<?=filemtime(__DIR__.'/js/vz2-bar-detail.js')?>"></script><script defer src="js/vz2-song-map.js?v=<?=filemtime(__DIR__.'/js/vz2-song-map.js')?>"></script><script defer src="js/vz2-content.js?v=<?=filemtime(__DIR__.'/js/vz2-content.js')?>"></script><script defer src="js/vz2-layout.js?v=<?=filemtime(__DIR__.'/js/vz2-layout.js')?>"></script><script defer src="js/vz2-player.js?v=<?=filemtime(__DIR__.'/js/vz2-player.js')?>"></script><script defer src="js/vz2-audio.js?v=<?=filemtime(__DIR__.'/js/vz2-audio.js')?>"></script><script defer src="js/vz2.js?v=<?=filemtime(__DIR__.'/js/vz2.js')?>"></script>
<script defer src="js/vz2-history.js?v=<?=filemtime(__DIR__.'/js/vz2-history.js')?>"></script>
<script defer src="js/vz2-car-mode.js?v=<?=filemtime(__DIR__.'/js/vz2-car-mode.js')?>"></script>
</body></html>
