'use strict';
const assert = require('node:assert/strict');
const M = require('../../js/vz2-segments-model.js');
const timestamps = [
    { id: 1, kind: 'song_start', time_ms: 1000, body: 'Pokus A' },
    { id: 2, kind: 'song_end', time_ms: 9000, paired_timestamp_id: 1 },
    { id: 3, kind: 'passage', time_ms: 2000, body: 'Sloka' },
    { id: 4, kind: 'passage', time_ms: 4000, body: 'Refrén' },
    { id: 5, kind: 'note', time_ms: 4500, body: '<img src=x onerror=alert(1)>' },
    { id: 6, kind: 'song_start', time_ms: 11000, body: '↑' },
    { id: 7, kind: 'song_end', time_ms: 15000 },
    { id: 8, kind: 'passage', time_ms: 17000, body: 'Dozvuk' }
];
const source = { id: 11, collection_id: 21, duration_ms: '20000', timestamps };
const context = { collections: [{ id: 21, kind: 'rehearsal', title: 'Zkouška' }, { id: 22, kind: 'song', title: 'Skladba A' }],
    recording_links: [{ source_recording_id: 11, start_timestamp_id: 1, start_ms: 1000, end_ms: 9000, song_collection_id: 22 }] };
const snapshot = JSON.stringify(source);
const model = M.build(source, context), by = id => model.segments.find(s => s.id === 't' + id);
assert.equal(by(1).end_ms, 9000, 'only an explicit pair defines a take');
assert.equal(by(3).end_ms, 4000);
assert.equal(by(4).end_ms, 9000, 'last passage stops at take end, not at next take');
assert.equal(by(4).parent_id, 't1');
assert.equal(by(4).song_id, 22);
assert.equal(by(5).end_ms, null, 'notes do not create ranges');
assert.equal(by(6).end_ms, null, 'orphan starts stay points');
assert.equal(by(6).label, 'Pokus 2');
assert.equal(by(7).kind, 'boundary');
assert.equal(by(8).end_ms, 20000);
assert.equal(model.incomplete, 2);
assert.equal(JSON.stringify(source), snapshot, 'projection does not mutate source data');
assert.deepEqual(M.build({ ...source, timestamps: [...timestamps].reverse() }, context).segments, model.segments);
assert.equal(M.build({ ...source, duration_ms: null }).segments.find(s => s.id === 't8').end_ms, null, 'unknown duration is not invented');
assert.equal(M.build({ ...source, duration_ms: 0 }).extent_ms, 1000);
assert.equal(M.build({ ...source, duration_ms: 6000 }).omitted, 4);
assert.equal(M.build({ recording_id: 11, entries: timestamps, duration_ms: null }, context).id, 11, 'timestamp response adapter');
assert.equal(M.build({ id: 1, timestamps: [{ id: 1, kind: 'note', time_ms: null }, { id: 2, kind: 'note', time_ms: -1 }, { id: 3, kind: 'passage', time_ms: NaN }] }).segments.length, 0);
const overlap = [{ id: 'a', start_ms: 0, end_ms: 5 }, { id: 'b', start_ms: 2, end_ms: 4 }, { id: 'c', start_ms: 5, end_ms: 8 }];
assert.deepEqual(M.lanes(overlap).map(row => row.map(s => s.id)), [['a', 'c'], ['b']]);
assert.equal(M.lanes([{ start_ms: 1, end_ms: null }, { start_ms: 1, end_ms: null }]).length, 2);
assert.equal(M.lanes([{ start_ms: 1, end_ms: null }, { start_ms: 4, end_ms: null }]).length, 1);
const nested = M.build({ id: 1, duration_ms: 100, timestamps: [
    { id: 1, kind: 'song_start', time_ms: 0 }, { id: 2, kind: 'song_end', time_ms: 90, paired_timestamp_id: 1 },
    { id: 3, kind: 'song_start', time_ms: 20 }, { id: 4, kind: 'song_end', time_ms: 40, paired_timestamp_id: 3 },
    { id: 5, kind: 'passage', time_ms: 25 }
] });
assert.equal(nested.segments.find(s => s.id === 't5').parent_id, 't3');
assert.equal(nested.segments.find(s => s.id === 't5').end_ms, 40);
assert.equal(M.color({ song_id: 22 }, 1, 'song'), M.color({ song_id: 22 }, 999, 'song'));
assert.equal(M.color({}, 1, 'mono'), M.color({}, 99, 'mono'));
assert.equal(M.format(3661000), '61:01');
console.log('PASS segment projection: pairs, passages, missing ends/duration, overlaps, stable colors, immutable input');
