<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
error_reporting(0);

if (empty($_SESSION['login'])) {
    echo json_encode(["ok" => false]);
    exit;
}

$cilova_slozka = trim($_POST["cilova_slozka"] ?? "");

// Ochrana
if (empty($cilova_slozka) || strpos($cilova_slozka, "..") !== false || strpos($cilova_slozka, "/") !== false) {
    echo json_encode(["ok" => false, "chyba" => "Neplatná složka"]);
    exit;
}

// Ověření že složka existuje
$cesta = "../user/" . $_SESSION['kapela'] . "/" . $_SESSION['befelemepesseveze'] . "/uploads/" . $cilova_slozka;
if (!is_dir($cesta)) {
    echo json_encode(["ok" => false, "chyba" => "Složka neexistuje"]);
    exit;
}

$_SESSION['slozka_souboru_k_zobrazeni'] = $cilova_slozka;

echo json_encode(["ok" => true, "val" => $cilova_slozka]);
?>
