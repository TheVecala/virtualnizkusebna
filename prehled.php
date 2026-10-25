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
<link rel="stylesheet" href="css/themes.css?v=<?=filemtime(__DIR__.'/css/themes.css')?>">
<link rel="stylesheet" href="css/vz2-overview.css?v=<?=filemtime(__DIR__.'/css/vz2-overview.css')?>">
<script src="js/vz2-overview.js?v=<?=filemtime(__DIR__.'/js/vz2-overview.js')?>" defer></script>
</head>
<body>
<header class="overview-topbar"><a class="overview-brand" href="index.php?v=2">ZKUŠEBNA DK!</a><a href="index.php?v=2">← Zpět do zkušebny</a></header>
<main>
<div class="overview-intro">
<p class="overview-kicker">SAMOSTATNÝ NÁHLED</p>
<h1>Kompaktní přehled</h1>
<p>Texty a zápisky ze všech zkoušek a skladeb na jednom místě. Výpis se sestaví jen po kliknutí a je pouze pro čtení.</p>
<div class="overview-actions"><button id="overview-generate" type="button">Vytvořit výpis</button><span id="overview-status" role="status" aria-live="polite">Výpis zatím není vytvořený.</span></div>
</div>
<div id="overview-output" hidden>
<div id="overview-meta" class="overview-meta"></div>
<nav class="overview-jump" aria-label="Oddíly přehledu"><a href="#overview-rehearsals">Zkoušky</a><a href="#overview-songs">Skladby</a></nav>
<section id="overview-rehearsals" class="overview-section" aria-labelledby="overview-rehearsals-title"><h2 id="overview-rehearsals-title">Zkoušky</h2><div id="overview-rehearsal-list" class="overview-list"></div></section>
<section id="overview-songs" class="overview-section" aria-labelledby="overview-songs-title"><h2 id="overview-songs-title">Skladby</h2><div id="overview-song-list" class="overview-list"></div></section>
</div>
</main>
</body>
</html>
