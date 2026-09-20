<?php
declare(strict_types=1);
if(session_status()!==PHP_SESSION_ACTIVE)session_start();
header('Cache-Control: no-store');
require_once __DIR__.'/config.php';
require_once __DIR__.'/php/inc/vz2_core.php';
try{
    vz2_ready();
    if(($_SESSION['logged_in_single']??false)!==true){
        $query=['v'=>'2'];
        foreach(['collection_id','recording_id','time_ms','view'] as $p)if(isset($_GET[$p]) && is_string($_GET[$p]))$query[$p]=$_GET[$p];
        $_SESSION['deep_link_after_login']=http_build_query($query);
        require __DIR__.'/php/loginbox4.php';return;
    }
    vz2_login();
}catch(Vz2Error $e){http_response_code($e->status);echo '<p>'.auth_h($e->getMessage()).'</p><a href="index.php">Zpět do zkušebny</a>';return;}
$write=defined('VZ2_WRITES_ENABLED') && VZ2_WRITES_ENABLED && !empty($_SESSION['user_id']);
$mixerView=($_GET['view']??'')==='mixer';
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
<header><a class="brand" href="index.php?v=2">VIRTUÁLNÍ ZKUŠEBNA <small>2.0</small></a><nav>
<a href="index.php?v=2">Skladby a zkoušky</a><a href="index.php?v=2&amp;view=mixer">Mixér</a>
<button id="show-ideas">Nápady</button>
<?php if(auth_is_admin()):?><a href="admin.php">Účty</a><button id="show-log">Deník</button><?php endif;?>
<button id="show-offline">Offline soubory</button><?php if(!defined('VZ2_ONLY') || VZ2_ONLY!==true):?><a href="index.php">Původní zkušebna</a><?php endif;?><span><?=auth_h($_SESSION['user_name']??'Host')?></span><button id="logout">Odhlásit</button></nav></header>
<main><p id="message" role="status" aria-live="polite"></p>
<?php if(!$write):?><p class="notice">Režim pouze pro čtení.</p><?php endif;?>
<div class="layout"<?=$mixerView?' hidden':''?>><aside><div class="tabs"><button data-kind="song" aria-pressed="true">Skladby</button><button data-kind="rehearsal" aria-pressed="false">Zkoušky</button></div>
<div id="collections"></div>
<?php if($config['canCreate']):?><form id="create-collection"><label>Nový název<input name="title" maxlength="200" required></label><button>Vytvořit</button></form><?php endif;?>
</aside><section id="content"><p>Načítám…</p></section></div>
<section id="operations" hidden><h2>Nedokončené operace</h2><div></div></section>
<section id="activity" hidden><h2>Deník změn</h2><div></div><button id="log-more">Starší změny</button></section>
<section id="offline-files" hidden><h2>Offline soubory tohoto prostředí</h2><p>Lokální kopie v tomto prohlížeči. Odstraněné serverové audio lze odsud stáhnout nebo uvolnit jeho místo.</p><div></div><button id="offline-clear">Odebrat všechny místní kopie</button></section>
<section id="mixer-panel" class="mt-shell"<?=$mixerView?'':' hidden'?>><h2>Mixér</h2>
<div id="mt-notice" role="status" hidden></div><div id="mt-selector"></div>
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
<dialog id="editor"><form id="edit-form"><h2>Upravit</h2><label>Název<input name="title" maxlength="200" required></label><label id="summary-label">Popisek<textarea name="summary" maxlength="10000" rows="5"></textarea></label><p class="edit-error" role="alert"></p><div class="toolbar"><button>Uložit</button><button type="button" id="edit-cancel">Zrušit</button><button type="button" id="edit-reload" hidden>Načíst aktuální verzi</button></div></form></dialog>
<script>window.VZ2=<?=json_encode($config,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_QUOT|JSON_HEX_APOS)?>;
window.MULTITRACK_CONFIG={listUrl:'php/ajax/vz2.php?action=mixer',detailUrl:'php/ajax/vz2.php?action=mixer&id={id}',canUpload:false,cacheDb:'zkusebna-vz2-cache',cacheStore:'audio',cachePrefix:window.VZ2.cachePrefix,requireFreshMetadata:true,initialId:new URLSearchParams(location.search).get('recording_id')||''};</script>
<script src="js/vz2-cache.js"></script><script src="js/multitrack.js"></script><script src="js/vz2-timestamps.js"></script><script src="js/vz2-content.js?v=<?=filemtime(__DIR__.'/js/vz2-content.js')?>"></script><script src="js/vz2.js?v=<?=filemtime(__DIR__.'/js/vz2.js')?>"></script>
</body></html>
