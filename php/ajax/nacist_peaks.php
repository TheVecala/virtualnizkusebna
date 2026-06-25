<?php
/**
 * nacist_peaks.php
 * Vrátí uložená WaveSurfer peaks data (JSON) pro daný audio soubor.
 * Pokud soubor neexistuje, vrátí HTTP 404.
 *
 * GET params:
 *   cesta  — relativní cesta k audio souboru (např. user/kapela/befele/uploads/slozka/soubor.webm)
 */

session_start();
error_reporting(0);
header('Content-Type: application/json; charset=utf-8');

if (empty($_SESSION['role'])) {
    http_response_code(403);
    echo 'null';
    exit;
}

$cesta  = $_GET['cesta'] ?? '';
$kapela = $_SESSION['kapela']            ?? '';
$befele = $_SESSION['befelemepesseveze'] ?? '';

// Základní validace
if (empty($kapela) || empty($befele) || empty($cesta)) {
    http_response_code(400);
    echo 'null';
    exit;
}

// Bezpečnostní kontrola: cesta musí být pod složkou aktuální kapely, bez path traversal
$prefix = 'user/' . $kapela . '/' . $befele . '/';
if (strpos($cesta, $prefix) !== 0 || strpos($cesta, '..') !== false) {
    http_response_code(403);
    echo 'null';
    exit;
}

// Soubor s peaks leží vedle audio souboru s příponou .peaks.json
$peaks_soubor = __DIR__ . '/../../' . $cesta . '.peaks.json';

if (!file_exists($peaks_soubor)) {
    http_response_code(404);
    echo 'null';
    exit;
}

// Vrátíme obsah přímo — je to už validní JSON
echo file_get_contents($peaks_soubor);
