<?php
declare(strict_types=1);

require_once __DIR__.'/../../php/inc/vz2_core.php';
require_once __DIR__.'/../../php/inc/vz2_media.php';
define('VZ2_MAX_UPLOAD_BYTES', 1048576);

$path = tempnam(sys_get_temp_dir(), 'vz2-formats-');
if ($path === false) throw new RuntimeException('Cannot create fixture.');
$checks = 0;
function audioCheck(string $label, string $bytes, string $name, ?int $duration, int $tolerance = 2, int $errorStatus = 422, string $errorText = ''): void {
    global $path, $checks;
    file_put_contents($path, $bytes);
    clearstatcache(true, $path);
    try {
        $meta = vz2_inspect_upload($path, $name, false);
        if ($duration === null) throw new RuntimeException($label.': should have been rejected');
        if (abs($meta['duration_ms'] - $duration) > $tolerance) {
            throw new RuntimeException($label.': duration '.$meta['duration_ms'].' != '.$duration);
        }
        if ($meta['sha256'] !== hash('sha256', $bytes) || file_get_contents($path) !== $bytes) {
            throw new RuntimeException($label.': original bytes changed');
        }
    } catch (Vz2Error $e) {
        if ($duration !== null || $e->status !== $errorStatus || !str_contains($e->getMessage(), $errorText)) throw new RuntimeException($label.': '.$e->getMessage(), 0, $e);
    }
    echo 'OK '.(++$checks).': '.$label."\n";
}
function waveChunk(string $id, string $data): string {
    return $id.pack('V', strlen($data)).$data.(strlen($data) % 2 ? "\0" : '');
}
function waveFile(string $fmt, string $data, string $extra = ''): string {
    $body = 'WAVE'.waveChunk('fmt ', $fmt).$extra.waveChunk('data', $data);
    return 'RIFF'.pack('V', strlen($body)).$body;
}
function wave64Chunk(string $id, string $data): string {
    $tail = "\xf3\xac\xd3\x11\x8c\xd1\x00\xc0\x4f\x8e\xdb\x8a";
    return $id.$tail.pack('P', 24 + strlen($data)).$data.str_repeat("\0", (8 - strlen($data) % 8) % 8);
}
try {
    $frame = "\xff\xfb\x90\x64".str_repeat("\0", 413);
    $mp3 = str_repeat($frame, 80);
    $mp3Ms = (int)round(80 * 1152 / 44100 * 1000);
    audioCheck('CBR MP3 and uppercase extension', $mp3, 'Zkouška.MP3', $mp3Ms, 5);
    audioCheck('MP3 encoder prefix before sync', 'encoder padding!'.$mp3, 'test.mp3', $mp3Ms, 5);
    $id3 = 'ID3'."\x04\x00\x00\x00\x04\x00\x00".str_repeat("\0", 65536);
    audioCheck('MP3 large ID3 plus external padding', $id3."\0\0".$mp3, 'test.mp3', $mp3Ms, 5);
    $lyrics = 'LYRICSBEGIN'.'LYR'.'00005'.'hello';
    $lyrics .= str_pad((string)strlen($lyrics), 6, '0', STR_PAD_LEFT).'LYRICS200';
    audioCheck('MP3 Lyrics3 and ID3v1 trailers', $mp3.$lyrics.'TAG'.str_repeat("\0", 125), 'test.mp3', $mp3Ms, 5);
    $apeItem = pack('VV', 4, 0).'Title'."\0".'Test';
    $apeFooter = 'APETAGEX'.pack('VVVV', 2000, strlen($apeItem) + 32, 1, 0).str_repeat("\0", 8);
    audioCheck('MP3 APEv2 trailer', $mp3.$apeItem.$apeFooter, 'test.mp3', $mp3Ms, 5);
    $vbr = str_repeat($frame."\xff\xfb\xb0\x64".str_repeat("\0", 622), 40);
    audioCheck('VBR MP3 without Xing header', $vbr, 'test.mp3', $mp3Ms, 30);
    $free = str_repeat("\xff\xfb\x00\x64".str_repeat("\0", 636), 80);
    audioCheck('Free-format MP3', $free, 'test.mp3', $mp3Ms, 30);

    $pcm = pack('vvVVvv', 1, 1, 8000, 16000, 2, 16);
    $data = str_repeat("\0", 16000);
    audioCheck('PCM WAV', waveFile($pcm, $data), 'test.wav', 1000);
    audioCheck('WAV metadata chunks and odd padding', waveFile($pcm, $data, waveChunk('JUNK', 'odd')), 'test.wav', 1000);
    audioCheck('Float WAV', waveFile(pack('vvVVvv', 3, 1, 8000, 32000, 4, 32), $data.$data), 'test.wav', 1000);
    $extensible = pack('vvVVvvvvV', 65534, 1, 8000, 16000, 2, 16, 22, 16, 4).pack('Vvv', 1, 0, 16)."\x80\x00\x00\xaa\x00\x38\x9b\x71";
    audioCheck('Extensible WAV', waveFile($extensible, $data), 'test.wav', 1000);
    foreach ([6 => 'A-law', 7 => 'mu-law'] as $codec => $label) {
        $fmt = pack('vvVVvvv', $codec, 1, 8000, 8000, 1, 8, 0);
        audioCheck($label.' WAV', waveFile($fmt, str_repeat("\xff", 8000), waveChunk('fact', pack('V', 8000))), 'test.wav', 1000);
    }
    $adpcm = pack('vvVVvvvv', 17, 1, 8000, 4055, 256, 4, 2, 505);
    audioCheck('IMA ADPCM WAV', waveFile($adpcm, str_repeat("\0", 256), waveChunk('fact', pack('V', 505))), 'test.wav', 63, 2);
    foreach (['RF64', 'BW64'] as $container) {
        $body = 'WAVE'.waveChunk('ds64', pack('PPP', 16072, 16000, 8000).pack('V', 0)).waveChunk('fmt ', $pcm).'data'.pack('V', 0xffffffff).$data;
        audioCheck($container.' WAV', $container.pack('V', 0xffffffff).$body, 'test.wav', 1000);
    }
    $rifx = 'WAVEfmt '.pack('N', 16).pack('nnNNnn', 1, 1, 8000, 16000, 2, 16).'data'.pack('N', 16000).$data;
    audioCheck('RIFX big-endian WAV', 'RIFX'.pack('N', strlen($rifx)).$rifx, 'test.wav', 1000);
    $w64body = 'wave'."\xf3\xac\xd3\x11\x8c\xd1\x00\xc0\x4f\x8e\xdb\x8a".wave64Chunk('fmt ', $pcm).wave64Chunk('data', $data);
    audioCheck('Sony Wave64 in .wav', "riff\x2e\x91\xcf\x11\xa5\xd6\x28\xdb\x04\xc1\x00\x00".pack('P', 24 + strlen($w64body)).$w64body, 'test.wav', 1000);
    audioCheck('Text renamed to MP3', 'This is not audio.', 'test.mp3', null);
    audioCheck('Text renamed to WAV', 'This is not audio.', 'test.wav', null);
    audioCheck('Size cap retained', str_repeat($mp3, 32), 'test.mp3', null, 0, 413, 'velký');
    $slowPcm = pack('vvVVvv', 1, 1, 1, 1, 1, 8);
    audioCheck('Seven-day duration cap retained', waveFile($slowPcm, str_repeat("\x80", 604801)), 'test.wav', null, 0, 422, 'nejvýše 7 dní');
    echo 'PASS '.$checks." audio format checks\n";
} finally {
    unlink($path);
}
