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

    $_SESSION['login']             = $login;
    $_SESSION['id']                = $row["id"];
    $_SESSION['diskuse']           = $row["adresa_diskuse"];
    $_SESSION['nazev']             = $row["cely_nazev"];
    $_SESSION['vysledek']          = "přihlášen jako " . $login_raw;
    $_SESSION['befelemepesseveze'] = $row["hashedkapela"];
    $_SESSION['prihlasen']         = true;
    $_SESSION['kapela']            = $login;
    $_SESSION['aktualni_text']     = "akordy.txt";
    $_SESSION['skin']              = "skin1";

    // Nastavit první dostupnou složku (vál) z uploads adresáře
    $uploads = "../user/" . $login . "/" . $row["hashedkapela"] . "/uploads/";
    if (is_dir($uploads)) {
        $slozky = scandir($uploads);
        // Přeskočit . a .. a najít první složku
        $prvni_slozka = "";
        foreach ($slozky as $s) {
            if ($s !== "." && $s !== ".." && is_dir($uploads . $s)) {
                $prvni_slozka = $s;
                break;
            }
        }
        $_SESSION['slozka_souboru_k_zobrazeni'] = $prvni_slozka;
    } else {
        $_SESSION['slozka_souboru_k_zobrazeni'] = "";
    }

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
