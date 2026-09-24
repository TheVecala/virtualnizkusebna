<?php
declare(strict_types=1);
// Temporary adapter for alpha 6ef87325: its existing single-band admin session.
// No config/auth replacement, database connection, or VZ2 activation.
session_start();
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Content-Type: text/html; charset=utf-8');
if (($_SESSION['logged_in_single'] ?? null) !== true || ($_SESSION['role'] ?? null) !== 'admin') {
    http_response_code(403);
    exit('Nejprve se na alfě přihlaste jako administrátor.');
}
if (!isset($_SESSION['vz2_legacy_probe_csrf'])) {
    $_SESSION['vz2_legacy_probe_csrf'] = bin2hex(random_bytes(32));
}
$csrf = $_SESSION['vz2_legacy_probe_csrf'];
$result = null;
$error = '';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET', 'POST'], true)) {
    header('Allow: GET, POST');
    http_response_code(405);
    exit;
}
if ($method === 'POST') {
    $submitted = $_POST['csrf'] ?? null;
    if (!is_string($submitted) || !hash_equals($csrf, $submitted)) {
        http_response_code(403);
        exit('Neplatné potvrzení formuláře. Obnovte stránku a zkuste to znovu.');
    }
    try {
        // Included probe defines the common check and returns before its modern login.
        require_once __DIR__.'/vz2_storage_probe.php';
        $result = vz2_probe_storage(dirname(__DIR__, 2).'/_vz2_storage');
    } catch (Throwable $e) {
        http_response_code(422);
        $error = $e->getMessage();
    }
}
function vz2_legacy_probe_h(string $value): string {
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
?>
<!doctype html><html lang="cs"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kontrola úložiště VZ2 z alfy</title><h1>Kontrola úložiště VZ2 z alfy</h1>
<p>Ověří stejné testovací soubory jako beta. Vytvoří a odstraní vlastní malé soubory pro kontrolu kopírování a zámku. Starý web ani databázi nemění.</p>
<form method="post"><input type="hidden" name="csrf" value="<?=vz2_legacy_probe_h($csrf)?>"><button>Spustit kontrolu souborů</button></form>
<?php if ($error): ?><p role="alert"><?=vz2_legacy_probe_h($error)?></p><?php endif; ?>
<?php if ($result): ?><h2>Kontrola souborů prošla</h2><pre><?=vz2_legacy_probe_h(json_encode($result, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT))?></pre>
<p>Po ukončení ověřování odstraňte z alfy oba diagnostické soubory tools/vz2_storage_probe_legacy.php a tools/vz2_storage_probe.php.</p><?php endif; ?>
</html>
