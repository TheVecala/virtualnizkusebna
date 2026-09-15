<?php
declare(strict_types=1);

/**
 * Spolecne serverove utility pro samostatny modul Multitrack.
 *
 * Data jsou ulozena vedle uploads:
 * user/<kapela>/<befelemepesseveze>/multitracky/<id>/multitrack.json
 */

const MULTITRACK_MANIFEST = 'multitrack.json';
const MULTITRACK_VERSION = 1;
const MULTITRACK_ALLOWED_FORMATS = ['wav', 'flac', 'mp3'];
const MULTITRACK_MAX_MANIFEST_BYTES = 1048576;

final class MultitrackException extends RuntimeException
{
    private int $httpStatus;

    public function __construct(string $message, int $httpStatus = 400, ?Throwable $previous = null)
    {
        parent::__construct($message, 0, $previous);
        $this->httpStatus = $httpStatus;
    }

    public function httpStatus(): int
    {
        return $this->httpStatus;
    }
}

function multitrack_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');

    try {
        echo json_encode(
            $payload,
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
        );
    } catch (JsonException $exception) {
        http_response_code(500);
        echo '{"ok":false,"error":"Odpoved serveru se nepodarilo vytvorit."}';
        error_log('[Multitrack] JSON response failed: ' . $exception->getMessage());
    }
    exit;
}

function multitrack_require_login(): void
{
    $role = $_SESSION['role'] ?? '';
    if (
        empty($_SESSION['logged_in_single']) ||
        !is_string($role) || $role === '' || !isset($GLOBALS['PRAVA'][$role])
    ) {
        throw new MultitrackException('Nejste prihlasen.', 401);
    }
}

function multitrack_require_upload_permission(): void
{
    multitrack_require_login();
    if (!function_exists('ma_pravo') || !ma_pravo('upload')) {
        throw new MultitrackException('Nemate opravneni vkladat multitracky.', 403);
    }
}

/**
 * Vrati existujici CSRF token, pripadne jej pro stranku Multitrack vytvori.
 */
function multitrack_csrf_token(): string
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        throw new LogicException('Session musi byt spustena pred vytvorenim CSRF tokenu.');
    }

    $token = $_SESSION['multitrack_csrf'] ?? '';
    if (!is_string($token) || !preg_match('/\A[a-f0-9]{64}\z/', $token)) {
        $token = bin2hex(random_bytes(32));
        $_SESSION['multitrack_csrf'] = $token;
    }
    return $token;
}

function multitrack_verify_csrf(?string $providedToken): void
{
    $sessionToken = $_SESSION['multitrack_csrf'] ?? '';
    if (
        !is_string($sessionToken) || $sessionToken === '' ||
        !is_string($providedToken) || $providedToken === '' ||
        !hash_equals($sessionToken, $providedToken)
    ) {
        throw new MultitrackException('Neplatny nebo chybejici bezpecnostni token.', 403);
    }
}

function multitrack_project_root(): string
{
    $root = realpath(dirname(__DIR__, 2));
    if ($root === false) {
        throw new MultitrackException('Uloziste serveru neni dostupne.', 500);
    }
    return $root;
}

function multitrack_safe_session_component($value, string $label): string
{
    if (!is_string($value)) {
        throw new MultitrackException('Chybi kontext ' . $label . '.', 400);
    }

    $value = trim($value);
    if (
        $value === '' || $value === '.' || $value === '..' ||
        !preg_match('/\A[\p{L}\p{N}._-]+\z/u', $value)
    ) {
        throw new MultitrackException('Neplatny kontext ' . $label . '.', 400);
    }
    return $value;
}

function multitrack_path_is_within(string $path, string $parent): bool
{
    $path = str_replace('\\', '/', rtrim($path, '/\\'));
    $parent = str_replace('\\', '/', rtrim($parent, '/\\'));
    if (DIRECTORY_SEPARATOR === '\\') {
        $path = strtolower($path);
        $parent = strtolower($parent);
    }
    return $path === $parent || strncmp($path . '/', $parent . '/', strlen($parent) + 1) === 0;
}

/**
 * @return string Absolutni cesta ke korenove slozce multitracku.
 */
function multitrack_storage_root(bool $create = false): string
{
    $projectRoot = multitrack_project_root();
    $kapela = multitrack_safe_session_component($_SESSION['kapela'] ?? null, 'kapely');
    $befele = multitrack_safe_session_component(
        $_SESSION['befelemepesseveze'] ?? null,
        'uloziste kapely'
    );

    $userRoot = $projectRoot . DIRECTORY_SEPARATOR . 'user';
    $bandRoot = $userRoot . DIRECTORY_SEPARATOR . $kapela . DIRECTORY_SEPARATOR . $befele;

    if (!is_dir($bandRoot)) {
        if ($create) {
            throw new MultitrackException('Datova slozka kapely neexistuje.', 500);
        }
        return $bandRoot . DIRECTORY_SEPARATOR . 'multitracky';
    }

    $bandReal = realpath($bandRoot);
    $userReal = realpath($userRoot);
    if (
        $bandReal === false || $userReal === false ||
        !multitrack_path_is_within($bandReal, $userReal)
    ) {
        throw new MultitrackException('Neplatna cesta uloziste kapely.', 500);
    }

    $storage = $bandReal . DIRECTORY_SEPARATOR . 'multitracky';
    if ($create && !is_dir($storage) && !@mkdir($storage, 0755) && !is_dir($storage)) {
        throw new MultitrackException('Slozku pro multitracky se nepodarilo vytvorit.', 500);
    }

    if (is_dir($storage)) {
        $storageReal = realpath($storage);
        if ($storageReal === false || !multitrack_path_is_within($storageReal, $bandReal)) {
            throw new MultitrackException('Neplatna cesta uloziste multitracku.', 500);
        }
        return $storageReal;
    }

    return $storage;
}

function multitrack_valid_id(string $id): bool
{
    return preg_match('/\A[a-z0-9](?:[a-z0-9_-]{0,79})\z/', $id) === 1;
}

function multitrack_require_id($id): string
{
    if (!is_string($id) || !multitrack_valid_id($id)) {
        throw new MultitrackException('Neplatne ID multitracku.', 400);
    }
    return $id;
}

function multitrack_text_length(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

function multitrack_clean_display_name($value, string $label, int $maxLength = 160): string
{
    if (!is_string($value) || preg_match('//u', $value) !== 1) {
        throw new MultitrackException('Neplatny ' . $label . '.', 400);
    }

    $clean = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $value);
    $clean = trim(preg_replace('/\s+/u', ' ', $clean ?? '') ?? '');
    if ($clean === '') {
        throw new MultitrackException('Chybi ' . $label . '.', 400);
    }
    if (multitrack_text_length($clean) > $maxLength) {
        throw new MultitrackException(ucfirst($label) . ' je prilis dlouhy.', 400);
    }
    return $clean;
}

function multitrack_slug(string $value, int $maxLength = 80): string
{
    $ascii = $value;
    if (function_exists('transliterator_transliterate')) {
        $converted = transliterator_transliterate('Any-Latin; Latin-ASCII; Lower()', $value);
        if (is_string($converted) && $converted !== '') {
            $ascii = $converted;
        }
    } elseif (function_exists('iconv')) {
        $converted = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value);
        if (is_string($converted) && $converted !== '') {
            $ascii = $converted;
        }
    }

    $ascii = strtolower($ascii);
    $ascii = preg_replace('/[^a-z0-9]+/', '-', $ascii) ?? '';
    $ascii = trim($ascii, '-');
    $ascii = substr($ascii, 0, $maxLength);
    return rtrim($ascii, '-');
}

function multitrack_safe_manifest_filename($value): string
{
    if (!is_string($value) || $value === '' || preg_match('//u', $value) !== 1) {
        throw new MultitrackException('Manifest obsahuje neplatny nazev souboru.', 422);
    }
    if (
        basename(str_replace('\\', '/', $value)) !== $value ||
        str_contains($value, '..') || str_contains($value, "\0") ||
        str_contains($value, '/') || str_contains($value, '\\') ||
        str_starts_with($value, '.') || preg_match('/[\x00-\x1F\x7F]/u', $value) === 1 ||
        multitrack_text_length($value) > 180
    ) {
        throw new MultitrackException('Manifest obsahuje nebezpecny nazev souboru.', 422);
    }

    $extension = strtolower(pathinfo($value, PATHINFO_EXTENSION));
    if (!in_array($extension, MULTITRACK_ALLOWED_FORMATS, true)) {
        throw new MultitrackException('Manifest obsahuje nepodporovany format stopy.', 422);
    }
    return $value;
}

function multitrack_public_url(string $id, string $file): string
{
    $kapela = multitrack_safe_session_component($_SESSION['kapela'] ?? null, 'kapely');
    $befele = multitrack_safe_session_component(
        $_SESSION['befelemepesseveze'] ?? null,
        'uloziste kapely'
    );
    $segments = ['user', $kapela, $befele, 'multitracky', $id, $file];
    return '/' . implode('/', array_map('rawurlencode', $segments));
}

function multitrack_array_is_list(array $value): bool
{
    $expectedKey = 0;
    foreach ($value as $key => $_unused) {
        if ($key !== $expectedKey) {
            return false;
        }
        $expectedKey++;
    }
    return true;
}

/**
 * Nacte a striktne overi autoritativni multitrack.json.
 *
 * @return array{id:string,name:string,created:string,version:int,tracks:array<int,array{file:string,name:string,order:int,url:string}>}
 */
function multitrack_read(string $id, bool $allowMissingFiles = false): array
{
    $id = multitrack_require_id($id);
    $storage = multitrack_storage_root(false);
    $directory = $storage . DIRECTORY_SEPARATOR . $id;

    if (!is_dir($directory) || is_link($directory)) {
        throw new MultitrackException('Multitrack nebyl nalezen.', 404);
    }

    $directoryReal = realpath($directory);
    $storageReal = realpath($storage);
    if (
        $directoryReal === false || $storageReal === false ||
        !multitrack_path_is_within($directoryReal, $storageReal)
    ) {
        throw new MultitrackException('Neplatna cesta multitracku.', 422);
    }

    $manifestPath = $directoryReal . DIRECTORY_SEPARATOR . MULTITRACK_MANIFEST;
    if (!is_file($manifestPath) || is_link($manifestPath)) {
        throw new MultitrackException('Multitrack nema platny manifest.', 422);
    }

    $manifestSize = @filesize($manifestPath);
    if (!is_int($manifestSize) || $manifestSize < 1 || $manifestSize > MULTITRACK_MAX_MANIFEST_BYTES) {
        throw new MultitrackException('Manifest multitracku ma neplatnou velikost.', 422);
    }

    $raw = @file_get_contents($manifestPath);
    if (!is_string($raw)) {
        throw new MultitrackException('Manifest multitracku nelze nacist.', 500);
    }

    try {
        $manifest = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException $exception) {
        throw new MultitrackException('Manifest multitracku neni platny JSON.', 422, $exception);
    }

    if (!is_array($manifest) || ($manifest['version'] ?? null) !== MULTITRACK_VERSION) {
        throw new MultitrackException('Nepodporovana verze manifestu multitracku.', 422);
    }

    try {
        $name = multitrack_clean_display_name($manifest['name'] ?? null, 'nazev multitracku');
    } catch (MultitrackException $exception) {
        throw new MultitrackException($exception->getMessage(), 422, $exception);
    }

    $created = $manifest['created'] ?? null;
    $createdDate = is_string($created)
        ? DateTimeImmutable::createFromFormat(DATE_ATOM, $created)
        : false;
    if ($createdDate === false || $createdDate->format(DATE_ATOM) !== $created) {
        throw new MultitrackException('Manifest obsahuje neplatne datum vytvoreni.', 422);
    }

    $rawTracks = $manifest['tracks'] ?? null;
    if (!is_array($rawTracks) || !multitrack_array_is_list($rawTracks) || count($rawTracks) < 1) {
        throw new MultitrackException('Manifest neobsahuje zadne stopy.', 422);
    }

    $tracks = [];
    $seenFiles = [];
    $seenOrders = [];
    $setFormat = null;
    $availableFiles = 0;

    foreach ($rawTracks as $rawTrack) {
        if (!is_array($rawTrack)) {
            throw new MultitrackException('Manifest obsahuje neplatnou stopu.', 422);
        }

        $file = multitrack_safe_manifest_filename($rawTrack['file'] ?? null);
        $fileKey = strtolower($file);
        if (isset($seenFiles[$fileKey])) {
            throw new MultitrackException('Manifest obsahuje duplicitni soubor stopy.', 422);
        }
        $seenFiles[$fileKey] = true;

        $format = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        if ($setFormat === null) {
            $setFormat = $format;
        } elseif ($setFormat !== $format) {
            throw new MultitrackException('Multitrack obsahuje smisene audio formaty.', 422);
        }

        $trackPath = $directoryReal . DIRECTORY_SEPARATOR . $file;
        if (is_link($trackPath) || (!$allowMissingFiles && empty($manifest['audioDeleted']) && !is_file($trackPath))) {
            throw new MultitrackException('Chybi soubor stopy ' . $file . '.', 422);
        }

        if (is_file($trackPath)) $availableFiles++;

        try {
            $trackName = multitrack_clean_display_name($rawTrack['name'] ?? null, 'nazev stopy');
        } catch (MultitrackException $exception) {
            throw new MultitrackException($exception->getMessage(), 422, $exception);
        }

        $order = $rawTrack['order'] ?? null;
        if (!is_int($order) || $order < 1 || isset($seenOrders[$order])) {
            throw new MultitrackException('Manifest obsahuje neplatne nebo duplicitni poradi stop.', 422);
        }
        $seenOrders[$order] = true;

        $tracks[] = [
            'file' => $file,
            'name' => $trackName,
            'order' => $order,
            'url' => multitrack_public_url($id, $file),
        ];
    }

    usort($tracks, static function (array $left, array $right): int {
        return $left['order'] <=> $right['order'];
    });

    return [
        'id' => $id,
        'name' => $name,
        'created' => $created,
        'version' => MULTITRACK_VERSION,
        'audioDeleted' => !empty($manifest['audioDeleted']) || ($allowMissingFiles && $availableFiles === 0),
        'tracks' => $tracks,
    ];
}

/**
 * @return array<int,array{id:string,name:string,created:string,version:int,trackCount:int}>
 */
function multitrack_list(): array
{
    $storage = multitrack_storage_root(false);
    if (!is_dir($storage)) {
        return [];
    }

    $items = [];
    $entries = @scandir($storage);
    if (!is_array($entries)) {
        throw new MultitrackException('Seznam multitracku nelze nacist.', 500);
    }

    foreach ($entries as $id) {
        if ($id === '.' || $id === '..' || !multitrack_valid_id($id)) {
            continue;
        }
        try {
            $multitrack = multitrack_read($id, true);
            $items[] = [
                'id' => $multitrack['id'],
                'name' => $multitrack['name'],
                'created' => $multitrack['created'],
                'version' => $multitrack['version'],
                'trackCount' => count($multitrack['tracks']),
                'audioDeleted' => !empty($multitrack['audioDeleted']),
            ];
        } catch (MultitrackException $exception) {
            // Neplatna nebo nedokoncena slozka se nesmi objevit v uzivatelskem seznamu.
            error_log('[Multitrack] Skipping ' . $id . ': ' . $exception->getMessage());
        }
    }

    usort($items, static function (array $left, array $right): int {
        $byName = strnatcasecmp($left['name'], $right['name']);
        return $byName !== 0 ? $byName : strcmp($left['id'], $right['id']);
    });
    return $items;
}

/**
 * Normalizuje jedno nebo vice PHP upload poli na jednotny seznam.
 *
 * @return array<int,array{name:string,tmp_name:string,error:int,size:int,type:string}>
 */
function multitrack_uploaded_files(string $field): array
{
    $upload = $_FILES[$field] ?? null;
    if (!is_array($upload) || !isset($upload['name'])) {
        throw new MultitrackException('Nebyla vybrana zadna stopa.', 400);
    }

    if (!is_array($upload['name'])) {
        $upload = [
            'name' => [$upload['name']],
            'tmp_name' => [$upload['tmp_name'] ?? ''],
            'error' => [$upload['error'] ?? UPLOAD_ERR_NO_FILE],
            'size' => [$upload['size'] ?? 0],
            'type' => [$upload['type'] ?? ''],
        ];
    }

    $count = count($upload['name']);
    foreach (['tmp_name', 'error', 'size', 'type'] as $key) {
        if (!isset($upload[$key]) || !is_array($upload[$key]) || count($upload[$key]) !== $count) {
            throw new MultitrackException('Upload obsahuje neuplna data.', 400);
        }
    }

    $files = [];
    for ($index = 0; $index < $count; $index++) {
        if (
            !is_string($upload['name'][$index]) ||
            !is_string($upload['tmp_name'][$index]) ||
            !is_int($upload['error'][$index]) ||
            (!is_int($upload['size'][$index]) &&
                !(is_string($upload['size'][$index]) && ctype_digit($upload['size'][$index]))) ||
            !is_string($upload['type'][$index])
        ) {
            throw new MultitrackException('Upload obsahuje neplatna data souboru.', 400);
        }
        $files[] = [
            'name' => $upload['name'][$index],
            'tmp_name' => $upload['tmp_name'][$index],
            'error' => $upload['error'][$index],
            'size' => (int) $upload['size'][$index],
            'type' => $upload['type'][$index],
        ];
    }
    return $files;
}

function multitrack_upload_error_message(int $code, string $file): string
{
    $messages = [
        UPLOAD_ERR_INI_SIZE => 'prekrocil limit serveru',
        UPLOAD_ERR_FORM_SIZE => 'prekrocil limit formulare',
        UPLOAD_ERR_PARTIAL => 'byl nahran jen castecne',
        UPLOAD_ERR_NO_FILE => 'nebyl odeslan',
        UPLOAD_ERR_NO_TMP_DIR => 'nelze ulozit, chybi docasna slozka',
        UPLOAD_ERR_CANT_WRITE => 'nelze zapsat na disk',
        UPLOAD_ERR_EXTENSION => 'zastavilo rozsireni PHP',
    ];
    return 'Soubor ' . $file . ' ' . ($messages[$code] ?? 'se nepodarilo nahrat') . '.';
}

/**
 * Kontrola signatury chrani verejny datovy adresar pred souborem pouze prejmenovanym na audio.
 */
function multitrack_audio_signature_matches(string $path, string $format): bool
{
    $handle = @fopen($path, 'rb');
    if ($handle === false) {
        return false;
    }
    $header = fread($handle, 4096);
    fclose($handle);
    if (!is_string($header)) {
        return false;
    }

    $id3Offset = 0;
    if (substr($header, 0, 3) === 'ID3' && strlen($header) >= 10) {
        $sizeBytes = [ord($header[6]), ord($header[7]), ord($header[8]), ord($header[9])];
        if (($sizeBytes[0] | $sizeBytes[1] | $sizeBytes[2] | $sizeBytes[3]) & 0x80) {
            return false;
        }
        $id3Offset = 10 + ($sizeBytes[0] << 21) + ($sizeBytes[1] << 14)
            + ($sizeBytes[2] << 7) + $sizeBytes[3];
        if ((ord($header[5]) & 0x10) !== 0) {
            $id3Offset += 10;
        }
    }

    if ($format === 'flac') {
        if ($id3Offset === 0) {
            return substr($header, 0, 4) === 'fLaC';
        }
        $handle = @fopen($path, 'rb');
        if ($handle === false || fseek($handle, $id3Offset) !== 0) {
            if (is_resource($handle)) {
                fclose($handle);
            }
            return false;
        }
        $signature = fread($handle, 4);
        fclose($handle);
        return $signature === 'fLaC';
    }

    if ($format === 'wav') {
        $container = substr($header, 0, 4);
        return in_array($container, ['RIFF', 'RF64', 'BW64'], true)
            && substr($header, 8, 4) === 'WAVE';
    }

    if ($format === 'mp3') {
        if ($id3Offset > 0) {
            $handle = @fopen($path, 'rb');
            if ($handle === false || fseek($handle, $id3Offset) !== 0) {
                if (is_resource($handle)) {
                    fclose($handle);
                }
                return false;
            }
            $header = fread($handle, 65536);
            fclose($handle);
            if (!is_string($header)) {
                return false;
            }
        }
        $length = strlen($header);
        for ($index = 0; $index + 3 < $length; $index++) {
            $byte1 = ord($header[$index]);
            $byte2 = ord($header[$index + 1]);
            $byte3 = ord($header[$index + 2]);
            if (
                $byte1 === 0xff && ($byte2 & 0xe0) === 0xe0 &&
                ($byte2 & 0x18) !== 0x08 && ($byte2 & 0x06) !== 0 &&
                ($byte3 & 0xf0) !== 0 && ($byte3 & 0xf0) !== 0xf0 &&
                ($byte3 & 0x0c) !== 0x0c
            ) {
                return true;
            }
        }
    }

    return false;
}

function multitrack_remove_tree(string $directory): void
{
    if (!file_exists($directory) && !is_link($directory)) {
        return;
    }
    if (!is_dir($directory) || is_link($directory)) {
        @unlink($directory);
        return;
    }

    $entries = @scandir($directory);
    if (is_array($entries)) {
        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            multitrack_remove_tree($directory . DIRECTORY_SEPARATOR . $entry);
        }
    }
    @rmdir($directory);
}
