<?php session_start(); ?>
<?php
include "login/connect.php";

$adresa_pro_navrat = $_POST["navrat"] ?? "/";

// --- Validace vstupů ---
$nick          = trim($_POST["nick"]           ?? "");
$jmeno_zkusebny = trim($_POST["jmeno_zkusebny"] ?? "");
$heslo         = $_POST["heslo"]               ?? "";
$over_heslo    = $_POST["over_heslo"]          ?? "";
$email         = trim($_POST["email"]          ?? "");
$jmeno_adresare = trim($_POST["jmeno_adresare"] ?? "hello_world");

if (empty($nick)) {
    $_SESSION['vysledek'] = "chyba - nebyl vyplněn nick";
    require "navrat.php"; exit;
}
if (empty($heslo)) {
    $_SESSION['vysledek'] = "chyba - nebylo vyplněno heslo";
    require "navrat.php"; exit;
}
if ($heslo !== $over_heslo) {
    $_SESSION['vysledek'] = "chyba - hesla se neshodují";
    require "navrat.php"; exit;
}
if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $_SESSION['vysledek'] = "chyba - neplatný email";
    require "navrat.php"; exit;
}

// Sanitizace pro DB
$nick_db    = $mysqli->real_escape_string($nick);
$email_db   = $mysqli->real_escape_string($email);
$md5_heslo  = md5($heslo);
$nahoda     = mt_rand();

// Ověření unikátnosti nicku
$user_check = $mysqli->query("SELECT login FROM uzivatele WHERE login = '$nick_db'");
if ($user_check && $user_check->num_rows > 0) {
    $_SESSION['vysledek'] = "chyba - tento nick už používá jiný uživatel";
    require "navrat.php"; exit;
}

// --- Vytvoření složek ---
$koren = "../user/";

$slozky = [
    $koren . $nick,
    $koren . $nick . "/" . $nahoda,
    $koren . $nick . "/" . $nahoda . "/uploads/",
    $koren . $nick . "/" . $nahoda . "/uploads/" . $jmeno_adresare,
    $koren . $nick . "/" . $nahoda . "/uploads/" . $jmeno_adresare . "/data",
    $koren . $nick . "/" . $nahoda . "/uploads/" . $jmeno_adresare . "/texty",
];

foreach ($slozky as $slozka) {
    if (!mkdir($slozka)) {
        $_SESSION['vysledek'] = "chyba - nepodařilo se vytvořit složku: " . basename($slozka);
        session_destroy();
        require "navrat.php"; exit;
    }
}

// Zkopírovat vzorový soubor akordů
$vzor_akordu = "../data/akordy.txt";
$cil_akordu  = $koren . $nick . "/" . $nahoda . "/uploads/" . $jmeno_adresare . "/texty/akordy.txt";
copy($vzor_akordu, $cil_akordu);

// Uložit název válu do souboru
$soubor_nazvu = $koren . $nick . "/" . $nahoda . "/uploads/" . $jmeno_adresare . "/data/nazev_valu.txt";
file_put_contents($soubor_nazvu, $jmeno_zkusebny ?: $jmeno_adresare);

// --- Vložení uživatele do DB ---
$adresa_diskuse = "diskuse_" . $nick_db . "_123456789";

$sql = $mysqli->query("INSERT INTO uzivatele VALUES ('', '$nick_db', '$md5_heslo', '', '$email_db', '$nahoda', '$adresa_diskuse')");

if (!$sql) {
    $_SESSION['vysledek'] = "chyba - registrace do DB selhala: " . $mysqli->error;
    require "navrat.php"; exit;
}

// --- Vytvoření tabulky diskuse ---
$adresa_diskuse_safe = $mysqli->real_escape_string($adresa_diskuse);
$mysqli->query("CREATE TABLE IF NOT EXISTS `$adresa_diskuse_safe` (
    cas   INT(11)      NOT NULL,
    vzkaz TEXT         NOT NULL,
    jmeno VARCHAR(50)  NOT NULL
)");

$cas   = time();
$vzkaz = $mysqli->real_escape_string("Sem je možno vkládat nápady, odkazy, názory a jiný věci");
$jmeno_adm = "admin";
$mysqli->query("INSERT INTO `$adresa_diskuse_safe` (cas, vzkaz, jmeno) VALUES ('$cas', '$vzkaz', '$jmeno_adm')");

// Vytvoření diskuse pro první vál
$adresa_diskuse_valu = "diskuse_" . $nick_db . "_" . $mysqli->real_escape_string($jmeno_adresare);
$mysqli->query("CREATE TABLE IF NOT EXISTS `$adresa_diskuse_valu` (
    cas   INT(11)      NOT NULL,
    vzkaz TEXT         NOT NULL,
    jmeno VARCHAR(50)  NOT NULL
)");
$mysqli->query("INSERT INTO `$adresa_diskuse_valu` (cas, vzkaz, jmeno) VALUES ('$cas', 'Sem je možno vkládat', 'admin')");

// --- Nastavení SESSION a přihlášení ---
$_SESSION['login']             = $nick;
$_SESSION['kapela']            = $nick;
$_SESSION['befelemepesseveze'] = $nahoda;
$_SESSION['diskuse']           = $adresa_diskuse;
$_SESSION['slozka_souboru_k_zobrazeni'] = $jmeno_adresare;
$_SESSION['vysledek']          = "Registrace a vytvoření zkušebny bylo úspěšně dokončeno!";

require "navrat.php";
?>
