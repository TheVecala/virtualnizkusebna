<?php
declare(strict_types=1);

// Metadata only; no shell execution, client duration, or dependency on peaks cache.
function vz2_duration(string $path, string $format): int {
    $h = fopen($path,'rb');
    if (!$h) throw new Vz2Error('Audio nelze přečíst.',422);
    $size = filesize($path); $seconds = 0.0;
    try {
        $head = fread($h,64);
        if ($format === 'wav' && substr($head,0,4)==='RIFF' && substr($head,8,4)==='WAVE') {
            fseek($h,12); $rate=0; $bytes=0;
            while (ftell($h)+8 <= $size) {
                $chunk=fread($h,8); $length=unpack('V',substr($chunk,4,4))[1]; $next=ftell($h)+$length+($length%2);
                if ($next>$size+1) throw new Vz2Error('Neúplný WAV.',422);
                if (substr($chunk,0,4)==='fmt ') {
                    if($length<16)throw new Vz2Error('Neplatná hlavička WAV.',422);
                    $fmt=fread($h,min($length,40));
                    if (strlen($fmt)<16 || !in_array(unpack('v',substr($fmt,0,2))[1],[1,3,65534],true)) throw new Vz2Error('WAV musí být PCM nebo float.',422);
                    $rate=unpack('V',substr($fmt,8,4))[1];
                } elseif (substr($chunk,0,4)==='data') $bytes+=$length;
                fseek($h,$next);
            }
            if ($rate>0) $seconds=$bytes/$rate;
        } elseif ($format==='flac' && strlen($head)>=42 && substr($head,0,4)==='fLaC' && (ord($head[4])&127)===0) {
            $info=substr($head,8,34);
            $rate=(ord($info[10])<<12)|(ord($info[11])<<4)|(ord($info[12])>>4);
            $samples=((ord($info[13])&15)*4294967296)+unpack('N',substr($info,14,4))[1];
            if ($rate>0) $seconds=$samples/$rate;
        } elseif ($format==='mp3') {
            $pos=0;
            if(substr($head,0,3)==='ID3') {
                if(strlen($head)<10)throw new Vz2Error('Neúplná hlavička MP3.',422);
                $pos=10+((ord($head[6])&127)<<21)+((ord($head[7])&127)<<14)+((ord($head[8])&127)<<7)+(ord($head[9])&127);
                if(ord($head[5])&16)$pos+=10;
            }
            $frames=0;
            while($pos+4<=$size) {
                fseek($h,$pos); $b=fread($h,4);
                if(substr($b,0,3)==='TAG' && $size-$pos===128)break;
                $v=(ord($b[1])>>3)&3; $layer=(ord($b[1])>>1)&3; $bi=ord($b[2])>>4; $si=(ord($b[2])>>2)&3;
                if(ord($b[0])!==255 || (ord($b[1])&224)!==224 || $v===1 || $layer!==1 || $bi===0 || $bi===15 || $si===3) throw new Vz2Error('Neplatný nebo nepodporovaný MP3 rámec.',422);
                $rates=$v===3?[0,32,40,48,56,64,80,96,112,128,160,192,224,256,320]:[0,8,16,24,32,40,48,56,64,80,96,112,128,144,160];
                $sample=[44100,48000,32000][$si]/($v===3?1:($v===2?2:4));
                $length=(int)floor(($v===3?144:72)*$rates[$bi]*1000/$sample)+((ord($b[2])>>1)&1);
                if($pos+$length>$size)throw new Vz2Error('Neúplný MP3 rámec.',422);
                $seconds+=($v===3?1152:576)/$sample; $pos+=$length; $frames++;
            }
            if(!$frames)$seconds=0;
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
