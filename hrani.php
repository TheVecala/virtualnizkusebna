<?php
declare(strict_types=1);
require_once __DIR__.'/php/inc/session.php';
app_session_start();
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/php/hrani_data.php';
header('Cache-Control: no-store');

$isData = isset($_GET['data']);
if ($isData) header('Content-Type: application/json; charset=utf-8');
try {
    if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET', 'HEAD'], true)) {
        header('Allow: GET, HEAD');
        throw new Vz2Error('Hráčské zobrazení je pouze pro čtení.', 405);
    }
    vz2_ready();
    vz2_login();
    session_write_close();
    $db = vz2_db();
    $db->begin_transaction(MYSQLI_TRANS_START_READ_ONLY | MYSQLI_TRANS_START_WITH_CONSISTENT_SNAPSHOT);
    try {
        if (!$isData) {
            $result = ['songs'=>hrani_catalog($db), 'rehearsals'=>hrani_rehearsals($db)];
        } elseif (isset($_GET['rehearsal'])) {
            $result = hrani_rehearsal_detail($db, vz2_id($_GET['rehearsal']));
        } else {
            $result = hrani_detail($db, vz2_id($_GET['song'] ?? null));
        }
        $db->commit();
    } catch (Throwable $error) {
        $db->rollback();
        throw $error;
    }
    if ($isData) {
        echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        exit;
    }
    $songs = $result['songs'];
    $rehearsals = $result['rehearsals'];
} catch (Throwable $error) {
    $status = $error instanceof Vz2Error ? $error->status : 500;
    if (!$isData && $status === 401) {
        header('Location: index.php?v=2', true, 302);
        exit;
    }
    http_response_code($status);
    $message = $error instanceof Vz2Error ? $error->getMessage() : 'Podklady se nepodařilo načíst. Zkuste obnovit stránku.';
    if ($isData) echo json_encode(['error'=>$message], JSON_UNESCAPED_UNICODE);
    else echo '<p>'.auth_h($message).'</p><a href="index.php?v=2">Zpět do zkušebny</a>';
    exit;
}
?>
<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#10171d">
  <title>Hraní · Virtuální zkušebna</title>
  <link rel="stylesheet" href="css/hrani.css">
  <script src="js/hrani.js" defer></script>
</head>
<body data-layout="overview" data-distance="normal">
  <a class="skip-link" href="#main">Přejít na obsah</a>
  <header class="app-header">
    <a class="brand" href="hrani.php" aria-label="Hraní – seznam skladeb"><span class="brand-mark" aria-hidden="true">≋</span> Zkušebna <span class="brand-mode">/ hraní</span></a>
    <div class="header-actions">
      <div class="segmented distance-control" role="group" aria-label="Vzdálenost obrazovky">
        <button type="button" data-distance="normal" aria-pressed="true">Běžné</button>
        <button type="button" data-distance="wall" aria-pressed="false">Na zeď</button>
      </div>
      <button type="button" id="fullscreen" class="quiet-button" hidden>Celá obrazovka</button>
    </div>
    <a class="quiet-button edit-link" href="index.php">Editovat</a>
  </header>
  <main id="main" tabindex="-1">
    <nav id="playing-lists" class="segmented playing-lists" aria-label="Seznamy v režimu Hraní">
      <a href="#" id="show-songs" aria-current="page">Skladby</a>
      <a href="#rehearsals" id="show-rehearsals">Zkoušky</a>
    </nav>
    <section id="list-view" aria-labelledby="list-title">
      <div class="list-heading"><h1 id="list-title">Skladby</h1><span id="song-count" class="count" aria-live="polite"></span></div>
      <div class="list-columns" aria-hidden="true"><span>Skladba</span><span>Info</span><span>Nahrávky</span></div>
      <div id="song-list" class="song-list"></div>
      <p id="list-empty" class="empty-state" hidden></p>
    </section>
    <section id="rehearsal-view" class="rehearsal-list" aria-labelledby="rehearsal-title" hidden>
      <div class="list-heading"><h1 id="rehearsal-title">Zkoušky</h1><span id="rehearsal-count" class="count"></span></div>
      <div class="list-columns" aria-hidden="true"><span>Zkouška</span><span>Nahrávky</span></div>
      <div id="rehearsal-list" class="song-list"></div>
      <p id="rehearsal-empty" class="empty-state" hidden>Zatím tu nejsou žádné zkoušky.</p>
    </section>
    <section id="rehearsal-player" class="rehearsal-player" aria-labelledby="rehearsal-player-title" hidden>
      <a href="#rehearsals" class="quiet-button">Seznam zkoušek</a>
      <h1 id="rehearsal-player-title" tabindex="-1"></h1>
      <p id="rehearsal-player-status" class="empty-state" role="status" hidden></p>
      <button type="button" id="retry-rehearsal" hidden>Zkusit znovu</button>
      <div id="rehearsal-transport" class="panel rehearsal-transport" hidden>
        <label for="rehearsal-recording">Nahrávka</label>
        <select id="rehearsal-recording"></select>
        <audio id="rehearsal-audio" preload="metadata"></audio>
        <div class="rehearsal-timeline">
          <input type="range" id="rehearsal-seek" aria-label="Pozice v nahrávce" min="0" max="0" value="0" step="0.1" disabled>
          <div class="rehearsal-times"><span id="rehearsal-elapsed">0:00</span><span id="rehearsal-duration">0:00</span></div>
        </div>
        <div class="rehearsal-controls">
          <button type="button" id="rehearsal-backward" aria-label="Zpět o 10 sekund" disabled>−10 s</button>
          <button type="button" id="rehearsal-play">Přehrát</button>
          <button type="button" id="rehearsal-forward" aria-label="Vpřed o 10 sekund" disabled>+10 s</button>
        </div>
        <p id="rehearsal-audio-status" role="status" hidden></p>
      </div>
    </section>
    <section id="detail-view" aria-labelledby="song-title" hidden>
      <div class="song-heading">
        <a href="#" id="back-to-list" class="quiet-button">Seznam skladeb</a>
        <span id="song-position" class="eyebrow"></span>
        <h1 id="song-title" tabindex="-1"></h1>
        <div class="segmented layout-control" role="group" aria-label="Zobrazení skladby">
          <button type="button" data-layout="compact" aria-pressed="false">Kompaktní</button>
          <button type="button" data-layout="overview" aria-pressed="true">Přehled</button>
          <button type="button" data-layout="large" aria-pressed="false">Velká tlačítka</button>
        </div>
      </div>
      <p id="detail-status" class="empty-state" role="status" hidden></p>
      <button id="retry" type="button" class="quiet-button" hidden>Zkusit znovu</button>
      <div id="song-content" class="song-content" hidden>
        <div class="score-column">
          <section class="panel" id="text-panel"><h2>Text a akordy</h2><pre id="song-text" class="score"></pre></section>
          <section class="panel" id="tab-panel"><h2>Tabulatura</h2><pre id="song-tab" class="score tab-score" tabindex="0" aria-label="Tabulatura, delší řádky lze posouvat vodorovně"></pre></section>
          <p id="no-score" class="empty-state" hidden>Text ani tabulatura zatím nejsou vložené.</p>
        </div>
        <div class="reference-column">
          <section class="panel"><h2>Nahrávky <span id="recording-count" class="count"></span></h2><div id="recordings"></div></section>
          <section class="panel" id="documents-panel"><h2>Další podklady</h2><div id="documents"></div></section>
          <section class="panel"><h2>Poznámky ke skladbě</h2><p class="section-caption">Posledních až 20 poznámek</p><div id="song-notes"></div></section>
        </div>
      </div>
      <nav class="song-navigation" aria-label="Přechod mezi skladbami"><button type="button" id="previous-song">Předchozí skladba<span></span></button><button type="button" id="next-song">Další skladba<span></span></button></nav>
    </section>
    <noscript><p class="empty-state">Pro hráčské zobrazení zapněte JavaScript. <a href="index.php">Otevřít běžnou zkušebnu</a></p></noscript>
  </main>
  <script type="application/json" id="song-data"><?php echo json_encode($songs, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_INVALID_UTF8_SUBSTITUTE); ?></script>
  <script type="application/json" id="rehearsal-data"><?php echo json_encode($rehearsals, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_INVALID_UTF8_SUBSTITUTE); ?></script>
</body>
</html>
