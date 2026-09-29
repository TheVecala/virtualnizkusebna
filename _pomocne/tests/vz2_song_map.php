<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/php/inc/vz2_content.php';
$checks = 0;
function check_map(bool $ok, string $label): void {
    global $checks;
    if (!$ok) throw new RuntimeException($label);
    echo 'OK '.(++$checks).': '.$label.PHP_EOL;
}
function reject_map(array $map, string $label): void {
    try { vz2_song_map_body(json_encode($map,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)); }
    catch (Vz2Error $e) { check_map($e->status===400,$label); return; }
    throw new RuntimeException('Accepted invalid map: '.$label);
}
$bar = ['id'=>str_repeat('a',32),'base'=>'hihat','fill'=>0,'crash'=>true,'special'=>null,'detail'=>"  HH | x-x-x-x-\n<text>\n"];
$map = ['schema_version'=>1,'sections'=>[['id'=>str_repeat('b',32),'name'=>'Refrén 1','bars'=>[$bar]]]];
$encode = fn(array $value): string => json_encode($value,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
check_map(json_decode(vz2_song_map_body($encode($map)),true)===$map,'snapshot preserves stable IDs, semantics and exact detail');
foreach (['hihat','ride'] as $base) foreach ([0,1,2,3] as $fill) {
    $next=$map; $next['sections'][0]['bars'][0]=array_replace($bar,['base'=>$base,'fill'=>$fill,'crash'=>false]);
    check_map(json_decode(vz2_song_map_body($encode($next)),true)===$next,$base.' fill '.$fill);
}
foreach (['unknown','pause','stop'] as $special) {
    $next=$map; $next['sections'][0]['bars'][0]=array_replace($bar,['base'=>null,'fill'=>0,'crash'=>false,'special'=>$special]);
    check_map(json_decode(vz2_song_map_body($encode($next)),true)===$next,$special);
}
$next=$map; $next['sections'][0]['bars'][0]=array_replace($bar,['base'=>null,'fill'=>4,'crash'=>false]);
check_map(json_decode(vz2_song_map_body($encode($next)),true)===$next,'standalone F4');
check_map(vz2_song_map_body('{"schema_version":1,"sections":[]}')==='{"schema_version":1,"sections":[]}','empty map after removing last section is valid');
foreach ([['fill'=>1],['fill'=>4],['special'=>'pause'],['fill'=>'0'],['crash'=>1],['base'=>'square'],['time_ms'=>100],['detail'=>str_repeat('x',65537)]] as $change) {
    $next=$map; $next['sections'][0]['bars'][0]=array_replace($bar,$change); reject_map($next,'reject invalid semantics/shape/detail '.json_encode(array_keys($change)));
}
$next=$map; $next['sections'][0]['bars'][]=$bar; reject_map($next,'duplicate bar IDs');
$next=$map; $next['sections'][0]['id']=$bar['id']; reject_map($next,'section/bar ID collision');
$next=$map; $next['sections'][0]['bars']=[]; reject_map($next,'empty section');
$next=$map; $next['schema_version']=2; reject_map($next,'unknown schema version');
$next=$map; $next['sections'][0]['name']=' '; reject_map($next,'blank section name');
foreach (['{}','null','[]','{"schema_version":1,"sections":{}}','{bad'] as $body) {
    try { vz2_song_map_body($body); throw new RuntimeException('invalid JSON shape accepted'); }
    catch (Vz2Error $e) { check_map(true,'reject JSON shape '.$body); }
}
check_map(vz2_document_body("  Text\n")==="  Text\n" && vz2_document_kind('tablature')==='tablature','legacy plain documents unchanged');
echo 'PASS '.$checks.' checks'.PHP_EOL;
