<?php
declare(strict_types=1);
require_once __DIR__.'/vz2_timestamp_model.php';

function vz2_timestamp_ms($value, array $recording): int {
    if(!is_int($value) || $value<0 || $value>604800000 || ($recording['duration_ms']!==null && $value>(int)$recording['duration_ms']))
        throw new Vz2Error('Čas musí být celé milisekundy v rozsahu nahrávky (nejvýše 7 dní).');
    return $value;
}
function vz2_timestamp_optional_id($value): ?int { return $value===null || $value===''?null:vz2_id($value); }

// Validate the entire recording after a proposed mutation, inside its lock and
// transaction. Moving either boundary can invalidate a child, so it is never clipped.
function vz2_timestamp_validate_graph(mysqli $db, array $recording): void {
    $rows=vz2_rows($db,'SELECT * FROM vz2_timestamps WHERE recording_id=? FOR UPDATE',[$recording['id']]);
    $by=[];$ends=[];foreach($rows as $row){$by[(int)$row['id']]=$row;if($row['paired_timestamp_id'])$ends[(int)$row['paired_timestamp_id']]=$row;}
    foreach($rows as $row){
        $start=(int)$row['time_ms'];vz2_timestamp_ms($start,$recording);
        if($row['end_time_ms']!==null){
            $end=vz2_timestamp_ms((int)$row['end_time_ms'],$recording);
            if($row['kind']!=='passage' || $end<=$start)throw new Vz2Error('Konec pasáže musí být po jejím začátku.');
        }
        if($row['paired_timestamp_id']){
            $pair=$by[(int)$row['paired_timestamp_id']]??null;
            if($row['kind']!=='song_end' || !$pair || $pair['kind']!=='song_start' || (int)$pair['time_ms']>=$start)
                throw new Vz2Error('Začátek musí být ve stejné nahrávce a před koncem.');
        }
        if($row['parent_timestamp_id']){
            $parent=$by[(int)$row['parent_timestamp_id']]??null;
            if($row['kind']!=='passage' || !$parent || $parent['kind']!=='song_start')throw new Vz2Error('Pasáž musí odkazovat na pokus ve stejné nahrávce.');
            $parentEnd=$ends[(int)$parent['id']]['time_ms']??null;
            if($start<(int)$parent['time_ms'] || ($parentEnd!==null && ($start>=(int)$parentEnd || ($row['end_time_ms']!==null && (int)$row['end_time_ms']>(int)$parentEnd))))
                throw new Vz2Error('Pasáž musí ležet uvnitř přiřazeného pokusu. Upravte její hranice nebo přiřazení.');
        }
    }
}

// song_collection_id on the start is the authority. History is an atomic
// projection of an assigned, complete take in a rehearsal, retaining its ID.
function vz2_timestamp_sync_history(mysqli $db, array $recording, int $startId): void {
    $starts=vz2_rows($db,"SELECT * FROM vz2_timestamps WHERE id=? AND recording_id=? AND kind='song_start'",[$startId,$recording['id']]);
    if(!$starts)return;$start=$starts[0];
    $history=vz2_rows($db,'SELECT * FROM vz2_rehearsal_plays WHERE start_timestamp_id=? FOR UPDATE',[$startId]);
    $existing=$history[0]??null;
    $ends=vz2_rows($db,"SELECT * FROM vz2_timestamps WHERE paired_timestamp_id=? AND kind='song_end'",[$startId]);
    $end=$ends[0]??null;
    $songId=$start['song_collection_id'];
    if(!$songId){
        if($existing){
            if($existing['clip_recording_id'])vz2_query($db,'UPDATE vz2_rehearsal_plays SET source_recording_id=NULL,start_timestamp_id=NULL,end_timestamp_id=NULL,revision=revision+1,updated_by=?,updated_at=UTC_TIMESTAMP() WHERE id=?',[vz2_actor(),$existing['id']]);
            else vz2_query($db,'DELETE FROM vz2_rehearsal_plays WHERE id=?',[$existing['id']]);
            vz2_log($db,'history.unassigned','rehearsal_play',(int)$existing['id'],$existing['song_title_snapshot'],'Odebráno přiřazení pokusu');
        }
        return;
    }
    if(!$end){if($existing)throw new Vz2Error('Pokus v historii musí mít konec. Nejprve odeberte jeho přiřazení.',409);return;}
    $song=vz2_one($db,'SELECT * FROM vz2_collections WHERE id=?',[$songId]);
    $rehearsal=vz2_one($db,'SELECT * FROM vz2_collections WHERE id=?',[$existing['rehearsal_collection_id']??$recording['collection_id']]);
    if($rehearsal['kind']!=='rehearsal')return;
    if($existing){
        if($existing['clip_recording_id'] && (int)$existing['song_collection_id']!==(int)$songId)throw new Vz2Error('Nejprve odpojte výstřižek původní skladby v historii.',409);
        if((int)$existing['song_collection_id']===(int)$songId && (int)$existing['end_timestamp_id']===(int)$end['id'])return;
        vz2_query($db,'UPDATE vz2_rehearsal_plays SET song_collection_id=?,song_title_snapshot=?,end_timestamp_id=?,revision=revision+1,updated_by=?,updated_at=UTC_TIMESTAMP() WHERE id=?',[$songId,$song['title'],$end['id'],vz2_actor(),$existing['id']]);
        $historyId=(int)$existing['id'];$verb='updated';
    }else{
        vz2_query($db,'INSERT INTO vz2_rehearsal_plays(rehearsal_collection_id,song_collection_id,rehearsal_title_snapshot,song_title_snapshot,source_recording_id,start_timestamp_id,end_timestamp_id,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())',[$rehearsal['id'],$songId,$rehearsal['title'],$song['title'],$recording['id'],$startId,$end['id'],vz2_actor(),vz2_actor()]);
        $historyId=(int)$db->insert_id;$verb='created';
    }
    vz2_log($db,'history.'.$verb,'rehearsal_play',$historyId,$song['title'],'Přiřazeno u pokusu');
}

function vz2_timestamp_mutate(array $in): array {
    return vz2_write(function(mysqli $db)use($in):array{
        $action=$in['action']??'';
        if(!in_array($action,['create','update','delete','save_interval','delete_interval'],true))throw new Vz2Error('Neznámá operace.');
        $id=vz2_id($in['recording_id']??null);$recording=vz2_recording($db,$id);vz2_active($recording);vz2_idle($db,'recording',$id);vz2_permission('comment');
        $interval=$action==='save_interval' || $action==='delete_interval';
        $deleting=$action==='delete' || $action==='delete_interval';
        $creating=$action==='create' || ($action==='save_interval' && !array_key_exists('id',$in));
        $row=null;
        if(!$creating){$row=vz2_one($db,'SELECT * FROM vz2_timestamps WHERE id=? AND recording_id=? FOR UPDATE',[vz2_id($in['id']??null),$id]);vz2_permission('comment',(int)$row['created_by']);vz2_revision($row,$in['revision']??null);}
        vz2_revision($recording,$in['timestamps_revision']??null,'timestamps_revision');
        $affected=[];
        if($row && $row['paired_timestamp_id'])$affected[]=(int)$row['paired_timestamp_id'];
        if($deleting){
            $targets=[(int)$row['id']];
            if($interval && $row['kind']==='song_start'){
                foreach(vz2_rows($db,'SELECT * FROM vz2_timestamps WHERE paired_timestamp_id=? FOR UPDATE',[$row['id']]) as $end){vz2_permission('comment',(int)$end['created_by']);$targets[]=(int)$end['id'];}
            }
            foreach($targets as $target){
                if(vz2_rows($db,'SELECT id FROM vz2_rehearsal_plays WHERE start_timestamp_id=? OR end_timestamp_id=?',[$target,$target]))throw new Vz2Error('Značka je součástí historie. Nejprve odeberte příslušný pokus.',409);
                if(vz2_rows($db,'SELECT id FROM vz2_timestamps WHERE parent_timestamp_id=?',[$target]))throw new Vz2Error('Pokus obsahuje přiřazené pasáže. Nejprve je odpojte nebo odstraňte.',409);
            }
            // Delete the end first. A raw start deletion keeps an orphan boundary.
            foreach(array_reverse($targets) as $target){
                vz2_query($db,'UPDATE vz2_timestamps SET paired_timestamp_id=NULL,revision=revision+1,updated_by=?,updated_at=UTC_TIMESTAMP() WHERE paired_timestamp_id=?',[vz2_actor(),$target]);
                vz2_query($db,'DELETE FROM vz2_timestamps WHERE id=?',[$target]);
            }
            $timestampId=(int)$row['id'];$kind=$row['kind'];$time=(int)$row['time_ms'];
        }else{
            $kind=$in['kind']??'';
            if(!in_array($kind,$interval?['song_start','passage']:['song_start','song_end','passage','note'],true))throw new Vz2Error('Neplatný typ zápisu.');
            if($interval && $row && $kind!==$row['kind'])throw new Vz2Error('Typ existujícího intervalu nelze změnit.');
            $time=vz2_timestamp_ms($in['time_ms']??null,$recording);
            $type=$kind==='passage'?($in['passage_type']??$row['passage_type']??'custom'):null;
            if($type!==null && (!is_string($type) || !isset(vz2_passage_types()[$type])))throw new Vz2Error('Neplatný typ pasáže.');
            $body=$in['body']??null;
            if($interval && is_string($body) && trim($body)==='')$body=$kind==='song_start'?'↑':vz2_passage_types()[$type];
            $body=vz2_text($body,4000);
            $note=vz2_text($in['note_text']??$row['note_text']??'',4000,true);
            $song=$kind==='song_start'?vz2_timestamp_optional_id(array_key_exists('song_collection_id',$in)?$in['song_collection_id']:($row['song_collection_id']??null)):null;
            if($song){$s=vz2_collection($db,$song);if($s['kind']!=='song' || ($s['lifecycle']!=='active' && (int)($row['song_collection_id']??0)!==$song))throw new Vz2Error('Vyberte aktivní skladbu z katalogu.');}
            $parent=$kind==='passage'?vz2_timestamp_optional_id(array_key_exists('parent_timestamp_id',$in)?$in['parent_timestamp_id']:($row['parent_timestamp_id']??null)):null;
            $endMs=$kind==='passage'?(array_key_exists('end_time_ms',$in)?$in['end_time_ms']:(isset($row['end_time_ms'])?(int)$row['end_time_ms']:null)):null;
            if($kind==='passage' && !$row && !array_key_exists('end_time_ms',$in))$endMs=null;
            if($endMs!==null)$endMs=vz2_timestamp_ms($endMs,$recording);
            $pair=null;
            if($kind==='song_end'){
                $pair=vz2_timestamp_optional_id(array_key_exists('paired_timestamp_id',$in)?$in['paired_timestamp_id']:($row['paired_timestamp_id']??null));
                if($creating && !array_key_exists('paired_timestamp_id',$in)){
                    $c=vz2_rows($db,"SELECT s.id FROM vz2_timestamps s LEFT JOIN vz2_timestamps e ON e.paired_timestamp_id=s.id WHERE s.recording_id=? AND s.kind='song_start' AND s.time_ms<? AND e.id IS NULL",[$id,$time]);if(count($c)===1)$pair=(int)$c[0]['id'];
                }
                if($pair){
                    $start=vz2_one($db,'SELECT * FROM vz2_timestamps WHERE id=?',[$pair]);
                    if((int)$start['recording_id']!==$id || $start['kind']!=='song_start' || (int)$start['time_ms']>=$time)throw new Vz2Error('Začátek musí být ve stejné nahrávce a před koncem.');
                    if(vz2_rows($db,'SELECT id FROM vz2_timestamps WHERE paired_timestamp_id=? AND id<>?',[$pair,$row['id']??0]))throw new Vz2Error('Tento začátek už má jiný konec.',409);
                    $affected[]=$pair;
                }
            }
            if($parent){$p=vz2_one($db,'SELECT * FROM vz2_timestamps WHERE id=?',[$parent]);if((int)$p['recording_id']!==$id || $p['kind']!=='song_start')throw new Vz2Error('Pasáž musí patřit pokusu ve stejné nahrávce.');}
            $values=[$kind,$time,$body,$pair,$endMs,$type,$note,$song,$parent,vz2_actor()];
            if($creating){
                vz2_query($db,'INSERT INTO vz2_timestamps(kind,time_ms,body,paired_timestamp_id,end_time_ms,passage_type,note_text,song_collection_id,parent_timestamp_id,updated_by,recording_id,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())',array_merge($values,[$id,vz2_actor()]));$timestampId=(int)$db->insert_id;
            }else{
                $timestampId=(int)$row['id'];vz2_query($db,'UPDATE vz2_timestamps SET kind=?,time_ms=?,body=?,paired_timestamp_id=?,end_time_ms=?,passage_type=?,note_text=?,song_collection_id=?,parent_timestamp_id=?,updated_by=?,revision=revision+1,updated_at=UTC_TIMESTAMP() WHERE id=?',array_merge($values,[$timestampId]));
            }
            if($kind==='song_start')$affected[]=$timestampId;
            if($interval && $kind==='song_start' && array_key_exists('end_time_ms',$in)){
                $ends=vz2_rows($db,'SELECT * FROM vz2_timestamps WHERE paired_timestamp_id=? FOR UPDATE',[$timestampId]);$end=$ends[0]??null;
                if($end)vz2_permission('comment',(int)$end['created_by']);
                if($in['end_time_ms']!==null){
                    $endTime=vz2_timestamp_ms($in['end_time_ms'],$recording);
                    if($endTime<=$time)throw new Vz2Error('Konec pokusu musí být po začátku.');
                    if($end)vz2_query($db,'UPDATE vz2_timestamps SET time_ms=?,revision=revision+1,updated_by=?,updated_at=UTC_TIMESTAMP() WHERE id=?',[$endTime,vz2_actor(),$end['id']]);
                    else vz2_query($db,"INSERT INTO vz2_timestamps(recording_id,kind,time_ms,body,paired_timestamp_id,created_by,updated_by,created_at,updated_at) VALUES (?,'song_end',?,'↓',?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())",[$id,$endTime,$timestampId,vz2_actor(),vz2_actor()]);
                }elseif($end){
                    if(vz2_rows($db,'SELECT id FROM vz2_rehearsal_plays WHERE end_timestamp_id=?',[$end['id']]))throw new Vz2Error('Pokus v historii musí mít konec. Nejprve odeberte příslušný pokus.',409);
                    vz2_query($db,'DELETE FROM vz2_timestamps WHERE id=?',[$end['id']]);
                }
            }
        }
        vz2_timestamp_validate_graph($db,$recording);
        foreach(array_unique($affected) as $startId)vz2_timestamp_sync_history($db,$recording,$startId);
        vz2_query($db,'UPDATE vz2_recordings SET timestamps_revision=timestamps_revision+1 WHERE id=?',[$id]);
        vz2_log($db,'timestamp.'.($deleting?'deleted':($creating?'created':'updated')),'timestamp',$timestampId,$recording['title'],'Nahrávka #'.$id.'; '.$kind.' @ '.$time.' ms');
        return vz2_timestamp_list($db,$id);
    });
}
