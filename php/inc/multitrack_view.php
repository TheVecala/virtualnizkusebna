    <!-- Shared player, library and notes for both multitrack entry points. -->
    <section id="multitrack" class="mt-shell" aria-labelledby="mt-title">


        <div id="mt-notice" class="mt-notice" role="status" aria-live="polite" hidden></div>

        <section id="mt-loading-panel" class="mt-loading-panel" aria-labelledby="mt-load-summary" hidden>
            <div class="mt-panel-heading">
                <h2>Stav načítání</h2>
                <strong id="mt-load-summary">Připraveno 0 / 0 stop</strong>
            </div>
            <div id="mt-track-statuses" class="mt-track-statuses"></div>
        </section>

        <h1 id="mt-title" class="sr-only">Multitracky</h1>
        <div id="mt-playing-name" class="mt-playing-name">Vyberte nahrávku</div>
        <section class="mt-transport" aria-label="Společné ovládání přehrávání">
            <div class="mt-transport-top">
                <div class="mt-transport-buttons" role="group" aria-label="Ovládání přehrávání">
                    <button id="mt-restart" class="wave-btn mt-control-button" type="button"
                            aria-label="Na začátek" title="Na začátek" disabled>
                        <i class="ti ti-player-track-prev" aria-hidden="true"></i>
                    </button>
                    <button id="mt-backward" class="wave-btn mt-control-button" type="button"
                            aria-label="Zpět o 5 sekund" title="Zpět o 5 sekund" disabled>
                        <i class="ti ti-player-skip-back" aria-hidden="true"></i>
                    </button>
                    <button id="mt-play" class="wave-btn mt-control-button mt-play-button" type="button"
                            aria-label="Přehrát" aria-pressed="false" title="Přehrát" disabled>
                        <i id="mt-play-icon" class="ti ti-player-play-filled" aria-hidden="true"></i>
                    </button>
                    <button id="mt-forward" class="wave-btn mt-control-button" type="button"
                            aria-label="Vpřed o 5 sekund" title="Vpřed o 5 sekund" disabled>
                        <i class="ti ti-player-skip-forward" aria-hidden="true"></i>
                    </button>
                </div>

                <label class="mt-main-volume" for="mt-master-volume">Hlasitost
                    <input id="mt-master-volume" type="range" min="0" max="100" value="100" aria-label="Hlavní hlasitost" disabled>
                    <output id="mt-master-value" for="mt-master-volume">100 %</output>
                </label>
                <button id="mt-mixer-toggle" class="wave-btn" type="button" aria-expanded="false" aria-controls="mt-mixer" hidden>Rozbalit mix</button>
                <button id="mt-offline" class="wave-btn mt-offline-button" type="button" aria-pressed="false" disabled>
                    <i id="mt-offline-icon" class="ti ti-download" aria-hidden="true"></i>
                    <span class="mt-offline-copy">
                        <span id="mt-offline-label">Uložit pro offline poslech</span>
                        <small id="mt-offline-status"></small>
                    </span>
                </button>
            </div>

            <div class="mt-timeline">
                <output id="mt-current-time" for="mt-seek">00:00</output>
                <input id="mt-seek" type="range" min="0" max="0" step="0.01" value="0"
                       aria-label="Pozice přehrávání" disabled>
                <output id="mt-total-time" for="mt-seek">00:00</output>
            </div>
        </section>

        <div id="mt-empty" class="mt-empty">
            <i class="ti ti-music" aria-hidden="true"></i>
            <strong>Vyberte multitrack</strong>
            <span>Otevřete nahrávku ze seznamu a nastavte si hlasitost jednotlivých stop.</span>
        </div>

        <section id="mt-mixer" class="mt-mixer" aria-label="Mixážní pult" hidden>
            <div class="mt-mixer-scroll">
                <div id="mt-tracks" class="mt-tracks"></div>

            </div>
        </section>
        <div class="mt-workspace-columns">
        <div class="mt-picker-card">
            <div class="mt-panel-heading">
                <h2 id="mt-library-title">Nahrávky</h2>
                <span class="mt-picker-state" data-mt-load-state aria-live="polite" aria-busy="true">Načítám…</span>
            </div>
            <?php if ($can_upload_multitrack): ?>
            <button type="button" class="btn-vz mt-new-button" data-toggle="modal" data-target="#modal_multitrack_upload">+ Vložit nahrávku</button>
            <?php endif; ?>
            <div id="mt-selector" class="mt-recordings" role="group" aria-labelledby="mt-library-title" aria-busy="true">
                <p class="mt-list-empty">Načítám seznam…</p>
            </div>
        </div>

        <section class="mt-notes-panel" aria-labelledby="mt-notes-title">
            <div class="mt-panel-heading">
                <h2 id="mt-notes-title">Obsah a poznámky</h2>
                <button id="mt-notes-refresh" type="button" class="btn-vz" disabled>Obnovit zápis</button>
            </div>
            <p id="mt-notes-status" role="status">Vyberte nahrávku ze seznamu.</p>
            <div id="mt-notes-content" hidden>
                <form id="mt-summary-form">
                    <label for="mt-summary">Shrnutí poslechu · co opravit příště</label>
                    <textarea id="mt-summary" rows="3" maxlength="10000" <?= ma_pravo('comment') ? '' : 'readonly' ?>></textarea>
                    <?php if (ma_pravo('comment')): ?><button type="submit" class="btn-vz">Uložit shrnutí</button><?php endif; ?>
                </form>
                <?php if (ma_pravo('comment')): ?>
                <div class="mt-note-actions">
                    <button id="mt-add-chapter" class="btn-vz" type="button">+ Začátek skladby</button>
                    <button id="mt-add-note" class="btn-vz" type="button">+ Poznámka v aktuálním čase</button>
                </div>
                <form id="mt-note-form" hidden>
                    <label for="mt-note-kind">Typ</label>
                    <select id="mt-note-kind"><option value="chapter">Začátek skladby / pokusu</option><option value="note">Poznámka</option></select>
                    <label for="mt-note-time">Čas (mm:ss nebo hh:mm:ss)</label>
                    <input id="mt-note-time" type="text" required inputmode="decimal" placeholder="12:35">
                    <label for="mt-note-text">Text</label>
                    <textarea id="mt-note-text" rows="2" maxlength="4000" required></textarea>
                    <div class="mt-note-actions"><button type="submit" class="btn-vz">Uložit</button><button id="mt-note-cancel" type="button" class="btn-vz">Zrušit</button></div>
                </form>
                <?php endif; ?>
                <div id="mt-outline"></div>
                <?php if (ma_pravo('delete_file')): ?>
                <button id="mt-remove-audio" class="btn-vz mt-remove-audio" type="button">Odstranit audio, zachovat zápis</button>
                <?php endif; ?>
            </div>
        </section>
        </div>
    </section>
