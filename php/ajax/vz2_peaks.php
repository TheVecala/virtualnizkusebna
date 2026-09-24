<?php
declare(strict_types=1);
require_once __DIR__.'/../inc/session.php';
app_session_start();
require_once __DIR__.'/../../config.php';
require_once __DIR__.'/../inc/vz2_storage.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');

function vz2_peaks_values($values): bool {
    if(!is_array($values) || count($values)<1 || count($values)>4096)return false;
    $index=0;
    foreach($values as $key=>$value){
        if($key!==$index++ || (!is_int($value) && !is_float($value)) || !is_finite((float)$value) || $value<0 || $value>1)return false;
    }
    return true;
}
function vz2_peaks_read(string $path,array $file): ?array {
    if(!is_file($path) || is_link($path) || filesize($path)>131072)return null;
    try{$data=json_decode((string)file_get_contents($path),true,8,JSON_THROW_ON_ERROR);}
    catch(JsonException $e){return null;}
    if(!is_array($data) || ($data['version']??null)!==1 || ($data['file_id']??null)!==(int)$file['id']
        || ($data['sha256']??null)!==$file['sha256'] || ($data['duration_ms']??null)!==(int)$file['duration_ms']
        || !vz2_peaks_values($data['peaks']??null))return null;
    return $data;
}
try{
    vz2_ready();vz2_login();
    $method=$_SERVER['REQUEST_METHOD']??'GET';
    if(!in_array($method,['GET','POST'],true)){header('Allow: GET, POST');throw new Vz2Error('Nepodporovaná metoda.',405);}
    if($method==='POST'){
        vz2_ready(true);
        if(empty($_SESSION['user_id']) || ($_SESSION['role']??'')==='host')throw new Vz2Error('Uložení průběhu vyžaduje osobní účet.',403);
        try{auth_check_csrf(['csrf'=>$_SERVER['HTTP_X_CSRF_TOKEN']??null]);}
        catch(InvalidArgumentException $e){throw new Vz2Error('Neplatný bezpečnostní token.',403);}
        if((int)($_SERVER['CONTENT_LENGTH']??0)>131072)throw new Vz2Error('Průběh je příliš velký.',413);
        $raw=file_get_contents('php://input',false,null,0,131073);
        if($raw===false || strlen($raw)>131072)throw new Vz2Error('Průběh je příliš velký.',413);
        $input=json_decode($raw,true,8,JSON_THROW_ON_ERROR);
        if(!is_array($input) || !vz2_peaks_values($input['peaks']??null))throw new Vz2Error('Neplatná data průběhu.',422);
        $id=vz2_id($input['file_id']??null);$hash=$input['sha256']??null;
    }else{$id=vz2_id($_GET['id']??null);$hash=$_GET['hash']??null;}
    if(!is_string($hash) || !preg_match('/\A[a-f0-9]{64}\z/',$hash))throw new Vz2Error('Neplatná verze audia.',400);
    $db=vz2_db();
    $file=vz2_one($db,"SELECT f.id,f.sha256,f.duration_ms,f.state,f.relative_path,f.recording_id,r.kind,r.lifecycle recording_state,c.lifecycle collection_state FROM vz2_audio_files f JOIN vz2_recordings r ON r.id=f.recording_id JOIN vz2_collections c ON c.id=r.collection_id WHERE f.id=?",[$id]);
    if($file['sha256']!==$hash)throw new Vz2Error('Verze audia se změnila.',409);
    if($file['kind']!=='single' || $file['state']!=='available' || $file['recording_state']!=='active' || $file['collection_state']!=='active' || (int)$file['duration_ms']<=0)throw new Vz2Error('Audio není dostupné.',410);
    if(!is_file(vz2_path($file['relative_path'])))throw new Vz2Error('Audio neočekávaně chybí.',404);
    $relative='.cache/peaks/'.$id.'-'.$hash.'-v1.json';
    if($method==='GET'){
        $cached=vz2_peaks_read(vz2_path($relative),$file);
        if($cached===null)throw new Vz2Error('Průběh zatím není uložený.',404);
        echo json_encode(['ok'=>true,'peaks'=>$cached['peaks'],'duration_ms'=>$cached['duration_ms']],JSON_THROW_ON_ERROR);exit;
    }
    $db->begin_transaction();
    try{
        $recording=vz2_one($db,'SELECT id,lifecycle FROM vz2_recordings WHERE id=? FOR UPDATE',[(int)$file['recording_id']]);
        $latest=vz2_one($db,'SELECT state,sha256,duration_ms FROM vz2_audio_files WHERE id=?',[$id]);
        if($recording['lifecycle']!=='active' || $latest['state']!=='available' || $latest['sha256']!==$hash || (int)$latest['duration_ms']!==(int)$file['duration_ms'])throw new Vz2Error('Audio se mezitím změnilo.',409);
        $path=vz2_path($relative,true);
        $lockPath=vz2_path('.locks/peaks-'.$id.'-'.$hash.'.lock',true);
        $lock=fopen($lockPath,'c');
        if(!$lock || !flock($lock,LOCK_EX)){if($lock)fclose($lock);throw new Vz2Error('Průběh nelze uložit.',503);}
        try{
            if(vz2_peaks_read($path,$file)===null){
                $payload=json_encode(['version'=>1,'file_id'=>$id,'sha256'=>$hash,'duration_ms'=>(int)$file['duration_ms'],'peaks'=>$input['peaks']],JSON_THROW_ON_ERROR);
                $temp=vz2_path('.cache/peaks/.peak-'.$id.'-'.bin2hex(random_bytes(8)).'.tmp',true);
                $output=@fopen($temp,'xb');
                if(!$output)throw new Vz2Error('Průběh nelze uložit.',503);
                try{
                    $written=0;$length=strlen($payload);
                    while($written<$length){$bytes=fwrite($output,substr($payload,$written));if($bytes===false || $bytes===0)throw new Vz2Error('Průběh nelze uložit.',503);$written+=$bytes;}
                    if(!fflush($output))throw new Vz2Error('Průběh nelze uložit.',503);
                    fclose($output);$output=null;
                    if(is_file($path) && !unlink($path))throw new Vz2Error('Poškozenou cache nelze nahradit.',503);
                    if(!rename($temp,$path))throw new Vz2Error('Průběh nelze uložit.',503);
                }finally{if(is_resource($output))fclose($output);if(is_file($temp))unlink($temp);}
            }
        }finally{flock($lock,LOCK_UN);fclose($lock);}
        $db->commit();
    }catch(Throwable $e){$db->rollback();throw $e;}
    http_response_code(201);echo '{"ok":true}';
}catch(Vz2Error $e){http_response_code($e->status);echo json_encode(['ok'=>false,'error'=>$e->getMessage()],JSON_UNESCAPED_UNICODE);}
catch(JsonException $e){http_response_code(400);echo '{"ok":false,"error":"Neplatný JSON."}';}
catch(Throwable $e){error_log('VZ2 peaks failed: '.get_class($e));http_response_code(500);echo '{"ok":false,"error":"Průběh nelze zpracovat."}';}
