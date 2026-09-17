<?php
declare(strict_types=1);
session_start();
require_once __DIR__.'/../../config.php';
require_once __DIR__.'/../inc/vz2_catalog.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
try {
    vz2_ready();vz2_login();
    $method=$_SERVER['REQUEST_METHOD']??'GET';
    if($method==='GET'){
        $action=$_GET['action']??'catalog';
        if($action==='catalog')$result=vz2_catalog();
        elseif($action==='mixer')$result=vz2_mixer(isset($_GET['id'])?vz2_id($_GET['id']):null);
        elseif($action==='log'){
            if(!auth_is_admin())throw new Vz2Error('Deník je dostupný pouze adminovi.',403);
            $before=isset($_GET['before']) && is_string($_GET['before']) && preg_match('/\A[1-9][0-9]{0,19}\z/',$_GET['before'])?$_GET['before']:null;
            $result=['entries'=>vz2_rows(vz2_db(),'SELECT id,actor_name,occurred_at,environment,action,target_type,target_id,target_title,detail FROM vz2_activity_log'.($before?' WHERE id<?':'').' ORDER BY id DESC LIMIT 50',$before?[$before]:[])];
        }else throw new Vz2Error('Neznámé čtení.');
    }elseif($method==='POST'){
        if(str_contains($_SERVER['CONTENT_TYPE']??'','application/json'))$in=json_decode(file_get_contents('php://input'),true,32,JSON_THROW_ON_ERROR);
        else $in=$_POST;
        if(!is_array($in))throw new Vz2Error('Neplatný požadavek.');
        try{auth_check_csrf(['csrf'=>$_SERVER['HTTP_X_CSRF_TOKEN']??($in['csrf']??null)]);}catch(InvalidArgumentException $e){throw new Vz2Error('Neplatný bezpečnostní token.',403);}
        $action=$in['action']??'';
        if($action==='logout'){
            auth_forget_identity();session_regenerate_id(true);
            echo '{"ok":true}';exit;
        }
        vz2_ready(true);
        if(empty($_SESSION['user_id']))throw new Vz2Error('Zápis vyžaduje osobní účet.',403);
        if($action==='upload'){$result=vz2_upload($in,$_FILES);http_response_code(201);}
        elseif(in_array($action,['remove_audio','remove_attachment','delete_recording','delete_collection'],true))$result=vz2_remove($in);
        elseif($action==='retry')$result=vz2_run_operation(vz2_id($in['operation_id']??null));
        else $result=vz2_mutate($in);
    }else{header('Allow: GET, POST');throw new Vz2Error('Nepodporovaná metoda.',405);}
    echo json_encode(['ok'=>true]+$result,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
}catch(Vz2Error $e){http_response_code($e->status);echo json_encode(['ok'=>false,'error'=>$e->getMessage()],JSON_UNESCAPED_UNICODE);}
catch(JsonException $e){http_response_code(400);echo '{"ok":false,"error":"Neplatný JSON."}';}
catch(Throwable $e){error_log('VZ2 request failed: '.get_class($e));http_response_code(500);echo '{"ok":false,"error":"Operace se nezdařila. Ověřte konfiguraci a migraci VZ2."}';}
