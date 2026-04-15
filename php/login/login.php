<?php session_start(); ?>
<meta charset="utf-8">
<?php
include "connect.php";

$adresa_pro_navrat = isset($_POST["navrat"]) ? $_POST["navrat"] : "/index.php";

// Validace vstupů
$login_raw = trim($_POST["nick"] ?? "");
$heslo_raw = $_POST["heslo"] ?? "";

if (empty($login_raw) || empty($heslo_raw)) {
    $_SESSION['chyba_prihlaseni'] = "wrong_heslo";
    require "../navrat.php";
    exit;
}

$login    = strtolower($mysqli->real_escape_string($login_raw));
$md5heslo = md5($heslo_raw);

// Dotaz do databáze
$dotaz  = $mysqli->query("SELECT * FROM uzivatele WHERE login = '$login' AND heslo = '$md5heslo'");
$overeni = $dotaz ? $dotaz->num_rows : 0;

if ($overeni === 1) {
    $row = $dotaz->fetch_assoc();

    $_SESSION['login']            = $login;
    $_SESSION['id']               = $row["id"];
    $_SESSION['diskuse']          = $row["adresa_diskuse"];
    $_SESSION['nazev']            = $row["cely_nazev"];
    $_SESSION['vysledek']         = "přihlášen jako " . $login_raw;
    $_SESSION['befelemepesseveze'] = $row["hashedkapela"];
    $_SESSION['prihlasen']        = true;
    $_SESSION['kapela']           = $login;

    // Regenerace session ID po přihlášení - ochrana proti session fixation
    session_regenerate_id(true);

    require "../navrat.php";
    exit;

} else {
    $_SESSION['chyba_prihlaseni'] = "wrong_heslo";
    require "../navrat.php";
    exit;
}
?>
