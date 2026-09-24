'use strict';
const assert = require('node:assert/strict');
module.exports = async function ({ request, clients, db, good, upload, check, login }) {
    const collection = await good('alice', { action: 'collection_create', kind: 'rehearsal', title: 'Timestamp tests' });
    const uploaded = await upload('alice', collection.id, 'Česká nahrávka');
    assert.equal(uploaded.status, 201, uploaded.text);
    const id = uploaded.json().id, endpoint = 'php/ajax/vz2_timestamps.php';
    const read = (who = 'alice') => request(clients[who], endpoint + '?recording_id=' + id);
    const write = (who, fields, options) => request(clients[who], endpoint, { recording_id: id, ...fields }, options);
    const create = { action: 'create', timestamps_revision: 1, kind: 'song_start', time_ms: 0, body: 'Úvod' };
    let result = await read(); assert.equal(result.status, 200, result.text);
    check(result.json().timestamps_revision === 1 && result.json().can_create && !result.json().entries.length, 'timestamps start with an empty versioned list');
    check((await read('anon')).status === 401 && (await read('guest')).status === 200 && !(await read('guest')).json().can_create, 'timestamp list requires login; guest may read');
    check((await write('guest', create)).status === 403 && (await write('alice', create, { noCsrf: true })).status === 403, 'timestamp writes enforce member identity and CSRF');
    for (const time_ms of [-1, 0.1, true, null, '100', 1001, 604800001]) assert.equal((await write('alice', { ...create, time_ms })).status, 400);
    for (const body of ['', ' ', 'x'.repeat(4001)]) assert.equal((await write('alice', { ...create, body })).status, 400);
    assert.equal((await write('alice', { ...create, kind: 'invalid' })).status, 400);
    check(!db('SELECT id FROM vz2_timestamps WHERE recording_id=?', [id]).length, 'invalid milliseconds, kind, empty/overlong text do not mutate timestamps');
    result = await write('bob', { ...create, created_by: 1, updated_by: 1 });
    assert.equal(result.status, 201, result.text);
    let list = result.json(), row = list.entries[0];
    check(row.created_by === 3 && row.updated_by === 3 && row.author === 'Bob Nový' && list.timestamps_revision === 2, 'member adds to foreign recording; author comes from authenticated session');
    const update = { action: 'update', id: row.id, revision: row.revision, timestamps_revision: 2, kind: 'passage', time_ms: 123, body: 'Pasáž' };
    check((await write('alice', update)).status === 403 && (await write('alice', { ...update, action: 'delete' })).status === 403, 'recording owner cannot change or delete another author’s timestamp');
    check((await write('alice', create)).status === 409 && (await write('bob', { ...update, revision: 2 })).status === 409, 'stale list on create and stale row on update return conflict');
    check((await write('bob', { ...update, recording_id: id + 10000 })).status === 404, 'timestamp cannot be written through a different parent');
    const otherParent = db('SELECT id FROM vz2_recordings WHERE id<>? AND lifecycle=\'active\' LIMIT 1', [id])[0].id;
    assert.equal((await write('bob', { ...update, recording_id: otherParent })).status, 404);
    const before = db('SELECT revision,timestamps_revision FROM vz2_recordings WHERE id=?', [id])[0];
    result = await write('admin', update); assert.equal(result.status, 200, result.text); row = result.json().entries[0];
    check(row.created_by === 3 && row.updated_by === 1 && row.revision === 2 && result.json().timestamps_revision === 3
        && db('SELECT revision FROM vz2_recordings WHERE id=?', [id])[0].revision === before.revision, 'admin edit preserves creator; timestamp and recording revisions are independent');
    assert.equal((await write('bob', { ...update, revision: 2 })).status, 409);
    assert.equal((await write('bob', { ...update, action: 'delete', timestamps_revision: 3 })).status, 409);
    db("UPDATE vz2_recordings SET lifecycle='deleting' WHERE id=?", [id]);
    try { assert.equal((await write('bob', { ...update, revision: 2, timestamps_revision: 3 })).status, 409); }
    finally { db("UPDATE vz2_recordings SET lifecycle='active' WHERE id=?", [id]); }
    check((await read()).json().timestamps_revision === 3, 'foreign parent, stale update/delete and pending deletion leave timestamps untouched');
    const concurrent = await Promise.all(['alice', 'bob'].map(who => write(who, { ...create, timestamps_revision: 3, body: who })));
    assert.deepEqual(concurrent.map(r => r.status).sort(), [201, 409]);
    check((await read()).json().entries.length === 2, 'two clients with same list revision cannot silently overwrite each other');
    list = (await read()).json();
    result = await write('alice', { ...create, timestamps_revision: list.timestamps_revision, time_ms: 123, body: 'Ž'.repeat(4000) });
    assert.equal(result.status, 201, result.text); list = result.json();
    check(list.entries.filter(t => t.time_ms === 123).length === 2 && list.entries.at(-1).body.length === 4000
        && list.entries.every((r, i, a) => !i || a[i-1].time_ms <= r.time_ms), 'equal times allowed, stable ms/id order, Unicode length boundary accepted');
    const snapshot = JSON.stringify(list), logs = db("SELECT id FROM vz2_activity_log WHERE action LIKE 'timestamp.%'").length;
    db("CREATE TRIGGER reject_timestamp_audit BEFORE INSERT ON vz2_activity_log FOR EACH ROW BEGIN IF NEW.action LIKE 'timestamp.%' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test audit failure'; END IF; END");
    try { assert.equal((await write('alice', { ...create, timestamps_revision: list.timestamps_revision })).status, 500); }
    finally { db('DROP TRIGGER reject_timestamp_audit'); }
    check(JSON.stringify((await read()).json()) === snapshot && db("SELECT id FROM vz2_activity_log WHERE action LIKE 'timestamp.%'").length === logs, 'audit failure rolls back timestamp and parent revision atomically');
    let recording = db('SELECT * FROM vz2_recordings WHERE id=?', [id])[0];
    await good('alice', { action: 'recording_update', id, revision: recording.revision, title: 'Název\r\nX-Fake: header', summary: 'Samostatný souhrn' });
    const summary = db('SELECT * FROM vz2_recordings WHERE id=?', [id])[0];
    await good('admin', { action: 'recording_update', id, revision: summary.revision, title: summary.title, summary: summary.summary });
    recording = db('SELECT * FROM vz2_recordings WHERE id=?', [id])[0];
    check(recording.summary_created_by === 2 && recording.summary_updated_by === 2 && recording.timestamps_revision === list.timestamps_revision, 'summary has separate authorship and revision; title-only edit does not reattribute summary');
    await good('admin', { action: 'recording_update', id, revision: recording.revision, title: recording.title, summary: 'Souhrn upravil admin' });
    recording = db('SELECT * FROM vz2_recordings WHERE id=?', [id])[0];
    check(recording.summary_created_by === 2 && recording.summary_updated_by === 1, 'summary retains original author after admin edit');
    await good('alice', { action: 'remove_audio', id, revision: recording.revision, confirm: recording.title, request_key: require('node:crypto').randomBytes(16).toString('hex') });
    list = (await read()).json();
    result = await write('bob', { ...create, timestamps_revision: list.timestamps_revision, time_ms: 1000, kind: 'note', body: 'Na konci bez audia' });
    assert.equal(result.status, 201, result.text); list = result.json();
    check(list.duration_ms === 1000 && list.entries.length === 4, 'removed audio preserves list, length and ability to add timestamp at recording end');
    result = await request(clients.guest, endpoint + '?action=export&recording_id=' + id);
    check(result.status === 200 && result.headers.get('content-type').includes('text/plain') && result.text.includes('00:00:00.123 (123 ms)')
        && result.text.includes('Bob Nový') && result.text.includes('Souhrn upravil admin') && !result.headers.has('x-fake')
        && result.headers.get('content-disposition') === 'attachment; filename="nahravka-' + id + '-zapisy.txt"', 'UTF-8 export without audio includes identity, summary, milliseconds and author with safe filename');
    db('UPDATE users SET active=0 WHERE id=3');
    check((await write('bob', { ...create, timestamps_revision: list.timestamps_revision })).status === 401
        && (await read('admin')).json().entries.some(t => t.created_by === 3), 'deactivated author cannot write, existing authorship remains readable');
    db('UPDATE users SET active=1 WHERE id=3'); await login('bob');
    result = await write('admin', { action: 'delete', id: row.id, revision: row.revision, timestamps_revision: list.timestamps_revision });
    assert.equal(result.status, 200, result.text); list = result.json();
    check(!list.entries.some(t => t.id === row.id) && db("SELECT id FROM vz2_activity_log WHERE action='timestamp.deleted' AND target_id=?", [row.id]).length === 1, 'admin delete increments list revision and retains audit');
    db('UPDATE vz2_recordings SET duration_ms=NULL WHERE id=?', [id]);
    result = await write('alice', { ...create, timestamps_revision: list.timestamps_revision, time_ms: 604800000 });
    check(result.status === 201 && result.json().duration_ms === null, 'unknown duration permits seven-day boundary without inventing recording length');
    list = result.json(); const own = list.entries.at(-1);
    result = await write('alice', { action: 'update', id: own.id, revision: own.revision, timestamps_revision: list.timestamps_revision, kind: 'note', time_ms: own.time_ms, body: 'Vlastní úprava' });
    assert.equal(result.status, 200, result.text); list = result.json();
    result = await write('alice', { action: 'delete', id: own.id, revision: 2, timestamps_revision: list.timestamps_revision });
    check(result.status === 200 && !result.json().entries.some(t => t.id === own.id), 'member can edit and delete own timestamp after audio removal');
    const c = db('SELECT * FROM vz2_collections WHERE id=?', [collection.id])[0];
    await good('admin', { action: 'delete_collection', id: c.id, revision: c.revision, confirm: c.title, request_key: require('node:crypto').randomBytes(16).toString('hex') });
    check((await read('admin')).status === 404 && db("SELECT id FROM vz2_activity_log WHERE action='timestamp.deleted' AND target_id=?", [row.id]).length === 1, 'full deletion removes timestamp data but preserves its audit');
};
