'use strict';
const assert = require('node:assert/strict');

module.exports = async ({ clients, request, good, db, check }) => {
    const rehearsal = await good('admin', { action: 'collection_create', kind: 'rehearsal', title: 'Zkouška říjen' });
    const song = await good('admin', { action: 'collection_create', kind: 'song', title: 'Nová píseň' });
    const saveDocument = async (collection, kind, title, body) => {
        const response = await request(clients.admin, 'php/ajax/vz2_content.php', {
            action: 'document_save', collection_id: collection.id, kind, document_id: null,
            current_revision: 0, title, body
        });
        assert.equal(response.status, 200, response.text);
    };
    await saveDocument(rehearsal, 'lyrics_chords', 'Poznámky', 'Domluvit tempo a druhou sloku.');
    await saveDocument(rehearsal, 'rehearsal_starts', 'Začátky skladeb', 'Ručně dopsaný přehled začátků.');
    await saveDocument(song, 'lyrics_chords', 'Text', 'Am  G\nText písně');
    await saveDocument(song, 'song_map', 'Mapa skladby', JSON.stringify({ schema_version: 1, sections: [{
        id: 'a'.repeat(32), name: 'Refrén', bars: [{ id: 'b'.repeat(32), base: 'hihat', fill: 0,
            crash: false, special: null, detail: 'Hraj tiše.' }]
    }] }));

    const rehearsalRecording = 'test/overview-rehearsal-' + rehearsal.id;
    const songRecording = 'test/overview-song-' + song.id;
    db("INSERT INTO vz2_recordings(collection_id,kind,title,storage_dir,summary,summary_created_by,summary_created_at,summary_updated_by,summary_updated_at,lifecycle,created_by,updated_by,created_at,updated_at) VALUES (?,'single','Skrytá nahrávka',?,'Zrychlit refrén.',1,UTC_TIMESTAMP(),1,UTC_TIMESTAMP(),'active',1,1,UTC_TIMESTAMP(),UTC_TIMESTAMP())", [rehearsal.id, rehearsalRecording]);
    db("INSERT INTO vz2_recordings(collection_id,kind,title,storage_dir,lifecycle,created_by,updated_by,created_at,updated_at) VALUES (?,'single','Skrytý výstřižek',?,'active',1,1,UTC_TIMESTAMP(),UTC_TIMESTAMP())", [song.id, songRecording]);
    const rehearsalRecordingId = Number(db('SELECT id FROM vz2_recordings WHERE storage_dir=?', [rehearsalRecording])[0].id);
    const songRecordingId = Number(db('SELECT id FROM vz2_recordings WHERE storage_dir=?', [songRecording])[0].id);
    db("INSERT INTO vz2_timestamps(recording_id,kind,time_ms,body,created_by,updated_by,created_at,updated_at) VALUES (?,'note',83000,'Bicí později.',1,1,UTC_TIMESTAMP(),UTC_TIMESTAMP())", [rehearsalRecordingId]);
    db('INSERT INTO vz2_rehearsal_plays(rehearsal_collection_id,song_collection_id,rehearsal_title_snapshot,song_title_snapshot,clip_recording_id,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,1,1,UTC_TIMESTAMP(),UTC_TIMESTAMP())', [rehearsal.id,song.id,'Zkouška říjen','Nová píseň',songRecordingId]);
    db("UPDATE vz2_collections SET lifecycle='archived' WHERE id=?", [song.id]);
    const discussion = await request(clients.alice, 'php/ajax/vz2_content.php', { action: 'post_create', thread_id: Number(db('SELECT id FROM vz2_discussion_threads WHERE collection_id=?',[rehearsal.id])[0].id), body: 'Příště zkusit pomaleji.' });
    assert.equal(discussion.status, 200, discussion.text);

    const anonymous = await request(clients.anon, 'php/ajax/vz2_overview.php');
    check(anonymous.status === 401, 'overview data requires login');
    const page = await request(clients.guest, 'prehled.php');
    check(page.status === 200 && page.text.includes('id="overview-generate"') && page.text.includes('id="overview-output" hidden')
        && page.text.includes('data-filter="rehearsal_notes"') && page.text.includes('data-filter="song_map_details"')
        && page.text.includes('id="overview-collection-filters"')
        && page.text.includes('js/vz2-overview-filter.js') && page.text.includes('js/vz2-overview.js')
        && !page.text.includes('Zrychlit refrén.'), 'standalone page waits for a click before displaying data');
    const response = await request(clients.guest, 'php/ajax/vz2_overview.php');
    assert.equal(response.status, 200, response.text);
    const data = response.json();
    const foundRehearsal = data.rehearsals.find(item => item.id === rehearsal.id);
    const foundSong = data.songs.find(item => item.id === song.id);
    check(Boolean(foundRehearsal && foundSong), 'overview includes rehearsals and songs');
    check(foundRehearsal.entries.some(item => item.body === 'Domluvit tempo a druhou sloku.' && item.kind === 'lyrics_chords')
        && foundRehearsal.entries.some(item => item.body === 'Ručně dopsaný přehled začátků.')
        && foundRehearsal.entries.some(item => item.body === 'Zrychlit refrén.')
        && foundRehearsal.entries.some(item => item.body === 'Bicí později.' && item.time_ms === 83000)
        && foundRehearsal.entries.some(item => item.body === 'Příště zkusit pomaleji.'),
        'overview joins current documents, summaries, markers and discussion');
    check(foundSong.lifecycle === 'archived' && foundSong.entries.some(item => item.body.includes('Text písně'))
        && foundSong.entries.some(item => item.label === 'Mapa · Refrén' && item.body === '1 takt')
        && foundSong.entries.some(item => item.body === 'Hraj tiše.')
        && foundRehearsal.played_songs.some(item => item.id === song.id && item.count === 1),
        'overview includes archived song text, map notes and rehearsal song links');
    check(!response.text.includes('Skrytá nahrávka') && !response.text.includes('Skrytý výstřižek')
        && !response.text.includes('audio_files') && !response.text.includes('"url"'),
        'overview exposes no recording titles, audio files or media links');
    const deniedPost = await request(clients.guest, 'php/ajax/vz2_overview.php', { action: 'generate' });
    check(deniedPost.status === 405, 'overview endpoint is read only');
};
