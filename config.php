<?php
// ── Databáze ──
define('DB_HOST', 'localhost');
define('DB_USER', 'hanakdusan');
define('DB_PASS', 'serepes6');
define('DB_NAME', '18810_virtualni_zkusebna');

// ── Web ──
define('SITE_URL',  'https://zkusebna_beta.dusanovakapela.cz');
define('MAIL_FROM', 'automat@dusanovakapela.cz');

// ── Oprávnění rolí ──
$GLOBALS['PRAVA'] = [
    'host'     => [],
    'muzikant' => ['edit_text', 'upload', 'comment', 'reorder', 'move_file', 'delete_file', 'create_val', 'rename_val', 'edit_recording_label'],
    'admin'    => ['edit_text', 'upload', 'comment', 'reorder', 'move_file', 'delete_file', 'create_val', 'rename_val', 'delete_val', 'edit_recording_label'],
];

function ma_pravo(string $pravo): bool {
    $prava = $GLOBALS['PRAVA'][$_SESSION['role'] ?? ''] ?? [];
    return in_array($pravo, $prava, true);
}

// Osobní účty: průběžně promítnout změnu role, deaktivaci a změnu hesla.
// Nasadit až po SQL migraci a vytvoření prvního admina starým loginem.
require_once __DIR__ . '/php/auth.php';
try {
    auth_refresh_session();
} catch (Throwable $e) {
    auth_forget_identity();
    error_log('Zkušebna: nepodařilo se ověřit přihlášený účet.');
}
