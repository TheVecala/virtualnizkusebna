<?php
session_start();
error_reporting(0);
header('Content-Type: application/json; charset=utf-8');

if (empty($_SESSION['login'])) {
    echo json_encode(["ok" => false]); exit;
}

$kapela            = $_SESSION['kapela']                     ?? "";
$befelemepesseveze = $_SESSION['befelemepesseveze']          ?? "";
$slozka_souboru    = $_SESSION['slozka_souboru_k_zobrazeni'] ?? "";
$aktualni_text     = $_SESSION['aktualni_text']              ?? "akordy.txt";
$akce              = $_GET['akce']                           ?? "seznam";
$soubor_zalohy     = basename($_GET['soubor']                ?? "");

$slozka_textu   = "../../user/" . $kapela . "/" . $befelemepesseveze . "/uploads/" . $slozka_souboru . "/texty/";
$slozka_history = $slozka_textu . "_history/";
$nazev_bez_ext  = pathinfo($aktualni_text, PATHINFO_FILENAME);

if ($akce === "seznam") {
    // Vrátit seznam záloh - od nejnovější
    $zalohy = glob($slozka_history . $nazev_bez_ext . "_*.txt");
    if (!$zalohy) { echo json_encode(["ok" => true, "zalohy" => []]); exit; }
    rsort($zalohy);
    $seznam = [];
    foreach (array_slice($zalohy, 0, 20) as $z) {
        $bn = basename($z);
        // Parsovat timestamp z názvu: akordy_2025-04-26_18-32-05.txt
        preg_match('/_(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})\.txt$/', $bn, $m);
        $datum = isset($m[1]) ? $m[1] . ' ' . str_replace('-', ':', $m[2]) : $bn;
        $seznam[] = ["soubor" => $bn, "datum" => $datum, "velikost" => filesize($z)];
    }
    echo json_encode(["ok" => true, "zalohy" => $seznam]);

} elseif ($akce === "nacist") {
    // Vrátit obsah konkrétní zálohy
    if (empty($soubor_zalohy) || strpos($soubor_zalohy, "..") !== false) {
        echo json_encode(["ok" => false]); exit;
    }
    $cesta = $slozka_history . $soubor_zalohy;
    if (!file_exists($cesta)) {
        echo json_encode(["ok" => false, "chyba" => "Záloha nenalezena"]); exit;
    }
    echo json_encode(["ok" => true, "obsah" => file_get_contents($cesta), "soubor" => $soubor_zalohy]);
}
?>
