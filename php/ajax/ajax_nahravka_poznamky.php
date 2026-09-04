<?php
session_start();
error_reporting(0);
require_once __DIR__ . '/../../config.php';

if (empty($_SESSION['role'])) {
    exit;
}
const NOTE_SONG   = 0;
const NOTE_NORMAL = 1;
const NOTE_PASSAGE = 2;

include "../login/connect.php";

$mysqli->query("
CREATE TABLE IF NOT EXISTS recording_notes (
    id INT NOT NULL AUTO_INCREMENT,
    file_path VARCHAR(1000) NOT NULL,
    cas BIGINT NOT NULL,
    typ TINYINT NOT NULL DEFAULT 1,
    jmeno VARCHAR(50) NOT NULL,
    poznamka TEXT NOT NULL,
    PRIMARY KEY (id),
    KEY idx_file_path (file_path(255))
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_czech_ci
");

$akce = $_POST["akce"] ?? "";

if ($akce == "list")
{
    $file_path = $mysqli->real_escape_string($_POST["file_path"]);
    $looper = !empty($_POST["looper"]); 
    $res = $mysqli->query("
        SELECT *
        FROM recording_notes
        WHERE file_path='$file_path' AND cas >= 0
        ORDER BY cas ASC
    ");
echo '
<div class="poznamky-toolbar">
  
    <button
        type="button"
        class="icon-btn timestamp-action-btn pridat-poznamku-btn"
        data-typ="'.NOTE_SONG.'">
        <i class="ti ti-music" aria-hidden="true"></i>
        <span>Vál</span>
    </button>

    <button
        type="button"
        class="icon-btn timestamp-action-btn pridat-poznamku-btn"
        data-typ="'.NOTE_PASSAGE.'">
        <i class="ti ti-repeat" aria-hidden="true"></i>
        <span>Pasáž</span>
    </button>

    <button
        type="button"
        class="icon-btn timestamp-action-btn pridat-poznamku-btn"
        data-typ="'.NOTE_NORMAL.'">
        <i class="ti ti-note" aria-hidden="true"></i>
        <span>Poznámka</span>
    </button>

    <button
        type="button"
        class="icon-btn timestamp-action-btn export-timestampy-btn"
        data-file="'.htmlspecialchars($file_path, ENT_QUOTES).'">
        <i class="ti ti-file-export" aria-hidden="true"></i>
        <span>Export</span>
    </button>

    <button
        type="button"
        class="fbtn copy-timestampy-table-btn"
        data-file="'.htmlspecialchars($file_path, ENT_QUOTES).'">
        Kopírovat jako tabulku
    </button>
   
  
</div>';

    while($r = $res->fetch_assoc())
    {
        $ms = (int)$r["cas"];
        
		$typ = (int)$r["typ"];
		
		if ($typ == NOTE_SONG) {
			$rowClass = "note-song";
            $icon = "♪";
		} elseif ($typ == NOTE_PASSAGE) {
			$rowClass = "note-passage";
            $icon = "↔";
		} else {
			$rowClass = "note-normal";
            $icon = "●";
		}
		
        $sec = floor($ms / 1000);

        $min = floor($sec / 60);

        $sec = $sec % 60;

        $cas_text = sprintf("%02d:%02d", $min, $sec);

        echo '
<div class="note-row '.$rowClass.'"
     data-id="'.$r["id"].'"
     data-ms="'.$ms.'"
     data-typ="'.$typ.'"
     data-file="'.htmlspecialchars($file_path, ENT_QUOTES).'"
     '.($looper ? 'data-looper="1"' : '').'
     style="padding:4px 0; display:flex; align-items:center; gap:8px;">

    <span class="note-time"
          style="font-weight:bold;cursor:pointer;">
        <span class="note-type-icon" aria-hidden="true">'.$icon.'</span>'.$cas_text.'
    </span>

    <span class="note-text"
          style="flex:1;'.($typ == NOTE_SONG ? 'font-weight:bold;' : '').'">
        '.htmlspecialchars($r["poznamka"], ENT_QUOTES).'
    </span>

    '.($typ == NOTE_SONG || $typ == NOTE_PASSAGE ? '
    <button type="button"
            class="note-loop"
            title="Loopovat tento úsek"
            aria-label="Loopovat tento úsek">⟳</button>' : '').'

    <span class="note-edit"
          title="Upravit"
          style="cursor:pointer;">✏️</span>

    <span class="note-delete"
          title="Smazat"
          style="cursor:pointer;">🗑️</span>

</div>';
    }

    exit;
}

if ($akce == "count")
{
    $file_path = $mysqli->real_escape_string($_POST["file_path"]);

    $res = $mysqli->query("
        SELECT COUNT(*) pocet
        FROM recording_notes
        WHERE file_path='$file_path' AND cas >= 0
    ");

    $r = $res->fetch_assoc();

    echo (int)$r["pocet"];

    exit;
}

if ($akce == "add")
{
    $file_path = $mysqli->real_escape_string($_POST["file_path"]);

    $cas = intval($_POST["cas"]);
	$typ = intval($_POST["typ"] ?? NOTE_NORMAL);
    if (!in_array($typ, [NOTE_SONG, NOTE_NORMAL, NOTE_PASSAGE], true)) {
        $typ = NOTE_NORMAL;
    }

    $poznamka = $mysqli->real_escape_string($_POST["poznamka"]);

    $jmeno = $_SESSION["jmeno"] ?? "uživatel";

    $jmeno = $mysqli->real_escape_string($jmeno);

    $mysqli->query("
        INSERT INTO recording_notes
        (
            file_path,
            cas,
            typ,
            jmeno,
            poznamka
        )
        VALUES
        (
            '$file_path',
            $cas,
            $typ,
            '$jmeno',
            '$poznamka'
        )
    ");

    echo "OK";

    exit;
}

if ($akce == "update")
{
    $id = intval($_POST["id"] ?? 0);

    $poznamka = trim($_POST["text"] ?? "");

    $stmt = $mysqli->prepare("
        UPDATE recording_notes
        SET poznamka = ?
        WHERE id = ?
    ");

    $stmt->bind_param("si", $poznamka, $id);

    $stmt->execute();

    echo "OK";

    exit;
}
if ($akce == "delete")
{
    $id = intval($_POST["id"] ?? 0);

    $stmt = $mysqli->prepare("
        DELETE FROM recording_notes
        WHERE id = ?
    ");

    $stmt->bind_param("i", $id);
    $stmt->execute();

    echo "OK";
    exit;
}

// ── Popisek nahrávky ──
// Uložený jako řádek v recording_notes se sentinel hodnotou cas = -1 (skutečné
// časové poznámky mají cas >= 0, takže -1 nikdy nekoliduje). Sloupec `typ` je
// u tohohle řádku bezvýznamný (typy timestampů řeší jen časové poznámky),
// ale musí se vyplnit kvůli NOT NULL — bere se NOTE_NORMAL jako neutrální výchozí.
// Díky společné tabulce se popisek automaticky "veze" se stejnou logikou jako
// časové poznámky (stejný file_path klíč) — jen je z list/count/export vyloučený.

if ($akce == "popisek_get")
{
    $file_path = $mysqli->real_escape_string($_POST["file_path"]);

    $res = $mysqli->query("
        SELECT poznamka
        FROM recording_notes
        WHERE file_path='$file_path' AND cas=-1
        LIMIT 1
    ");

    $r = $res ? $res->fetch_assoc() : null;

    echo $r ? htmlspecialchars($r["poznamka"]) : "";

    exit;
}

if ($akce == "popisek_set")
{
    if (!ma_pravo('edit_recording_label')) {
        echo "CHYBA: nemáte oprávnění upravovat popisek";
        exit;
    }

    $file_path = $mysqli->real_escape_string($_POST["file_path"]);
    $popisek   = trim($_POST["popisek"] ?? "");
    $popisek_db = $mysqli->real_escape_string($popisek);

    $existujici = $mysqli->query("
        SELECT id
        FROM recording_notes
        WHERE file_path='$file_path' AND cas=-1
        LIMIT 1
    ");

    if ($popisek === "") {
        // Prázdný popisek = smazat řádek (žádný popisek se pak nezobrazí)
        if ($existujici && $existujici->num_rows > 0) {
            $mysqli->query("DELETE FROM recording_notes WHERE file_path='$file_path' AND cas=-1");
        }
        echo "OK";
        exit;
    }

    if ($existujici && $existujici->num_rows > 0) {
        $radek = $existujici->fetch_assoc();
        $stmt = $mysqli->prepare("UPDATE recording_notes SET poznamka = ? WHERE id = ?");
        $stmt->bind_param("si", $popisek, $radek["id"]);
        $stmt->execute();
    } else {
        $mysqli->query("
            INSERT INTO recording_notes (file_path, cas, typ, jmeno, poznamka)
            VALUES ('$file_path', -1, " . NOTE_NORMAL . ", '', '$popisek_db')
        ");
    }

    echo "OK";
    exit;
}
