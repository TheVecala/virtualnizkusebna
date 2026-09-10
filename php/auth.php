<?php
// Malé společné funkce pro login, administraci a dočasný bootstrap.
// Volající nejprve načte config.php. Žádná automatická inicializace databáze.
function auth_db(): mysqli {
    static $db = null;
    if ($db === null) {
        mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
        require __DIR__ . '/login/connect.php';
        $mysqli->set_charset('utf8mb4');
        $db = $mysqli;
    }
    return $db;
}

function auth_is_admin(): bool {
    return ($_SESSION['logged_in_single'] ?? null) === true
        && ($_SESSION['role'] ?? null) === 'admin';
}

function auth_require_admin(): void {
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

// V endpointech načítajících config.php se zde promítne deaktivace,
// změna role/hesla i vypnutí hosta, aniž by se přepisovaly jeho kontroly práv.
function auth_refresh_session(): void {
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
            || !hash_equals($_SESSION['auth_fingerprint'], hash('sha256', $hash))) {
            auth_forget_identity();
        }
        return;
    }
    $id = (int) $_SESSION['user_id'];
    $stmt = $db->prepare('SELECT id, name, role, password_hash FROM users WHERE id = ? AND active = 1');
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    if (!$user || !hash_equals($_SESSION['auth_fingerprint'], hash('sha256', $user['password_hash']))) {
        auth_forget_identity();
        return;
    }
    $_SESSION['user_name'] = $user['name'];
    $_SESSION['role'] = $user['role'];
}

function auth_login(string $password): bool {
    if ($password === '' || strlen($password) > 72 || strpos($password, "\0") !== false) {
        return false;
    }
    $db = auth_db();
    $db->begin_transaction();
    try {
        // Stejný zámek používají změny účtů; přihlášení neobnoví právě zrušený přístup.
        $guest = auth_settings($db, true);
        $users = $db->query('SELECT id, name, role, password_hash FROM users WHERE active = 1');
        $identity = null;
        foreach ($users as $user) {
            if (password_verify($password, $user['password_hash'])) {
                $identity = $user;
                break;
            }
        }
        if ($identity !== null) {
            $id = (int) $identity['id'];
            $stmt = $db->prepare('UPDATE users SET last_login = NOW() WHERE id = ?');
            $stmt->bind_param('i', $id);
            $stmt->execute();
        } elseif ((int) $guest['guest_enabled'] === 1 && $guest['guest_password_hash']
            && password_verify($password, $guest['guest_password_hash'])) {
            $identity = ['id' => null, 'name' => null, 'role' => 'host',
                'password_hash' => $guest['guest_password_hash']];
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
    $_SESSION['auth_fingerprint'] = hash('sha256', $identity['password_hash']);
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
    if ($length === false || $length < 8 || trim($password) === '' || strlen($password) > 72
        || strpos($password, "\0") !== false) {
        throw new InvalidArgumentException('Heslo musí mít alespoň 8 znaků, nejvýše 72 bajtů a nesmí být tvořené jen mezerami.');
    }
    if ($password !== $confirmation) {
        throw new InvalidArgumentException('Hesla se neshodují.');
    }
}

function auth_check_duplicate(mysqli $db, string $password, array $guest, int $exceptId = 0, bool $forGuest = false): void {
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

// Volat pouze uvnitř transakce po uzamčení auth_settings (platí i pro bootstrap).
function auth_save_member(mysqli $db, array $input, array $guest, bool $firstAdmin = false): void {
    $idText = auth_input($input, 'id');
    if ($idText !== '' && (!ctype_digit($idText) || (int) $idText < 1)) {
        throw new InvalidArgumentException('Neplatný člen.');
    }
    $id = $firstAdmin ? 0 : (int) $idText;
    $name = trim(auth_input($input, 'name'));
    $nameLength = preg_match_all('/./us', $name);
    if ($name === '' || $nameLength === false || $nameLength > 100) {
        throw new InvalidArgumentException('Jméno musí obsahovat 1 až 100 znaků.');
    }
    $role = $firstAdmin ? 'admin' : auth_input($input, 'role');
    $active = $firstAdmin || auth_input($input, 'active') === '1' ? 1 : 0;
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
    if ($old && !(int) $old['active'] && $active && $password === '') {
        throw new InvalidArgumentException('Při aktivaci zadejte heslo a jeho potvrzení, abychom ověřili, že jej nepoužívá jiný přístup.');
    }
    $hash = $old['password_hash'] ?? '';
    if (!$old || $password !== '' || $confirmation !== '') {
        auth_validate_password($password, $confirmation);
        auth_check_duplicate($db, $password, $guest, $id);
        $hash = password_hash($password, PASSWORD_DEFAULT);
    }
    if ($id) {
        $stmt = $db->prepare('UPDATE users SET name = ?, role = ?, active = ?, password_hash = ? WHERE id = ?');
        $stmt->bind_param('ssisi', $name, $role, $active, $hash, $id);
    } else {
        $stmt = $db->prepare('INSERT INTO users (name, role, active, password_hash) VALUES (?, ?, ?, ?)');
        $stmt->bind_param('ssis', $name, $role, $active, $hash);
    }
    $stmt->execute();
}

function auth_save_guest(mysqli $db, array $input, array $guest): void {
    $enabled = auth_input($input, 'guest_enabled') === '1' ? 1 : 0;
    $password = auth_input($input, 'password');
    $confirmation = auth_input($input, 'password_confirmation');
    $hash = $guest['guest_password_hash'];
    if ($enabled && (!(int) $guest['guest_enabled'] || !$hash) && $password === '') {
        throw new InvalidArgumentException('Při zapnutí hosta zadejte heslo a jeho potvrzení pro kontrolu shody s ostatními přístupy.');
    }
    if ($password !== '' || $confirmation !== '') {
        auth_validate_password($password, $confirmation);
        auth_check_duplicate($db, $password, $guest, 0, true);
        $hash = password_hash($password, PASSWORD_DEFAULT);
    }
    $stmt = $db->prepare('UPDATE auth_settings SET guest_enabled = ?, guest_password_hash = ? WHERE id = 1');
    $stmt->bind_param('is', $enabled, $hash);
    $stmt->execute();
}

function auth_h(?string $value): string {
    return htmlspecialchars($value ?? '', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
