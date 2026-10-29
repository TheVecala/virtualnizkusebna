'use strict';
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const M = require('../../js/vz2-timestamp-model');
const php = process.env.PHP_BIN;
assert(php, 'Set PHP_BIN for PHP/JS contract conformance');
const entries = [
    { id: 1, kind: 'song_start', time_ms: 123, body: '↑', song_collection_id: 9, song_title: 'Skladba' },
    { id: 2, kind: 'song_end', time_ms: 9000, body: '↓', paired_timestamp_id: 1 },
    { id: 3, kind: 'passage', time_ms: 1000, end_time_ms: 2500, passage_type: 'verse', parent_timestamp_id: 1, body: 'Sloka 1', note_text: 'Nástup' },
    { id: 4, kind: 'passage', time_ms: 2500, body: 'Starší pasáž' },
    { id: 5, kind: 'note', time_ms: 3000, body: 'Poznámka' },
    { id: 6, kind: 'passage', time_ms: 1200, end_time_ms: 2800, passage_type: 'solo', body: 'Sólo přes sloku' },
    { id: 7, kind: 'song_start', time_ms: 9500, body: '↑' },
    { id: 8, kind: 'song_end', time_ms: 10000, body: '↓' }
].map(e => ({ recording_id: 42, paired_timestamp_id: null, end_time_ms: null, passage_type: null, parent_timestamp_id: null, song_collection_id: null, note_text: '', song_title: '', can_edit: true, can_delete: true, ...e }));
for (const duration_ms of [12000, null, 5000, 0]) {
    const recording = { id: 42, duration_ms, entries };
    const before = JSON.stringify(recording), js = M.normalize(recording);
    const code = `require ${JSON.stringify(path.resolve(__dirname, '../../php/inc/vz2_timestamp_model.php'))}; $r=json_decode(stream_get_contents(STDIN),true); echo json_encode(vz2_timestamp_annotations($r,$r['entries']));`;
    const server = JSON.parse(execFileSync(php, ['-r', code], { input: JSON.stringify(recording) }).toString());
    assert.deepEqual(js, server, 'server and browser agree at duration ' + duration_ms);
    assert.equal(JSON.stringify(recording), before);
    assert.deepEqual(M.normalize({ ...recording, entries: [...entries].reverse() }), js);
}
const items = M.normalize({ id: 42, entries });
assert.equal(items.find(i => i.id === 't4').end_ms, null, 'neither next marker nor duration closes a passage');
assert.equal(items.find(i => i.id === 't3').song_id, 9);
assert.equal(items.find(i => i.id === 't6').parent_id, null, 'overlap never silently assigns a parent');
assert.equal(items.find(i => i.id === 't1').end_timestamp_id, 2);
assert.equal(items.find(i => i.id === 't8').status, 'orphan');
assert.equal(M.items({ annotation_version: 1, annotations: items }), items);
assert.equal(M.endOf(entries[2], entries, 12000), 2500);
console.log('PASS universal timestamp contract: PHP/JS conformance, explicit bounds, parents, overlaps, incomplete data');
