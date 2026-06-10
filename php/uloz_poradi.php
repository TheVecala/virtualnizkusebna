<?php
session_start();
error_reporting(0);
header('Content-Type: application/json; charset=utf-8');

// Kontrola zabezpečení - musí být přihlášený
if (!ma_pravo('reorder')) {
    echo json_encode(["ok" => false, "chyba" => "Nemáte oprávnění"]);
    exit;
}

// Přijmeme pole 'poradi' z Javascriptu
$poradi = $_POST['poradi'] ?? null;

if (is_array($poradi)) {
    $kapela            = $_SESSION['kapela'] ?? "";
    $befelemepesseveze = $_SESSION['befelemepesseveze'] ?? "";
    
    // Cesta do složky uploads (pozor na úroveň zanoření: jsme v /php/, takže jdeme o patro výš ../)
    $slozka_uploads = "../user/" . $kapela . "/" . $befelemepesseveze . "/uploads/";
    $soubor_poradi = $slozka_uploads . "poradi.json";
    
    // Uložíme přijaté pole zpět do formátu JSON a přepíšeme soubor
    $vysledek = file_put_contents($soubor_poradi, json_encode($poradi));
    
    if ($vysledek !== false) {
        echo json_encode(["ok" => true]);
    } else {
        echo json_encode(["ok" => false, "chyba" => "Nelze zapsat do souboru"]);
    }
} else {
    echo json_encode(["ok" => false, "chyba" => "Špatný formát dat"]);
}
?>