<?php
session_start();
error_reporting(0);
require_once __DIR__ . '/config.php';

// Stejné přihlášení a identita jedné kapely jako na hlavní stránce VZ.
if (empty($_SESSION['logged_in_single'])) {
    require __DIR__ . '/php/loginbox4.php';
    exit;
}

if (empty($_SESSION['role'])) {
    $_SESSION['role'] = 'muzikant';
}

if (empty($_SESSION['kapela'])) {
    $_SESSION['kapela'] = 'kapela';
    $_SESSION['befelemepesseveze'] = '471707760';
}

if (empty($_SESSION['multitrack_csrf'])) {
    $_SESSION['multitrack_csrf'] = bin2hex(random_bytes(32));
}

$can_upload_multitrack = ma_pravo('upload');
?>
<!doctype html>
<html lang="cs">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Multitrack · Virtuální zkušebna</title>
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css"
          crossorigin="anonymous">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css">
    <link rel="stylesheet" href="css/sticky-footer-navbar.css">
    <link rel="stylesheet" href="css/main.css?v=<?= filemtime(__DIR__ . '/css/main.css') ?>">
    <link rel="stylesheet" href="css/multitrack.css?v=<?= filemtime(__DIR__ . '/css/multitrack.css') ?>">
    <style>
        :root {
            --barva: #<?= htmlspecialchars($_SESSION['barva1'] ?? 'a7ac38', ENT_QUOTES) ?>;
            --pozadi: #<?= htmlspecialchars($_SESSION['barva_pozadi'] ?? '202428', ENT_QUOTES) ?>;
        }
    </style>
    <script src="https://code.jquery.com/jquery-3.7.1.min.js" crossorigin="anonymous" defer></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js" crossorigin="anonymous" defer></script>
    <script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js" crossorigin="anonymous" defer></script>
    <script src="https://cdn.jsdelivr.net/npm/idb-keyval@6/dist/umd.js" defer></script>
    <script src="js/multitrack.js?v=<?= filemtime(__DIR__ . '/js/multitrack.js') ?>" defer></script>
</head>
<body class="multitrack-page">
<div id="topbar">
    <a class="brand mt-brand-link" href="index.php">ZKUŠEBNA</a>
    <span class="brand">/</span>
    <span class="brand">DK</span>
    <span class="brand">/</span>
    <span class="mt-topbar-title">MULTITRACK</span>
    <nav class="topnav">
        <a href="index.php">zpět do zkušebny</a>
        <a href="php/login/logout.php">odhlásit</a>
    </nav>
</div>

<main id="mt-page">
    <!-- Samostatný blok připravený pro pozdější přesun do index.php. -->
    <section id="multitrack" class="mt-shell" aria-labelledby="mt-title">
        <header class="mt-heading">
            <div>
                <div class="mt-kicker">Virtuální zkušebna</div>
                <h1 id="mt-title">MULTITRACK</h1>
                <p>Společný, přesně synchronizovaný poslech všech stop.</p>
            </div>
            <?php if ($can_upload_multitrack): ?>
                <button type="button" class="btn-vz mt-new-button" data-toggle="modal" data-target="#modal_multitrack_upload">
                    <i class="ti ti-upload" aria-hidden="true"></i>
                    Vložit nový multitrack
                </button>
            <?php endif; ?>
        </header>

        <div class="mt-picker-card">
            <label for="mt-selector">Vybrat multitrack</label>
            <div class="mt-picker-row">
                <select id="mt-selector" class="form-control" disabled>
                    <option value="">Načítám seznam…</option>
                </select>
                <span class="mt-picker-state" data-mt-load-state aria-live="polite" aria-busy="true">Načítám…</span>
            </div>
        </div>

        <div id="mt-notice" class="mt-notice" role="status" aria-live="polite" hidden></div>

        <section id="mt-loading-panel" class="mt-loading-panel" aria-labelledby="mt-load-summary" hidden>
            <div class="mt-panel-heading">
                <h2>Stav načítání</h2>
                <strong id="mt-load-summary">Připraveno 0 / 0 stop</strong>
            </div>
            <div id="mt-track-statuses" class="mt-track-statuses"></div>
        </section>

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
            <span>Mixer se vytvoří podle stop uvedených v jeho JSON souboru.</span>
        </div>

        <section id="mt-mixer" class="mt-mixer" aria-label="Mixážní pult" hidden>
            <div class="mt-mixer-scroll">
                <div id="mt-tracks" class="mt-tracks"></div>
                <aside class="mt-master" aria-label="Master kanál">
                    <div class="mt-channel-name">MASTER</div>
                    <div class="mt-master-spacer" aria-hidden="true"></div>
                    <label class="mt-fader-wrap" for="mt-master-volume">
                        <span class="sr-only">Hlasitost masteru</span>
                        <input id="mt-master-volume" class="mt-fader" type="range" min="0" max="100" step="1" value="100">
                    </label>
                    <output id="mt-master-value" class="mt-volume-value" for="mt-master-volume">100 %</output>
                </aside>
            </div>
        </section>
    </section>
</main>

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

<script>
window.MULTITRACK_CONFIG = <?= json_encode([
    'listUrl' => 'php/ajax/multitracky.php',
    'detailUrl' => 'php/ajax/multitracky.php?id={id}',
    'uploadUrl' => 'php/actions/upload_multitrack.php',
    'csrfToken' => $_SESSION['multitrack_csrf'],
    'canUpload' => $can_upload_multitrack,
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
</script>
</body>
</html>
