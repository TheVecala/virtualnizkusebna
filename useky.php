<?php
declare(strict_types=1);
require_once __DIR__.'/php/inc/session.php';
app_session_start();
header('Cache-Control: no-store');
require_once __DIR__.'/config.php';
require_once __DIR__.'/php/inc/vz2_core.php';
try {
    vz2_ready(); vz2_login();
} catch (Vz2Error $e) {
    if ($e->status === 401) { header('Location: index.php?v=2',true,302); exit; }
    http_response_code($e->status);
    echo '<p>'.auth_h($e->getMessage()).'</p><a href="index.php?v=2">Zpět do zkušebny</a>';
    exit;
}
$config = ['csrf'=>auth_csrf_token(),'write'=>defined('VZ2_WRITES_ENABLED') && VZ2_WRITES_ENABLED === true && !empty($_SESSION['user_id']),'cachePrefix'=>'vz2:'.VZ2_DATASET_KEY.':'.VZ2_ENVIRONMENT.':'];
?>
<!doctype html>
<html lang="cs" data-theme="<?=site_theme()?>">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Úseky nahrávek · Zkušebna DK!</title>
<link rel="stylesheet" href="css/themes.css?v=<?=filemtime(__DIR__.'/css/themes.css')?>">
<link rel="stylesheet" href="css/vz2.css?v=<?=filemtime(__DIR__.'/css/vz2.css')?>">
<link rel="stylesheet" href="css/vz2-segments.css?v=<?=filemtime(__DIR__.'/css/vz2-segments.css')?>">
<script>window.VZ2=<?=json_encode($config,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)?>;</script>
<script defer src="js/vz2-cache.js?v=<?=filemtime(__DIR__.'/js/vz2-cache.js')?>"></script>
<script defer src="js/vz2-downloads.js?v=<?=filemtime(__DIR__.'/js/vz2-downloads.js')?>"></script>
<script defer src="js/vz2-downloads-panel.js?v=<?=filemtime(__DIR__.'/js/vz2-downloads-panel.js')?>"></script>
<script defer src="js/vz2-timestamp-model.js?v=<?=filemtime(__DIR__.'/js/vz2-timestamp-model.js')?>"></script><script src="js/vz2-segments-model.js?v=<?=filemtime(__DIR__.'/js/vz2-segments-model.js')?>" defer></script>
<script defer src="js/vz2-timestamp-store.js?v=<?=filemtime(__DIR__.'/js/vz2-timestamp-store.js')?>"></script>
<script defer src="js/vz2-timestamp-playback.js?v=<?=filemtime(__DIR__.'/js/vz2-timestamp-playback.js')?>"></script><script defer src="js/vz2-note-editor.js?v=<?=filemtime(__DIR__.'/js/vz2-note-editor.js')?>"></script><script defer src="js/vz2-timestamp-controls.js?v=<?=filemtime(__DIR__.'/js/vz2-timestamp-controls.js')?>"></script><script defer src="js/vz2-timestamp-editor.js?v=<?=filemtime(__DIR__.'/js/vz2-timestamp-editor.js')?>"></script>
<script defer src="js/vz2-timeline.js?v=<?=filemtime(__DIR__.'/js/vz2-timeline.js')?>"></script><script src="js/vz2-segments-panel.js?v=<?=filemtime(__DIR__.'/js/vz2-segments-panel.js')?>" defer></script>
<script src="js/vz2-segments.js?v=<?=filemtime(__DIR__.'/js/vz2-segments.js')?>" defer></script>
<link rel="stylesheet" href="css/vz2-timestamp-editor.css?v=<?=filemtime(__DIR__.'/css/vz2-timestamp-editor.css')?>">
<link rel="stylesheet" href="css/vz2-select.css?v=<?=filemtime(__DIR__.'/css/vz2-select.css')?>">
<script defer src="js/vz2-select.js?v=<?=filemtime(__DIR__.'/js/vz2-select.js')?>"></script>
</head>
<body class="segments-page">
<header class="segments-topbar"><a class="segments-brand" href="index.php?v=2">ZKUŠEBNA DK!</a><nav aria-label="Navigace"><a href="prehled.php">Kompaktní přehled</a><a href="index.php?v=2">← Zpět do zkušebny</a></nav></header>
<main>
<header class="segments-intro"><div><p class="segments-kicker">SAMOSTATNÝ PANEL · ČASOVÝ PŘEHLED</p><h1>Úseky nahrávek</h1><p>Celá zkouška. Jednotlivé úseky. Každá pasáž na svém místě.</p></div><button id="segments-reload" type="button">Obnovit data</button></header>
<?php require __DIR__ . '/php/inc/vz2_segments_view.php'; ?>
</main>
</body>
</html>
