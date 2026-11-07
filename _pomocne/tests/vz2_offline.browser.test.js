'use strict';
// Real media elements, IndexedDB and application assets; all HTTP traffic is fixture data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const config = { csrf: 'test', write: true, admin: true, canCreate: true, canUpload: true, canReorder: true, cachePrefix: 'offline-test:' };
const php = fs.readFileSync(path.join(root, 'index.php'), 'utf8');
const html = php.slice(php.indexOf('<!doctype html>'))
    .replace("<?php readfile(__DIR__ . '/css/themes.css'); ?>", fs.readFileSync(path.join(root, 'css/themes.css'), 'utf8'))
    .replace(/<\?=json_encode\(\$config,[\s\S]*?\?>/, JSON.stringify(config)).replace(/<\?[\s\S]*?\?>/g, '');
const wav = Buffer.alloc(44 + 8000 * 40 * 2);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
const hash = createHash('sha256').update(wav).digest('hex');
const recordings = [1, 2, 3, 4, 9].map(id => ({ id, collection_id: 1, kind: id === 9 ? 'multitrack' : 'single',
    title: 'Nahrávka ' + id, lifecycle: 'active', audio_state: 'available', author: 'Tester', revision: 1, duration_ms: 40000,
    files: [{ id, url: '/sample' + id + '.wav', original_name: 'sample' + id + '.wav', state: 'available', sha256: hash, byte_size: wav.length, duration_ms: 40000, mime: 'audio/wav' }] }));
const catalog = { ok: true, collections: [{ id: 1, title: 'Skladba', kind: 'song', lifecycle: 'active', author: 'Tester', recordings_revision: 1 }],
    recordings, recording_links: [], attachments: [], operations: [], orders: [{ kind: 'song', revision: 1 }, { kind: 'rehearsal', revision: 1 }] };
(async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath(), args: ['--autoplay-policy=no-user-gesture-required'] });
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    let responseMode = 'ok', audioRequests = 0, peakRequests = 0, catalogRequests = 0, releaseDownload, downloadStarted = false;
    const downloadGate = new Promise(resolve => { releaseDownload = resolve; });
    let holdDownload = false;
    await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.hostname !== 'offline.test') return route.abort();
        if (url.pathname === '/index.php') return route.fulfill({ contentType: 'text/html', body: html });
        if (/^\/(js|css|meat)\//.test(url.pathname)) return route.fulfill({ contentType: url.pathname.endsWith('.js') ? 'text/javascript' : url.pathname.endsWith('.css') ? 'text/css' : 'image/png', body: fs.readFileSync(path.join(root, url.pathname)) });
        if (/^\/sample\d+\.wav$/.test(url.pathname)) {
            audioRequests++;
            if (holdDownload && request.resourceType() === 'xhr') { downloadStarted = true; await downloadGate; }
            const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers().range || '');
            if (range) {
                const start = Number(range[1]), end = range[2] ? Math.min(Number(range[2]), wav.length - 1) : wav.length - 1;
                return route.fulfill({ status: 206, contentType: 'audio/wav', headers: { 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${wav.length}` }, body: wav.subarray(start, end + 1) });
            }
            return route.fulfill({ contentType: 'audio/wav', body: wav });
        }
        if (url.pathname === '/php/ajax/vz2.php') {
            if (url.searchParams.get('action') === 'mixer') return route.fulfill({ json: url.searchParams.has('id')
                ? { ok: true, multitrack: { version: 1, id: 9, name: 'Mix', created: '2026-10-28', tracks: [{ file: 'sample9.wav', fileId: 9, sha256: hash, byteSize: wav.length, name: 'Stopa', order: 1, url: '/sample9.wav' }] } }
                : { ok: true, multitracks: [{ id: 9, name: 'Mix' }] } });
            catalogRequests++;
            if (responseMode === 'network') return route.abort();
            if (responseMode !== 'ok') return route.fulfill({ status: Number(responseMode), json: { ok: false, error: 'Test nedostupného serveru' } });
            return route.fulfill({ json: catalog });
        }
        if (url.pathname === '/php/ajax/vz2_peaks.php') { peakRequests++; return route.fulfill({ json: { ok: true, peaks: [0.1, 0.6, 0.3], duration_ms: 40000 } }); }
        if (url.pathname === '/php/ajax/vz2_timestamps.php') return route.fulfill({ json: { ok: true, recording_id: Number(url.searchParams.get('recording_id')), duration_ms: 40000, timestamps_revision: 1, can_create: false,
            entries: [{ id: 101, time_ms: 2000, kind: 'song_start', body: 'Začátek' }, { id: 102, time_ms: 4000, kind: 'song_end', paired_timestamp_id: 101, body: 'Konec' }].map(row => ({ ...row, author: 'Tester', created_by: 1, updated_by: 1, revision: 1, created_at: '2026-10-28 12:00:00', updated_at: '2026-10-28 12:00:00' })) } });
        if (url.pathname === '/php/ajax/vz2_content.php') return route.fulfill({ json: { ok: true, document: null, version: null, posts: [], thread: { id: 1 }, can_edit: false } });
        return route.fulfill({ status: 204, body: '' });
    });
    const single = id => `#recording-${id} audio`;
    async function start(selector, playing = true) {
        await page.locator(selector).evaluate(audio => { audio.preload = 'auto'; audio.load(); });
        await page.waitForFunction(s => document.querySelector(s)?.readyState >= 2, selector);
        await page.locator(selector).evaluate(async (audio, play) => { audio.currentTime = 12; audio.volume = 0.35; audio.muted = true; audio.loop = true; audio.playbackRate = 1.25; if (play) await audio.play(); }, playing);
    }
    async function saved(selector, playing) {
        await page.waitForFunction(({ s, play }) => { const a = document.querySelector(s); return a?.currentSrc.startsWith('blob:') && a.readyState >= 2 && !a.dataset.sourceSwitching && a.paused === !play; }, { s: selector, play: playing });
        const state = await page.locator(selector).evaluate(a => ({ time: a.currentTime, volume: a.volume, muted: a.muted, loop: a.loop, rate: a.playbackRate }));
        assert(state.time >= 12 && state.time < 17, JSON.stringify(state));
        assert.equal(state.volume, 0.35); assert.equal(state.muted, true); assert.equal(state.loop, true); assert.equal(state.rate, 1.25);
    }
    async function reconnect(selector, mode) {
        responseMode = mode;
        await page.evaluate(s => {
            window.originalAudio = document.querySelector(s); window.originalContent = document.querySelector('#content').firstChild;
            window.originalTime = window.originalAudio.currentTime; window.mediaResets = [];
            for (const event of ['pause', 'emptied']) window.originalAudio.addEventListener(event, () => window.mediaResets.push(event), { once: true });
            window.dispatchEvent(new Event('offline')); window.dispatchEvent(new Event('online'));
        }, selector);
        await page.waitForFunction(() => !document.querySelector('#connection-status').textContent.startsWith('Ověřuji'));
        assert(await page.evaluate(s => window.originalAudio === document.querySelector(s) && window.originalContent === document.querySelector('#content').firstChild && !window.originalAudio.paused && window.originalAudio.currentTime >= window.originalTime, selector));
        assert.deepEqual(await page.evaluate(() => window.mediaResets), []);
        if (mode === 'ok') assert(await page.locator('#connection-status').isHidden());
        else assert(await page.locator('#connection-status').isVisible());
    }
    try {
        await page.goto('http://offline.test/index.php?v=2&collection_id=1');
        await page.waitForFunction(() => !document.documentElement.classList.contains('vz2-booting'));
        // Existing server peaks must work with saved audio, even when Web Audio
        // cannot decode the format (the media element can still play it).
        await page.evaluate(async r => {
            window.peakRecording = r;
            window.peakStore = idbKeyval.createStore('zkusebna-vz2-cache', 'audio');
            window.peakKey = VZ2.cachePrefix + 'peaks:' + r.files[0].id + ':' + r.files[0].sha256;
            window.originalDecode = AudioContext.prototype.decodeAudioData;
            window.decodeCalls = 0;
            AudioContext.prototype.decodeAudioData = function () { decodeCalls++; return Promise.reject(Error('Unsupported decoder')); };
            await Vz2Downloads.enqueue(r.files[0]);
        }, recordings[0]);
        const cachedAudioRequests = audioRequests, firstPeakRequests = peakRequests;
        await page.evaluate(() => Vz2Player.openLooper(peakRecording, peakRecording.files[0]));
        await page.waitForFunction(() => Vz2Player.getState()?.phase === 'ready');
        assert.equal(peakRequests, firstPeakRequests + 1, 'Saved audio still reads existing server peaks');
        assert.equal(audioRequests, cachedAudioRequests, 'Reading peaks never downloads saved audio again');
        assert.deepEqual(await page.evaluate(async () => (await idbKeyval.get(peakKey, peakStore))?.peaks), [0.1, 0.6, 0.3]);
        assert.equal(await page.evaluate(() => decodeCalls), 0);
        assert.equal(await page.locator('#looper-status').textContent(), '');
        await page.locator('#looper-view-wave').click();
        assert(await page.locator('#looper-wave').evaluate(canvas => {
            return canvas.getContext('2d').getImageData(Math.floor(canvas.width / 3), 30, 1, 1).data[3] > 0;
        }), 'Server peaks are drawn for saved audio');
        await page.evaluate(() => Vz2Player.closeLooper());
        await context.setOffline(true);
        await page.evaluate(() => Vz2Player.openLooper(peakRecording, peakRecording.files[0]));
        assert.equal(peakRequests, firstPeakRequests + 1, 'Reopening offline uses persisted peaks');
        assert.equal(await page.locator('#looper-status').textContent(), '');
        await context.setOffline(false);
        await page.evaluate(async () => {
            Vz2Player.closeLooper();
            await Vz2Downloads.removeKey(Vz2Downloads.key(peakRecording.files[0]));
            await Vz2Player.openLooper(peakRecording, peakRecording.files[0]);
            Vz2Player.closeLooper();
            await Vz2Downloads.enqueue(peakRecording.files[0]);
            await Vz2Player.openLooper(peakRecording, peakRecording.files[0]);
        });
        assert.equal(await page.evaluate(() => decodeCalls), 0, 'Removing and saving audio again preserves usable peaks');
        assert.equal(await page.locator('#looper-status').textContent(), '');
        console.log('PASS: saved audio reads and draws server peaks, persists them offline and keeps them across removal/redownload without decoding');

        // A stalled peaks server cannot block local playback or decoding fallback.
        await page.evaluate(async () => {
            Vz2Player.closeLooper(); AudioContext.prototype.decodeAudioData = originalDecode;
            await idbKeyval.del(peakKey, peakStore);
        });
        const beforeStalledPeaksAudio = audioRequests;
        let releasePeaks;
        const heldPeaks = new Promise(resolve => { releasePeaks = resolve; });
        const peakStarted = page.waitForRequest('**/vz2_peaks.php?*');
        await page.route('**/vz2_peaks.php?*', async route => { await heldPeaks; await route.abort().catch(() => {}); });
        await page.evaluate(() => { window.pendingPeaks = Vz2Player.openLooper(peakRecording, peakRecording.files[0]); });
        await peakStarted;
        await page.waitForFunction(() => Vz2Player.getState()?.phase === 'ready', null, { timeout: 2000 });
        await page.locator('#looper-audio').evaluate(async audio => { audio.currentTime = 7; await audio.play(); });
        await page.evaluate(() => pendingPeaks);
        releasePeaks(); await page.unroute('**/vz2_peaks.php?*');
        assert.equal(await page.locator('#looper-status').textContent(), '');
        assert.equal(await page.evaluate(async () => (await idbKeyval.get(peakKey, peakStore)).peaks.length), 4096);
        assert(await page.locator('#looper-audio').evaluate(audio => !audio.paused && audio.currentTime >= 7), 'Finishing peaks does not reset ongoing local playback');
        assert.equal(audioRequests, beforeStalledPeaksAudio, 'Fallback decodes the saved blob without another audio request');
        console.log('PASS: stalled peaks request allows immediate local playback and falls back to local decoding without resetting playback');
        await page.evaluate(async () => {
            Vz2Player.closeLooper();
            await Vz2Downloads.removeKey(Vz2Downloads.key(peakRecording.files[0]));
            await idbKeyval.del(peakKey, peakStore);
        });
        await page.locator('.recording-toggle[aria-expanded=false]').evaluateAll(buttons => buttons.forEach(button => button.click()));
        await start(single(1));
        for (const mode of ['ok', 'network', '401', '503']) await reconnect(single(1), mode);
        assert(catalogRequests >= 5);
        responseMode = 'ok';
        await page.locator(single(1)).evaluate(a => { a.currentTime = 12; });
        await page.locator('#recording-1 [aria-label="Uložit offline"]').evaluate(b => b.click());
        await saved(single(1), true);
        const requests = audioRequests;
        await context.setOffline(true);
        await page.locator(single(1)).evaluate(a => { a.currentTime = 25; });
        await page.waitForFunction(() => document.querySelector('#recording-1 audio').currentTime > 25.2);
        assert.equal(audioRequests, requests, 'Seeking the saved file does not request server audio');
        await context.setOffline(false);
        await reconnect(single(1), 'ok');
        await page.locator(single(1)).evaluate(a => a.pause());
        await start(single(2), false);
        await page.locator('#recording-2 [aria-label="Uložit offline"]').evaluate(b => b.click());
        await saved(single(2), false);
        console.log('PASS: reconnect success/network/401/503 preserves playback; saving preserves playing and paused media state');

        // Timestamp loops now live only in the Looper and survive source replacement.
        await page.evaluate(r => Vz2Player.openLooper(r, r.files[0]), recordings.find(r => r.id === 4));
        await page.waitForFunction(() => Vz2Player.getState()?.phase === 'ready');
        await page.locator('#looper-action-row > .looper-timestamp-actions > button').first().click();
        await page.waitForFunction(() => document.querySelector('#looper-timestamps [data-playback="loop"]'), null, { timeout: 5000 });
        await page.locator('#looper-timestamps [data-playback="loop"]').click();
        await page.waitForFunction(() => !document.querySelector('#looper-audio').paused && document.querySelector('#looper-audio').currentTime < 4);
        await page.locator('#looper-offline').evaluate(b => b.click());
        await page.waitForFunction(() => document.querySelector('#looper-audio').currentSrc.startsWith('blob:') && !document.querySelector('#looper-audio').dataset.sourceSwitching);
        await page.locator('#looper-audio').evaluate(a => { a.currentTime = 4.1; });
        await page.waitForFunction(() => document.querySelector('#looper-audio').currentTime < 3 && !document.querySelector('#looper-audio').paused);
        console.log('PASS: timestamp loop survives saving during playback');

        await page.evaluate(r => { Vz2Timestamps.stopLoop(); return Vz2Player.openLooper(r, r.files[0]); }, recordings[2]);
        assert.deepEqual(await page.evaluate(async file => {
            const db = idbKeyval.createStore('zkusebna-vz2-cache', 'audio');
            return (await idbKeyval.get(VZ2.cachePrefix + 'peaks:' + file.id + ':' + file.sha256, db))?.peaks;
        }, recordings[2].files[0]), [0.1, 0.6, 0.3], 'Peaks loaded with streamed audio are persisted too');
        await start('#looper-audio');
        await page.locator('#looper-offline').evaluate(b => b.click());
        await saved('#looper-audio', true);
        assert.match(await page.locator('#looper-offline-status').textContent(), /přehrávání ze zařízení/);
        for (const mode of ['ok', '401', 'network']) await reconnect('#looper-audio', mode);
        const peaksBefore = peakRequests, audioBefore = audioRequests;
        await page.evaluate(() => Vz2Player.closeLooper());
        await context.setOffline(true);
        await page.evaluate(r => Vz2Player.openLooper(r, r.files[0], 9), recordings[2]);
        await page.waitForFunction(() => Vz2Player.getState()?.phase === 'ready');
        assert(await page.locator('#looper-audio').evaluate(a => a.currentSrc.startsWith('blob:') && Math.abs(a.currentTime - 9) < 0.1));
        assert.equal(peakRequests, peaksBefore, 'Cached Looper does not wait for waveform HTTP');
        assert.equal(audioRequests, audioBefore);
        console.log('PASS: Looper switches to local audio and reopens it offline without audio/peaks HTTP');
        await context.setOffline(false); responseMode = 'ok';
        await page.evaluate(() => Vz2Player.closeLooper());

        await page.evaluate(async () => { await MultitrackApp.refreshList(); MultitrackApp.load(9); });
        await page.waitForFunction(() => MultitrackApp.getState()?.phase === 'ready');
        await page.evaluate(async () => { MultitrackApp.seek(10); await MultitrackApp.play(); document.querySelector('#mt-master-volume').value = 37; document.querySelector('#mt-master-volume').dispatchEvent(new Event('input')); });
        for (const mode of ['ok', 'network', '401']) {
            responseMode = mode;
            await page.evaluate(() => { window.mixerPosition = MultitrackApp.getState().position; window.mixerTrack = document.querySelector('#mt-tracks').firstChild; window.dispatchEvent(new Event('online')); });
            await page.waitForFunction(() => !document.querySelector('#connection-status').textContent.startsWith('Ověřuji'));
            assert(await page.evaluate(() => MultitrackApp.getState().playing && MultitrackApp.getState().position >= window.mixerPosition && document.querySelector('#mt-tracks').firstChild === window.mixerTrack && document.querySelector('#mt-master-volume').value === '37'));
        }
        console.log('PASS: reconnect preserves the running mixer and its volume');
        await page.evaluate(() => MultitrackApp.destroy()); responseMode = 'ok';

        await page.evaluate(file => Vz2Downloads.enqueue(file), recordings[4].files[0]);
        const beforeLocalMixer = audioRequests;
        await page.evaluate(() => MultitrackApp.load(9));
        await page.waitForFunction(() => MultitrackApp.getState()?.phase === 'ready');
        assert.equal(await page.evaluate(() => MultitrackApp.getState().source), 'offline');
        assert.equal(audioRequests, beforeLocalMixer, 'mixer uses the same copy as bulk downloads without HTTP');
        await page.evaluate(async file => {
            MultitrackApp.destroy();
            const db = idbKeyval.createStore('zkusebna-vz2-cache', 'audio');
            await idbKeyval.set(Vz2Downloads.key(file), new Blob(['incomplete']), db);
            MultitrackApp.load(9);
        }, recordings[4].files[0]);
        await page.waitForFunction(() => MultitrackApp.getState()?.phase === 'ready');
        assert.equal(await page.evaluate(() => MultitrackApp.getState().source), 'web');
        assert.equal(audioRequests, beforeLocalMixer + 1, 'incomplete local track falls back to a complete network download');
        await page.evaluate(() => MultitrackApp.destroy());

        // The shared full-file read must be cancelled along with the active mixer.
        let mixerRelease, mixerDone, mixerReached = false;
        const mixerWaiting = page.waitForRequest('**/sample9.wav');
        const mixerHeld = new Promise(resolve => { mixerRelease = resolve; });
        const mixerHandled = new Promise(resolve => { mixerDone = resolve; });
        await page.route('**/sample9.wav', async route => {
            mixerReached = true;
            try {
                await mixerHeld;
                if (!route.request().failure()) await route.fulfill({ contentType: 'audio/wav', body: wav });
            } finally { mixerDone(); }
        });
        try {
            await page.evaluate(() => MultitrackApp.load(9));
            await mixerWaiting;
            const aborted = page.waitForEvent('requestfailed', request => request.url().endsWith('/sample9.wav'));
            await page.evaluate(() => MultitrackApp.destroy());
            await aborted;
        } finally { mixerRelease(); if (mixerReached) await mixerHandled; await page.unroute('**/sample9.wav'); }
        assert.equal(await page.evaluate(() => MultitrackApp.getState()), null);
        console.log('PASS: mixer prefers saved complete tracks, rejects incomplete copies and cancels playback downloads');

        // Missing peaks require full audio in memory, but opening a Looper does not save it.
        await page.evaluate(async file => {
            await Vz2Downloads.removeKey(Vz2Downloads.key(file));
            const db = idbKeyval.createStore('zkusebna-vz2-cache', 'audio');
            await idbKeyval.del(VZ2.cachePrefix + 'peaks:' + file.id + ':' + file.sha256, db);
        }, recordings[1].files[0]);
        await page.route('**/vz2_peaks.php?*', route => route.fulfill({ status: 404, json: { ok: false } }));
        await page.evaluate(r => Vz2Player.openLooper(r, r.files[0]), recordings[1]);
        await page.waitForFunction(() => Vz2Player.getState()?.phase === 'ready' && !Vz2Player.getState().loading);
        const memoryUrl = await page.locator('#looper-audio').getAttribute('src');
        assert.match(memoryUrl, /^blob:/);
        assert.equal(await page.locator('#player-shell').getAttribute('data-source'), 'memory');
        assert.equal(await page.evaluate(async file => !!await Vz2Downloads.local(file), recordings[1].files[0]), false);
        await page.evaluate(() => Vz2Player.closeLooper());
        assert.equal(await page.evaluate(url => fetch(url).then(() => true, () => false), memoryUrl), false, 'closing Looper releases its memory URL');
        await page.unroute('**/vz2_peaks.php?*');
        console.log('PASS: Looper builds missing peaks from the shared memory source, does not save implicitly and releases its URL');

        // A source may arrive before its accompanying peaks read. Closing must still release it.
        await page.evaluate(async r => {
            await Vz2Downloads.enqueue(r.files[0]);
            window.originalGet = idbKeyval.get; window.originalCreateUrl = URL.createObjectURL; window.createdAudioUrls = [];
            idbKeyval.get = (key, db) => key.includes('peaks:2:') ? new Promise(resolve => { window.finishPeaksRead = resolve; }) : originalGet(key, db);
            URL.createObjectURL = blob => { const url = originalCreateUrl(blob); createdAudioUrls.push(url); return url; };
            window.pendingLooper = Vz2Player.openLooper(r, r.files[0]);
        }, recordings[1]);
        await page.waitForFunction(() => createdAudioUrls.length > 0);
        const lateSource = await page.evaluate(async () => {
            Vz2Player.closeLooper(); finishPeaksRead(null); await pendingLooper;
            idbKeyval.get = originalGet; URL.createObjectURL = originalCreateUrl;
            return { state: Vz2Player.getState(), alive: await fetch(createdAudioUrls[0]).then(() => true, () => false) };
        });
        assert.deepEqual(lateSource, { state: null, alive: false });
        console.log('PASS: closing during a delayed peaks read releases the already acquired local source');

        // A download finishing after the player is closed must not reopen or resume it.
        await page.evaluate(r => Vz2Player.openLooper(r, r.files[0]), recordings[0]);
        await page.locator('#looper-offline').evaluate(b => b.click()); // Remove the previously saved copy.
        await page.waitForFunction(() => !document.querySelector('#looper-offline').disabled);
        await page.evaluate(() => Vz2Player.closeLooper());
        await page.evaluate(r => Vz2Player.openLooper(r, r.files[0]), recordings[0]);
        holdDownload = true;
        await page.locator('#looper-offline').evaluate(b => b.click());
        await assert.doesNotReject(async () => { const deadline = Date.now() + 5000; while (!downloadStarted && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20)); assert(downloadStarted); });
        await page.evaluate(() => Vz2Player.closeLooper()); releaseDownload();
        await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
        assert.equal(await page.locator('#looper-audio').count(), 0);
        assert.equal(await page.evaluate(() => Vz2Player.getState()), null);
        assert.deepEqual(errors, []);
        await page.waitForFunction(() => Vz2Downloads.snapshot().some(t => t.file.id === 1 && t.state === 'complete'));
        assert.equal(await page.evaluate(async () => (await Vz2Downloads.inventory()).some(r => r.key.includes('audio:1:'))), true);
        console.log('PASS: closing during a download preserves queue and saves file without reopening player');
        holdDownload = false;
        await page.setViewportSize({ width: 320, height: 780 });
        await page.goto('http://offline.test/index.php?collection_id=1&recording_id=3&listen=1&view=audio&time_ms=2');
        await page.waitForFunction(() => Vz2CarMode.getState()?.phase === 'ready');
        await page.locator('#car-audio').evaluate(audio => { audio.currentTime = 12; audio.dispatchEvent(new Event('timeupdate')); audio.dispatchEvent(new Event('error')); });
        await page.waitForFunction(() => Vz2CarMode.getState()?.phase === 'ready' && document.querySelector('#car-status').textContent.includes('Stiskni Play'));
        assert(Math.abs(await page.locator('#car-audio').evaluate(audio => audio.currentTime) - 12) < .2, 'Recovery preserves the last position');
        assert(await page.locator('#car-audio').evaluate(audio => audio.paused), 'Recovery does not start playback on its own');
        await page.locator('#car-audio').evaluate(audio => {
            const source = audio.src;
            Object.defineProperty(audio, 'src', { configurable: true, get: () => source, set: () => {} });
            audio.load = () => {};
            audio.dispatchEvent(new Event('error')); audio.dispatchEvent(new Event('error'));
        });
        assert.equal(await page.evaluate(() => Vz2CarMode.getState()?.phase), 'error');
        assert(await page.locator('#car-play').isEnabled(), 'A failed recovery still offers a retry');
        await page.locator('#car-audio').evaluate(audio => { delete audio.src; delete audio.load; });
        await page.locator('#car-play').click();
        await page.waitForFunction(() => Vz2CarMode.getState()?.phase === 'ready' && !document.querySelector('#car-audio').paused);
        assert((await page.locator('#car-audio').evaluate(audio => audio.currentTime)) >= 11.8, 'Manual retry plays from the preserved position');
        await page.locator('#car-audio').evaluate(audio => audio.pause());
        console.log('PASS: car audio reloads after interruption and permits another retry after a repeated error');
        const carItems = [
            { id: 't1', timestamp_id: 1, recording_id: 3, kind: 'take', status: 'complete', start_ms: 0, end_ms: 4000, label: 'Pokus A', song_title: 'Skladba A' },
            { id: 't2', timestamp_id: 2, recording_id: 3, kind: 'take', status: 'complete', start_ms: 6000, end_ms: 9000, label: 'Pokus B' },
            { id: 't3', timestamp_id: 3, recording_id: 3, kind: 'take', status: 'open', start_ms: 10000, end_ms: null, label: 'Otevřený' },
            { id: 't4', timestamp_id: 4, recording_id: 3, kind: 'take', status: 'complete', start_ms: 3000, end_ms: 5000, label: 'Překryv' },
            { id: 't5', kind: 'note', status: 'point', start_ms: 2000, end_ms: null, label: 'Bod' }
        ];
        await page.evaluate(items => Vz2TimestampStore.accept({ recording_id: 3, annotation_version: 1, annotations: items, timestamps_revision: 2, entries: [] }), carItems);
        assert.equal(await page.locator('.car-chapter').count(), 4);
        assert.match(await page.locator('[data-chapter-id="t1"]').textContent(), /Skladba A/);
        assert.match(await page.locator('[data-chapter-id="t3"]').textContent(), /bez konce/);
        for (const [time, ids] of [[2, ['t1']], [3.5, ['t1', 't4']], [4, ['t4']], [5.5, []], [6, ['t2']], [9, []], [12, []]]) {
            await page.locator('#car-audio').evaluate((a, time) => { a.pause(); a.currentTime = time; }, time);
            await page.waitForFunction(ids => JSON.stringify([...document.querySelectorAll('.car-chapter.is-current')].map(b => b.dataset.chapterId)) === JSON.stringify(ids), ids);
        }
        await page.locator('[data-chapter-id="t2"]').click();
        await page.waitForFunction(() => !document.querySelector('#car-audio').paused && document.querySelector('#car-audio').currentTime >= 6);
        assert(await page.locator('#car-audio').evaluate(a => a.currentSrc.startsWith('blob:')));
        assert(await page.evaluate(() => document.querySelector('#car-mode').scrollWidth <= innerWidth + 1));
        await page.evaluate(items => Vz2TimestampStore.accept({ recording_id: 3, annotation_version: 1, annotations: items.map(i => i.id === 't2' ? { ...i, label: 'Nový název' } : i), timestamps_revision: 3, entries: [] }), carItems);
        await page.waitForFunction(() => document.querySelector('[data-chapter-id="t2"]').classList.contains('is-current'));
        assert.equal(await page.locator('#car-audio').evaluate(a => a.paused), false);
        assert.deepEqual(errors, []);
        console.log('PASS: car mode uses shared annotations, exact ends, gaps, overlaps, song names and local audio; refresh preserves playback');

        await page.evaluate(async file => {
            const db = idbKeyval.createStore('zkusebna-vz2-cache', 'audio');
            await idbKeyval.set(Vz2Downloads.key(file), new Blob(['incomplete']), db);
        }, recordings[2].files[0]);
        await page.reload();
        await page.waitForFunction(() => Vz2CarMode.getState()?.phase === 'ready');
        assert.match(await page.locator('#car-audio').getAttribute('src'), /sample3\.wav$/);
        await page.locator('#car-audio').evaluate(audio => { audio.currentTime = 7; audio.dispatchEvent(new Event('timeupdate')); audio.dispatchEvent(new Event('error')); });
        await page.waitForFunction(() => Vz2CarMode.getState()?.phase === 'ready' && document.querySelector('#car-status').textContent.includes('Stiskni Play'));
        assert.match(await page.locator('#car-audio').getAttribute('src'), /sample3\.wav$/);
        assert(Math.abs(await page.locator('#car-audio').evaluate(audio => audio.currentTime) - 7) < .2, 'Network recovery preserves position');
        await page.locator('#car-play').click();
        await page.waitForFunction(() => !document.querySelector('#car-audio').paused);
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.goto('http://offline.test/index.php?collection_id=1');
        await page.waitForFunction(() => document.querySelector('#recording-3 audio')?.dataset.source === 'web');
        assert.match(await page.locator(single(3)).getAttribute('src'), /sample3\.wav$/);
        await page.evaluate(r => Vz2Player.openLooper(r, r.files[0]), recordings[2]);
        await page.waitForFunction(() => Vz2Player.getState()?.phase === 'ready');
        assert.match(await page.locator('#looper-audio').getAttribute('src'), /sample3\.wav$/);
        assert.deepEqual(errors, []);
        console.log('PASS: card, car mode and Looper consistently ignore an incomplete local copy');

    } catch (error) {
        console.error('Browser errors:', errors);
        console.error(await page.locator('#looper-timestamps').textContent({ timeout: 1000 }).catch(() => 'Timestamp panel is not mounted'));
        throw error;
    } finally { releaseDownload(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
