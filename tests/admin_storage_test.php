<?php
// Samostatný CLI test, bez databáze a bez přístupu k datům skutečné kapely.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require_once dirname(__DIR__) . '/php/inc/admin_storage.php';
require_once dirname(__DIR__) . '/php/auth.php';

$temp = sys_get_temp_dir() . '/zkusebna-storage-' . bin2hex(random_bytes(8));
$created = [];
$directories = [];
$passed = 0;
function storage_check(bool $condition, string $label): void {
    global $passed;
    if (!$condition) throw new RuntimeException('FAIL: ' . $label);
    $passed++;
    echo "OK: $label\n";
}
function storage_fixture(string $path, string $content): void {
    global $created, $directories;
    $missing = [];
    for ($dir = dirname($path); !is_dir($dir); $dir = dirname($dir)) $missing[] = $dir;
    foreach (array_reverse($missing) as $dir) {
        mkdir($dir);
        $directories[] = $dir;
    }
    file_put_contents($path, $content);
    $created[] = $path;
}
try {
    $band = $temp . '/user/kapela/hash';
    storage_fixture($band . '/uploads/Mala/data/nazev_valu.txt', 'Balada');
    storage_fixture($band . '/uploads/Mala/audio.wav', str_repeat('a', 20));
    storage_fixture($band . '/uploads/Velka/audio.wav', str_repeat('a', 100));
    storage_fixture($band . '/multitrack/projekt/stems/bass.wav', str_repeat('b', 200));
    storage_fixture($band . '/multitracky/projekt/multitrack.json', '{}');
    storage_fixture($band . '/multitracky/projekt/stems/drums.wav', str_repeat('c', 300));
    storage_fixture($band . '/outside.txt', str_repeat('x', 1000));
    storage_fixture($temp . '/outside/secret.txt', str_repeat('x', 2000));
    $session = ['kapela' => 'kapela', 'befelemepesseveze' => 'hash'];
    $root = admin_storage_band_root($temp, $session);
    storage_check(realpath($root) === realpath($band), 'Cesta kapely je odvozena ze session.');
    foreach (['', '..', '../outside', 'a/b', 'a\\b', 'C:outside', [], null] as $bad) {
        $rejected = false;
        try { admin_storage_band_root($temp, ['kapela' => $bad, 'befelemepesseveze' => 'hash']); }
        catch (RuntimeException $e) { $rejected = true; }
        storage_check($rejected, 'Odmítnut neplatný kontext: ' . json_encode($bad));
    }
    $report = admin_storage_report($root, $session);
    storage_check($report['bytes'] === 628 && $report['files'] === 6, 'Součet uploads i obou variant multitrack, bez okolních dat.');
    storage_check($report['songs'] === 2 && $report['projects'] === 2, 'Skladby a projekty se počítají jen v první úrovni.');
    storage_check($report['trees'][0]['children'][0]['name'] === 'Velka', 'Adresáře jsou řazeny podle velikosti.');
    storage_check($report['largest'][0]['name'] === 'drums.wav', 'Největší soubor pochází z vývojové struktury multitracky.');
    storage_check($report['trees'][0]['bytes'] === 126, 'Součet zahrnuje vnořená interní data.');
    storage_fixture($band . '/uploads/Velka/new.wav', str_repeat('d', 400));
    storage_check(admin_storage_report($root, $session)['bytes'] === 628, 'Cache neprovádí nový průchod při každém načtení.');
    $report = admin_storage_report($root, $session, true);
    storage_check($report['bytes'] === 1028 && $report['files'] === 7, 'Ruční přepočet zachytí nový soubor.');
    storage_fixture($band . '/uploads/Velka/empty.txt', '');
    $session['admin_storage_cache']['report']['calculated_at'] = time() - ADMIN_STORAGE_CACHE_TTL;
    storage_check(admin_storage_report($root, $session)['files'] === 8, 'Expirace cache a započítání prázdných souborů.');
    storage_check(admin_storage_report($temp . '/missing', $session)['files'] === 0, 'Jiný datový kořen nepřevezme cizí cache; chybějící složky jsou prázdné.');
    for ($i = 1; $i <= 12; $i++) storage_fixture($band . '/uploads/Velka/part-' . $i . '.wav', str_repeat('e', $i));
    $report = admin_storage_scan($root);
    storage_check(count($report['largest']) === 10, 'Seznam je omezen na deset největších souborů.');
    storage_check(array_column($report['largest'], 'bytes') === [400, 300, 200, 100, 20, 12, 11, 10, 9, 8], 'Největší soubory jsou správně vybrané i seřazené.');
    $link = $band . '/uploads/linked';
    if (@symlink($temp . '/outside', $link)) {
        $created[] = $link;
        $linked = admin_storage_scan($root);
        storage_check($linked['bytes'] === $report['bytes'] && $linked['skipped'] === 1, 'Symbolický odkaz na cizí data je vynechán.');
        $rootLink = $temp . '/user/alias';
        if (!symlink($band, $rootLink)) throw new RuntimeException('Nelze vytvořit druhý testovací odkaz.');
        $created[] = $rootLink;
        $rejected = false;
        try { admin_storage_band_root($temp, ['kapela' => 'alias', 'befelemepesseveze' => 'uploads']); }
        catch (RuntimeException $e) { $rejected = true; }
        storage_check($rejected, 'Symbolický odkaz v kořeni kapely je odmítnut.');
    } else {
        echo "SKIP: Systém nepovoluje vytvoření symbolických odkazů.\n";
    }
    storage_check(admin_storage_size(0) === '0 B' && admin_storage_size(1024) === '1,00 KiB'
        && admin_storage_size(false) === 'Nedostupné', 'Formátování velikostí a nedostupné kapacity.');
    $node = $report['trees'][0];
    $node['name'] = '<script>alert(1)</script>';
    ob_start();
    admin_storage_tree($node, true);
    $html = ob_get_clean();
    storage_check(strpos($html, '<script>') === false && strpos($html, '&lt;script&gt;') !== false, 'Názvy adresářů jsou při vykreslení escapované.');
    $storage = $report;
    $storage['largest'][0]['name'] = '<img src=x onerror=alert(1)>';
    $storage['largest'][0]['path'] = '<svg onload=alert(1)>';
    $storageError = '';
    $diskFree = false;
    $diskTotal = false;
    $diskPercent = null;
    $_SESSION = [];
    ob_start();
    require dirname(__DIR__) . '/php/inc/admin_storage_view.php';
    $html = ob_get_clean();
    storage_check(strpos($html, '<img') === false && strpos($html, '<svg') === false
        && strpos($html, '&lt;img') !== false, 'Tabulka escapuje názvy souborů i jejich umístění.');
    storage_check(strpos($html, '<progress') === false && strpos($html, 'nejsou dostupné') !== false,
        'Nedostupná kapacita disku nezobrazuje falešné nulové využití.');
    echo "Hotovo: $passed kontrol.\n";
} finally {
    // Mažeme jen konkrétní fixture soubory a prázdné složky vytvořené tímto testem.
    foreach (array_reverse($created) as $path) {
        if (is_link($path) && is_dir($path) && DIRECTORY_SEPARATOR === '\\') rmdir($path);
        else unlink($path);
    }
    foreach (array_reverse($directories) as $path) rmdir($path);
}
