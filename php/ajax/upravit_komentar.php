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

$typ       = $_POST['typ']       ?? '';
$cas       = (int)($_POST['cas'] ?? 0);
$novy_text = trim($_POST['text'] ?? '');

$kapela = $_SESSION['kapela'] ?? '';
$slozka = $_SESSION['slozka_souboru_k_zobrazeni'] ?? '';

if (empty($kapela) || $cas === 0 || $novy_text === '') {
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

$text_db = $mysqli->real_escape_string($novy_text);
$ok = $mysqli->query("UPDATE `$tabulka` SET vzkaz = '$text_db' WHERE cas = $cas LIMIT 1");

if ($ok) {
    // Renderuje HTML stejnou logikou jako ajax_diskuse.php (nový formát = čistý text)
    $text_safe = htmlspecialchars($novy_text, ENT_QUOTES, 'UTF-8');
    $text_safe = preg_replace('/(https?:\/\/[^\s]+)/', '<a href="$1" target="_blank" rel="noopener">$1</a>', $text_safe);
    $text_safe = nl2br($text_safe);
    echo json_encode(["ok" => true, "vzkaz_html" => $text_safe]);
} else {
    echo json_encode(["ok" => false, "chyba" => "Chyba databáze: " . $mysqli->error]);
}
