<?php session_start(); ?>
<?php

if ($_SESSION['login'] != "") {

?>
<?php

if (isset($_SESSION['prihlasen']))
    { $loged = $_SESSION['prihlasen']; }
else { $loged = "loged nenastaveno"; $_SESSION['prihlasen'] = "loged false"; };

if (isset($_SESSION['login']))
    { $login = $_SESSION['login']; }
else { $login = "login nenastavena"; };

if (isset($_SESSION['kapela']))
    { $kapela = $_SESSION['kapela']; }
else { $kapela = "kapela nenastavena"; };

$sekce = "uploads";

if (isset($_SESSION['vysledek']))
    { $vysledek = $_SESSION['vysledek']; }
else { $vysledek = "zadny vysledek"; };

if (isset($_SESSION['diskuse']))
    { $aktualni_diskuse = $_SESSION['diskuse']; }
else { $aktualni_diskuse = "diskuse_kapela1"; };

if (isset($_SESSION['cely_nazev']))
    { $nazev = $_SESSION['cely_nazev']; }
else { $nazev = "celý název nebyl nastaven"; };

if (isset($_SESSION['playlist']))
    { $aktualni_playlist = $_SESSION['playlist']; }
else { $aktualni_playlist = "playlist_" . $login; };

if (isset($_SESSION['befelemepesseveze']))
    { $befelemepesseveze = $_SESSION['befelemepesseveze']; }
else { $befelemepesseveze = "nenastaveno"; };

if (isset($_SESSION['skin']))
    { $skin = $_SESSION['skin']; }
else { $skin = "skin1"; };

if (isset($_SESSION['aktualni_text']))
    { $aktualni_text = $_SESSION['aktualni_text']; }
else { $aktualni_text = "akordy.txt"; };

?>
<?php

if ($kapela != "kapela nenastavena") {
    $slozka_slozek    = "user/" . $kapela . "/" . $befelemepesseveze . "/" . $sekce . "/";
    $pole_slozek      = scandir($slozka_slozek);
    $delka_pole_slozek = count($pole_slozek);
} else {
    $slozka_slozek    = "složka kapely nenastavena";
    $pole_slozek      = [];
    $delka_pole_slozek = 0;
};

// Nastavení aktuální složky
if (isset($_SESSION['slozka_souboru_k_zobrazeni']))
    { $slozka_souboru = $_SESSION['slozka_souboru_k_zobrazeni']; }
else { $slozka_souboru = $pole_slozek[2] ?? ""; };

// Pokud byla složka smazána, přepnout na první dostupnou
if ($_SESSION['slozka_souboru_k_zobrazeni'] == "slozka_smazana") {
    $slozka_souboru = $pole_slozek[2] ?? "";
    $_SESSION['slozka_souboru_k_zobrazeni'] = $slozka_souboru;
};

// =====================================================================
// OPRAVA 1: $platna_slozka - ověření že složka existuje v seznamu
// Původní chyba: if ($platna_slozka = true)  <- přiřazení, vždy true!
// =====================================================================
$platna_slozka = false; // začínáme jako false, ne true

for ($x = 0; $x < $delka_pole_slozek; $x++) {
    if ($pole_slozek[$x] == $slozka_souboru) {
        $platna_slozka = true;
        break; // stačí najít jednou
    }
};

// =====================================================================
// OPRAVA 2: == místo = v podmínce
// Původní chyba: if ($platna_slozka = true)  <- přiřazení!
// Správně:       if ($platna_slozka == true)
// =====================================================================
if ($platna_slozka == true) {
    // OPRAVA 3: ověřit že složka existuje před scandir()
    $cesta_slozky = $slozka_slozek . $slozka_souboru;
    if (is_dir($cesta_slozky)) {
        $pole_souboru      = scandir($cesta_slozky);
        $delka_pole_souboru = count($pole_souboru);
    } else {
        $pole_souboru      = [];
        $delka_pole_souboru = 0;
    }
} else {
    $pole_souboru      = [];
    $delka_pole_souboru = 0;
};

?>
