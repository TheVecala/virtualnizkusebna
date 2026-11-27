<div id="segments-controls-slot"><div id="segments-controls" class="segments-page" role="group" aria-label="Nastavení úseků">
<div class="segments-toolbar">
<label>Zobrazení<select id="segments-view"><option value="single">Jedna nahrávka</option><option value="stack">Nahrávky nad sebou</option></select></label>
<label>Barvy<select id="segments-color"><option value="type">Podle typu úseku</option><option value="song">Podle skladby</option><option value="recording">Podle nahrávky</option><option value="mono">Jednobarevně</option></select></label>
<label>Časová osa<select id="segments-scale"><option value="shared">Stejné měřítko času</option><option value="fit">Každá na celou šířku</option></select></label>
<label>Přiblížení<select id="segments-zoom"><option value="1">Celá nahrávka</option><option value="2">2×</option><option value="4">4×</option><option value="8">8×</option></select></label>
<div class="segments-switches"><label><input id="segments-wave" type="checkbox"> wave</label><label><input id="segments-compact" type="checkbox" checked>Kompaktní</label></div>
</div>
<details class="segments-sources" id="segments-sources" open><summary>Nahrávky <span id="segments-count"></span></summary><div class="segments-source-tools"><label>Hledat<input id="segments-search" type="search" placeholder="Název nahrávky nebo zkoušky"></label><label>Zkouška / skladba<select id="segments-collection"><option value="">Všechny</option></select></label><button id="segments-select-all" type="button" hidden>Vybrat zobrazené</button><button id="segments-select-none" type="button" hidden>Zrušit výběr</button></div><div id="segments-recordings" class="segments-recordings"></div></details>
<div class="segments-display-options" role="group" aria-label="Viditelné druhy značek"><label><input id="segments-takes" type="checkbox" checked>Úseky / skladby</label><label><input id="segments-passages" type="checkbox" checked>Pasáže</label><label><input id="segments-notes" type="checkbox" checked>Poznámky a hranice</label><label><input id="segments-labels" type="checkbox" checked>Popisky</label></div>
</div></div>
<p id="segments-status" class="segments-status" role="status" aria-live="polite">Načítám nahrávky…</p>
<div id="segments-panel"></div>
<div id="segments-legend" class="segments-legend" aria-label="Legenda barev"></div>
<p class="segments-help">Kliknutím nastavíte čas v nahrávce a vyberete úsek, dvojklikem přehrajete celý úsek. Délky pásů odpovídají času. Bod značí poznámku nebo neúplný úsek.</p>
<section class="segments-selection" id="segments-selection" aria-label="Vybraný úsek" hidden>
<div class="segments-selection-heading"><div><p class="segments-kicker">VYBRANÝ ÚSEK</p><h2 id="segments-selected-title"></h2><p id="segments-selected-info"></p></div><span id="segments-selected-time"></span></div>
<p id="segments-selected-body"></p>
<div class="segments-player-actions"><button id="segments-edit" type="button">Upravit úsek</button><button id="segments-finish" type="button">Doplnit konec</button><button id="segments-delete" type="button">Smazat úsek</button><button id="segments-new-take" type="button">Nový úsek</button><button id="segments-new-note" type="button">Nová poznámka</button><button id="segments-new-passage" type="button">Nová pasáž</button><button id="segments-play" type="button">▶ Přehrát úsek</button><label><input id="segments-loop" type="checkbox">Opakovat úsek</label><a id="segments-open">Otevřít v looperu</a></div>
<audio id="segments-audio" controls preload="none" hidden></audio><p id="segments-audio-status" role="status"></p>
</section>
<noscript>Pro zobrazení úseků je potřeba JavaScript.</noscript>
