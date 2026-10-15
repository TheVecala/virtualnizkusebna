<?php
declare(strict_types=1);
$maintenanceMode = false; // true = zapnuto, false = vypnuto

if ($maintenanceMode) {
    header('Location: /maintenance.php', true, 302);
    exit;
}
// The current application is the only entry point; preserve its deep-link query.
require __DIR__ . '/vz2.php';
?>
