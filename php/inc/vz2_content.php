<?php
declare(strict_types=1);
require_once __DIR__.'/vz2_core.php';

function vz2_content_right(string $right, ?int $owner = null): bool {
    return defined('VZ2_WRITES_ENABLED') && VZ2_WRITES_ENABLED === true
        && !empty($_SESSION['user_id']) && ($_SESSION['role'] ?? '') !== 'host'
        && (auth_is_admin() || (ma_pravo($right) && ($owner === null || $owner === vz2_actor())));
}
function vz2_document_kind($kind): string {
    if (!in_array($kind, ['lyrics_chords','tablature'], true)) throw new Vz2Error('Neplatný druh dokumentu.');
    return $kind;
}
function vz2_content_dates(array $row): array {
    foreach (['created_at','updated_at','version_created_at'] as $key) if (isset($row[$key])) $row[$key] = str_replace(' ', 'T', $row[$key]).'Z';
    return $row;
}
function vz2_document_body($body): string {
    if (!is_string($body) || preg_match('//u', $body) !== 1 || trim($body) === '' || strlen($body) > 1048576) throw new Vz2Error('Dokument musí obsahovat text a může mít nejvýše 1 MiB v UTF-8.');
    return $body; // Preserve indentation, chords, tablature and trailing newlines.
}
function vz2_document_read(mysqli $db, array $in): array {
    $collection = vz2_one($db, 'SELECT id,title,lifecycle FROM vz2_collections WHERE id=?', [vz2_id($in['collection_id'] ?? null)]);
    $kind = vz2_document_kind($in['kind'] ?? null);
    $rows = vz2_rows($db, 'SELECT d.*,a.name author,a.active author_active,e.name editor,e.active editor_active FROM vz2_documents d JOIN users a ON a.id=d.created_by JOIN users e ON e.id=d.updated_by WHERE d.collection_id=? AND d.kind=?', [$collection['id'],$kind]);
    $result = ['collection_id'=>(int)$collection['id'], 'collection_title'=>$collection['title'], 'kind'=>$kind, 'can_edit'=>$collection['lifecycle']==='active' && vz2_content_right('edit_text'), 'document'=>null];
    if (!$rows) {
        if (isset($in['revision']) || ($in['action'] ?? '') === 'history') throw new Vz2Error('Dokument ještě neexistuje.',404);
        return $result;
    }
    $doc = $rows[0];
    foreach (['id','collection_id','current_revision','created_by','updated_by','author_active','editor_active'] as $key) $doc[$key] = (int)$doc[$key];
    $result['document'] = vz2_content_dates($doc);
    if (($in['action'] ?? '') === 'history') {
        $before = isset($in['before']) ? vz2_id($in['before']) : null;
        $versions = vz2_rows($db, 'SELECT v.revision,v.created_by,v.created_at,u.name author,u.active author_active FROM vz2_document_versions v JOIN users u ON u.id=v.created_by WHERE v.document_id=?'.($before?' AND v.revision<?':'').' ORDER BY v.revision DESC LIMIT 21', $before?[$doc['id'],$before]:[$doc['id']]);
        $more = count($versions)>20; $versions = array_slice($versions,0,20);
        $result['versions'] = array_map('vz2_content_dates',$versions);
        $result['next_before'] = $more ? (int)end($versions)['revision'] : null;
    } else {
        $revision = isset($in['revision']) ? vz2_id($in['revision']) : $doc['current_revision'];
        $version = vz2_one($db, 'SELECT v.revision,v.body,v.created_by,v.created_at,u.name author,u.active author_active FROM vz2_document_versions v JOIN users u ON u.id=v.created_by WHERE v.document_id=? AND v.revision=?', [$doc['id'],$revision]);
        $result['version'] = vz2_content_dates($version);
    }
    return $result;
}
function vz2_document_write(array $in): array {
    return vz2_write(function(mysqli $db) use ($in): array {
        vz2_permission('edit_text');
        $collection = vz2_collection($db, vz2_id($in['collection_id'] ?? null)); vz2_active($collection); vz2_idle($db,'collection',(int)$collection['id']);
        $kind = vz2_document_kind($in['kind'] ?? null);
        $rows = vz2_rows($db, 'SELECT * FROM vz2_documents WHERE collection_id=? AND kind=? FOR UPDATE', [$collection['id'],$kind]);
        $doc = $rows[0] ?? null;
        $expected = $in['current_revision'] ?? null;
        if (!is_int($expected) || $expected < 0 || $expected > 4294967295) throw new Vz2Error('Chybí platná revize dokumentu.');
        if (($doc ? (int)$doc['current_revision'] : 0) !== $expected) throw new Vz2Error('Dokument mezitím někdo změnil. Rozepsaný text ponechte a načtěte aktuální verzi k porovnání.',409);
        if ($doc && vz2_id($in['document_id'] ?? null) !== (int)$doc['id']) throw new Vz2Error('Dokument nepatří do vybraného celku.',404);
        if (!$doc && ($in['document_id'] ?? null) !== null) throw new Vz2Error('Dokument již neexistuje.',404);
        $restore = ($in['action'] ?? '') === 'document_restore';
        if ($restore) {
            if (!$doc) throw new Vz2Error('Dokument ještě neexistuje.',404);
            $source = vz2_id($in['source_revision'] ?? null);
            $body = vz2_one($db,'SELECT body FROM vz2_document_versions WHERE document_id=? AND revision=?',[$doc['id'],$source])['body'];
            $title = $doc['title'];
        } else {
            $body = vz2_document_body($in['body'] ?? null);
            $title = vz2_text($in['title'] ?? null);
        }
        if (!$doc) {
            vz2_query($db, 'INSERT INTO vz2_documents(collection_id,kind,title,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())', [$collection['id'],$kind,$title,vz2_actor(),vz2_actor()]);
            $id = (int)$db->insert_id;
        } else $id = (int)$doc['id'];
        $revision = $expected + 1;
        vz2_query($db,'INSERT INTO vz2_document_versions(document_id,revision,body,created_by,created_at) VALUES (?,?,?,?,UTC_TIMESTAMP())',[$id,$revision,$body,vz2_actor()]);
        vz2_query($db,'UPDATE vz2_documents SET title=?,current_revision=?,updated_by=?,updated_at=UTC_TIMESTAMP() WHERE id=?',[$title,$revision,vz2_actor(),$id]);
        vz2_log($db,'document.version_created','document',$id,$title,'Celek #'.$collection['id'].' '.$collection['title'].'; verze '.$revision.($restore?'; obnovena z verze '.$source:''));
        return vz2_document_read($db,['collection_id'=>(int)$collection['id'],'kind'=>$kind]);
    });
}
function vz2_thread(mysqli $db, array $in, bool $lock = false): array {
    if (isset($in['thread_id'])) $thread = vz2_one($db,'SELECT * FROM vz2_discussion_threads WHERE id=?', [vz2_id($in['thread_id'])]);
    elseif (($in['scope'] ?? '') === 'ideas') $thread = vz2_one($db,"SELECT * FROM vz2_discussion_threads WHERE global_key='ideas'");
    else $thread = vz2_one($db,'SELECT * FROM vz2_discussion_threads WHERE collection_id=?',[vz2_id($in['collection_id'] ?? null)]);
    $thread['title'] = 'Nápady'; $thread['active'] = true;
    if ($thread['collection_id'] !== null) {
        $c = $lock ? vz2_collection($db,(int)$thread['collection_id']) : vz2_one($db,'SELECT title,lifecycle FROM vz2_collections WHERE id=?',[$thread['collection_id']]);
        if ($lock) { vz2_active($c); vz2_idle($db,'collection',(int)$thread['collection_id']); }
        $thread['title'] = $c['title']; $thread['active'] = $c['lifecycle'] === 'active';
        $thread['collection_id'] = (int)$thread['collection_id'];
    }
    $thread['id'] = (int)$thread['id'];
    return $thread;
}
function vz2_discussion_read(mysqli $db, array $in): array {
    $thread = vz2_thread($db,$in);
    if (isset($in['post_id'])) {
        $postId = vz2_id($in['post_id']);
        vz2_one($db,'SELECT id FROM vz2_discussion_posts WHERE id=? AND thread_id=?',[$postId,$thread['id']]);
    }
    $before = isset($in['before']) ? vz2_id($in['before']) : null;
    $posts = vz2_rows($db,'SELECT p.*,a.name author,a.active author_active,e.name editor,e.active editor_active FROM vz2_discussion_posts p JOIN users a ON a.id=p.created_by JOIN users e ON e.id=p.updated_by WHERE p.thread_id=?'.(isset($postId)?' AND p.id=?':($before?' AND p.id<?':'')).' ORDER BY p.id DESC LIMIT 21',isset($postId)?[$thread['id'],$postId]:($before?[$thread['id'],$before]:[$thread['id']]));
    $more = count($posts)>20; $posts = array_slice($posts,0,20);
    foreach ($posts as &$p) {
        foreach (['id','thread_id','revision','created_by','updated_by','author_active','editor_active'] as $key) $p[$key]=(int)$p[$key];
        $p['can_edit'] = $p['can_delete'] = $thread['active'] && vz2_content_right('comment',$p['created_by']);
        $p = vz2_content_dates($p);
    } unset($p);
    return ['thread'=>$thread,'can_create'=>$thread['active'] && vz2_content_right('comment'),'posts'=>$posts,'next_before'=>$more?(int)end($posts)['id']:null];
}
function vz2_discussion_write(array $in): array {
    return vz2_write(function(mysqli $db) use ($in): array {
        vz2_permission('comment');
        $thread = vz2_thread($db,['thread_id'=>vz2_id($in['thread_id'] ?? null)],true);
        $action = $in['action']; $post = null;
        if ($action !== 'post_create') {
            $post = vz2_one($db,'SELECT * FROM vz2_discussion_posts WHERE id=? AND thread_id=? FOR UPDATE',[vz2_id($in['post_id'] ?? null),$thread['id']]);
            vz2_permission('comment',(int)$post['created_by']); vz2_revision($post,$in['revision'] ?? null);
        }
        if ($action !== 'post_delete') $body = vz2_text($in['body'] ?? null,20000);
        if ($action === 'post_create') {
            vz2_query($db,'INSERT INTO vz2_discussion_posts(thread_id,body,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())',[$thread['id'],$body,vz2_actor(),vz2_actor()]);
            $id = (int)$db->insert_id;
        } else {
            $id = (int)$post['id'];
            if ($action === 'post_delete') vz2_query($db,'DELETE FROM vz2_discussion_posts WHERE id=?',[$id]);
            else vz2_query($db,'UPDATE vz2_discussion_posts SET body=?,revision=revision+1,updated_by=?,updated_at=UTC_TIMESTAMP() WHERE id=?',[$body,vz2_actor(),$id]);
        }
        $verb = ['post_create'=>'created','post_update'=>'updated','post_delete'=>'deleted'][$action];
        vz2_log($db,'discussion.post_'.$verb,'discussion_post',$id,$thread['title'],'Vlákno #'.$thread['id'].'; příspěvek #'.$id);
        return ['thread_id'=>$thread['id'],'post_id'=>$id,'revision'=>$post?(int)$post['revision']+1:1];
    });
}
