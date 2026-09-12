<?php
declare(strict_types=1);

session_start();
require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../inc/multitrack_notes.php';

$stagingDirectory = null;

try {
    multitrack_require_upload_permission();

    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        throw new MultitrackException('Tento endpoint podporuje pouze POST.', 405);
    }

    $csrf = $_POST['csrf'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null);
    multitrack_verify_csrf(is_string($csrf) ? $csrf : null);

    $name = multitrack_clean_display_name($_POST['name'] ?? null, 'nazev multitracku');
    $id = multitrack_slug($name);
    if ($id === '' || !multitrack_valid_id($id)) {
        throw new MultitrackException('Z nazvu nelze vytvorit platne ID multitracku.', 400);
    }

    $expectedTrackCountRaw = $_POST['track_count'] ?? null;
    if (!is_string($expectedTrackCountRaw) || !ctype_digit($expectedTrackCountRaw)) {
        throw new MultitrackException('Chybi pocet stop odesilane sady.', 400);
    }
    $expectedTrackCount = (int) $expectedTrackCountRaw;
    if ($expectedTrackCount < 1) {
        throw new MultitrackException('Multitrack musi obsahovat alespon jednu stopu.', 400);
    }

    $uploads = multitrack_uploaded_files('tracks');
    if (count($uploads) !== $expectedTrackCount) {
        $serverLimit = (int) ini_get('max_file_uploads');
        $limitHint = $serverLimit > 0 ? ' Limit serveru je ' . $serverLimit . ' souboru na jeden upload.' : '';
        throw new MultitrackException(
            'Server neprijal celou sadu (' . count($uploads) . ' z ' . $expectedTrackCount . ' stop).' . $limitHint,
            400
        );
    }
    $prepared = [];
    $seenNames = [];
    $setFormat = null;

    foreach ($uploads as $upload) {
        $originalName = basename(str_replace('\\', '/', $upload['name']));
        $displayFile = $originalName !== '' ? $originalName : 'neznamy soubor';

        if ($upload['error'] !== UPLOAD_ERR_OK) {
            throw new MultitrackException(
                multitrack_upload_error_message($upload['error'], $displayFile),
                400
            );
        }
        if (
            $upload['tmp_name'] === '' || !is_uploaded_file($upload['tmp_name']) ||
            $upload['size'] <= 0 || !is_file($upload['tmp_name']) ||
            @filesize($upload['tmp_name']) <= 0
        ) {
            throw new MultitrackException('Stopa ' . $displayFile . ' nema platna upload data.', 400);
        }

        $format = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
        if (!in_array($format, MULTITRACK_ALLOWED_FORMATS, true)) {
            throw new MultitrackException(
                'Stopa ' . $displayFile . ' ma nepodporovany format. Povolene jsou WAV, FLAC a MP3.',
                400
            );
        }
        if ($setFormat === null) {
            $setFormat = $format;
        } elseif ($setFormat !== $format) {
            throw new MultitrackException('Vsechny stopy jedne sady musi mit stejny format.', 400);
        }

        if (!multitrack_audio_signature_matches($upload['tmp_name'], $format)) {
            throw new MultitrackException(
                'Obsah souboru ' . $displayFile . ' neodpovida formatu .' . $format . '.',
                400
            );
        }

        $originalBase = pathinfo($originalName, PATHINFO_FILENAME);
        try {
            $trackName = multitrack_clean_display_name($originalBase, 'nazev stopy');
        } catch (MultitrackException $exception) {
            throw new MultitrackException('Stopa ' . $displayFile . ' nema platny nazev.', 400, $exception);
        }

        $fileBase = multitrack_slug($trackName, 120);
        if ($fileBase === '') {
            throw new MultitrackException('Z nazvu stopy ' . $displayFile . ' nelze vytvorit nazev souboru.', 400);
        }
        $safeFile = $fileBase . '.' . $format;
        $fileKey = strtolower($safeFile);
        if (isset($seenNames[$fileKey])) {
            throw new MultitrackException(
                'Dve stopy by po uprave mely stejny nazev ' . $safeFile . '. Prejmenujte je a zkuste upload znovu.',
                409
            );
        }
        $seenNames[$fileKey] = true;

        $prepared[] = [
            'tmp_name' => $upload['tmp_name'],
            'file' => $safeFile,
            'name' => $trackName,
        ];
    }

    usort($prepared, static function (array $left, array $right): int {
        $natural = strnatcasecmp($left['file'], $right['file']);
        return $natural !== 0 ? $natural : strcmp($left['file'], $right['file']);
    });

    $storage = multitrack_storage_root(true);
    $finalDirectory = $storage . DIRECTORY_SEPARATOR . $id;
    if (file_exists($finalDirectory) || is_link($finalDirectory) || is_file(multitrack_notes_root() . '/' . $id . '.json')) {
        throw new MultitrackException('Multitrack nebo zachovany zapis se stejnym nazvem uz existuje. Pouzijte jiny nazev.', 409);
    }

    try {
        $randomSuffix = bin2hex(random_bytes(12));
    } catch (Throwable $exception) {
        throw new MultitrackException('Nelze pripravit bezpecny docasny upload.', 500, $exception);
    }
    $stagingDirectory = $storage . DIRECTORY_SEPARATOR . '.upload-' . $id . '-' . $randomSuffix;
    if (!@mkdir($stagingDirectory, 0700)) {
        throw new MultitrackException('Docasnou slozku uploadu se nepodarilo vytvorit.', 500);
    }

    $manifestTracks = [];
    foreach ($prepared as $index => $track) {
        $destination = $stagingDirectory . DIRECTORY_SEPARATOR . $track['file'];
        if (!move_uploaded_file($track['tmp_name'], $destination)) {
            throw new MultitrackException('Stopu ' . $track['name'] . ' se nepodarilo ulozit.', 500);
        }
        @chmod($destination, 0644);
        $manifestTracks[] = [
            'file' => $track['file'],
            'name' => $track['name'],
            'order' => $index + 1,
        ];
    }

    $manifest = [
        'version' => MULTITRACK_VERSION,
        'name' => $name,
        'created' => (new DateTimeImmutable('now', new DateTimeZone('Europe/Prague')))
            ->format(DATE_ATOM),
        'tracks' => $manifestTracks,
    ];

    try {
        $manifestJson = json_encode(
            $manifest,
            JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
        ) . PHP_EOL;
    } catch (JsonException $exception) {
        throw new MultitrackException('Manifest multitracku se nepodarilo vytvorit.', 500, $exception);
    }

    $manifestPath = $stagingDirectory . DIRECTORY_SEPARATOR . MULTITRACK_MANIFEST;
    $writtenBytes = file_put_contents($manifestPath, $manifestJson, LOCK_EX);
    if ($writtenBytes === false || $writtenBytes !== strlen($manifestJson)) {
        throw new MultitrackException('Manifest multitracku se nepodarilo ulozit.', 500);
    }
    @chmod($manifestPath, 0644);

    // Staging i cil jsou na stejnem filesystemu. Sada se tak objevi az kompletni.
    if (file_exists($finalDirectory)) {
        throw new MultitrackException('Multitrack se stejnym ID mezitim vznikl.', 409);
    }
    if (!@rename($stagingDirectory, $finalDirectory)) {
        $status = file_exists($finalDirectory) ? 409 : 500;
        throw new MultitrackException('Multitrack se nepodarilo dokoncit.', $status);
    }
    $stagingDirectory = null;
    @chmod($finalDirectory, 0755);

    multitrack_json_response([
        'ok' => true,
        'multitrack' => multitrack_read($id),
    ], 201);
} catch (MultitrackException $exception) {
    if (is_string($stagingDirectory)) {
        multitrack_remove_tree($stagingDirectory);
    }
    multitrack_json_response([
        'ok' => false,
        'error' => $exception->getMessage(),
    ], $exception->httpStatus());
} catch (Throwable $exception) {
    if (is_string($stagingDirectory)) {
        multitrack_remove_tree($stagingDirectory);
    }
    error_log('[Multitrack] Upload failed: ' . $exception->getMessage());
    multitrack_json_response([
        'ok' => false,
        'error' => 'Multitrack se nepodarilo nahrat.',
    ], 500);
}
