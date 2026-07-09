<?php session_start(); ?>
<?php
require_once __DIR__ . "/../config.php";

if (!ma_pravo('upload')) {
    $_SESSION['vysledek'] = "chyba - nemáte oprávnění";
    require "navrat.php"; exit;
}


$adresa_pro_navrat = $_POST["navrat"] ?? "/";

// Povolené přípony souborů - php a spustitelné soubory NESMÍ být povoleny
$povolene_pripony = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'pdf', 'txt', 'jpg', 'jpeg', 'png', 'gif'];

// Ověření že soubor byl odeslán
if (!isset($_FILES["fileToUpload"]) || $_FILES["fileToUpload"]["error"] !== UPLOAD_ERR_OK) {
    $chyby = [
        UPLOAD_ERR_INI_SIZE   => "Soubor je příliš velký (limit serveru).",
        UPLOAD_ERR_FORM_SIZE  => "Soubor je příliš velký (limit formuláře).",
        UPLOAD_ERR_PARTIAL    => "Soubor byl nahrán jen částečně.",
        UPLOAD_ERR_NO_FILE    => "Nebyl vybrán žádný soubor.",
        UPLOAD_ERR_NO_TMP_DIR => "Chybí dočasná složka.",
        UPLOAD_ERR_CANT_WRITE => "Nepodařilo se zapsat na disk.",
    ];
    $kod = $_FILES["fileToUpload"]["error"] ?? UPLOAD_ERR_NO_FILE;
    $_SESSION['vysledek'] = $chyby[$kod] ?? "Chyba při nahrávání souboru.";
    require "navrat.php";
    exit;
}

// Cesta cílové složky se sestavuje ze SESSION - ne z POST
$cesta_slozek = "user/" . $_SESSION['kapela'] . "/" . $_SESSION['befelemepesseveze'] . "/uploads/";
$slozka       = $_SESSION['slozka_souboru_k_zobrazeni'];

// Ochrana proti path traversal v názvu složky
if (empty($slozka) || strpos($slozka, "..") !== false) {
    $_SESSION['vysledek'] = "chyba - neplatná cílová složka";
    require "navrat.php";
    exit;
}

$cil_slozky = "../" . $cesta_slozek . $slozka . "/";

if (!is_dir($cil_slozky)) {
    $_SESSION['vysledek'] = "chyba - cílová složka neexistuje";
    require "navrat.php";
    exit;
}

// Název souboru - odstranit nebezpečné znaky
$puvodni_jmeno  = basename($_FILES["fileToUpload"]["name"]);
$pripona        = strtolower(pathinfo($puvodni_jmeno, PATHINFO_EXTENSION));
$jmeno_bez_ext  = pathinfo($puvodni_jmeno, PATHINFO_FILENAME);

// Sanitizace jména - ponechat jen bezpečné znaky
$jmeno_bez_ext  = preg_replace('/[^a-zA-Z0-9_\-\. ]/', '', $jmeno_bez_ext);
$jmeno_bez_ext  = trim($jmeno_bez_ext);

if (empty($jmeno_bez_ext)) {
    $jmeno_bez_ext = "soubor";
}

// Ověření přípony
if (!in_array($pripona, $povolene_pripony)) {
    $_SESSION['vysledek'] = "chyba - nepovolen typ souboru ." . $pripona . ". Povolené: " . implode(', ', $povolene_pripony);
    require "navrat.php";
    exit;
}

$bezpecne_jmeno = $jmeno_bez_ext . "." . $pripona;
$target_file    = $cil_slozky . $bezpecne_jmeno;

// Kontrola duplicity
if (file_exists($target_file)) {
    $_SESSION['vysledek'] = "Soubor stejného jména už ve složce je.";
    require "navrat.php";
    exit;
}

// Nahrání souboru
if (move_uploaded_file($_FILES["fileToUpload"]["tmp_name"], $target_file)) {
    $_SESSION['vysledek'] = "Soubor \"" . $bezpecne_jmeno . "\" byl nahrán.";

    // Odeslání mailů (přeskočit pokud mysql nefunguje)
    if ($_POST["odeslat"] == "true" && isset($_SESSION['kapela'])) {
        @include "login/connect.php";
        if (function_exists('mysqli_query') && isset($mysqli)) {
            $seznam_mailu = "maily_" . mysqli_real_escape_string($mysqli, $_SESSION['kapela']);
            $maily = mysqli_query($mysqli, "SELECT mail FROM $seznam_mailu");
            $textmailu = "Do složky __ " . $slozka . " __ byl vložen soubor __ " . $bezpecne_jmeno . ".";
            if ($maily) {
                while ($adresa = mysqli_fetch_array($maily)) {
                    mail($adresa["mail"], "nový soubor v playlistu", $textmailu, "From:" . MAIL_FROM);
                }
            }
        }
    }

} else {
    $_SESSION['vysledek'] = "chyba - soubor se nepodařilo nahrát";
}

require "navrat.php";
?>
