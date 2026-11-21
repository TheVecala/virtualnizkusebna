<?php
declare(strict_types=1);
require_once __DIR__.'/inc/vz2_catalog.php';
require_once __DIR__.'/inc/vz2_content.php';

// Read-only adapter for the current beta schema; no legacy paths or mutations.
function hrani_song(array $row): array {
    $details = vz2_song_details_decode($row);
    return [
        'id'=>(string)$row['id'], 'title'=>$row['title'],
        'description'=>$details['song_description'], 'tempos'=>$details['song_tempos'], 'meters'=>$details['song_meters'],
        'hasText'=>(bool)$row['has_text'], 'hasTab'=>(bool)$row['has_tab'],
        'recordings'=>(int)$row['recording_count'], 'documents'=>(int)$row['attachment_count'],
    ];
}

function hrani_catalog(mysqli $db): array {
    $rows = vz2_rows($db, "SELECT c.id,c.title,c.song_description,c.song_tempos,c.song_meters,
        EXISTS(SELECT 1 FROM vz2_documents d WHERE d.collection_id=c.id AND d.kind='lyrics_chords') has_text,
        EXISTS(SELECT 1 FROM vz2_documents d WHERE d.collection_id=c.id AND d.kind='tablature') has_tab,
        (SELECT COUNT(*) FROM vz2_recordings r WHERE r.collection_id=c.id AND r.lifecycle='active') recording_count,
        (SELECT COUNT(*) FROM vz2_attachments a WHERE a.collection_id=c.id AND a.state IN ('available','deleted')) attachment_count
        FROM vz2_collections c WHERE c.kind='song' AND c.lifecycle='active' ORDER BY c.sort_order,c.id");
    return array_map('hrani_song', $rows);
}

function hrani_rehearsals(mysqli $db): array {
    return vz2_rows($db, "SELECT c.id,c.title,
        (SELECT COUNT(*) FROM vz2_recordings r WHERE r.collection_id=c.id AND r.lifecycle='active') recordings
        FROM vz2_collections c WHERE c.kind='rehearsal' AND c.lifecycle='active' ORDER BY c.sort_order,c.id");
}

function hrani_rehearsal_detail(mysqli $db, int $id): array {
    $rehearsal = vz2_one($db, "SELECT id,title FROM vz2_collections WHERE id=? AND kind='rehearsal' AND lifecycle='active'", [$id]);
    $rows = vz2_rows($db, "SELECT f.*,r.title recording_title,r.kind recording_kind
        FROM vz2_audio_files f JOIN vz2_recordings r ON r.id=f.recording_id
        WHERE r.collection_id=? AND r.lifecycle='active' AND f.state='available'
        ORDER BY r.sort_order,r.id,f.sort_order,f.id", [$id]);
    $recordings = [];
    foreach ($rows as $row) {
        $file = vz2_file_public($row, 'audio');
        if (!$file['url']) continue;
        $name = $row['recording_title'];
        if ($row['recording_kind'] === 'multitrack') {
            $name = ($name !== '' ? $name . ' · ' : '') . 'Stopa: ' . $file['display_name'];
        }
        $recordings[] = ['name'=>$name !== '' ? $name : $file['display_name'], 'url'=>$file['url']];
    }
    return ['id'=>(string)$rehearsal['id'], 'title'=>$rehearsal['title'], 'recordings'=>$recordings];
}

function hrani_notes(mysqli $db, int $id): array {
    try {
        $discussion = vz2_discussion_read($db, ['collection_id'=>$id]);
        $notes = array_map(static fn(array $post): array => [
            'text'=>$post['body'], 'author'=>$post['author'],
            'date'=>(new DateTimeImmutable($post['created_at']))->setTimezone(new DateTimeZone('Europe/Prague'))->format('j. n. Y'),
        ], $discussion['posts']);
        return ['available'=>true, 'items'=>$notes];
    } catch (Vz2Error $error) {
        if ($error->status !== 404) throw $error;
        return ['available'=>true, 'items'=>[]];
    }
}

function hrani_detail(mysqli $db, int $id): array {
    $song = vz2_one($db, "SELECT id,title FROM vz2_collections WHERE id=? AND kind='song' AND lifecycle='active'", [$id]);
    $text = vz2_document_read($db, ['collection_id'=>$id, 'kind'=>'lyrics_chords']);
    $tab = vz2_document_read($db, ['collection_id'=>$id, 'kind'=>'tablature']);
    $recordings = vz2_rows($db, "SELECT id,title,kind FROM vz2_recordings WHERE collection_id=? AND lifecycle='active' ORDER BY sort_order,id", [$id]);
    $audio = vz2_rows($db, "SELECT f.* FROM vz2_audio_files f JOIN vz2_recordings r ON r.id=f.recording_id
        WHERE r.collection_id=? AND r.lifecycle='active' ORDER BY r.sort_order,r.id,f.sort_order,f.id", [$id]);
    $byRecording = [];
    foreach ($audio as $file) $byRecording[$file['recording_id']][] = $file;
    $files = [];
    foreach ($recordings as $recording) {
        $tracks = $byRecording[$recording['id']] ?? [];
        $name = $recording['title'] ?: ($tracks[0]['title'] ?? 'Nahrávka');
        if ($recording['kind'] === 'multitrack') {
            // Keep multitracks in the existing mixer instead of playing stems as a mix.
            $files[] = ['name'=>$name, 'audio'=>true, 'url'=>null,
                'openUrl'=>'index.php?v=2&collection_id='.$id.'&recording_id='.$recording['id'].'&view=mixer'];
            continue;
        }
        $public = $tracks ? vz2_file_public($tracks[0], 'audio') : null;
        $files[] = ['name'=>$name, 'audio'=>true, 'url'=>$public['url'] ?? null,
            'state'=>$public['state'] ?? 'missing'];
    }
    $attachments = vz2_rows($db, "SELECT * FROM vz2_attachments WHERE collection_id=? AND state IN ('available','deleted') ORDER BY id", [$id]);
    foreach ($attachments as $file) {
        $public = vz2_file_public($file, 'attachment');
        $files[] = ['name'=>$public['display_name'], 'audio'=>false, 'url'=>$public['url'], 'state'=>$public['state']];
    }
    return ['id'=>(string)$song['id'], 'title'=>$song['title'],
        'text'=>$text['version']['body'] ?? '', 'tab'=>$tab['version']['body'] ?? '',
        'files'=>$files, 'notes'=>hrani_notes($db, $id)];
}
