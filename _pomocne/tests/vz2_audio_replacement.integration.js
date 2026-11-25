'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

module.exports = async ({ clients, request, good, upload, wav, db, media, check, ...browserContext }) => {
    const endpoint = 'php/ajax/vz2.php', timestamps = 'php/ajax/vz2_timestamps.php';
    const collection = await good('alice', { action: 'collection_create', kind: 'song', title: 'Výměna audia' });
    const result = await upload('alice', collection.id, 'Popisek zůstává', 'single', ['original.wav'], [wav(10)]);
    assert.equal(result.status, 201, result.text);
    const id = result.json().id;
    const catalog = async () => (await request(clients.alice, endpoint)).json();
    const recording = async (recordingId = id) => (await catalog()).recordings.find(r => Number(r.id) === recordingId);
    const list = async () => (await request(clients.alice, timestamps + '?recording_id=' + id)).json();
    let r = await recording();
    const fileId = r.files[0].id, oldPath = db('SELECT relative_path FROM vz2_audio_files WHERE id=?', [fileId])[0].relative_path;
    const prepare = async (r, seconds, who = 'alice', file = r.files[0], extra = {}) => {
        const fields = new FormData();
        for (const [key, value] of Object.entries({ action: 'prepare_audio_replacement', id: r.id, file_id: file.id, revision: r.revision, ...extra })) fields.append(key, value);
        fields.append('file', new Blob([wav(seconds)], { type: 'audio/wav' }), 'new-export.wav');
        return request(clients[who], endpoint, fields);
    };
    let ts = await list();
    const interval = await request(clients.alice, timestamps, { action: 'save_interval', recording_id: id, timestamps_revision: ts.timestamps_revision,
        kind: 'song_start', time_ms: 1000, end_time_ms: 9000, body: 'Záběr' });
    assert.equal(interval.status, 201, interval.text);
    ts = interval.json();
    const noteResult = await request(clients.alice, timestamps, { action: 'create', recording_id: id, timestamps_revision: ts.timestamps_revision,
        kind: 'note', time_ms: 8000, body: 'Poznámka za novým koncem' });
    assert.equal(noteResult.status, 201, noteResult.text);
    ts = noteResult.json(); const beforeEntries = ts.entries;
    assert.equal((await prepare(r, 5, 'bob')).status, 403);
    assert.equal((await prepare(r, 5, 'guest')).status, 403);
    let response = await prepare(r, 5); assert.equal(response.status, 200, response.text);
    let prepared = response.json();
    assert.equal(prepared.old_duration_ms, 10000); assert.equal(prepared.new_duration_ms, 5000);
    assert.equal(prepared.recording_duration_ms, 5000); assert.equal(prepared.outside_count, 2); assert.equal(prepared.overlap_count, 1);
    assert.deepEqual((await recording()).files, r.files, 'preparation leaves the original live');
    assert(fs.existsSync(path.join(media, oldPath)));
    const noCsrf = await request(clients.alice, endpoint, { action: 'replace_audio', token: prepared.token }, { noCsrf: true });
    assert.equal(noCsrf.status, 403);
    assert.equal((await request(clients.bob, endpoint, { action: 'replace_audio', token: prepared.token })).status, 403);
    check(true, 'replacement: owner/guest/CSRF checks and server duration warning before any change');

    // Copy succeeds, but a failed audit rolls the pointer and metadata back.
    db("CREATE TRIGGER reject_replace_audit BEFORE INSERT ON vz2_activity_log FOR EACH ROW BEGIN IF NEW.action='audio.replaced' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='test'; END IF; END");
    try { response = await request(clients.alice, endpoint, { action: 'replace_audio', token: prepared.token }); assert.equal(response.status, 500, response.text); }
    finally { db('DROP TRIGGER reject_replace_audit'); }
    assert.equal((await recording()).files[0].sha256, r.files[0].sha256);
    assert(fs.existsSync(path.join(media, oldPath)));
    const op = db('SELECT * FROM vz2_file_operations WHERE request_key=?', [prepared.token])[0];
    const completed = await good('alice', { action: 'retry', operation_id: op.id });
    await good('alice', { action: 'retry', operation_id: op.id });
    await good('alice', { action: 'replace_audio', token: prepared.token });
    assert(completed.completed);
    r = await recording(); assert.equal(r.files[0].id, fileId); assert.equal(Number(r.duration_ms), 5000);
    assert.equal(r.title, 'Popisek zůstává'); assert.equal(r.files[0].title, 'original'); assert.equal(r.files[0].original_name, 'new-export.wav');
    assert(!fs.existsSync(path.join(media, oldPath)));
    assert.equal(db("SELECT id FROM vz2_activity_log WHERE action='audio.replaced' AND operation_id=?", [op.id]).length, 1);
    ts = await list(); assert.deepEqual(ts.entries, beforeEntries);
    assert.equal(ts.annotations.find(a => a.kind === 'take').end_ms, 9000);
    assert.equal(ts.annotations.find(a => a.kind === 'take').truncated, true);
    assert.equal(ts.annotations.find(a => a.kind === 'note').out_of_range, true);
    check(true, 'replacement: failed audit preserves original; retry switches once, cleans old bytes and keeps all timestamps');

    const note = ts.entries.find(e => e.kind === 'note');
    response = await request(clients.alice, timestamps, { action: 'update', recording_id: id, timestamps_revision: ts.timestamps_revision,
        id: note.id, revision: note.revision, kind: 'note', time_ms: note.time_ms, body: 'Upravená poznámka za koncem' });
    assert.equal(response.status, 200, response.text);
    ts = response.json();
    response = await request(clients.alice, timestamps, { action: 'create', recording_id: id, timestamps_revision: ts.timestamps_revision,
        kind: 'note', time_ms: 2000, body: 'Nová poznámka uvnitř' });
    assert.equal(response.status, 201, response.text);
    check(true, 'replacement: out-of-range entries allow text edits and do not block new timestamps inside audio');

    // A cancelled preview is cleaned, and an outdated preview cannot overwrite edits.
    prepared = (await prepare(r, 6)).json();
    await good('alice', { action: 'discard_audio_replacement', token: prepared.token });
    assert(!fs.existsSync(path.join(media, '.staging', prepared.token, 'audio.wav')));
    assert.equal((await request(clients.alice, endpoint, { action: 'replace_audio', token: prepared.token })).status, 404);
    prepared = (await prepare(r, 6)).json();
    await good('alice', { action: 'track_update', id, file_id: fileId, revision: r.revision, title: 'Kytara' });
    assert.equal((await request(clients.alice, endpoint, { action: 'replace_audio', token: prepared.token })).status, 409);
    await good('alice', { action: 'discard_audio_replacement', token: prepared.token });
    r = await recording();
    // A cleanup failure after the committed switch must not roll it back or
    // increment metadata again when the operation is resumed.
    prepared = (await prepare(r, 6)).json();
    const cleanupPath = path.join(media, db('SELECT relative_path FROM vz2_audio_files WHERE id=?', [fileId])[0].relative_path);
    fs.renameSync(cleanupPath, cleanupPath + '.held'); fs.mkdirSync(cleanupPath);
    response = await request(clients.alice, endpoint, { action: 'replace_audio', token: prepared.token });
    assert.equal(response.status, 409, response.text);
    const switched = await recording(); assert.equal(switched.files[0].duration_ms, 6000);
    fs.rmdirSync(cleanupPath); fs.renameSync(cleanupPath + '.held', cleanupPath);
    await good('alice', { action: 'replace_audio', token: prepared.token });
    r = await recording(); assert.equal(r.revision, switched.revision);
    check(true, 'replacement: cleanup failure keeps new audio available; retry does not apply metadata twice');
    await good('alice', { action: 'remove_audio', id, revision: r.revision, confirm: r.title, request_key: crypto.randomBytes(16).toString('hex') });
    r = await recording(); assert.equal(r.files[0].state, 'deleted');
    prepared = (await prepare(r, 12)).json();
    await good('alice', { action: 'replace_audio', token: prepared.token });
    r = await recording(); ts = await list();
    assert.equal(r.files[0].id, fileId); assert.equal(r.files[0].state, 'available'); assert.equal(r.files[0].deleted_at, null);
    assert.equal(r.files[0].title, 'Kytara'); assert.equal(Number(r.duration_ms), 12000);
    assert(ts.annotations.every(a => !a.out_of_range && !a.truncated));
    check(true, 'replacement: cancel removes staging, stale confirmation conflicts, deleted audio restored and longer audio reactivates timestamps');

    response = await upload('alice', collection.id, '', 'multitrack', ['left.wav', 'right.wav'], [wav(10), wav(10)]);
    assert.equal(response.status, 201, response.text); let mix = await recording(response.json().id);
    prepared = (await prepare(mix, 3)).json(); assert.equal(prepared.recording_duration_ms, 10000);
    await good('alice', { action: 'replace_audio', token: prepared.token }); mix = await recording(Number(mix.id));
    assert.equal(Number(mix.duration_ms), 10000); assert.equal(mix.files[0].duration_ms, 3000); assert.equal(mix.files[1].duration_ms, 10000);
    check(true, 'replacement: replacing one multitrack track preserves the other IDs and uses the maximum track duration');
    if (process.env.VZ2_TEST_BROWSER === 'replacement') await require('./vz2_audio_replacement.browser')({ clients, request, good, upload, wav, db, media, check, ...browserContext, id, collection, mixId: Number(mix.id) });
};
