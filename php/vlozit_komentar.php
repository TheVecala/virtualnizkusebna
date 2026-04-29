<?php
session_start();
error_reporting(0);
header('Content-Type: application/json; charset=utf-8');

if (empty($_SESSION['login'])) {
    echo json_encode(["ok" => false, "chyba" => "Nejste přihlášen"]);
    exit;
}

include "login/connect.php";

$text   = htmlspecialchars(trim($_POST["text"]   ?? ""), ENT_QUOTES);
$odkaz  = htmlspecialchars(trim($_POST["odkaz"]  ?? ""), ENT_QUOTES);
$odkaz2 = htmlspecialchars(trim($_POST["odkaz2"] ?? ""), ENT_QUOTES);
$jmeno  = htmlspecialchars(trim($_POST["name"]   ?? ""), ENT_QUOTES);
$pouzit_hlavni = !empty($_POST["pouzit_hlavni_diskusi"]);

if (empty($text)) {
    echo json_encode(["ok" => false, "chyba" => "Text nesmí být prázdný"]);
    exit;
}

$komentar = '<pre style="overflow-x:auto">' . $text . '</pre>';
if (!empty($odkaz))  { $komentar .= '<a href="' . $odkaz . '">' . $odkaz . '</a>'; }
if (!empty($odkaz2)) { $komentar .= ' ' . $odkaz2; }

$kapela  = $_SESSION['kapela']                     ?? "";
$slozka  = $_SESSION['slozka_souboru_k_zobrazeni'] ?? "";

// Výběr tabulky diskuse
if ($pouzit_hlavni || empty($slozka)) {
    // Nápady kapely — hlavní diskuse
    if (empty($_SESSION['diskuse'])) {
        echo json_encode(["ok" => false, "chyba" => "Diskuse není nastavena"]);
        exit;
    }
    $aktualni_diskuse = $mysqli->real_escape_string($_SESSION['diskuse']);
} else {
    // Diskuse per-vál
    $aktualni_diskuse = "diskuse_" . $mysqli->real_escape_string($kapela) . "_" . $mysqli->real_escape_string($slozka);

    // Vytvořit tabulku pokud neexistuje
    $mysqli->query("CREATE TABLE IF NOT EXISTS `$aktualni_diskuse` (
        cas   INT(11)     NOT NULL,
        vzkaz TEXT        NOT NULL,
        jmeno VARCHAR(50) NOT NULL
    )");
}

$cas         = time();
$komentar_db = $mysqli->real_escape_string($komentar);
$jmeno_db    = $mysqli->real_escape_string($jmeno);

$ok = $mysqli->query("INSERT INTO `$aktualni_diskuse` (cas, vzkaz, jmeno)
    VALUES ('$cas', '$komentar_db', '$jmeno_db')");

if ($ok) {
    echo json_encode([
        "ok"    => true,
        "vzkaz" => $komentar,
        "jmeno" => htmlspecialchars(strip_tags($jmeno)),
        "datum" => date("j.n.Y G:i:s", $cas),
    ]);
} else {
    echo json_encode(["ok" => false, "chyba" => "Chyba databáze: " . $mysqli->error]);
}
