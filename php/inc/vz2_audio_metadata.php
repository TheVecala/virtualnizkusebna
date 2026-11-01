<?php
declare(strict_types=1);

// A recoverable tag/frame warning must not turn a playable upload into an error.
// Keep duration server-derived; the upload size and duration caps live in vz2_media.php.
function vz2_mp3_wav_seconds(string $path, string $format): float {
    if ($format === 'wav') {
        $header = file_get_contents($path, false, null, 0, 40);
        // getID3 handles RIFF codecs; these alternate WAVE containers need their
        // own chunk-size/endianness reader (without a codec whitelist).
        if (in_array(substr($header, 0, 4), ['RF64', 'BW64', 'RIFX', 'riff'], true)) {
            return vz2_wave_container_seconds($path);
        }
    }
    require_once __DIR__.'/../vendor/getid3/getid3.php';
    $reader = new getID3();
    $reader->option_tags_process = false;
    $reader->option_tags_html = false;
    $reader->option_extra_info = false;
    $reader->option_save_attachments = getID3::ATTACHMENTS_NONE;
    // PHP upload temporaries have no extension. Retain the MPEG resync fallback.
    $info = $reader->analyze($path, null, 'upload.'.$format);
    $matches = $format === 'mp3'
        ? in_array($info['fileformat'] ?? '', ['mp1', 'mp2', 'mp3'], true)
        : isset($info['riff']['WAVE']);
    if (!$matches || empty($info['audio']['sample_rate'])) {
        throw new Vz2Error('Soubor neobsahuje rozpoznatelné audio '.strtoupper($format).'.', 422);
    }
    return (float)($info['playtime_seconds'] ?? 0);
}

function vz2_wave_uint64(string $bytes): int {
    $parts = unpack('Vlow/Vhigh', $bytes);
    if ($parts['high'] > intdiv(PHP_INT_MAX, 4294967296)) {
        throw new Vz2Error('Neplatná velikost WAV.', 422);
    }
    return $parts['high'] * 4294967296 + $parts['low'];
}

function vz2_wave_container_seconds(string $path): float {
    $h = fopen($path, 'rb');
    if (!$h) throw new Vz2Error('Audio nelze přečíst.', 422);
    try {
        $size = fstat($h)['size'];
        $header = fread($h, 40);
        $container = substr($header, 0, 4);
        $wave64 = $container === 'riff';
        $guidTail = "\xf3\xac\xd3\x11\x8c\xd1\x00\xc0\x4f\x8e\xdb\x8a";
        if ($wave64) {
            if (substr($header, 0, 16) !== "riff\x2e\x91\xcf\x11\xa5\xd6\x28\xdb\x04\xc1\x00\x00"
                || substr($header, 24, 16) !== 'wave'.$guidTail) {
                throw new Vz2Error('Neplatná hlavička Wave64.', 422);
            }
        } elseif (!in_array($container, ['RF64', 'BW64', 'RIFX'], true) || substr($header, 8, 4) !== 'WAVE') {
            throw new Vz2Error('Neplatná hlavička WAV.', 422);
        }
        $uint32 = $container === 'RIFX' ? 'N' : 'V';
        $position = $wave64 ? 40 : 12;
        $headerSize = $wave64 ? 24 : 8;
        $alignment = $wave64 ? 8 : 2;
        $sampleRate = $byteRate = $samples = $audioBytes = 0;
        $dataSize = null;
        $largeChunks = [];
        while ($position + $headerSize <= $size) {
            fseek($h, $position);
            $chunk = fread($h, $headerSize);
            $id = substr($chunk, 0, 4);
            if ($wave64) {
                $length = vz2_wave_uint64(substr($chunk, 16, 8));
                if ($length < 24) throw new Vz2Error('Neplatný blok Wave64.', 422);
                $length -= 24;
                if (substr($chunk, 4, 12) !== $guidTail) $id = '';
            } else {
                $length = unpack($uint32, substr($chunk, 4, 4))[1];
                if ($length === 4294967295) {
                    if ($id === 'data' && $dataSize !== null) $length = $dataSize;
                    elseif (!empty($largeChunks[$id])) $length = array_shift($largeChunks[$id]);
                    else throw new Vz2Error('Chybí velikost bloku RF64/BW64.', 422);
                }
            }
            $body = $position + $headerSize;
            if ($length > $size - $body) throw new Vz2Error('Neúplný WAV.', 422);
            if ($id === 'ds64' && !$wave64 && in_array($container, ['RF64', 'BW64'], true)) {
                if ($length < 28) throw new Vz2Error('Neplatná hlavička RF64/BW64.', 422);
                $ds64 = fread($h, 28);
                $dataSize = vz2_wave_uint64(substr($ds64, 8, 8));
                $samples = vz2_wave_uint64(substr($ds64, 16, 8));
                $count = unpack('V', substr($ds64, 24, 4))[1];
                if ($count > intdiv($length - 28, 12)) throw new Vz2Error('Neplatná tabulka RF64/BW64.', 422);
                for ($i = 0; $i < $count; $i++) {
                    $entry = fread($h, 12);
                    $largeChunks[substr($entry, 0, 4)][] = vz2_wave_uint64(substr($entry, 4, 8));
                }
            } elseif ($id === 'fmt ') {
                if ($length < 16) throw new Vz2Error('Neplatná hlavička WAV.', 422);
                $fmt = fread($h, 16);
                $sampleRate = unpack($uint32, substr($fmt, 4, 4))[1];
                $byteRate = unpack($uint32, substr($fmt, 8, 4))[1];
            } elseif ($id === 'fact' && $length >= ($wave64 ? 8 : 4) && !$samples) {
                $samples = $wave64 ? vz2_wave_uint64(fread($h, 8)) : unpack($uint32, fread($h, 4))[1];
            } elseif ($id === 'data') {
                $audioBytes += $length;
            }
            $position = $body + $length + (($alignment - ($length % $alignment)) % $alignment);
        }
        if (!$audioBytes || !$sampleRate) return 0;
        if ($samples > 0) return $samples / $sampleRate;
        return $byteRate > 0 ? $audioBytes / $byteRate : 0;
    } finally {
        fclose($h);
    }
}
