'use strict';
const assert = require('node:assert/strict');

module.exports = async ({ request, clients, db, good, check }) => {
    const rehearsal = await good('admin', { action: 'collection_create', kind: 'rehearsal', title: 'Přehled začátků' });
    const endpoint = 'php/ajax/vz2_content.php';
    const get = (who, query) => request(clients[who], endpoint + '?' + new URLSearchParams(query));
    const post = (who, fields) => request(clients[who], endpoint, fields);
    const documentQuery = { action: 'document', collection_id: rehearsal.id, kind: 'rehearsal_starts' };
    const draftQuery = { action: 'draft_from_starts', collection_id: rehearsal.id };
    const addRecording = (title, order) => {
        const directory = 'test/rehearsal-starts-' + rehearsal.id + '-' + order;
        db("INSERT INTO vz2_recordings(collection_id,kind,title,storage_dir,sort_order,lifecycle,created_by,updated_by,created_at,updated_at) VALUES (?,'single',?,?,?,'active',1,1,UTC_TIMESTAMP(),UTC_TIMESTAMP())", [rehearsal.id, title, directory, order]);
        return Number(db('SELECT id FROM vz2_recordings WHERE storage_dir=?', [directory])[0].id);
    };
    const first = addRecording('První nahrávka', 1);
    const second = addRecording('Druhá nahrávka', 0);
    db("INSERT INTO vz2_audio_files(recording_id,title,original_name,relative_path,format,mime_type,byte_size,sha256,sort_order,state,created_by,updated_by,created_at,updated_at) VALUES (?,?,? ,?,'wav','audio/wav',1,?,0,'available',1,1,UTC_TIMESTAMP(),UTC_TIMESTAMP())", [second, 'Druhá', 'second.wav', 'test/rehearsal-starts-' + rehearsal.id + '-audio.wav', 'a'.repeat(64)]);
    for (const [id, kind, time, body] of [
        [first, 'song_start', 65000, 'Ráno'],
        [first, 'note', 70000, 'Tohle se do návrhu nedostane'],
        [first, 'song_start', 120000, '↑'],
        [second, 'song_start', 3000, '  Večer\n  rychleji  ']
    ]) db('INSERT INTO vz2_timestamps(recording_id,kind,time_ms,body,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,1,1,UTC_TIMESTAMP(),UTC_TIMESTAMP())', [id, kind, time, body]);

    assert.equal((await get('guest', draftQuery)).status, 403);
    const proposal = (await get('admin', draftQuery)).json().text;
    assert.equal(proposal, 'Nahrávka 1 — Druhá.wav\n  00:03  Večer rychleji\n\nNahrávka 2 — První nahrávka\n  01:05  Ráno\n  02:00  Začátek skladby\n');
    assert.equal((await get('admin', documentQuery)).json().document, null);
    check(db("SELECT id FROM vz2_documents WHERE collection_id=? AND kind='rehearsal_starts'", [rehearsal.id]).length === 0, 'generating a rehearsal draft does not save a document');

    const save = { action: 'document_save', collection_id: rehearsal.id, kind: 'rehearsal_starts', document_id: null, current_revision: 0, title: 'Začátky skladeb', body: proposal + 'Ručně dopsáno.\n' };
    let result = await post('admin', save);
    assert.equal(result.status, 200, result.text);
    const documentId = result.json().document.id;
    db("UPDATE vz2_timestamps SET body='Ráno opraveno' WHERE recording_id=? AND kind='song_start' AND time_ms=65000", [first]);
    assert.match((await get('admin', draftQuery)).json().text, /Ráno opraveno/);
    assert.equal((await get('guest', documentQuery)).json().version.body, save.body);
    result = await post('admin', { ...save, document_id: documentId, current_revision: 1, body: 'Vlastní upravený přehled\n' });
    assert.equal(result.status, 200, result.text);
    check(result.json().document.current_revision === 2 && (await get('guest', { ...documentQuery, revision: 1 })).json().version.body === save.body,
        'rehearsal overview changes only on manual save and preserves earlier versions');
    // This SQL-only audio fixture has no physical file. Do not leave it marked
    // available for the subsequent alpha/beta storage preflight checks.
    db('DELETE FROM vz2_audio_files WHERE recording_id=?', [second]);
};
