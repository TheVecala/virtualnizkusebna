<?php session_start(); ?>
<?php
require_once __DIR__ . '/../../config.php';

if (!ma_pravo('move_file')) {
    $_SESSION['vysledek'] = "chyba - nemáte oprávnění";
    require __DIR__ . "/../inc/navrat.php"; exit;
}

$presunout_odkud = $_POST["presunout_odkud"] ?? "";
$presunout_co    = $_POST["presunout_co"]    ?? "";
$presunout_kam   = $_POST["presunout_kam"]   ?? "";
$adresa_pro_navrat = $_POST["navrat"]        ?? "/";

// Sestavení cesty ze SESSION - nesmí přijít z POST (bezpečnost)
$cesta_slozek = "user/" . $_SESSION['kapela'] . "/" . $_SESSION['befelemepesseveze'] . "/uploads/";

$start_souboru = "../../" . $presunout_odkud;
$cil_souboru   = "../../" . $cesta_slozek . $presunout_kam . "/" . $presunout_co;

// Základní validace - nesmí být prázdné hodnoty
if (empty($presunout_odkud) || empty($presunout_co) || empty($presunout_kam)) {
    $_SESSION['vysledek'] = "chyba - chybějící parametry přesunutí";
    require __DIR__ . "/../inc/navrat.php";
    exit;
}

// Ochrana proti path traversal
if (strpos($presunout_co, "..") !== false || strpos($presunout_kam, "..") !== false) {
    $_SESSION['vysledek'] = "chyba - neplatná cesta";
    require __DIR__ . "/../inc/navrat.php";
    exit;
}

// Ověření že zdrojový soubor existuje
if (!file_exists($start_souboru)) {
    $_SESSION['vysledek'] = "chyba - zdrojový soubor neexistuje: " . $presunout_co;
    require __DIR__ . "/../inc/navrat.php";
    exit;
}

// Ověření že cílová složka existuje
if (!is_dir("../../" . $cesta_slozek . $presunout_kam)) {
    $_SESSION['vysledek'] = "chyba - cílová složka neexistuje: " . $presunout_kam;
    require __DIR__ . "/../inc/navrat.php";
    exit;
}

// Přesunutí
if (rename($start_souboru, $cil_souboru)) {
    $_SESSION['vysledek'] = "soubor " . $presunout_co . " přesunut do " . $presunout_kam;

    // Přesunout také WaveSurfer peaks cache, pokud existuje
    $peaks_start = $start_souboru . ".peaks.json";
    $peaks_cil   = $cil_souboru   . ".peaks.json";
    if (file_exists($peaks_start)) {
        rename($peaks_start, $peaks_cil);
    }

    // Přesunout i DB záznamy vázané na file_path — časové poznámky i popisek
    // nahrávky leží ve stejné tabulce recording_notes (viz ajax_nahravka_poznamky.php),
    // klíčované přesně tímhle file_path, takže je stačí jedním UPDATE přepsat na nový.
    // Tabulka se vytváří líně až při první poznámce, proto @ (nemusí ještě existovat).
    $novy_file_path = $cesta_slozek . $presunout_kam . "/" . $presunout_co;
    include __DIR__ . "/../login/connect.php";
    $stmt = @$mysqli->prepare("UPDATE recording_notes SET file_path = ? WHERE file_path = ?");
    if ($stmt) {
        $stmt->bind_param("ss", $novy_file_path, $presunout_odkud);
        $stmt->execute();
    }
} else {
    $_SESSION['vysledek'] = "chyba - soubor se nepodařilo přesunout";
}

require __DIR__ . "/../inc/navrat.php";
?>