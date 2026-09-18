<?php
require_once __DIR__ . '/multitracky.php';

// Kept beside the audio library so a removed recording directory cannot erase its notes.
function multitrack_notes_root(bool $create = false): string
{
    $band = dirname(multitrack_storage_root(false));
    $path = $band . '/multitrack_zapisy';
    if (is_link($path)) throw new MultitrackException('Neplatné úložiště zápisů.', 422);
    if ($create && !is_dir($path) && !mkdir($path, 0755) && !is_dir($path)) {
        throw new MultitrackException('Úložiště zápisů nelze vytvořit.', 500);
    }
    return $path;
}

function multitrack_notes_read(string $id): ?array
{
    $path = multitrack_notes_root() . '/' . multitrack_require_id($id) . '.json';
    if (is_link($path)) throw new MultitrackException('Neplatný zápis.', 422);
    if (!is_file($path)) return null;
    $handle = fopen($path, 'rb');
    if (!$handle || !flock($handle, LOCK_SH)) throw new MultitrackException('Zápis nelze načíst.', 500);
    try {
        $raw = stream_get_contents($handle, 2097153);
        if ($raw === '') return null;
        $data = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
        if (!is_array($data) || ($data['id'] ?? null) !== $id) throw new RuntimeException('Invalid notes');
        return $data;
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

function multitrack_notes_metadata(string $id): array
{
    try { return multitrack_read($id, true); }
    catch (MultitrackException $exception) {
        $archive = multitrack_notes_read($id);
        if (!$archive) throw $exception;
        return ['id' => $id, 'name' => $archive['name'], 'created' => $archive['created'],
            'audioDeleted' => true, 'tracks' => [], 'version' => 1];
    }
}

function multitrack_notes_empty(array $metadata): array
{
    return ['id' => $metadata['id'], 'name' => $metadata['name'], 'created' => $metadata['created'],
        'revision' => 0, 'summary' => '', 'entries' => []];
}

function multitrack_notes_text($value, int $limit, bool $allowEmpty = false): string
{
    if (!is_string($value) || preg_match('//u', $value) !== 1) throw new MultitrackException('Neplatný text.');
    $value = trim($value);
    if ((!$allowEmpty && $value === '') || multitrack_text_length($value) > $limit) {
        throw new MultitrackException('Text je prázdný nebo příliš dlouhý.');
    }
    return $value;
}

function multitrack_notes_change(array $metadata, array $request): array
{
    $id = multitrack_require_id($metadata['id']);
    $path = multitrack_notes_root(true) . '/' . $id . '.json';
    if (is_link($path)) throw new MultitrackException('Neplatný zápis.', 422);
    $handle = fopen($path, 'c+b');
    if (!$handle || !flock($handle, LOCK_EX)) throw new MultitrackException('Zápis nelze uložit.', 500);
    try {
        $raw = stream_get_contents($handle, 2097153);
        $data = $raw === '' ? multitrack_notes_empty($metadata) : json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
        if (($request['revision'] ?? null) !== $data['revision']) {
            throw new MultitrackException('Zápis mezitím někdo změnil. Obnovte jej a zopakujte úpravu.', 409);
        }
        $action = $request['action'] ?? '';
        if ($action === 'summary') {
            $data['summary'] = multitrack_notes_text($request['text'] ?? '', 10000, true);
        } elseif ($action === 'entry') {
            $kind = $request['kind'] ?? '';
            $time = $request['time'] ?? null;
            if (!in_array($kind, ['chapter', 'note'], true) || !is_numeric($time) ||
                !is_finite((float) $time) || $time < 0 || $time > 604800) {
                throw new MultitrackException('Neplatný druh poznámky nebo čas.');
            }
            $entryId = $request['entryId'] ?? '';
            $index = $entryId === '' ? false : array_search($entryId, array_column($data['entries'], 'id'), true);
            if ($entryId !== '' && $index === false) throw new MultitrackException('Poznámka již neexistuje.', 404);
            if ($index === false && count($data['entries']) >= 2000) throw new MultitrackException('Zápis je již plný.');
            $entry = ['id' => $entryId ?: bin2hex(random_bytes(12)), 'kind' => $kind,
                'time' => round((float) $time, 3), 'text' => multitrack_notes_text($request['text'] ?? '', 4000),
                'author' => $index === false ? ($_SESSION['user_name'] ?? 'Muzikant') : $data['entries'][$index]['author']];
            if ($index === false) $data['entries'][] = $entry;
            else $data['entries'][$index] = $entry;
            usort($data['entries'], static function($a, $b) {
                return ($a['time'] <=> $b['time']) ?: (($a['kind'] === 'chapter' ? 0 : 1) <=> ($b['kind'] === 'chapter' ? 0 : 1));
            });
        } elseif ($action === 'delete') {
            $data['entries'] = array_values(array_filter($data['entries'], static function($entry) use ($request) {
                return $entry['id'] !== ($request['entryId'] ?? null);
            }));
        } elseif ($action !== 'archive') {
            throw new MultitrackException('Neznámá akce.');
        }
        $data['revision']++;
        $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        if (strlen($json) > 2097152) throw new MultitrackException('Zápis je příliš velký.');
        rewind($handle);
        if (fwrite($handle, $json) !== strlen($json) || !ftruncate($handle, strlen($json)) || !fflush($handle)) {
            throw new MultitrackException('Zápis se nepodařilo uložit.', 500);
        }
        return $data;
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}
