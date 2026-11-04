'use strict';
const assert = require('node:assert/strict');
module.exports = async ({ base, clients, request, good, db, check, migrate }) => {
    const song = await good('alice', { action: 'collection_create', kind: 'song', title: 'Skladba s tempy' });
    const empty = await good('admin', { action: 'collection_create', kind: 'song', title: 'Bez popisku' });
    const rehearsal = await good('admin', { action: 'collection_create', kind: 'rehearsal', title: 'Zkouška' });
    const read = async () => (await good('guest')).collections.find(row => Number(row.id) === song.id);
    const initial = await read();
    assert.deepEqual([initial.song_description, initial.song_tempos, initial.song_meters], ['', [], []]);
    const fields = { action: 'song_details_update', id: song.id, revision: 1, song_tempos: [120, 132.5, 120], song_meters: ['4/4', '3/4', '4/4'], song_description: 'Po refrénu zrychlit.\n<img src=x onerror=alert(1)> & další sloka.' };
    const saved = await good('alice', fields);
    assert.equal(saved.revision, 2);
    assert.deepEqual((await read()).song_tempos, fields.song_tempos);
    assert.deepEqual((await read()).song_meters, fields.song_meters);
    const beforeMigration = db('SELECT * FROM vz2_collections WHERE id=?', [song.id]);
    migrate();
    assert.deepEqual(db('SELECT * FROM vz2_collections WHERE id=?', [song.id]), beforeMigration);
    check(true, 'song details: ordered and repeated tempos/meters, Unicode, migration rerun preserves existing data');
    assert.equal((await request(clients.alice, 'php/ajax/vz2.php', fields)).status, 409);
    for (const who of ['guest', 'bob']) assert.equal((await request(clients[who], 'php/ajax/vz2.php', { ...fields, revision: 2 })).status, 403);
    assert.equal((await request(clients.alice, 'php/ajax/vz2.php', { ...fields, revision: 2 }, { noCsrf: true })).status, 403);
    assert.equal((await request(clients.anon, 'php/ajax/vz2.php', fields)).status, 401);
    assert.equal((await request(clients.admin, 'php/ajax/vz2.php', { ...fields, id: rehearsal.id })).status, 400);
    for (const invalid of [
        { song_tempos: [0] }, { song_tempos: [1000] }, { song_tempos: ['120'] }, { song_tempos: [120.123] },
        { song_tempos: Array(33).fill(120) }, { song_tempos: { a: 120 } },
        { song_meters: ['0/4'] }, { song_meters: ['4/3'] }, { song_meters: ['33/4'] }, { song_meters: [44] },
        { song_description: 'x'.repeat(10001) }
    ]) assert.equal((await request(clients.alice, 'php/ajax/vz2.php', { ...fields, revision: 2, ...invalid })).status, 400, JSON.stringify(invalid).slice(0, 80));
    assert.equal(Number((await read()).revision), 2, 'rejected writes do not change revision');
    check(true, 'song details: ownership, guest/anonymous/CSRF, stale revision, invalid values and wrong collection kind');
    await good('alice', { action: 'collection_rename', id: song.id, revision: 2, title: 'Skladba s tempy — nová' });
    assert.equal((await read()).song_description, fields.song_description, 'rename preserves metadata');
    await good('admin', { ...fields, revision: 3, song_description: '0' });
    assert.equal((await read()).song_description, '0');
    await good('admin', { action: 'song_details_update', id: song.id, revision: 4, song_description: '', song_tempos: [], song_meters: [] });
    assert.deepEqual([(await read()).song_description, (await read()).song_tempos, (await read()).song_meters], ['', [], []]);
    await good('admin', { ...fields, revision: 5 });
    const longDescription = '🎵'.repeat(10000);
    await good('admin', { ...fields, revision: 6, song_description: longDescription });
    assert.equal((await read()).song_description, longDescription, 'maximum Unicode description fits both data and activity logging');
    await good('admin', { ...fields, revision: 7 });
    const lyrics = await request(clients.admin, 'php/ajax/vz2_content.php', { action: 'document_save',
        collection_id: song.id, kind: 'lyrics_chords', document_id: null, current_revision: 0, title: 'Text', body: 'Text pouze pro jinou předvolbu.' });
    assert.equal(lyrics.status, 200, lyrics.text);
    const overview = (await request(clients.guest, 'php/ajax/vz2_overview.php')).json();
    const entry = overview.songs.find(s => s.id === song.id).entries.find(e => e.type === 'song_details');
    assert.deepEqual([entry.body, entry.tempos, entry.meters], [fields.song_description, fields.song_tempos, fields.song_meters]);
    assert(!overview.songs.find(s => s.id === empty.id).entries.some(e => e.type === 'song_details'));
    assert(db("SELECT id FROM vz2_activity_log WHERE action='song.details_updated' AND target_id=?", [song.id]).length >= 4);
    check(true, 'song details: rename preservation, admin edits, clearing optional fields, read-only overview and activity log');
    await require('./vz2_song_details.browser')({ base, clients, request, good, check, song, empty, rehearsal, read });
};
