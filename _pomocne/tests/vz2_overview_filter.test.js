'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { filterOverview, entryKey } = require('../../js/vz2-overview-filter.js');

const rehearsal = { id: 1, title: 'Zkouška', entries: [
    { type: 'document', kind: 'lyrics_chords' },
    { type: 'document', kind: 'rehearsal_starts' },
    { type: 'summary' },
    { type: 'marker', kind: 'note' },
    { type: 'discussion' }
], played_songs: [{ id: 3, title: 'Skladba', count: 1 }] };
const empty = { id: 2, title: 'Prázdná zkouška', entries: [], played_songs: [] };
const song = { id: 3, title: 'Skladba', entries: [
    { type: 'document', kind: 'lyrics_chords' },
    { type: 'map' },
    { type: 'map_detail' },
    { type: 'marker', kind: 'note' }
], played_songs: [] };
const data = { generated_at: '2026-10-25T10:00:00Z', rehearsals: [rehearsal, empty], songs: [song] };

assert.equal(entryKey('rehearsal', rehearsal.entries[0]), 'rehearsal_notes');
assert.equal(entryKey('song', song.entries[0]), 'song_lyrics');
assert.deepEqual(filterOverview(data), data, 'all categories are visible by default');

const filtered = filterOverview(data, {
    rehearsal_notes: false, rehearsal_starts: false, rehearsal_played: false,
    song_map_sections: false, song_marker_note: false, show_empty: false
});
assert.deepEqual(filtered.rehearsals.map(item => item.id), [1]);
assert.deepEqual(filtered.rehearsals[0].entries.map(item => item.type), ['summary', 'marker', 'discussion']);
assert.deepEqual(filtered.rehearsals[0].played_songs, []);
assert.deepEqual(filtered.songs[0].entries.map(item => item.type), ['document', 'map_detail']);
assert.equal(data.rehearsals[0].entries.length, 5, 'filtering does not alter the loaded snapshot');

const selected = filterOverview(data, {}, { rehearsal: new Set([2]), song: new Set() });
assert.deepEqual(selected.rehearsals.map(item => item.id), [2], 'individual rehearsal selection is respected');
assert.deepEqual(selected.songs, [], 'individual song selection is independent');
assert.deepEqual(filterOverview(data, { rehearsals: false }).rehearsals, [], 'an entire section can be hidden');

const page = fs.readFileSync(path.join(__dirname, '../../prehled.php'), 'utf8');
const controls = new Set([...page.matchAll(/data-filter="([a-z_]+)"/g)].map(match => match[1]));
for (const scope of ['rehearsal', 'song']) {
    for (const entry of [
        { type: 'document', kind: 'lyrics_chords' },
        { type: 'summary' }, { type: 'attachment_note' }, { type: 'discussion' },
        ...['song_start', 'song_end', 'passage', 'note'].map(kind => ({ type: 'marker', kind }))
    ]) assert(controls.has(entryKey(scope, entry)), `missing checkbox for ${scope} ${entry.type} ${entry.kind || ''}`);
}
for (const key of ['rehearsal_starts', 'song_tablature', 'song_map_sections', 'song_map_details']) {
    assert(controls.has(key), `missing checkbox ${key}`);
}
console.log('PASS overview checkbox filter model');
