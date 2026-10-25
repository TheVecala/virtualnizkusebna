<?php
declare(strict_types=1);
require_once __DIR__.'/../inc/session.php';
app_session_start();
require_once __DIR__.'/../../config.php';
require_once __DIR__.'/../inc/vz2_overview.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
try {
    vz2_ready(); vz2_login();
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        header('Allow: GET');
        throw new Vz2Error('Nepodporovaná metoda.',405);
    }
    $db = vz2_db();
    $db->begin_transaction(MYSQLI_TRANS_START_READ_ONLY | MYSQLI_TRANS_START_WITH_CONSISTENT_SNAPSHOT);
    try { $result = vz2_overview_data($db); $db->commit(); }
    catch (Throwable $e) { $db->rollback(); throw $e; }
    echo json_encode(['ok'=>true]+$result,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
} catch (Vz2Error $e) {
    http_response_code($e->status);
    echo json_encode(['ok'=>false,'error'=>$e->getMessage()],JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('VZ2 overview failed: '.get_class($e));
    http_response_code(500);
    echo '{"ok":false,"error":"Přehled se nepodařilo vytvořit."}';
}
