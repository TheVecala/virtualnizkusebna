<?php
// Read-only report of the current application; no filesystem scan.
function admin_vz2_storage_report(): array {
    vz2_ready();
    $db = vz2_db();
    return $db->query("SELECT
        (SELECT COUNT(*) FROM vz2_collections WHERE kind='song') songs,
        (SELECT COUNT(*) FROM vz2_collections WHERE kind='rehearsal') rehearsals,
        (SELECT COUNT(*) FROM vz2_recordings) recordings,
        (SELECT COUNT(*) FROM vz2_documents) documents,
        (SELECT COUNT(*) FROM vz2_file_operations WHERE state<>'completed') pending,
        (SELECT COUNT(*) FROM vz2_audio_files WHERE state='available') +
            (SELECT COUNT(*) FROM vz2_attachments WHERE state='available') files,
        (SELECT COALESCE(SUM(byte_size),0) FROM vz2_audio_files WHERE state='available') +
            (SELECT COALESCE(SUM(byte_size),0) FROM vz2_attachments WHERE state='available') bytes")->fetch_assoc();
}

function admin_storage_size($bytes): string {
    if ($bytes === null || $bytes === false) {
        return 'Nedostupné';
    }
    $units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
    $unit = 0;
    while ($bytes >= 1024 && $unit < count($units) - 1) {
        $bytes /= 1024;
        $unit++;
    }
    return number_format($bytes, $unit === 0 ? 0 : 2, ',', ' ') . ' ' . $units[$unit];
}
