<?php
session_start();
error_reporting(0);

if (empty($_SESSION['role']))
{
    exit;
}

 include "../login/connect.php";

$file_path = $mysqli->real_escape_string($_GET["file_path"] ?? "");

if ($file_path == "")
{
    exit;
}

$res_popisek = $mysqli->query("
    SELECT poznamka
    FROM recording_notes
    WHERE file_path='$file_path' AND cas=-1
    LIMIT 1
");
$popisek = ($res_popisek && $res_popisek->num_rows > 0)
    ? $res_popisek->fetch_assoc()['poznamka']
    : '';

$res = $mysqli->query("
    SELECT cas, poznamka
    FROM recording_notes
    WHERE file_path='$file_path' AND cas >= 0
    ORDER BY cas ASC
");

$nazev = pathinfo($file_path, PATHINFO_FILENAME);

header("Content-Type: text/plain; charset=UTF-8");
header("Content-Disposition: attachment; filename=\"".$nazev.".txt\"");

echo "=== ".$nazev." ===\r\n";
if ($popisek !== '') {
    echo "Popisek: ".$popisek."\r\n";
}
echo "Export: ".date("d.m.Y H:i")."\r\n\r\n";

while ($r = $res->fetch_assoc())
{
    $ms = (int)$r["cas"];

    $sec = floor($ms / 1000);
    $min = floor($sec / 60);
    $sec = $sec % 60;

    printf(
        "%02d:%02d %s\r\n",
        $min,
        $sec,
        $r["poznamka"]
    );
}