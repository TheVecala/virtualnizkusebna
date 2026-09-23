'use strict';
const assert = require('node:assert/strict');
const { format, compactFormat, parse, endOf, tabular } = require('../js/vz2-timestamps.js');
assert.equal(compactFormat(83123), '01:23');
assert.equal(compactFormat(3660000), '61:00');
const entries = [
    { id: 1, time_ms: 1000, kind: 'song_start', body: 'Začátek' },
    { id: 2, time_ms: 1000, kind: 'passage', body: 'Stejný čas' },
    { id: 3, time_ms: 1100, kind: 'note', body: 'Nevymezuje úsek' },
    { id: 4, time_ms: 2000, kind: 'passage', body: 'Pasáž\nse dvěma řádky\ta tabulátorem' },
    { id: 5, time_ms: 3000, kind: 'song_start', body: 'Další skladba' }
];
assert.equal(endOf(entries[0], entries, 4000), 3000);
assert.equal(endOf(entries[1], entries, 4000), 2000);
assert.equal(endOf(entries[2], entries, 4000), null);
assert.equal(endOf(entries[3], entries, 4000), 3000);
assert.equal(endOf(entries[4], entries, 4000), 4000);
assert.equal(endOf(entries[4], entries, null), null);
assert.equal(endOf(entries[4], entries, 3000), null);
assert.equal(endOf(entries[1], [...entries].reverse(), 4000), 2000);
for (const ms of [0, 1, 999, 1000, 60001, 3600999, 604800000]) assert.equal(parse(format(ms)), ms);
assert.equal(parse('01:02.3'), 62300);
assert.equal(parse('01:02,03'), 62030);
for (const text of ['-1', 'NaN', '00:60', '01:99:00', '169:00:00', '00:01.0001']) assert.throws(() => parse(text));
assert.equal(tabular(entries, ['passage']), '00:00:01.000\tStejný čas\n00:00:02.000\tPasáž se dvěma řádky a tabulátorem');
assert.equal(tabular(entries, []), '');
console.log('PASS timestamp interval boundaries, exact ms round trips and filtered table export');
