<?php
// Read-only deployment check. Never creates tables, folders, markers or accounts.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
if (session_status() !== PHP_SESSION_ACTIVE) session_start();
require_once dirname(__DIR__).'/config.php';
require_once dirname(__DIR__).'/php/inc/vz2_storage.php';
$failed = false;
function report(bool $ok, string $label): void {
    global $failed;
    if (!$ok) $failed = true;
    echo ($ok ? 'OK   ' : 'FAIL ') . $label . PHP_EOL;
}
try {
    report(PHP_VERSION_ID >= 80100 && PHP_INT_SIZE === 8, 'PHP >= 8.1, 64 bit; current '.PHP_VERSION);
    report(extension_loaded('mysqli') && extension_loaded('iconv'), 'mysqli and iconv');
    vz2_ready();
    $db = vz2_db();
    $version = $db->server_info;
    report(stripos($version,'MariaDB') !== false, 'MariaDB: '.$version);
    $mode = $db->query('SELECT @@sql_mode mode, @@check_constraint_checks checks')->fetch_assoc();
    report(str_contains($mode['mode'],'STRICT_') && (int)$mode['checks']===1, 'Strict SQL and enforced CHECK constraints');
    $id = $db->query("SHOW COLUMNS FROM users WHERE Field='id'")->fetch_assoc();
    report($id && preg_match('/^int(?:\(\d+\))? unsigned$/i',$id['Type']) && $id['Key']==='PRI', 'users.id INT UNSIGNED PRIMARY KEY');
    $engine = $db->query("SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users'")->fetch_assoc();
    report($engine && $engine['ENGINE']==='InnoDB', 'users InnoDB');
    report(count(vz2_rows($db,"SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND LEFT(TABLE_NAME,4)='vz2_'"))===13, '13 VZ2 tables (migration 002)');
    report(count(vz2_rows($db,'SELECT * FROM vz2_collection_orders'))===2, 'Collection order seed');
    $root = vz2_root();
    report(is_readable($root) && is_writable($root), 'Private storage root accessible; dataset marker matches');
    echo 'Environment: '.VZ2_ENVIRONMENT.'; writes: '.((defined('VZ2_WRITES_ENABLED') && VZ2_WRITES_ENABLED)?'enabled':'disabled').PHP_EOL;
    echo 'Upload limits: upload_max_filesize='.ini_get('upload_max_filesize').', post_max_size='.ini_get('post_max_size').', max_file_uploads='.ini_get('max_file_uploads').PHP_EOL;
    echo 'Remaining manual checks: both web roots, filesystem hard links, shared/independent disks, backup and HTTP access denial to storage.'.PHP_EOL;
} catch (Throwable $e) { report(false, $e instanceof Vz2Error ? $e->getMessage() : 'Database/configuration check failed; verify migration and connection.'); }
exit($failed ? 1 : 0);
