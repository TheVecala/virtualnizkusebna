<?php
session_start();
error_reporting(0);

// Kontrola single-band přihlášení (používáme tu proměnnou, kterou jsme zavedli v index.php)
if (empty($_SESSION['logged_in_single'])) { echo ''; exit; }

include "../login/connect.php";

define('ROWS_NAPADY', 15);

// Vytáhneme jméno kapely ze session (zapsané z index.php)
$kapela = $_SESSION['kapela'] ?? "";

// Dynamicky sestavíme název tabulky pro nápady kapely (např. "napady_dusanovakapela")
$aktualni_diskuse = "napady_" . $mysqli->real_escape_string($kapela);

if (empty($kapela)) {
    echo '<div style="color:#888;font-size:12px;padding:16px;text-align:center">Nápady nejsou dostupné.</div>';
    exit;
}

// Vytvořit tabulku pro nápady, pokud náhodou ještě neexistuje v multi-band DB
$mysqli->query("CREATE TABLE IF NOT EXISTS `$aktualni_diskuse` (
    cas   INT(11)     NOT NULL,
    vzkaz TEXT        NOT NULL,
    jmeno VARCHAR(50) NOT NULL
)");

$res    = $mysqli->query("SELECT COUNT(*) as pocet FROM `$aktualni_diskuse`");
$celkem = ($res) ? (int)$res->fetch_assoc()['pocet'] : 0;
$vysledek = $mysqli->query("SELECT cas, vzkaz, jmeno FROM `$aktualni_diskuse` ORDER BY cas DESC LIMIT " . ROWS_NAPADY);

$barva = $_SESSION['barva1'] ?? "a7ac38";
?>
<style>
.comment {
  padding: 7px 9px; border-radius: 5px; margin-bottom: 5px;
  background: #1a1d20; border: 1px solid #3a3e44;
}
.ctext { font-size: 12px; margin-bottom: 3px; line-height: 1.4; color: #e0e0e0; word-break: break-word; }
.cmeta { font-size: 10px; color: #888; text-align: right; }
.prazdno { color: #888; font-size: 12px; text-align: center; padding: 16px 0; }
/* ... (zbytek CSS stylů z tvého původního souboru zůstává stejný) ... */
.comment-form { margin-top: 10px; padding-top: 10px; border-top: 1px solid #3a3e44; }
.cf-textarea { width: 100%; background: #1a1d20; border: 1px solid #3a3e44; border-radius: 5px; color: #e0e0e0; font-size: 12px; padding: 6px 8px; resize: none; font-family: sans-serif; box-sizing: border-box; }
.cf-textarea:focus { outline: none; border-color: #<?php echo $barva ?>; }
.cf-row { display: flex; gap: 6px; margin-top: 5px; align-items: center; }
.cf-input { flex: 1; background: #1a1d20; border: 1px solid #3a3e44; border-radius: 5px; color: #e0e0e0; font-size: 12px; padding: 4px 8px; }
.cf-input:focus { outline: none; border-color: #<?php echo $barva ?>; }
.cf-btn { border-radius: 5px; padding: 4px 10px; font-size: 11px; cursor: pointer; border: 1px solid #<?php echo $barva ?>; background: #2a3a10; color: #<?php echo $barva ?>; }
.cf-btn:hover { background: #3a4a15; }
.cf-chyba { color: #ff8888; font-size: 11px; margin-top: 4px; display: none; }
pre { background: transparent !important; color: #e0e0e0 !important; margin: 0; white-space: pre-wrap; }
</style>

<?php if ($vysledek && $vysledek->num_rows > 0): ?>
  <?php while ($r = $vysledek->fetch_assoc()): ?>
  <div class="comment">
    <div class="ctext"><?php echo strip_tags($r['vzkaz'], '<a><br><b>'); ?></div>
    <div class="cmeta">
      <?php echo htmlspecialchars(strip_tags($r['jmeno'])); ?>
      &nbsp;·&nbsp;
      <?php echo date("j.n.Y G:i", $r['cas']); ?>
    </div>
  </div>
  <?php endwhile; ?>
  <?php if ($celkem > ROWS_NAPADY): ?>
    <div style="text-align:center;color:#888;font-size:11px;margin:4px 0">zobrazeno <?php echo ROWS_NAPADY; ?> z <?php echo $celkem; ?></div>
  <?php endif; ?>
<?php else: ?>
  <div class="prazdno">Zatím žádné nápady. Buďte první!</div>
<?php endif; ?>