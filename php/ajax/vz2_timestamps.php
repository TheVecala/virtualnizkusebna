<?php
declare(strict_types=1);
require_once __DIR__ . '/../inc/session.php';
app_session_start();
require_once __DIR__.'/../../config.php';
require_once __DIR__.'/../inc/vz2_timestamps.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
try {
    vz2_ready(); vz2_login();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'GET') {
        $action = $_GET['action'] ?? 'list';
        if (!in_array($action, ['list','export','song_intervals'], true)) throw new Vz2Error('Neznámé čtení.');
        $result = vz2_timestamp_read(vz2_id($_GET['recording_id'] ?? null));
        if ($action === 'export' || $action === 'song_intervals') {
            header('Content-Type: text/plain; charset=utf-8');
            header('Content-Disposition: attachment; filename="nahravka-'.$result['recording_id'].($action==='song_intervals'?'-useky':'-zapisy').'.txt"');
            echo $action==='song_intervals'?vz2_song_intervals_export($result):vz2_timestamp_export($result); exit;
        }
    } elseif ($method === 'POST') {
        $in = json_decode(file_get_contents('php://input'), true, 32, JSON_THROW_ON_ERROR);
        if (!is_array($in)) throw new Vz2Error('Neplatný požadavek.');
        try { auth_check_csrf(['csrf'=>$_SERVER['HTTP_X_CSRF_TOKEN'] ?? null]); }
        catch (InvalidArgumentException $e) { throw new Vz2Error('Neplatný bezpečnostní token.', 403); }
        $result = vz2_timestamp_write($in);
        if (($in['action'] ?? '') === 'create') http_response_code(201);
    } else { header('Allow: GET, POST'); throw new Vz2Error('Nepodporovaná metoda.', 405); }
    echo json_encode(['ok'=>true]+$result, JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
} catch (Vz2Error $e) { http_response_code($e->status); echo json_encode(['ok'=>false,'error'=>$e->getMessage()], JSON_UNESCAPED_UNICODE); }
catch (JsonException $e) { http_response_code(400); echo '{"ok":false,"error":"Neplatný JSON."}'; }
catch (Throwable $e) { error_log('VZ2 timestamps failed: '.get_class($e)); http_response_code(500); echo '{"ok":false,"error":"Zápisy se nepodařilo zpracovat."}'; }
