<?php
declare(strict_types=1);

// Keep the old file live until the verified replacement has its own final path.
function vz2_replacement_target(mysqli $db, array $in): array {
    $r=vz2_recording($db,vz2_id($in['id']??null));vz2_active($r);
    vz2_permission('upload');vz2_permission('delete_file',(int)$r['created_by']);
    vz2_revision($r,$in['revision']??null);vz2_idle($db,'recording',(int)$r['id']);
    $f=vz2_one($db,'SELECT * FROM vz2_audio_files WHERE id=? AND recording_id=? FOR UPDATE',[vz2_id($in['file_id']??null),$r['id']]);
    if(!in_array($f['state'],['available','deleted'],true))throw new Vz2Error('Soubor má rozpracovanou operaci.',409);
    return [$r,$f];
}

function vz2_prepare_audio_replacement(array $in,array $files): array {
    [$r,$old]=vz2_write(fn(mysqli $db)=>vz2_replacement_target($db,$in));
    $file=$files['file']??null;
    if(!$file || $file['error']!==UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name']))throw new Vz2Error('Soubor nebyl kompletně nahrán. Zkontrolujte limit uploadu.',400);
    $name=vz2_text(basename(str_replace('\\','/',$file['name'])),255);
    $meta=vz2_inspect_upload($file['tmp_name'],$name,false);
    if($r['kind']==='multitrack' && $meta['format']!==$old['format'])throw new Vz2Error('Náhradní stopa musí mít stejný formát jako původní sada.',422);
    $key=bin2hex(random_bytes(16));$stage='.staging/'.$key.'/audio.'.$meta['format'];
    $path=vz2_path($stage,true);
    if(!move_uploaded_file($file['tmp_name'],$path))throw new Vz2Error('Náhradu nelze uložit do stagingu.',500);
    $manifest=['actor_id'=>vz2_actor(),'created_at'=>time(),'id'=>(int)$r['id'],'file_id'=>(int)$old['id'],'revision'=>(int)$r['revision'],
        'staging_path'=>$stage,'original_name'=>$name,'meta'=>$meta];
    try {
        $h=fopen(vz2_path('.staging/'.$key.'/replacement.json'),'x');
        if(!$h)throw new Vz2Error('Nelze připravit náhradu.',500);
        try { $body=json_encode($manifest,JSON_THROW_ON_ERROR);if(fwrite($h,$body)!==strlen($body))throw new Vz2Error('Nelze připravit náhradu.',500); }
        finally { fclose($h); }
    } catch(Throwable $e) { @unlink($path);throw $e; }
    $others=vz2_rows(vz2_db(),'SELECT duration_ms FROM vz2_audio_files WHERE recording_id=? AND id<>?',[$r['id'],$old['id']]);
    $duration=max(array_merge([$meta['duration_ms']],array_map(fn($f)=>(int)$f['duration_ms'],$others)));
    require_once __DIR__.'/vz2_timestamps.php';
    $entries=vz2_timestamp_entries(vz2_db(),$r);
    $annotations=vz2_timestamp_annotations($r,$entries);
    return ['token'=>$key,'old_duration_ms'=>$old['duration_ms']===null?null:(int)$old['duration_ms'],'new_duration_ms'=>$meta['duration_ms'],
        'recording_duration_ms'=>$duration,'outside_count'=>count(array_filter($entries,fn($e)=>$e['time_ms']>=$duration)),
        'overlap_count'=>count(array_filter($annotations,fn($a)=>$a['start_ms']<$duration && $a['end_ms']!==null && $a['end_ms']>$duration))];
}

function vz2_replace_audio(array $in): array {
    vz2_ready(true);vz2_login();
    $key=vz2_key($in['token']??null);
    if($op=vz2_existing_operation($key)){
        if($op['action']!=='replace_audio')throw new Vz2Error('Klíč patří jiné operaci.',409);
        return vz2_run_operation((int)$op['id']);
    }
    $path=vz2_path('.staging/'.$key.'/replacement.json');
    if(!is_file($path))throw new Vz2Error('Připravená náhrada neexistuje. Vyberte soubor znovu.',404);
    $prepared=json_decode(file_get_contents($path),true,32,JSON_THROW_ON_ERROR);
    if((int)$prepared['actor_id']!==vz2_actor())throw new Vz2Error('Cizí upload.',403);
    if(time()-(int)$prepared['created_at']>86400)throw new Vz2Error('Příprava náhrady vypršela. Vyberte soubor znovu.',409);
    $op=vz2_write(function(mysqli $db)use($key,$prepared,$path):int{
        if(!is_file($path))throw new Vz2Error('Příprava náhrady byla zrušena.',409);
        if(vz2_existing_operation($key))throw new Vz2Error('Náhrada už probíhá. Obnovte stav operace.',409);
        [$r,$old]=vz2_replacement_target($db,$prepared);
        $meta=$prepared['meta'];
        $payload=$prepared+['old_path'=>$old['relative_path'],'old_sha256'=>$old['sha256'],
            'relative_path'=>$r['storage_dir'].'/a'.$old['id'].'-'.$key.'.'.$meta['format']];
        $op=vz2_operation($db,$key,'replace_audio','recording',(int)$r['id'],$r['title']);
        vz2_query($db,'UPDATE vz2_file_operations SET payload_json=? WHERE id=?',[json_encode($payload,JSON_THROW_ON_ERROR),$op]);
        return $op;
    });
    return vz2_run_operation($op);
}

function vz2_discard_audio_replacement(array $in): array {
    return vz2_write(function(mysqli $db)use($in):array{
        $key=vz2_key($in['token']??null);
        if(vz2_existing_operation($key))return ['discarded'=>false];
        $path=vz2_path('.staging/'.$key.'/replacement.json');
        if(!is_file($path))return ['discarded'=>true];
        $p=json_decode(file_get_contents($path),true,32,JSON_THROW_ON_ERROR);
        if((int)$p['actor_id']!==vz2_actor())throw new Vz2Error('Cizí upload.',403);
        $source=vz2_path($p['staging_path']);
        if(is_file($source) && !unlink($source))throw new Vz2Error('Nelze uklidit připravený soubor.',500);
        if(!unlink($path))throw new Vz2Error('Nelze zrušit přípravu náhrady.',500);
        return ['discarded'=>true];
    });
}

// Called under the durable operation lock; each phase is safe to retry after a crash.
function vz2_run_audio_replacement(mysqli $db,array $op): array {
    $p=json_decode($op['payload_json'],true,32,JSON_THROW_ON_ERROR);$meta=$p['meta'];$id=(int)$op['id'];
    vz2_permission('upload');
    $r=vz2_one($db,'SELECT * FROM vz2_recordings WHERE id=?',[$op['target_id']]);
    vz2_permission('delete_file',(int)$r['created_by']);
    $destination=vz2_path($p['relative_path'],true);$source=vz2_path($p['staging_path']);
    try { vz2_copy_exclusive($source,$destination,$meta['sha256']); }
    catch(RuntimeException $e){throw new Vz2Error($e->getMessage(),in_array($e->getCode(),[409,500],true)?$e->getCode():500);}
    vz2_write(function(mysqli $db)use($p,$meta,$op,$id):void{
        $r=vz2_recording($db,(int)$op['target_id']);vz2_active($r);
        vz2_permission('upload');vz2_permission('delete_file',(int)$r['created_by']);
        $f=vz2_one($db,'SELECT * FROM vz2_audio_files WHERE id=? AND recording_id=? FOR UPDATE',[$p['file_id'],$r['id']]);
        if($f['relative_path']===$p['relative_path'])return; // The reference switch was committed already.
        if($f['relative_path']!==$p['old_path'] || $f['sha256']!==$p['old_sha256'])throw new Vz2Error('Původní soubor se změnil.',409);
        vz2_query($db,"UPDATE vz2_audio_files SET original_name=?,relative_path=?,format=?,mime_type=?,byte_size=?,sha256=?,duration_ms=?,state='available',deleted_by=NULL,deleted_at=NULL,revision=revision+1,updated_by=?,updated_at=UTC_TIMESTAMP() WHERE id=?",
            [$p['original_name'],$p['relative_path'],$meta['format'],$meta['mime_type'],$meta['byte_size'],$meta['sha256'],$meta['duration_ms'],$op['actor_id'],$f['id']]);
        vz2_query($db,'UPDATE vz2_recordings SET duration_ms=(SELECT MAX(duration_ms) FROM vz2_audio_files WHERE recording_id=?),revision=revision+1,timestamps_revision=timestamps_revision+1,updated_by=?,updated_at=UTC_TIMESTAMP() WHERE id=?',[$r['id'],$op['actor_id'],$r['id']]);
        vz2_query($db,'UPDATE vz2_collections SET recordings_revision=recordings_revision+1 WHERE id=?',[$r['collection_id']]);
        vz2_log($db,'audio.replaced','audio',(int)$f['id'],$f['title'],'Původně: '.$f['original_name'].' ('.$f['duration_ms'].' ms); nově: '.$p['original_name'].' ('.$meta['duration_ms'].' ms). Značky zachovány.',$id,(int)$op['actor_id']);
    });
    $old=vz2_path($p['old_path']);
    if(file_exists($old) && !is_file($old))throw new Vz2Error('Náhrada je uložená, ale původní cestu nelze uklidit.',409);
    if(is_file($old)){
        if(hash_file('sha256',$old)!==$p['old_sha256'])throw new Vz2Error('Náhrada je uložená, ale původní soubor má jiný obsah. Úklid vyžaduje kontrolu.',409);
        if(!unlink($old))throw new Vz2Error('Nelze odstranit původní audio.',500);
    }
    foreach([$source,vz2_path('.cache/peaks/'.$p['file_id'].'-'.$p['old_sha256'].'-v1.json')] as $path)
        if(is_file($path) && !unlink($path))throw new Vz2Error('Nelze dokončit úklid náhrady.',500);
    vz2_query($db,"UPDATE vz2_file_operations SET state='completed',error_code=NULL,completed_at=UTC_TIMESTAMP(),updated_at=UTC_TIMESTAMP() WHERE id=?",[$id]);
    return ['id'=>(int)$op['target_id'],'operation_id'=>$id,'completed'=>true];
}
