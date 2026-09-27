# Oprava příjmu MP3 a WAV (2026-09-25)

VZ2 používá pro MP3 a RIFF WAV getID3 1.9.27. Původní ruční průchod MP3
rámců a whitelist WAV PCM/float jsou odstraněné. Obnovitelné odchylky rámců,
výplň a metadata nezpůsobí zamítnutí, pokud čtečka rozpozná audio a zjistí délku.
Čtečka neprovádí převod a původní soubor se ukládá beze změny.

RF64, BW64, RIFX a Sony Wave64 mají samostatné čtení bloků v
`php/inc/vz2_audio_metadata.php`. Délku určují počty vzorků `ds64`/`fact`,
případně objem zvukových dat a bajtová rychlost z `fmt `. Kodeky se neomezují
whitelistem. Datové bloky nesmějí odkazovat mimo skutečný soubor.

Zachované podmínky: velikost dle `VZ2_MAX_UPLOAD_BYTES`, nejvýše sedm dní,
serverově zjištěná délka, počet stop, stejný formát vícestopé sady i podmínky
vzorkovacích frekvencí mixéru. Ostatní formáty a staré uploadové endpointy
se touto změnou nemění. Přijetí souboru samo nezaručuje podporu jeho kodeku
v konkrétním prohlížeči.

## Nasazení

Do instalace nahrát společně, se zachováním adresářů:

- `php/inc/vz2_media.php`
- `php/inc/vz2_audio_metadata.php`
- celý adresář `php/vendor/getid3/`, včetně licenčních souborů

Samotné přepsání `vz2_media.php` nestačí. Není potřeba Composer na hostingu,
ffmpeg, změna konfigurace ani SQL migrace.

## Ověření

Spustit z kořene projektu:

```text
php _pomocne/tests/vz2_audio_formats.php
php _pomocne/tests/vz2_mp3_duration.php
```

První sada generuje soubory pro CBR/VBR/free-format MP3, ID3/APE/Lyrics3,
WAV PCM/float/extensible/A-law/mu-law/IMA ADPCM, RF64/BW64/RIFX/Wave64.
Ověřuje délky, zachování původních bajtů, odmítnutí neaudia a limity velikosti
i délky. Jde o formátové testovací soubory; původní uživatelova MP3 není k dispozici.

Zdroje: [getID3 1.9.27](https://github.com/JamesHeinrich/getID3/tree/v1.9.27),
[struktury WAV kontejnerů](https://github.com/FFmpeg/FFmpeg/blob/master/libavformat/wavdec.c),
[identifikátory Wave64](https://github.com/FFmpeg/FFmpeg/blob/master/libavformat/w64.c).
