<?php
// CLI integrační test skutečných PHP stránek proti oddělené lokální MariaDB.
// AUTH_TEST_DB_PORT je povinný; společná konfigurace připojení se nikdy nepoužije.
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit;
}
$port = (int) getenv('AUTH_TEST_DB_PORT');
$suite = getenv('AUTH_TEST_SUITE') ?: 'all';
if (!in_array($suite, ['all', 'guest', 'lifecycle'], true)) {
    exit("AUTH_TEST_SUITE: all, guest nebo lifecycle.\n");
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
$root = dirname(__DIR__, 2);
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

function request(array &$client, string $path, ?array $post = null, array $options = []): array {
    global $httpPort;
    $headers = "Connection: close\r\n";
    if (!empty($client['cookie'])) {
        $headers .= 'Cookie: ' . $client['cookie'] . "\r\n";
    }
    if ($post !== null) {
        $headers .= "Content-Type: application/x-www-form-urlencoded\r\n";
    }
    foreach ($options['headers'] ?? [] as $name => $value) $headers .= "$name: $value\r\n";
    $context = stream_context_create(['http' => [
        'method' => $post === null ? 'GET' : 'POST', 'header' => $headers,
        'content' => $post === null ? '' : http_build_query($post),
        'ignore_errors' => true, 'follow_location' => 0, 'timeout' => 15,
    ], 'socket' => isset($options['source']) ? ['bindto' => $options['source'] . ':0'] : []]);
    $stream = fopen("http://127.0.0.1:$httpPort/$path", 'r', false, $context);
    if (!$stream) {
        throw new RuntimeException('HTTP request failed');
    }
    $body = stream_get_contents($stream);
    $responseHeaders = stream_get_meta_data($stream)['wrapper_data'];
    fclose($stream);
    preg_match('/\s(\d{3})\s/', $responseHeaders[0], $status);
    $location = '';
    $retryAfter = null;
    foreach ($responseHeaders as $header) {
        if (preg_match('/^Set-Cookie: (PHPSESSID=[^;]*)/i', $header, $match)) {
            $client['cookie'] = $match[1];
        }
        if (stripos($header, 'Location: ') === 0) {
            $location = substr($header, 10);
        }
        if (stripos($header, 'Retry-After: ') === 0) $retryAfter = (int) substr($header, 13);
    }
    return ['status' => (int) $status[1], 'body' => $body, 'location' => $location, 'retry_after' => $retryAfter];
}

function token(array &$client, string $page = 'admin.php'): string {
    $response = request($client, $page);
    if (!preg_match('/name="csrf" value="([a-f0-9]+)"/', $response['body'], $match)) {
        throw new RuntimeException('Missing CSRF token: ' . $page);
    }
    return $match[1];
}

function member(string $name, string $password, string $role = 'muzikant', string $id = '', bool $active = true, ?string $username = null): array {
    $username ??= match ($id) { '1' => 'dusan', '2' => 'petr', default => 'test-' . substr(hash('sha256', $name), 0, 12) };
    return ['action' => 'member', 'id' => $id, 'username' => $username, 'name' => $name, 'role' => $role,
        'active' => $active ? '1' : '0', 'password' => $password, 'password_confirmation' => $password];
}

function save(array &$client, array $fields): array {
    return request($client, 'admin.php', ['csrf' => token($client)] + $fields);
}

function login(array &$client, string $username, string $password): array {
    return request($client, 'index.php', ['submit_single' => 'VSTOUPIT', 'username' => $username, 'heslo' => $password]);
}

try {
    $db->multi_query(file_get_contents($root . '/_pomocne/migrations/001_personal_accounts.sql'));
    do {
        if ($result = $db->store_result()) {
            $result->free();
        }
    } while ($db->more_results() && $db->next_result());
    check((int) $db->query('SELECT guest_enabled FROM auth_settings WHERE id = 1')->fetch_row()[0] === 0, 'migration disables guest');

    foreach (['index.php', 'admin.php', 'config.theme.php', 'php/auth.php', 'php/inc/session.php',
        'php/loginbox4.php', 'php/login/connect.php', 'php/inc/admin_storage.php',
        'php/inc/admin_storage_view.php', 'php/inc/vz2_core.php', 'css/themes.css', 'css/vz2.css',
        'js/multitrack.js', 'js/vz2-song-map.js', 'js/vz2-song-map-model.js', 'css/help.css', 'css/admin.css'] as $file) {
        if (!is_dir(dirname($temp . '/' . $file))) mkdir(dirname($temp . '/' . $file), 0777, true);
        copy($root . '/' . $file, $temp . '/' . $file);
    }
    $config = "<?php\nrequire_once __DIR__ . '/config.theme.php';\n";
    foreach (['DB_HOST'=>'127.0.0.1:' . $port, 'DB_USER'=>getenv('AUTH_TEST_DB_USER') ?: 'root',
        'DB_PASS'=>getenv('AUTH_TEST_DB_PASS') ?: '', 'DB_NAME'=>$dbName,
        'SITE_URL'=>'http://127.0.0.1', 'VZ2_ENABLED'=>true, 'VZ2_WRITES_ENABLED'=>true,
        'VZ2_ENVIRONMENT'=>'beta', 'VZ2_DATASET_KEY'=>'auth-test-dataset'] as $key=>$value) {
        $config .= "define('$key', " . var_export($value, true) . ");\n";
    }
    $config .= 'function ma_pravo(string $p): bool { return in_array($p, ["admin"=>["edit_text","delete_val"],"muzikant"=>["edit_text"]][$_SESSION["role"] ?? ""] ?? [], true); } require_once __DIR__."/php/auth.php"; auth_refresh_session();';
    file_put_contents($temp . '/config.php', $config);
    foreach (['002_vz2.sql','003_vz2_discussion_body.sql','004_vz2_song_map.sql','005_vz2_rehearsal_history.sql','006_vz2_rehearsal_starts.sql'] as $migration) {
        $db->multi_query(file_get_contents($root . '/_pomocne/migrations/' . $migration));
        do { if ($result = $db->store_result()) $result->free(); } while ($db->more_results() && $db->next_result());
    }
    mkdir($temp . '/tools');
    file_put_contents($temp . '/_legacy_session.php', '<?php session_start(); $_SESSION = ["logged_in_single" => true, "role" => "admin"];');
    // Identity probe exists only in this disposable fixture, at an allowed diagnostics entry.
    file_put_contents($temp . '/tools/vz2_preflight.php', '<?php session_start(); require dirname(__DIR__)."/config.php"; header("Content-Type: application/json"); echo json_encode(["logged" => $_SESSION["logged_in_single"] ?? false, "id" => $_SESSION["user_id"] ?? null, "name" => $_SESSION["user_name"] ?? null, "role" => $_SESSION["role"] ?? null, "edit" => ma_pravo("edit_text"), "delete" => ma_pravo("delete_val")]);');
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
    $stmt = $db->prepare('INSERT INTO users (name, role, password_hash) VALUES (?, ?, ?)');
    foreach ([['Dušan', 'admin', 'Admin-secret-1'], ['Petr', 'muzikant', 'Musician-secret-1']] as $seed) {
        $hash = password_hash($seed[2], PASSWORD_DEFAULT);
        $stmt->bind_param('sss', $seed[0], $seed[1], $hash);
        $stmt->execute();
    }
    $stmt = $db->prepare("INSERT INTO users (name, role, password_hash, active) VALUES ('Petr', 'muzikant', ?, 0)");
    $inactiveHash = password_hash('Inactive-before-migration', PASSWORD_DEFAULT);
    $stmt->bind_param('s', $inactiveHash);
    $stmt->execute();
    $beforeMigration = $db->query('SELECT id,name,role,password_hash,active FROM users ORDER BY id')->fetch_all(MYSQLI_ASSOC);
    $db->multi_query(file_get_contents($root . '/_pomocne/migrations/007_login_usernames.sql'));
    do { if ($result = $db->store_result()) $result->free(); } while ($db->more_results() && $db->next_result());
    check($beforeMigration === $db->query('SELECT id,name,role,password_hash,active FROM users ORDER BY id')->fetch_all(MYSQLI_ASSOC), 'migration preserves account IDs, display names, roles and password hashes');
    check(array_column($db->query('SELECT username FROM users ORDER BY id')->fetch_all(MYSQLI_ASSOC), 'username') === ['clen-1','clen-2','clen-3'], 'migration assigns unique usernames even to inactive namesakes');
    check((int) $db->query('SELECT username_login_finalized FROM auth_settings WHERE id=1')->fetch_row()[0] === 0, 'expansion keeps password uniqueness during mixed deployment');
    $db->query("UPDATE users SET username='dusan' WHERE id=1");
    $db->query("UPDATE users SET username='petr' WHERE id=2");
    foreach (["UPDATE users SET username='DUSAN' WHERE id=2", "UPDATE users SET username='host' WHERE id=2",
        "UPDATE users SET username=CONCAT('petr', CHAR(10)) WHERE id=2"] as $invalidSql) {
        $rejected = false;
        try { $db->query($invalidSql); } catch (mysqli_sql_exception $e) { $rejected = in_array($e->getCode(), [1062, 4025], true); }
        check($rejected, 'database independently enforces username uniqueness, reservation and syntax');
    }
    $personalSession = ['logged_in_single'=>true, 'user_id'=>1, 'user_name'=>'Dušan', 'role'=>'admin',
        'auth_fingerprint'=>hash('sha256', $beforeMigration[0]['password_hash'])];
    file_put_contents($temp . '/_personal_session.php', '<?php session_start(); $_SESSION = ' . var_export($personalSession, true) . ';');
    file_put_contents($temp . '/config.php', $config);
    $admin = [];
    $musician = [];
    $musicianId = '2';
    check(login($admin, 'dusan', 'Admin-secret-1')['status'] === 302, 'fixture admin login');
    check(login($musician, 'petr', 'Musician-secret-1')['status'] === 302, 'fixture musician login');
    $existingPersonal = [];
    request($existingPersonal, '_personal_session.php');
    check(request($existingPersonal, 'admin.php')['status'] === 200, 'existing personal session survives additive migration');
    $failed = [];
    check(request($failed, 'index.php', ['submit_single'=>'1','heslo'=>'Admin-secret-1'])['status'] === 200, 'password alone no longer logs in');
    check(request($failed, 'admin.php')['status'] === 403, 'password-only request has no authenticated identity');
    $unknown = login($failed, 'nobody', 'Admin-secret-1');
    $wrong = login($failed, 'dusan', 'Musician-secret-1');
    check($unknown['status'] === 200 && $wrong['status'] === 200
        && str_contains($unknown['body'], 'Nesprávné uživatelské jméno nebo heslo.')
        && str_contains($wrong['body'], 'Nesprávné uživatelské jméno nebo heslo.'), 'wrong username and password use the same generic error');
    check(str_contains($wrong['body'], 'value="dusan"') && !str_contains($wrong['body'], 'Musician-secret-1'), 'failed form preserves username but never password');
    file_put_contents($temp . '/login-error-preview.html', $wrong['body']);
    $caseClient = [];
    check(login($caseClient, '  DuSaN  ', 'Admin-secret-1')['status'] === 302, 'username matching ignores case and surrounding spaces');
    check($db->query('SELECT last_login FROM users WHERE id=1')->fetch_row()[0] !== null, 'successful member login records last_login');
    foreach (['host', 'HOST', 'dušan', 'ab', 'two words', str_repeat('a', 33)] as $badUsername) {
        check(save($admin, member('Invalid username', 'abc', 'muzikant', '', true, $badUsername))['status'] === 422, 'invalid or reserved username rejected: ' . $badUsername);
    }
    check(save($admin, member('Duplicate username', 'Other-secret-1', 'muzikant', '', true, 'DuSaN'))['status'] === 422, 'username uniqueness is case-insensitive');
    check(save($admin, member('Inactive namesake', 'Inactive-secret', 'muzikant', '', false, 'reserved-name'))['status'] === 303, 'inactive account has its own username');
    check(save($admin, member('Active namesake', 'Other-secret-1', 'muzikant', '', true, 'RESERVED-NAME'))['status'] === 422, 'inactive usernames remain reserved');
    $oldHash = $db->query('SELECT password_hash FROM users WHERE id=1')->fetch_row()[0];
    check(save($admin, member('Dušan', '', 'admin', '1', true, 'dusan-new'))['status'] === 303, 'username can be changed without resetting the password');
    check($db->query('SELECT password_hash FROM users WHERE id=1')->fetch_row()[0] === $oldHash, 'username change preserves the password hash');
    $renamed = [];
    check(login($renamed, 'dusan', 'Admin-secret-1')['status'] === 200 && login($renamed, 'dusan-new', 'Admin-secret-1')['status'] === 302, 'only the new username logs in after rename');
    check(save($admin, member('Dušan', '', 'admin', '1'))['status'] === 303, 'restore admin fixture username');

    $old = []; request($old, '_legacy_session.php');
    check(request($old, 'admin.php')['status'] === 403, 'old shared session cannot access administration');
    $admin = [];
    $timeLink = 'index.php?collection_id=42&recording_id=7&time_ms=12000&view=audio&listen=1';
    check(request($admin, $timeLink)['status'] === 200, 'anonymous time link opens the login form');
    $oldCookie = $admin['cookie'];
    check(request($admin, 'index.php', ['submit_single'=>'1','username'=>'dusan','heslo'=>'wrong'])['status'] === 200, 'failed login retains the time link');
    $response = request($admin, 'index.php', ['submit_single'=>'1','username'=>'dusan','heslo'=>'Admin-secret-1']);
    check($response['status'] === 302 && $admin['cookie'] !== $oldCookie, 'login regenerates session ID');
    check($response['location'] === '/index.php?v=2&collection_id=42&recording_id=7&time_ms=12000&view=audio&listen=1', 'login preserves the recording, time and listen mode');
    check(request($admin, 'admin.php', member('Bad CSRF', 'Other-secret-1'))['status'] === 422, 'CSRF required');
    check(save($admin, member('Dušan', '', 'muzikant', '1'))['status'] === 422, 'last admin cannot be demoted');
    check(save($admin, member('Dušan', '', 'admin', '1', false))['status'] === 422, 'last admin cannot be disabled');
    check(save($admin, member('Duplicate', 'Admin-secret-1'))['status'] === 422, 'duplicate password rejected');
    check(request($musician, 'admin.php')['status'] === 403, 'musician denied administration');
    check(save($admin, member('<b>Petr</b> 🎸', '', 'muzikant', $musicianId))['status'] === 303, 'rename supports utf8mb4');
    check(str_contains(request($admin, 'admin.php')['body'], '&lt;b&gt;Petr&lt;/b&gt; 🎸'), 'names escaped in HTML');
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
    check(login($guestClient, 'host', 'Guest-secret-1')['status'] === 302 && $guestClient['cookie'] !== $oldCookie, 'guest login regenerates session ID');
    $identity = json_decode(request($guestClient, 'tools/vz2_preflight.php')['body'], true);
    check($identity === ['logged' => true, 'id' => null, 'name' => null, 'role' => 'host', 'edit' => false, 'delete' => false], 'guest has no member identity or write permissions');
    check(request($guestClient, 'admin.php')['status'] === 403 && request($guestClient, 'admin.php', $guestFields)['status'] === 403, 'guest denied admin GET and POST');
    check(save($admin, ['action' => 'guest'])['status'] === 303, 'guest disabled without password');
    check(request($guestClient, 'admin.php')['status'] === 403 && !json_decode(request($guestClient, 'tools/vz2_preflight.php')['body'], true)['logged'], 'disabled guest session invalidated');
    $failed = [];
    check(login($failed, 'host', 'Guest-secret-1')['status'] === 200, 'disabled guest cannot log in');
    check(save($admin, member('Uses old guest password', 'Guest-secret-1'))['status'] === 303, 'disabled guest password can be reused by member');
    check(save($admin, $guestFields)['status'] === 422, 'guest reenable catches reused password');
    }
    if (in_array($suite, ['all', 'lifecycle'], true)) {
    $failed = [];
    check(save($admin, member('Petr', '', 'muzikant', $musicianId, false))['status'] === 303, 'member deactivation');
    check(!json_decode(request($musician, 'tools/vz2_preflight.php')['body'], true)['logged'], 'deactivated member session invalidated');
    check(login($failed, 'petr', 'Musician-secret-1')['status'] === 200, 'inactive member cannot log in');
    check(save($admin, member('Reused inactive password', 'Musician-secret-1'))['status'] === 303, 'inactive password can be reused');
    check(save($admin, member('Petr', '', 'muzikant', $musicianId))['status'] === 422, 'reactivation requires password verification');
    check(save($admin, member('Petr', 'Musician-secret-1', 'muzikant', $musicianId))['status'] === 422, 'reactivation rejects reused password');
    check(save($admin, member('Petr', 'Musician-secret-2', 'muzikant', $musicianId))['status'] === 303, 'reactivation with unique password');
    check(login($musician, 'petr', 'Musician-secret-2')['status'] === 302, 'reactivated member login');
    check(save($admin, member('Petr', 'Musician-secret-3', 'muzikant', $musicianId))['status'] === 303, 'member password reset');
    check(!json_decode(request($musician, 'tools/vz2_preflight.php')['body'], true)['logged'], 'password reset invalidates existing session');
    check(save($admin, member('Petr', '', 'admin', $musicianId))['status'] === 303, 'promote second admin');
    check(login($musician, 'petr', 'Musician-secret-3')['status'] === 302, 'second admin login');
    check(save($admin, member('Dušan', '', 'muzikant', '1'))['status'] === 303, 'self demotion allowed with another admin');
    check(request($admin, 'admin.php')['status'] === 403, 'demoted admin loses admin access');
    check(save($musician, member('Petr', '', 'admin', $musicianId, false))['status'] === 422, 'new last admin still protected');
    check(save($musician, member('Petr', 'Final-admin-secret', 'admin', $musicianId))['status'] === 303, 'self password reset');
    check(request($musician, 'admin.php')['status'] === 403, 'self password reset requires login');
    check(login($musician, 'petr', 'Final-admin-secret')['status'] === 302, 'new admin password works');
    }
    check(request($anonymous, 'admin.php')['status'] === 403 && request($anonymous, 'admin.php', member('Anon', 'Anonymous-secret'))['status'] === 403, 'anonymous denied admin GET and POST');

    // Finalization must stop before releasing password uniqueness if a legacy writer
    // left an account without a username during the mixed deployment.
    $db->query('UPDATE users SET username=NULL WHERE id=3');
    $rejected = false;
    try {
        $db->multi_query(file_get_contents($root . '/_pomocne/migrations/008_login_usernames_finalize.sql'));
        do { if ($result = $db->store_result()) $result->free(); } while ($db->more_results() && $db->next_result());
    } catch (mysqli_sql_exception $e) { $rejected = true; }
    check($rejected && (int) $db->query('SELECT username_login_finalized FROM auth_settings WHERE id=1')->fetch_row()[0] === 0,
        'incomplete usernames prevent finalization without releasing legacy password uniqueness');
    $db->query("UPDATE users SET username='clen-3' WHERE id=3");
    // Finish the shared-database cutover, then verify the new account semantics.
    $db->multi_query(file_get_contents($root . '/_pomocne/migrations/008_login_usernames_finalize.sql'));
    do { if ($result = $db->store_result()) $result->free(); } while ($db->more_results() && $db->next_result());
    check((int) $db->query('SELECT username_login_finalized FROM auth_settings WHERE id=1')->fetch_row()[0] === 1, 'finalization explicitly releases password uniqueness');
    $column = $db->query("SHOW COLUMNS FROM users WHERE Field='username'")->fetch_assoc();
    check($column['Null'] === 'NO', 'final schema requires usernames');
    $operator = in_array($suite, ['all', 'lifecycle'], true) ? $musician : $admin;
    check(save($operator, member('Same display name', 'abc', 'muzikant', '', true, 'short-one'))['status'] === 303, 'simple three-letter password accepted');
    check(save($operator, member('Same display name', 'abc', 'muzikant', '', true, 'short-two'))['status'] === 303, 'two accounts can share both password and display name');
    check(save($operator, member('Too short', 'ab', 'muzikant', '', true, 'too-short'))['status'] === 422, 'existing three-character minimum retained');
    check(save($operator, member('Spaces only', '   ', 'muzikant', '', true, 'blank-password'))['status'] === 422, 'existing whitespace-only password rule retained');
    check(save($operator, member('Long bytes', str_repeat('ž', 37), 'muzikant', '', true, 'too-many-bytes'))['status'] === 422, 'bcrypt byte limit retained for multibyte passwords');
    $shortOne = []; $shortTwo = [];
    check(login($shortOne, 'short-one', 'abc')['status'] === 302 && login($shortTwo, 'short-two', 'abc')['status'] === 302, 'same password selects the explicitly named account');
    $firstIdentity = json_decode(request($shortOne, 'tools/vz2_preflight.php')['body'], true);
    $secondIdentity = json_decode(request($shortTwo, 'tools/vz2_preflight.php')['body'], true);
    check($firstIdentity['id'] !== $secondIdentity['id'] && $firstIdentity['role'] === 'muzikant' && $secondIdentity['role'] === 'muzikant', 'shared passwords do not merge identities or permissions');
    $firstId = (string) $firstIdentity['id'];
    $dormantMember = [];
    check(login($dormantMember, 'short-one', 'abc')['status'] === 302, 'keep a dormant member session for reactivation check');
    check(save($operator, member('Same display name', '', 'muzikant', $firstId, false, 'short-one'))['status'] === 303, 'deactivate account with shared password');
    check(!json_decode(request($shortOne, 'tools/vz2_preflight.php')['body'], true)['logged'], 'deactivation still invalidates an existing session');
    check(login($shortOne, 'short-one', 'abc')['status'] === 200, 'inactive username cannot fall through to another account with the same password');
    check(save($operator, member('Same display name', '', 'muzikant', $firstId, true, 'short-one'))['status'] === 303, 'finalized member reactivation keeps the existing password');
    check(!json_decode(request($dormantMember, 'tools/vz2_preflight.php')['body'], true)['logged'], 'reactivation cannot revive a session that was dormant during deactivation');
    check(login($shortOne, 'short-one', 'abc')['status'] === 302, 'original password works after reactivation');
    check(save($operator, ['action'=>'guest','guest_enabled'=>'1','password'=>'abc','password_confirmation'=>'abc'])['status'] === 303, 'guest may share a member password after cutover');
    $sharedGuest = [];
    check(login($sharedGuest, 'host', 'abc')['status'] === 302, 'reserved host login accepts the shared password');
    $identity = json_decode(request($sharedGuest, 'tools/vz2_preflight.php')['body'], true);
    check($identity['id'] === null && $identity['role'] === 'host' && !$identity['edit'], 'guest remains read-only despite a matching member password');
    $dormantGuest = [];
    check(login($dormantGuest, 'host', 'abc')['status'] === 302, 'keep a dormant guest session for reenable check');
    check(save($operator, ['action'=>'guest'])['status'] === 303, 'disable finalized guest');
    check(!json_decode(request($sharedGuest, 'tools/vz2_preflight.php')['body'], true)['logged'], 'disabled guest session is invalidated');
    check(login($sharedGuest, 'host', 'abc')['status'] === 200, 'disabled guest cannot fall through to a member');
    check(save($operator, ['action'=>'guest','guest_enabled'=>'1'])['status'] === 303 && login($sharedGuest, 'host', 'abc')['status'] === 302, 'finalized guest can be reenabled without entering its password again');
    check(!json_decode(request($dormantGuest, 'tools/vz2_preflight.php')['body'], true)['logged'], 'reenabling guest cannot revive a dormant revoked session');
    check(save($operator, member('Spaced password', ' abc ', 'muzikant', '', true, 'spaced-password'))['status'] === 303, 'spaces in a nonblank password are preserved');
    $spaced = [];
    check(login($spaced, 'spaced-password', 'abc')['status'] === 200 && login($spaced, 'spaced-password', ' abc ')['status'] === 302, 'passwords are never trimmed or normalized');

    // Exercise the real HTTP limiter without sleeping; only this disposable DB is changed.
    $db->query('DELETE FROM auth_login_attempts');
    for ($i = 1; $i <= 49; $i++) {
        $freshClient = [];
        check(login($freshClient, 'unknown-' . $i, '')['status'] === 200, 'high limit allows failed attempt ' . $i . ' with a new cookie and username');
    }
    $freshClient = [];
    check(login($freshClient, 'short-one', 'abc')['status'] === 302, 'correct credentials still work after 49 failed attempts');
    $freshClient = [];
    check(login($freshClient, 'unknown-50', '')['status'] === 200, '50th failed attempt is processed');
    $expires = $db->query('SELECT expires_at FROM auth_login_attempts')->fetch_row()[0];
    $limited = login($freshClient, 'short-one', 'abc');
    check($limited['status'] === 429 && $limited['retry_after'] > 0 && $limited['retry_after'] <= 900, '51st attempt receives a temporary limit and Retry-After');
    $spoofed = request($freshClient, 'index.php', ['submit_single'=>'1','username'=>'short-one','heslo'=>'abc'],
        ['headers'=>['X-Forwarded-For'=>'203.0.113.5', 'Forwarded'=>'for=203.0.113.5']]);
    check($spoofed['status'] === 429, 'untrusted forwarding headers cannot bypass the limit');
    $otherAddress = [];
    check(request($otherAddress, 'index.php', ['submit_single'=>'1','username'=>'short-one','heslo'=>'abc'],
        ['source'=>'127.0.0.2'])['status'] === 302, 'limit on one source does not lock the account for another address');
    check($db->query('SELECT expires_at FROM auth_login_attempts')->fetch_row()[0] === $expires, 'blocked requests do not extend the limit');
    check(json_decode(request($shortTwo, 'tools/vz2_preflight.php')['body'], true)['logged'], 'limiter does not log out already authenticated users');
    $db->query('UPDATE auth_login_attempts SET expires_at=DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 SECOND)');
    check(login($freshClient, 'short-one', 'abc')['status'] === 302, 'limit expires automatically without an account unlock');
    check((int) $db->query('SELECT COUNT(*) FROM auth_login_attempts')->fetch_row()[0] === 0, 'expired limiter entries are removed');

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
