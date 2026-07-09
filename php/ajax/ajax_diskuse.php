<?php
session_start();
error_reporting(0);

// Kontrola single-band přihlášení
if (empty($_SESSION['role'])) { echo ''; exit; }

include "../login/connect.php";

$kapela         = $_SESSION['kapela']                     ?? "";
$slozka_souboru = $_SESSION['slozka_souboru_k_zobrazeni'] ?? "";
$barva          = $_SESSION['barva1']                     ?? "a7ac38";
$mohu_editovat  = in_array($_SESSION['role'] ?? '', ['muzikant', 'admin']);

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
.dk-meta { font-size: 10px; color: #888; display: flex; align-items: center; }
pre { background: transparent !important; color: #e0e0e0 !important; margin: 0; white-space: pre-wrap; font-family: inherit; font-size: inherit; }
.dk-text a { color: #<?php echo $barva ?>; text-decoration: underline; }
.dk-text a:hover { filter: brightness(1.2); }

/* ── Editace / mazání komentářů ── */
.vzk-actions { margin-left: auto; display: flex; gap: 3px; opacity: 0.3; transition: opacity .15s; }
.dk-comment:hover .vzk-actions,
.comment:hover    .vzk-actions { opacity: 1; }
.vzk-btn-edit, .vzk-btn-del {
  background: none; border: 1px solid transparent; color: #888;
  border-radius: 3px; padding: 0 5px; font-size: 11px; cursor: pointer;
  line-height: 1.7; transition: all .15s;
}
.vzk-btn-edit:hover { color: #<?php echo $barva ?>; border-color: #<?php echo $barva ?>; }
.vzk-btn-del:hover  { color: #ff6666; border-color: #ff6666; }
.vzk-edit-wrap { margin-bottom: 6px; }
.vzk-edit-ta {
  width: 100%; background: #252a2e; border: 1px solid #4a5060;
  border-radius: 4px; color: #e0e0e0; font-size: 12px;
  padding: 5px 7px; resize: none; font-family: sans-serif;
  box-sizing: border-box; line-height: 1.4;
}
.vzk-edit-ta:focus { outline: none; border-color: #<?php echo $barva ?>; }
.vzk-edit-btns { display: flex; gap: 6px; margin-top: 4px; align-items: center; }
.vzk-save-btn {
  background: #2a3a10; border: 1px solid #<?php echo $barva ?>; color: #<?php echo $barva ?>;
  border-radius: 4px; padding: 3px 9px; font-size: 11px; cursor: pointer;
}
.vzk-save-btn:hover  { background: #3a4a15; }
.vzk-save-btn:disabled { opacity: 0.5; cursor: default; }
.vzk-cancel-btn {
  background: none; border: 1px solid #555; color: #888;
  border-radius: 4px; padding: 3px 7px; font-size: 11px; cursor: pointer;
}
.vzk-cancel-btn:hover { border-color: #888; color: #aaa; }
.vzk-edit-chyba { color: #ff8888; font-size: 11px; flex: 1; display: none; }
.vzk-confirm-wrap {
  padding: 5px 0 2px; font-size: 11px; color: #ccc;
  border-top: 1px solid #3a3e44; margin-top: 5px;
  display: flex; gap: 7px; align-items: center; flex-wrap: wrap;
}
.vzk-del-yes-btn {
  background: #3a1010; border: 1px solid #ff6666; color: #ff6666;
  border-radius: 4px; padding: 2px 8px; font-size: 11px; cursor: pointer;
}
.vzk-del-yes-btn:hover    { background: #4a1515; }
.vzk-del-yes-btn:disabled { opacity: 0.5; cursor: default; }
.vzk-del-no-btn {
  background: none; border: 1px solid #555; color: #888;
  border-radius: 4px; padding: 2px 7px; font-size: 11px; cursor: pointer;
}
.vzk-del-no-btn:hover { border-color: #888; color: #aaa; }
</style>

<?php if ($vysledek && $vysledek->num_rows > 0): ?>
  <?php while ($r = $vysledek->fetch_assoc()):
    $text_pro_edit = htmlspecialchars(strip_tags($r['vzkaz']), ENT_QUOTES, 'UTF-8');
  ?>
  <div class="dk-comment"
       data-cas="<?php echo (int)$r['cas']; ?>"
       data-typ="diskuse"
       data-text="<?php echo $text_pro_edit; ?>">
    <div class="dk-text">
      <?php
        $vzkaz = $r['vzkaz'];
        // Zpětná kompatibilita: starý formát s HTML tagy
        if (strpos($vzkaz, '<pre') !== false || strpos($vzkaz, '<a') !== false) {
            echo strip_tags($vzkaz, '<a><br><b>');
        } else {
            $text_safe = htmlspecialchars($vzkaz, ENT_QUOTES, 'UTF-8');
            $text_safe = preg_replace('/(https?:\/\/[^\s]+)/', '<a href="$1" target="_blank" rel="noopener">$1</a>', $text_safe);
            echo nl2br($text_safe);
        }
      ?>
    </div>
    <div class="dk-meta">
      <?php echo htmlspecialchars(strip_tags($r['jmeno'])); ?>
      &nbsp;·&nbsp;
      <?php echo date("j.n.Y G:i", $r['cas']); ?>
      <?php if ($mohu_editovat): ?>
      <span class="vzk-actions">
        <button class="vzk-btn-edit" title="upravit">✏</button>
        <button class="vzk-btn-del" title="smazat">✕</button>
      </span>
      <?php endif; ?>
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
