<?php
session_start();
require_once __DIR__ . '/../inc/content_context.php';
error_reporting(0);
header('Content-Type: application/json; charset=utf-8');

if (empty($_SESSION['role'])) {
    echo json_encode(["ok" => false]);
    exit;
}

$kapela            = $_SESSION['kapela']                     ?? "";
$befelemepesseveze = $_SESSION['befelemepesseveze']          ?? "";
$slozka_souboru    = $_SESSION['slozka_souboru_k_zobrazeni'] ?? "";
$aktualni_tab      = $_SESSION['aktualni_tab']               ?? "tabelatura.txt"; // ← opraveno: aktualni_tab

$soubor = "../../user/" . $kapela . "/" . $befelemepesseveze . "/" . content_section() . "/" . $slozka_souboru . "/texty/" . $aktualni_tab;

if (!file_exists($soubor)) {
    echo json_encode(["ok" => false, "obsah" => "", "nazev_souboru" => $aktualni_tab]);
    exit;
}

echo json_encode([
    "ok"            => true,
    "obsah"         => file_get_contents($soubor),
    "nazev_souboru" => $aktualni_tab,
    "slozka"        => $slozka_souboru,
]);
?>
