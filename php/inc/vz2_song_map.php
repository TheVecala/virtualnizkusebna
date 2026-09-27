<?php
declare(strict_types=1);
require_once __DIR__.'/vz2_core.php';

/** Only the semantic snapshot is stored; symbols and bar numbers belong to the UI. */
function vz2_song_map_keys($value, array $keys): void {
    if (!$value instanceof stdClass) throw new Vz2Error('Neplatný objekt Mapy skladby.');
    $actual = array_keys(get_object_vars($value)); sort($actual); sort($keys);
    if ($actual !== $keys) throw new Vz2Error('Neplatná pole Mapy skladby.');
}
function vz2_song_map_id($value, array &$seen): void {
    if (!is_string($value) || !preg_match('/\A[0-9a-f]{32}\z/', $value) || isset($seen[$value])) {
        throw new Vz2Error('Mapa obsahuje neplatné nebo opakované ID.');
    }
    $seen[$value] = true;
}
function vz2_song_map_collection(array $collection): void {
    if (($collection['kind'] ?? null) !== 'song') throw new Vz2Error('Mapa patří skladbě, nikoli zkoušce.');
}
function vz2_song_map_body($body): string {
    if (!is_string($body) || strlen($body) > 1048576 || preg_match('//u', $body) !== 1) {
        throw new Vz2Error('Mapa může mít nejvýše 1 MiB v UTF-8.');
    }
    try { $map = json_decode($body, false, 16, JSON_THROW_ON_ERROR); }
    catch (JsonException $e) { throw new Vz2Error('Mapa neobsahuje platný JSON.'); }
    vz2_song_map_keys($map, ['schema_version','sections']);
    if ($map->schema_version !== 1 || !is_array($map->sections) || count($map->sections) > 200) {
        throw new Vz2Error('Neplatná verze nebo počet sekcí Mapy.');
    }
    $seen = []; $count = 0;
    foreach ($map->sections as $section) {
        vz2_song_map_keys($section, ['id','name','bars']);
        vz2_song_map_id($section->id, $seen);
        $section->name = vz2_text($section->name);
        if (!is_array($section->bars) || !$section->bars) throw new Vz2Error('Sekce musí obsahovat alespoň jeden takt.');
        foreach ($section->bars as $bar) {
            if (++$count > 8192) throw new Vz2Error('Mapa může obsahovat nejvýše 8192 taktů.');
            vz2_song_map_keys($bar, ['id','base','fill','crash','special','detail']);
            vz2_song_map_id($bar->id, $seen);
            if (!in_array($bar->base, [null,'hihat','ride'], true) || !is_int($bar->fill)
                || $bar->fill < 0 || $bar->fill > 4 || !is_bool($bar->crash)
                || !in_array($bar->special, [null,'unknown','pause','stop'], true)) {
                throw new Vz2Error('Neplatná sémantika taktu.');
            }
            if ($bar->special !== null) $valid = $bar->base === null && $bar->fill === 0 && !$bar->crash;
            elseif ($bar->fill === 4) $valid = $bar->base === null && !$bar->crash;
            else $valid = $bar->base !== null && !($bar->crash && $bar->fill !== 0);
            if (!$valid) throw new Vz2Error('Tato kombinace taktu není součástí Mapy V1.');
            if (!is_string($bar->detail) || preg_match('//u', $bar->detail) !== 1 || strlen($bar->detail) > 65536) {
                throw new Vz2Error('Detail taktu musí být prostý UTF-8 text do 64 KiB.');
            }
        }
    }
    $result = json_encode($map, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    if (strlen($result) > 1048576) throw new Vz2Error('Mapa může mít nejvýše 1 MiB v UTF-8.');
    return $result;
}
