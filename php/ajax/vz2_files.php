<?php
declare(strict_types=1);
session_start();
require_once __DIR__.'/../../config.php';
require_once __DIR__.'/../inc/vz2_storage.php';
try{
    vz2_ready();vz2_login();
    if(!in_array($_SERVER['REQUEST_METHOD']??'GET',['GET','HEAD'],true)){header('Allow: GET, HEAD');throw new Vz2Error('Nepodporovaná metoda.',405);}
    $type=$_GET['type']??'';$id=vz2_id($_GET['id']??null);
    if($type==='audio')$f=vz2_one(vz2_db(),"SELECT f.*,r.lifecycle recording_state,c.lifecycle collection_state FROM vz2_audio_files f JOIN vz2_recordings r ON r.id=f.recording_id JOIN vz2_collections c ON c.id=r.collection_id WHERE f.id=?",[$id]);
    elseif($type==='attachment')$f=vz2_one(vz2_db(),"SELECT f.*,c.lifecycle collection_state FROM vz2_attachments f JOIN vz2_collections c ON c.id=f.collection_id WHERE f.id=?",[$id]);
    else throw new Vz2Error('Neplatný typ souboru.');
    if($f['state']!=='available' || ($f['recording_state']??'active')!=='active' || $f['collection_state']!=='active')throw new Vz2Error('Soubor již není dostupný.',410);
    if(isset($_GET['hash']) && $_GET['hash']!==$f['sha256'])throw new Vz2Error('Verze souboru se změnila.',409);
    $path=vz2_path($f['relative_path']);if(!is_file($path))throw new Vz2Error('Audio neočekávaně chybí.',404);
    $size=filesize($path);$start=0;$end=$size-1;$range=$_SERVER['HTTP_RANGE']??'';
    header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');header('Accept-Ranges: bytes');
    if($range!==''){
        if(!preg_match('/\Abytes=(\d*)-(\d*)\z/',$range,$m) || ($m[1]==='' && $m[2]==='')){header('Content-Range: bytes */'.$size);throw new Vz2Error('Neplatný rozsah.',416);}
        if($m[1]==='')$start=max(0,$size-(int)$m[2]);
        else{$start=(int)$m[1];if($m[2]!=='')$end=min($end,(int)$m[2]);}
        if($start>$end || $start>=$size){header('Content-Range: bytes */'.$size);throw new Vz2Error('Neplatný rozsah.',416);}
        http_response_code(206);header('Content-Range: bytes '.$start.'-'.$end.'/'.$size);
    }
    $handle=fopen($path,'rb');if(!$handle)throw new Vz2Error('Soubor nelze otevřít.',503);
    header('Content-Type: '.$f['mime_type']);header('Content-Length: '.($end-$start+1));
    if($type==='attachment' || isset($_GET['download']))header("Content-Disposition: attachment; filename=\"soubor-$id\"; filename*=UTF-8''".rawurlencode($f['original_name']));
    session_write_close();
    if(($_SERVER['REQUEST_METHOD']??'GET')!=='HEAD'){
        fseek($handle,$start);$remaining=$end-$start+1;
        while($remaining>0 && !feof($handle) && !connection_aborted()){$chunk=fread($handle,min(65536,$remaining));if($chunk===false || $chunk==='')break;echo $chunk;$remaining-=strlen($chunk);}
    }
    fclose($handle);
}catch(Vz2Error $e){http_response_code($e->status);header('Content-Type: text/plain; charset=utf-8');echo $e->getMessage();}
catch(Throwable $e){http_response_code(500);echo 'Soubor nelze načíst.';}
