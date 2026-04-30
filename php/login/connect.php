<?php
require_once dirname(__FILE__) . "/../../config.php";

$mysqli = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);

if ($mysqli->connect_error) {
    die('<p style="color:red">Nastala chyba v připojení k databázi: ' . $mysqli->connect_error . '</p>');
}

$mysqli->set_charset("utf8");
?>
