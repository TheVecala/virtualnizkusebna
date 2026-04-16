<?php
session_start();
include "login/connect.php";

$adresa_pro_navrat = $_POST["navrat"] ?? "/";

// Validace - musí být přihlášen
if (empty($_SESSION['kapela']) || empty($_SESSION['slozka_souboru_k_zobrazeni'])) {
    $_SESSION['vysledek'] = "chyba - nejste přihlášen";
    require "navrat.php";
    exit;
}

// Sestavení komentáře - escapovat HTML výstup
$text   = htmlspecialchars(trim($_POST["text"]   ?? ""), ENT_QUOTES);
$odkaz  = htmlspecialchars(trim($_POST["odkaz"]  ?? ""), ENT_QUOTES);
$odkaz2 = htmlspecialchars(trim($_POST["odkaz2"] ?? ""), ENT_QUOTES);
$jmeno  = htmlspecialchars(trim($_POST["name"]   ?? ""), ENT_QUOTES);

$komentar = '<pre style="overflow-x:auto">' . $text . '</pre>';
if (!empty($odkaz)) {
    $komentar .= '<a href="' . $odkaz . '">' . $odkaz . '</a>';
}
if (!empty($odkaz2)) {
    $komentar .= ' ' . $odkaz2;
}

// Název tabulky diskuse ze SESSION
$kapela  = $mysqli->real_escape_string($_SESSION['kapela']);
$slozka  = $mysqli->real_escape_string($_SESSION['slozka_souboru_k_zobrazeni']);
$aktualni_diskuse = 'diskuse_' . $kapela . '_' . $slozka;

$cas      = time();
$komentar_db = $mysqli->real_escape_string($komentar);
$jmeno_db    = $mysqli->real_escape_string($jmeno);

$vysledek = $mysqli->query("INSERT INTO `$aktualni_diskuse` (cas, vzkaz, jmeno)
    VALUES ('$cas', '$komentar_db', '$jmeno_db')");

if (!$vysledek) {
    $_SESSION['vysledek'] = "chyba - komentář nebyl uložen: " . $mysqli->error;
} else {
    $_SESSION['vysledek'] = "komentář uložen";
}

require "navrat.php";
?>
