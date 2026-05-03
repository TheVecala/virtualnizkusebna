<?php
session_start();
error_reporting(0);
header('Content-Type: application/json; charset=utf-8');

if (empty($_SESSION['login'])) { echo json_encode([]); exit; }

$kapela            = $_SESSION['kapela']                     ?? "";
$befelemepesseveze = $_SESSION['befelemepesseveze']          ?? "";
$slozka_souboru    = $_SESSION['slozka_souboru_k_zobrazeni'] ?? "";
$sekce             = "uploads";

$slozka_slozek = "../../user/" . $kapela . "/" . $befelemepesseveze . "/" . $sekce . "/";
$vysledek = [];

if (is_dir($slozka_slozek)) {
    foreach (scandir($slozka_slozek) as $s) {
        if ($s === "." || $s === "..") continue;
        if (!is_dir($slozka_slozek . $s)) continue;
        $nazev_soubor = $slozka_slozek . $s . "/data/nazev_valu.txt";
        $nazev = file_exists($nazev_soubor) ? trim(file_get_contents($nazev_soubor)) : $s;
        $vysledek[] = [
            "slozka"  => $s,
            "nazev"   => $nazev,
            "aktivni" => ($s === $slozka_souboru),
        ];
    }
}

echo json_encode($vysledek);
