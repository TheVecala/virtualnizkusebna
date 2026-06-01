<?php
session_start();
error_reporting(0);
header('Content-Type: application/json; charset=utf-8');

// 1. ZMĚNA: Kontrola single-band přihlášení
if (empty($_SESSION['logged_in_single'])) {
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
    echo json_encode(["ok" => false, "chyba" => "Něco sem musíš napsat."]);
    exit;
}

$komentar = $text;
// if (!empty($odkaz))  { $komentar .= "\n" . $odkaz; }
// if (!empty($odkaz2)) { $komentar .= " " . $odkaz2; }

$kapela  = $_SESSION['kapela']                     ?? "";
$slozka  = $_SESSION['slozka_souboru_k_zobrazeni'] ?? "";

// Výběr tabulky diskuse
if ($pouzit_hlavni || empty($slozka)) {
    
    // 2. ZMĚNA: Nápady kapely — hlavní diskuse (dynamický název)
    if (empty($kapela)) {
        echo json_encode(["ok" => false, "chyba" => "Název kapely není nastaven"]);
        exit;
    }
    
    $aktualni_diskuse = "napady_" . $mysqli->real_escape_string($kapela);
    
    // Vytvořit tabulku pro nápady, pokud náhodou ještě neexistuje
    $mysqli->query("CREATE TABLE IF NOT EXISTS `$aktualni_diskuse` (
        cas   INT(11)     NOT NULL,
        vzkaz TEXT        NOT NULL,
        jmeno VARCHAR(50) NOT NULL
    )");

} else {
    // Diskuse per-vál (zůstává beze změny)
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
        "vzkaz" => nl2br($komentar),
        "jmeno" => htmlspecialchars(strip_tags($jmeno)),
        "datum" => date("j.n.Y G:i:s", $cas),
    ]);
} else {
    echo json_encode(["ok" => false, "chyba" => "Chyba databáze: " . $mysqli->error]);
}