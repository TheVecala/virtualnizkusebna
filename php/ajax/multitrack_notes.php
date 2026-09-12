<?php
declare(strict_types=1);
session_start();
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../inc/multitrack_notes.php';

try {
    multitrack_require_login();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($method, ['GET', 'POST'], true)) throw new MultitrackException('Nepodporovaná metoda.', 405);
    $request = $method === 'GET' ? $_GET : json_decode(file_get_contents('php://input'), true, 32, JSON_THROW_ON_ERROR);
    if (!is_array($request)) throw new MultitrackException('Neplatný požadavek.');
    $id = multitrack_require_id($request['id'] ?? null);
    $metadata = multitrack_notes_metadata($id);
    $data = multitrack_notes_read($id) ?? multitrack_notes_empty($metadata);
    if ($method === 'POST') {
        multitrack_verify_csrf($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null);
        if (($request['action'] ?? '') === 'removeAudio') {
            if (!ma_pravo('delete_file')) throw new MultitrackException('Nemáte oprávnění smazat audio.', 403);
            if (empty($metadata['audioDeleted'])) {
                // Save an archive before removing any source file. No recursive deletion.
                $data = multitrack_notes_change($metadata, ['action' => 'archive', 'revision' => $request['revision'] ?? null]);
                $directory = multitrack_storage_root() . '/' . $id;
                foreach ($metadata['tracks'] as $track) {
                    if (is_file($directory . '/' . $track['file']) && !unlink($directory . '/' . $track['file'])) {
                        throw new MultitrackException('Některé audio soubory se nepodařilo odstranit. Zápis je zachován.', 500);
                    }
                }
                // Keep the original manifest as documentation of the removed set.
                $manifestPath = $directory . '/' . MULTITRACK_MANIFEST;
                $manifest = json_decode(file_get_contents($manifestPath), true, 32, JSON_THROW_ON_ERROR);
                $manifest['audioDeleted'] = true;
                if (file_put_contents($manifestPath, json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), LOCK_EX) === false) {
                    throw new MultitrackException('Audio je odstraněné, stav manifestu se nepodařilo uložit.', 500);
                }
                $metadata['audioDeleted'] = true;
            }
        } else {
            if (!ma_pravo('comment')) throw new MultitrackException('Nemáte oprávnění upravovat zápis.', 403);
            if (($request['action'] ?? '') === 'archive') throw new MultitrackException('Neplatná akce.');
            $data = multitrack_notes_change($metadata, $request);
        }
    }
    multitrack_json_response(['ok' => true, 'notes' => $data, 'audioDeleted' => !empty($metadata['audioDeleted'])]);
} catch (MultitrackException $exception) {
    multitrack_json_response(['ok' => false, 'error' => $exception->getMessage()], $exception->httpStatus());
} catch (JsonException $exception) {
    multitrack_json_response(['ok' => false, 'error' => 'Neplatný JSON zápisu nebo požadavku.'], 400);
} catch (Throwable $exception) {
    error_log('[Multitrack notes] ' . $exception->getMessage());
    multitrack_json_response(['ok' => false, 'error' => 'Zápis se nepodařilo zpracovat.'], 500);
}
