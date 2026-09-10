<?php
// CLI integrační test skutečných PHP stránek proti oddělené lokální MariaDB.
// AUTH_TEST_DB_PORT je povinný; společná konfigurace připojení se nikdy nepoužije.
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit;
}
$port = (int) getenv('AUTH_TEST_DB_PORT');
$suite = getenv('AUTH_TEST_SUITE') ?: 'all';
if (!in_array($suite, ['all', 'bootstrap', 'guest', 'lifecycle'], true)) {
    exit("AUTH_TEST_SUITE: all, bootstrap, guest nebo lifecycle.\n");
}
if ($port < 1024 || $port > 65535 || $port === 3306) {
    exit("Nastavte AUTH_TEST_DB_PORT na port samostatné lokální testovací MariaDB (nikoli 3306).\n");
}
mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
$db = new mysqli('127.0.0.1', getenv('AUTH_TEST_DB_USER') ?: 'root', getenv('AUTH_TEST_DB_PASS') ?: '', '', $port);
$dbName = 'zkusebna_auth_test_' . bin2hex(random_bytes(6));
$db->query("CREATE DATABASE `$dbName` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
$db->select_db($dbName);
$db->set_charset('utf8mb4');
$root = dirname(__DIR__);
$temp = sys_get_temp_dir() . '/' . $dbName;
mkdir($temp);
$server = null;
$passed = 0;

function check(bool $ok, string $label): void {
    global $passed;
    if (!$ok) {
        throw new RuntimeException('FAIL: ' . $label);
    }
    $passed++;
    echo "OK: $label\n";
}

function request(array &$client, string $path, ?array $post = null): array {
    global $httpPort;
    $headers = "Connection: close\r\n";
    if (!empty($client['cookie'])) {
        $headers .= 'Cookie: ' . $client['cookie'] . "\r\n";
    }
    if ($post !== null) {
        $headers .= "Content-Type: application/x-www-form-urlencoded\r\n";
    }
    $context = stream_context_create(['http' => [
        'method' => $post === null ? 'GET' : 'POST', 'header' => $headers,
        'content' => $post === null ? '' : http_build_query($post),
        'ignore_errors' => true, 'follow_location' => 0, 'timeout' => 15,
    ]]);
    $stream = fopen("http://127.0.0.1:$httpPort/$path", 'r', false, $context);
    if (!$stream) {
        throw new RuntimeException('HTTP request failed');
    }
    $body = stream_get_contents($stream);
    $responseHeaders = stream_get_meta_data($stream)['wrapper_data'];
    fclose($stream);
    preg_match('/\s(\d{3})\s/', $responseHeaders[0], $status);
    $location = '';
    foreach ($responseHeaders as $header) {
        if (preg_match('/^Set-Cookie: (PHPSESSID=[^;]*)/i', $header, $match)) {
            $client['cookie'] = $match[1];
        }
        if (stripos($header, 'Location: ') === 0) {
            $location = substr($header, 10);
        }
    }
    return ['status' => (int) $status[1], 'body' => $body, 'location' => $location];
}

function token(array &$client, string $page = 'admin.php'): string {
    $response = request($client, $page);
    if (!preg_match('/name="csrf" value="([a-f0-9]+)"/', $response['body'], $match)) {
        throw new RuntimeException('Missing CSRF token: ' . $page);
    }
    return $match[1];
}

function member(string $name, string $password, string $role = 'muzikant', string $id = '', bool $active = true): array {
    return ['action' => 'member', 'id' => $id, 'name' => $name, 'role' => $role,
        'active' => $active ? '1' : '0', 'password' => $password, 'password_confirmation' => $password];
}

function save(array &$client, array $fields): array {
    return request($client, 'admin.php', ['csrf' => token($client)] + $fields);
}

function login(array &$client, string $password): array {
    return request($client, 'index.php', ['submit_single' => 'VSTOUPIT', 'heslo' => $password]);
}

try {
    $db->multi_query(file_get_contents($root . '/migrations/001_personal_accounts.sql'));
    do {
        if ($result = $db->store_result()) {
            $result->free();
        }
    } while ($db->more_results() && $db->next_result());
    check((int) $db->query('SELECT guest_enabled FROM auth_settings WHERE id = 1')->fetch_row()[0] === 0, 'migration disables guest');

    foreach (['config.php', 'index.php', 'admin.php', 'create_first_admin.php', 'php/auth.php',
        'php/loginbox4.php', 'php/login/connect.php', 'php/modals.php', 'css/help.css', 'css/admin.css'] as $file) {
        if (!is_dir(dirname($temp . '/' . $file))) {
            mkdir(dirname($temp . '/' . $file), 0777, true);
        }
        copy($root . '/' . $file, $temp . '/' . $file);
    }
    $config = file_get_contents($root . '/config.php');
    $values = ['DB_HOST' => '127.0.0.1:' . $port, 'DB_USER' => getenv('AUTH_TEST_DB_USER') ?: 'root',
        'DB_PASS' => getenv('AUTH_TEST_DB_PASS') ?: '', 'DB_NAME' => $dbName,
        'SITE_URL' => 'http://127.0.0.1', 'MAIL_FROM' => 'test@example.invalid'];
    foreach ($values as $key => $value) {
        $config = preg_replace_callback("/define\('" . $key . "',.*?\);/", static function () use ($key, $value) {
            return "define('$key', " . var_export($value, true) . ');';
        }, $config);
    }
    // Fáze A: původní config bez nového session hooku, již přihlášený starý admin.
    $legacyConfig = strstr($config, '// Osobní účty:', true);
    if ($legacyConfig === false) {
        throw new RuntimeException('Missing config migration boundary');
    }
    file_put_contents($temp . '/config.php', $legacyConfig);
    file_put_contents($temp . '/_legacy_session.php', '<?php session_start(); $_SESSION = ["logged_in_single" => true, "role" => "admin"];');
    file_put_contents($temp . '/_test_session.php', '<?php session_start(); require "config.php"; header("Content-Type: application/json"); echo json_encode(["logged" => $_SESSION["logged_in_single"] ?? false, "id" => $_SESSION["user_id"] ?? null, "name" => $_SESSION["user_name"] ?? null, "role" => $_SESSION["role"] ?? null, "edit" => ma_pravo("edit_text"), "delete" => ma_pravo("delete_val")]);');
    $socket = stream_socket_server('tcp://127.0.0.1:0');
    $httpPort = (int) substr(strrchr(stream_socket_get_name($socket, false), ':'), 1);
    fclose($socket);
    $command = [PHP_BINARY];
    if (php_ini_loaded_file()) {
        array_push($command, '-c', php_ini_loaded_file());
    }
    array_push($command, '-d', 'session.save_path=' . $temp, '-d', 'max_execution_time=0',
        '-d', 'opcache.enable=0', '-S', '127.0.0.1:' . $httpPort, '-t', $temp);
    $server = proc_open($command, [0 => ['pipe', 'r'], 1 => ['file', $temp . '/server.log', 'a'], 2 => ['file', $temp . '/server.log', 'a']], $pipes, $temp);
    fclose($pipes[0]);
    for ($i = 0; $i < 50; $i++) {
        $ready = @fsockopen('127.0.0.1', $httpPort);
        if ($ready) { fclose($ready); break; }
        usleep(100000);
    }
    $anonymous = [];
    if (in_array($suite, ['all', 'bootstrap'], true)) {
    check(request($anonymous, 'create_first_admin.php')['status'] === 403, 'bootstrap rejects anonymous GET');
    check(request($anonymous, 'create_first_admin.php', member('Intruder', 'password123'))['status'] === 403, 'bootstrap rejects anonymous POST');
    $admin = [];
    request($admin, '_legacy_session.php');
    $first = member('Dušan', 'Admin-secret-1', 'admin');
    check(request($admin, 'create_first_admin.php', $first)['status'] === 422, 'bootstrap rejects missing CSRF');
    $bootstrapToken = token($admin, 'create_first_admin.php');
    check(request($admin, 'create_first_admin.php', ['csrf' => $bootstrapToken] + $first)['status'] === 303, 'legacy admin session creates first admin');
    check(request($admin, 'create_first_admin.php', ['csrf' => $bootstrapToken] + $first)['status'] === 422, 'bootstrap cannot create second first admin');
    check((int) $db->query('SELECT COUNT(*) FROM users')->fetch_row()[0] === 1, 'bootstrap created exactly one user');

    // Fáze B: skutečný nový config a login, zbytek testů jde přes skutečný admin.php.
    file_put_contents($temp . '/config.php', $config);
    check(request($admin, 'admin.php')['status'] === 403, 'cutover invalidates legacy session');
    request($admin, 'index.php?val=test&nahravka=song.mp3&time=12');
    $oldCookie = $admin['cookie'];
    $response = login($admin, 'Admin-secret-1');
    check($response['status'] === 302 && $admin['cookie'] !== $oldCookie, 'admin login regenerates session ID');
    check($response['location'] === '/index.php?val=test&nahravka=song.mp3&time=12', 'login preserves local deep link');
    $identity = json_decode(request($admin, '_test_session.php')['body'], true);
    check($identity === ['logged' => true, 'id' => 1, 'name' => 'Dušan', 'role' => 'admin', 'edit' => true, 'delete' => true], 'admin identity and existing permissions');
    check($db->query('SELECT last_login FROM users WHERE id = 1')->fetch_row()[0] !== null, 'successful member login updates last_login');
    check(strpos(request($admin, 'index.php')['body'], 'href="admin.php"') !== false, 'admin menu visible');
    check(request($admin, 'admin.php', member('Bad CSRF', 'Other-secret-1'))['status'] === 422, 'admin action requires CSRF');
    check(save($admin, member('Dušan', '', 'muzikant', '1'))['status'] === 422, 'last admin cannot be demoted');
    check(save($admin, member('Dušan', '', 'admin', '1', false))['status'] === 422, 'last admin cannot be deactivated');
    check(save($admin, member('Petr', 'Admin-secret-1'))['status'] === 422, 'duplicate member password rejected');
    check(save($admin, member('Petr', 'short'))['status'] === 422, 'short password rejected');
    check(save($admin, member('Petr', str_repeat('a', 73)))['status'] === 422, 'bcrypt truncation prevented');
    check(save($admin, member('Petr', 'Musician-secret-1'))['status'] === 303, 'member creation');
    $musicianId = (string) $db->query("SELECT id FROM users WHERE name = 'Petr'")->fetch_row()[0];
    $musician = [];
    request($musician, 'index.php');
    check(login($musician, 'Musician-secret-1')['status'] === 302, 'musician login');
    $identity = json_decode(request($musician, '_test_session.php')['body'], true);
    check($identity['role'] === 'muzikant' && $identity['name'] === 'Petr' && $identity['edit'] && !$identity['delete'], 'musician identity and permissions');
    foreach (['admin.php', 'create_first_admin.php'] as $page) {
        check(request($musician, $page)['status'] === 403 && request($musician, $page, member('Blocked', 'Blocked-secret'))['status'] === 403, 'musician denied GET and POST ' . $page);
    }
    check(strpos(request($musician, 'index.php')['body'], 'href="admin.php"') === false, 'admin menu hidden for musician');
    check(save($admin, member('<b>Petr</b> 🎸', '', 'muzikant', $musicianId))['status'] === 303, 'rename supports utf8mb4');
    check(strpos(request($admin, 'admin.php')['body'], '&lt;b&gt;Petr&lt;/b&gt; 🎸') !== false, 'names escaped in HTML');
    } else {
        // Samostatné skupiny začínají dvěma účty v nové izolované databázi.
        // Bootstrap a jeho HTTP autorizaci pokrývá skupina bootstrap.
        $stmt = $db->prepare('INSERT INTO users (name, role, password_hash) VALUES (?, ?, ?)');
        foreach ([['Dušan', 'admin', 'Admin-secret-1'], ['Petr', 'muzikant', 'Musician-secret-1']] as $seed) {
            $hash = password_hash($seed[2], PASSWORD_DEFAULT);
            $stmt->bind_param('sss', $seed[0], $seed[1], $hash);
            $stmt->execute();
        }
        file_put_contents($temp . '/config.php', $config);
        $admin = [];
        $musician = [];
        $musicianId = '2';
        check(login($admin, 'Admin-secret-1')['status'] === 302, 'fixture admin login');
        check(login($musician, 'Musician-secret-1')['status'] === 302, 'fixture musician login');
    }
    if (in_array($suite, ['all', 'guest'], true)) {
    check(save($admin, ['action' => 'guest', 'guest_enabled' => '1'])['status'] === 422, 'guest cannot enable without password');
    check(save($admin, ['action' => 'guest', 'guest_enabled' => '1', 'password' => 'Musician-secret-1', 'password_confirmation' => 'Musician-secret-1'])['status'] === 422, 'guest rejects member password');
    $guestFields = ['action' => 'guest', 'guest_enabled' => '1', 'password' => 'Guest-secret-1', 'password_confirmation' => 'Guest-secret-1'];
    check(save($admin, $guestFields)['status'] === 303, 'guest password and enable');
    file_put_contents($temp . '/admin-preview.html', request($admin, 'admin.php')['body']);
    check(save($admin, member('Collision', 'Guest-secret-1'))['status'] === 422, 'member rejects enabled guest password');
    $guestClient = [];
    request($guestClient, 'index.php');
    $oldCookie = $guestClient['cookie'];
    check(login($guestClient, 'Guest-secret-1')['status'] === 302 && $guestClient['cookie'] !== $oldCookie, 'guest login regenerates session ID');
    $identity = json_decode(request($guestClient, '_test_session.php')['body'], true);
    check($identity === ['logged' => true, 'id' => null, 'name' => null, 'role' => 'host', 'edit' => false, 'delete' => false], 'guest has no member identity or write permissions');
    check(request($guestClient, 'admin.php')['status'] === 403 && request($guestClient, 'admin.php', $guestFields)['status'] === 403, 'guest denied admin GET and POST');
    check(save($admin, ['action' => 'guest'])['status'] === 303, 'guest disabled without password');
    check(request($guestClient, 'admin.php')['status'] === 403 && !json_decode(request($guestClient, '_test_session.php')['body'], true)['logged'], 'disabled guest session invalidated');
    $failed = [];
    check(login($failed, 'Guest-secret-1')['status'] === 200, 'disabled guest cannot log in');
    check(save($admin, member('Uses old guest password', 'Guest-secret-1'))['status'] === 303, 'disabled guest password can be reused by member');
    check(save($admin, $guestFields)['status'] === 422, 'guest reenable catches reused password');
    }
    if (in_array($suite, ['all', 'lifecycle'], true)) {
    $failed = [];
    check(save($admin, member('Petr', '', 'muzikant', $musicianId, false))['status'] === 303, 'member deactivation');
    check(!json_decode(request($musician, '_test_session.php')['body'], true)['logged'], 'deactivated member session invalidated');
    check(login($failed, 'Musician-secret-1')['status'] === 200, 'inactive member cannot log in');
    check(save($admin, member('Reused inactive password', 'Musician-secret-1'))['status'] === 303, 'inactive password can be reused');
    check(save($admin, member('Petr', '', 'muzikant', $musicianId))['status'] === 422, 'reactivation requires password verification');
    check(save($admin, member('Petr', 'Musician-secret-1', 'muzikant', $musicianId))['status'] === 422, 'reactivation rejects reused password');
    check(save($admin, member('Petr', 'Musician-secret-2', 'muzikant', $musicianId))['status'] === 303, 'reactivation with unique password');
    check(login($musician, 'Musician-secret-2')['status'] === 302, 'reactivated member login');
    check(save($admin, member('Petr', 'Musician-secret-3', 'muzikant', $musicianId))['status'] === 303, 'member password reset');
    check(!json_decode(request($musician, '_test_session.php')['body'], true)['logged'], 'password reset invalidates existing session');
    check(save($admin, member('Petr', '', 'admin', $musicianId))['status'] === 303, 'promote second admin');
    check(login($musician, 'Musician-secret-3')['status'] === 302, 'second admin login');
    check(save($admin, member('Dušan', '', 'muzikant', '1'))['status'] === 303, 'self demotion allowed with another admin');
    check(request($admin, 'admin.php')['status'] === 403, 'demoted admin loses admin access');
    check(save($musician, member('Petr', '', 'admin', $musicianId, false))['status'] === 422, 'new last admin still protected');
    check(save($musician, member('Petr', 'Final-admin-secret', 'admin', $musicianId))['status'] === 303, 'self password reset');
    check(request($musician, 'admin.php')['status'] === 403, 'self password reset requires login');
    check(login($musician, 'Final-admin-secret')['status'] === 302, 'new admin password works');
    }
    check(request($anonymous, 'admin.php')['status'] === 403 && request($anonymous, 'admin.php', member('Anon', 'Anonymous-secret'))['status'] === 403, 'anonymous denied admin GET and POST');
    foreach ($db->query('SELECT password_hash FROM users') as $row) {
        check(password_get_info($row['password_hash'])['algoName'] !== 'unknown', 'stored member password is a password_hash');
    }
    echo "PASS ($suite): $passed checks. Temporary fixture: $temp\n";
} finally {
    if (is_resource($server)) {
        proc_terminate($server);
        proc_close($server);
    }
    // Výhradně náhodná databáze vytvořená tímto testem, nikdy tabulky aplikace.
    $db->query("DROP DATABASE `$dbName`");
    $db->close();
}
