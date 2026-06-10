<?php session_start(); ?>
<?php
require_once __DIR__ . '/../config.php';

if (!ma_pravo('create_val')) {
    $_SESSION['vysledek'] = "chyba - nemáte oprávnění";
    require "navrat.php"; exit;
}
require "remove_accents.php";

$adresa_pro_navrat = $_POST["navrat"] ?? "/";

// Validace session
$kapela = $_SESSION['kapela'] ?? "";
$befelemepesseveze = $_SESSION['befelemepesseveze'] ?? "";
$sekce  = $_POST["sekce"] ?? "uploads";

if (empty($kapela) || empty($befelemepesseveze)) {
    $_SESSION['vysledek'] = "chyba - nejste přihlášen";
    require "navrat.php";
    exit;
}

// Validace názvu nové složky
$cely_jmeno = trim($_POST["jmeno_adresare"] ?? "");
if (empty($cely_jmeno)) {
    $_SESSION['vysledek'] = "chyba - chybí jméno složky";
    require "navrat.php";
    exit;
}

$ocesany_jmeno = remove_accents($cely_jmeno);
// Ponechat jen bezpečné znaky
$ocesany_jmeno = preg_replace('/[^a-zA-Z0-9_\- ]/', '', $ocesany_jmeno);
$ocesany_jmeno = trim($ocesany_jmeno);

if (empty($ocesany_jmeno)) {
    $_SESSION['vysledek'] = "chyba - název složky obsahuje pouze nepodporované znaky";
    require "navrat.php";
    exit;
}

$cil_adresare = "../user/" . $kapela . "/" . $befelemepesseveze . "/" . $sekce . "/";

// Ověření že složka ještě neexistuje
if (is_dir($cil_adresare . $ocesany_jmeno)) {
    $_SESSION['vysledek'] = "chyba - složka s tímto názvem již existuje";
    require "navrat.php";
    exit;
}

// Vytvoření hlavní složky
if (!mkdir($cil_adresare . $ocesany_jmeno)) {
    $_SESSION['vysledek'] = "chyba - složku se nepodařilo vytvořit";
    require "navrat.php";
    exit;
}

// Vytvoření podsložky texty + vzorový soubor akordů
if (!mkdir($cil_adresare . $ocesany_jmeno . "/texty")) {
    $_SESSION['vysledek'] = "chyba - složku texty se nepodařilo vytvořit";
    require "navrat.php";
    exit;
}
copy("../data/akordy.txt", $cil_adresare . $ocesany_jmeno . "/texty/akordy.txt");

// Vytvoření podsložky data + uložení názvu válu
if (!mkdir($cil_adresare . $ocesany_jmeno . "/data")) {
    $_SESSION['vysledek'] = "chyba - složku data se nepodařilo vytvořit";
    require "navrat.php";
    exit;
}
file_put_contents($cil_adresare . $ocesany_jmeno . "/data/nazev_valu.txt", $cely_jmeno);

// Vytvoření tabulky diskuse pro nový vál
include "login/connect.php";
$kapela_db = $mysqli->real_escape_string($kapela);
$jmeno_db  = $mysqli->real_escape_string($ocesany_jmeno);
$adresa_diskuse_valu = "diskuse_" . $kapela_db . "_" . $jmeno_db;

$mysqli->query("CREATE TABLE IF NOT EXISTS `$adresa_diskuse_valu` (
    cas   INT(11)     NOT NULL,
    vzkaz TEXT        NOT NULL,
    jmeno VARCHAR(50) NOT NULL
)");

// $cas   = time();
// $vzkaz = $mysqli->real_escape_string("Sem je možno vkládat");
// $mysqli->query("INSERT INTO `$adresa_diskuse_valu` (cas, vzkaz, jmeno)
//     VALUES ('$cas', '$vzkaz', 'admin')");

// Přepnout zobrazení na novou složku
$_SESSION['slozka_souboru_k_zobrazeni'] = $ocesany_jmeno;
$_SESSION['vysledek'] = "Složka \"" . $cely_jmeno . "\" byla úspěšně vytvořena";

require "navrat.php";
?>
