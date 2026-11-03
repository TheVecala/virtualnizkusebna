<?php
declare(strict_types=1);
require_once __DIR__.'/vz2_core.php';
require_once __DIR__.'/vz2_timestamp_model.php';

/** Text-only, current snapshot for the standalone overview. No audio files or URLs. */
function vz2_overview_data(mysqli $db): array {
    $groups = ['rehearsal'=>[], 'song'=>[]];
    $kindById = [];
    $collections = vz2_rows($db, "SELECT id,kind,title,lifecycle,created_at,song_description,song_tempos,song_meters FROM vz2_collections WHERE lifecycle IN ('active','archived') ORDER BY kind,sort_order,id");
    foreach ($collections as $collection) {
        $kind = $collection['kind'];
        $id = (int)$collection['id'];
        $kindById[$id] = $kind;
        $groups[$kind][$id] = [
            'id'=>$id, 'title'=>$collection['title'], 'lifecycle'=>$collection['lifecycle'],
            'created_at'=>$collection['created_at'], 'entries'=>[], 'played_songs'=>[]
        ];
    }
    $append = static function(int $id, array $entry) use (&$groups, $kindById): void {
        if (isset($kindById[$id])) $groups[$kindById[$id]][$id]['entries'][] = $entry;
    };

    foreach ($collections as $collection) {
        if ($collection['kind'] !== 'song') continue;
        $details = vz2_song_details_decode($collection);
        if ($details['song_description'] === '' && !$details['song_tempos'] && !$details['song_meters']) continue;
        $append((int)$collection['id'], ['type'=>'song_details', 'label'=>'Popisek, tempo a takt',
            'body'=>$details['song_description'], 'tempos'=>$details['song_tempos'], 'meters'=>$details['song_meters']]);
    }

    $documents = vz2_rows($db, 'SELECT d.collection_id,d.kind,d.title,d.updated_at,v.body,u.name author
        FROM vz2_documents d JOIN vz2_document_versions v ON v.document_id=d.id AND v.revision=d.current_revision
        JOIN users u ON u.id=d.updated_by ORDER BY d.collection_id,d.id');
    foreach ($documents as $document) {
        $kind = $document['kind'];
        if ($kind === 'song_map') {
            $map = json_decode($document['body'],true);
            if (!is_array($map) || !is_array($map['sections'] ?? null)) continue;
            $barNumber = 1;
            $mapSections = [];
            $mapDetails = [];
            foreach ($map['sections'] as $section) {
                $name = (string)($section['name'] ?? 'Sekce');
                $bars = is_array($section['bars'] ?? null) ? $section['bars'] : [];
                $barCount = count($bars);
                $playingBars = [];
                foreach ($bars as $bar) $playingBars[] = [
                    'base'=>$bar['base'] ?? null, 'fill'=>(int)($bar['fill'] ?? 0),
                    'crash'=>(bool)($bar['crash'] ?? false), 'special'=>$bar['special'] ?? null,
                    'has_detail'=>trim((string)($bar['detail'] ?? '')) !== ''
                ];
                $mapSections[] = ['name'=>$name, 'bars'=>$playingBars, 'first_bar'=>$barNumber];
                foreach ($bars as $index => $bar) {
                    if (trim((string)($bar['detail'] ?? '')) === '') continue;
                    $mapDetails[] = ['type'=>'map_detail','label'=>$name.' · takt '.($barNumber+$index),
                        'body'=>$bar['detail'], 'at'=>$document['updated_at'], 'author'=>$document['author']];
                }
                $barNumber += $barCount;
            }
            if ($mapSections) {
                $totalBars = $barNumber - 1;
                $barLabel = $totalBars === 1 ? 'takt' : ($totalBars >= 2 && $totalBars <= 4 ? 'takty' : 'taktů');
                $append((int)$document['collection_id'], ['type'=>'map','label'=>'Mapa',
                    'body'=>$totalBars.' '.$barLabel, 'sections'=>$mapSections,
                    'at'=>$document['updated_at'], 'author'=>$document['author']]);
            }
            foreach ($mapDetails as $detail) $append((int)$document['collection_id'], $detail);
            continue;
        }
        $label = $kind === 'lyrics_chords' && ($kindById[(int)$document['collection_id']] ?? null) === 'rehearsal'
            ? 'Zápisky' : (['lyrics_chords'=>'Text a akordy','tablature'=>'Tabulatura','rehearsal_starts'=>'Začátky skladeb'][$kind] ?? $document['title']);
        $append((int)$document['collection_id'], ['type'=>'document','kind'=>$kind,'label'=>$label,
            'body'=>$document['body'], 'at'=>$document['updated_at'], 'author'=>$document['author']]);
    }

    $summaries = vz2_rows($db, "SELECT r.collection_id,r.summary,r.summary_updated_at,r.created_at,u.name author
        FROM vz2_recordings r LEFT JOIN users u ON u.id=r.summary_updated_by
        WHERE r.lifecycle='active' AND r.summary IS NOT NULL AND TRIM(r.summary)<>''
        ORDER BY r.collection_id,r.sort_order,r.id");
    foreach ($summaries as $summary) {
        $append((int)$summary['collection_id'], ['type'=>'summary','label'=>'Souhrn', 'body'=>$summary['summary'],
            'at'=>$summary['summary_updated_at'] ?: $summary['created_at'], 'author'=>$summary['author']]);
    }

    $attachments = vz2_rows($db, "SELECT a.collection_id,a.summary,a.summary_updated_at,u.name author
        FROM vz2_attachments a LEFT JOIN users u ON u.id=a.summary_updated_by
        WHERE a.state='available' AND a.summary IS NOT NULL AND TRIM(a.summary)<>''
        ORDER BY a.collection_id,a.id");
    foreach ($attachments as $attachment) {
        $append((int)$attachment['collection_id'], ['type'=>'attachment_note','label'=>'Poznámka k příloze',
            'body'=>$attachment['summary'], 'at'=>$attachment['summary_updated_at'], 'author'=>$attachment['author']]);
    }

    $markers = vz2_rows($db, "SELECT r.id recording_id,r.collection_id,r.kind recording_kind,r.title recording_title,
            r.duration_ms,t.*,u.name author,s.title song_title
        FROM vz2_timestamps t JOIN vz2_recordings r ON r.id=t.recording_id JOIN users u ON u.id=t.created_by LEFT JOIN vz2_collections s ON s.id=t.song_collection_id
        WHERE r.lifecycle='active' ORDER BY r.collection_id,r.sort_order,r.id,t.time_ms,t.id");
    $recordingFiles = [];
    if ($markers) {
        $recordingIds = array_values(array_unique(array_map(static fn($marker) => (int)$marker['recording_id'], $markers)));
        $placeholders = implode(',', array_fill(0, count($recordingIds), '?'));
        $files = vz2_rows($db, "SELECT recording_id,title,original_name,format FROM vz2_audio_files
            WHERE recording_id IN ($placeholders) ORDER BY recording_id,sort_order,id", $recordingIds);
        foreach ($files as $file) $recordingFiles[(int)$file['recording_id']][] = $file;
    }
    $byRecording = [];
    foreach ($markers as $marker) $byRecording[(int)$marker['recording_id']][] = $marker;
    foreach ($byRecording as $id => $rows) {
        $recording = $rows[0];
        $files = $recordingFiles[$id] ?? [];
        $name = $files ? (trim($files[0]['title']) ?: $files[0]['original_name']) : '';
        if ($name !== '' && $files[0]['format'] !== '' && !str_ends_with(strtolower($name), '.'.strtolower($files[0]['format']))) {
            $name .= '.'.$files[0]['format'];
        }
        if ($name === '') $name = trim($recording['recording_title']) ?: 'Nahrávka #'.$id;
        if ($recording['recording_kind'] === 'multitrack' && count($files) > 1) $name .= ' +'.(count($files)-1);
        foreach (vz2_timestamp_annotations(['id'=>$id,'duration_ms'=>$recording['duration_ms']], $rows) as $item) {
            $source = $item['source']; $end = $item['end_source'];
            // Read-only projection: keep the shared interval contract without raw SQL rows.
            unset($item['source'], $item['end_source']);
            $append((int)$recording['collection_id'], array_merge($item, [
                'type'=>'marker', 'body'=>$item['label'], 'time_ms'=>$item['start_ms'],
                'recording_name'=>$name, 'at'=>$source['created_at'], 'author'=>$source['author'],
                'end_body'=>$end && !in_array(trim($end['body']), ['↑','↓'], true) ? $end['body'] : '',
                'end_author'=>$end['author'] ?? '', 'end_at'=>$end['created_at'] ?? null
            ]));
        }
    }

    $posts = vz2_rows($db, 'SELECT t.collection_id,p.body,p.created_at,u.name author
        FROM vz2_discussion_posts p JOIN vz2_discussion_threads t ON t.id=p.thread_id
        JOIN users u ON u.id=p.created_by WHERE t.collection_id IS NOT NULL
        ORDER BY t.collection_id,p.id');
    foreach ($posts as $post) {
        $append((int)$post['collection_id'], ['type'=>'discussion','label'=>'Diskuse',
            'body'=>$post['body'], 'at'=>$post['created_at'], 'author'=>$post['author']]);
    }

    $plays = vz2_rows($db, 'SELECT p.rehearsal_collection_id,p.song_collection_id,s.title song_title,COUNT(*) play_count
        FROM vz2_rehearsal_plays p JOIN vz2_collections s ON s.id=p.song_collection_id
        GROUP BY p.rehearsal_collection_id,p.song_collection_id,s.title
        ORDER BY p.rehearsal_collection_id,s.title,p.song_collection_id');
    foreach ($plays as $play) {
        $id = (int)$play['rehearsal_collection_id'];
        if (!isset($groups['rehearsal'][$id])) continue;
        $groups['rehearsal'][$id]['played_songs'][] = [
            'id'=>(int)$play['song_collection_id'], 'title'=>$play['song_title'], 'count'=>(int)$play['play_count']
        ];
    }

    return ['annotation_version'=>1, 'generated_at'=>gmdate('Y-m-d\TH:i:s\Z'),
        'rehearsals'=>array_values($groups['rehearsal']), 'songs'=>array_values($groups['song'])];
}
