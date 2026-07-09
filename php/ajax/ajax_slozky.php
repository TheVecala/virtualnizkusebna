<?php
session_start();
error_reporting(0);
header('Content-Type: application/json; charset=utf-8');

if (empty($_SESSION['role'])) { echo json_encode([]); exit; }

$kapela            = $_SESSION['kapela']                     ?? "";
$befelemepesseveze = $_SESSION['befelemepesseveze']          ?? "";
$slozka_souboru    = $_SESSION['slozka_souboru_k_zobrazeni'] ?? "";
$sekce             = "uploads";

$slozka_slozek = "../../user/" . $kapela . "/" . $befelemepesseveze . "/" . $sekce . "/";
$vysledek = [];

 if (is_dir($slozka_slozek)) {
    // 1. Nejdříve posbíráme čisté názvy složek
    $slozky_pole = [];
    foreach (scandir($slozka_slozek) as $s) {
        if ($s === "." || $s === "..") continue;
        if (!is_dir($slozka_slozek . $s)) continue;
        $slozky_pole[] = $s;
    }

    // 2. Seřadíme je podle poradi.json
    $soubor_poradi = $slozka_slozek . 'poradi.json';
    if (file_exists($soubor_poradi)) {
        $vlastni_poradi = json_decode(file_get_contents($soubor_poradi), true);
        if (is_array($vlastni_poradi)) {
            usort($slozky_pole, function($a, $b) use ($vlastni_poradi) {
                $posA = array_search($a, $vlastni_poradi);
                $posB = array_search($b, $vlastni_poradi);
                $posA = ($posA === false) ? 9999 : $posA;
                $posB = ($posB === false) ? 9999 : $posB;
                return $posA <=> $posB;
            });
        }
    }

    // 3. Vygenerujeme výsledné JSON pole pro JS
    foreach ($slozky_pole as $s) {
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
