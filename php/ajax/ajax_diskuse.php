<?php
session_start();
error_reporting(0);

// Kontrola single-band přihlášení
if (empty($_SESSION['logged_in_single'])) { echo ''; exit; }

include "../login/connect.php";

$kapela         = $_SESSION['kapela']                     ?? "";
$slozka_souboru = $_SESSION['slozka_souboru_k_zobrazeni'] ?? "";
$barva          = $_SESSION['barva1']                     ?? "a7ac38";

define('ROWS_DISKUSE', 10);

if (empty($slozka_souboru)):
?>
  <div class="prazdno">Vyberte skladbu.</div>
<?php
    exit;
endif;

$aktualni_diskuse = "diskuse_" . $mysqli->real_escape_string($kapela) . "_" . $mysqli->real_escape_string($slozka_souboru);

// Vytvořit tabulku pokud neexistuje
$mysqli->query("CREATE TABLE IF NOT EXISTS `$aktualni_diskuse` (
    cas   INT(11)     NOT NULL,
    vzkaz TEXT        NOT NULL,
    jmeno VARCHAR(50) NOT NULL
)");

$res    = $mysqli->query("SELECT COUNT(*) as pocet FROM `$aktualni_diskuse`");
$celkem = ($res) ? (int)$res->fetch_assoc()['pocet'] : 0;
$vysledek = $mysqli->query("SELECT cas, vzkaz, jmeno FROM `$aktualni_diskuse` ORDER BY cas DESC LIMIT " . ROWS_DISKUSE);
?>
<style>
.prazdno { color: #888; font-size: 12px; text-align: center; padding: 16px 0; }
.dk-comment {
  padding: 7px 9px; border-radius: 5px; margin-bottom: 5px;
  background: #1a1d20; border: 1px solid #3a3e44;
}
.dk-text { font-size: 12px; margin-bottom: 3px; line-height: 1.4; color: #e0e0e0; word-break: break-word; }
.dk-meta { font-size: 10px; color: #888; text-align: right; }
pre { background: transparent !important; color: #e0e0e0 !important; margin: 0; white-space: pre-wrap; font-family: inherit; font-size: inherit; }

/* Stylování odkazů uvnitř diskuse, aby ladily s barvou webu */
.dk-text a { color: #<?php echo $barva ?>; text-decoration: underline; }
.dk-text a:hover { filter: brightness(1.2); }
</style>

<?php if ($vysledek && $vysledek->num_rows > 0): ?>
  <?php while ($r = $vysledek->fetch_assoc()): ?>
  <div class="dk-comment">
    <div class="dk-text">
      <?php 
        $vzkaz = $r['vzkaz'];
        
        // Zpětná kompatibilita: Pokud starý komentář obsahuje HTML tagy (<pre> nebo <a>),
        // propustíme ho bezpečně přes původní strip_tags, aby se nezobrazil jako surový zdrojový kód
        if (strpos($vzkaz, '<pre') !== false || strpos($vzkaz, '<a') !== false) {
            echo strip_tags($vzkaz, '<a><br><b>');
        } else {
            // Nový formát: Čistý text kompletně zabezpečíme proti XSS útokům
            $text_safe = htmlspecialchars($vzkaz, ENT_QUOTES, 'UTF-8');
            
            // Inteligentní převod textových URL adres na plně funkční klikací odkazy
            $text_safe = preg_replace('/(https?:\/\/[^\s]+)/', '<a href="$1" target="_blank" rel="noopener">$1</a>', $text_safe);
            
            // Převedení konců řádků (\n) na HTML značky <br> pro správné odřádkování
            echo nl2br($text_safe);
        }
      ?>
    </div>
    <div class="dk-meta">
      <?php echo htmlspecialchars(strip_tags($r['jmeno'])); ?>
      &nbsp;·&nbsp;
      <?php echo date("j.n.Y G:i", $r['cas']); ?>
    </div>
  </div>
  <?php endwhile; ?>
  <?php if ($celkem > ROWS_DISKUSE): ?>
    <div style="text-align:center;color:#888;font-size:11px;margin:4px 0">
      zobrazeno <?php echo ROWS_DISKUSE; ?> z <?php echo $celkem; ?>
    </div>
  <?php endif; ?>
<?php else: ?>
  <div class="prazdno">Zatím žádné komentáře.</div>
<?php endif; ?>

<form id="form_komentar" style="margin-top:10px;padding-top:10px;border-top:1px solid #3a3e44;">
  <textarea id="komentar_text" rows="2" placeholder="napsat poznámku..." style="
    width:100%; background:#1a1d20; border:1px solid #3a3e44;
    border-radius:5px; color:#e0e0e0; font-size:12px; padding:6px 8px;
    resize:none; font-family:sans-serif; box-sizing:border-box;
  "></textarea>
  <div style="display:flex;gap:6px;margin-top:5px;align-items:center;">
    <input id="komentar_jmeno" type="text" placeholder="jméno" style="
      flex:1; background:#1a1d20; border:1px solid #3a3e44;
      border-radius:5px; color:#e0e0e0; font-size:12px; padding:4px 8px;
    ">
    <input id="komentar_odkaz"  type="hidden">
    <input id="komentar_odkaz2" type="hidden">
    <button type="submit" style="
      border-radius:5px; padding:4px 10px; font-size:11px; cursor:pointer;
      border:1px solid #<?php echo $barva ?>; background:#2a3a10; color:#<?php echo $barva ?>;
    ">uložit</button>
  </div>
  <div id="komentar_chyba" style="color:#ff8888;font-size:11px;margin-top:4px;display:none;"></div>
</form>