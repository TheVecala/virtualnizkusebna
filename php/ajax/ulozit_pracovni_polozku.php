<?php
session_start();
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../inc/multitracky.php';
header('Content-Type: application/json; charset=utf-8');

try {
    multitrack_require_login();
    $id = multitrack_require_id($_POST['id'] ?? null);
    $exists = false;
    foreach (multitrack_list() as $item) {
        if (($item['id'] ?? '') === $id) {
            $exists = true;
            break;
        }
    }
    if (!$exists) {
        throw new MultitrackException('Multitrack nebyl nalezen.', 404);
    }
    $_SESSION['last_multitrack_id'] = $id;
    multitrack_json_response(['ok' => true, 'id' => $id]);
} catch (MultitrackException $exception) {
    multitrack_json_response(['ok' => false, 'chyba' => $exception->getMessage()], $exception->httpStatus());
}
