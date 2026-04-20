<?php session_start();
error_reporting(0);

$adresa_pro_navrat = $_POST["navrat"] ?? "/";

if (empty($_SESSION['login'])) {
    $_SESSION['vysledek'] = "chyba - nejste přihlášen";
    require "navrat.php";
    exit;
}

// Obsah editoru
$akordy = $_POST["editor"] ?? "";

// Název souboru - jen basename, bez cesty
$nazev_souboru = basename($_POST["soubor_akordu"] ?? "akordy.txt");

// Pouze .txt soubory
$pripona = strtolower(pathinfo($nazev_souboru, PATHINFO_EXTENSION));
if ($pripona !== "txt") {
    $_SESSION['vysledek'] = "chyba - lze ukládat pouze .txt soubory";
    require "navrat.php";
    exit;
}

// Sestavit cestu ze SESSION
$kapela            = $_SESSION['kapela']                         ?? "";
$befelemepesseveze = $_SESSION['befelemepesseveze']              ?? "";
$slozka_souboru    = $_SESSION['slozka_souboru_k_zobrazeni']     ?? "";

if (empty($kapela) || empty($befelemepesseveze) || empty($slozka_souboru)) {
    $_SESSION['vysledek'] = "chyba - chybí kontext skladby, zkuste obnovit stránku";
    require "navrat.php";
    exit;
}

$soubor = "../user/" . $kapela . "/" . $befelemepesseveze . "/uploads/" . $slozka_souboru . "/texty/" . $nazev_souboru;

if (!file_exists($soubor)) {
    $_SESSION['vysledek'] = "chyba - soubor " . $nazev_souboru . " neexistuje";
    require "navrat.php";
    exit;
}

if (file_put_contents($soubor, $akordy) !== false) {
    $_SESSION['vysledek'] = "text uložen";
} else {
    $_SESSION['vysledek'] = "chyba - text se nepodařilo uložit";
}

require "navrat.php";
