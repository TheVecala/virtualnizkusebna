<?php
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require dirname(__DIR__, 2) . '/php/inc/admin_storage.php';
require dirname(__DIR__, 2) . '/php/auth.php';
function storage_check(bool $ok, string $label): void {
    if (!$ok) throw new RuntimeException($label);
    echo "OK: $label\n";
}
storage_check(admin_storage_size(0) === '0 B' && admin_storage_size(1024) === '1,00 KiB'
    && admin_storage_size(false) === 'Nedostupné', 'Formatting');
$storage = ['bytes'=>1024,'files'=>2,'songs'=>3,'rehearsals'=>4,'recordings'=>5,'documents'=>6,'pending'=>1];
$storageError = '';
ob_start(); require dirname(__DIR__, 2) . '/php/inc/admin_storage_view.php'; $html = ob_get_clean();
storage_check(str_contains($html, '1,00 KiB') && str_contains($html, '3 / 4'), 'Current content counts');
storage_check(str_contains($html, 'Nedokončené souborové operace: 1'), 'Pending operations remain visible');
storage_check(!str_contains($html, 'storage_refresh') && !str_contains($html, 'Adresářový strom'), 'No legacy storage UI');
$storage = null;
$storageError = '<script>alert(1)</script>';
ob_start(); require dirname(__DIR__, 2) . '/php/inc/admin_storage_view.php'; $html = ob_get_clean();
storage_check(!str_contains($html, '<script>') && str_contains($html, '&lt;script&gt;'), 'Escaped error');
storage_check(!str_contains($html, 'storage-cards'), 'Unavailable report does not display false zero totals');
