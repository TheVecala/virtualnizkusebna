'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try {
    ({ chromium } = require('playwright'));
} catch (error) {
    console.log('Multitrack browser smoke test: SKIP (Playwright není dostupný)');
    process.exit(0);
}

function wavFixture(sampleRate, durationTenths) {
    const buffer = Buffer.alloc(64);
    buffer.write('RIFF', 0, 'ascii');
    buffer.writeUInt32LE(56, 4);
    buffer.write('WAVE', 8, 'ascii');
    buffer.write('fmt ', 12, 'ascii');
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36, 'ascii');
    buffer[43] = durationTenths;
    return buffer;
}

const html = `<!doctype html><html><body>
<span data-mt-load-state></span>
<div id="mt-notice" hidden></div>
<section id="mt-loading-panel"><strong id="mt-load-summary"></strong><div id="mt-track-statuses"></div></section>
<button id="mt-loading-cancel" type="button">Zrušit načítání</button>
<button id="mt-restart" disabled></button><button id="mt-backward" disabled></button>
<button id="mt-play" disabled><i id="mt-play-icon"></i></button><button id="mt-forward" disabled></button>
<input id="mt-seek" type="range" disabled><output id="mt-current-time"></output><output id="mt-total-time"></output>
<button id="mt-offline" disabled><i id="mt-offline-icon"></i><span id="mt-offline-label"></span><small id="mt-offline-status"></small></button>
<div id="mt-empty"></div><section id="mt-mixer" hidden><div id="mt-tracks"></div>
<input id="mt-master-volume" type="range"><output id="mt-master-value"></output></section>
<script>
window.MULTITRACK_CONFIG = {
  listUrl: 'https://multitrack.test/api/list',
  detailUrl: 'https://multitrack.test/api/list?id={id}',
  cachePrefix: 'vz2:test:beta:'
};
window.confirm = () => true;
window.__starts = [];
window.__sources = [];
window.__gains = [];
window.__cache = new Map();
window.idbKeyval = {
  createStore: function() { return {}; },
  get: function(key) { return Promise.resolve(window.__cache.get(key)); },
  set: function(key, value) { window.__cache.set(key, value); return Promise.resolve(); },
  del: function(key) { window.__cache.delete(key); return Promise.resolve(); }
};
function FakeParam(value) { this.value = value; }
FakeParam.prototype.cancelScheduledValues = function() {};
FakeParam.prototype.setTargetAtTime = function(value) { this.value = value; };
function FakeGain() { this.gain = new FakeParam(1); window.__gains.push(this); }
FakeGain.prototype.connect = function() {};
FakeGain.prototype.disconnect = function() {};
function FakeSource() { this.buffer = null; this.stopped = false; window.__sources.push(this); }
FakeSource.prototype.connect = function() {};
FakeSource.prototype.disconnect = function() {};
FakeSource.prototype.start = function(when, offset) { window.__starts.push({ when: when, offset: offset }); };
FakeSource.prototype.stop = function() { this.stopped = true; };
function FakeAudioContext() { this.currentTime = 0; this.sampleRate = 48000; this.destination = {}; window.__audioContext = this; }
FakeAudioContext.prototype.createGain = function() { return new FakeGain(); };
FakeAudioContext.prototype.createBufferSource = function() { return new FakeSource(); };
FakeAudioContext.prototype.resume = function() { return Promise.resolve(); };
FakeAudioContext.prototype.decodeAudioData = function(data, success) {
  var duration = new Uint8Array(data)[43] / 10;
  var decoded = { duration: duration, length: Math.round(duration * this.sampleRate), sampleRate: this.sampleRate };
  var promise = Promise.resolve(decoded);
  promise.then(success);
  return promise;
};
window.AudioContext = FakeAudioContext;
</script></body></html>`;

const sets = {
    'set-a': {
        id: 'set-a', version: 1, name: 'Set A', created: '2026-09-06T12:00:00+02:00',
        tracks: [
            { file: 'a-one.wav', name: 'A one', order: 1, url: 'https://multitrack.test/audio/a-one.wav' },
            { file: 'a-two.wav', name: 'A two', order: 2, url: 'https://multitrack.test/audio/a-two.wav' }
        ]
    },
    'set-b': {
        id: 'set-b', version: 1, name: 'Set B', created: '2026-09-06T12:00:00+02:00',
        tracks: [
            { file: 'b-one.wav', name: 'B one', order: 1, url: 'https://multitrack.test/audio/b-one.wav' },
            { file: 'b-two.wav', name: 'B two', order: 2, url: 'https://multitrack.test/audio/b-two.wav' }
        ]
    },
    'set-c': {
        id: 'set-c', version: 1, name: 'Set C', created: '2026-09-06T12:00:00+02:00',
        tracks: [
            { file: 'c-good.wav', name: 'C good', order: 1, url: 'https://multitrack.test/audio/c-good.wav' },
            { file: 'c-bad.wav', name: 'C bad', order: 2, url: 'https://multitrack.test/audio/c-bad.wav' }
        ]
    },
    'set-d': {
        id: 'set-d', version: 1, name: 'Set D', created: '2026-09-06T12:00:00+02:00',
        tracks: [
            { file: 'd-44.wav', name: 'D 44', order: 1, url: 'https://multitrack.test/audio/d-44.wav' },
            { file: 'd-48.wav', name: 'D 48', order: 2, url: 'https://multitrack.test/audio/d-48.wav' }
        ]
    }
};

const audio = {
    'a-one.wav': wavFixture(44100, 10),
    'a-two.wav': wavFixture(44100, 15),
    'b-one.wav': wavFixture(48000, 10),
    'b-two.wav': wavFixture(48000, 10),
    'c-good.wav': wavFixture(44100, 10),
    'd-44.wav': wavFixture(44100, 10),
    'd-48.wav': wavFixture(48000, 10)
};

(async () => {
    const executablePath = [
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
        chromium.executablePath(),
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
    ].find(candidate => candidate && fs.existsSync(candidate));
    const browser = await chromium.launch({
        headless: true,
        ...(executablePath ? { executablePath } : {})
    });
    const page = await browser.newPage();
    const list = Object.values(sets).map(set => ({ id: set.id, name: set.name, created: set.created, version: 1, trackCount: 2 }));
    let activeAudioRequests = 0;
    let maximumConcurrentAudioRequests = 0;
    let failSetADetail = false;

    try {
        await page.route('https://multitrack.test/**', async route => {
            const request = route.request();
            const url = new URL(request.url());
            if (url.pathname === '/api/list') {
                const id = url.searchParams.get('id');
                if (id === 'set-a' && failSetADetail) {
                    await route.abort('failed');
                    return;
                }
                await route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(id ? { ok: true, multitrack: sets[id] } : { ok: true, multitracks: list })
                });
                return;
            }
            if (url.pathname.startsWith('/audio/')) {
                const file = url.pathname.split('/').pop();
                activeAudioRequests += 1;
                maximumConcurrentAudioRequests = Math.max(maximumConcurrentAudioRequests, activeAudioRequests);
                await new Promise(resolve => setTimeout(resolve, 20));
                if (file === 'c-bad.wav') {
                    await route.fulfill({ status: 500, body: 'broken' });
                } else {
                    const body = audio[file];
                    await route.fulfill({
                        status: body ? 200 : 404,
                        contentType: 'audio/wav',
                        headers: body ? { 'Content-Length': String(body.length) } : {},
                        body: body || 'missing'
                    });
                }
                activeAudioRequests -= 1;
                return;
            }
            await route.abort();
        });

        await page.setContent(html);
        await page.addScriptTag({ path: path.resolve(__dirname, '..', '..', 'js', 'multitrack.js') });
        await page.evaluate(async () => { await window.MultitrackApp.refreshList(); window.MultitrackApp.load('set-a'); });
        await page.waitForFunction(() => window.MultitrackApp.getState()?.phase === 'ready');
        let state = await page.evaluate(() => window.MultitrackApp.getState());
        assert.equal(state.id, 'set-a');
        assert.equal(state.tracks.length, 2);
        assert.deepEqual(state.tracks.map(track => track.sampleRate), [44100, 44100]);
        assert.equal(await page.locator('.mt-channel').count(), 2);
        assert.match(await page.locator('#mt-notice').textContent(), /délky stop nejsou stejné/i);
        assert.equal(maximumConcurrentAudioRequests, 1, 'Síťové stahování stop musí být sekvenční.');

        await page.click('#mt-play');
        await page.waitForFunction(() => window.MultitrackApp.getState()?.playing === true);
        let starts = await page.evaluate(() => window.__starts.slice());
        assert.equal(starts.length, 2);
        assert.equal(starts[0].when, starts[1].when);
        assert.equal(starts[0].offset, starts[1].offset);
        await page.click('#mt-play');

        await page.$eval('#mt-seek', input => {
            input.value = '0.5';
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await page.click('#mt-play');
        await page.waitForFunction(() => window.__starts.length === 4);
        starts = await page.evaluate(() => window.__starts.slice(-2));
        assert.equal(starts[0].when, starts[1].when);
        assert.equal(starts[0].offset, 0.5);
        assert.equal(starts[1].offset, 0.5);
        assert.equal(await page.evaluate(() => window.__sources.length), 4, 'Po seeku musí vzniknout nové source nodes.');
        await page.click('#mt-play');

        await page.$eval('.mt-channel:nth-child(1) .mt-volume', input => {
            input.value = '30';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        assert.equal(await page.evaluate(() => window.__gains[1].gain.value), 0.3);
        await page.click('.mt-channel:nth-child(1) .mt-mute');
        await page.click('.mt-channel:nth-child(2) .mt-solo');
        let gains = await page.evaluate(() => window.__gains.slice(0, 3).map(node => node.gain.value));
        assert.deepEqual(gains, [1, 0, 1]);
        await page.$eval('#mt-master-volume', input => {
            input.value = '50';
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        assert.equal(await page.evaluate(() => window.__gains[0].gain.value), 0.5);

        await page.click('#mt-offline');
        await page.waitForFunction(() => document.getElementById('mt-offline').getAttribute('aria-pressed') === 'true');
        assert.equal(await page.evaluate(() => window.__cache.size), 3);
        assert.equal(maximumConcurrentAudioRequests, 1, 'Také offline ukládání musí stahovat sekvenčně.');

        await page.evaluate(() => { window.confirm = () => false; window.MultitrackApp.load('set-b'); });
        assert.equal((await page.evaluate(() => window.MultitrackApp.getState())).id, 'set-a', 'Cancel preserves current audio.');
        await page.evaluate(() => { window.confirm = () => true; window.MultitrackApp.load('set-b'); });
        await page.waitForFunction(() => window.MultitrackApp.getState()?.id === 'set-b' && window.MultitrackApp.getState()?.phase === 'ready');

        failSetADetail = true;
        await page.evaluate(() => window.MultitrackApp.load('set-a'));
        try {
            await page.waitForFunction(
                () => window.MultitrackApp.getState()?.id === 'set-a' && window.MultitrackApp.getState()?.phase === 'ready',
                null,
                { timeout: 10000 }
            );
        } catch (error) {
            console.error('Offline fallback state:', await page.evaluate(() => ({
                state: window.MultitrackApp.getState(),
                notice: document.getElementById('mt-notice').textContent,
                cacheKeys: Array.from(window.__cache.keys())
            })));
            throw error;
        }
        assert.match(await page.locator('#mt-notice').textContent(), /offline kopie/i);

        await page.evaluate(() => window.MultitrackApp.load('set-c'));
        await page.waitForFunction(() => window.MultitrackApp.getState()?.phase === 'ready');
        assert.equal(await page.locator('.mt-channel').count(), 1);

        await page.evaluate(() => window.MultitrackApp.load('set-d'));
        await page.waitForFunction(() => window.MultitrackApp.getState()?.phase === 'error');
        assert.equal(await page.locator('#mt-play').isDisabled(), true);
        assert.match(await page.locator('#mt-notice').textContent(), /sample rate/i);

        console.log('Multitrack browser smoke test: OK');
    } finally {
        await browser.close();
    }
})().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
