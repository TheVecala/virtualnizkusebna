'use strict';
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
let tick, position = 0, paused = false;
const calls = [], selected = [], scope = { window: {}, document: { dispatchEvent() {} }, Event: class {}, setInterval(fn) { tick = fn; } };
scope.window.Vz2TimestampStore = { select: v => selected.push(v), subscribe() {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../js/vz2-timestamp-playback.js'), 'utf8'), scope);
const playback = scope.window.Vz2TimestampPlayback;
const adapter = { durationMs: () => 5000, canPlay: () => true, currentTimeMs: () => position,
    playRange: async (start, end) => { calls.push([start, end]); position = start; }, pause: () => { paused = true; } };
(async () => {
    const item = { id: 't1', recording_id: 1, start_ms: 1000, end_ms: 9000 };
    await playback.play(adapter, item, { repeat: true });
    assert.deepEqual(calls, [[1000, 5000]]); assert.equal(item.end_ms, 9000);
    position = 5000; await tick(); assert.deepEqual(calls[1], [1000, 5000]);
    await playback.play(adapter, item); position = 5000; await tick(); assert(paused); assert.equal(playback.state(), null);
    await assert.rejects(playback.play(adapter, { ...item, start_ms: 6000 }), /mimo délku/);
    await assert.rejects(playback.play(adapter, { ...item, start_ms: 5000 }), /mimo délku/);
    console.log('PASS shorter replacement playback: clip/repeat, stop, original bounds and unavailable starts');
})().catch(err => { console.error(err); process.exitCode = 1; });
