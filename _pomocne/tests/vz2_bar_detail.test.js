'use strict';
const assert = require('node:assert/strict');
const { meters, template, preference, normalize, hasDetail, edit } = require('../../js/vz2-bar-detail');
const counts = [8,12,16,20,24,6,12,14,18,24];
const grouping = [[4,4],[4,4,4],[4,4,4,4],[4,4,4,4,4],[4,4,4,4,4,4],[6],[6,6],[4,4,6],[6,6,6],[6,6,6,6]];
meters.forEach((meter, index) => {
    const lines = template(meter).split('\n');
    assert.equal(lines[0], 'Metrum: ' + meter);
    const rows = lines.filter(line => /^(HH|SD|BD) /.test(line));
    assert.equal(rows.length, 3);
    for (const row of rows) {
        assert.equal([...row].filter(c => c === '-').length, counts[index]);
        assert.deepEqual(row.match(/-+/g).map(s => s.length), grouping[index]);
        const header = lines[lines.length - 4];
        for (let i = 5; i < row.length - 2; i++) assert.equal(row[i] === ' ', header[i] === ' ', meter + ' header alignment');
    }
});
assert.equal(template('4/4'), 'Metrum: 4/4\n     1e&a 2e&a 3e&a 4e&a\nHH | ---- ---- ---- ---- |\nSD | ---- ---- ---- ---- |\nBD | ---- ---- ---- ---- |');
const wide = template('12/8').split('\n');
assert.equal(wide[1].slice(26, 31), '1 1 1');
assert.equal(wide[2].slice(26, 32), '0&1&2&');
assert.throws(() => template('1/3'));
let stored = null; const storage = { getItem: () => stored, setItem: (key, value) => { stored = value; } };
const pref = preference(() => storage); assert.equal(pref.get(), '4/4'); pref.set('7/8'); assert.equal(pref.get(), '7/8');
assert.equal(preference(() => storage).get(), '7/8'); stored = 'invalid'; assert.equal(pref.get(), '4/4'); stored = null; assert.equal(pref.get(), '4/4');
const blocked = preference(() => { throw new Error('blocked'); }); assert.equal(blocked.get(), '4/4'); blocked.set('6/8'); assert.equal(blocked.get(), '6/8');
const quota = preference(() => ({ getItem: () => '4/4', setItem: () => { throw new Error('quota'); } })); quota.set('9/8'); assert.equal(quota.get(), '9/8');
for (const empty of [null, undefined, '', ' \t\n\r\u00a0']) assert(!hasDetail(empty));
assert(hasDetail(template('4/4'))); assert(hasDetail('<script>'));
assert.equal(normalize('  ř\r\n\r\n '), '  ř\n\n ');
const apply = (value, start, type, data, end = start) => edit({ value, start, end }, type, data);
const cases = [
    ['----',1,'insertText','x','-x--',2], ['abcd',1,'insertFromPaste','XY','aXYd',3],
    ['ab',2,'insertText','XY','abXY',4], ['ab\ncd',1,'insertFromPaste','XYZ','aXYZ\ncd',4],
    ['abcd',2,'deleteContentForward','','ab d',2], ['abcd',2,'deleteContentBackward','','a cd',1],
    ['ab\ncd',2,'deleteContentForward','','ab\ncd',2], ['ab\ncd',3,'deleteContentBackward','','ab\ncd',3],
    ['abcd',1,'insertText','X','aXd',2,3], ['abcd',1,'deleteContentBackward','','ad',1,3],
    ['abcd',2,'insertFromPaste','X\nY','abX\nYcd',5], ['abcd',2,'insertLineBreak','','ab\ncd',3],
    ['ab\ncd',1,'insertFromPaste','X\nY','aX\nYd',4,4], ['ab\ncd',0,'insertText','X','X',1,5],
    ['😀e\u0301--',0,'insertText','x','xe\u0301--',1], ['😀e\u0301--',2,'insertText','x','😀x--',3],
    ['👨‍👩‍👧‍👦x',0,'deleteContentForward','',' x',0], ['😀x',2,'deleteContentBackward','',' x',0],
    ['abcd',1,'insertText',' ','a cd',2], ['a\ncd',1,'insertText','X','aX\ncd',2]
];
for (const [value,start,type,data,expected,cursor,end = start] of cases) {
    const actual = apply(value,start,type,data,end); assert.equal(actual.value,expected, JSON.stringify({value,start,type,data})); assert.equal(actual.start,cursor); assert.equal(actual.end,cursor);
}
console.log('PASS bar detail: 10 aligned templates, session fallback, saved indication, 20 grapheme/overwrite operations');
