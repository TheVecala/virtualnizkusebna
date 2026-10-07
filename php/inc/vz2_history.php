<?php
declare(strict_types=1);
require_once __DIR__.'/vz2_catalog.php';

function vz2_history_right(): bool {
    return defined('VZ2_WRITES_ENABLED') && VZ2_WRITES_ENABLED === true && !empty($_SESSION['user_id'])
        && ($_SESSION['role'] ?? '') !== 'host' && (auth_is_admin() || ma_pravo('comment'));
}

function vz2_history_data(mysqli $db): array {
    $catalog=vz2_catalog();
    $collections=[]; foreach($catalog['collections'] as $c)$collections[(int)$c['id']]=$c;
    $recordings=[]; foreach($catalog['recordings'] as $r)$recordings[(int)$r['id']]=$r;
    $plays=vz2_rows($db,"SELECT p.*,COALESCE(s.title,p.song_title_snapshot) song_title,COALESCE(h.title,p.rehearsal_title_snapshot) rehearsal_title,
        sr.title source_title,cr.title clip_title,st.time_ms start_ms,et.time_ms end_ms
        FROM vz2_rehearsal_plays p
        LEFT JOIN vz2_collections s ON s.id=p.song_collection_id LEFT JOIN vz2_collections h ON h.id=p.rehearsal_collection_id
        LEFT JOIN vz2_recordings sr ON sr.id=p.source_recording_id LEFT JOIN vz2_recordings cr ON cr.id=p.clip_recording_id
        LEFT JOIN vz2_timestamps st ON st.id=p.start_timestamp_id LEFT JOIN vz2_timestamps et ON et.id=p.end_timestamp_id ORDER BY p.id");
    foreach($plays as &$p){
        foreach(['id','rehearsal_collection_id','song_collection_id','revision'] as $k)$p[$k]=(int)$p[$k];
        foreach(['source_recording_id','start_timestamp_id','end_timestamp_id','clip_recording_id','start_ms','end_ms'] as $k)$p[$k]=$p[$k]===null?null:(int)$p[$k];
        $source=$p['source_recording_id']?($recordings[$p['source_recording_id']]??null):null;
        $clip=$p['clip_recording_id']?($recordings[$p['clip_recording_id']]??null):null;
        $p['source']=$source?['id'=>$source['id'],'title'=>$source['title'],'summary'=>$source['summary'],'audio_state'=>$source['audio_state'],'files'=>$source['files']]:null;
        $p['clip']=$clip?['id'=>$clip['id'],'title'=>$clip['title'],'summary'=>$clip['summary'],'audio_state'=>$clip['audio_state'],'files'=>$clip['files']]:null;
        $p['notes']=[];
        if($p['source_recording_id'] && $p['start_ms']!==null && $p['end_ms']!==null)foreach($source['timestamps']??[] as $t)if($t['kind']==='note' && $t['time_ms'] >= $p['start_ms'] && $t['time_ms'] < $p['end_ms'])$p['notes'][]=$t;
        $p['can_edit']=vz2_history_right();
    } unset($p);
    $usedStarts=array_filter(array_column($plays,'start_timestamp_id'));$usedClips=array_filter(array_column($plays,'clip_recording_id'));
    $intervals=[];
    foreach($catalog['recordings'] as $r){
        $c=$collections[(int)$r['collection_id']]??null;if(!$c || $c['kind']!=='rehearsal')continue;
        $byId=[];foreach($r['timestamps'] as $t)$byId[$t['id']]=$t;
        foreach($r['timestamps'] as $end)if($end['kind']==='song_end' && $end['paired_timestamp_id'] && isset($byId[$end['paired_timestamp_id']]) && !in_array($end['paired_timestamp_id'],$usedStarts,true)){
            $start=$byId[$end['paired_timestamp_id']];$intervals[]=['recording_id'=>(int)$r['id'],'recording_title'=>vz2_recording_display_name($r),'rehearsal_collection_id'=>(int)$r['collection_id'],'start_timestamp_id'=>$start['id'],'end_timestamp_id'=>$end['id'],'start_ms'=>$start['time_ms'],'end_ms'=>$end['time_ms']];
        }
    }
    $clips=[];foreach($catalog['recordings'] as $r){$c=$collections[(int)$r['collection_id']]??null;if($c && $c['kind']==='song' && !in_array((int)$r['id'],$usedClips,true))$clips[]=['id'=>(int)$r['id'],'collection_id'=>(int)$r['collection_id'],'title'=>vz2_recording_display_name($r),'audio_state'=>$r['audio_state']];}
    $historicSongs=array_map('intval',array_column($plays,'song_collection_id'));
    return ['songs'=>array_values(array_filter($catalog['collections'],fn($c)=>$c['kind']==='song' && ($c['lifecycle']==='active' || in_array((int)$c['id'],$historicSongs,true)))),
        'rehearsals'=>array_values(array_filter($catalog['collections'],fn($c)=>$c['kind']==='rehearsal' && $c['lifecycle']==='active')),
        'plays'=>$plays,'unassigned_intervals'=>$intervals,'unassigned_clips'=>$clips,'can_edit'=>vz2_history_right()];
}

function vz2_history_read(): array { return vz2_history_data(vz2_db()); }

function vz2_history_write(array $in): array {
    return vz2_write(function(mysqli $db)use($in):array{
        if(!vz2_history_right())throw new Vz2Error('Historii smí upravovat člen s právem zapisovat poznámky.',403);
        $action=$in['action']??'';
        if($action==='delete'){
            $p=vz2_one($db,'SELECT * FROM vz2_rehearsal_plays WHERE id=? FOR UPDATE',[vz2_id($in['id']??null)]);vz2_revision($p,$in['revision']??null);
            vz2_query($db,'DELETE FROM vz2_rehearsal_plays WHERE id=?',[$p['id']]);vz2_log($db,'history.deleted','rehearsal_play',(int)$p['id'],$p['song_title_snapshot'],'Pouze historická vazba');
            return vz2_history_data($db);
        }
        if(!in_array($action,['create','update'],true))throw new Vz2Error('Neznámá operace historie.');
        $song=vz2_collection($db,vz2_id($in['song_collection_id']??null));$rehearsal=vz2_collection($db,vz2_id($in['rehearsal_collection_id']??null));
        if($song['kind']!=='song' || $rehearsal['kind']!=='rehearsal')throw new Vz2Error('Vyberte skladbu a zkoušku z katalogu.');
        $source=isset($in['source_recording_id']) && $in['source_recording_id']!==null?vz2_id($in['source_recording_id']):null;
        $start=isset($in['start_timestamp_id']) && $in['start_timestamp_id']!==null?vz2_id($in['start_timestamp_id']):null;
        $end=isset($in['end_timestamp_id']) && $in['end_timestamp_id']!==null?vz2_id($in['end_timestamp_id']):null;
        $clip=isset($in['clip_recording_id']) && $in['clip_recording_id']!==null?vz2_id($in['clip_recording_id']):null;
        if($action==='create' && $source){$r=vz2_one($db,'SELECT * FROM vz2_recordings WHERE id=?',[$source]);if((int)$r['collection_id']!==(int)$rehearsal['id'])throw new Vz2Error('Zdroj při zařazení nepatří do vybrané zkoušky.');
            $a=vz2_one($db,'SELECT * FROM vz2_timestamps WHERE id=?',[$start]);$b=vz2_one($db,'SELECT * FROM vz2_timestamps WHERE id=?',[$end]);
            if((int)$a['recording_id']!==$source || (int)$b['recording_id']!==$source || $a['kind']!=='song_start' || $b['kind']!=='song_end' || (int)$b['paired_timestamp_id']!==$start || (int)$b['time_ms']<=(int)$a['time_ms'])throw new Vz2Error('Úsek není platná propojená dvojice.');
        }elseif($action==='create' && ($start || $end))throw new Vz2Error('Časy vyžadují zdrojovou nahrávku.');
        if($clip){$cr=vz2_one($db,'SELECT * FROM vz2_recordings WHERE id=?',[$clip]);if((int)$cr['collection_id']!==(int)$song['id'])throw new Vz2Error('Výstřižek nepatří do vybrané skladby.');}
        if($action==='create' && !$source && !$clip)throw new Vz2Error('Vyberte kompletní úsek nebo výstřižek.');
        if($action==='create'){
            vz2_query($db,'INSERT INTO vz2_rehearsal_plays(rehearsal_collection_id,song_collection_id,rehearsal_title_snapshot,song_title_snapshot,source_recording_id,start_timestamp_id,end_timestamp_id,clip_recording_id,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())',[$rehearsal['id'],$song['id'],$rehearsal['title'],$song['title'],$source,$start,$end,$clip,vz2_actor(),vz2_actor()]);$id=(int)$db->insert_id;
        }else{$id=vz2_id($in['id']??null);$p=vz2_one($db,'SELECT * FROM vz2_rehearsal_plays WHERE id=? FOR UPDATE',[$id]);vz2_revision($p,$in['revision']??null);
            if((int)$p['song_collection_id']!==(int)$song['id'] || (int)$p['rehearsal_collection_id']!==(int)$rehearsal['id'])throw new Vz2Error('Historickou skladbu ani zkoušku nelze tiše přeřadit.',409);
            if(!$clip && $p['source_recording_id']===null)throw new Vz2Error('Přímý pokus z výstřižku musí mít výstřižek.');
            vz2_query($db,'UPDATE vz2_rehearsal_plays SET clip_recording_id=?,revision=revision+1,updated_by=?,updated_at=UTC_TIMESTAMP() WHERE id=?',[$clip,vz2_actor(),$id]);}
        vz2_log($db,'history.'.($action==='create'?'created':'updated'),'rehearsal_play',$id,$song['title'],'Zkouška #'.$rehearsal['id']);return vz2_history_data($db);
    });
}
