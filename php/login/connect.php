<?php
$db_server   = 'localhost';
$db_login    = 'hanakdusan';
$db_password = 'serepes6';
$db_name     = '18810_virtualni_zkusebna';

$mysqli = new mysqli($db_server, $db_login, $db_password, $db_name);

if ($mysqli->connect_error) {
    die('<p style="color:red">Nastala chyba v připojení k databázi: ' . $mysqli->connect_error . '</p>');
}

$mysqli->set_charset("utf8");
?>
