<?php session_start();
require_once __DIR__ . "/../../config.php";

require __DIR__ . "/../inc/remove_accents.php";

if (!ma_pravo('rename_val')) {
    $_SESSION['vysledek'] = "chyba - nemáte oprávnění";
    require __DIR__ . "/../inc/navrat.php"; exit;
}


$puvodni_jmeno     = trim($_POST["puvodni_jmeno_valu_k_prejmenovani"] ?? "");
$nove_jmeno_raw    = trim($_POST["nove_jmeno_valu_k_prejmenovani"]    ?? "");
$adresa_pro_navrat = $_POST["navrat"] ?? "/";

// Odstranit diakritiku a normalizovat nové jméno
$nove_jmeno = remove_accents(trim($nove_jmeno_raw));
// Povolit pouze bezpečné znaky: písmena, čísla, pomlčka, podtržítko, mezera
$nove_jmeno = preg_replace('/[^a-zA-Z0-9_\- ]/', '', $nove_jmeno);
$nove_jmeno = trim($nove_jmeno);

// Validace
if (empty($puvodni_jmeno) || empty($nove_jmeno)) {
    $_SESSION['vysledek'] = "chyba - chybí název válu";
    require __DIR__ . "/../inc/navrat.php";
    exit;
}

if (strpos($puvodni_jmeno, "..") !== false || strpos($nove_jmeno, "..") !== false) {
    $_SESSION['vysledek'] = "chyba - neplatný název";
    require __DIR__ . "/../inc/navrat.php";
    exit;
}

if ($puvodni_jmeno === $nove_jmeno) {
    $_SESSION['vysledek'] = "chyba - nové jméno je stejné jako původní";
    require __DIR__ . "/../inc/navrat.php";
    exit;
}

// Cesta ze SESSION, ne z POST
$cesta_slozek = "user/" . $_SESSION['kapela'] . "/" . $_SESSION['befelemepesseveze'] . "/uploads/";

$odkud = "../../" . $cesta_slozek . $puvodni_jmeno;
$kam   = "../../" . $cesta_slozek . $nove_jmeno;

if (!is_dir($odkud)) {
    $_SESSION['vysledek'] = "chyba - původní vál neexistuje: " . $puvodni_jmeno;
    require __DIR__ . "/../inc/navrat.php";
    exit;
}

if (is_dir($kam)) {
    $_SESSION['vysledek'] = "chyba - vál s tímto názvem už existuje: " . $nove_jmeno;
    require __DIR__ . "/../inc/navrat.php";
    exit;
}

if (rename($odkud, $kam)) {
    // Přepnout SESSION na nový název pokud byl přejmenován aktuálně zobrazený vál
    if ($_SESSION['slozka_souboru_k_zobrazeni'] == $puvodni_jmeno) {
        $_SESSION['slozka_souboru_k_zobrazeni'] = $nove_jmeno;
    }

    // Aktualizovat pořadí v poradi.json (starý název → nový název)
    $soubor_poradi = "../../" . $cesta_slozek . "poradi.json";
    if (file_exists($soubor_poradi)) {
        $poradi = json_decode(file_get_contents($soubor_poradi), true);
        if (is_array($poradi)) {
            $idx = array_search($puvodni_jmeno, $poradi);
            if ($idx !== false) {
                $poradi[$idx] = $nove_jmeno;
                file_put_contents($soubor_poradi, json_encode($poradi));
            }
        }
    }

    // Aktualizovat název v souboru nazev_valu.txt
    $soubor_nazvu = $kam . "/data/nazev_valu.txt";
    if (file_exists($soubor_nazvu)) {
        file_put_contents($soubor_nazvu, $nove_jmeno_raw);
    }

    // ── Domigrovat DB záznamy vázané na starý slug ──
    include __DIR__ . "/../login/connect.php";
    $kapela_db = $mysqli->real_escape_string($_SESSION['kapela']);

    // 1) Diskusní tabulka válu (jméno tabulky nese starý slug) — přejmenovat.
    //    @ potlačuje warning, pokud tabulka ještě nikdy nevznikla (nikdo nekomentoval).
    $stara_tab = "diskuse_" . $kapela_db . "_" . $mysqli->real_escape_string($puvodni_jmeno);
    $nova_tab  = "diskuse_" . $kapela_db . "_" . $mysqli->real_escape_string($nove_jmeno);
    @$mysqli->query("RENAME TABLE `$stara_tab` TO `$nova_tab`");

    // 2) recording_notes (časové poznámky i popisky nahrávek) — file_path všech
    //    souborů uvnitř válu obsahuje starý slug jako prefix, přepsat na nový.
    $stary_prefix = $cesta_slozek . $puvodni_jmeno . "/";
    $novy_prefix  = $cesta_slozek . $nove_jmeno . "/";
    $stmt = @$mysqli->prepare("
        UPDATE recording_notes
        SET file_path = CONCAT(?, SUBSTRING(file_path, ?))
        WHERE file_path LIKE CONCAT(?, '%')
    ");
    if ($stmt) {
        $pozice = strlen($stary_prefix) + 1;
        $stmt->bind_param("sis", $novy_prefix, $pozice, $stary_prefix);
        $stmt->execute();
    }

    $_SESSION['vysledek'] = "vál přejmenován na \"" . $nove_jmeno . "\"";
} else {
    $_SESSION['vysledek'] = "chyba - vál se nepodařilo přejmenovat";
}

require __DIR__ . "/../inc/navrat.php";
?>
