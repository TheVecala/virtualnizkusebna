<?php
declare(strict_types=1);

session_start();
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../inc/multitrack_notes.php';

try {
    multitrack_require_login();

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        header('Allow: GET');
        throw new MultitrackException('Tento endpoint podporuje pouze GET.', 405);
    }

    if (array_key_exists('id', $_GET)) {
        $id = multitrack_require_id($_GET['id']);
        multitrack_json_response([
            'ok' => true,
            'multitrack' => multitrack_notes_metadata($id),
        ]);
    }

    $items = multitrack_list();
    $liveIds = array_column($items, 'id');
    foreach (glob(multitrack_notes_root() . '/*.json') ?: [] as $archivePath) {
        $id = basename($archivePath, '.json');
        if (!multitrack_valid_id($id) || in_array($id, $liveIds, true)) continue;
        $archive = multitrack_notes_read($id);
        if ($archive) $items[] = ['id' => $id, 'name' => $archive['name'], 'created' => $archive['created'],
            'version' => 1, 'trackCount' => 0, 'audioDeleted' => true];
    }
    multitrack_json_response(['ok' => true, 'multitracks' => $items]);
} catch (MultitrackException $exception) {
    multitrack_json_response([
        'ok' => false,
        'error' => $exception->getMessage(),
    ], $exception->httpStatus());
} catch (Throwable $exception) {
    error_log('[Multitrack] List/detail failed: ' . $exception->getMessage());
    multitrack_json_response([
        'ok' => false,
        'error' => 'Multitracky se nepodarilo nacist.',
    ], 500);
}
