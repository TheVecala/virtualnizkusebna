<?php session_start(); ?>
<?php

$adresa_pro_navrat = $_POST["navrat"] ?? "/";

// Validace session
if (empty($_SESSION['kapela']) || empty($_SESSION['befelemepesseveze']) || empty($_SESSION['slozka_souboru_k_zobrazeni'])) {
    $_SESSION['vysledek'] = "chyba - nejste přihlášen";
    require "navrat.php";
    exit;
}

// Obsah editoru
$akordy = $_POST["editor"] ?? "";

// Cesta k souboru se sestavuje ze SESSION - ne z POST
$sekce           = "uploads";
$cesta_slozek    = "user/" . $_SESSION['kapela'] . "/" . $_SESSION['befelemepesseveze'] . "/" . $sekce . "/";
$slozka_souboru  = $_SESSION['slozka_souboru_k_zobrazeni'];

// Název textového souboru z POST, ale jen název - bez cesty
$nazev_souboru   = basename($_POST["soubor_akordu"] ?? "akordy.txt");

// Povolit pouze .txt soubory
$pripona = strtolower(pathinfo($nazev_souboru, PATHINFO_EXTENSION));
if ($pripona !== "txt") {
    $_SESSION['vysledek'] = "chyba - lze ukládat pouze .txt soubory";
    require "navrat.php";
    exit;
}

$soubor = "../" . $cesta_slozek . $slozka_souboru . "/texty/" . $nazev_souboru;

// Ověření že soubor existuje (nesmí vytvářet nové soubory přes tento endpoint)
if (!file_exists($soubor)) {
    $_SESSION['vysledek'] = "chyba - soubor neexistuje";
    require "navrat.php";
    exit;
}

if (file_put_contents($soubor, $akordy) !== false) {
    $_SESSION['vysledek'] = "text uložen";
} else {
    $_SESSION['vysledek'] = "chyba - text se nepodařilo uložit";
}

require "navrat.php";
?>
