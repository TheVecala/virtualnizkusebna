<?php session_start(); ?>
<?php
require_once __DIR__ . '/../config.php';

if (!ma_pravo('delete_file')) {
    $_SESSION['vysledek'] = "chyba - nemáte oprávnění";
    require "navrat.php"; exit;
}

$adresa_pro_navrat = $_POST["navrat"] ?? "/";

// Validace session
if (empty($_SESSION['kapela']) || empty($_SESSION['befelemepesseveze'])) {
    $_SESSION['vysledek'] = "chyba - nejste přihlášen";
    require "navrat.php";
    exit;
}

$soubor_ke_smazani = $_POST["soubor_ke_smazani"] ?? "";

// Ochrana proti path traversal
if (empty($soubor_ke_smazani) || strpos($soubor_ke_smazani, "..") !== false) {
    $_SESSION['vysledek'] = "chyba - neplatná cesta";
    require "navrat.php";
    exit;
}

// Ověření že soubor leží uvnitř složky daného uživatele
$ocekavany_prefix = "user/" . $_SESSION['kapela'] . "/" . $_SESSION['befelemepesseveze'] . "/";
if (strpos($soubor_ke_smazani, $ocekavany_prefix) !== 0) {
    $_SESSION['vysledek'] = "chyba - nemáte oprávnění smazat tento soubor";
    require "navrat.php";
    exit;
}

$target_file = "../" . $soubor_ke_smazani;

if (!file_exists($target_file)) {
    $_SESSION['vysledek'] = "chyba - soubor neexistuje";
    require "navrat.php";
    exit;
}

if (unlink($target_file)) {
    $_SESSION['vysledek'] = "soubor \"" . basename($soubor_ke_smazani) . "\" byl smazán";

    // Smazat také WaveSurfer peaks cache, pokud existuje
    $peaks_file = $target_file . ".peaks.json";
    if (file_exists($peaks_file)) {
        @unlink($peaks_file);
    }
} else {
    $_SESSION['vysledek'] = "chyba - soubor se nepodařilo smazat";
}

require "navrat.php";
?>
