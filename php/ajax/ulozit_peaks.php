<?php
/**
 * ulozit_peaks.php
 * Přijme WaveSurfer peaks data a délku nahrávky, uloží je jako JSON soubor
 * vedle originálního audio souboru.
 *
 * POST body (JSON):
 *   cesta    — relativní cesta k audio souboru
 *   peaks    — pole polí čísel (výstup WaveSurfer.exportPeaks())
 *   duration — délka nahrávky v sekundách (float)
 */

session_start();
error_reporting(0);
header('Content-Type: application/json; charset=utf-8');

if (empty($_SESSION['role'])) {
    echo json_encode(['ok' => false, 'chyba' => 'nepřihlášen']);
    exit;
}

$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);

if (!$data || empty($data['cesta']) || empty($data['peaks']) || !isset($data['duration'])) {
    echo json_encode(['ok' => false, 'chyba' => 'chybná data']);
    exit;
}

$cesta    = $data['cesta'];
$peaks    = $data['peaks'];
$duration = (float) $data['duration'];

$kapela = $_SESSION['kapela']            ?? '';
$befele = $_SESSION['befelemepesseveze'] ?? '';

// Bezpečnostní kontrola: cesta musí být pod složkou aktuální kapely
$prefix = 'user/' . $kapela . '/' . $befele . '/';
if (
    empty($kapela) || empty($befele) ||
    strpos($cesta, $prefix) !== 0    ||
    strpos($cesta, '..') !== false
) {
    echo json_encode(['ok' => false, 'chyba' => 'neplatná cesta']);
    exit;
}

// Délka musí být kladná, peaks musí být neprázdné pole polí čísel
if ($duration <= 0 || !is_array($peaks) || empty($peaks[0])) {
    echo json_encode(['ok' => false, 'chyba' => 'neplatná peaks data']);
    exit;
}

$peaks_soubor = __DIR__ . '/../../' . $cesta . '.peaks.json';

// Adresář pro soubor musí existovat (audio tam je, takže existuje — ale pro jistotu)
$dir = dirname($peaks_soubor);
if (!is_dir($dir)) {
    echo json_encode(['ok' => false, 'chyba' => 'cílový adresář neexistuje']);
    exit;
}

$payload = json_encode([
    'peaks'    => $peaks,
    'duration' => $duration,
], JSON_UNESCAPED_UNICODE);

if (file_put_contents($peaks_soubor, $payload) !== false) {
    echo json_encode(['ok' => true]);
} else {
    echo json_encode(['ok' => false, 'chyba' => 'zápis selhal']);
}
