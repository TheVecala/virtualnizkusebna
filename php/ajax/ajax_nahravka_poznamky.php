<?php
session_start();
error_reporting(0);

if (empty($_SESSION['role'])) {
    exit;
}

include "../login/connect.php";

$mysqli->query("
CREATE TABLE IF NOT EXISTS recording_notes (
    id INT NOT NULL AUTO_INCREMENT,
    file_path VARCHAR(1000) NOT NULL,
    cas BIGINT NOT NULL,
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

    $res = $mysqli->query("
        SELECT *
        FROM recording_notes
        WHERE file_path='$file_path'
        ORDER BY cas ASC
    ");

    while($r = $res->fetch_assoc())
    {
        $ms = (int)$r["cas"];

        $sec = floor($ms / 1000);

        $min = floor($sec / 60);

        $sec = $sec % 60;

        $cas_text = sprintf("%02d:%02d", $min, $sec);

        echo '
        <div class="note-row" style="padding:4px 0;">
            <span class="note-time"
                  data-ms="'.$ms.'"
                  style="cursor:pointer;font-weight:bold;color:#7fbfff;">
                  '.$cas_text.'
            </span>
            <span style="margin-left:8px;">'.
                htmlspecialchars($r["poznamka"]).
            '</span>
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
        WHERE file_path='$file_path'
    ");

    $r = $res->fetch_assoc();

    echo (int)$r["pocet"];

    exit;
}

if ($akce == "add")
{
    $file_path = $mysqli->real_escape_string($_POST["file_path"]);

    $cas = intval($_POST["cas"]);

    $poznamka = $mysqli->real_escape_string($_POST["poznamka"]);

    $jmeno = $_SESSION["jmeno"] ?? "uživatel";

    $jmeno = $mysqli->real_escape_string($jmeno);

    $mysqli->query("
        INSERT INTO recording_notes
        (
            file_path,
            cas,
            jmeno,
            poznamka
        )
        VALUES
        (
            '$file_path',
            $cas,
            '$jmeno',
            '$poznamka'
        )
    ");

    echo "OK";

    exit;
}