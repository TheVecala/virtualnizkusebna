<?php
declare(strict_types=1);

final class Vz2Error extends RuntimeException {
    public int $status;
    public function __construct(string $message, int $status = 400) {
        parent::__construct($message);
        $this->status = $status;
    }
}

function vz2_enabled(): bool { return defined('VZ2_ENABLED') && VZ2_ENABLED === true; }
function vz2_ready(bool $write = false): void {
    if (!vz2_enabled()) throw new Vz2Error('VZ2 zatím není zapnutá.', 503);
    if (!defined('VZ2_ENVIRONMENT') || !in_array(VZ2_ENVIRONMENT, ['alpha', 'beta'], true)
        || !defined('VZ2_DATASET_KEY') || !preg_match('/\A[a-zA-Z0-9_-]{8,80}\z/', VZ2_DATASET_KEY)) {
        throw new Vz2Error('Chybí platná konfigurace prostředí VZ2.', 503);
    }
    if ($write && (!defined('VZ2_WRITES_ENABLED') || VZ2_WRITES_ENABLED !== true)) {
        throw new Vz2Error('Toto prostředí je nyní pouze pro čtení.', 403);
    }
}
function vz2_login(): void {
    auth_refresh_session();
    if (($_SESSION['logged_in_single'] ?? false) !== true
        || !in_array($_SESSION['role'] ?? '', ['admin', 'muzikant', 'host'], true)) {
        throw new Vz2Error('Přihlaste se znovu.', 401);
    }
}
function vz2_db(): mysqli {
    $db = auth_db();
    $db->query("SET time_zone = '+00:00'");
    return $db;
}
function vz2_query(mysqli $db, string $sql, array $params = []): mysqli_stmt {
    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    return $stmt;
}
function vz2_rows(mysqli $db, string $sql, array $params = []): array {
    return vz2_query($db, $sql, $params)->get_result()->fetch_all(MYSQLI_ASSOC);
}
function vz2_one(mysqli $db, string $sql, array $params = []): array {
    $row = vz2_query($db, $sql, $params)->get_result()->fetch_assoc();
    if (!$row) throw new Vz2Error('Položka již neexistuje.', 404);
    return $row;
}
function vz2_id($value): int {
    if ((!is_string($value) && !is_int($value)) || !preg_match('/\A[1-9][0-9]{0,9}\z/', (string)$value)
        || (int)$value > 4294967295) throw new Vz2Error('Neplatné ID nebo revize.');
    return (int)$value;
}
function vz2_text($value, int $limit = 200, bool $empty = false): string {
    if (!is_string($value) || preg_match('//u', $value) !== 1) throw new Vz2Error('Neplatný text.');
    $value = trim($value);
    if ((!$empty && $value === '') || preg_match_all('/./us', $value) > $limit) throw new Vz2Error('Text je prázdný nebo příliš dlouhý.');
    return $value;
}
function vz2_actor(): int { return vz2_id($_SESSION['user_id'] ?? null); }
function vz2_permission(string $right, ?int $owner = null): void {
    if (empty($_SESSION['user_id']) || ($_SESSION['role'] ?? '') === 'host') throw new Vz2Error('Host nemůže měnit obsah.', 403);
    if (auth_is_admin()) return;
    if (!ma_pravo($right) || ($owner !== null && $owner !== vz2_actor())) throw new Vz2Error('Tuto položku nemáte právo měnit.', 403);
}
function vz2_revision(array $row, $expected, string $field = 'revision'): void {
    if ((int)$row[$field] !== vz2_id($expected)) throw new Vz2Error('Položku mezitím někdo změnil. Obnovte ji; rozepsaný text zůstává zachován.', 409);
}
function vz2_active(array $row): void {
    if (($row['lifecycle'] ?? 'active') !== 'active') throw new Vz2Error('Položka má rozpracovanou operaci.', 409);
}
function vz2_write(callable $fn) {
    vz2_ready(true);
    $db = vz2_db();
    $db->begin_transaction();
    try {
        auth_settings($db, true);
        vz2_login();
        if (empty($_SESSION['user_id'])) throw new Vz2Error('Zápis vyžaduje osobní účet.', 403);
        // A small single-band application: serialize short catalog writes in a fixed order.
        $db->query('SELECT kind FROM vz2_collection_orders ORDER BY kind FOR UPDATE');
        $result = $fn($db);
        $db->commit();
        return $result;
    } catch (Throwable $e) { $db->rollback(); throw $e; }
}
function vz2_log(mysqli $db, string $action, string $type, int $id, string $title, string $detail = '', ?int $operation = null, ?int $actor = null): void {
    $actor = $actor ?? vz2_actor();
    $user = vz2_one($db, 'SELECT name FROM users WHERE id=?', [$actor]);
    vz2_query($db, 'INSERT INTO vz2_activity_log (actor_id,actor_name,occurred_at,environment,action,target_type,target_id,target_title,detail,operation_id) VALUES (?,?,UTC_TIMESTAMP(),?,?,?,?,?,?,?)',
        [$actor, $user['name'], VZ2_ENVIRONMENT, $action, $type, $id, $title, $detail, $operation]);
}
function vz2_slug(string $name, int $limit = 60): string {
    $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $name);
    return trim(substr(strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $ascii === false ? '' : $ascii)), 0, $limit), '-') ?: 'polozka';
}
function vz2_collection(mysqli $db, int $id): array {
    return vz2_one($db, 'SELECT * FROM vz2_collections WHERE id=? FOR UPDATE', [$id]);
}
function vz2_recording(mysqli $db, int $id): array {
    $r = vz2_one($db, 'SELECT * FROM vz2_recordings WHERE id=? FOR UPDATE', [$id]);
    vz2_active(vz2_collection($db, (int)$r['collection_id']));
    return $r;
}
function vz2_idle(mysqli $db, string $type, int $id): void {
    if (vz2_rows($db, "SELECT id FROM vz2_file_operations WHERE target_type=? AND target_id=? AND state<>'completed'", [$type, $id])) {
        throw new Vz2Error('Nejdříve dokončete rozpracovanou souborovou operaci.', 409);
    }
}
function vz2_mutate(array $in): array {
    return vz2_write(function(mysqli $db) use ($in): array {
        $action = $in['action'] ?? '';
        if ($action === 'collection_create') {
            vz2_permission('create_val');
            $title = vz2_text($in['title'] ?? null);
            $kind = $in['kind'] ?? '';
            if (!in_array($kind, ['song','rehearsal'], true)) throw new Vz2Error('Neplatný druh celku.');
            $order = (int)vz2_one($db, 'SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM vz2_collections WHERE kind=?', [$kind])['n'];
            vz2_query($db, 'INSERT INTO vz2_collections (kind,title,storage_slug,sort_order,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())', [$kind,$title,vz2_slug($title,80),$order,vz2_actor(),vz2_actor()]);
            $id = (int)$db->insert_id;
            vz2_query($db, 'INSERT INTO vz2_discussion_threads(collection_id) VALUES (?)', [$id]);
            vz2_query($db, 'UPDATE vz2_collection_orders SET revision=revision+1 WHERE kind=?', [$kind]);
            vz2_log($db,'collection.created','collection',$id,$title);
            return ['id'=>$id,'revision'=>1];
        }
        if ($action === 'collection_rename') {
            $r = vz2_collection($db, vz2_id($in['id'] ?? null)); vz2_active($r);
            vz2_permission('rename_val',(int)$r['created_by']); vz2_revision($r,$in['revision'] ?? null);
            $title = vz2_text($in['title'] ?? null);
            vz2_query($db,'UPDATE vz2_collections SET title=?,revision=revision+1,updated_by=?,updated_at=UTC_TIMESTAMP() WHERE id=?',[$title,vz2_actor(),$r['id']]);
            vz2_log($db,'collection.renamed','collection',(int)$r['id'],$title,'Původní název: '.$r['title']);
            return ['id'=>(int)$r['id'],'revision'=>(int)$r['revision']+1];
        }
        if ($action === 'reorder') return vz2_reorder($db,$in);
        if (in_array($action,['recording_update','recording_move','attachment_update','attachment_move','track_update'],true)) {
            $attachment = str_starts_with($action,'attachment_');
            $table = $attachment ? 'vz2_attachments' : 'vz2_recordings';
            $type = $attachment ? 'attachment' : 'recording';
            $id = vz2_id($in['id'] ?? null);
            $r = $attachment ? vz2_one($db,"SELECT * FROM $table WHERE id=? FOR UPDATE",[$id]) : vz2_recording($db,$id);
            vz2_active(vz2_collection($db,(int)$r['collection_id'])); vz2_active($r); vz2_idle($db,$type,$id);
            $move = str_ends_with($action,'_move');
            vz2_permission($move?'move_file':'edit_recording_label',(int)$r['created_by']); vz2_revision($r,$in['revision'] ?? null);
            if ($move) {
                $target = vz2_collection($db,vz2_id($in['collection_id'] ?? null)); vz2_active($target);
                vz2_query($db,"UPDATE $table SET collection_id=?,revision=revision+1,updated_by=?,updated_at=UTC_TIMESTAMP() WHERE id=?",[$target['id'],vz2_actor(),$id]);
                if (!$attachment) vz2_query($db,'UPDATE vz2_collections SET recordings_revision=recordings_revision+1 WHERE id IN (?,?)',[$r['collection_id'],$target['id']]);
                vz2_log($db,$type.'.moved',$type,$id,$r['title'],'Z kolekce #'.$r['collection_id'].' do #'.$target['id'].' '.$target['title']);
            } elseif ($action === 'track_update') {
                $file = vz2_one($db,'SELECT * FROM vz2_audio_files WHERE id=? AND recording_id=?',[vz2_id($in['file_id'] ?? null),$id]);
                $title = vz2_text($in['title'] ?? null);
                vz2_query($db,'UPDATE vz2_audio_files SET title=?,revision=revision+1,updated_by=?,updated_at=UTC_TIMESTAMP() WHERE id=?',[$title,vz2_actor(),$file['id']]);
                vz2_query($db,'UPDATE vz2_recordings SET revision=revision+1,updated_by=?,updated_at=UTC_TIMESTAMP() WHERE id=?',[vz2_actor(),$id]);
                vz2_log($db,'audio.renamed','audio',(int)$file['id'],$title,'Nahrávka #'.$id.'; původně '.$file['title']);
            } else {
                $title = vz2_text($in['title'] ?? null);
                $summary = vz2_text($in['summary'] ?? '',10000,true);
                $author = $r['summary_created_by'] ?? ($summary === '' ? null : vz2_actor());
                $created = $r['summary_created_at'] ?? ($author === null ? null : gmdate('Y-m-d H:i:s'));
                $changed = $summary !== ($r['summary'] ?? '');
                $editor = $changed ? vz2_actor() : ($r['summary_updated_by'] ?? null);
                $edited = $changed ? gmdate('Y-m-d H:i:s') : ($r['summary_updated_at'] ?? null);
                vz2_query($db,"UPDATE $table SET title=?,summary=?,summary_created_by=?,summary_created_at=?,summary_updated_by=?,summary_updated_at=?,revision=revision+1,updated_by=?,updated_at=UTC_TIMESTAMP() WHERE id=?",[$title,$author===null?null:$summary,$author,$created,$editor,$edited,vz2_actor(),$id]);
                vz2_log($db,$type.'.updated',$type,$id,$title,'Revize '.((int)$r['revision']+1).'; původní název: '.$r['title']);
            }
            return ['id'=>$id,'revision'=>(int)$r['revision']+1];
        }
        throw new Vz2Error('Neznámá operace.');
    });
}
function vz2_reorder(mysqli $db, array $in): array {
    vz2_permission('reorder');
    $scope = $in['scope'] ?? '';
    if ($scope === 'collections') {
        $kind = $in['kind'] ?? '';
        if (!in_array($kind,['song','rehearsal'],true)) throw new Vz2Error('Neplatný seznam.');
        $parent = vz2_one($db,'SELECT * FROM vz2_collection_orders WHERE kind=?',[$kind]);
        vz2_revision($parent,$in['revision'] ?? null);
        $rows = vz2_rows($db,'SELECT id FROM vz2_collections WHERE kind=?',[$kind]);
        $table='vz2_collections'; $title=$kind; $id= $kind==='song'?1:2;
    } elseif ($scope === 'recordings') {
        $id=vz2_id($in['collection_id']??null); $parent=vz2_collection($db,$id); vz2_active($parent);
        vz2_revision($parent,$in['revision']??null,'recordings_revision');
        $rows=vz2_rows($db,'SELECT id FROM vz2_recordings WHERE collection_id=?',[$id]);
        $table='vz2_recordings'; $title=$parent['title'];
    } elseif ($scope === 'tracks') {
        $id=vz2_id($in['recording_id']??null); $parent=vz2_recording($db,$id); vz2_active($parent); vz2_idle($db,'recording',$id);
        vz2_permission('reorder',(int)$parent['created_by']); vz2_revision($parent,$in['revision']??null);
        $rows=vz2_rows($db,'SELECT id FROM vz2_audio_files WHERE recording_id=?',[$id]);
        $table='vz2_audio_files'; $title=$parent['title'];
    } else throw new Vz2Error('Neplatný seznam.');
    if (!isset($in['ids']) || !is_array($in['ids'])) throw new Vz2Error('Chybí pořadí.');
    $ids=array_map('vz2_id',$in['ids']); $actual=array_map('intval',array_column($rows,'id')); $sorted=$ids; sort($sorted); sort($actual);
    if ($sorted!==$actual || count(array_unique($ids))!==count($ids)) throw new Vz2Error('Seznam se změnil nebo obsahuje nesprávná ID.',409);
    foreach ($ids as $position=>$child) vz2_query($db,"UPDATE $table SET sort_order=? WHERE id=?",[$position,$child]);
    if ($scope==='collections') vz2_query($db,'UPDATE vz2_collection_orders SET revision=revision+1 WHERE kind=?',[$kind]);
    elseif ($scope==='recordings') vz2_query($db,'UPDATE vz2_collections SET recordings_revision=recordings_revision+1 WHERE id=?',[$id]);
    else vz2_query($db,'UPDATE vz2_recordings SET revision=revision+1,updated_by=?,updated_at=UTC_TIMESTAMP() WHERE id=?',[vz2_actor(),$id]);
    vz2_log($db,$scope.'.reordered',$scope,$id,$title,'Položek: '.count($ids));
    return ['id'=>$id];
}
