<?php
// Přehled čte pouze pevné datové adresáře aktuální kapely.
const ADMIN_STORAGE_CACHE_TTL = 600;

function admin_storage_within(string $path, string $parent): bool {
    $path = str_replace('\\', '/', $path);
    $parent = rtrim(str_replace('\\', '/', $parent), '/') . '/';
    if (DIRECTORY_SEPARATOR === '\\') {
        $path = strtolower($path);
        $parent = strtolower($parent);
    }
    return strncmp($path, $parent, strlen($parent)) === 0;
}

function admin_storage_band_root(string $project, array $session): string {
    $parts = ['user'];
    foreach (['kapela', 'befelemepesseveze'] as $key) {
        $value = $session[$key] ?? null;
        if (!is_string($value) || $value === '.' || $value === '..'
            || !preg_match('/\A[\p{L}\p{N}._-]+\z/u', $value)) {
            throw new RuntimeException('Neplatný kontext úložiště kapely.');
        }
        $parts[] = $value;
    }
    $path = realpath($project);
    if ($path === false) {
        throw new RuntimeException('Úložiště není dostupné.');
    }
    foreach ($parts as $part) {
        $parent = $path;
        $path .= DIRECTORY_SEPARATOR . $part;
        if (is_link($path)) {
            throw new RuntimeException('Datová cesta nesmí být symbolický odkaz.');
        }
        if (file_exists($path)) {
            $real = realpath($path);
            if ($real === false || !is_dir($path) || !admin_storage_within($real, $parent)) {
                throw new RuntimeException('Neplatná datová cesta.');
            }
            $path = $real;
        }
    }
    return $path;
}

function admin_storage_size($bytes): string {
    if ($bytes === null || $bytes === false) {
        return 'Nedostupné';
    }
    $units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
    $unit = 0;
    while ($bytes >= 1024 && $unit < count($units) - 1) {
        $bytes /= 1024;
        $unit++;
    }
    return number_format($bytes, $unit === 0 ? 0 : 2, ',', ' ') . ' ' . $units[$unit];
}

function admin_storage_scan(string $bandRoot): array {
    $report = ['bytes' => 0, 'files' => 0, 'songs' => 0, 'projects' => 0,
        'trees' => [], 'largest' => [], 'skipped' => 0, 'errors' => 0];
    $walk = function (string $path, string $relative, int $depth = 0) use (&$walk, &$report): array {
        $node = ['name' => basename($path), 'path' => $relative, 'bytes' => 0,
            'files' => 0, 'modified' => 0, 'children' => [], 'incomplete' => false];
        // Hluboké/nečitelné větve označíme, aby se neúplný součet netvářil jako přesný.
        $entries = $depth <= 64 ? @scandir($path) : false;
        if ($entries === false) {
            $report['errors']++;
            $node['incomplete'] = true;
            return $node;
        }
        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..') continue;
            $full = $path . DIRECTORY_SEPARATOR . $entry;
            if (is_link($full)) {
                $report['skipped']++;
                continue;
            }
            $real = realpath($full);
            if ($real === false || !admin_storage_within($real, $path)) {
                $report['errors']++;
                $node['incomplete'] = true;
                continue;
            }
            if (is_dir($full)) {
                $child = $walk($full, $relative . '/' . $entry, $depth + 1);
                $node['children'][] = $child;
                $node['bytes'] += $child['bytes'];
                $node['files'] += $child['files'];
                $node['modified'] = max($node['modified'], $child['modified']);
                $node['incomplete'] = $node['incomplete'] || $child['incomplete'];
            } elseif (is_file($full)) {
                $stat = @stat($full);
                if ($stat === false) {
                    $report['errors']++;
                    $node['incomplete'] = true;
                    continue;
                }
                $node['bytes'] += $stat['size'];
                $node['files']++;
                $node['modified'] = max($node['modified'], $stat['mtime']);
                $report['largest'][] = ['name' => $entry, 'path' => $relative,
                    'bytes' => $stat['size'], 'modified' => $stat['mtime']];
                usort($report['largest'], function ($a, $b) {
                    return ($b['bytes'] <=> $a['bytes']) ?: strcmp($a['path'] . '/' . $a['name'], $b['path'] . '/' . $b['name']);
                });
                $report['largest'] = array_slice($report['largest'], 0, 10);
            }
        }
        usort($node['children'], function ($a, $b) {
            return ($b['bytes'] <=> $a['bytes']) ?: strnatcasecmp($a['name'], $b['name']);
        });
        return $node;
    };
    // Vývojová větev e3b0af64 používá multitracky, podporujeme i název multitrack.
    foreach (['uploads', 'multitrack', 'multitracky'] as $directory) {
        $path = $bandRoot . DIRECTORY_SEPARATOR . $directory;
        if (is_link($path)) {
            $report['skipped']++;
            continue;
        }
        if (!file_exists($path)) continue;
        $real = realpath($path);
        if (!is_dir($path) || $real === false || !admin_storage_within($real, $bandRoot)) {
            $report['errors']++;
            continue;
        }
        $tree = $walk($path, $directory);
        $report['trees'][] = $tree;
        $report['bytes'] += $tree['bytes'];
        $report['files'] += $tree['files'];
        $report[$directory === 'uploads' ? 'songs' : 'projects'] += count($tree['children']);
    }
    $report['calculated_at'] = time();
    return $report;
}

// Cache je oddělená podle kapely i instalace a žije jen v session administrátora.
function admin_storage_report(string $bandRoot, array &$session, bool $refresh = false): array {
    $key = hash('sha256', $bandRoot);
    $cache = $session['admin_storage_cache'] ?? [];
    if ($refresh || ($cache['key'] ?? '') !== $key
        || time() - ($cache['report']['calculated_at'] ?? 0) >= ADMIN_STORAGE_CACHE_TTL) {
        clearstatcache(true);
        $cache = ['key' => $key, 'report' => admin_storage_scan($bandRoot)];
        $session['admin_storage_cache'] = $cache;
    }
    return $cache['report'];
}

function admin_storage_tree(array $node, bool $open = false): void {
    ?>
    <li><details <?= $open ? 'open' : '' ?>>
      <summary><span class="storage-folder"><?= auth_h($node['name']) ?>/</span>
        <span class="storage-meta"><?= admin_storage_size($node['bytes']) ?> · <?= number_format($node['files'], 0, ',', ' ') ?> souborů<?= $node['incomplete'] ? ' · neúplné' : '' ?></span></summary>
      <?php if ($node['children']): ?>
        <ul><?php foreach ($node['children'] as $child) admin_storage_tree($child); ?></ul>
      <?php else: ?>
        <p class="form-hint storage-leaf"><?= $node['files'] ? 'Bez podadresářů.' : ($node['incomplete'] ? 'Obsah nelze načíst.' : 'Prázdný adresář.') ?></p>
      <?php endif; ?>
    </details></li>
    <?php
}
