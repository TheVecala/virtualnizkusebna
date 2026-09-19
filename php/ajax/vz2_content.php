<?php
declare(strict_types=1);
session_start();
require_once __DIR__.'/../../config.php';
require_once __DIR__.'/../inc/vz2_content.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
try {
    vz2_ready(); vz2_login();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'GET') {
        $action = $_GET['action'] ?? '';
        if (!in_array($action,['document','history','discussion'],true)) throw new Vz2Error('Neznámé čtení.');
        $db = vz2_db(); $db->begin_transaction(MYSQLI_TRANS_START_READ_ONLY | MYSQLI_TRANS_START_WITH_CONSISTENT_SNAPSHOT);
        try { $result = $action === 'discussion' ? vz2_discussion_read($db,$_GET) : vz2_document_read($db,$_GET); $db->commit(); }
        catch (Throwable $e) { $db->rollback(); throw $e; }
    } elseif ($method === 'POST') {
        $raw = file_get_contents('php://input',false,null,0,8*1048576+1);
        if (strlen($raw)>8*1048576) throw new Vz2Error('Požadavek je příliš velký.',413);
        $in = json_decode($raw,true,32,JSON_THROW_ON_ERROR);
        if (!is_array($in)) throw new Vz2Error('Neplatný požadavek.');
        try { auth_check_csrf(['csrf'=>$_SERVER['HTTP_X_CSRF_TOKEN'] ?? null]); }
        catch (InvalidArgumentException $e) { throw new Vz2Error('Neplatný bezpečnostní token.',403); }
        $action = $in['action'] ?? '';
        if (in_array($action,['document_save','document_restore'],true)) $result = vz2_document_write($in);
        elseif (in_array($action,['post_create','post_update','post_delete'],true)) $result = vz2_discussion_write($in);
        else throw new Vz2Error('Neznámá operace.');
    } else { header('Allow: GET, POST'); throw new Vz2Error('Nepodporovaná metoda.',405); }
    echo json_encode(['ok'=>true]+$result,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
} catch (Vz2Error $e) { http_response_code($e->status); echo json_encode(['ok'=>false,'error'=>$e->getMessage()],JSON_UNESCAPED_UNICODE); }
catch (JsonException $e) { http_response_code(400); echo '{"ok":false,"error":"Neplatný JSON."}'; }
catch (Throwable $e) { error_log('VZ2 content failed: '.get_class($e)); http_response_code(500); echo '{"ok":false,"error":"Obsah se nepodařilo zpracovat. Ověřte také migraci 003."}'; }
