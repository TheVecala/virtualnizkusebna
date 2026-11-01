<?php
declare(strict_types=1);
require_once __DIR__.'/vz2_audio_metadata.php';

// Metadata only; no shell execution, client duration, or dependency on peaks cache.
function vz2_duration(string $path, string $format): int {
    $h = fopen($path,'rb');
    if (!$h) throw new Vz2Error('Audio nelze přečíst.',422);
    $size = filesize($path); $seconds = 0.0;
    try {
        $head = fread($h,64);
        if ($format==='mp3' || $format==='wav') {
            $seconds=vz2_mp3_wav_seconds($path,$format);
        } elseif ($format==='flac' && strlen($head)>=42 && substr($head,0,4)==='fLaC' && (ord($head[4])&127)===0) {
            $info=substr($head,8,34);
            $rate=(ord($info[10])<<12)|(ord($info[11])<<4)|(ord($info[12])>>4);
            $samples=((ord($info[13])&15)*4294967296)+unpack('N',substr($info,14,4))[1];
            if ($rate>0) $seconds=$samples/$rate;
        } elseif ($format==='aac') {
            $pos=0; $rates=[96000,88200,64000,48000,44100,32000,24000,22050,16000,12000,11025,8000,7350];
            while($pos+7<=$size) {
                fseek($h,$pos); $b=fread($h,7); $si=(ord($b[2])>>2)&15;
                if(ord($b[0])!==255 || (ord($b[1])&246)!==240 || !isset($rates[$si])) throw new Vz2Error('AAC musí být platné ADTS audio.',422);
                $length=((ord($b[3])&3)<<11)|(ord($b[4])<<3)|(ord($b[5])>>5);
                if($length<7 || $pos+$length>$size)throw new Vz2Error('Neúplný AAC rámec.',422);
                $seconds+=1024*((ord($b[6])&3)+1)/$rates[$si]; $pos+=$length;
            }
        } elseif ($format==='ogg') {
            fseek($h,0); $rate=0; $samples=0; $serial=null; $skip=0;
            while(ftell($h)+27<=$size) {
                $page=fread($h,27);
                if(substr($page,0,4)!=='OggS' || ord($page[4])!==0)throw new Vz2Error('Neplatné OGG.',422);
                $n=ord($page[26]); $laces=$n?fread($h,$n):'';
                if(strlen($laces)!==$n)throw new Vz2Error('Neúplné OGG.',422);
                $length=array_sum(array_map('ord',str_split($laces))); $body=$length?fread($h,$length):'';
                if(strlen($body)!==$length)throw new Vz2Error('Neúplné OGG.',422);
                $thisSerial=substr($page,14,4);
                if($serial===null) {
                    $serial=$thisSerial;
                    if(substr($body,0,7)==="\x01vorbis" && strlen($body)>=16)$rate=unpack('V',substr($body,12,4))[1];
                    elseif(substr($body,0,8)==='OpusHead' && strlen($body)>=19){$rate=48000;$skip=unpack('v',substr($body,10,2))[1];}
                    else throw new Vz2Error('OGG musí obsahovat Vorbis nebo Opus.',422);
                }
                if($serial!==$thisSerial)throw new Vz2Error('Řetězené OGG není podporováno.',422);
                $g=unpack('Vlow/Vhigh',substr($page,6,8));
                if($g['high']!==4294967295)$samples=max($samples,$g['high']*4294967296+$g['low']);
            }
            if($rate>0)$seconds=($samples-$skip)/$rate;
        }
        if(!is_finite($seconds) || $seconds<=0 || $seconds>604800)throw new Vz2Error('Nelze ověřit délku audia (nejvýše 7 dní).',422);
        return max(1,(int)round($seconds*1000));
    } finally { fclose($h); }
}

function vz2_inspect_upload(string $path, string $name, bool $attachment): array {
    $ext=strtolower(pathinfo($name,PATHINFO_EXTENSION));
    $size=filesize($path);
    if(!$size || $size>(defined('VZ2_MAX_UPLOAD_BYTES')?VZ2_MAX_UPLOAD_BYTES:536870912))throw new Vz2Error('Soubor je prázdný nebo příliš velký.',413);
    $audio=['mp3'=>'audio/mpeg','wav'=>'audio/wav','ogg'=>'audio/ogg','flac'=>'audio/flac','aac'=>'audio/aac'];
    $mime=''; $duration=null;
    if(!$attachment) {
        if(!isset($audio[$ext]))throw new Vz2Error('Nepodporovaný formát audia.',422);
        $duration=vz2_duration($path,$ext); $mime=$audio[$ext];
    } elseif($ext==='pdf') {
        $h=fopen($path,'rb'); $signature=fread($h,5); fclose($h);
        if($signature!=='%PDF-')throw new Vz2Error('Soubor není PDF.',422);
        $mime='application/pdf';
    } elseif($ext==='txt') {
        if($size>1048576)throw new Vz2Error('Textová příloha smí mít nejvýše 1 MiB.',413);
        $text=file_get_contents($path);
        if(str_contains($text,"\0") || preg_match('//u',$text)!==1)throw new Vz2Error('TXT musí být UTF-8 text.',422);
        $mime='text/plain';
    } elseif(in_array($ext,['jpg','jpeg','png','gif'],true)) {
        $image=@getimagesize($path); $expected=['jpg'=>'image/jpeg','jpeg'=>'image/jpeg','png'=>'image/png','gif'=>'image/gif'][$ext];
        if(!$image || $image['mime']!==$expected)throw new Vz2Error('Neplatný obrázek.',422);
        $mime=$expected;
    } else throw new Vz2Error('Nepodporovaný formát přílohy.',422);
    return ['format'=>$ext,'mime_type'=>$mime,'byte_size'=>$size,'duration_ms'=>$duration,'sha256'=>hash_file('sha256',$path)];
}
