<?php
declare(strict_types=1);
$appRoot = is_dir(dirname(__DIR__).'/php') ? dirname(__DIR__) : dirname(__DIR__, 2);
require_once $appRoot.'/php/inc/vz2_file_io.php';
// Temporary pre-migration probe. Web: existing admin login + CSRF; CLI: explicit root.
// No schema changes, uploads or access-control changes. Removes only its own scratch files.
function vz2_probe_storage(string $candidate): array {
    $root=realpath($candidate);
    if($root===false || !is_dir($root) || is_link($candidate))throw new RuntimeException('Testovací adresář není dostupný.');
    $manifestPath=$root.'/.vz2-probe.json';
    if(is_link($manifestPath) || !is_file($manifestPath) || filesize($manifestPath)>8192)throw new RuntimeException('Chybí testovací manifest.');
    $m=json_decode(file_get_contents($manifestPath),true,16,JSON_THROW_ON_ERROR);
    if(($m['version']??null)!==1 || !is_string($m['dataset']??null) || !preg_match('/\Avz2-[a-f0-9]{48}\z/',$m['dataset'])
        || !is_string($m['body']??null) || strlen($m['body'])>512 || !is_array($m['probes']??null) || count($m['probes'])!==5)throw new RuntimeException('Neplatný testovací manifest.');
    foreach(array_merge(['.vz2-storage-id'],$m['probes']) as $relative){
        if(!is_string($relative) || !preg_match('/\A[a-zA-Z0-9_.\/-]+\z/',$relative) || str_starts_with($relative,'/') || str_contains($relative,'..'))throw new RuntimeException('Neplatná cesta sondy.');
        $file=$root;
        foreach(explode('/',$relative) as $part){$file.='/'.$part;if(is_link($file))throw new RuntimeException('Sonda obsahuje symbolický odkaz.');}
        if(!is_file($file) || filesize($file)>512)throw new RuntimeException('Chybí testovací soubor.');
        $expected=$relative==='.vz2-storage-id'?$m['dataset']."\n":$m['body'];
        if(file_get_contents($file)!==$expected)throw new RuntimeException('Obsah sondy nebo dataset marker nesouhlasí.');
    }
    $scratch=$root.'/.staging/check-'.bin2hex(random_bytes(16));
    if(!mkdir($scratch,0700))throw new RuntimeException('PHP nemůže vytvořit testovací adresář.');
    $first=null;$second=null;$created=[];
    try{
        $source=$scratch.'/source.txt';$target=$scratch.'/copied.txt';
        $first=fopen($source,'x+');if(!$first)throw new RuntimeException('PHP nemůže vytvořit testovací soubor.');$created[]=$source;
        $payload=bin2hex(random_bytes(16));
        if(fwrite($first,$payload)!==strlen($payload) || !fflush($first))throw new RuntimeException('Testovací zápis selhal.');
        if(!flock($first,LOCK_EX|LOCK_NB))throw new RuntimeException('Zámek flock není dostupný.');
        $second=fopen($source,'r+');
        if(!$second)throw new RuntimeException('Nelze ověřit druhý souběžný přístup.');
        if(flock($second,LOCK_EX|LOCK_NB))throw new RuntimeException('Druhý přístup obešel zámek flock.');
        flock($first,LOCK_UN);fclose($second);$second=null;
        fclose($first);$first=null;
        vz2_copy_exclusive($source,$target,hash('sha256',$payload));$created[]=$target;
        if(!unlink($source) || file_get_contents($target)!==$payload)throw new RuntimeException('Kopie neuchovala soubor po odebrání stagingu.');
    }finally{
        if(is_resource($second))fclose($second);
        if(is_resource($first))fclose($first);
        $clean=true;
        foreach($created as $file)if(file_exists($file) && !unlink($file))$clean=false;
        if(!rmdir($scratch))$clean=false;
        if(!$clean)throw new RuntimeException('Testovací soubory se nepodařilo uklidit; zkontrolujte .staging/check adresář.');
    }
    return ['ok'=>true,'root'=>$root,'dataset'=>$m['dataset'],'probes'=>count($m['probes']),
        'php'=>PHP_VERSION,'read_write'=>true,'exclusive_copy'=>true,'link_available'=>function_exists('link'),'flock'=>true];
}
if(realpath($_SERVER['SCRIPT_FILENAME']??'')!==__FILE__)return;
if(PHP_SAPI==='cli'){
    try{if($argc!==2)throw new RuntimeException('Usage: php tools/vz2_storage_probe.php STORAGE_ROOT');echo json_encode(vz2_probe_storage($argv[1]),JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT).PHP_EOL;}
    catch(Throwable $e){fwrite(STDERR,$e->getMessage().PHP_EOL);exit(1);}exit;
}
require_once $appRoot . '/php/inc/session.php';
app_session_start();
require_once $appRoot.'/config.php';
auth_refresh_session();auth_require_admin();
header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
$result=null;$error='';
if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){
    try{auth_check_csrf($_POST);$result=vz2_probe_storage(dirname(__DIR__,2).'/_vz2_storage');}
    catch(Throwable $e){http_response_code(422);$error=$e->getMessage();}
}
?>
<!doctype html><html lang="cs"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kontrola úložiště VZ2</title><h1>Kontrola úložiště VZ2</h1>
<p>Ověří testovací soubory v adresáři _vz2_storage vedle alfy a bety. Vytvoří a uklidí vlastní malé soubory pro test kopírování bez přepsání a zámku. Databázi ani uživatelská data nemění.</p>
<form method="post"><input type="hidden" name="csrf" value="<?=auth_h(auth_csrf_token())?>"><button>Spustit kontrolu souborů</button></form>
<?php if($error):?><p role="alert"><?=auth_h($error)?></p><?php endif;?>
<?php if($result):?><h2>Kontrola souborů prošla</h2><pre><?=auth_h(json_encode($result,JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT))?></pre>
<p>Toto ještě nepotvrzuje ochranu před stažením přes web. Je potřeba také vnější HTTP test. Po skončení tento diagnostický PHP soubor odstraňte z obou instalací.</p><?php endif;?>
</html>
