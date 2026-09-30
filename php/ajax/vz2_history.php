<?php
declare(strict_types=1);
require_once __DIR__.'/../inc/session.php'; app_session_start();
require_once __DIR__.'/../../config.php'; require_once __DIR__.'/../inc/vz2_history.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
try{vz2_ready();vz2_login();$method=$_SERVER['REQUEST_METHOD']??'GET';
    if($method==='GET')$result=vz2_history_read();
    elseif($method==='POST'){try{auth_check_csrf(['csrf'=>$_SERVER['HTTP_X_CSRF_TOKEN']??null]);}catch(InvalidArgumentException $e){throw new Vz2Error('Neplatný bezpečnostní token.',403);}$in=json_decode(file_get_contents('php://input'),true,32,JSON_THROW_ON_ERROR);$result=vz2_history_write($in);}
    else throw new Vz2Error('Nepodporovaná metoda.',405);
    echo json_encode(['ok'=>true]+$result,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
}catch(Vz2Error $e){http_response_code($e->status);echo json_encode(['ok'=>false,'error'=>$e->getMessage()],JSON_UNESCAPED_UNICODE);}
catch(Throwable $e){error_log('VZ2 history failed: '.get_class($e).' '.$e->getMessage());http_response_code(500);echo '{"ok":false,"error":"Historii se nepodařilo zpracovat."}';}
