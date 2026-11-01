<?php
declare(strict_types=1);

// Caller holds the operation lock. SQL keeps the file pending until verification.
// Exclusive creation never truncates an existing destination, even on collision.
function vz2_copy_exclusive(string $source, string $destination, string $sha256): void {
    if(is_link($destination))throw new RuntimeException('Cíl uploadu je symbolický odkaz.',409);
    if(is_file($destination) && hash_file('sha256',$destination)===$sha256)return;
    if(file_exists($destination))throw new RuntimeException('Cíl uploadu již existuje s jiným obsahem; nebyl přepsán.',409);
    if(!is_file($source) || is_link($source) || hash_file('sha256',$source)!==$sha256)throw new RuntimeException('Staging chybí nebo se změnil.',409);
    $input=fopen($source,'rb');
    if(!$input)throw new RuntimeException('Staging nelze otevřít.',500);
    $output=@fopen($destination,'xb');
    if(!$output){fclose($input);throw new RuntimeException('Cíl nelze výhradně vytvořit; existující soubor nebyl přepsán.',409);}
    try {
        $expected=filesize($source);
        $copied=stream_copy_to_stream($input,$output);
        if($copied===false || $copied!==$expected || !fflush($output))throw new RuntimeException('Kopírování uploadu nebylo dokončeno.',500);
        if(function_exists('fsync') && !fsync($output))throw new RuntimeException('Soubor nelze potvrdit na disku.',500);
        fclose($output);$output=null;
        if(hash_file('sha256',$destination)!==$sha256)throw new RuntimeException('Kontrolní součet kopie nesouhlasí.',409);
    } catch(Throwable $e) {
        if(is_resource($output)){fclose($output);$output=null;}
        // Only the destination exclusively created by this invocation is ours to remove.
        if(!unlink($destination))throw new RuntimeException('Nedokončenou kopii nelze uklidit; staging zůstal zachován.',500,$e);
        throw $e;
    } finally {if(is_resource($output))fclose($output);fclose($input);}
}
