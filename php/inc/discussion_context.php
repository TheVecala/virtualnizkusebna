<?php
require_once __DIR__ . '/content_context.php';

// The request carries its recording ID; a later selection cannot redirect a pending write.
function discussion_multitrack_id(): string
{
    $id = $_POST['multitrack_id'] ?? $_GET['multitrack_id'] ?? '';
    if ($id === '') return '';
    require_once __DIR__ . '/multitrack_notes.php';
    try {
        multitrack_require_login();
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
            multitrack_verify_csrf($_POST['csrf'] ?? null);
        }
        $id = multitrack_require_id($id);
        multitrack_notes_metadata($id); // Includes archived recordings belonging to this band.
        return $id;
    } catch (MultitrackException $exception) {
        multitrack_json_response(['ok' => false, 'chyba' => $exception->getMessage()], $exception->httpStatus());
    }
}

function discussion_table(mysqli $db, string $band, string $folder, string $multitrackId): string
{
    if ($multitrackId !== '') {
        // Fixed safe identifier under MySQL's 64-character limit, scoped to the band storage.
        return 'mt_diskuse_' . substr(hash('sha256', $band . '/' . ($_SESSION['befelemepesseveze'] ?? '') . '/' . $multitrackId), 0, 48);
    }
    return content_discussion_prefix() . $db->real_escape_string($band) . '_' . $db->real_escape_string($folder);
}
