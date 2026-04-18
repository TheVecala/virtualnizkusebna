<?php
session_start();
// Potlačit warningy aby nezkazily JSON výstup
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

if (empty($text)) {
    echo json_encode(["ok" => false, "chyba" => "Text nesmí být prázdný"]);
    exit;
}

$komentar = '<pre style="overflow-x:auto">' . $text . '</pre>';
if (!empty($odkaz)) {
    $komentar .= '<a href="' . $odkaz . '">' . $odkaz . '</a>';
}
if (!empty($odkaz2)) {
    $komentar .= ' ' . $odkaz2;
}

// Používáme hlavní kapelovou diskusi - vždy existuje, nastavuje se při přihlášení
// Diskuse per-vál bude přidána až budou doděláno vytváření tabulek pro každý vál
if (empty($_SESSION['diskuse'])) {
    echo json_encode(["ok" => false, "chyba" => "Diskuse není nastavena, zkuste se odhlásit a přihlásit znovu"]);
    exit;
}

$aktualni_diskuse = $mysqli->real_escape_string($_SESSION['diskuse']);

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
