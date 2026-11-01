<?php
declare(strict_types=1);
require_once __DIR__.'/vz2_core.php';

function vz2_timestamp_right(?int $owner = null): bool {
    return defined('VZ2_WRITES_ENABLED') && VZ2_WRITES_ENABLED === true
        && !empty($_SESSION['user_id']) && ($_SESSION['role'] ?? '') !== 'host'
        && (auth_is_admin() || (ma_pravo('comment') && ($owner === null || $owner === vz2_actor())));
}

function vz2_timestamp_entries(mysqli $db, array $recording): array {
    $rows = vz2_rows($db, 'SELECT t.*,u.name author,e.name editor,p.song_title_snapshot history_song_title FROM vz2_timestamps t JOIN users u ON u.id=t.created_by JOIN users e ON e.id=t.updated_by LEFT JOIN vz2_rehearsal_plays p ON p.start_timestamp_id=t.id WHERE t.recording_id=? ORDER BY t.time_ms,t.id', [$recording['id']]);
    foreach ($rows as &$row) {
        foreach (['id','recording_id','time_ms','revision','created_by','updated_by'] as $key) $row[$key] = (int)$row[$key];
        $row['paired_timestamp_id'] = $row['paired_timestamp_id'] === null ? null : (int)$row['paired_timestamp_id'];
        $row['can_edit'] = $row['can_delete'] = $recording['lifecycle'] === 'active' && vz2_timestamp_right($row['created_by']);
    }
    unset($row);
    return $rows;
}

// Caller holds either a consistent read snapshot or the recording write lock.
function vz2_timestamp_list(mysqli $db, int $id): array {
    $r = vz2_one($db, 'SELECT id,title,summary,duration_ms,timestamps_revision,lifecycle FROM vz2_recordings WHERE id=?', [$id]);
    $audio = vz2_rows($db, 'SELECT original_name FROM vz2_audio_files WHERE recording_id=? ORDER BY sort_order,id LIMIT 1', [$id]);
    return ['recording_id'=>$id, 'title'=>$r['title'], 'summary'=>$r['summary'],
        'source_filename'=>$audio ? $audio[0]['original_name'] : null,
        'duration_ms'=>$r['duration_ms'] === null ? null : (int)$r['duration_ms'],
        'timestamps_revision'=>(int)$r['timestamps_revision'], 'can_create'=>$r['lifecycle'] === 'active' && vz2_timestamp_right(), 'entries'=>vz2_timestamp_entries($db, $r)];
}

function vz2_timestamp_read(int $id): array {
    $db = vz2_db();
    $db->begin_transaction(MYSQLI_TRANS_START_READ_ONLY | MYSQLI_TRANS_START_WITH_CONSISTENT_SNAPSHOT);
    try { $result = vz2_timestamp_list($db, $id); $db->commit(); return $result; }
    catch (Throwable $e) { $db->rollback(); throw $e; }
}

function vz2_timestamp_write(array $in): array {
    return vz2_write(function(mysqli $db) use ($in): array {
        $action = $in['action'] ?? '';
        if (!in_array($action, ['create','update','delete'], true)) throw new Vz2Error('Neznámá operace.');
        $id = vz2_id($in['recording_id'] ?? null);
        $recording = vz2_recording($db, $id); vz2_active($recording); vz2_idle($db, 'recording', $id);
        vz2_permission('comment');
        $row = null;
        if ($action !== 'create') {
            $row = vz2_one($db, 'SELECT * FROM vz2_timestamps WHERE id=? AND recording_id=? FOR UPDATE', [vz2_id($in['id'] ?? null), $id]);
            vz2_permission('comment', (int)$row['created_by']);
            vz2_revision($row, $in['revision'] ?? null);
        }
        vz2_revision($recording, $in['timestamps_revision'] ?? null, 'timestamps_revision');
        if ($action !== 'delete') {
            $time = $in['time_ms'] ?? null;
            if (!is_int($time) || $time < 0 || $time > 604800000
                || ($recording['duration_ms'] !== null && $time > (int)$recording['duration_ms'])) throw new Vz2Error('Čas musí být celé milisekundy v rozsahu nahrávky (nejvýše 7 dní).');
            $kind = $in['kind'] ?? '';
            if (!in_array($kind, ['song_start','song_end','passage','note'], true)) throw new Vz2Error('Neplatný typ zápisu.');
            $body = vz2_text($in['body'] ?? null, 4000);
            $pair = null;
            if ($kind === 'song_end') {
                if (array_key_exists('paired_timestamp_id', $in) && $in['paired_timestamp_id'] !== null && $in['paired_timestamp_id'] !== '') {
                    $pair = vz2_id($in['paired_timestamp_id']);
                    $start = vz2_one($db, 'SELECT * FROM vz2_timestamps WHERE id=? FOR UPDATE', [$pair]);
                    if ((int)$start['recording_id'] !== $id || $start['kind'] !== 'song_start' || (int)$start['time_ms'] >= $time) throw new Vz2Error('Začátek musí být ve stejné nahrávce a před koncem.');
                    $used = vz2_rows($db, 'SELECT id FROM vz2_timestamps WHERE paired_timestamp_id=? AND id<>?', [$pair, $row['id'] ?? 0]);
                    if ($used) throw new Vz2Error('Tento začátek už má jiný konec.', 409);
                } elseif ($action === 'create' && !array_key_exists('paired_timestamp_id', $in)) {
                    $candidates = vz2_rows($db, "SELECT s.id FROM vz2_timestamps s LEFT JOIN vz2_timestamps e ON e.paired_timestamp_id=s.id WHERE s.recording_id=? AND s.kind='song_start' AND s.time_ms<? AND e.id IS NULL ORDER BY s.time_ms DESC,s.id DESC", [$id,$time]);
                    if (count($candidates) === 1) $pair = (int)$candidates[0]['id'];
                } elseif ($action === 'update' && $row['kind'] === 'song_end' && !array_key_exists('paired_timestamp_id', $in)) $pair = $row['paired_timestamp_id'] === null ? null : (int)$row['paired_timestamp_id'];
            }
            if ($action === 'update' && $kind === 'song_start') {
                $linked = vz2_rows($db, 'SELECT id,time_ms FROM vz2_timestamps WHERE paired_timestamp_id=? FOR UPDATE', [(int)$row['id']]);
                if ($linked && (int)$linked[0]['time_ms'] <= $time) throw new Vz2Error('Začátek musí zůstat před propojeným koncem.');
            }
        }
        if ($action === 'create') {
            vz2_query($db, 'INSERT INTO vz2_timestamps(recording_id,kind,time_ms,body,paired_timestamp_id,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())', [$id,$kind,$time,$body,$pair,vz2_actor(),vz2_actor()]);
            $timestampId = (int)$db->insert_id;
        } else {
            $timestampId = (int)$row['id'];
            if ($action === 'delete') {
                $history = vz2_rows($db, 'SELECT id FROM vz2_rehearsal_plays WHERE start_timestamp_id=? OR end_timestamp_id=?', [$timestampId,$timestampId]);
                if ($history) throw new Vz2Error('Značka je součástí historie. Nejprve odeberte příslušný pokus.',409);
                vz2_query($db, 'UPDATE vz2_timestamps SET paired_timestamp_id=NULL,revision=revision+1,updated_by=?,updated_at=UTC_TIMESTAMP() WHERE paired_timestamp_id=?', [vz2_actor(),$timestampId]);
                vz2_query($db, 'DELETE FROM vz2_timestamps WHERE id=?', [$timestampId]);
            } else vz2_query($db, 'UPDATE vz2_timestamps SET kind=?,time_ms=?,body=?,paired_timestamp_id=?,revision=revision+1,updated_by=?,updated_at=UTC_TIMESTAMP() WHERE id=?', [$kind,$time,$body,$kind === 'song_end' ? $pair : null,vz2_actor(),$timestampId]);
        }
        vz2_query($db, 'UPDATE vz2_recordings SET timestamps_revision=timestamps_revision+1 WHERE id=?', [$id]);
        $verb = ['create'=>'created','update'=>'updated','delete'=>'deleted'][$action];
        vz2_log($db, 'timestamp.'.$verb, 'timestamp', $timestampId, $recording['title'], 'Nahrávka #'.$id.'; '.($kind ?? $row['kind']).' @ '.($time ?? $row['time_ms']).' ms');
        return vz2_timestamp_list($db, $id);
    });
}

function vz2_timestamp_time(int $ms): string {
    return sprintf('%02d:%02d', intdiv(max(0, $ms),60000), intdiv(max(0, $ms),1000)%60);
}
function vz2_timestamp_export(array $list): string {
    $text = 'Nahrávka #'.$list['recording_id'].' — '.(($list['source_filename'] ?? null) ?: $list['title'])."\nExport: ".gmdate('Y-m-d\TH:i:s\Z').($list['title']!==''?"\nPopisek: ".$list['title']:'')."\n\nSouhrn:\n".($list['summary'] ?? '')."\n\nČasové zápisy:\n";
    $kinds = ['song_start'=>'Začátek skladby','song_end'=>'Konec skladby','passage'=>'Pasáž','note'=>'Poznámka'];
    foreach ($list['entries'] as $row) $text .= vz2_timestamp_time($row['time_ms']).' · '.$kinds[$row['kind']].' · '.$row['author'].' [#'.$row['created_by']."]\n".$row['body']."\n\n";
    return $text;
}

function vz2_song_intervals_export(array $list): string {
    $byId=[]; foreach ($list['entries'] as $row) $byId[$row['id']]=$row;
    $complete=[];$incomplete=[];
    foreach ($list['entries'] as $row) {
        if ($row['kind']==='song_end' && $row['paired_timestamp_id'] && isset($byId[$row['paired_timestamp_id']])) {
            $start=$byId[$row['paired_timestamp_id']];
            $complete[]=['start'=>$start['time_ms'],'end'=>$row['time_ms'],'name'=>($start['history_song_title']??null)?:'neurčená skladba','start_id'=>$start['id'],'end_id'=>$row['id']];
        } elseif ($row['kind']==='song_start' && !array_filter($list['entries'],fn($e)=>$e['kind']==='song_end' && $e['paired_timestamp_id']===$row['id'])) $incomplete[]='Začátek bez konce: '.vz2_timestamp_time($row['time_ms']).' (#'.$row['id'].')';
        elseif ($row['kind']==='song_end' && !$row['paired_timestamp_id']) $incomplete[]='Konec bez začátku: '.vz2_timestamp_time($row['time_ms']).' (#'.$row['id'].')';
    }
    usort($complete,fn($a,$b)=>$a['start']<=>$b['start']);
    $text='Původní nahrávka: '.$list['title'].' (#'.$list['recording_id'].")\n\nKompletní úseky:\n";
    foreach($complete as $i)$text.=$i['name'].' | '.vz2_timestamp_time($i['start']).' – '.vz2_timestamp_time($i['end']).' | značky #'.$i['start_id'].'/#'.$i['end_id']."\n";
    $text.="\nNeúplné značky:\n".($incomplete?implode("\n",$incomplete):'žádné')."\n";
    return $text;
}
