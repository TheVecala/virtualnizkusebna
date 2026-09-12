<?php if ($can_upload_multitrack): ?>
<div class="modal fade" id="modal_multitrack_upload" tabindex="-1" role="dialog" aria-labelledby="mt-upload-title" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="mt-upload-title">VLOŽIT NOVÝ MULTITRACK</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Zavřít"><span aria-hidden="true">&times;</span></button>
            </div>
            <form id="mt-upload-form" action="php/actions/upload_multitrack.php" method="post"
                  enctype="multipart/form-data" novalidate>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="mt-upload-name">Název multitracku</label>
                        <input id="mt-upload-name" name="name" type="text" class="form-control" maxlength="120" required>
                    </div>
                    <div class="form-group">
                        <label for="mt-upload-files">Audio stopy</label>
                        <input id="mt-upload-files" name="tracks[]" type="file" class="form-control"
                               accept=".wav,.flac,.mp3,audio/wav,audio/flac,audio/mpeg" multiple required>
                        <small class="form-text text-muted">Celá sada musí používat jeden formát: WAV, FLAC nebo MP3.</small>
                    </div>
                    <div id="mt-upload-selection" class="mt-upload-selection" aria-live="polite"></div>
                    <div id="mt-upload-progress-wrap" class="mt-upload-progress" hidden>
                        <div class="mt-progress-track"><div id="mt-upload-progress-bar"></div></div>
                        <div id="mt-upload-progress-text">0 %</div>
                    </div>
                    <div id="mt-upload-result" class="mt-upload-result" role="status" aria-live="polite" hidden></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-dismiss="modal">ZRUŠIT</button>
                    <button id="mt-upload-submit" type="submit" class="btn btn-primary">VLOŽIT SADU</button>
                </div>
            </form>
        </div>
    </div>
</div>
<?php endif; ?>

<div class="modal fade" id="modal_multitrack_switch" tabindex="-1" role="dialog" aria-labelledby="mt-switch-title" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="mt-switch-title">ZMĚNIT MULTITRACK?</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Zavřít"><span aria-hidden="true">&times;</span></button>
            </div>
            <div class="modal-body">
                <p>Současné přehrávání se zastaví a načtené stopy se uvolní.</p>
                <div class="modal-ctx">Nový multitrack: <strong id="mt-switch-name">—</strong></div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">PONECHAT SOUČASNÝ</button>
                <button id="mt-switch-confirm" type="button" class="btn btn-primary">NAČÍST NOVÝ</button>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="modal_multitrack_errors" tabindex="-1" role="dialog" aria-labelledby="mt-errors-title" aria-hidden="true" data-backdrop="static">
    <div class="modal-dialog modal-dialog-centered" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="mt-errors-title">NĚKTERÉ STOPY SELHALY</h5>
            </div>
            <div class="modal-body">
                <p id="mt-error-intro">Tyto stopy se nepodařilo stáhnout nebo dekódovat:</p>
                <ul id="mt-error-list" class="mt-error-list"></ul>
                <p id="mt-error-question">Chcete pokračovat pouze s úspěšně připravenými stopami?</p>
            </div>
            <div class="modal-footer">
                <button id="mt-error-close" type="button" class="btn btn-secondary" data-dismiss="modal">NEPOKRAČOVAT</button>
                <button id="mt-continue-ready" type="button" class="btn btn-primary">POKRAČOVAT</button>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="modal_multitrack_offline" tabindex="-1" role="dialog" aria-labelledby="mt-offline-confirm-title" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="mt-offline-confirm-title">ULOŽIT MULTITRACK OFFLINE?</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Zavřít"><span aria-hidden="true">&times;</span></button>
            </div>
            <div class="modal-body">
                <p id="mt-offline-confirm-message">Uloží se původní zdrojové soubory všech stop do tohoto prohlížeče.</p>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">ZRUŠIT</button>
                <button id="mt-offline-confirm-submit" type="button" class="btn btn-primary">ULOŽIT</button>
            </div>
        </div>
    </div>
</div>

