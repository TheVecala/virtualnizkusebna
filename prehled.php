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
?>
<!doctype html>
<html lang="cs" data-theme="<?=site_theme()?>">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Kompaktní přehled · Zkušebna DK!</title>
<link rel="stylesheet" href="css/vz2-song-map-symbol.css?v=<?=hash_file('sha256', __DIR__.'/css/vz2-song-map-symbol.css')?>">
<link rel="stylesheet" href="css/themes.css?v=<?=filemtime(__DIR__.'/css/themes.css')?>">
<link rel="stylesheet" href="css/vz2-overview-render.css?v=<?=filemtime(__DIR__.'/css/vz2-overview-render.css')?>">
<link rel="stylesheet" href="css/vz2-overview.css?v=<?=filemtime(__DIR__.'/css/vz2-overview.css')?>">
<script defer src="js/vz2-timestamp-model.js?v=<?=filemtime(__DIR__.'/js/vz2-timestamp-model.js')?>"></script>
<script src="js/vz2-song-map-model.js?v=<?=filemtime(__DIR__.'/js/vz2-song-map-model.js')?>" defer></script>
<script defer src="js/vz2-song-map-svg.js?v=<?=hash_file('sha256', __DIR__.'/js/vz2-song-map-svg.js')?>"></script>
<script src="js/vz2-overview-filter.js?v=<?=filemtime(__DIR__.'/js/vz2-overview-filter.js')?>" defer></script>
<script src="js/vz2-overview-render.js?v=<?=filemtime(__DIR__.'/js/vz2-overview-render.js')?>" defer></script>
<script src="js/vz2-overview.js?v=<?=filemtime(__DIR__.'/js/vz2-overview.js')?>" defer></script>
</head>
<body class="overview-page">
<header class="overview-topbar"><a class="overview-brand" href="index.php?v=2">ZKUŠEBNA DK!</a><a href="index.php?v=2">← Zpět do zkušebny</a></header>
<main>
<div class="overview-intro">
<p class="overview-kicker">SAMOSTATNÝ NÁHLED</p>
<h1>Kompaktní přehled</h1>
<p>Texty a zápisky ze všech zkoušek a skladeb na jednom místě. Výpis se sestaví jen po kliknutí a je pouze pro čtení.</p>
</div>
<?php require __DIR__ . '/php/inc/vz2_overview_view.php'; ?>
</main>
</body>
</html>
