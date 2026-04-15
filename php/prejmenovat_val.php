<?php session_start(); ?>
<?php
require "remove_accents.php";

$puvodni_jmeno     = $_POST["puvodni_jmeno_valu_k_prejmenovani"] ?? "";
$nove_jmeno_raw    = $_POST["nove_jmeno_valu_k_prejmenovani"]    ?? "";
$adresa_pro_navrat = $_POST["navrat"]                            ?? "/";

// Odstranit diakritiku a normalizovat nové jméno
$nove_jmeno = remove_accents(trim($nove_jmeno_raw));
// Povolit pouze bezpečné znaky: písmena, čísla, pomlčka, podtržítko, mezera
$nove_jmeno = preg_replace('/[^a-zA-Z0-9_\- ]/', '', $nove_jmeno);
$nove_jmeno = trim($nove_jmeno);

// Validace
if (empty($puvodni_jmeno) || empty($nove_jmeno)) {
    $_SESSION['vysledek'] = "chyba - chybí název válu";
    require "navrat.php";
    exit;
}

if (strpos($puvodni_jmeno, "..") !== false || strpos($nove_jmeno, "..") !== false) {
    $_SESSION['vysledek'] = "chyba - neplatný název";
    require "navrat.php";
    exit;
}

if ($puvodni_jmeno === $nove_jmeno) {
    $_SESSION['vysledek'] = "chyba - nové jméno je stejné jako původní";
    require "navrat.php";
    exit;
}

// Cesta ze SESSION, ne z POST
$cesta_slozek = "user/" . $_SESSION['kapela'] . "/" . $_SESSION['befelemepesseveze'] . "/uploads/";

$odkud = "../" . $cesta_slozek . $puvodni_jmeno;
$kam   = "../" . $cesta_slozek . $nove_jmeno;

if (!is_dir($odkud)) {
    $_SESSION['vysledek'] = "chyba - původní vál neexistuje: " . $puvodni_jmeno;
    require "navrat.php";
    exit;
}

if (is_dir($kam)) {
    $_SESSION['vysledek'] = "chyba - vál s tímto názvem už existuje: " . $nove_jmeno;
    require "navrat.php";
    exit;
}

if (rename($odkud, $kam)) {
    // Přepnout SESSION na nový název pokud byl přejmenován aktuálně zobrazený vál
    if ($_SESSION['slozka_souboru_k_zobrazeni'] == $puvodni_jmeno) {
        $_SESSION['slozka_souboru_k_zobrazeni'] = $nove_jmeno;
    }

    // Aktualizovat název v souboru nazev_valu.txt
    $soubor_nazvu = $kam . "/data/nazev_valu.txt";
    if (file_exists($soubor_nazvu)) {
        file_put_contents($soubor_nazvu, $nove_jmeno_raw);
    }

    $_SESSION['vysledek'] = "vál přejmenován na \"" . $nove_jmeno . "\"";
} else {
    $_SESSION['vysledek'] = "chyba - vál se nepodařilo přejmenovat";
}

require "navrat.php";
?>
