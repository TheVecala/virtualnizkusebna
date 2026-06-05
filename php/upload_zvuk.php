<?php
/**
 * upload_zvuk.php
 * Přijme nahraný audio soubor z WaveSurfer Record (webm/m4a/ogg)
 * a uloží ho do složky skladby. Žádná konverze — soubor se uloží tak jak je.
 *
 * Vrací JSON: { ok: bool, zprava: string, soubor: string }
 */

session_start();
require_once __DIR__ . '/../config.php';

header('Content-Type: application/json; charset=utf-8');

function odpovez(bool $ok, string $zprava, string $soubor = ''): void {
    echo json_encode(['ok' => $ok, 'zprava' => $zprava, 'soubor' => $soubor], JSON_UNESCAPED_UNICODE);
    exit;
}

// ── Přihlášení ──
if (empty($_SESSION['logged_in_single'])) {
    odpovez(false, 'Nejsi přihlášen.');
}

// ── Soubor ──
if (!isset($_FILES['fileToUpload']) || $_FILES['fileToUpload']['error'] !== UPLOAD_ERR_OK) {
    $chyby = [
        UPLOAD_ERR_INI_SIZE   => 'Soubor je příliš velký (limit serveru).',
        UPLOAD_ERR_FORM_SIZE  => 'Soubor je příliš velký (limit formuláře).',
        UPLOAD_ERR_PARTIAL    => 'Soubor byl nahrán jen částečně.',
        UPLOAD_ERR_NO_FILE    => 'Nebyl odeslán žádný soubor.',
        UPLOAD_ERR_NO_TMP_DIR => 'Chybí dočasná složka serveru.',
        UPLOAD_ERR_CANT_WRITE => 'Nelze zapsat na disk.',
    ];
    $kod = $_FILES['fileToUpload']['error'] ?? UPLOAD_ERR_NO_FILE;
    odpovez(false, $chyby[$kod] ?? 'Chyba při nahrávání souboru.');
}

// ── SESSION data ──
$kapela            = $_SESSION['kapela']                      ?? '';
$befelemepesseveze = $_SESSION['befelemepesseveze']           ?? '';
$slozka            = $_SESSION['slozka_souboru_k_zobrazeni']  ?? '';

if (empty($kapela) || empty($befelemepesseveze) || empty($slozka)) {
    odpovez(false, 'Chybí SESSION data (kapela / slozka).');
}
if (strpos($slozka, '..') !== false || strpos($slozka, '/') !== false) {
    odpovez(false, 'Neplatná cílová složka.');
}

$cil_slozky = __DIR__ . '/../user/' . $kapela . '/' . $befelemepesseveze . '/uploads/' . $slozka . '/';

if (!is_dir($cil_slozky)) {
    odpovez(false, 'Cílová složka neexistuje.');
}

// ── Název a přípona ──
$povolene_pripony = ['webm', 'm4a', 'ogg', 'wav'];   // co browser může vyrobit

$puvodni = basename($_FILES['fileToUpload']['name']);
$pripona = strtolower(pathinfo($puvodni, PATHINFO_EXTENSION));

if (!in_array($pripona, $povolene_pripony, true)) {
    odpovez(false, 'Nepovolen typ souboru: .' . htmlspecialchars($pripona));
}

// Název z POST (sanitizovaný na klientovi, znovu sanitizujeme):
$nazev = trim($_POST['nazev'] ?? '');
$nazev = iconv('UTF-8', 'ASCII//TRANSLIT', $nazev);
$nazev = preg_replace('/[^a-zA-Z0-9_\-]/', '', $nazev);
$nazev = trim($nazev);
if (empty($nazev)) {
    $nazev = 'nahravka_' . date('YmdHis');
}

$bezpecne_jmeno = $nazev . '.' . $pripona;
$target_file    = $cil_slozky . $bezpecne_jmeno;

// ── Duplicita ──
if (file_exists($target_file)) {
    $bezpecne_jmeno = $nazev . '_' . date('His') . '.' . $pripona;
    $target_file    = $cil_slozky . $bezpecne_jmeno;
}

// ── Uložit ──
if (!move_uploaded_file($_FILES['fileToUpload']['tmp_name'], $target_file)) {
    odpovez(false, 'Nepodařilo se přesunout soubor na serveru.');
}

odpovez(true, 'Nahrávka uložena.', $bezpecne_jmeno);
