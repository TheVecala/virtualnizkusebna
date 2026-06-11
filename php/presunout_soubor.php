<?php session_start(); ?>
<?php

$presunout_odkud = $_POST["presunout_odkud"] ?? "";
$presunout_co    = $_POST["presunout_co"]    ?? "";
$presunout_kam   = $_POST["presunout_kam"]   ?? "";
$adresa_pro_navrat = $_POST["navrat"]        ?? "/";

// Sestavení cesty ze SESSION - nesmí přijít z POST (bezpečnost)
$cesta_slozek = "user/" . $_SESSION['kapela'] . "/" . $_SESSION['befelemepesseveze'] . "/uploads/";

$start_souboru = "../" . $presunout_odkud;
$cil_souboru   = "../" . $cesta_slozek . $presunout_kam . "/" . $presunout_co;

// Základní validace - nesmí být prázdné hodnoty
if (empty($presunout_odkud) || empty($presunout_co) || empty($presunout_kam)) {
    $_SESSION['vysledek'] = "chyba - chybějící parametry přesunutí";
    require "navrat.php";
    exit;
}

// Ochrana proti path traversal
if (strpos($presunout_co, "..") !== false || strpos($presunout_kam, "..") !== false) {
    $_SESSION['vysledek'] = "chyba - neplatná cesta";
    require "navrat.php";
    exit;
}

// Ověření že zdrojový soubor existuje
if (!file_exists($start_souboru)) {
    $_SESSION['vysledek'] = "chyba - zdrojový soubor neexistuje: " . $presunout_co;
    require "navrat.php";
    exit;
}

// Ověření že cílová složka existuje
if (!is_dir("../" . $cesta_slozek . $presunout_kam)) {
    $_SESSION['vysledek'] = "chyba - cílová složka neexistuje: " . $presunout_kam;
    require "navrat.php";
    exit;
}

// Přesunutí
if (rename($start_souboru, $cil_souboru)) {
    $_SESSION['vysledek'] = "soubor " . $presunout_co . " přesunut do " . $presunout_kam;
} else {
    $_SESSION['vysledek'] = "chyba - soubor se nepodařilo přesunout";
}

require "navrat.php";
?>