'use strict';
const assert = require('node:assert/strict');
const { format, compactFormat, parse, adjust, timestampBody, songIntervalFor, endOf, tabular, mp3spltLabels } = require('../../js/vz2-timestamps.js');
assert.equal(compactFormat(83123), '01:23');
assert.equal(compactFormat(3660000), '61:00');
const entries = [
    { id: 1, time_ms: 1000, kind: 'song_start', body: 'Začátek' },
    { id: 2, time_ms: 1000, kind: 'passage', body: 'Stejný čas' },
    { id: 3, time_ms: 1100, kind: 'note', body: 'Nevymezuje úsek' },
    { id: 4, time_ms: 2000, kind: 'passage', body: 'Pasáž\nse dvěma řádky\ta tabulátorem' },
    { id: 5, time_ms: 3000, kind: 'song_start', body: 'Další skladba' },
    { id: 6, time_ms: 2500, kind: 'song_end', paired_timestamp_id: 1, body: 'Přesný konec' }
];
assert.equal(endOf(entries[0], entries, 4000), 2500);
assert.equal(endOf(entries[1], entries, 4000), 2000);
assert.equal(endOf(entries[2], entries, 4000), null);
assert.equal(endOf(entries[3], entries, 4000), 3000);
assert.equal(endOf(entries[4], entries, 4000), null);
assert.equal(endOf(entries[4], entries, null), null);
assert.equal(endOf(entries[4], entries, 3000), null);
assert.equal(endOf(entries[1], [...entries].reverse(), 4000), 2000);
assert.equal(endOf(entries[5], entries, 4000), null);
assert.equal(songIntervalFor(entries[0], entries).end.id, 6);
assert.equal(songIntervalFor(entries[2], entries).start.id, 1);
assert.equal(songIntervalFor(entries[3], entries).end.id, 6);
assert.equal(songIntervalFor(entries[4], entries), null);
for (const ms of [0, 1, 999, 1000, 60001, 3600999, 604800000]) assert.equal(parse(format(ms)), Math.floor(ms / 1000) * 1000);
assert.equal(format(59999), '00:59');
assert.equal(format(3600999), '60:00');
assert.equal(format(604800000), '10080:00');
assert.equal(parse('01:02.3'), 62300);
assert.equal(parse('01:02,03'), 62030);
assert.equal(parse('61:02'), 3662000);
assert.equal(adjust('00:00:03.000', 1000), '00:04');
assert.equal(adjust('00:00:00.500', -1000), '00:00');
assert.equal(timestampBody('song_start', '  '), '↑');
assert.equal(timestampBody('song_end', ''), '↓');
assert.throws(() => timestampBody('note', ''), /vyplňte text/);
for (const text of ['-1', 'NaN', '00:60', '01:99:00', '169:00:00', '00:01.0001']) assert.throws(() => parse(text));
assert.equal(tabular(entries, ['passage']), '00:01\tStejný čas\n00:02\tPasáž se dvěma řádky a tabulátorem');
assert.equal(tabular(entries, []), '');
const labels = mp3spltLabels([
    { id: 9, time_ms: 135000, kind: 'song_end', paired_timestamp_id: 8, body: 'nepoužitý konec' },
    { id: 3, time_ms: 728000, kind: 'song_start', body: 'War Pigs: refrén / pokus?' },
    { id: 4, time_ms: 801500, kind: 'song_end', paired_timestamp_id: 3, body: 'jiný název' },
    { id: 8, time_ms: 120000, kind: 'song_start', body: 'Česká píseň' },
    { id: 10, time_ms: 5025000, kind: 'song_start', body: '' },
    { id: 11, time_ms: 5030123, kind: 'song_end', paired_timestamp_id: 10, body: '' },
    { id: 12, time_ms: 9000000, kind: 'song_start', body: 'bez konce' },
    { id: 13, time_ms: 9100000, kind: 'song_end', paired_timestamp_id: null, body: 'bez začátku' },
    { id: 14, time_ms: 125000, kind: 'note', body: 'ignorovat' }
], 'zkouska_2026-09-30.mp3');
assert.equal(labels.filename, 'zkouska_2026-09-30.txt');
assert.equal(labels.incomplete, 2);
assert.equal(labels.text, '120.000\t135.000\tČeská píseň\n728.000\t801.500\tWar Pigs- refrén - pokus-\n5025.000\t5030.123\tzkouska_2026-09-30_01-23-45');
assert.deepEqual(mp3spltLabels([{ id: 1, time_ms: 0, kind: 'song_start', body: 'Jeden' }, { id: 2, time_ms: 1, kind: 'song_end', paired_timestamp_id: 1 }], 'a.mp3'), { filename: 'a.txt', incomplete: 0, text: '0.000\t0.001\tJeden' });
assert.equal(mp3spltLabels([], 'prázdná.mp3').text, '');
assert.deepEqual(mp3spltLabels([{ id: 1, time_ms: 1000, kind: 'song_start', body: 'Bez konce' }], 'a.mp3'), { filename: 'a.txt', incomplete: 1, text: '' });
console.log('PASS timestamp intervals, exact milliseconds, table export and mp3splt Audacity Labels export');
