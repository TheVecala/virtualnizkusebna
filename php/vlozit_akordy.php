<?php session_start();
error_reporting(0);
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json; charset=utf-8');

if (!ma_pravo('edit_text')) {
    echo json_encode(["ok" => false, "vysledek" => "chyba - nemáte oprávnění"]);
    exit;
}

$akordy        = $_POST["editor"] ?? "";
$nazev_souboru = basename($_POST["soubor_akordu"] ?? "akordy.txt");

// Ochrana proti prázdnému obsahu
if (trim($akordy) === "") {
    echo json_encode(["ok" => false, "vysledek" => "chyba - nelze uložit prázdný text (předchozí verze zachována)"]);
    exit;
}

// Pouze .txt soubory
$pripona = strtolower(pathinfo($nazev_souboru, PATHINFO_EXTENSION));
if ($pripona !== "txt") {
    echo json_encode(["ok" => false, "vysledek" => "chyba - lze ukládat pouze .txt soubory"]);
    exit;
}

// Cesta ze SESSION
$kapela            = $_SESSION['kapela']                     ?? "";
$befelemepesseveze = $_SESSION['befelemepesseveze']          ?? "";
$slozka_souboru    = $_SESSION['slozka_souboru_k_zobrazeni'] ?? "";

if (empty($kapela) || empty($befelemepesseveze) || empty($slozka_souboru)) {
    echo json_encode(["ok" => false, "vysledek" => "chyba - chybí kontext skladby"]);
    exit;
}

$slozka_textu = "../user/" . $kapela . "/" . $befelemepesseveze . "/uploads/" . $slozka_souboru . "/texty/";
$soubor       = $slozka_textu . $nazev_souboru;

if (!file_exists($soubor)) {
    echo json_encode(["ok" => false, "vysledek" => "chyba - soubor " . $nazev_souboru . " neexistuje"]);
    exit;
}

// ── Záloha předchozí verze ──
$slozka_history = $slozka_textu . "_history/";
if (!is_dir($slozka_history)) {
    mkdir($slozka_history, 0755, true);
}

$nazev_bez_ext = pathinfo($nazev_souboru, PATHINFO_FILENAME);
$timestamp     = date("Y-m-d_H-i-s");
$nazev_zalohy  = $nazev_bez_ext . "_" . $timestamp . ".txt";
copy($soubor, $slozka_history . $nazev_zalohy);

// Ponechat jen posledních 20 záloh
$zalohy = glob($slozka_history . $nazev_bez_ext . "_*.txt");
if ($zalohy && count($zalohy) > 20) {
    sort($zalohy);
    foreach (array_slice($zalohy, 0, count($zalohy) - 20) as $stara) {
        unlink($stara);
    }
}

// ── Uložení ──
if (file_put_contents($soubor, $akordy) !== false) {
    echo json_encode(["ok" => true, "vysledek" => "text uložen"]);
} else {
    echo json_encode(["ok" => false, "vysledek" => "chyba - text se nepodařilo uložit"]);
}
