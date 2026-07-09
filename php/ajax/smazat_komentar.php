<?php
session_start();
error_reporting(0);
require_once __DIR__ . '/../../config.php';

header('Content-Type: application/json; charset=utf-8');

if (!ma_pravo('comment')) {
    echo json_encode(["ok" => false, "chyba" => "Nemáte oprávnění"]);
    exit;
}

include "../login/connect.php";

$typ = $_POST['typ'] ?? '';
$cas = (int)($_POST['cas'] ?? 0);

$kapela = $_SESSION['kapela'] ?? '';
$slozka = $_SESSION['slozka_souboru_k_zobrazeni'] ?? '';

if (empty($kapela) || $cas === 0) {
    echo json_encode(["ok" => false, "chyba" => "Chybí parametry"]);
    exit;
}

if ($typ === 'napady') {
    $tabulka = "napady_" . $mysqli->real_escape_string($kapela);
} elseif ($typ === 'diskuse') {
    if (empty($slozka)) {
        echo json_encode(["ok" => false, "chyba" => "Není vybrána skladba"]);
        exit;
    }
    $tabulka = "diskuse_" . $mysqli->real_escape_string($kapela) . "_" . $mysqli->real_escape_string($slozka);
} else {
    echo json_encode(["ok" => false, "chyba" => "Neznámý typ"]);
    exit;
}

$ok = $mysqli->query("DELETE FROM `$tabulka` WHERE cas = $cas LIMIT 1");

echo $ok
    ? json_encode(["ok" => true])
    : json_encode(["ok" => false, "chyba" => "Chyba databáze: " . $mysqli->error]);
