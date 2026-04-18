<?php
session_start();
header('Content-Type: application/json; charset=utf-8');

include "login/connect.php";

if (empty($_SESSION['kapela']) || empty($_SESSION['slozka_souboru_k_zobrazeni'])) {
    echo json_encode(["ok" => false, "chyba" => "Nejste přihlášen"]);
    exit;
}

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

$kapela  = $mysqli->real_escape_string($_SESSION['kapela']);
$slozka  = $mysqli->real_escape_string($_SESSION['slozka_souboru_k_zobrazeni']);
$aktualni_diskuse = 'diskuse_' . $kapela . '_' . $slozka;

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
