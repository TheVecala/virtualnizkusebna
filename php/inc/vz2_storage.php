<?php
declare(strict_types=1);
require_once __DIR__.'/vz2_core.php';
require_once __DIR__.'/vz2_media.php';
require_once __DIR__.'/vz2_file_io.php';

function vz2_within(string $path,string $root): bool {
    $path=str_replace('\\','/',rtrim($path,'/\\'));$root=str_replace('\\','/',rtrim($root,'/\\'));
    if(DIRECTORY_SEPARATOR==='\\'){$path=strtolower($path);$root=strtolower($root);}
    return $path===$root || str_starts_with($path,$root.'/');
}
function vz2_root(): string {
    if(!defined('VZ2_STORAGE_ROOT') || !is_string(VZ2_STORAGE_ROOT))throw new Vz2Error('Není nastavené úložiště VZ2.',503);
    $root=realpath(VZ2_STORAGE_ROOT); $project=realpath(dirname(__DIR__,2));
    if($root===false || !is_dir($root) || is_link(VZ2_STORAGE_ROOT) || vz2_within($root,$project)
        || !is_readable($root.'/.vz2-storage-id') || is_link($root.'/.vz2-storage-id')
        || trim(file_get_contents($root.'/.vz2-storage-id'))!==VZ2_DATASET_KEY) {
        throw new Vz2Error('Úložiště není dostupné nebo neodpovídá datové sadě. Operace zastavena.',503);
    }
    if(!defined('VZ2_PUBLIC_ROOT') || !is_string(VZ2_PUBLIC_ROOT) || ($public=realpath(VZ2_PUBLIC_ROOT))===false || !is_dir($public)) {
        throw new Vz2Error('Chybí ověřený společný veřejný kořen VZ2.',503);
    }
    // Being outside this installation is not the same as being outside the web root.
    $access=defined('VZ2_STORAGE_ACCESS')?VZ2_STORAGE_ACCESS:'';
    if($access==='private') {
        if(vz2_within($root,$public) || vz2_within($public,$root))throw new Vz2Error('Privátní úložiště zasahuje do veřejného kořene.',503);
    } elseif($access==='http-denied') {
        if(!vz2_within($root,$public) || $root===$public || !defined('VZ2_STORAGE_HTTP_VERIFIED') || VZ2_STORAGE_HTTP_VERIFIED!==true) {
            throw new Vz2Error('Úložiště ve veřejném kořeni vyžaduje ověřený zákaz přímého HTTP přístupu.',503);
        }
        $guard=$root.'/.htaccess';
        if(is_link($guard) || !is_file($guard) || !is_readable($guard) || filesize($guard)>8192)throw new Vz2Error('Chybí ochranný soubor úložiště.',503);
        $rules=array_values(array_filter(array_map('trim',file($guard)),static fn($line)=>$line!=='' && !str_starts_with($line,'#')));
        if(count($rules)!==1 || !preg_match('/\ARequire\s+all\s+denied\z/i',$rules[0]))throw new Vz2Error('Ochranné pravidlo úložiště se změnilo. Znovu ověřte konfiguraci.',503);
    } else throw new Vz2Error('Chybí platný režim ochrany úložiště VZ2.',503);
    return $root;
}
function vz2_path(string $relative,bool $createParents=false): string {
    if(strlen($relative)>512 || !preg_match('/\A[a-zA-Z0-9_.\/-]+\z/',$relative) || str_starts_with($relative,'/')
        || str_contains($relative,'..') || str_contains($relative,'//'))throw new Vz2Error('Neplatná interní cesta.',422);
    $root=vz2_root();$path=$root;$parts=explode('/',$relative);
    foreach($parts as $i=>$part){
        if($part==='' || $part==='.')throw new Vz2Error('Neplatná cesta.',422);
        $path.=DIRECTORY_SEPARATOR.$part;
        if(is_link($path))throw new Vz2Error('Úložiště nesmí obsahovat odkazy.',422);
        if(file_exists($path)){
            $real=realpath($path);
            if($real===false || !vz2_within($real,$root))throw new Vz2Error('Cesta opouští úložiště.',422);
            if($i<count($parts)-1 && !is_dir($path))throw new Vz2Error('Neplatný adresář.',422);
        } elseif($createParents && $i<count($parts)-1 && !mkdir($path,0700) && !is_dir($path))throw new Vz2Error('Adresář nelze vytvořit.',500);
    }
    return $path;
}
function vz2_key($value): string {
    if(!is_string($value) || !preg_match('/\A[a-f0-9]{32}\z/',$value))throw new Vz2Error('Chybí identifikátor operace.');
    return $value;
}
function vz2_operation(mysqli $db,string $key,string $action,string $type,int $id,string $title): int {
    vz2_query($db,'INSERT INTO vz2_file_operations (request_key,action,target_type,target_id,target_title,actor_id,environment,created_at,updated_at) VALUES (?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())',[$key,$action,$type,$id,$title,vz2_actor(),VZ2_ENVIRONMENT]);
    return (int)$db->insert_id;
}
function vz2_existing_operation(string $key): ?array {
    $rows=vz2_rows(vz2_db(),'SELECT * FROM vz2_file_operations WHERE request_key=?',[$key]);
    if(!$rows)return null;
    $op=$rows[0];
    if(!auth_is_admin() && (int)$op['actor_id']!==vz2_actor())throw new Vz2Error('Cizí operace.',403);
    return $op;
}
function vz2_upload(array $in,array $files): array {
    vz2_ready(true);vz2_login();vz2_permission('upload');
    $key=vz2_key($in['request_key']??null);$collection=vz2_id($in['collection_id']??null);
    $kind=$in['kind']??'';$attachment=$kind==='attachment';$title=vz2_text($in['title']??null);
    if(!in_array($kind,['single','multitrack','attachment'],true))throw new Vz2Error('Neplatný druh nahrávky.');
    $upload=$files['files']??null;
    if(!$upload || !is_array($upload['name']??null))throw new Vz2Error('Vyberte soubory.');
    $count=count($upload['name']);$max=defined('VZ2_MAX_TRACKS')?VZ2_MAX_TRACKS:32;
    if($count<1 || $count>$max || ($kind!=='multitrack' && $count!==1) || (int)($in['file_count']??0)!==$count)throw new Vz2Error('Server nepřijal celou sadu souborů. Zkontrolujte limity uploadu.',413);
    $prepared=[];$formats=[];
    foreach($upload['name'] as $i=>$rawName){
        if(($upload['error'][$i]??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK || !is_uploaded_file($upload['tmp_name'][$i]??''))throw new Vz2Error('Soubor nebyl kompletně nahrán.',400);
        $name=vz2_text(basename(str_replace('\\','/',$rawName)),255);
        $meta=vz2_inspect_upload($upload['tmp_name'][$i],$name,$attachment);
        if($kind==='multitrack' && !in_array($meta['format'],['wav','flac','mp3'],true))throw new Vz2Error('Mixér přijímá WAV, FLAC nebo MP3.',422);
        $formats[]=$meta['format'];
        $prepared[]=$meta+['tmp'=>$upload['tmp_name'][$i],'original_name'=>$name,'title'=>vz2_text(pathinfo($name,PATHINFO_FILENAME))];
    }
    if($kind==='multitrack' && count(array_unique($formats))!==1)throw new Vz2Error('Všechny stopy musí mít stejný formát.',422);
    if($old=vz2_existing_operation($key)){
        if($old['action']!==($attachment?'upload_attachment':'upload_recording') || $old['target_title']!==$title)throw new Vz2Error('Klíč patří jiné operaci.',409);
        $table=$attachment?'vz2_attachments':'vz2_recordings';
        $target=vz2_one(vz2_db(),"SELECT * FROM $table WHERE id=?",[$old['target_id']]);
        if((int)$target['collection_id']!==$collection || (!$attachment && $target['kind']!==$kind))throw new Vz2Error('Klíč patří jinému uploadu.',409);
        $previous=$attachment?[$target]:vz2_rows(vz2_db(),'SELECT * FROM vz2_audio_files WHERE recording_id=? ORDER BY id',[$target['id']]);
        if(count($previous)!==count($prepared))throw new Vz2Error('Klíč patří jiné sadě souborů.',409);
        foreach($prepared as $i=>$f)if($f['sha256']!==$previous[$i]['sha256'] || $f['original_name']!==$previous[$i]['original_name'])throw new Vz2Error('Obsah opakovaného uploadu se změnil.',409);
        return vz2_run_operation((int)$old['id']);
    }
    // Unique request staging, claimed atomically; never overwrite an earlier request.
    $stage=vz2_path('.staging/'.$key.'/placeholder',true);
    $claim=dirname($stage).'/.claim';$handle=@fopen($claim,'x');
    if(!$handle)throw new Vz2Error('Tento upload již probíhá. Obnovte jeho stav.',409);fclose($handle);
    foreach($prepared as $i=>&$file){
        $file['staging_path']='.staging/'.$key.'/'.$i.'.'.$file['format'];
        if(!move_uploaded_file($file['tmp'],vz2_path($file['staging_path'])))throw new Vz2Error('Upload nelze uložit do stagingu.',500);
    }unset($file);
    $operation=vz2_write(function(mysqli $db) use($collection,$kind,$attachment,$title,$key,$prepared): int {
        vz2_permission('upload');$c=vz2_collection($db,$collection);vz2_active($c);
        $base=($c['kind']==='song'?'skladby':'zkousky').'/'.$c['id'].'-'.$c['storage_slug'];$actor=vz2_actor();
        if($attachment){
            $f=$prepared[0];
            vz2_query($db,'INSERT INTO vz2_attachments (collection_id,title,original_name,relative_path,mime_type,byte_size,sha256,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())',[$collection,$title,$f['original_name'],'pending/'.$key,$f['mime_type'],$f['byte_size'],$f['sha256'],$actor,$actor]);
            $id=(int)$db->insert_id;
            $path=$base.'/prilohy/p'.$id.'-'.vz2_slug($title).'.'.$f['format'];
            vz2_query($db,'UPDATE vz2_attachments SET relative_path=? WHERE id=?',[$path,$id]);
            $op=vz2_operation($db,$key,'upload_attachment','attachment',$id,$title);
            vz2_query($db,"INSERT INTO vz2_file_operation_items(operation_id,item_no,file_type,file_id,relative_path,staging_path,expected_sha256) VALUES (?,0,'attachment',?,?,?,?)",[$op,$id,$path,$f['staging_path'],$f['sha256']]);
        }else{
            $order=(int)vz2_one($db,'SELECT COALESCE(MAX(sort_order),-1)+1 n FROM vz2_recordings WHERE collection_id=?',[$collection])['n'];
            vz2_query($db,'INSERT INTO vz2_recordings(collection_id,kind,title,storage_dir,sort_order,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())',[$collection,$kind,$title,'pending/'.$key,$order,$actor,$actor]);
            $id=(int)$db->insert_id;$dir=$base.'/r'.$id.'-'.vz2_slug($title);
            vz2_query($db,'UPDATE vz2_recordings SET storage_dir=? WHERE id=?',[$dir,$id]);
            $op=vz2_operation($db,$key,'upload_recording','recording',$id,$title);
            foreach($prepared as $i=>$f){
                vz2_query($db,'INSERT INTO vz2_audio_files(recording_id,title,original_name,relative_path,format,mime_type,byte_size,sha256,duration_ms,sort_order,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())',[$id,$f['title'],$f['original_name'],'pending/'.$key.'/'.$i,$f['format'],$f['mime_type'],$f['byte_size'],$f['sha256'],$f['duration_ms'],$i,$actor,$actor]);
                $fileId=(int)$db->insert_id;$path=$dir.'/a'.$fileId.'-'.vz2_slug($f['title']).'.'.$f['format'];
                vz2_query($db,'UPDATE vz2_audio_files SET relative_path=? WHERE id=?',[$path,$fileId]);
                vz2_query($db,"INSERT INTO vz2_file_operation_items(operation_id,item_no,file_type,file_id,relative_path,staging_path,expected_sha256) VALUES (?,?,'audio',?,?,?,?)",[$op,$i,$fileId,$path,$f['staging_path'],$f['sha256']]);
            }
            vz2_query($db,'UPDATE vz2_collections SET recordings_revision=recordings_revision+1 WHERE id=?',[$collection]);
        }
        return $op;
    });
    return vz2_run_operation($operation);
}

function vz2_remove(array $in): array {
    $key=vz2_key($in['request_key']??null);$action=$in['action']??'';$id=vz2_id($in['id']??null);
    $map=['remove_audio'=>'recording','remove_attachment'=>'attachment','delete_recording'=>'recording','delete_collection'=>'collection'];
    if(!isset($map[$action]))throw new Vz2Error('Neplatná operace.');$type=$map[$action];
    if($old=vz2_existing_operation($key)){
        if($old['action']!==$action || (int)$old['target_id']!==$id)throw new Vz2Error('Klíč patří jiné operaci.',409);
        return vz2_run_operation((int)$old['id']);
    }
    $op=vz2_write(function(mysqli $db)use($in,$key,$action,$id,$type):int{
        $table=['recording'=>'vz2_recordings','collection'=>'vz2_collections','attachment'=>'vz2_attachments'][$type];
        $r=vz2_one($db,"SELECT * FROM $table WHERE id=? FOR UPDATE",[$id]);vz2_active($r);vz2_revision($r,$in['revision']??null);vz2_idle($db,$type,$id);
        if($type!=='collection')vz2_active(vz2_collection($db,(int)$r['collection_id']));
        $full=str_starts_with($action,'delete_');
        if($full){if(!auth_is_admin())throw new Vz2Error('Úplné smazání smí provést jen admin.',403);}
        else vz2_permission('delete_file',(int)$r['created_by']);
        if(($in['confirm']??null)!==$r['title'])throw new Vz2Error('Potvrďte název mazané položky.');
        if($type==='collection'){
            $recordings=vz2_rows($db,'SELECT * FROM vz2_recordings WHERE collection_id=? FOR UPDATE',[$id]);
            $attachments=vz2_rows($db,'SELECT * FROM vz2_attachments WHERE collection_id=? FOR UPDATE',[$id]);
            foreach($recordings as $child){vz2_active($child);vz2_idle($db,'recording',(int)$child['id']);}
            foreach($attachments as $child)vz2_idle($db,'attachment',(int)$child['id']);
            $audio=vz2_rows($db,'SELECT f.* FROM vz2_audio_files f JOIN vz2_recordings r ON r.id=f.recording_id WHERE r.collection_id=?',[$id]);
        }elseif($type==='recording'){$audio=vz2_rows($db,'SELECT * FROM vz2_audio_files WHERE recording_id=?',[$id]);$attachments=[];}
        else{$audio=[];$attachments=[$r];}
        $op=vz2_operation($db,$key,$action,$type,$id,$r['title']);$i=0;
        foreach(['audio'=>$audio,'attachment'=>$attachments] as $fileType=>$group)foreach($group as $file){
            if($file['state']==='deleted')continue;
            if($fileType==='audio' && $file['duration_ms']===null && is_file(vz2_path($file['relative_path'])))throw new Vz2Error('Nejdříve doplňte délku audia.',409);
            vz2_query($db,'INSERT INTO vz2_file_operation_items(operation_id,item_no,file_type,file_id,relative_path,expected_sha256) VALUES (?,?,?,?,?,?)',[$op,$i++,$fileType,$file['id'],$file['relative_path'],$file['sha256']]);
            $ft=$fileType==='audio'?'vz2_audio_files':'vz2_attachments';
            vz2_query($db,"UPDATE $ft SET state='deleting',revision=revision+1 WHERE id=?",[$file['id']]);
            if($fileType==='audio'){
                $cache='.cache/peaks/'.$file['id'].'-'.$file['sha256'].'-v1.json';
                if(is_file(vz2_path($cache)))vz2_query($db,"INSERT INTO vz2_file_operation_items(operation_id,item_no,file_type,relative_path) VALUES (?,?,'cache',?)",[$op,$i++,$cache]);
            }
        }
        if($full)vz2_query($db,"UPDATE $table SET lifecycle='deleting',revision=revision+1 WHERE id=?",[$id]);
        elseif($type==='recording')vz2_query($db,'UPDATE vz2_recordings SET revision=revision+1 WHERE id=?',[$id]);
        return $op;
    });
    return vz2_run_operation($op);
}

function vz2_run_operation(int $id): array {
    vz2_ready(true);vz2_login();vz2_root();
    $db=vz2_db();$op=vz2_one($db,'SELECT * FROM vz2_file_operations WHERE id=?',[$id]);
    if(!auth_is_admin() && (int)$op['actor_id']!==vz2_actor())throw new Vz2Error('Cizí operace.',403);
    if($op['state']==='completed')return ['id'=>(int)$op['target_id'],'operation_id'=>$id,'completed'=>true];
    if(str_starts_with($op['action'],'delete_') && !auth_is_admin())throw new Vz2Error('Úplné smazání smí dokončit jen admin.',403);
    vz2_permission(str_starts_with($op['action'],'upload_')?'upload':'delete_file');
    $lock=fopen(vz2_path('.locks/'.$id.'.lock',true),'c');
    if(!$lock || !flock($lock,LOCK_EX|LOCK_NB)){if($lock)fclose($lock);throw new Vz2Error('Operace právě probíhá.',409);}
    try{
        $op=vz2_one($db,'SELECT * FROM vz2_file_operations WHERE id=?',[$id]);
        if($op['state']==='completed')return ['id'=>(int)$op['target_id'],'operation_id'=>$id,'completed'=>true];
        vz2_query($db,"UPDATE vz2_file_operations SET state='running',error_code=NULL,updated_at=UTC_TIMESTAMP() WHERE id=?",[$id]);
        $upload=str_starts_with($op['action'],'upload_');
        foreach(vz2_rows($db,'SELECT * FROM vz2_file_operation_items WHERE operation_id=? ORDER BY item_no',[$id]) as $item){
            if($item['state']==='done' && !$upload)continue;
            $destination=vz2_path($item['relative_path'],$upload);$existed=is_file($destination);
            if($upload){
                $source=vz2_path($item['staging_path']);
                try{vz2_copy_exclusive($source,$destination,$item['expected_sha256']);}
                catch(RuntimeException $e){throw new Vz2Error($e->getMessage(),in_array($e->getCode(),[409,500],true)?$e->getCode():500);}
                if(is_file($source) && !unlink($source))throw new Vz2Error('Nelze dokončit úklid stagingu.',500);
                vz2_query($db,"UPDATE vz2_file_operation_items SET state='done' WHERE operation_id=? AND item_no=?",[$id,$item['item_no']]);
            }else{
                if(file_exists($destination) && !is_file($destination))throw new Vz2Error('Místo souboru existuje adresář.',409);
                if($existed && !unlink($destination))throw new Vz2Error('Některé soubory nelze odstranit. Zápisy jsou zachovány.',500);
                vz2_write(function(mysqli $db)use($id,$item,$op,$existed):void{
                    if($item['file_type']!=='cache'){
                        $table=$item['file_type']==='audio'?'vz2_audio_files':'vz2_attachments';
                        $f=vz2_one($db,"SELECT * FROM $table WHERE id=?",[$item['file_id']]);
                        vz2_query($db,"UPDATE $table SET state='deleted',deleted_by=?,deleted_at=UTC_TIMESTAMP(),updated_by=?,updated_at=UTC_TIMESTAMP(),revision=revision+1 WHERE id=?",[$op['actor_id'],$op['actor_id'],$item['file_id']]);
                        vz2_log($db,$item['file_type'].'.removed',$item['file_type'],(int)$item['file_id'],$f['title'],$existed?'Soubor odstraněn.':'Potvrzeno odstranění; soubor již chyběl.',$id,(int)$op['actor_id']);
                    }
                    vz2_query($db,"UPDATE vz2_file_operation_items SET state='done' WHERE operation_id=? AND item_no=?",[$id,$item['item_no']]);
                });
            }
        }
        vz2_write(function(mysqli $db)use($op,$id,$upload):void{
            $target=(int)$op['target_id'];$actor=(int)$op['actor_id'];
            if($upload){
                if($op['target_type']==='recording'){
                    vz2_query($db,"UPDATE vz2_audio_files SET state='available' WHERE recording_id=?",[$target]);
                    vz2_query($db,"UPDATE vz2_recordings SET lifecycle='active',duration_ms=(SELECT MAX(duration_ms) FROM vz2_audio_files WHERE recording_id=?),revision=revision+1 WHERE id=?",[$target,$target]);
                    vz2_log($db,'recording.created','recording',$target,$op['target_title'],'Upload dokončen.',$id,$actor);
                }else vz2_query($db,"UPDATE vz2_attachments SET state='available' WHERE id=?",[$target]);
            }
            if(str_starts_with($op['action'],'delete_'))vz2_delete_rows($db,$op);
            vz2_log($db,$op['action'].'.completed',$op['target_type'],$target,$op['target_title'],'Souborová operace dokončena.',$id,$actor);
            vz2_query($db,"UPDATE vz2_file_operations SET state='completed',error_code=NULL,updated_at=UTC_TIMESTAMP(),completed_at=UTC_TIMESTAMP() WHERE id=?",[$id]);
        });
        return ['id'=>(int)$op['target_id'],'operation_id'=>$id,'completed'=>true];
    }catch(Throwable $e){
        vz2_query($db,"UPDATE vz2_file_operations SET state='failed',error_code='file_operation_failed',updated_at=UTC_TIMESTAMP() WHERE id=?",[$id]);
        throw new Vz2Error($e instanceof Vz2Error?$e->getMessage().' (operace #'.$id.')':'Operaci je nutné dokončit opakováním #'.$id.'.', $e instanceof Vz2Error?$e->status:500);
    }finally{flock($lock,LOCK_UN);fclose($lock);}
}
function vz2_delete_rows(mysqli $db,array $op):void {
    $id=(int)$op['target_id'];$collection=$op['target_type']==='collection';
    $recordings=$collection?vz2_rows($db,'SELECT * FROM vz2_recordings WHERE collection_id=?',[$id]):[vz2_one($db,'SELECT * FROM vz2_recordings WHERE id=?',[$id])];
    foreach($recordings as $r){
        vz2_query($db,'DELETE FROM vz2_timestamps WHERE recording_id=?',[$r['id']]);
        vz2_query($db,'DELETE FROM vz2_audio_files WHERE recording_id=?',[$r['id']]);
        vz2_query($db,'DELETE FROM vz2_recordings WHERE id=?',[$r['id']]);
        vz2_query($db,'UPDATE vz2_collections SET recordings_revision=recordings_revision+1 WHERE id=?',[$r['collection_id']]);
    }
    if($collection){
        foreach(vz2_rows($db,'SELECT id FROM vz2_documents WHERE collection_id=?',[$id]) as $d){
            vz2_query($db,'UPDATE vz2_documents SET current_revision=NULL WHERE id=?',[$d['id']]);
            vz2_query($db,'DELETE FROM vz2_document_versions WHERE document_id=?',[$d['id']]);
            vz2_query($db,'DELETE FROM vz2_documents WHERE id=?',[$d['id']]);
        }
        vz2_query($db,'DELETE p FROM vz2_discussion_posts p JOIN vz2_discussion_threads t ON t.id=p.thread_id WHERE t.collection_id=?',[$id]);
        vz2_query($db,'DELETE FROM vz2_discussion_threads WHERE collection_id=?',[$id]);
        vz2_query($db,'DELETE FROM vz2_attachments WHERE collection_id=?',[$id]);
        $c=vz2_collection($db,$id);
        vz2_query($db,'DELETE FROM vz2_collections WHERE id=?',[$id]);
        vz2_query($db,'UPDATE vz2_collection_orders SET revision=revision+1 WHERE kind=?',[$c['kind']]);
    }
}
