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
                ? { ok: true, multitrack: { version: 1, id: 9, name: 'Mix', created: '2026-10-28', tracks: [{ file: 'sample9.wav', fileId: 9, sha256: hash, name: 'Stopa', order: 1, url: '/sample9.wav' }] } }
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

        // Timestamp loops remain mounted and repeat across the source replacement.
        await start(single(4));
        await page.locator('#recording-4 [aria-label="Otevřít časové značky"]').evaluate(b => b.click());
        await page.waitForFunction(() => document.querySelector('#recording-timestamps-4 [data-playback="loop"]'), null, { timeout: 5000 });
        await page.locator('#recording-timestamps-4 [data-playback="loop"]').evaluate(b => b.click());
        await page.waitForFunction(() => !document.querySelector('#recording-4 audio').paused && document.querySelector('#recording-4 audio').currentTime < 4);
        await page.locator('#recording-4 [aria-label="Uložit offline"]').evaluate(b => b.click());
        await page.waitForFunction(() => document.querySelector('#recording-4 audio').currentSrc.startsWith('blob:') && !document.querySelector('#recording-4 audio').dataset.sourceSwitching);
        await page.locator(single(4)).evaluate(a => { a.currentTime = 4.1; });
        await page.waitForFunction(() => document.querySelector('#recording-4 audio').currentTime < 3 && !document.querySelector('#recording-4 audio').paused);
        console.log('PASS: timestamp loop survives saving during playback');

        await page.evaluate(r => { Vz2Timestamps.stopLoop(); return Vz2Player.openLooper(r, r.files[0]); }, recordings[2]);
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
        console.log('PASS: closing during a download leaves no player or unhandled error');
    } catch (error) {
        console.error('Browser errors:', errors);
        console.error(await page.locator('#recording-timestamps-4').textContent());
        throw error;
    } finally { releaseDownload(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
