'use strict';
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

module.exports = async function ({ base, clients, request, good, upload, wav, db, check, browser = false }) {
    const endpoint = 'php/ajax/vz2_history.php';
    const read = async (who = 'admin') => {
        const r = await request(clients[who], endpoint); assert.equal(r.status, 200, r.text); return r.json();
    };
    const save = async fields => {
        const r = await request(clients.admin, endpoint, fields); assert.equal(r.status, 200, r.text); return r.json();
    };
    const song = await good('admin', { action: 'collection_create', kind: 'song', title: 'Historie – skladba' });
    const otherSong = await good('admin', { action: 'collection_create', kind: 'song', title: 'Jiná skladba historie' });
    const rehearsal = await good('admin', { action: 'collection_create', kind: 'rehearsal', title: 'Historie – zkouška' });
    const otherRehearsal = await good('admin', { action: 'collection_create', kind: 'rehearsal', title: 'Jiná zkouška historie' });
    async function audio(collection, name) {
        const r = await upload('admin', collection.id, 'Popisek ' + name, 'single', [name], [wav(10)]);
        assert.equal(r.status, 201, r.text); return r.json().id;
    }
    const source = await audio(rehearsal, 'cela-zkouska.wav');
    const clip = await audio(song, 'vystrizek.wav');
    const directClip = await audio(song, 'samostatny-pokus.wav');
    const foreignClip = await audio(otherSong, 'jina-skladba.wav');
    async function stamp(kind, time_ms, body, extra = {}) {
        const list = (await request(clients.admin, 'php/ajax/vz2_timestamps.php?recording_id=' + source)).json();
        const r = await request(clients.admin, 'php/ajax/vz2_timestamps.php', { action: 'create', recording_id: source, timestamps_revision: list.timestamps_revision, kind, time_ms, body, ...extra });
        assert.equal(r.status, 201, r.text); return r.json().entries.find(t => t.body === body);
    }
    const start = await stamp('song_start', 1000, 'Začátek pokusu');
    const end = await stamp('song_end', 4000, 'Konec pokusu', { paired_timestamp_id: start.id });
    await stamp('note', 1000, 'Poznámka na začátku');
    await stamp('note', 2500, 'Poznámka uvnitř');
    await stamp('passage', 3000, 'Označená pasáž');
    await stamp('note', 4000, 'Poznámka za úsekem');
    const create = { action: 'create', song_collection_id: song.id, rehearsal_collection_id: rehearsal.id, source_recording_id: source, start_timestamp_id: start.id, end_timestamp_id: end.id, clip_recording_id: null };
    let data = await read();
    assert(data.unassigned_intervals.some(i => i.start_timestamp_id === start.id && i.recording_title === 'cela-zkouska.wav'));
    assert(data.unassigned_clips.some(c => c.id === clip && c.title === 'vystrizek.wav'));
    assert.equal((await request(clients.anon, endpoint)).status, 401);
    assert.equal((await read('guest')).can_edit, false);
    assert.equal((await request(clients.guest, endpoint, create)).status, 403);
    assert.equal((await request(clients.admin, endpoint, create, { noCsrf: true })).status, 403);
    assert.equal((await request(clients.admin, endpoint, { ...create, rehearsal_collection_id: otherRehearsal.id })).status, 400);
    assert.equal((await request(clients.admin, endpoint, { ...create, clip_recording_id: foreignClip })).status, 400);
    check(true, 'history: existing paired intervals and clips are offered; login, permissions, CSRF and collection links are enforced');
    data = await save(create);
    let play = data.plays.find(p => p.source_recording_id === source);
    assert.deepEqual([play.start_ms, play.end_ms], [1000, 4000]);
    assert.deepEqual(play.notes.map(n => n.body), ['Poznámka na začátku', 'Poznámka uvnitř']);
    assert(!data.unassigned_intervals.some(i => i.start_timestamp_id === start.id));
    data = await save({ ...create, action: 'update', id: play.id, revision: play.revision, clip_recording_id: clip });
    play = data.plays.find(p => p.id === play.id);
    assert.equal(play.source.files[0].original_name, 'cela-zkouska.wav');
    assert.equal(play.clip.files[0].original_name, 'vystrizek.wav');
    assert(!data.unassigned_clips.some(c => c.id === clip));
    for (const file of [play.source.files[0], play.clip.files[0]]) {
        const r = await request(clients.admin, file.url, undefined, { headers: { Range: 'bytes=0-43' } });
        assert.equal(r.status, 206, r.text); assert.equal(r.buffer.subarray(0, 4).toString(), 'RIFF');
    }
    const list = (await request(clients.admin, 'php/ajax/vz2_timestamps.php?recording_id=' + source)).json();
    assert.equal(list.entries.find(t => t.id === start.id).history_song_title, 'Historie – skladba');
    assert.equal((await request(clients.admin, 'php/ajax/vz2_timestamps.php', { action: 'delete', recording_id: source, id: start.id, revision: start.revision, timestamps_revision: list.timestamps_revision })).status, 409);
    const exportResponse = await request(clients.admin, 'php/ajax/vz2_timestamps.php?recording_id=' + source + '&action=song_intervals');
    assert.equal(exportResponse.status, 200);
    assert(exportResponse.text.includes('Historie – skladba'));
    assert(exportResponse.text.includes('00:01'));
    // The timestamp list retains both the marked passage and the named history link.
    assert(list.entries.some(t => t.kind === 'passage' && t.body === 'Označená pasáž'));
    check(true, 'history: source, linked start/end, notes and clip resolve to real audio; used boundary cannot be deleted');
    const before = db('SELECT id FROM vz2_timestamps WHERE recording_id=? ORDER BY id', [source]);
    data = await save({ action: 'delete', id: play.id, revision: play.revision });
    assert.deepEqual(db('SELECT id FROM vz2_timestamps WHERE recording_id=? ORDER BY id', [source]), before);
    assert(data.unassigned_intervals.some(i => i.start_timestamp_id === start.id));
    assert(data.unassigned_clips.some(c => c.id === clip));
    check(true, 'history: deleting a play releases its interval and clip without deleting audio or any marked passages');
    if (browser) {
        await require('./vz2_history.browser')({ base, clients, request, check, song, rehearsal, source, clip, directClip, start, end });
    } else {
        await save({ ...create, clip_recording_id: clip });
        await save({ ...create, source_recording_id: null, start_timestamp_id: null, end_timestamp_id: null, clip_recording_id: directClip });
    }
    data = await read();
    assert.equal(data.plays.filter(p => p.song_collection_id === song.id && p.rehearsal_collection_id === rehearsal.id).length, 2);
    const recording = db('SELECT * FROM vz2_recordings WHERE id=?', [source])[0];
    await good('admin', { action: 'remove_audio', id: source, revision: recording.revision, confirm: recording.title, request_key: crypto.randomBytes(16).toString('hex') });
    data = await read();
    play = data.plays.find(p => p.source_recording_id === source);
    assert.equal(play.source.audio_state, 'deleted'); assert.equal(play.source.files[0].url, null);
    assert(play.clip.files[0].url); assert.equal(play.notes.length, 2);
    const c = db('SELECT * FROM vz2_collections WHERE id=?', [song.id])[0];
    const result = await good('admin', { action: 'delete_collection', id: song.id, revision: c.revision, confirm: c.title, request_key: crypto.randomBytes(16).toString('hex') });
    assert.equal(result.archived, true);
    data = await read();
    assert(data.songs.some(s => s.id === song.id && s.lifecycle === 'archived'));
    assert.equal(data.plays.filter(p => p.song_collection_id === song.id).length, 2);
    const archivedFile = data.plays.find(p => p.clip_recording_id === clip).clip.files[0];
    for (const who of ['admin', 'guest']) {
        const streamed = await request(clients[who], archivedFile.url, undefined, { headers: { Range: 'bytes=0-43' } });
        assert.equal(streamed.status, 206, streamed.text);
        assert.equal(streamed.buffer.subarray(0, 4).toString(), 'RIFF');
    }
    assert.equal((await request(clients.anon, archivedFile.url)).status, 401);
    db("UPDATE vz2_collections SET lifecycle='deleting' WHERE id=?", [song.id]);
    try { assert.equal((await request(clients.admin, archivedFile.url)).status, 410); }
    finally { db("UPDATE vz2_collections SET lifecycle='archived' WHERE id=?", [song.id]); }
    check(true, 'history: multiple attempts, deleted source audio and archived songs retain history, notes and playable clips');
};
