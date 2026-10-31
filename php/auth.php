<?php
// Malé společné funkce pro login a administraci.
// Volající nejprve načte config.php. Žádná automatická inicializace databáze.
function auth_db(): mysqli {
    static $db = null;
    if ($db === null) {
        mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
        require __DIR__ . '/login/connect.php';
        $mysqli->set_charset('utf8mb4');
        if (defined('VZ2_ENABLED') && VZ2_ENABLED === true) {
            // Hosting need not have a strict global default. Configure this connection
            // before login/admin/content queries; keep any additional server modes.
            $mysqli->query("SET SESSION sql_mode = CONCAT_WS(',', @@SESSION.sql_mode, 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION')");
        }
        $db = $mysqli;
    }
    return $db;
}

function auth_is_admin(): bool {
    return ($_SESSION['logged_in_single'] ?? null) === true
        && ($_SESSION['role'] ?? null) === 'admin';
}

function auth_require_admin(): void {
    auth_refresh_session();
    if (!auth_is_admin()) {
        http_response_code(403);
        exit('Přístup je povolen pouze administrátorovi.');
    }
}

function auth_forget_identity(): void {
    unset($_SESSION['logged_in_single'], $_SESSION['user_id'], $_SESSION['user_name'],
        $_SESSION['role'], $_SESSION['auth_fingerprint'], $_SESSION['auth_csrf']);
}

function auth_settings(mysqli $db, bool $lock = false): array {
    $row = $db->query('SELECT * FROM auth_settings WHERE id = 1' . ($lock ? ' FOR UPDATE' : ''))->fetch_assoc();
    if (!$row) {
        throw new RuntimeException('Chybí migrační záznam auth_settings.');
    }
    return $row;
}

function auth_fingerprint(string $hash, int $generation): string {
    // Generation zero preserves sessions issued before migration 007.
    return hash('sha256', $hash . ($generation === 0 ? '' : ':' . $generation));
}

// V endpointech načítajících config.php se zde promítne deaktivace,
// změna role/hesla i vypnutí hosta, aniž by se přepisovaly jeho kontroly práv.
function auth_refresh_session(): void {
    auth_vz2_entry_guard();
    if (($_SESSION['logged_in_single'] ?? null) !== true) {
        return;
    }
    if (!array_key_exists('user_id', $_SESSION) || empty($_SESSION['auth_fingerprint'])) {
        auth_forget_identity(); // Po přepnutí se staré sdílené session musí přihlásit znovu.
        return;
    }
    $db = auth_db();
    if ($_SESSION['user_id'] === null && ($_SESSION['role'] ?? '') === 'host') {
        $guest = auth_settings($db);
        $hash = $guest['guest_password_hash'];
        if (!(int) $guest['guest_enabled'] || !$hash
            || !hash_equals($_SESSION['auth_fingerprint'], auth_fingerprint($hash, (int) $guest['guest_auth_generation']))) {
            auth_forget_identity();
        }
        return;
    }
    $id = (int) $_SESSION['user_id'];
    $stmt = $db->prepare('SELECT id, name, role, password_hash, auth_generation FROM users WHERE id = ? AND active = 1');
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    if (!$user || !hash_equals($_SESSION['auth_fingerprint'], auth_fingerprint($user['password_hash'], (int) $user['auth_generation']))) {
        auth_forget_identity();
        return;
    }
    $_SESSION['user_name'] = $user['name'];
    $_SESSION['role'] = $user['role'];
}

function auth_normalize_username(string $username): string {
    return strtolower(trim($username));
}

function auth_valid_username(string $username): bool {
    return preg_match('/\A[a-z0-9][a-z0-9._-]{2,31}\z/', $username) === 1;
}

// Migration 008 is run only after every installation uses username + password.
function auth_username_login_finalized(array $settings): bool {
    return (int) ($settings['username_login_finalized'] ?? 0) === 1;
}

final class AuthLoginRateLimited extends RuntimeException {
    public int $retryAfter;

    public function __construct(int $retryAfter) {
        $this->retryAfter = max(1, $retryAfter);
        parent::__construct('Příliš mnoho neúspěšných pokusů. Zkuste to za chvíli znovu.');
    }
}

// Shared by both installations and independent of cookies and submitted usernames.
// Only the server's peer address is trusted; forwarding headers are user input.
function auth_login_source_key(): string {
    $address = @inet_pton($_SERVER['REMOTE_ADDR'] ?? '');
    return hash('sha256', "vz2-login\0" . ($address === false ? 'unknown' : $address));
}

// The caller holds the auth_settings row lock, also used by account changes.
function auth_check_login_limit(mysqli $db, string $sourceKey): void {
    $db->query('DELETE FROM auth_login_attempts WHERE expires_at <= UTC_TIMESTAMP()');
    $stmt = $db->prepare('SELECT failures, TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), expires_at) AS retry_after
        FROM auth_login_attempts WHERE source_key = ?');
    $stmt->bind_param('s', $sourceKey);
    $stmt->execute();
    $attempts = $stmt->get_result()->fetch_assoc();
    if ($attempts && (int) $attempts['failures'] >= 50) {
        throw new AuthLoginRateLimited((int) $attempts['retry_after']);
    }
}

function auth_record_login_failure(mysqli $db, string $sourceKey): void {
    $stmt = $db->prepare('INSERT INTO auth_login_attempts (source_key, failures, expires_at)
        VALUES (?, 1, DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE))
        ON DUPLICATE KEY UPDATE failures = failures + 1');
    $stmt->bind_param('s', $sourceKey);
    $stmt->execute();
}

function auth_login(string $username, string $password): bool {
    $username = auth_normalize_username($username);
    $validInput = auth_valid_username($username) && $password !== ''
        && strlen($password) <= 72 && strpos($password, "\0") === false;
    $db = auth_db();
    $db->begin_transaction();
    try {
        // Stejný zámek používají změny účtů; přihlášení neobnoví právě zrušený přístup.
        $guest = auth_settings($db, true);
        $sourceKey = auth_login_source_key();
        auth_check_login_limit($db, $sourceKey);
        $identity = null;
        if ($validInput) {
            if ($username === 'host') {
                if ((int) $guest['guest_enabled'] === 1 && $guest['guest_password_hash']) {
                    $identity = ['id' => null, 'name' => null, 'role' => 'host',
                        'password_hash' => $guest['guest_password_hash'], 'auth_generation' => $guest['guest_auth_generation']];
                }
            } else {
                $stmt = $db->prepare('SELECT id, name, role, password_hash, auth_generation FROM users WHERE username = ? AND active = 1');
                $stmt->bind_param('s', $username);
                $stmt->execute();
                $identity = $stmt->get_result()->fetch_assoc();
            }
            // Unknown/inactive accounts still perform a password verification.
            $hash = $identity['password_hash'] ?? '$2y$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
            if (!password_verify($password, $hash)) {
                $identity = null;
            }
        }
        if ($identity !== null && $identity['id'] !== null) {
            $id = (int) $identity['id'];
            $stmt = $db->prepare('UPDATE users SET last_login = NOW() WHERE id = ?');
            $stmt->bind_param('i', $id);
            $stmt->execute();
        } elseif ($identity === null) {
            auth_record_login_failure($db, $sourceKey);
        }
        $db->commit();
    } catch (Throwable $e) {
        $db->rollback();
        throw $e;
    }
    if ($identity === null) {
        return false;
    }
    if (!session_regenerate_id(true)) {
        throw new RuntimeException('Nepodařilo se obnovit session.');
    }
    $_SESSION['logged_in_single'] = true;
    $_SESSION['user_id'] = $identity['id'] === null ? null : (int) $identity['id'];
    $_SESSION['user_name'] = $identity['name'];
    $_SESSION['role'] = $identity['role'];
    $_SESSION['auth_fingerprint'] = auth_fingerprint($identity['password_hash'], (int) $identity['auth_generation']);
    unset($_SESSION['auth_csrf']);
    return true;
}

function auth_csrf_token(): string {
    if (empty($_SESSION['auth_csrf'])) {
        $_SESSION['auth_csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['auth_csrf'];
}

function auth_check_csrf(array $input): void {
    if (!isset($input['csrf']) || !is_string($input['csrf'])
        || !hash_equals(auth_csrf_token(), $input['csrf'])) {
        throw new InvalidArgumentException('Platnost formuláře vypršela. Obnovte stránku a zkuste to znovu.');
    }
}

function auth_input(array $input, string $key): string {
    if (isset($input[$key]) && !is_string($input[$key])) {
        throw new InvalidArgumentException('Neplatná hodnota formuláře.');
    }
    return $input[$key] ?? '';
}

function auth_validate_password(string $password, string $confirmation): void {
    // PASSWORD_DEFAULT nyní používá bcrypt, který rozlišuje jen prvních 72 bajtů.
    $length = preg_match_all('/./us', $password);
    if ($length === false || $length < 3 || trim($password) === '' || strlen($password) > 72
        || strpos($password, "\0") !== false) {
        throw new InvalidArgumentException('Heslo musí mít alespoň 3 znaky, nejvýše 72 bajtů a nesmí být tvořené jen mezerami.');
    }
    if ($password !== $confirmation) {
        throw new InvalidArgumentException('Hesla se neshodují.');
    }
}

function auth_check_duplicate(mysqli $db, string $password, array $guest, int $exceptId = 0, bool $forGuest = false): void {
    // Keep the old uniqueness rule until the password-only installation is retired.
    if (auth_username_login_finalized($guest)) return;
    $users = $db->query('SELECT id, password_hash FROM users WHERE active = 1');
    foreach ($users as $user) {
        if ((int) $user['id'] !== $exceptId && password_verify($password, $user['password_hash'])) {
            throw new InvalidArgumentException('Toto heslo již používá jiný přístup. Zvolte jiné heslo.');
        }
    }
    if (!$forGuest && (int) $guest['guest_enabled'] === 1 && $guest['guest_password_hash']
        && password_verify($password, $guest['guest_password_hash'])) {
        throw new InvalidArgumentException('Toto heslo již používá jiný přístup. Zvolte jiné heslo.');
    }
}

function auth_admin_count(mysqli $db): int {
    return (int) $db->query("SELECT COUNT(*) FROM users WHERE role = 'admin' AND active = 1")->fetch_row()[0];
}

// Volat pouze uvnitř transakce po uzamčení auth_settings.
function auth_save_member(mysqli $db, array $input, array $guest): int {
    $idText = auth_input($input, 'id');
    if ($idText !== '' && (!ctype_digit($idText) || (int) $idText < 1)) {
        throw new InvalidArgumentException('Neplatný člen.');
    }
    $id = (int) $idText;
    $username = auth_normalize_username(auth_input($input, 'username'));
    if (!auth_valid_username($username)) {
        throw new InvalidArgumentException('Uživatelské jméno musí mít 3 až 32 znaků, začínat písmenem nebo číslicí a obsahovat jen písmena bez diakritiky, číslice, tečku, pomlčku nebo podtržítko.');
    }
    if ($username === 'host') {
        throw new InvalidArgumentException('Uživatelské jméno host je vyhrazené pro hostovský přístup.');
    }
    $stmt = $db->prepare('SELECT id FROM users WHERE username = ? AND id <> ?');
    $stmt->bind_param('si', $username, $id);
    $stmt->execute();
    if ($stmt->get_result()->fetch_assoc()) {
        throw new InvalidArgumentException('Toto uživatelské jméno již používá jiný účet.');
    }
    $name = trim(auth_input($input, 'name'));
    $nameLength = preg_match_all('/./us', $name);
    if ($name === '' || $nameLength === false || $nameLength > 100) {
        throw new InvalidArgumentException('Jméno musí obsahovat 1 až 100 znaků.');
    }
    $role = auth_input($input, 'role');
    $active = auth_input($input, 'active') === '1' ? 1 : 0;
    if (!in_array($role, ['admin', 'muzikant'], true)) {
        throw new InvalidArgumentException('Neplatná role.');
    }
    $old = null;
    if ($id) {
        $stmt = $db->prepare('SELECT * FROM users WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $old = $stmt->get_result()->fetch_assoc();
        if (!$old) {
            throw new InvalidArgumentException('Člen již neexistuje.');
        }
    }
    if ($old && $old['role'] === 'admin' && (int) $old['active'] === 1
        && (!$active || $role !== 'admin') && auth_admin_count($db) <= 1) {
        throw new InvalidArgumentException('Musí zůstat alespoň jeden aktivní administrátor.');
    }
    $password = auth_input($input, 'password');
    $confirmation = auth_input($input, 'password_confirmation');
    if (!auth_username_login_finalized($guest) && $old && !(int) $old['active'] && $active && $password === '') {
        throw new InvalidArgumentException('Při aktivaci zadejte heslo a jeho potvrzení, abychom ověřili, že jej nepoužívá jiný přístup.');
    }
    $hash = $old['password_hash'] ?? '';
    if (!$old || $password !== '' || $confirmation !== '') {
        auth_validate_password($password, $confirmation);
        auth_check_duplicate($db, $password, $guest, $id);
        $hash = password_hash($password, PASSWORD_DEFAULT);
    }
    if ($id) {
        $generation = (int) $old['auth_generation'] + ((int) $old['active'] !== $active ? 1 : 0);
        $stmt = $db->prepare('UPDATE users SET username = ?, name = ?, role = ?, active = ?, password_hash = ?, auth_generation = ? WHERE id = ?');
        $stmt->bind_param('sssisii', $username, $name, $role, $active, $hash, $generation, $id);
    } else {
        $stmt = $db->prepare('INSERT INTO users (username, name, role, active, password_hash) VALUES (?, ?, ?, ?, ?)');
        $stmt->bind_param('sssis', $username, $name, $role, $active, $hash);
    }
    try {
        $stmt->execute();
    } catch (mysqli_sql_exception $e) {
        if ($e->getCode() !== 1062) throw $e;
        throw new InvalidArgumentException('Toto uživatelské jméno již používá jiný účet.');
    }
    return $id ?: (int) $db->insert_id;
}

// Only the reviewed application entry points may execute through this configuration.
function auth_vz2_entry_guard(): void {
    if (PHP_SAPI === 'cli') return;
    $root = realpath(dirname(__DIR__));
    $script = realpath($_SERVER['SCRIPT_FILENAME'] ?? '');
    $allowed = ['index.php','admin.php','help.php','prehled.php','useky.php','php/ajax/vz2.php',
        'php/ajax/vz2_files.php','php/ajax/vz2_timestamps.php','php/ajax/vz2_content.php',
        'php/ajax/vz2_peaks.php','php/ajax/vz2_history.php','php/ajax/vz2_overview.php','tools/vz2_preflight.php',
        'tools/vz2_storage_probe.php'];
    foreach ($allowed as $path) if ($script !== false && $script === realpath($root.'/'.$path)) return;
    http_response_code(410);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    exit('{"ok":false,"error":"Tato instalace používá VZ2. Otevřete index.php."}');
}

function auth_save_guest(mysqli $db, array $input, array $guest): void {
    $enabled = auth_input($input, 'guest_enabled') === '1' ? 1 : 0;
    $password = auth_input($input, 'password');
    $confirmation = auth_input($input, 'password_confirmation');
    $hash = $guest['guest_password_hash'];
    if ($enabled && (!$hash || (!auth_username_login_finalized($guest) && !(int) $guest['guest_enabled'])) && $password === '') {
        throw new InvalidArgumentException('Při zapnutí hosta zadejte heslo a jeho potvrzení.');
    }
    if ($password !== '' || $confirmation !== '') {
        auth_validate_password($password, $confirmation);
        auth_check_duplicate($db, $password, $guest, 0, true);
        $hash = password_hash($password, PASSWORD_DEFAULT);
    }
    $generation = (int) $guest['guest_auth_generation'] + ((int) $guest['guest_enabled'] !== $enabled ? 1 : 0);
    $stmt = $db->prepare('UPDATE auth_settings SET guest_enabled = ?, guest_password_hash = ?, guest_auth_generation = ? WHERE id = 1');
    $stmt->bind_param('isi', $enabled, $hash, $generation);
    $stmt->execute();
}

function auth_h(?string $value): string {
    return htmlspecialchars($value ?? '', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
