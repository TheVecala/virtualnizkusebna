<?php session_start(); ?>
<?php
include "login/connect.php";

$adresa_pro_navrat = $_POST["navrat"] ?? "/";

// Validace vstupů
$nick        = trim($_POST["nick"]           ?? "");
$jmeno_zkus  = trim($_POST["jmeno_zkusebny"] ?? "");
$heslo       = $_POST["heslo"]               ?? "";
$over_heslo  = $_POST["over_heslo"]          ?? "";
$email       = trim($_POST["email"]          ?? "");
$target_dir  = trim($_POST["jmeno_adresare"] ?? "");

if (empty($nick)) {
    $_SESSION['vysledek'] = "chyba - nebyl vyplněn nick";
    require "navrat.php"; exit;
}
if (empty($jmeno_zkus)) {
    $_SESSION['vysledek'] = "chyba - nebyl vyplněn název zkušebny";
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

// Ověření unikátnosti nicku
$nick_db = $mysqli->real_escape_string($nick);
$user_check = $mysqli->query("SELECT login FROM uzivatele WHERE login = '$nick_db'");
if ($user_check && $user_check->num_rows > 0) {
    $_SESSION['vysledek'] = "chyba - tento nick již používá jiný uživatel";
    require "navrat.php"; exit;
}

// Vytvoření složek
$koren = "../user/";
$slozky = [
    $koren . $jmeno_zkus,
    $koren . $jmeno_zkus . "/uploads/",
    $koren . $jmeno_zkus . "/uploads/" . $target_dir,
];

foreach ($slozky as $slozka) {
    if (!mkdir($slozka)) {
        $_SESSION['vysledek'] = "chyba - nepodařilo se vytvořit složku: " . basename($slozka);
        session_destroy();
        require "navrat.php"; exit;
    }
}

// Vložení uživatele do DB
$md5_heslo      = md5($heslo);
$email_db       = $mysqli->real_escape_string($email);
$adresa_diskuse = "diskuse_" . $nick_db . "_123456789";

$sql = $mysqli->query("INSERT INTO uzivatele VALUES
    ('', '$nick_db', '$md5_heslo', '', '$email_db', '', '$adresa_diskuse')");

if (!$sql) {
    $_SESSION['vysledek'] = "chyba - registrace do DB selhala: " . $mysqli->error;
    require "navrat.php"; exit;
}

// Vytvoření tabulky diskuse kapely
$cas   = time();
$vzkaz = $mysqli->real_escape_string("Sem je možno vkládat odkazy na vály, názory a jiný věci");
$mysqli->query("CREATE TABLE IF NOT EXISTS `$adresa_diskuse` (
    cas   INT(11)     NOT NULL,
    vzkaz TEXT        NOT NULL,
    jmeno VARCHAR(50) NOT NULL
)");
$mysqli->query("INSERT INTO `$adresa_diskuse` (cas, vzkaz, jmeno)
    VALUES ('$cas', '$vzkaz', 'admin')");

// Nastavení SESSION
$_SESSION['login']   = $nick;
$_SESSION['kapela']  = $nick;
$_SESSION['diskuse'] = $adresa_diskuse;
$_SESSION['slozka_souboru_k_zobrazeni'] = $target_dir;
$_SESSION['vysledek'] = "Registrace zkušebny byla úspěšně dokončena!";

require "navrat.php";
?>
