<?php
declare(strict_types=1);
// Read-only deployment check: CLI or GET by a freshly authenticated modern admin.
// Never creates tables, folders, markers or accounts. Does not enable writes.
$cli = PHP_SAPI === 'cli';
if (!$cli) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
        header('Allow: GET');
        http_response_code(405);
        exit('{"ok":false,"error":"Použijte GET."}');
    }
}
$checks = [];
$details = [];
$authorized = $cli;
function vz2_preflight_report(bool $ok, string $label): void {
    global $checks;
    $checks[] = ['ok'=>$ok, 'label'=>$label];
}
try {
    if (session_status() !== PHP_SESSION_ACTIVE) session_start();
    require_once dirname(__DIR__).'/config.php';
    if (!$cli) {
        auth_refresh_session();
        if (!auth_is_admin()) {
            http_response_code(403);
            exit('{"ok":false,"error":"Přihlaste se na betě jako administrátor."}');
        }
        $authorized = true;
    }
    // Report configuration even when vz2_ready() stops below. Never load the
    // optional file here: that would hide a broken application bootstrap.
    $optionalConfig = dirname(__DIR__).'/config.vz2.php';
    $optionalRealPath = realpath($optionalConfig);
    $details['preflight_version'] = '2026-09-19.2';
    $details['configuration'] = [
        'app_root'=>dirname(__DIR__),
        'config_vz2_exists'=>is_file($optionalConfig),
        'config_vz2_readable'=>is_readable($optionalConfig),
        'config_vz2_loaded'=>$optionalRealPath !== false
            && in_array($optionalRealPath, array_map('realpath', get_included_files()), true),
        'enabled_defined'=>defined('VZ2_ENABLED'),
        'enabled_type'=>defined('VZ2_ENABLED') ? gettype(VZ2_ENABLED) : null,
        'enabled'=>defined('VZ2_ENABLED') && VZ2_ENABLED === true,
        'writes_defined'=>defined('VZ2_WRITES_ENABLED'),
        'writes_enabled'=>defined('VZ2_WRITES_ENABLED') && VZ2_WRITES_ENABLED === true,
    ];
    require_once dirname(__DIR__).'/php/inc/vz2_storage.php';
    vz2_preflight_report(PHP_VERSION_ID >= 80100 && PHP_INT_SIZE === 8, 'PHP >= 8.1, 64 bit; current '.PHP_VERSION);
    vz2_preflight_report(extension_loaded('mysqli') && extension_loaded('iconv'), 'mysqli and iconv');
    vz2_ready();
    $db = vz2_db();
    $details['database'] = $db->query('SELECT DATABASE()')->fetch_row()[0];
    vz2_preflight_report(defined('DB_NAME') && $details['database'] === DB_NAME, 'Selected database matches application configuration');
    vz2_preflight_report(stripos($db->server_info,'MariaDB') !== false, 'MariaDB: '.$db->server_info);
    $mode = $db->query('SELECT @@SESSION.sql_mode mode, @@GLOBAL.sql_mode global_mode, @@SESSION.check_constraint_checks checks')->fetch_assoc();
    $details['session_sql_mode'] = $mode['mode'];
    $details['global_sql_mode'] = $mode['global_mode'];
    $requiredModes = ['STRICT_TRANS_TABLES','ERROR_FOR_DIVISION_BY_ZERO','NO_ENGINE_SUBSTITUTION'];
    vz2_preflight_report(!array_diff($requiredModes, explode(',', $mode['mode'])), 'Application connection SQL mode: '.$mode['mode']);
    vz2_preflight_report((int)$mode['checks']===1, 'Enforced CHECK constraints');
    $id = $db->query("SHOW COLUMNS FROM users WHERE Field='id'")->fetch_assoc();
    vz2_preflight_report($id && preg_match('/^int(?:\(\d+\))? unsigned$/i',$id['Type']) && $id['Key']==='PRI', 'users.id INT UNSIGNED PRIMARY KEY');
    $engine = $db->query("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users'")->fetch_assoc();
    vz2_preflight_report($engine && $engine['ENGINE']==='InnoDB', 'users InnoDB');
    $expected = ['vz2_collection_orders','vz2_collections','vz2_recordings','vz2_audio_files',
        'vz2_timestamps','vz2_discussion_threads','vz2_discussion_posts','vz2_documents',
        'vz2_document_versions','vz2_attachments','vz2_file_operations','vz2_file_operation_items','vz2_activity_log'];
    $tables = vz2_rows($db,"SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND LEFT(TABLE_NAME,4)='vz2_'");
    $names = array_column($tables, 'TABLE_NAME');
    sort($names); sort($expected);
    $details['tables'] = $names;
    vz2_preflight_report($names === $expected, '13 VZ2 tables (migration 002), exact names');
    vz2_preflight_report(count($tables)===13 && !array_filter($tables, static fn($table) => $table['ENGINE'] !== 'InnoDB'), 'All VZ2 tables use InnoDB');
    $orders = vz2_rows($db,'SELECT kind, revision FROM vz2_collection_orders ORDER BY kind');
    $details['collection_orders'] = $orders;
    $orderKinds = array_column($orders,'kind'); sort($orderKinds);
    vz2_preflight_report($orderKinds === ['rehearsal','song']
        && !array_filter($orders, static fn($row) => (int)$row['revision'] < 1), 'Collection order seed');
    $root = vz2_root();
    vz2_preflight_report(is_readable($root) && is_writable($root), 'Private storage root accessible; dataset marker matches');
    $details['storage_root'] = $root;
    $details['dataset'] = VZ2_DATASET_KEY;
    $details['storage_access'] = VZ2_STORAGE_ACCESS;
    $details['environment'] = VZ2_ENVIRONMENT;
    $details['writes_enabled'] = defined('VZ2_WRITES_ENABLED') && VZ2_WRITES_ENABLED === true;
    $details['upload_limits'] = ['upload_max_filesize'=>ini_get('upload_max_filesize'),
        'post_max_size'=>ini_get('post_max_size'), 'max_file_uploads'=>ini_get('max_file_uploads')];
    $details['note'] = 'HTTP protection, filesystem operations and hosting quota require separate checks. This endpoint only reads configuration, SQL metadata and the storage guard.';
} catch (Throwable $e) {
    // Do not expose connection errors, credentials or paths before authorization.
    vz2_preflight_report(false, $authorized && $e instanceof Vz2Error ? $e->getMessage()
        : 'Database/configuration check failed; verify migration and connection.');
}
$ok = $checks !== [] && !array_filter($checks, static fn($check) => !$check['ok']);
if ($cli) {
    foreach ($checks as $check) echo ($check['ok'] ? 'OK   ' : 'FAIL ') . $check['label'] . PHP_EOL;
    echo json_encode($details, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . PHP_EOL;
    exit($ok ? 0 : 1);
}
http_response_code($ok ? 200 : 503);
echo json_encode(['ok'=>$ok, 'checks'=>$checks, 'details'=>$details], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
