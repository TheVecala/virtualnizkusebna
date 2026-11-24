'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const path = require('node:path');

module.exports = async ({ request, clients, db, good, check, database, dbPort, php, root }) => {
    assert.match(database, /^vz2_test_[a-f0-9]{12}$/);
    const env = { ...process.env,
        VZ2_MAP_DB_HOST: '127.0.0.1', VZ2_MAP_DB_PORT: String(dbPort), VZ2_MAP_DB_NAME: database,
        VZ2_MAP_DB_USER: 'root', VZ2_MAP_DB_PASSWORD: process.env.VZ2_TEST_DB_PASS || ''
    };
    const run = (...args) => spawnSync(php, [path.join(root, '_pomocne/tools/vz2_song_map_migrate.php'), ...args], {
        env, encoding: 'utf8', timeout: 30000
    });
    const report = (...args) => {
        const result = run(...args);
        assert.equal(result.status, 0, result.stderr || String(result.error));
        return result.stdout.trim().split('\n').map(line => JSON.parse(line));
    };
    const refuse = (pattern, ...args) => {
        const result = run(...args);
        assert.equal(result.status, 1, result.stderr || String(result.error));
        assert.match(result.stderr, pattern);
    };

    const archived = await good('admin', { action: 'collection_create', kind: 'song', title: 'Před převodem — archiv' });
    const active = await good('admin', { action: 'collection_create', kind: 'song', title: 'Před převodem — aktivní' });
    db("UPDATE vz2_collections SET lifecycle='archived' WHERE id=?", [archived.id]);
    const insert = (song, kind, bodies) => {
        const id = db('INSERT INTO vz2_documents(collection_id,kind,title,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,1,2,?,?)',
            [song.id, kind, kind, '2024-01-01', '2024-01-02']).id;
        bodies.forEach((body, index) => db('INSERT INTO vz2_document_versions(document_id,revision,body,created_by,created_at) VALUES (?,?,?,?,?)',
            [id, index + 1, body, 1 + index, '2024-01-02']));
        db('UPDATE vz2_documents SET current_revision=? WHERE id=?', [bodies.length, id]);
        return id;
    };
    const id = number => number.toString(16).padStart(32, '0');
    const shapes = [
        ['hihat', 0, true, null], ['ride', 0, true, null],
        ['hihat', 0, false, null], ['ride', 0, false, null],
        ['hihat', 1, false, null], ['hihat', 2, false, null], ['hihat', 3, false, null],
        ['ride', 1, false, null], ['ride', 2, false, null], ['ride', 3, false, null],
        [null, 4, false, null], [null, 0, false, 'unknown'], [null, 0, false, 'pause'], [null, 0, false, 'stop']
    ];
    const legacy = { schema_version: 1, sections: [{ id: id(100), name: 'Část / sloka', bars:
        shapes.map(([base, fill, crash, special], index) => ({
            id: id(index + 1), base, fill, crash, special, detail: '  řádek\r\n🎵 <text> / ' + index + '\n'
        }))
    }] };
    const original = JSON.stringify(legacy, null, 2);
    const emptyV1 = '{"schema_version":1,"sections":[]}';
    const modern = '{ "schema_version": 2, "sections": [] }';
    const archivedId = insert(archived, 'song_map', [original, emptyV1]);
    const activeId = insert(active, 'song_map', [emptyV1, modern]);
    insert(active, 'tablature', ['  nedotčená revize \n']);
    const readAll = () => db('SELECT * FROM vz2_document_versions ORDER BY document_id,revision');
    const before = readAll();
    const documents = db('SELECT * FROM vz2_documents ORDER BY id');
    const reports = report('--check', '--details');
    const plan = reports.at(-1);
    assert.equal(reports.length, 5);
    assert.equal(plan.documents, 2);
    assert.equal(plan.v1, 3);
    assert.equal(plan.v2, 1);
    assert.equal(plan.unmetered_bars, 14);
    assert.deepEqual(plan.unresolved_fills, { 1: 2, 2: 2, 3: 2, 4: 1 });
    assert.deepEqual(readAll(), before);
    refuse(/Otisk vstupu/, '--apply', '0'.repeat(64));
    assert.deepEqual(readAll(), before);
    db('UPDATE vz2_document_versions SET body=? WHERE document_id=? AND revision=1', ['{broken', activeId]);
    refuse(new RegExp('Mapa #' + activeId + ' revize 1'), '--check');
    db('UPDATE vz2_document_versions SET body=? WHERE document_id=? AND revision=1', [emptyV1, activeId]);
    const nearLimit = { schema_version: 1, sections: [{ id: id(200), name: 'Limit',
        bars: Array.from({ length: 100 }, (_, index) => ({
            id: id(index + 1), base: 'hihat', fill: 0, crash: false, special: null, detail: 'x'.repeat(10000)
        })) }] };
    const available = 1048570 - Buffer.byteLength(JSON.stringify(nearLimit));
    nearLimit.sections[0].bars[0].detail += 'x'.repeat(available);
    const nearLimitBody = JSON.stringify(nearLimit);
    assert.equal(Buffer.byteLength(nearLimitBody), 1048570);
    db('UPDATE vz2_document_versions SET body=? WHERE document_id=? AND revision=1', [nearLimitBody, activeId]);
    try {
        refuse(/1 MiB/, '--check');
        assert.equal(db('SELECT SHA2(CAST(body AS BINARY),256) AS digest FROM vz2_document_versions WHERE document_id=? AND revision=1', [activeId])[0].digest,
            createHash('sha256').update(nearLimitBody).digest('hex'));
    } finally {
        db('UPDATE vz2_document_versions SET body=? WHERE document_id=? AND revision=1', [emptyV1, activeId]);
    }
    check(true, 'map migration: read-only inventory, invalid or oversized source and mismatched fingerprint stop');

    const dumpTool = process.env.VZ2_TEST_MARIADB_DUMP;
    const clientTool = process.env.VZ2_TEST_MARIADB_CLIENT;
    if (dumpTool && clientTool) {
        const connection = ['--no-defaults', '--protocol=TCP', '--host=127.0.0.1', '--port=' + dbPort, '--user=root'];
        const toolEnv = { ...process.env, MYSQL_PWD: env.VZ2_MAP_DB_PASSWORD };
        const exec = (file, args, input) => {
            const result = spawnSync(file, [...connection, ...args], { input, env: toolEnv, maxBuffer: 16 * 1024 * 1024 });
            assert.equal(result.status, 0, result.stderr?.toString() || String(result.error));
            return result.stdout;
        };
        const copy = database + '_restore';
        const backup = exec(dumpTool, ['--single-transaction', '--default-character-set=utf8mb4', database]);
        db('CREATE DATABASE ' + copy + ' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        try {
            exec(clientTool, ['--database=' + copy, '--default-character-set=utf8mb4'], backup);
            const result = spawnSync(php, [path.join(root, '_pomocne/tools/vz2_song_map_migrate.php'), '--check', '--details'],
                { env: { ...env, VZ2_MAP_DB_NAME: copy }, encoding: 'utf8', timeout: 30000 });
            assert.equal(result.status, 0, result.stderr || String(result.error));
            const restoredReport = result.stdout.trim().split('\n').map(line => JSON.parse(line));
            assert.deepEqual(restoredReport.slice(0, -1), reports.slice(0, -1));
            assert.equal(restoredReport.at(-1).revisions, plan.revisions);
        } finally {
            db('DROP DATABASE ' + copy);
        }
        check(true, 'map migration: MariaDB backup restored in a different database with matching revision hashes');
    }

    // A valid source that rejects part of the write must roll back preceding updates.
    db(`ALTER TABLE vz2_document_versions ADD CONSTRAINT test_reject_conversion
        CHECK (document_id <> ${activeId} OR revision <> 1 OR body NOT LIKE '%"schema_version":2%')`);
    try {
        refuse(/test_reject_conversion/, '--apply', plan.before_sha256);
        assert.deepEqual(readAll(), before);
    } finally {
        db('ALTER TABLE vz2_document_versions DROP CONSTRAINT test_reject_conversion');
    }
    check(true, 'map migration: failure after earlier writes rolls back the entire transaction');

    const [applied] = report('--apply', plan.before_sha256);
    assert.equal(applied.updated, 3);
    const rows = readAll();
    assert.deepEqual(rows.map(({ body, ...row }) => row), before.map(({ body, ...row }) => row));
    assert.deepEqual(db('SELECT * FROM vz2_documents ORDER BY id'), documents);
    const history = rows.filter(row => row.document_id === archivedId);
    assert.equal(history.length, 2);
    const migrated = JSON.parse(history[0].body);
    assert.equal(migrated.schema_version, 2);
    assert.equal(migrated.sections[0].id, legacy.sections[0].id);
    assert.equal(migrated.sections[0].name, legacy.sections[0].name);
    assert.deepEqual(migrated.sections[0].bars, legacy.sections[0].bars.map(bar => ({
        id: bar.id, kind: bar.special ?? 'rhythm', base: bar.base, meter: null,
        marks: bar.crash ? [{ unit: 1, state: null, crash: true }] : [],
        unresolved_fill: bar.fill || null, detail: bar.detail
    })));
    assert.equal(history[1].body, '{"schema_version":2,"sections":[]}');
    assert.equal(rows.find(row => row.document_id === activeId && row.revision === 2).body, modern);
    assert.equal(rows.at(-1).body, before.at(-1).body);
    const [verified] = report('--check');
    assert.equal(verified.v1, 0);
    assert.equal(verified.before_sha256, plan.after_sha256);
    const [retried] = report('--apply', verified.before_sha256);
    assert.equal(retried.updated, 0);
    const restored = await request(clients.admin, 'php/ajax/vz2_content.php', {
        action: 'document_restore', collection_id: active.id, kind: 'song_map',
        document_id: activeId, current_revision: 2, source_revision: 1
    });
    assert.equal(restored.status, 200, restored.text);
    assert.equal(JSON.parse(restored.json().version.body).schema_version, 2);
    check(true, 'map migration: all 14 types, archived history, exact details and metadata, untouched V2 and tablature, safe retry and HTTP restore');
};
