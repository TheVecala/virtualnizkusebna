<?php
declare(strict_types=1);
require_once __DIR__.'/vz2_core.php';

function vz2_timestamp_right(?int $owner = null): bool {
    return defined('VZ2_WRITES_ENABLED') && VZ2_WRITES_ENABLED === true
        && !empty($_SESSION['user_id']) && ($_SESSION['role'] ?? '') !== 'host'
        && (auth_is_admin() || (ma_pravo('comment') && ($owner === null || $owner === vz2_actor())));
}

function vz2_timestamp_entries(mysqli $db, array $recording): array {
    $rows = vz2_rows($db, 'SELECT t.*,u.name author,e.name editor FROM vz2_timestamps t JOIN users u ON u.id=t.created_by JOIN users e ON e.id=t.updated_by WHERE t.recording_id=? ORDER BY t.time_ms,t.id', [$recording['id']]);
    foreach ($rows as &$row) {
        foreach (['id','recording_id','time_ms','revision','created_by','updated_by'] as $key) $row[$key] = (int)$row[$key];
        $row['can_edit'] = $row['can_delete'] = $recording['lifecycle'] === 'active' && vz2_timestamp_right($row['created_by']);
    }
    unset($row);
    return $rows;
}

// Caller holds either a consistent read snapshot or the recording write lock.
function vz2_timestamp_list(mysqli $db, int $id): array {
    $r = vz2_one($db, 'SELECT id,title,summary,duration_ms,timestamps_revision,lifecycle FROM vz2_recordings WHERE id=?', [$id]);
    return ['recording_id'=>$id, 'title'=>$r['title'], 'summary'=>$r['summary'],
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
            if (!in_array($kind, ['song_start','passage','note'], true)) throw new Vz2Error('Neplatný typ zápisu.');
            $body = vz2_text($in['body'] ?? null, 4000);
        }
        if ($action === 'create') {
            vz2_query($db, 'INSERT INTO vz2_timestamps(recording_id,kind,time_ms,body,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())', [$id,$kind,$time,$body,vz2_actor(),vz2_actor()]);
            $timestampId = (int)$db->insert_id;
        } else {
            $timestampId = (int)$row['id'];
            if ($action === 'delete') vz2_query($db, 'DELETE FROM vz2_timestamps WHERE id=?', [$timestampId]);
            else vz2_query($db, 'UPDATE vz2_timestamps SET kind=?,time_ms=?,body=?,revision=revision+1,updated_by=?,updated_at=UTC_TIMESTAMP() WHERE id=?', [$kind,$time,$body,vz2_actor(),$timestampId]);
        }
        vz2_query($db, 'UPDATE vz2_recordings SET timestamps_revision=timestamps_revision+1 WHERE id=?', [$id]);
        $verb = ['create'=>'created','update'=>'updated','delete'=>'deleted'][$action];
        vz2_log($db, 'timestamp.'.$verb, 'timestamp', $timestampId, $recording['title'], 'Nahrávka #'.$id.'; '.($kind ?? $row['kind']).' @ '.($time ?? $row['time_ms']).' ms');
        return vz2_timestamp_list($db, $id);
    });
}

function vz2_timestamp_time(int $ms): string {
    return sprintf('%02d:%02d:%02d.%03d', intdiv($ms,3600000), intdiv($ms,60000)%60, intdiv($ms,1000)%60, $ms%1000);
}
function vz2_timestamp_export(array $list): string {
    $text = 'Nahrávka #'.$list['recording_id'].' — '.$list['title']."\nExport: ".gmdate('Y-m-d\TH:i:s\Z')."\n\nSouhrn:\n".($list['summary'] ?? '')."\n\nČasové zápisy:\n";
    $kinds = ['song_start'=>'Začátek skladby','passage'=>'Pasáž','note'=>'Poznámka'];
    foreach ($list['entries'] as $row) $text .= vz2_timestamp_time($row['time_ms']).' ('.$row['time_ms'].' ms) · '.$kinds[$row['kind']].' · '.$row['author'].' [#'.$row['created_by']."]\n".$row['body']."\n\n";
    return $text;
}
