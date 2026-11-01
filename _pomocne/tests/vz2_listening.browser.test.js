'use strict';
// Real players and IndexedDB, isolated catalogue/history and silent WAV fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const config = { csrf: 'test', write: false, admin: false, cachePrefix: 'listening-test:' };
const php = fs.readFileSync(path.join(root, 'index.php'), 'utf8');
const html = php.slice(php.indexOf('<!doctype html>'))
    .replace("<?php readfile(__DIR__ . '/css/themes.css'); ?>", fs.readFileSync(path.join(root, 'css/themes.css'), 'utf8'))
    .replace(/<\?=json_encode\(\$config,[\s\S]*?\?>/, JSON.stringify(config)).replace(/<\?[\s\S]*?\?>/g, '');
const wav = Buffer.alloc(44 + 8000 * 40 * 2);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
const hash = createHash('sha256').update(wav).digest('hex');
const file = id => ({ id, url: '/sample' + id + '.wav', original_name: 'sample' + id + '.wav', format: 'wav', state: 'available', sha256: hash, byte_size: wav.length, duration_ms: 40000 });
const recording = (id, collection_id, kind, ids) => ({ id, collection_id, kind, title: 'Nahrávka ' + id, lifecycle: 'active', audio_state: 'available', author: 'Tester', revision: 1, timestamps_revision: 1, duration_ms: 40000, summary: '', files: ids.map(file) });
const recordings = [recording(11, 2, 'single', [1]), recording(12, 1, 'single', [2]), recording(21, 2, 'multitrack', [3, 4]), recording(22, 1, 'multitrack', [5])];
const collections = [{ id: 1, title: 'Skladba', kind: 'song' }, { id: 2, title: 'Zkouška', kind: 'rehearsal' }].map(c => ({ ...c, lifecycle: 'active', author: 'Tester', recordings_revision: 1 }));
const links = [
    { id: 1, source_recording_id: 11, clip_recording_id: 12, start_ms: 2000, end_ms: 5000, start_body: 'Pokus A' },
    { id: 2, source_recording_id: 21, clip_recording_id: null, start_ms: 7000, end_ms: 10000, start_body: 'Pokus B' },
    { id: 3, source_recording_id: null, clip_recording_id: 22, start_ms: null, end_ms: null }
].map(p => ({ ...p, song_collection_id: 1, rehearsal_collection_id: 2 }));
const projection = id => {
    const r = recordings.find(r => r.id === id);
    return r ? { id: r.id, collection_id: r.collection_id, kind: r.kind, duration_ms: r.duration_ms, title: r.title, summary: r.summary, audio_state: r.audio_state, files: r.files } : null;
};
const matrix = { ok: true, songs: [collections[0]], rehearsals: [collections[1]], can_edit: false, unassigned_intervals: [], unassigned_clips: [],
    plays: links.map(p => ({ ...p, song_title: 'Skladba', rehearsal_title: 'Zkouška', source: projection(p.source_recording_id), clip: projection(p.clip_recording_id), notes: [] })) };
const catalog = { ok: true, collections, recordings, recording_links: links, attachments: [], operations: [], orders: [{ kind: 'song', revision: 1 }, { kind: 'rehearsal', revision: 1 }] };

(async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath(), args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    let denySwitch = false, audioRequests = 0, blockAudio = false;
    page.on('dialog', d => denySwitch ? d.dismiss() : d.accept());
    await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.hostname !== 'listening.test') return route.abort();
        if (url.pathname === '/index.php') return route.fulfill({ contentType: 'text/html', body: html });
        if (/^\/(js|css|meat)\//.test(url.pathname)) return route.fulfill({ contentType: url.pathname.endsWith('.js') ? 'text/javascript' : url.pathname.endsWith('.css') ? 'text/css' : 'image/png', body: fs.readFileSync(path.join(root, url.pathname)) });
        if (/^\/sample\d+\.wav$/.test(url.pathname)) {
            audioRequests++; if (blockAudio) return route.abort();
            const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range || '');
            const start = range ? Number(range[1]) : 0, end = range?.[2] ? Math.min(Number(range[2]), wav.length - 1) : wav.length - 1;
            return route.fulfill({ status: range ? 206 : 200, contentType: 'audio/wav', body: wav.subarray(start, end + 1),
                headers: { 'accept-ranges': 'bytes', ...(range ? { 'content-range': `bytes ${start}-${end}/${wav.length}` } : {}) } });
        }
        if (url.pathname === '/php/ajax/vz2.php') {
            if (url.searchParams.get('action') !== 'mixer') return route.fulfill({ json: catalog });
            const id = Number(url.searchParams.get('id')), r = recordings.find(r => r.id === id);
            return route.fulfill({ json: id ? { ok: true, multitrack: { version: 1, id, name: r.title, created: '2026-11-01', tracks: r.files.map((f, i) => ({ file: f.original_name, name: 'Stopa ' + (i + 1), order: i, fileId: f.id, sha256: f.sha256, byteSize: f.byte_size, url: f.url })) } }
                : { ok: true, multitracks: recordings.filter(r => r.kind === 'multitrack').map(r => ({ id: r.id, name: r.title })) } });
        }
        if (url.pathname === '/php/ajax/vz2_history.php') return route.fulfill({ json: matrix });
        if (url.pathname === '/php/ajax/vz2_timestamps.php') return route.fulfill({ json: { ok: true, recording_id: Number(url.searchParams.get('recording_id')), timestamps_revision: 1, duration_ms: 40000, entries: [], can_create: false } });
        if (url.pathname === '/php/ajax/vz2_content.php') return route.fulfill({ json: { ok: true, document: null, version: null, posts: [], thread: { id: 1 }, can_edit: false } });
        return route.fulfill({ status: 204, body: '' });
    });
    const detail = page.locator('#history-detail');
    async function workspace(name) {
        await page.locator(`[data-workspace-target="${name}"]:visible`).click();
        await page.waitForFunction(name => document.body.dataset.workspace === name, name);
    }
    async function openAttempt(id) {
        if (await page.locator('body').getAttribute('data-workspace') !== 'history') await workspace('history');
        if (!await page.locator('#history-list').isVisible()) await page.locator('#history-matrix .history-count').click();
        await page.locator(`#history-list [data-play-id="${id}"]`).click();
    }
    async function mediaReady(selector) { await page.waitForFunction(s => [...document.querySelectorAll(s)].length > 0 && [...document.querySelectorAll(s)].every(a => a.readyState >= 1), selector); }
    async function closeDetail() { await detail.locator('[data-history-close]').click(); await page.locator('#history-list').waitFor(); }
    try {
        await page.goto('http://listening.test/index.php?collection_id=1');
        await page.waitForFunction(() => !document.documentElement.classList.contains('vz2-booting'));
        await page.evaluate(files => Promise.all(files.map(f => Vz2Downloads.enqueue(f))), recordings.flatMap(r => r.files));
        await page.reload();
        await page.waitForFunction(() => !document.documentElement.classList.contains('vz2-booting'));
        const savedRequests = audioRequests; blockAudio = true;
        const linked = page.locator('#linked-recording-body-1-1-11');
        assert.equal(await linked.locator('audio').getAttribute('src'), null, 'collapsed linked cards do not acquire large audio blobs');
        await page.locator('[aria-controls="linked-recording-body-1-1-11"]').click();
        await mediaReady('#linked-recording-body-1-1-11 audio');
        assert.match(await linked.locator('audio').getAttribute('src'), /^blob:/);
        await linked.getByRole('button', { name: 'Přehrát', exact: true }).click();
        await page.waitForFunction(() => !document.querySelector('#linked-recording-body-1-1-11 audio').paused);
        await linked.locator('audio').evaluate(a => { a.currentTime = 5.2; a.dispatchEvent(new Event('timeupdate')); });
        await page.waitForFunction(() => { const a = document.querySelector('#linked-recording-body-1-1-11 audio'); return a.paused && Math.abs(a.currentTime - 5) < 0.1; });
        const linkedUrl = await linked.locator('audio').getAttribute('src');
        await workspace('rehearsals');
        assert.equal(await page.evaluate(url => fetch(url).then(() => true, () => false), linkedUrl), false);
        console.log('PASS linked audio: saved source without HTTP, exact interval end and URL cleanup on navigation');

        await openAttempt(1); await mediaReady('#history-detail audio');
        assert.equal(await detail.locator('audio').count(), 2);
        const urls = await detail.locator('audio').evaluateAll(nodes => nodes.map(a => a.src));
        assert(urls.every(url => url.startsWith('blob:')));
        assert(Math.abs(await detail.locator('audio').first().evaluate(a => a.currentTime) - 2) < 0.1);
        await detail.locator('.history-detail-card').first().getByRole('button', { name: 'Přehrát', exact: true }).click();
        await detail.locator('.history-detail-card').nth(1).locator('summary').click();
        await detail.locator('.history-detail-card').nth(1).getByRole('button', { name: 'Přehrát', exact: true }).click();
        await page.waitForFunction(() => { const [source, clip] = document.querySelectorAll('#history-detail audio'); return source.paused && !clip.paused; });
        await closeDetail();
        assert.deepEqual(await page.evaluate(urls => Promise.all(urls.map(url => fetch(url).then(() => true, () => false))), urls), [false, false]);
        assert.equal(audioRequests, savedRequests);
        console.log('PASS matrix audio: local source and clip, initial seek, exclusive playback and URL cleanup');

        await page.evaluate(() => {
            window.originalGet = idbKeyval.get; window.originalSource = Vz2Downloads.source; window.pendingSources = [];
            idbKeyval.get = (key, db) => key.includes('audio:1:') ? new Promise(resolve => { window.finishAudioRead = async () => resolve(await originalGet(key, db)); }) : originalGet(key, db);
            Vz2Downloads.source = (...args) => { const p = originalSource(...args); pendingSources.push(p.catch(() => {})); return p; };
        });
        await openAttempt(1); await page.waitForFunction(() => !!window.finishAudioRead);
        await page.evaluate(() => { window.closedAudio = document.querySelector('#history-detail audio'); });
        await closeDetail();
        await page.evaluate(async () => { await finishAudioRead(); await Promise.all(pendingSources); idbKeyval.get = originalGet; Vz2Downloads.source = originalSource; });
        assert.equal(await page.evaluate(() => closedAudio.getAttribute('src')), null);
        assert.equal(audioRequests, savedRequests);
        console.log('PASS matrix lifecycle: late storage read cannot restore a closed player');

        await openAttempt(2);
        assert.equal(await detail.locator('audio').count(), 0, 'multitrack never becomes a first-track audio element');
        await detail.getByRole('button', { name: 'Otevřít v mixéru: Původní nahrávka ze zkoušky', exact: true }).click();
        await page.waitForFunction(() => MultitrackApp.getState()?.id === '21' && MultitrackApp.getState()?.phase === 'ready');
        let state = await page.evaluate(() => MultitrackApp.getState());
        assert.equal(state.tracks.length, 2); assert.equal(state.source, 'offline'); assert(Math.abs(state.position - 7) < 0.1);
        assert.equal(await detail.isVisible(), false);
        assert.equal(await page.locator('#history-list').isVisible(), false);
        await page.evaluate(async () => { document.querySelector('#mt-master-volume').value = 37; document.querySelector('#mt-master-volume').dispatchEvent(new Event('input')); await MultitrackApp.play(); });
        await openAttempt(1); await mediaReady('#history-detail audio');
        await detail.locator('.history-detail-card').first().getByRole('button', { name: 'Přehrát', exact: true }).click();
        await page.waitForFunction(() => !MultitrackApp.getState().playing && !document.querySelector('#history-detail audio').paused);
        await page.evaluate(() => MultitrackApp.play());
        await page.waitForFunction(() => MultitrackApp.getState().playing && [...document.querySelectorAll('#history-detail audio')].every(a => a.paused));
        await closeDetail();
        console.log('PASS exclusive playback: matrix audio pauses Mixer; every Mixer start pauses inline audio');
        await openAttempt(2);
        await detail.getByRole('button', { name: 'Přejít na začátek úseku 00:07', exact: true }).click();
        assert.equal(await detail.isVisible(), false);
        assert.equal(await page.locator('#mt-master-volume').inputValue(), '37');
        assert.equal(await page.evaluate(() => MultitrackApp.getState().playing), true);
        await openAttempt(3); assert.equal(await detail.locator('audio').count(), 0, 'even a one-track multitrack uses its explicit type');
        await detail.locator('.history-detail-card summary').click();
        denySwitch = true;
        await detail.getByRole('button', { name: 'Otevřít v mixéru: Výstřižek', exact: true }).click();
        assert.equal(await detail.isVisible(), true);
        assert.equal(await page.evaluate(() => MultitrackApp.getState().id), '21');
        assert.equal(await page.evaluate(() => MultitrackApp.getState().playing), true);
        denySwitch = false;
        await detail.getByRole('button', { name: 'Otevřít v mixéru: Výstřižek', exact: true }).click();
        await page.waitForFunction(() => MultitrackApp.getState()?.id === '22' && MultitrackApp.getState()?.phase === 'ready');
        state = await page.evaluate(() => MultitrackApp.getState());
        assert.equal(state.tracks.length, 1); assert.equal(state.source, 'offline'); assert.equal(state.position, 0);
        assert.equal(audioRequests, savedRequests);
        console.log('PASS matrix multitrack: all source tracks, clip with one track, correct start and cancelled/accepted player switch');

        await page.locator('#looper-options > summary').click();
        await page.locator('#looper-close').click(); blockAudio = false;
        await page.evaluate(async f => { const db = idbKeyval.createStore('zkusebna-vz2-cache', 'audio'); await idbKeyval.set(Vz2Downloads.key(f), new Blob(['incomplete']), db); }, file(1));
        await openAttempt(1); await mediaReady('#history-detail audio');
        assert.match(await detail.locator('audio').first().getAttribute('src'), /sample1\.wav$/);
        assert.match(await detail.locator('audio').nth(1).getAttribute('src'), /^blob:/);
        await closeDetail();
        await page.evaluate(() => { window.originalGet = idbKeyval.get; idbKeyval.get = async () => { throw new DOMException('Storage unavailable', 'SecurityError'); }; });
        await openAttempt(1); await mediaReady('#history-detail audio');
        assert((await detail.locator('audio').evaluateAll(nodes => nodes.map(a => a.src))).every(url => !url.startsWith('blob:')));
        await closeDetail(); await page.evaluate(() => { idbKeyval.get = originalGet; });
        console.log('PASS matrix fallback: incomplete local copy and inaccessible storage use the network');

        await openAttempt(2);
        for (const width of [320, 390]) {
            await page.setViewportSize({ width, height: 844 });
            assert(await detail.evaluate(d => { const r = d.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 && d.scrollWidth <= d.clientWidth + 1; }));
            assert(await detail.locator('.history-open-mixer').isVisible());
        }
        assert.deepEqual(errors, []);
        console.log('PASS matrix mobile: multitrack action fits at 320/390 px; no JavaScript errors');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
