<?php
declare(strict_types=1);

/** Arrays preserve order and repeated values (e.g. 120, 132, 120). */
function vz2_song_details_values(array $in): array {
    $description = vz2_text($in['song_description'] ?? '', 10000, true);
    $tempos = $in['song_tempos'] ?? [];
    $meters = $in['song_meters'] ?? [];
    foreach ([$tempos, $meters] as $values) {
        if (!is_array($values) || !array_is_list($values) || count($values) > 32) {
            throw new Vz2Error('Tempo a takt musí být seznamy nejvýše 32 hodnot.');
        }
    }
    foreach ($tempos as $tempo) {
        if ((!is_int($tempo) && !is_float($tempo)) || !is_finite((float)$tempo)
            || $tempo < 1 || $tempo > 999 || abs($tempo * 100 - round($tempo * 100)) > 0.000001) {
            throw new Vz2Error('Tempo musí být od 1 do 999 BPM, nejvýše se dvěma desetinnými místy.');
        }
    }
    foreach ($meters as $meter) {
        if (!is_string($meter) || !preg_match('/\A([1-9]|[12][0-9]|3[0-2])\/(1|2|4|8|16|32|64)\z/', $meter)) {
            throw new Vz2Error('Takt zadejte například 4/4 nebo 6/8. Čitatel je 1–32, jmenovatel 1, 2, 4, 8, 16, 32 nebo 64.');
        }
    }
    return ['song_description'=>$description, 'song_tempos'=>$tempos, 'song_meters'=>$meters];
}
function vz2_song_details_decode(array $row): array {
    return ['song_description'=>$row['song_description'] ?? '',
        'song_tempos'=>json_decode($row['song_tempos'] ?? '[]', true, 4, JSON_THROW_ON_ERROR),
        'song_meters'=>json_decode($row['song_meters'] ?? '[]', true, 4, JSON_THROW_ON_ERROR)];
}
function vz2_song_details_save(mysqli $db, array $in): array {
    $row = vz2_collection($db, vz2_id($in['id'] ?? null));
    vz2_active($row);
    if ($row['kind'] !== 'song') throw new Vz2Error('Tyto údaje patří ke skladbě.');
    vz2_permission('rename_val', (int)$row['created_by']);
    vz2_revision($row, $in['revision'] ?? null);
    $values = vz2_song_details_values($in);
    vz2_query($db, 'UPDATE vz2_collections SET song_description=?,song_tempos=?,song_meters=?,revision=revision+1,updated_by=?,updated_at=UTC_TIMESTAMP() WHERE id=?',
        [$values['song_description'] === '' ? null : $values['song_description'], json_encode($values['song_tempos'], JSON_THROW_ON_ERROR),
         json_encode($values['song_meters'], JSON_THROW_ON_ERROR), vz2_actor(), $row['id']]);
    vz2_log($db, 'song.details_updated', 'collection', (int)$row['id'], $row['title'],
        json_encode(['song_tempos'=>$values['song_tempos'], 'song_meters'=>$values['song_meters'],
            'description_length'=>preg_match_all('/./us', $values['song_description'])], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
    return ['id'=>(int)$row['id'], 'revision'=>(int)$row['revision'] + 1] + $values;
}
