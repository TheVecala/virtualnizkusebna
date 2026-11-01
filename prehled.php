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
<script src="js/vz2-song-map-model.js?v=<?=filemtime(__DIR__.'/js/vz2-song-map-model.js')?>" defer></script>
<script src="js/vz2-overview-filter.js?v=<?=filemtime(__DIR__.'/js/vz2-overview-filter.js')?>" defer></script>
<script src="js/vz2-overview.js?v=<?=filemtime(__DIR__.'/js/vz2-overview.js')?>" defer></script>
</head>
<body>
<header class="overview-topbar"><a class="overview-brand" href="index.php?v=2">ZKUŠEBNA DK!</a><a href="index.php?v=2">← Zpět do zkušebny</a></header>
<main>
<div class="overview-intro">
<p class="overview-kicker">SAMOSTATNÝ NÁHLED</p>
<h1>Kompaktní přehled</h1>
<p>Texty a zápisky ze všech zkoušek a skladeb na jednom místě. Výpis se sestaví jen po kliknutí a je pouze pro čtení.</p>
</div>
<details id="overview-filters" class="overview-filters">
<summary>Co zobrazit <span id="overview-filter-count">Vše</span></summary>
<div class="overview-filter-body">
<div class="overview-filter-actions"><button id="overview-filter-all" type="button">Zaškrtnout vše</button><button id="overview-filter-none" type="button">Zrušit druhy obsahu</button><button type="button" data-overview-preset="lyrics">Jen texty</button><button type="button" data-overview-preset="starts_notes">Začátky a zápisky</button><button type="button" data-overview-preset="bar_details">Jen detaily taktů</button><button type="button" data-overview-preset="markers">Jen časové značky</button><button type="button" data-overview-preset="summaries">Jen souhrny</button></div>
<div class="overview-filter-grid">
<fieldset class="overview-filter-group"><legend>Celky a údaje</legend>
<label><input type="checkbox" data-filter="rehearsals" checked> Zkoušky</label>
<label><input type="checkbox" data-filter="songs" checked> Skladby</label>
<label><input type="checkbox" data-filter="show_empty" checked> I položky bez zápisků</label>
<label><input type="checkbox" data-filter="show_created" checked> Datum založení</label>
<label><input type="checkbox" data-filter="show_author" checked> Autor zápisku</label>
<label><input type="checkbox" data-filter="show_entry_date" checked> Datum zápisku</label>
</fieldset>
<fieldset class="overview-filter-group"><legend>Obsah zkoušek</legend>
<label><input type="checkbox" data-filter="rehearsal_notes" checked> Společné zápisky</label>
<label><input type="checkbox" data-filter="rehearsal_starts" checked> Přehled začátků skladeb</label>
<label><input type="checkbox" data-filter="rehearsal_played" checked> Hrané skladby</label>
<label><input type="checkbox" data-filter="rehearsal_summary" checked> Souhrny</label>
<label><input type="checkbox" data-filter="rehearsal_attachment" checked> Poznámky k přílohám</label>
<label><input type="checkbox" data-filter="rehearsal_marker_song_start" checked> Značky začátků skladeb</label>
<label><input type="checkbox" data-filter="rehearsal_marker_song_end" checked> Značky konců skladeb</label>
<label><input type="checkbox" data-filter="rehearsal_marker_passage" checked> Značky pasáží</label>
<label><input type="checkbox" data-filter="rehearsal_marker_note" checked> Časové poznámky</label>
<label><input type="checkbox" data-filter="rehearsal_discussion" checked> Diskuse</label>
<label><input type="checkbox" data-filter="rehearsal_other" checked> Ostatní dokumenty</label>
</fieldset>
<fieldset class="overview-filter-group"><legend>Obsah skladeb</legend>
<label><input type="checkbox" data-filter="song_lyrics" checked> Text a akordy</label>
<label><input type="checkbox" data-filter="song_tablature" checked> Tabulatura</label>
<label><input type="checkbox" data-filter="song_map_sections" checked> Sekce mapy skladby</label>
<label><input type="checkbox" data-filter="song_map_details" checked> Detaily taktů</label>
<label><input type="checkbox" data-filter="song_summary" checked> Souhrny</label>
<label><input type="checkbox" data-filter="song_attachment" checked> Poznámky k přílohám</label>
<label><input type="checkbox" data-filter="song_marker_song_start" checked> Značky začátků skladeb</label>
<label><input type="checkbox" data-filter="song_marker_song_end" checked> Značky konců skladeb</label>
<label><input type="checkbox" data-filter="song_marker_passage" checked> Značky pasáží</label>
<label><input type="checkbox" data-filter="song_marker_note" checked> Časové poznámky</label>
<label><input type="checkbox" data-filter="song_discussion" checked> Diskuse</label>
<label><input type="checkbox" data-filter="song_other" checked> Ostatní dokumenty</label>
</fieldset>
</div>
<div id="overview-collection-filters" class="overview-collection-filters" hidden>
<h2>Konkrétní položky</h2>
<div class="overview-filter-grid">
<fieldset class="overview-filter-group"><legend>Zkoušky</legend><div class="overview-filter-actions"><button type="button" data-select-kind="rehearsal" data-select="all">Všechny</button><button type="button" data-select-kind="rehearsal" data-select="none">Žádná</button></div><div id="overview-rehearsal-options" class="overview-collection-options"></div></fieldset>
<fieldset class="overview-filter-group"><legend>Skladby</legend><div class="overview-filter-actions"><button type="button" data-select-kind="song" data-select="all">Všechny</button><button type="button" data-select-kind="song" data-select="none">Žádná</button></div><div id="overview-song-options" class="overview-collection-options"></div></fieldset>
</div>
</div>
<p class="overview-filter-hint">Po vytvoření výpisu se změny zaškrtávátek projeví hned, bez nového načtení.</p>
</div>
</details>
<div class="overview-actions"><button id="overview-generate" type="button">Vytvořit výpis</button><span id="overview-status" role="status" aria-live="polite">Výpis zatím není vytvořený.</span></div>
<div id="overview-output" hidden>
<div id="overview-meta" class="overview-meta"></div>
<p id="overview-no-results" class="overview-empty" hidden>Zaškrtněte zkoušky nebo skladby, které chcete zobrazit.</p>
<nav class="overview-jump" aria-label="Oddíly přehledu"><a href="#overview-rehearsals">Zkoušky</a><a href="#overview-songs">Skladby</a></nav>
<section id="overview-rehearsals" class="overview-section" aria-labelledby="overview-rehearsals-title"><h2 id="overview-rehearsals-title">Zkoušky</h2><div id="overview-rehearsal-list" class="overview-list"></div></section>
<section id="overview-songs" class="overview-section" aria-labelledby="overview-songs-title"><h2 id="overview-songs-title">Skladby</h2><div id="overview-song-list" class="overview-list"></div></section>
</div>
</main>
</body>
</html>
