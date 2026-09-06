<?php
declare(strict_types=1);

session_start();
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../inc/multitracky.php';

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
            'multitrack' => multitrack_read($id),
        ]);
    }

    multitrack_json_response([
        'ok' => true,
        'multitracks' => multitrack_list(),
    ]);
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
