<?php
declare(strict_types=1);
require_once __DIR__.'/vz2_storage.php';

function vz2_file_public(array $f,string $type):array {
    $available=$f['state']==='available' && is_file(vz2_path($f['relative_path']));
    $status=$f['state']==='available' && !$available?'missing':$f['state'];
    return ['id'=>(int)$f['id'],'title'=>$f['title'],'original_name'=>$f['original_name'],
        'format'=>$f['format']??pathinfo($f['relative_path'],PATHINFO_EXTENSION),'byte_size'=>(int)$f['byte_size'],
        'sha256'=>$f['sha256'],'duration_ms'=>isset($f['duration_ms'])?(int)$f['duration_ms']:null,
        'sort_order'=>(int)($f['sort_order']??0),'state'=>$status,'deleted_at'=>$f['deleted_at'],
        'deleted_by'=>$f['deleted_by']===null?null:(int)$f['deleted_by'],
        'url'=>$available?'php/ajax/vz2_files.php?type='.$type.'&id='.$f['id'].'&hash='.$f['sha256']:null];
}
function vz2_catalog():array {
    $db=vz2_db();vz2_root();
    $collections=vz2_rows($db,'SELECT c.*,u.name author FROM vz2_collections c JOIN users u ON u.id=c.created_by ORDER BY c.kind,c.sort_order,c.id');
    foreach($collections as &$c){unset($c['storage_slug']);$c['can_edit']=auth_is_admin() || (ma_pravo('rename_val') && (int)$c['created_by']===(int)($_SESSION['user_id']??0));}unset($c);
    $recordings=vz2_rows($db,'SELECT r.*,u.name author FROM vz2_recordings r JOIN users u ON u.id=r.created_by ORDER BY r.collection_id,r.sort_order,r.id');
    $allFiles=vz2_rows($db,'SELECT * FROM vz2_audio_files ORDER BY recording_id,sort_order,id');$byRecording=[];
    foreach($allFiles as $f)$byRecording[$f['recording_id']][]=vz2_file_public($f,'audio');
    foreach($recordings as &$r){
        unset($r['storage_dir']);$r['files']=$byRecording[$r['id']]??[];
        $r['can_edit']=auth_is_admin() || (ma_pravo('edit_recording_label') && (int)$r['created_by']===(int)($_SESSION['user_id']??0));
        $r['can_remove']=auth_is_admin() || (ma_pravo('delete_file') && (int)$r['created_by']===(int)($_SESSION['user_id']??0));
        $r['can_move']=auth_is_admin() || (ma_pravo('move_file') && (int)$r['created_by']===(int)($_SESSION['user_id']??0));
        $states=array_column($r['files'],'state');
        $r['audio_state']=$states && count(array_unique($states))===1?$states[0]:'partial';
        $r['timestamps']=vz2_rows($db,'SELECT t.id,t.kind,t.time_ms,t.body,t.revision,t.created_by,u.name author FROM vz2_timestamps t JOIN users u ON u.id=t.created_by WHERE recording_id=? ORDER BY time_ms,id',[$r['id']]);
    }unset($r);
    $attachments=vz2_rows($db,'SELECT a.*,u.name author FROM vz2_attachments a JOIN users u ON u.id=a.created_by ORDER BY a.id');
    foreach($attachments as &$a){$a=array_merge($a,vz2_file_public($a,'attachment'));unset($a['relative_path']);
        $a['can_edit']=auth_is_admin() || (ma_pravo('edit_recording_label') && (int)$a['created_by']===(int)($_SESSION['user_id']??0));
        $a['can_remove']=auth_is_admin() || (ma_pravo('delete_file') && (int)$a['created_by']===(int)($_SESSION['user_id']??0));
        $a['can_move']=auth_is_admin() || (ma_pravo('move_file') && (int)$a['created_by']===(int)($_SESSION['user_id']??0));
    }unset($a);
    $ops=vz2_rows($db,"SELECT id,target_id,target_type,target_title,action,state,error_code,actor_id FROM vz2_file_operations WHERE state<>'completed'".(auth_is_admin()?'':' AND actor_id=?').' ORDER BY id DESC',auth_is_admin()?[]:[(int)($_SESSION['user_id']??0)]);
    return ['collections'=>$collections,'orders'=>vz2_rows($db,'SELECT * FROM vz2_collection_orders'),
        'recordings'=>$recordings,'attachments'=>$attachments,'operations'=>$ops];
}
function vz2_mixer(?int $id=null):array {
    $catalog=vz2_catalog();$items=[];
    foreach($catalog['recordings'] as $r){
        if($r['kind']!=='multitrack' || $r['lifecycle']!=='active' || ($id!==null && (int)$r['id']!==$id))continue;
        $tracks=[];
        foreach($r['files'] as $f)$tracks[]=['file'=>'a'.$f['id'].'.'.$f['format'],'name'=>$f['title'],'order'=>$f['sort_order'],
            'url'=>rtrim(SITE_URL,'/').'/php/ajax/vz2_files.php?type=audio&id='.$f['id'].'&hash='.$f['sha256'],
            'fileId'=>$f['id'],'sha256'=>$f['sha256']];
        $items[]=['id'=>(string)$r['id'],'name'=>$r['title'],'version'=>1,'created'=>str_replace(' ','T',$r['created_at']).'Z',
            'audioDeleted'=>$r['audio_state']==='deleted','audioUnavailable'=>$r['audio_state']!=='available','tracks'=>$tracks,
            'metadataUrl'=>'php/ajax/vz2.php?action=mixer&id='.$r['id']];
    }
    if($id!==null){if(!$items)throw new Vz2Error('Vícestopá nahrávka neexistuje.',404);return ['multitrack'=>$items[0]];}
    return ['multitracks'=>$items];
}
