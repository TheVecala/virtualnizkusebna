<?php
session_start();
error_reporting(0);

if (empty($_SESSION['login'])) { echo ''; exit; }

$kapela            = $_SESSION['kapela']                     ?? "";
$befelemepesseveze = $_SESSION['befelemepesseveze']          ?? "";
$slozka_souboru    = $_SESSION['slozka_souboru_k_zobrazeni'] ?? "";
$sekce             = "uploads";

$cesta_slozky = "../../user/" . $kapela . "/" . $befelemepesseveze . "/" . $sekce . "/" . $slozka_souboru . "/";

$povolene_audio = ['mp3', 'wav', 'ogg', 'flac', 'aac'];
$povolene_vse   = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'pdf', 'txt', 'jpg', 'jpeg', 'png', 'gif'];

$soubory = [];
if (!empty($slozka_souboru) && is_dir($cesta_slozky)) {
    foreach (scandir($cesta_slozky) as $f) {
        if ($f === "." || $f === ".." || is_dir($cesta_slozky . $f)) continue;
        if ($f === "." || substr($f, 0, 1) === ".") continue;
        $soubory[] = $f;
    }
}

$barva = $_SESSION['barva1'] ?? "a7ac38";
?>
<style>
.file-item {
  border-radius: 5px; margin-bottom: 5px;
  background: #1a1d20; border: 1px solid #3a3e44; transition: border-color .15s;
  overflow: hidden;
}
.file-item:hover { border-color: rgba(167,172,56,.4); }
.file-row {
  display: flex; align-items: center; gap: 7px;
  padding: 6px 8px;
}
.fname { flex: 1; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #e0e0e0; }
.fbtn {
  background: none; border: 1px solid #3a3e44; color: #888;
  border-radius: 4px; padding: 2px 6px; font-size: 10px; cursor: pointer;
  white-space: nowrap; transition: all .15s; flex-shrink: 0;
}
.fbtn:hover { border-color: #ffc107; color: #ffc107; }
.fbtn.play { color: #<?php echo $barva ?>; border-color: #<?php echo $barva ?>; }
.fbtn.play.otevreno { background: rgba(167,172,56,.15); }
.prazdno { color: #888; font-size: 12px; text-align: center; padding: 24px 0; }
.soubor-audio { color: #<?php echo $barva ?>; }
.soubor-ostatni { color: #888; }
.player-wrap {
  display: none; padding: 6px 8px; border-top: 1px solid #3a3e44;
  background: #1a1d20;
}
.player-wrap.open { display: block; }
.player-wrap audio {
  width: 100%; height: 32px; filter: invert(0);
}
</style>

<?php if (empty($slozka_souboru)): ?>
  <div class="prazdno">Žádná skladba není vybrána.</div>
<?php elseif (empty($soubory)): ?>
  <div class="prazdno">Zatím tu nic není.<br>Vložte první nahrávku tlačítkem ⬆ vložit.</div>
<?php else: ?>
  <?php foreach ($soubory as $i => $soub):
    $pripona  = strtolower(pathinfo($soub, PATHINFO_EXTENSION));
    $je_audio = in_array($pripona, $povolene_audio);
    $cesta    = "/user/" . $kapela . "/" . $befelemepesseveze . "/" . $sekce . "/" . $slozka_souboru . "/" . $soub;
    $cesta_fs = "user/" . $kapela . "/" . $befelemepesseveze . "/" . $sekce . "/" . $slozka_souboru . "/" . $soub; // bez / pro PHP
    $player_id = "player_" . $i;
    $btn_id    = "playbtn_" . $i;
  ?>
  <div class="file-item">
    <div class="file-row">
      <span class="<?php echo $je_audio ? 'soubor-audio' : 'soubor-ostatni'; ?>">
        <?php echo $je_audio ? '🎵' : '📄'; ?>
      </span>
      <span class="fname" title="<?php echo htmlspecialchars($soub); ?>"><?php echo htmlspecialchars($soub); ?></span>

      <?php if ($je_audio): ?>
      <button id="<?php echo $btn_id; ?>" class="fbtn play toggle-player"
        data-player="<?php echo $player_id; ?>"
        data-btn="<?php echo $btn_id; ?>"
        data-cesta="<?php echo htmlspecialchars($cesta, ENT_QUOTES); ?>"
        data-nazev="<?php echo htmlspecialchars($soub, ENT_QUOTES); ?>">▶</button>
      <?php endif; ?>

      <a href="<?php echo htmlspecialchars($cesta); ?>" download style="text-decoration:none">
        <button class="fbtn">⬇</button>
      </a>

      <button class="fbtn presunout-btn"
        data-soubor="<?php echo htmlspecialchars($cesta_fs, ENT_QUOTES); ?>"
        data-nazev="<?php echo htmlspecialchars($soub, ENT_QUOTES); ?>"
        data-toggle="modal" data-target="#modal_presunout">↔</button>

      <button class="fbtn smazat-btn" style="color:#e44;border-color:#633"
        data-soubor="<?php echo htmlspecialchars($cesta_fs, ENT_QUOTES); ?>"
        data-nazev="<?php echo htmlspecialchars($soub, ENT_QUOTES); ?>"
        data-toggle="modal" data-target="#modal_delete">🗑</button>

      <?php if ($je_audio): ?>
      <button class="fbtn looper-btn"
        data-cesta="<?php echo htmlspecialchars($cesta, ENT_QUOTES); ?>"
        data-nazev="<?php echo htmlspecialchars($soub, ENT_QUOTES); ?>"
        title="otevřít v looperu">〜</button>
      <?php endif; ?>
    </div>

    <?php if ($je_audio):
      $mime_typy = ['mp3' => 'audio/mpeg', 'wav' => 'audio/wav', 'ogg' => 'audio/ogg', 'flac' => 'audio/flac', 'aac' => 'audio/aac'];
      $mime = $mime_typy[$pripona] ?? 'audio/mpeg';
    ?>
    <div class="player-wrap" id="<?php echo $player_id; ?>">
      <audio controls preload="none" style="width:100%;height:32px"
             onplay="pauseOthers(this)">
        <source src="<?php echo htmlspecialchars($cesta); ?>" type="<?php echo $mime; ?>">
      </audio>
    </div>
    <?php endif; ?>
  </div>
  <?php endforeach; ?>
<?php endif; ?>



