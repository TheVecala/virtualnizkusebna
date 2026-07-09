<?php session_start();
require_once __DIR__ . '/../config.php';

if (!ma_pravo('delete_val')) {
    $_SESSION['vysledek'] = "chyba - nemáte oprávnění";
    require "navrat.php"; exit;
}

$val_ke_smazani    = trim($_POST["val_ke_smazani"] ?? "");
$adresa_pro_navrat = $_POST["navrat"] ?? "/";

// Ochrana proti path traversal
if (empty($val_ke_smazani) || strpos($val_ke_smazani, "..") !== false) {
    $_SESSION['vysledek'] = "chyba - neplatný název válu";
    require "navrat.php";
    exit;
}

// Cesta se sestavuje ze SESSION, ne z POST
$cesta_slozek = "user/" . $_SESSION['kapela'] . "/" . $_SESSION['befelemepesseveze'] . "/uploads/";
$target_dir   = "../" . $cesta_slozek . $val_ke_smazani;

if (!is_dir($target_dir)) {
    $_SESSION['vysledek'] = "chyba - vál neexistuje";
    require "navrat.php";
    exit;
}

$slozka = scandir($target_dir);
$pocet  = count($slozka); // . a .. jsou vždy 2, texty a data jsou 2 = celkem 4

if ($pocet > 4) {
    $_SESSION['vysledek'] = "chyba - vál není prázdný, nejdříve smažte nahrávky";
    require "navrat.php";
    exit;
}

// ── Rekurzivní smazání složky a všeho uvnitř ──
function smazat_slozku(string $cesta): bool {
    if (!is_dir($cesta)) return true;
    foreach (scandir($cesta) as $polozka) {
        if ($polozka === '.' || $polozka === '..') continue;
        $plna = $cesta . '/' . $polozka;
        if (is_dir($plna)) {
            smazat_slozku($plna);
        } else {
            unlink($plna);
        }
    }
    return rmdir($cesta);
}

// Smazání podsložky texty (akordy.txt, tabelatura.txt, _history/...)
smazat_slozku($target_dir . "/texty");

// Smazání podsložky data
if (file_exists($target_dir . "/data/nazev_valu.txt")) {
    unlink($target_dir . "/data/nazev_valu.txt");
}
if (is_dir($target_dir . "/data")) {
    rmdir($target_dir . "/data");
}

// Smazání samotného válu
if (rmdir($target_dir)) {
    // Přepnout na jinou složku pokud byl smazán aktuálně zobrazený vál
    if ($_SESSION['slozka_souboru_k_zobrazeni'] == $val_ke_smazani) {
        $_SESSION['slozka_souboru_k_zobrazeni'] = "slozka_smazana";
    }
    $_SESSION['vysledek'] = "vál \"" . $val_ke_smazani . "\" byl smazán";
} else {
    $_SESSION['vysledek'] = "chyba - vál se nepodařilo smazat";
}

require "navrat.php";
?>
