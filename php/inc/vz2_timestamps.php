<?php
declare(strict_types=1);
require_once __DIR__.'/vz2_core.php';
require_once __DIR__.'/vz2_timestamp_intervals.php';

function vz2_timestamp_right(?int $owner = null): bool {
    return defined('VZ2_WRITES_ENABLED') && VZ2_WRITES_ENABLED === true
        && !empty($_SESSION['user_id']) && ($_SESSION['role'] ?? '') !== 'host'
        && (auth_is_admin() || (ma_pravo('comment') && ($owner === null || $owner === vz2_actor())));
}

function vz2_timestamp_entries(mysqli $db, array $recording): array {
    $rows = vz2_rows($db, 'SELECT t.*,u.name author,e.name editor,p.song_title_snapshot history_song_title,s.title song_title FROM vz2_timestamps t JOIN users u ON u.id=t.created_by JOIN users e ON e.id=t.updated_by LEFT JOIN vz2_rehearsal_plays p ON p.start_timestamp_id=t.id LEFT JOIN vz2_collections s ON s.id=t.song_collection_id WHERE t.recording_id=? ORDER BY t.time_ms,t.id', [$recording['id']]);
    foreach ($rows as &$row) {
        foreach (['id','recording_id','time_ms','revision','created_by','updated_by'] as $key) $row[$key] = (int)$row[$key];
        foreach (['paired_timestamp_id','end_time_ms','song_collection_id','parent_timestamp_id'] as $key) $row[$key] = $row[$key] === null ? null : (int)$row[$key];
        $row['can_edit'] = $row['can_delete'] = $recording['lifecycle'] === 'active' && vz2_timestamp_right($row['created_by']);
    }
    unset($row);
    return $rows;
}

// Caller holds either a consistent read snapshot or the recording write lock.
function vz2_timestamp_list(mysqli $db, int $id): array {
    $r = vz2_one($db, 'SELECT id,collection_id,title,summary,duration_ms,timestamps_revision,lifecycle FROM vz2_recordings WHERE id=?', [$id]);
    $audio = vz2_rows($db, 'SELECT original_name FROM vz2_audio_files WHERE recording_id=? ORDER BY sort_order,id LIMIT 1', [$id]);
    $entries=vz2_timestamp_entries($db,$r);
    $songs=vz2_rows($db,"SELECT id,title,lifecycle FROM vz2_collections WHERE kind='song' AND lifecycle IN ('active','archived') ORDER BY title,id");
    foreach($songs as &$song)$song['id']=(int)$song['id'];unset($song);
    $collection=vz2_one($db,'SELECT id,kind FROM vz2_collections WHERE id=?',[$r['collection_id']]);
    return ['annotation_version'=>1,'annotations'=>vz2_timestamp_annotations($r,$entries),'songs'=>$songs,
        'default_song_id'=>$collection['kind']==='song'?(int)$collection['id']:null,
        'recording_id'=>$id, 'title'=>$r['title'], 'summary'=>$r['summary'],
        'source_filename'=>$audio ? $audio[0]['original_name'] : null,
        'duration_ms'=>$r['duration_ms'] === null ? null : (int)$r['duration_ms'],
        'timestamps_revision'=>(int)$r['timestamps_revision'], 'can_create'=>$r['lifecycle'] === 'active' && vz2_timestamp_right(), 'entries'=>$entries];
}

function vz2_timestamp_read(int $id): array {
    $db = vz2_db();
    $db->begin_transaction(MYSQLI_TRANS_START_READ_ONLY | MYSQLI_TRANS_START_WITH_CONSISTENT_SNAPSHOT);
    try { $result = vz2_timestamp_list($db, $id); $db->commit(); return $result; }
    catch (Throwable $e) { $db->rollback(); throw $e; }
}

function vz2_timestamp_write(array $in): array { return vz2_timestamp_mutate($in); }

function vz2_timestamp_time(int $ms): string {
    return sprintf('%02d:%02d', intdiv(max(0, $ms),60000), intdiv(max(0, $ms),1000)%60);
}
function vz2_timestamp_export(array $list): string {
    $text = 'Nahrávka #'.$list['recording_id'].' — '.(($list['source_filename'] ?? null) ?: $list['title'])."\nExport: ".gmdate('Y-m-d\TH:i:s\Z').($list['title']!==''?"\nPopisek: ".$list['title']:'')."\n\nSouhrn:\n".($list['summary'] ?? '')."\n\nČasové zápisy:\n";
    $kinds=['take'=>'Pokus','passage'=>'Pasáž','note'=>'Poznámka','boundary'=>'Konec bez začátku'];
    foreach(vz2_timestamp_annotations($list,$list['entries']) as $item){
        $range=vz2_timestamp_time($item['start_ms']).($item['end_ms']!==null?' – '.vz2_timestamp_time($item['end_ms']):'');
        $text.=$range.' · '.$kinds[$item['kind']].' · '.$item['source']['author'].' [#'.$item['source']['created_by']."]\n".$item['label'];
        if($item['song_title']!=='')$text.=' · '.$item['song_title'];
        if($item['status']==='open')$text.=' · Doplnit konec';
        if($item['passage_type'])$text.=' · '.vz2_passage_types()[$item['passage_type']];
        if($item['note_text']!=='')$text.="\n".$item['note_text'];
        if($item['end_source']){
            $end=$item['end_source'];$endBody=trim($end['body']);
            if(!in_array($endBody,['','↓','↑'],true))$text.="\nKonec: ".$endBody;
            $text.="\nAutor konce: ".$end['author'].' [#'.$end['created_by'].']';
        }
        $text.="\n\n";
    }
    return $text;
}

function vz2_song_intervals_export(array $list): string {
    $complete=[];$incomplete=[];
    foreach(vz2_timestamp_annotations($list,$list['entries']) as $item){
        if($item['kind']==='take' && $item['status']==='complete')$complete[]=['start'=>$item['start_ms'],'end'=>$item['end_ms'],'name'=>$item['song_title']?:'neurčená skladba','start_id'=>$item['timestamp_id'],'end_id'=>$item['end_timestamp_id']];
        elseif($item['kind']==='take')$incomplete[]='Začátek bez konce: '.vz2_timestamp_time($item['start_ms']).' (#'.$item['timestamp_id'].')';
        elseif($item['kind']==='boundary')$incomplete[]='Konec bez začátku: '.vz2_timestamp_time($item['start_ms']).' (#'.$item['timestamp_id'].')';
    }
    usort($complete,fn($a,$b)=>$a['start']<=>$b['start']);
    $text='Původní nahrávka: '.$list['title'].' (#'.$list['recording_id'].")\n\nKompletní úseky:\n";
    foreach($complete as $i)$text.=$i['name'].' | '.vz2_timestamp_time($i['start']).' – '.vz2_timestamp_time($i['end']).' | značky #'.$i['start_id'].'/#'.$i['end_id']."\n";
    $text.="\nNeúplné značky:\n".($incomplete?implode("\n",$incomplete):'žádné')."\n";
    return $text;
}
