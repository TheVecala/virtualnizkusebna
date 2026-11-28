<div id="overview-controls-slot"><div id="overview-controls" role="group" aria-label="Nastavení přehledu">
<div id="overview-tabs" class="sidebar-tabs" role="tablist" aria-label="Kompaktní přehled" hidden>
<button id="overview-tab-presets" type="button" role="tab" aria-controls="overview-presets-pane" aria-selected="true">Předvolby</button>
<button id="overview-tab-custom" type="button" role="tab" aria-controls="overview-custom-pane" aria-selected="false" tabindex="-1">Vlastní výběr</button>
</div>
<section id="overview-presets-pane" class="overview-presets" aria-label="Předvolby výpisu">
<div id="overview-presets" class="overview-filter-actions" role="group" aria-label="Předvolby">
<button type="button" data-overview-preset="all" aria-pressed="true">Vše</button>
<button type="button" data-overview-preset="song_details" aria-pressed="false">Popisky skladeb</button>
<button type="button" data-overview-preset="lyrics" aria-pressed="false">Jen texty</button>
<button type="button" data-overview-preset="starts_notes" aria-pressed="false">Začátky a zápisky</button>
<button type="button" data-overview-preset="bar_details" aria-pressed="false">Jen detaily taktů</button>
<button type="button" data-overview-preset="markers" aria-pressed="false">Jen časové značky</button>
<button type="button" data-overview-preset="summaries" aria-pressed="false">Jen souhrny</button>
</div><p id="overview-preset-status" class="overview-filter-hint" role="status">Předvolba: Vše</p>
</section>
<div id="overview-custom-pane"><details id="overview-filters" class="overview-filters">
<summary>Vlastní výběr <span id="overview-filter-count">Vše</span></summary>
<div class="overview-filter-body">
<div class="overview-filter-actions"><button id="overview-filter-all" type="button">Zaškrtnout vše</button><button id="overview-filter-none" type="button">Zrušit druhy obsahu</button></div>
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
<label><input type="checkbox" data-filter="rehearsal_marker_song_start" checked> Úseky</label>
<label><input type="checkbox" data-filter="rehearsal_marker_song_end" checked> Nespárované konce</label>
<label><input type="checkbox" data-filter="rehearsal_marker_passage" checked> Značky pasáží</label>
<label><input type="checkbox" data-filter="rehearsal_marker_note" checked> Časové poznámky</label>
<label><input type="checkbox" data-filter="rehearsal_discussion" checked> Diskuse</label>
<label><input type="checkbox" data-filter="rehearsal_other" checked> Ostatní dokumenty</label>
</fieldset>
<fieldset class="overview-filter-group"><legend>Obsah skladeb</legend>
<label><input type="checkbox" data-filter="song_details" checked> Popisek, tempo a takt</label>
<label><input type="checkbox" data-filter="song_lyrics" checked> Text a akordy</label>
<label><input type="checkbox" data-filter="song_tablature" checked> Tabulatura</label>
<label><input type="checkbox" data-filter="song_map_sections" checked> Sekce mapy skladby</label>
<label><input type="checkbox" data-filter="song_map_details" checked> Detaily taktů</label>
<label><input type="checkbox" data-filter="song_summary" checked> Souhrny</label>
<label><input type="checkbox" data-filter="song_attachment" checked> Poznámky k přílohám</label>
<label><input type="checkbox" data-filter="song_marker_song_start" checked> Úseky</label>
<label><input type="checkbox" data-filter="song_marker_song_end" checked> Nespárované konce</label>
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
<p class="overview-filter-hint overview-filter-help">Po vytvoření výpisu se změny zaškrtávátek projeví hned, bez nového načtení.</p>
</div>
</details></div>
</div></div>
<div class="overview-actions">
<?php if (!empty($overviewStandalone)): ?><button id="overview-generate" type="button">Vytvořit výpis</button><?php endif; ?>
<span id="overview-status" role="status" aria-live="polite"><?= !empty($overviewStandalone) ? 'Výpis zatím není vytvořený.' : '' ?></span>
<button id="overview-retry" type="button" hidden>Zkusit znovu</button>
</div>
<div id="overview-output" hidden>
<div id="overview-meta" class="overview-meta"></div>
<p id="overview-no-results" class="overview-empty" hidden>Zaškrtněte zkoušky nebo skladby, které chcete zobrazit.</p>
<nav class="overview-jump" aria-label="Oddíly přehledu"><a href="#overview-rehearsals">Zkoušky</a><a href="#overview-songs">Skladby</a></nav>
<section id="overview-rehearsals" class="overview-section" aria-labelledby="overview-rehearsals-title"><h2 id="overview-rehearsals-title">Zkoušky</h2><div id="overview-rehearsal-list" class="overview-list"></div></section>
<section id="overview-songs" class="overview-section" aria-labelledby="overview-songs-title"><h2 id="overview-songs-title">Skladby</h2><div id="overview-song-list" class="overview-list"></div></section>
</div>
