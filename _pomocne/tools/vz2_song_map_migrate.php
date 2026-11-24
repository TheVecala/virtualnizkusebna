<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once dirname(__DIR__, 2).'/php/inc/vz2_song_map.php';

function migration_target(mysqli $db): array {
    $target = $db->query('SELECT DATABASE() AS db, @@hostname AS host, @@port AS port,
        @@server_id AS server_id, VERSION() AS version')->fetch_assoc();
    if (!str_contains($target['version'], 'MariaDB')) throw new RuntimeException('Očekává se MariaDB.');
    $tables = $db->query("SELECT TABLE_NAME AS name, ENGINE AS engine FROM information_schema.TABLES
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME IN ('vz2_collections','vz2_documents','vz2_document_versions')")
        ->fetch_all(MYSQLI_ASSOC);
    if (count($tables) !== 3 || array_column($tables, 'engine') !== ['InnoDB','InnoDB','InnoDB']) {
        throw new RuntimeException('Chybí očekávané tabulky InnoDB.');
    }
    $body = $db->query("SELECT DATA_TYPE, CHARACTER_SET_NAME FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='vz2_document_versions' AND COLUMN_NAME='body'")->fetch_row();
    if ($body !== ['mediumtext','utf8mb4']) throw new RuntimeException('Neočekávaný typ nebo kódování sloupce body.');
    $kind = $db->query("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()
        AND TABLE_NAME='vz2_documents' AND COLUMN_NAME='kind'")->fetch_row()[0] ?? '';
    if (!str_contains($kind, "'song_map'")) throw new RuntimeException('Databáze neobsahuje druh dokumentu song_map.');
    return $target;
}

function migration_check_links(mysqli $db): void {
    $invalid = $db->query("SELECT d.id FROM vz2_documents d
        LEFT JOIN vz2_collections c ON c.id=d.collection_id
        LEFT JOIN vz2_document_versions v ON v.document_id=d.id AND v.revision=d.current_revision
        WHERE d.kind='song_map' AND (c.id IS NULL OR c.kind<>'song' OR v.document_id IS NULL) LIMIT 1")->fetch_row();
    if ($invalid) throw new RuntimeException('Chybí skladba nebo aktuální revize dokumentu '.$invalid[0].'.');
    $orphan = $db->query("SELECT v.document_id FROM vz2_document_versions v
        LEFT JOIN vz2_documents d ON d.id=v.document_id WHERE d.id IS NULL LIMIT 1")->fetch_row();
    if ($orphan) throw new RuntimeException('Databáze obsahuje osiřelou revizi dokumentu '.$orphan[0].'.');
}

function migration_update_statement(mysqli $db): mysqli_stmt {
    $trigger = $db->query("SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE()
        AND EVENT_OBJECT_TABLE='vz2_document_versions' AND EVENT_MANIPULATION='UPDATE' LIMIT 1")->fetch_row();
    if ($trigger) throw new RuntimeException('Neočekávaný UPDATE trigger na verzích dokumentů.');
    return $db->prepare("UPDATE vz2_document_versions v JOIN vz2_documents d ON d.id=v.document_id
        SET v.body=? WHERE v.document_id=? AND v.revision=? AND d.kind='song_map'
        AND SHA2(CAST(v.body AS BINARY),256)=?");
}

function migration_scan(mysqli $db, array $target, bool $lock = false, ?mysqli_stmt $update = null, bool $details = false): array {
    migration_check_links($db);
    $stats = ['documents'=>0, 'revisions'=>0, 'v1'=>0, 'v2'=>0, 'sections'=>0, 'bars'=>0,
        'unmetered_bars'=>0, 'unresolved_fills'=>[1=>0,2=>0,3=>0,4=>0], 'max_v2_bytes'=>0];
    $before = hash_init('sha256');
    $after = hash_init('sha256');
    foreach ([$before, $after] as $hash) hash_update($hash, json_encode($target, JSON_THROW_ON_ERROR)."\n");
    $select = $db->prepare("SELECT d.id AS document_id,d.collection_id,d.current_revision,d.title,
        d.created_by AS document_author,d.updated_by,d.created_at AS document_created,d.updated_at,
        v.revision,v.created_by,v.created_at,v.body
        FROM vz2_documents d JOIN vz2_document_versions v ON v.document_id=d.id
        WHERE d.kind='song_map' AND (d.id>? OR (d.id=? AND v.revision>?))
        ORDER BY d.id,v.revision LIMIT 16".($lock ? ' FOR UPDATE' : ''));
    $documentId = $revision = 0;
    do {
        $select->execute([$documentId, $documentId, $revision]);
        $batch = $select->get_result();
        $hasRows = $batch->num_rows > 0;
        while ($row = $batch->fetch_assoc()) {
            $id = (int) $row['document_id'];
            $revision = (int) $row['revision'];
            if ($id !== $documentId) ++$stats['documents'];
            $documentId = $id;
            $body = $row['body'];
            unset($row['body']);
            try {
                $original = json_decode($body, false, 16, JSON_THROW_ON_ERROR);
                $validated = vz2_song_map_body($body);
                $isV1 = $original->schema_version === 1;
                $converted = $isV1 ? vz2_song_map_v2_body($validated) : $body;
                $map = json_decode($converted, false, 16, JSON_THROW_ON_ERROR);
                if ($isV1 && array_column($original->sections, 'name') !== array_column($map->sections, 'name')) {
                    throw new RuntimeException('Převod by změnil název sekce.');
                }
            } catch (Throwable $e) {
                throw new RuntimeException("Mapa #$id revize $revision: ".$e->getMessage(), 0, $e);
            }
            ++$stats['revisions'];
            ++$stats[$isV1 ? 'v1' : 'v2'];
            $stats['max_v2_bytes'] = max($stats['max_v2_bytes'], strlen($converted));
            foreach ($map->sections as $section) {
                ++$stats['sections'];
                foreach ($section->bars as $bar) {
                    ++$stats['bars'];
                    if ($bar->meter === null) ++$stats['unmetered_bars'];
                    if ($bar->unresolved_fill !== null) ++$stats['unresolved_fills'][$bar->unresolved_fill];
                }
            }
            $sourceHash = hash('sha256', $body);
            $targetHash = hash('sha256', $converted);
            $metadata = json_encode($row, JSON_THROW_ON_ERROR)."\n";
            hash_update($before, $metadata.$sourceHash."\n");
            hash_update($after, $metadata.$targetHash."\n");
            if ($details) echo json_encode(['document_id'=>$id, 'revision'=>$revision,
                'before'=>$sourceHash, 'after'=>$targetHash], JSON_THROW_ON_ERROR)."\n";
            if ($update && $isV1) {
                $update->execute([$converted, $id, $revision, $sourceHash]);
                if ($update->affected_rows !== 1) throw new RuntimeException("Mapa #$id revize $revision: změnil se zdroj.");
            }
        }
        $batch->free();
    } while ($hasRows);

    return ['target'=>$target, 'before_sha256'=>hash_final($before), 'after_sha256'=>hash_final($after)] + $stats;
}

try {
    $args = array_slice($argv, 1);
    $command = array_shift($args);
    $details = $args === ['--details'];
    $expected = $command === '--apply' && count($args) === 1 ? $args[0] : null;
    if (!(($command === '--check' && (!$args || $details))
        || (is_string($expected) && preg_match('/\A[0-9a-f]{64}\z/', $expected)))) {
        throw new RuntimeException('Použití: --check [--details] nebo --apply <before_sha256>.');
    }
    $host = getenv('VZ2_MAP_DB_HOST');
    $database = getenv('VZ2_MAP_DB_NAME');
    $login = getenv('VZ2_MAP_DB_USER');
    $password = getenv('VZ2_MAP_DB_PASSWORD');
    $port = filter_var(getenv('VZ2_MAP_DB_PORT'), FILTER_VALIDATE_INT, ['options'=>['min_range'=>1,'max_range'=>65535]]);
    if (!$host || !$database || !$login || $port === false || $password === false) {
        throw new RuntimeException('Zadejte výslovně VZ2_MAP_DB_HOST, _PORT, _NAME, _USER a _PASSWORD.');
    }

    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    try {
        $db = new mysqli($host, $login, $password, $database, $port);
    } catch (mysqli_sql_exception $e) {
        throw new RuntimeException('Připojení k výslovně zadané databázi selhalo ('.$e->getCode().').');
    }
    $db->set_charset('utf8mb4');
    $db->query("SET SESSION time_zone='+00:00'");
    $db->query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    $db->begin_transaction($expected ? MYSQLI_TRANS_START_READ_WRITE
        : MYSQLI_TRANS_START_READ_ONLY | MYSQLI_TRANS_START_WITH_CONSISTENT_SNAPSHOT);
    try {
        $target = migration_target($db);
        $plan = migration_scan($db, $target, $expected !== null, null, $details);
        if ($expected !== null) {
            if (!hash_equals($expected, $plan['before_sha256'])) throw new RuntimeException('Otisk vstupu se liší od schváleného plánu.');
            $applied = migration_scan($db, $target, true, migration_update_statement($db));
            $verified = migration_scan($db, $target, true);
            if ($applied !== $plan || $verified['v1'] !== 0 || $verified['before_sha256'] !== $plan['after_sha256']) {
                throw new RuntimeException('Ověření převedených revizí selhalo.');
            }
            $db->commit();
            $plan['updated'] = $applied['v1'];
        } else {
            $db->rollback();
        }
    } catch (Throwable $e) {
        $db->rollback();
        throw $e;
    }
    echo json_encode($plan, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)."\n";
} catch (Throwable $e) {
    fwrite(STDERR, $e->getMessage().PHP_EOL);
    exit(1);
}
