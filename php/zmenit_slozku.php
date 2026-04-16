<?php session_start(); ?>
<?php

$adresa_pro_navrat = $_POST["navrat"] ?? "/";

$cilova_slozka = $_POST["cilova_slozka"] ?? "";

// Ochrana proti path traversal
if (empty($cilova_slozka) || strpos($cilova_slozka, "..") !== false || strpos($cilova_slozka, "/") !== false) {
    $_SESSION['vysledek'] = "chyba - neplatný název složky";
    require "navrat.php";
    exit;
}

// Ověření že složka skutečně existuje pro tohoto uživatele
$cesta = "../user/" . $_SESSION['kapela'] . "/" . $_SESSION['befelemepesseveze'] . "/uploads/" . $cilova_slozka;
if (!is_dir($cesta)) {
    $_SESSION['vysledek'] = "chyba - složka neexistuje";
    require "navrat.php";
    exit;
}

$_SESSION['slozka_souboru_k_zobrazeni'] = $cilova_slozka;
$_SESSION['vysledek'] = "změněna složka";

require "navrat.php";
?>
