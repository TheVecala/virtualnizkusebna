<?php
session_start();
error_reporting(0);

if (empty($_SESSION['login'])) { echo ''; exit; }

$kapela            = $_SESSION['kapela']                     ?? "";
$befelemepesseveze = $_SESSION['befelemepesseveze']          ?? "";
$slozka_souboru    = $_SESSION['slozka_souboru_k_zobrazeni'] ?? "";
$aktualni_text     = $_SESSION['aktualni_text']              ?? "tabelatura.txt";

$soubor = "../../user/" . $kapela . "/" . $befelemepesseveze . "/uploads/" . $slozka_souboru . "/texty/" . $aktualni_text;

// Název válu
$nazev_soubor = "../../user/" . $kapela . "/" . $befelemepesseveze . "/uploads/" . $slozka_souboru . "/data/nazev_valu.txt";
$nazev_valu   = file_exists($nazev_soubor) ? trim(file_get_contents($nazev_soubor)) : $slozka_souboru;
?>
<style>
.text-pre { font-family: Courier,monospace; font-size: 12px; color: #e0e0e0; white-space: pre-wrap; line-height: 1.7; }
.prazdno  { color: #888; font-size: 12px; text-align: center; padding: 24px 0; }
</style>

<?php if (empty($slozka_souboru)): ?>
  <div class="prazdno">Žádná skladba není vybrána.</div>

<?php elseif (!file_exists($soubor)): ?>
  <div class="prazdno">Soubor <?php echo htmlspecialchars($aktualni_text); ?> neexistuje.</div>

<?php else: ?>
  <pre class="text-pre"><?php
    $obsah = file_get_contents($soubor);
    echo htmlspecialchars($obsah);
  ?></pre>
<?php endif; ?>
