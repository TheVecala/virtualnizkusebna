<?php
session_start();
error_reporting(0);

if (empty($_SESSION['login'])) { echo ''; exit; }

include "../login/connect.php";

$kapela         = $_SESSION['kapela']                     ?? "";
$slozka_souboru = $_SESSION['slozka_souboru_k_zobrazeni'] ?? "";

// Použít diskusi per-vál pokud tabulka existuje, jinak hlavní diskusi kapely
$diskuse_valu   = "diskuse_" . $mysqli->real_escape_string($kapela) . "_" . $mysqli->real_escape_string($slozka_souboru);
$diskuse_kapely = $mysqli->real_escape_string($_SESSION['diskuse'] ?? "");

// Zkusit tabulku per-vál
$test = $mysqli->query("SELECT 1 FROM `$diskuse_valu` LIMIT 1");
$aktualni_diskuse = ($test !== false) ? $diskuse_valu : $diskuse_kapely;

define('ROWS_DISKUSE', 10);

$res    = $mysqli->query("SELECT COUNT(*) as pocet FROM `$aktualni_diskuse`");
$celkem = ($res) ? (int)$res->fetch_assoc()['pocet'] : 0;

$vysledek = $mysqli->query("SELECT cas, vzkaz, jmeno FROM `$aktualni_diskuse` ORDER BY cas DESC LIMIT " . ROWS_DISKUSE);

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
.comment-form { margin-top: 10px; padding-top: 10px; border-top: 1px solid #3a3e44; }
.cf-textarea {
  width: 100%; background: #1a1d20; border: 1px solid #3a3e44;
  border-radius: 5px; color: #e0e0e0; font-size: 12px; padding: 6px 8px;
  resize: none; font-family: sans-serif; box-sizing: border-box;
}
.cf-textarea:focus { outline: none; border-color: #<?php echo $barva ?>; }
.cf-row { display: flex; gap: 6px; margin-top: 5px; align-items: center; }
.cf-input {
  flex: 1; background: #1a1d20; border: 1px solid #3a3e44;
  border-radius: 5px; color: #e0e0e0; font-size: 12px; padding: 4px 8px; box-sizing: border-box;
}
.cf-input:focus { outline: none; border-color: #<?php echo $barva ?>; }
.cf-btn {
  border-radius: 5px; padding: 4px 10px; font-size: 11px; cursor: pointer;
  border: 1px solid #<?php echo $barva ?>; background: #2a3a10; color: #<?php echo $barva ?>;
  white-space: nowrap;
}
.cf-btn:hover { background: #3a4a15; }
.cf-chyba { color: #ff8888; font-size: 11px; margin-top: 4px; display: none; }
</style>

<?php if (empty($slozka_souboru)): ?>
  <div class="prazdno">Vyberte skladbu.</div>

<?php else: ?>

  <?php if ($vysledek && $vysledek->num_rows > 0): ?>
    <?php while ($r = $vysledek->fetch_assoc()): ?>
    <div class="comment">
      <div class="ctext"><?php echo $r['vzkaz']; ?></div>
      <div class="cmeta">
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

  <!-- Formulář -->
  <div class="comment-form">
    <form id="form_komentar">
      <textarea id="komentar_text" class="cf-textarea" rows="2" placeholder="napsat poznámku..."></textarea>
      <div class="cf-row">
        <input id="komentar_jmeno" class="cf-input" type="text" placeholder="jméno">
        <input id="komentar_odkaz"  type="hidden">
        <input id="komentar_odkaz2" type="hidden">
        <button type="submit" class="cf-btn">uložit</button>
      </div>
      <div id="komentar_chyba" class="cf-chyba"></div>
    </form>
  </div>

<?php endif; ?>
