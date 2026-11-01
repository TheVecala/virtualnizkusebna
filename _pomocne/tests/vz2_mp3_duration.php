<?php
declare(strict_types=1);

require_once __DIR__ . '/../../php/inc/vz2_core.php';
require_once __DIR__ . '/../../php/inc/vz2_media.php';

$path = tempnam(sys_get_temp_dir(), 'vz2-mp3-');
if ($path === false) throw new RuntimeException('Nelze vytvořit testovací soubor.');

function checkMp3(string $path, string $bytes, bool $valid): void {
    file_put_contents($path, $bytes);
    clearstatcache(true, $path);
    try {
        $duration = vz2_duration($path, 'mp3');
        if (!$valid || $duration < 100) throw new RuntimeException('Neočekávaně přijaté MP3.');
    } catch (Vz2Error $error) {
        if ($valid) throw $error;
    }
}

try {
    // MPEG-1 Layer III, 128 kb/s, 44.1 kHz: 417 bytes per frame.
    $frame = "\xff\xfb\x90\x64" . str_repeat("\0", 413);
    $audio = str_repeat($frame, 4);
    $id3v2 = 'ID3' . "\x04\x00\x00\x00\x00\x00\x04" . str_repeat("\0", 4);
    $ape = 'APETAGEX' . pack('V', 2000) . pack('V', 32) . str_repeat("\0", 16);
    $id3v1 = 'TAG' . str_repeat("\0", 125);

    checkMp3($path, $audio, true);
    checkMp3($path, $id3v2 . str_repeat("\0", 8) . $audio . str_repeat("\0", 9) . $ape . $ape . $id3v1, true);
    checkMp3($path, 'ID3' . "\x04\x00\x00\x00\x04\x00\x00" . str_repeat("\0", 65536) . "\0" . $audio, true);
    // Extra bytes after recognized audio do not invalidate the whole recording.
    checkMp3($path, $audio . 'not audio', true);
    // A recoverable incomplete final frame is accepted, as by an audio player.
    checkMp3($path, substr($audio, 0, -10), true);
    checkMp3($path, substr($audio, 0, 3), false);
    checkMp3($path, str_repeat("\0", 100), false);
    echo "MP3 duration checks passed\n";
} finally {
    unlink($path);
}
