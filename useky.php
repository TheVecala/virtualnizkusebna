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
<title>Úseky nahrávek · Zkušebna DK!</title>
<link rel="stylesheet" href="css/themes.css?v=<?=filemtime(__DIR__.'/css/themes.css')?>">
<link rel="stylesheet" href="css/vz2-segments.css?v=<?=filemtime(__DIR__.'/css/vz2-segments.css')?>">
<script src="js/vz2-segments-model.js?v=<?=filemtime(__DIR__.'/js/vz2-segments-model.js')?>" defer></script>
<script src="js/vz2-segments-panel.js?v=<?=filemtime(__DIR__.'/js/vz2-segments-panel.js')?>" defer></script>
<script src="js/vz2-segments.js?v=<?=filemtime(__DIR__.'/js/vz2-segments.js')?>" defer></script>
</head>
<body class="segments-page">
<header class="segments-topbar"><a class="segments-brand" href="index.php?v=2">ZKUŠEBNA DK!</a><nav aria-label="Navigace"><a href="prehled.php">Kompaktní přehled</a><a href="index.php?v=2">← Zpět do zkušebny</a></nav></header>
<main>
<header class="segments-intro"><div><p class="segments-kicker">SAMOSTATNÝ PANEL · ČASOVÝ PŘEHLED</p><h1>Úseky nahrávek</h1><p>Celá zkouška. Jednotlivé pokusy. Každá pasáž na svém místě.</p></div><button id="segments-reload" type="button">Obnovit data</button></header>
<div class="segments-toolbar">
<label>Zobrazení<select id="segments-view"><option value="single">Jedna nahrávka</option><option value="stack">Nahrávky nad sebou</option></select></label>
<label>Barvy<select id="segments-color"><option value="type">Podle typu úseku</option><option value="song">Podle skladby</option><option value="recording">Podle nahrávky</option><option value="mono">Jednobarevně</option></select></label>
<label>Časová osa<select id="segments-scale"><option value="shared">Stejné měřítko času</option><option value="fit">Každá na celou šířku</option></select></label>
<label>Přiblížení<select id="segments-zoom"><option value="1">Celá nahrávka</option><option value="2">2×</option><option value="4">4×</option><option value="8">8×</option></select></label>
<div class="segments-switches"><label><input id="segments-wave" type="checkbox"> Wavekřivka v pozadí</label><label><input id="segments-compact" type="checkbox">Kompaktní</label></div>
</div>
<details class="segments-sources" id="segments-sources" open><summary>Nahrávky <span id="segments-count"></span></summary><div class="segments-source-tools"><label>Hledat<input id="segments-search" type="search" placeholder="Název nahrávky nebo zkoušky"></label><label>Zkouška / skladba<select id="segments-collection"><option value="">Všechny</option></select></label><button id="segments-select-all" type="button" hidden>Vybrat zobrazené</button><button id="segments-select-none" type="button" hidden>Zrušit výběr</button></div><div id="segments-recordings" class="segments-recordings"></div></details>
<div class="segments-display-options" role="group" aria-label="Viditelné druhy značek"><label><input id="segments-takes" type="checkbox" checked>Pokusy / skladby</label><label><input id="segments-passages" type="checkbox" checked>Pasáže</label><label><input id="segments-notes" type="checkbox" checked>Poznámky a hranice</label><label><input id="segments-labels" type="checkbox" checked>Popisky</label></div>
<p id="segments-status" class="segments-status" role="status" aria-live="polite">Načítám nahrávky…</p>
<div id="segments-panel"></div>
<div id="segments-legend" class="segments-legend" aria-label="Legenda barev"></div>
<p class="segments-help">Kliknutím vyberete úsek, dvojklikem ho přehrajete. Délky pásů odpovídají času. Bod značí poznámku nebo neúplný úsek.</p>
<section class="segments-selection" id="segments-selection" aria-label="Vybraný úsek" hidden>
<div class="segments-selection-heading"><div><p class="segments-kicker">VYBRANÝ ÚSEK</p><h2 id="segments-selected-title"></h2><p id="segments-selected-info"></p></div><span id="segments-selected-time"></span></div>
<p id="segments-selected-body"></p>
<div class="segments-player-actions"><button id="segments-play" type="button">▶ Přehrát úsek</button><label><input id="segments-loop" type="checkbox">Opakovat úsek</label><a id="segments-open">Otevřít v looperu</a></div>
<audio id="segments-audio" controls preload="none" hidden></audio><p id="segments-audio-status" role="status"></p>
</section>
<noscript>Pro zobrazení úseků je potřeba JavaScript.</noscript>
</main>
</body>
</html>
