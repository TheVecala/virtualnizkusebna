'use strict';
const assert = require('node:assert/strict');

module.exports = async ({ clients, request, good, upload, wav, db, check }) => {
    const song = await good('alice', { action: 'collection_create', kind: 'song', title: 'Hraní <zkouška> & akordy' });
    const empty = await good('alice', { action: 'collection_create', kind: 'song', title: 'Prázdná skladba' });
    const rehearsal = await good('alice', { action: 'collection_create', kind: 'rehearsal', title: 'Nezobrazovat zkoušku' });
    const deleting = await good('alice', { action: 'collection_create', kind: 'song', title: 'Probíhá mazání' });
    db("UPDATE vz2_collections SET lifecycle='deleting' WHERE id=?", [deleting.id]);
    const order = (await good('alice')).orders.find(row => row.kind === 'song');
    await good('alice', { action: 'reorder', scope: 'collections', kind: 'song', revision: Number(order.revision), ids: [empty.id, song.id] });
    const first = await request(clients.alice, 'php/ajax/vz2_content.php', { action: 'document_save', collection_id: song.id,
        kind: 'lyrics_chords', document_id: null, current_revision: 0, title: 'Akordy', body: 'Starší text' });
    assert.equal(first.status, 200, first.text);
    const saved = first.json();
    const revised = await request(clients.alice, 'php/ajax/vz2_content.php', { action: 'document_save', collection_id: song.id,
        kind: 'lyrics_chords', document_id: saved.document.id, current_revision: 1, title: 'Akordy', body: 'Am   F\nAktuální text <bez HTML>' });
    assert.equal(revised.status, 200, revised.text);
    assert.equal((await request(clients.alice, 'php/ajax/vz2_content.php', { action: 'post_create', collection_id: song.id, body: 'Poznámka pro hraní' })).status, 200);
    assert.equal((await upload('alice', song.id, 'Sólo')).status, 201);
    assert.equal((await upload('alice', song.id, 'Mix', 'multitrack', ['kytara.wav', 'basa.wav'], [wav(), wav()])).status, 201);
    assert.equal((await upload('alice', song.id, 'Příloha', 'attachment', ['poznamky.txt'], [Buffer.from('Podklad')])).status, 201);
    const before = db('SELECT COUNT(*) n FROM vz2_activity_log')[0].n;
    const catalog = response => JSON.parse(response.text.match(/id="song-data">([\s\S]*?)<\/script>/)[1]);
    for (const role of ['admin', 'alice', 'guest']) {
        const page = await request(clients[role], 'hrani.php');
        assert.equal(page.status, 200, page.text);
        const rows = catalog(page);
        assert.deepEqual(rows.map(row => row.id), [String(empty.id), String(song.id)]);
        assert.deepEqual([rows[1].hasText, rows[1].hasTab, rows[1].recordings, rows[1].documents], [true, false, 2, 1]);
        const response = await request(clients[role], `hrani.php?data=1&song=${song.id}`);
        assert.equal(response.status, 200, response.text);
        const detail = response.json();
        assert.equal(detail.text, 'Am   F\nAktuální text <bez HTML>');
        assert.equal(detail.tab, '');
        assert.equal(detail.notes.items[0].text, 'Poznámka pro hraní');
        const single = detail.files.find(file => file.name === 'Sólo');
        assert.match(single.url, /^php\/ajax\/vz2_files\.php\?type=audio&/);
        assert.equal((await request(clients[role], single.url)).status, 200);
        assert.match(detail.files.find(file => file.name === 'Mix').openUrl, /view=mixer$/);
        assert.match(detail.files.find(file => !file.audio).url, /^php\/ajax\/vz2_files\.php\?type=attachment&/);
        assert.equal((await request(clients[role], `hrani.php?data=1&song=${rehearsal.id}`)).status, 404);
        assert.equal((await request(clients[role], `hrani.php?data=1&song=${deleting.id}`)).status, 404);
    }
    check(true, 'playing view: beta catalog order, active songs only, current documents, notes, protected media and mixer links for all roles');
    assert.equal((await request(clients.anon, 'hrani.php')).status, 302);
    assert.equal((await request(clients.anon, `hrani.php?data=1&song=${song.id}`)).status, 401);
    assert.equal((await request(clients.guest, 'hrani.php?data=1&song=../etc')).status, 400);
    assert.equal((await request(clients.guest, 'hrani.php?data=1&song=4294967295')).status, 404);
    assert.equal((await request(clients.alice, 'hrani.php?data=1', { action: 'delete_collection', id: song.id })).status, 405);
    const blank = (await request(clients.guest, `hrani.php?data=1&song=${empty.id}`)).json();
    assert.deepEqual([blank.text, blank.tab, blank.files, blank.notes.items], ['', '', [], []]);
    assert.equal(db('SELECT COUNT(*) n FROM vz2_activity_log')[0].n, before);
    assert.equal(Number(db('SELECT current_revision FROM vz2_documents WHERE collection_id=?', [song.id])[0].current_revision), 2);
    check(true, 'playing view: anonymous/invalid requests, empty song, rejected writes and unchanged data');
};
