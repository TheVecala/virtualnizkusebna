<?php
require_once __DIR__ . "/../config.php";

// AJAX požadavek (odeslaný přes jQuery $.post) → vrátit JSON, nepřesměrovávat
$is_ajax = !empty($_SERVER['HTTP_X_REQUESTED_WITH']) &&
           strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';

if ($is_ajax) {
    $vysledek = $_SESSION['vysledek'] ?? '';
    $ok       = (strpos($vysledek, 'chyba') === false);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => $ok, 'vysledek' => $vysledek]);
    exit;
}

// Klasický form POST → PRG redirect (303 = vždy GET po přesměrování)
header("Location: " . SITE_URL . $adresa_pro_navrat, true, 303);
exit;
