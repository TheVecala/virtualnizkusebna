<?php
declare(strict_types=1);
require_once __DIR__ . '/php/inc/session.php';
app_session_start();
header('Cache-Control: no-store');
require_once __DIR__.'/config.php';
require_once __DIR__.'/php/inc/vz2_core.php';
try{
    vz2_ready();
    if(($_SESSION['logged_in_single']??false)!==true){
        $query=['v'=>'2'];
        foreach(['collection_id','recording_id','time_ms','view','kind'] as $p)if(isset($_GET[$p]) && is_string($_GET[$p]))$query[$p]=$_GET[$p];
        $_SESSION['deep_link_after_login']=http_build_query($query);
        require __DIR__.'/php/loginbox4.php';return;
    }
    vz2_login();
}catch(Vz2Error $e){http_response_code($e->status);echo '<p>'.auth_h($e->getMessage()).'</p><a href="index.php">Zpět do zkušebny</a>';return;}
$write=defined('VZ2_WRITES_ENABLED') && VZ2_WRITES_ENABLED && !empty($_SESSION['user_id']);
$config=['csrf'=>auth_csrf_token(),'write'=>$write,'admin'=>auth_is_admin(),'canCreate'=>$write && (auth_is_admin() || ma_pravo('create_val')),
    'canUpload'=>$write && (auth_is_admin() || ma_pravo('upload')),'canReorder'=>$write && (auth_is_admin() || ma_pravo('reorder')),
    'cachePrefix'=>'vz2:'.VZ2_DATASET_KEY.':'.VZ2_ENVIRONMENT.':'];
?>
<!doctype html>
<html lang="cs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Virtuální zkušebna 2.0</title>
<link rel="stylesheet" href="css/multitrack.css"><link rel="stylesheet" href="css/vz2.css?v=<?=filemtime(__DIR__.'/css/vz2.css')?>">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css">
</head><body>
<header id="topbar"><a class="brand" href="index.php?v=2">ZKUŠEBNA <small>2.0</small></a><h1 id="collection-title"><span aria-hidden="true">/DK/</span><span id="collection-title-name">Načítám…</span></h1>
<button id="catalog-picker" aria-haspopup="dialog" aria-controls="catalog-dialog">Skladby / zkoušky</button>
<nav id="desktop-panels" aria-label="Zobrazené panely">
<button data-desktop-panel="recordings" aria-pressed="true">Nahrávky</button><button data-desktop-panel="lyrics" aria-pressed="true">Text</button><button data-desktop-panel="tablature" aria-pressed="true">Tabulatura</button><button data-desktop-panel="discussion" aria-pressed="false">Diskuse</button>
</nav><button id="show-ideas" aria-pressed="false" aria-controls="ideas-workspace">Nápady</button>
<details class="shell-menu"><summary aria-label="Další možnosti">⋮</summary><nav aria-label="Další možnosti">
<a href="index.php?v=2" id="catalog-home">Skladby a zkoušky</a>
<?php if(auth_is_admin()):?><a href="admin.php">Účty</a><button id="show-log">Deník</button><?php endif;?>
<button id="show-offline">Offline soubory</button><?php if(!defined('VZ2_ONLY') || VZ2_ONLY!==true):?><a href="index.php">Původní zkušebna</a><?php endif;?><span><?=auth_h($_SESSION['user_name']??'Host')?></span><button id="logout">Odhlásit</button></nav></details></header>
<main id="app-shell"><p id="message" role="status" aria-live="polite"></p>
<?php if(!$write):?><p class="notice">Režim pouze pro čtení.</p><?php endif;?>
<div class="layout"><div id="sidebar-slot"><aside id="sidebar" aria-label="Výběr skladby nebo zkoušky"><div class="tabs"><button data-kind="song" aria-pressed="true">Skladby</button><button data-kind="rehearsal" aria-pressed="false">Zkoušky</button></div>
<?php if($config['canCreate']):?><button id="create-collection-open" type="button">+ nová</button><?php endif;?>
<div id="collections"></div>
</aside></div><div id="workspace">
<section id="player-shell" aria-label="Looper a Mixér" data-mode="empty">
<div class="player-header"><div class="player-ident"><strong id="player-mode">PŘEHRÁVAČ</strong><span id="player-title">Vyberte nahrávku</span></div>
<div class="looper-header-controls" role="group" aria-label="Ovládání Looperu">
<button id="looper-restart" type="button" title="Na začátek" aria-label="Na začátek"><i class="ti ti-player-track-prev" aria-hidden="true"></i></button>
<button id="looper-back" type="button" title="Zpět o 5 sekund" aria-label="Zpět o 5 sekund"><i class="ti ti-player-skip-back" aria-hidden="true"></i></button>
<button id="looper-play" type="button" title="Přehrát" aria-label="Přehrát"><i class="ti ti-player-play-filled" aria-hidden="true"></i></button>
<button id="looper-forward" type="button" title="Vpřed o 5 sekund" aria-label="Vpřed o 5 sekund"><i class="ti ti-player-skip-forward" aria-hidden="true"></i></button>
<button id="looper-loop" type="button" title="Opakovat smyčku" aria-label="Opakovat smyčku" aria-pressed="false"><i class="ti ti-repeat" aria-hidden="true"></i></button>
<div class="looper-volume-control"><button id="looper-mute" type="button" title="Ztlumit zvuk" aria-label="Ztlumit zvuk" aria-pressed="false"><i class="ti ti-volume" aria-hidden="true"></i></button><input id="looper-volume" aria-label="Hlasitost" type="range" min="0" max="1" step="0.01" value="1"><output id="looper-volume-value">100%</output></div>
</div>
<button id="player-play" type="button" aria-label="Přehrát" disabled>▶</button>
<button id="player-collapse" type="button" aria-label="Sbalit přehrávač" aria-expanded="true" disabled><i class="ti ti-chevron-up" aria-hidden="true"></i></button>
<button id="player-fullscreen" type="button" aria-label="Celá obrazovka" aria-pressed="false" disabled>⛶</button>
<details id="player-options" class="actions-menu"><summary aria-label="Možnosti přehrávače">⋮</summary><div class="action-list" id="player-actions"></div></details>
<details id="looper-options"><summary aria-label="Otevřít menu Looperu" title="Další možnosti" aria-controls="looper-menu"><i class="ti ti-dots-vertical" aria-hidden="true"></i></summary><div id="looper-menu">
<div class="looper-menu-section"><button id="looper-fullscreen" type="button"><i class="ti ti-maximize" aria-hidden="true"></i><span>Celá obrazovka</span></button></div>
<div class="looper-menu-section"><button id="looper-offline" type="button"><i class="ti ti-download" aria-hidden="true"></i><span><span id="looper-offline-label">Uložit pro offline</span><small id="looper-offline-status">přehrávám ze sítě</small></span></button><button id="looper-copy-link" type="button"><i class="ti ti-link" aria-hidden="true"></i><span>Vytvořit odkaz na pozici</span></button><a id="looper-export"><i class="ti ti-file-export" aria-hidden="true"></i><span>Export timestampů</span></a></div>
<div class="looper-menu-section"><button id="looper-close" class="looper-menu-danger" type="button"><i class="ti ti-x" aria-hidden="true"></i><span>Zavřít looper</span></button></div>
</div></details>
<button id="player-close" type="button" aria-label="Zavřít přehrávač" disabled>×</button></div>
<div id="player-body" hidden>
<section id="looper-panel" hidden aria-label="Looper"><p id="looper-status" role="status"></p>
<div id="looper-wave-scroll"><div id="looper-wave-track"><canvas id="looper-wave" aria-label="Průběh nahrávky; kliknutím lze nastavit čas"></canvas><div id="looper-wave-regions" aria-hidden="true"></div><div id="looper-wave-markers"></div></div><span id="looper-wave-name" aria-hidden="true"></span><div class="looper-zoom-controls"><button id="looper-zoom-out" type="button" title="Oddálit" aria-label="Oddálit">−</button><button id="looper-zoom-in" type="button" title="Přiblížit" aria-label="Přiblížit">+</button><input id="looper-zoom" aria-label="Přiblížení průběhu" type="range" min="1" max="16" step="1" value="1"></div></div>
<div class="timeline"><output id="looper-time">0:00</output><input id="looper-seek" aria-label="Čas Looperu" type="range" min="0" max="0" step="0.01" value="0"><output id="looper-duration">0:00</output></div>
<div id="looper-timestamps"></div></section>
</div></section>
<div id="content-area">
<section id="panel-recordings" class="panel" data-panel="recordings" aria-label="Nahrávky"><div class="panel-header"><h2>Nahrávky</h2></div><div class="panel-body"><section id="content"><p>Načítám…</p></section>
<section id="operations" hidden><h2>Nedokončené operace</h2><div></div></section>
</div></section>
<section id="panel-lyrics" class="panel" data-panel="lyrics" aria-label="Text a akordy"><div class="panel-header"><h2>Text a akordy</h2><div id="lyrics-actions" class="panel-header-actions"></div></div><div id="lyrics-content" class="panel-body"></div></section>
<section id="panel-tablature" class="panel" data-panel="tablature" aria-label="Tabulatura"><div class="panel-header"><h2>Tabulatura</h2><div id="tablature-actions" class="panel-header-actions"></div></div><div id="tablature-content" class="panel-body"></div></section>
<section id="panel-discussion" class="panel" data-panel="discussion" aria-label="Diskuse"><div class="panel-header"><h2>Diskuse</h2><div id="discussion-actions" class="panel-header-actions"></div></div><div id="discussion-content" class="panel-body"></div></section>
</div><section id="ideas-workspace" hidden aria-label="Nápady"></section></div></div>
<section id="activity" class="utility-panel" hidden aria-label="Deník změn"><button type="button" data-close-utility="activity">Zavřít deník</button><h2>Deník změn</h2><div></div><button id="log-more">Starší změny</button></section>
<section id="offline-files" class="utility-panel" hidden aria-label="Offline soubory"><button type="button" data-close-utility="offline-files">Zavřít offline soubory</button><h2>Offline soubory tohoto prostředí</h2><p>Lokální kopie v tomto prohlížeči. Odstraněné serverové audio lze odsud stáhnout nebo uvolnit jeho místo.</p><div></div><button id="offline-clear">Odebrat všechny místní kopie</button></section>
<section id="mixer-panel" class="mt-shell" hidden aria-label="Mixér vybrané nahrávky"><div class="toolbar"><h2>Mixér</h2><button id="mixer-close" type="button">Zavřít Mixér</button><button id="mixer-copy-link" type="button">Kopírovat odkaz na čas</button></div>
<p id="mixer-context"></p>
<div id="mt-notice" role="status" hidden></div><div id="mt-selector" hidden></div>
<h3 id="mt-playing-name">Vyberte vícestopou nahrávku</h3><div id="mt-empty">Vyberte nahrávku ze seznamu.</div>
<div class="toolbar"><button id="mt-restart" title="Na začátek">⏮</button><button id="mt-backward">−5 s</button>
<button id="mt-play" aria-label="Přehrát"><span id="mt-play-icon"></span> Přehrát / pauza</button><button id="mt-forward">+5 s</button>
<label>Hlasitost<input id="mt-master-volume" type="range" min="0" max="100" value="100"><output id="mt-master-value">100 %</output></label>
<button id="mt-mixer-toggle" aria-expanded="false" hidden>Rozbalit mix</button>
<button id="mt-offline" aria-pressed="false"><span id="mt-offline-label">Uložit offline</span><small id="mt-offline-status"></small></button></div>
<div class="timeline"><output id="mt-current-time">00:00</output><input id="mt-seek" type="range" min="0" max="0" step="0.01" value="0"><output id="mt-total-time">00:00</output></div>
<div id="mt-loading-panel" hidden><p id="mt-load-summary"></p><div id="mt-track-statuses"></div><button id="mt-loading-cancel">Zrušit načítání</button></div>
<div id="mt-mixer" hidden><div id="mt-tracks"></div></div>
<div id="mixer-timestamps"></div>
<button id="mixer-discussion">Diskuse ke skladbě / zkoušce</button>
</section></main>
<nav id="bottom-nav" aria-label="Mobilní navigace">
<button id="bn-skladby" aria-haspopup="dialog"><img src="meat/ikona_skladby.png" alt="">skladby</button>
<button data-mobile-panel="recordings" aria-pressed="true"><img src="meat/ikona_nahravky.png" alt="">nahrávky</button>
<button data-mobile-panel="lyrics" aria-pressed="false"><img src="meat/ikona_text.png" alt="">text</button>
<button data-mobile-panel="tablature" aria-pressed="false"><img src="meat/drinking2.png" alt="">taby</button>
<button data-mobile-panel="discussion" aria-pressed="false"><img src="meat/ikona_diskuse.png" alt="">diskuse</button>
<button id="bn-napady" aria-pressed="false" aria-controls="ideas-workspace"><img src="meat/ikona_napady.png" alt="">nápady</button>
</nav>
<dialog id="catalog-dialog" aria-label="Skladby a zkoušky"><button id="catalog-close" type="button">Zavřít výběr</button><div id="catalog-dialog-slot"></div></dialog>
<?php if($config['canCreate']):?><dialog id="create-collection-dialog" aria-labelledby="create-collection-title"><form id="create-collection"><h2 id="create-collection-title">Nová skladba</h2><label>Nový název<input name="title" maxlength="200" required></label><p class="edit-error" role="alert"></p><div class="toolbar"><button>Vytvořit</button><button id="create-collection-cancel" type="button">Zrušit</button></div></form></dialog><?php endif;?>
<dialog id="editor"><form id="edit-form"><h2>Upravit</h2><label>Název<input name="title" maxlength="200" required></label><label id="summary-label">Popisek<textarea name="summary" maxlength="10000" rows="5"></textarea></label><p class="edit-error" role="alert"></p><div class="toolbar"><button>Uložit</button><button type="button" id="edit-cancel">Zrušit</button><button type="button" id="edit-reload" hidden>Načíst aktuální verzi</button></div></form></dialog>
<dialog id="move-dialog" aria-labelledby="move-title"><form id="move-form"><h2 id="move-title">Přesunout <span id="move-item-title"></span></h2><label>Cílová skladba nebo zkouška<select name="collection_id" required></select></label><p class="edit-error" role="alert"></p><div class="toolbar"><button type="submit">Potvrdit přesun</button><button type="button" id="move-cancel">Zrušit</button></div></form></dialog>
<script>window.VZ2=<?=json_encode($config,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_QUOT|JSON_HEX_APOS)?>;
window.MULTITRACK_CONFIG={listUrl:'php/ajax/vz2.php?action=mixer',detailUrl:'php/ajax/vz2.php?action=mixer&id={id}',canUpload:false,cacheDb:'zkusebna-vz2-cache',cacheStore:'audio',cachePrefix:window.VZ2.cachePrefix,requireFreshMetadata:true,managedNavigation:true};</script>
<script src="js/vz2-cache.js"></script><script src="js/multitrack.js?v=<?=filemtime(__DIR__.'/js/multitrack.js')?>"></script><script src="js/vz2-timestamps.js"></script><script src="js/vz2-content.js?v=<?=filemtime(__DIR__.'/js/vz2-content.js')?>"></script><script src="js/vz2-layout.js?v=<?=filemtime(__DIR__.'/js/vz2-layout.js')?>"></script><script src="js/vz2-player.js?v=<?=filemtime(__DIR__.'/js/vz2-player.js')?>"></script><script src="js/vz2.js?v=<?=filemtime(__DIR__.'/js/vz2.js')?>"></script>
</body></html>
