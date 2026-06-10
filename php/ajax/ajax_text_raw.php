<?php
session_start();
error_reporting(0);
header('Content-Type: application/json; charset=utf-8');

if (empty($_SESSION['role'])) {
    echo json_encode(["ok" => false]);
    exit;
}

$kapela            = $_SESSION['kapela']                     ?? "";
$befelemepesseveze = $_SESSION['befelemepesseveze']          ?? "";
$slozka_souboru    = $_SESSION['slozka_souboru_k_zobrazeni'] ?? "";
$aktualni_text     = $_SESSION['aktualni_text']              ?? "akordy.txt";

$soubor = "../../user/" . $kapela . "/" . $befelemepesseveze . "/uploads/" . $slozka_souboru . "/texty/" . $aktualni_text;

if (!file_exists($soubor)) {
    echo json_encode(["ok" => false, "obsah" => "", "nazev_souboru" => $aktualni_text]);
    exit;
}

echo json_encode([
    "ok"            => true,
    "obsah"         => file_get_contents($soubor),
    "nazev_souboru" => $aktualni_text,
    "slozka"        => $slozka_souboru,
]);
?>
