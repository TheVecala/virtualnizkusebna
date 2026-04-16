<?php
session_start();
header('Content-Type: text/html; charset=utf-8');

// Připojení k DB přes sdílený connect
$db_server   = 'localhost';
$db_login    = 'hanakdusan';
$db_password = 'serepes6';
$db_name     = '18810_virtualni_zkusebna';

$mysqli = new mysqli($db_server, $db_login, $db_password, $db_name);
if ($mysqli->connect_error) {
    http_response_code(500);
    exit;
}
$mysqli->set_charset("utf8");

// Validace session
if (empty($_SESSION['diskuse'])) {
    http_response_code(403);
    exit;
}

// Sestavení komentáře
$vzkaz  = htmlspecialchars(trim($_POST["vzkaz"] ?? ""), ENT_QUOTES);
$odkaz  = htmlspecialchars(trim($_POST["odkaz"] ?? ""), ENT_QUOTES);
$jmeno  = htmlspecialchars(trim($_POST["jmeno"] ?? "Anonym"), ENT_QUOTES);

$komentar = '<p>' . $vzkaz . '</p>';
if (!empty($odkaz)) {
    $komentar .= '<a href="' . $odkaz . '">' . $odkaz . '</a>';
}

$aktualni_diskuse = $mysqli->real_escape_string($_SESSION['diskuse']);
$komentar_db      = $mysqli->real_escape_string($komentar);
$jmeno_db         = $mysqli->real_escape_string($jmeno);
$cas              = time();

$mysqli->query("INSERT INTO `$aktualni_diskuse` (cas, vzkaz, jmeno)
    VALUES ('$cas', '$komentar_db', '$jmeno_db')");
?>
