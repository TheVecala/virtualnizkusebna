'use strict';
// Real application and media elements; isolated HTTP/IndexedDB fixtures, no live writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const TimestampModel = require('../../js/vz2-timestamp-model.js');
const config = { csrf: 'test', write: true, admin: false, cachePrefix: 'playback-variant:' };
const php = fs.readFileSync(path.join(root, 'index.php'), 'utf8');
const html = php.slice(php.indexOf('<!doctype html>'))
    .replace("<?php readfile(__DIR__ . '/css/themes.css'); ?>", fs.readFileSync(path.join(root, 'css/themes.css'), 'utf8'))
    .replace(/<\?=json_encode\(\$config,[\s\S]*?\?>/, JSON.stringify(config)).replace(/<\?[\s\S]*?\?>/g, '');
const wav = Buffer.alloc(44 + 8000 * 40 * 2);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
const hash = createHash('sha256').update(wav).digest('hex');
const recordings = [11, 12].map(id => ({ id, collection_id: 1, kind: 'single', title: 'Zkouška ' + id, lifecycle: 'active', audio_state: 'available',
    author: 'Tester', revision: 1, timestamps_revision: 1, duration_ms: 40000, summary: '', files: [{ id, url: '/sample.wav', original_name: 'zkouska-' + id + '.wav',
        format: 'wav', state: 'available', sha256: hash, byte_size: wav.length, duration_ms: 40000 }] }));
const catalog = { ok: true, collections: [{ id: 1, title: 'Zkouška', kind: 'rehearsal', lifecycle: 'active', author: 'Tester', recordings_revision: 1 }],
    recordings, recording_links: [], attachments: [], operations: [], orders: [{ kind: 'rehearsal', revision: 1 }] };
const entry = fields => ({ revision: 1, created_by: 1, updated_by: 1, author: 'Tester', editor: 'Tester', can_edit: true, can_delete: true,
    created_at: '2026-11-06 12:00:00', updated_at: '2026-11-06 12:00:00', ...fields });
let entries = [entry({ id: 1, kind: 'song_start', time_ms: 3000, body: 'Pokus' }),
    entry({ id: 2, kind: 'song_end', time_ms: 12000, paired_timestamp_id: 1, body: '↓' }),
    entry({ id: 3, kind: 'passage', time_ms: 6000, end_time_ms: 9000, parent_timestamp_id: 1, body: 'Refrén' }),
    entry({ id: 4, kind: 'note', time_ms: 7000, body: '👍' })];
// The real catalogue and timestamp endpoint include precomputed annotations.
for (const recording of recordings) {
    recording.timestamps = recording.id === 11 ? entries.map(e => ({ ...e })) : [];
    recording.annotation_version = TimestampModel.version;
    recording.annotations = TimestampModel.normalize(recording);
}
let revision = 1, writable = true, failWrite = false, nextTimestampId = 100;
const writes = [];
let peakRequests = 0, peakWrites = 0, missingWaveStatus = 503, scriptAudioRequests = 0;
(async () => {
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true,
        args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    let acceptDialog = true;
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => acceptDialog ? d.accept() : d.dismiss());
    await page.route('**/*', async route => {
        const url = new URL(route.request().url()), p = url.pathname;
        if (url.hostname !== 'playback.test') return route.abort();
        if (p === '/index.php') return route.fulfill({ contentType: 'text/html', body: html });
        if (/^\/(js|css|meat)\//.test(p)) return route.fulfill({ contentType: p.endsWith('.js') ? 'text/javascript' : p.endsWith('.css') ? 'text/css' : 'image/png', body: fs.readFileSync(path.join(root, p)) });
        if (p === '/sample.wav') {
            if (['fetch', 'xhr'].includes(route.request().resourceType())) scriptAudioRequests++;
            const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range || '');
            const start = range ? Number(range[1]) : 0, end = range?.[2] ? Math.min(Number(range[2]), wav.length - 1) : wav.length - 1;
            return route.fulfill({ status: range ? 206 : 200, contentType: 'audio/wav', body: wav.subarray(start, end + 1),
                headers: { 'accept-ranges': 'bytes', ...(range ? { 'content-range': `bytes ${start}-${end}/${wav.length}` } : {}) } });
        }
        if (p === '/php/ajax/vz2.php') return route.fulfill({ json: url.searchParams.get('action') === 'mixer' ? { ok: true, multitracks: [] } : catalog });
        if (p === '/php/ajax/vz2_peaks.php') { if (route.request().method() === 'POST') { peakWrites++; return route.fulfill({ status: 201, json: { ok: true } }); } peakRequests++; if (url.searchParams.get('id') === '12') return route.fulfill({ status: missingWaveStatus, json: { ok: false } }); return route.fulfill({ json: { ok: true, duration_ms: 40000, peaks: Array.from({ length: 200 }, (_, i) => .2 + Math.abs(Math.sin(i)) * .5) } }); }
        if (p === '/php/ajax/vz2_timestamps.php') {
            const data = route.request().postDataJSON();
            if (data) {
                if (failWrite) return route.abort();
                writes.push(data); revision++;
                const row = entry({ ...data, id: data.id || nextTimestampId++, revision });
                entries = entries.filter(e => e.id !== row.id && e.paired_timestamp_id !== row.id);
                if (!['delete', 'delete_interval'].includes(data.action)) entries.push(row);
                if (data.kind === 'song_start' && data.end_time_ms != null) entries.push(entry({ id: nextTimestampId++, kind: 'song_end', time_ms: data.end_time_ms, paired_timestamp_id: row.id, body: '↓' }));
            }
            const id = Number(url.searchParams.get('recording_id') || data?.recording_id);
            return route.fulfill({ json: { ok: true, recording_id: id, timestamps_revision: revision, duration_ms: 40000, can_create: writable, annotation_version: TimestampModel.version, annotations: TimestampModel.normalize({ id, entries: id === 11 ? entries : [], duration_ms: 40000 }), songs: Array.from({ length: 20 }, (_, i) => ({ id: i + 1, title: 'Skladba ' + (i + 1), lifecycle: 'active' })), entries: id === 11 ? entries : [] } });
        }
        if (p === '/php/ajax/vz2_history.php') return route.fulfill({ json: { ok: true, songs: [], rehearsals: [], plays: [], unassigned_intervals: [], unassigned_clips: [] } });
        if (p === '/php/ajax/vz2_content.php') return route.fulfill({ json: { ok: true, document: null, version: null, posts: [], thread: { id: 1 }, can_edit: false } });
        return route.fulfill({ status: 204, body: '' });
    });
    const state = () => page.evaluate(() => Vz2Player.getState());
    const drawer = page.locator('#looper-timestamps'), actions = page.locator('#looper-action-row > .looper-timestamp-actions');
    const toggle = actions.locator('button').first();
    try {
        await page.goto('http://playback.test/index.php?collection_id=1');
        await page.waitForFunction(() => !document.documentElement.classList.contains('vz2-booting'));
        await page.locator('#recording-11 .recording-toggle').click();
        const mini = page.locator('#recording-11');
        await page.waitForFunction(() => document.querySelector('#recording-11 audio').readyState >= 1);
        assert.equal(await mini.locator('.vz2-audio-transport button').count(), 1);
        assert.equal(await mini.locator('.recording-timestamps').count(), 0);
        assert.equal(await mini.locator('.recording-looper-entry').textContent(), 'Otevřít v looperu');
        assert.equal(await mini.locator('.recording-offline').textContent(), 'Uložit offline');
        await mini.getByRole('button', { name: 'Přehrát', exact: true }).click();
        await page.waitForFunction(() => !document.querySelector('#recording-11 audio').paused);
        assert.equal(await state(), null, 'quick listening does not open the Looper');
        await mini.locator('input[type=range]').evaluate(e => { e.value = 5; e.dispatchEvent(new Event('input')); });
        await mini.getByRole('button', { name: 'Pozastavit', exact: true }).click();
        await mini.locator('.recording-offline').click();
        await page.waitForFunction(() => document.querySelector('#recording-11 .recording-offline').textContent === 'Odebrat offline kopii');
        assert.match(await mini.locator('.recording-audio-source').textContent(), /Uloženo v zařízení/);
        await mini.locator('.recording-looper-entry').click();
        await page.waitForFunction(() => Vz2Player.getState()?.phase === 'ready');
        assert(Math.abs((await state()).position - 5) < .2);
        assert.equal(await drawer.isVisible(), false);
        assert.equal(await page.locator('#looper-wave').isVisible(), false);
        assert(await page.locator('#looper-seek').isVisible());
        assert.equal(peakRequests, 0, 'slider never requests waveform JSON');
        assert((await page.locator('#looper-seek').boundingBox()).y >= (await page.locator('.looper-header-controls').boundingBox()).y + (await page.locator('.looper-header-controls').boundingBox()).height);
        assert.equal(await actions.getByRole('button', { name: 'Export', exact: true }).count(), 0);
        const reload = actions.getByRole('button', { name: 'Obnovit značky', exact: true });
        assert(await reload.isVisible());
        assert.equal(await reload.evaluate(e => e.previousElementSibling.textContent), 'poznámka');
        for (const [label, kind] of [['úsek', 'take'], ['pasáž', 'passage'], ['poznámka', 'note']]) {
            await actions.getByRole('button', { name: label, exact: true }).click();
            const editor = page.locator('.vz2-annotation-editor');
            await editor.waitFor({ state: 'visible' });
            assert.equal(await editor.getAttribute('data-kind'), kind);
            assert.equal(await editor.locator('.annotation-parent').isVisible(), kind === 'passage');
            assert.equal(await editor.locator('.annotation-kind-slider').count(), 0);
            assert.equal(await editor.evaluate(e => e.matches(':modal')), false);
            assert.equal(await editor.locator('.annotation-player, .annotation-reference').count(), 0);
            assert.equal(await drawer.locator('.annotation-inline').count(), 1);
            assert(await page.locator('#looper-wave').isVisible());
            await editor.locator('.annotation-close').click();
        }
        if (await drawer.isVisible()) await toggle.click();
        await page.locator('#looper-view-wave').click();
        await page.locator('.looper-wave-marker').first().waitFor();
        assert(await page.locator('#looper-wave').isVisible());
        assert.equal(await drawer.isVisible(), false, 'wave works independently of the timestamp drawer');
        assert.equal(await drawer.locator('#looper-visuals, .looper-view-switch').count(), 0);
        assert.equal(await page.locator('#looper-seek').isVisible(), false, 'wave replaces the basic slider');
        assert(await page.locator('#looper-show-wave').isChecked(), 'marks show wave by default');
        await page.waitForFunction(() => !document.getElementById('looper-status').textContent);
        assert.equal(peakRequests, 1);
        await page.locator('#looper-show-wave').uncheck();
        await page.locator('#looper-show-wave').check();
        await page.locator('#looper-play').click();
        await page.waitForFunction(() => Vz2Player.getState().playing);
        await page.evaluate(() => { window.originalAudio = document.getElementById('looper-audio'); });
        const before = (await state()).position;
        await page.locator('#looper-view-segments').click();
        assert.equal(await page.locator('#looper-show-wave').isChecked(), false, 'segments keep their independent wave preference');
        await page.locator('#looper-show-wave').check();
        assert.equal((await state()).playing, true);
        assert((await state()).position >= before && (await state()).position < before + 2);
        assert(await page.evaluate(() => originalAudio === document.getElementById('looper-audio')));
        assert.equal(await page.locator('#looper-wave').isVisible(), false);
        assert.equal(await page.locator('#looper-seek').isVisible(), false);
        assert.equal(await drawer.isVisible(), false, 'segments also work with the drawer closed');
        await page.locator('#looper-play').click();
        await page.locator('#looper-segments [data-segment-id="t1"]').click();
        assert(Math.abs((await state()).position - 7.5) < .1, 'clicking inside a take seeks to that position');
        assert.equal(await page.locator('#looper-segments .segment-wave').count(), 1);
        const plot = page.locator('#looper-segments .segment-plot');
        const box = await plot.boundingBox();
        await plot.click({ position: { x: box.width * .75, y: 1 } });
        assert(Math.abs((await state()).position - 30) < .1, 'empty timeline space is seekable');
        await plot.focus(); await page.keyboard.press('ArrowLeft');
        assert(Math.abs((await state()).position - 29) < .1, 'keyboard seeking uses the same timeline');
        await page.locator('#looper-show-wave').uncheck();
        assert.equal(await page.locator('#looper-segments .segment-wave').count(), 0);
        await page.locator('#looper-show-wave').check();
        assert.equal(peakRequests, 1, 'marks and segments share the first waveform request');
        const readViewport = () => page.evaluate(() => {
            const node = document.getElementById('looper-view-segments').getAttribute('aria-pressed') === 'true'
                ? document.querySelector('#looper-segments .segment-plot') : document.getElementById('looper-wave');
            return [Number(node.dataset.viewStart ?? node.dataset.rangeStart), Number(node.dataset.viewEnd ?? node.dataset.rangeEnd)];
        });
        for (const view of ['wave', 'segments']) {
            await page.locator('#looper-view-' + view).click();
            await page.locator('#looper-zoom-reset').click();
            await page.waitForFunction(() => !document.querySelector('#looper-view-segments[aria-pressed=true]') || Number(document.querySelector('#looper-segments .segment-plot').dataset.viewStart) === 0);
            await page.locator('#looper-zoom-in').click();
            await page.waitForFunction(() => Number(document.querySelector('#looper-segments .segment-plot').dataset.viewStart) === 10000);
            let range = await readViewport(); assert(Math.abs(range[1] - range[0] - 20000) < 1, view + ' has a working zoom button');
            const timeline = page.locator(view === 'wave' ? '#looper-wave' : '#looper-segments .segment-plot');
            const bounds = await timeline.boundingBox(), at = (await state()).position;
            await page.mouse.move(bounds.x + bounds.width * .5, bounds.y + 8); await page.mouse.down();
            await page.mouse.move(bounds.x + bounds.width * .7, bounds.y + 8, { steps: 5 }); await page.mouse.up();
            range = await readViewport(); assert(Math.abs(range[0] - 6000) < 80, view + ' can pan');
            assert(Math.abs((await state()).position - at) < .01, 'dragging does not change playback');
            const anchor = range[0] + .75 * (range[1] - range[0]);
            await page.mouse.move(bounds.x + bounds.width * .75, bounds.y + 8);
            await page.keyboard.down('Control'); await page.mouse.wheel(0, -100); await page.keyboard.up('Control');
            await page.waitForFunction(() => { const n = document.querySelector('#looper-segments .segment-plot'); return Number(n.dataset.viewEnd) - Number(n.dataset.viewStart) < 15000; });
            range = await readViewport(); assert(Math.abs(range[0] + .75 * (range[1] - range[0]) - anchor) < 80, 'zoom preserves the cursor time');
            await page.locator('#looper-view-' + (view === 'wave' ? 'segments' : 'wave')).click();
            const switched = await readViewport(); assert(Math.abs(switched[0] - range[0]) < 1 && Math.abs(switched[1] - range[1]) < 1, 'view switching retains zoom');
        }
        await page.locator('#looper-zoom-reset').click();
        await page.waitForFunction(() => Number(document.querySelector('#looper-segments .segment-plot').dataset.viewStart) === 0);
        assert.equal(peakRequests, 1, 'zoom and pan never request waveform data again');
        await page.setViewportSize({ width: 390, height: 844 });
        const touchSession = await page.context().newCDPSession(page);
        await touchSession.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
        for (const view of ['wave', 'segments']) {
            await page.locator('#looper-view-' + view).click();
            await page.locator('#looper-zoom-reset').click();
            await page.waitForFunction(() => Number(document.querySelector('#looper-segments .segment-plot').dataset.viewStart) === 0);
            const timeline = page.locator(view === 'wave' ? '#looper-wave' : '#looper-segments .segment-plot');
            const box = await timeline.evaluate(e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
            const at = (await state()).position;
            const fingers = (a, b) => [a, b].map((f, i) => ({ id: i + 1, x: box.x + f * box.width, y: box.y + box.height / 2 }));
            await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(.35, .65) });
            await touchSession.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(.2, .8) });
            await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            const range = await readViewport(); assert(Math.abs(range[0] - 10000) < 100 && Math.abs(range[1] - 30000) < 100, view + ' supports native pinch');
            assert(Math.abs((await state()).position - at) < .01, 'pinch does not seek');
        }
        await touchSession.send('Emulation.setTouchEmulationEnabled', { enabled: false });
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.locator('#looper-zoom-reset').click();
        await page.waitForFunction(() => Number(document.querySelector('#looper-segments .segment-plot').dataset.viewStart) === 0);
        assert.equal(peakRequests, 1, 'pinch also reuses the same waveform');
        console.log('PASS shared Looper zoom: marks/segments buttons, mouse pan, Ctrl-wheel anchor, native pinch and viewport retention');

        await toggle.click();
        assert.equal(await drawer.locator('.ts-list > li:visible').count(), 3, 'the full timestamp list is independent of the position view');
        const selected = drawer.locator('.ts-list .ts-selected');
        assert(await selected.getByRole('button', { name: 'Upravit', exact: true }).isVisible());
        await selected.getByRole('button', { name: 'Smyčka', exact: true }).click();
        await page.waitForFunction(() => Vz2Player.getState().playing);
        await page.locator('#looper-audio').evaluate(a => { a.currentTime = 12.1; });
        await page.waitForFunction(() => Vz2Player.getState().position < 4);
        await page.locator('#looper-view-wave').click();
        assert.equal(await page.evaluate(() => Vz2TimestampPlayback.state()?.repeat), true);
        await page.locator('#looper-play').click();
        entries.push(entry({ id: 5, kind: 'note', time_ms: 20000, body: 'Nová značka' })); revision++;
        await reload.click();
        await page.locator('.looper-wave-marker-text').getByText('Nová značka', { exact: true }).waitFor();
        await page.locator('#looper-view-segments').click();
        assert.equal(await page.locator('#looper-segments [data-segment-id="t5"]').count(), 1);
        await actions.getByRole('button', { name: 'Přidat poznámku: palec nahoru', exact: true }).click();
        await page.waitForFunction(() => document.querySelectorAll('#looper-segments .segment-note').length === 3);
        console.log('PASS quick player, text offline state, independent position views and timestamp drawer, seek/loop and live timestamp updates');
        const beforeTimestampChange = { state: await state(), range: await readViewport(), peaks: peakRequests, audio: scriptAudioRequests };
        const liveTakeId = await page.evaluate(async () => {
            const result = await Vz2TimestampStore.saveInterval(11, { kind: 'song_start', time_ms: 4000, end_time_ms: 8000, body: 'Živý úsek' });
            return result.entries.find(e => e.body === 'Živý úsek').id;
        });
        const liveTake = page.locator('#looper-segments [data-segment-id="t' + liveTakeId + '"]');
        assert.equal(await liveTake.locator('.segment-label').textContent(), 'Živý úsek', 'new take appears without switching views');
        await page.evaluate(id => Vz2TimestampStore.saveInterval(11, { id, kind: 'song_start', time_ms: 5000, end_time_ms: 11000, body: 'Posunutý úsek' }), liveTakeId);
        assert.equal(await liveTake.locator('.segment-label').textContent(), 'Posunutý úsek', 'renamed take updates immediately');
        assert.match(await liveTake.getAttribute('title'), /00:05 – 00:11/);
        assert.equal(await liveTake.evaluate(e => e.style.left), '12.5%', 'changed boundary updates segment position');
        assert.equal(await liveTake.evaluate(e => e.style.width), '15%', 'changed end updates segment width');
        await page.evaluate(id => {
            const item = Vz2TimestampStore.items(11).find(i => i.timestamp_id === id);
            return Vz2TimestampStore.remove(11, item, Vz2TimestampStore.peek(11).timestamps_revision);
        }, liveTakeId);
        assert.equal(await liveTake.count(), 0, 'deleted take disappears immediately');
        assert.deepEqual(await readViewport(), beforeTimestampChange.range, 'timestamp changes preserve viewport');
        assert.equal(peakRequests, beforeTimestampChange.peaks, 'timestamp changes reuse waveform JSON');
        assert.equal(scriptAudioRequests, beforeTimestampChange.audio, 'timestamp changes do not download audio');
        assert.equal((await state()).playing, beforeTimestampChange.state.playing);
        assert(Math.abs((await state()).position - beforeTimestampChange.state.position) < .1);
        assert(await page.evaluate(() => originalAudio === document.getElementById('looper-audio')));
        console.log('PASS live segments with catalogue annotations: add, rename, move boundaries and delete without switching views or reloading audio');

        for (const width of [320, 390, 767, 768, 960, 1440]) {
            await page.setViewportSize({ width, height: 844 });
            if (!await drawer.isVisible()) await toggle.click();
            for (const view of ['slider', 'wave', 'segments']) {
                await page.locator('#looper-view-' + view).click();
                await page.waitForFunction(() => document.getElementById('looper-timestamps').getAnimations().every(a => a.playState === 'finished'));
                const viewNode = page.locator(view === 'slider' ? '#looper-seek' : view === 'wave' ? '#looper-wave' : '#looper-segments');
                assert(await viewNode.isVisible(), 'selected view is visible at ' + width);
                assert(await page.locator('#looper-time').isVisible() && await page.locator('#looper-duration').isVisible());
                const controlsBox = await page.locator('.looper-header-controls').boundingBox();
                const visualBox = await page.locator('#looper-visuals').boundingBox();
                const bar = await page.locator('#looper-action-row').boundingBox();
                const centers = await page.locator('#looper-action-row button:visible').evaluateAll(buttons => buttons.map(button => {
                    const box = button.getBoundingClientRect(); return box.y + box.height / 2;
                }));
                assert(centers.every(y => Math.abs(y - centers[0]) < 1), 'timestamp buttons share one row at ' + width);
                assert(await page.locator('#looper-action-row').evaluate(row => row.scrollWidth <= row.clientWidth || getComputedStyle(row).overflowX === 'auto'), 'narrow toolbar is scrollable');
                assert(visualBox.y >= controlsBox.y + controlsBox.height && visualBox.y + visualBox.height <= bar.y + 1,
                    'position views stay between transport and timestamp actions at ' + width);
                const bounds = await drawer.boundingBox();
                assert(bounds.y >= bar.y + bar.height - 1 && bounds.height > 100, 'drawer stays below transport at ' + width);
                assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow at ' + width);
                assert(await drawer.evaluate(e => e.scrollWidth <= e.clientWidth + 1), 'drawer fits at ' + width);
                if (process.env.PLAYBACK_SCREENSHOT_DIR && [390, 1440].includes(width)) {
                    fs.mkdirSync(process.env.PLAYBACK_SCREENSHOT_DIR, { recursive: true });
                    await page.screenshot({ path: path.join(process.env.PLAYBACK_SCREENSHOT_DIR, 'playback-' + width + '-' + view + '.png') });
                }
            }
            await page.keyboard.press('Escape');
            assert.equal(await drawer.isVisible(), false);
            assert(await page.locator('#looper-segments').isVisible(), 'closing timestamps leaves the selected position view visible');
            await page.locator('#player-fullscreen').click();
            assert(await drawer.isVisible());
            assert.equal(await toggle.isVisible(), false);
            await page.keyboard.press('Escape');
        }
        console.log('PASS drawer, fullscreen and all three position views at 320/390/767/960/1440 px');
        for (const width of [390, 960, 1440]) for (const height of [400, 600]) {
            await page.setViewportSize({ width, height });
            for (const view of ['wave', 'segments']) {
                await page.locator('#looper-view-' + view).click();
                const rows = await page.evaluate(view => {
                    const ids = [view === 'wave' ? 'looper-wave-scroll' : 'looper-segments', 'looper-view-controls', 'looper-time', 'looper-offline-status', 'looper-action-row'];
                    return ids.map(id => { const r = document.getElementById(id).getBoundingClientRect(); return { id, top: r.top, bottom: r.bottom }; });
                }, view);
                assert(rows.every((row, i) => !i || row.top >= rows[i - 1].bottom - 1), 'player rows never overlap at ' + width + '×' + height + ' ' + view + ': ' + JSON.stringify(rows));
                await actions.getByRole('button', { name: 'úsek', exact: true }).scrollIntoViewIfNeeded();
                assert(await actions.getByRole('button', { name: 'úsek', exact: true }).evaluate(e => {
                    const r = e.getBoundingClientRect(), body = document.getElementById('player-body').getBoundingClientRect();
                    return r.top >= body.top - 1 && r.bottom <= body.bottom + 1;
                }), 'timestamp actions remain reachable on short screens');
            }
        }
        await page.setViewportSize({ width: 1440, height: 844 });
        console.log('PASS short-screen Looper: wave and segment toolbars never overlap and actions stay reachable');

        await page.locator('#looper-view-wave').click();
        const editor = drawer.locator('.annotation-inline');
        await page.evaluate(() => Vz2Player.seek(14.321));
        await actions.getByRole('button', { name: 'úsek', exact: true }).click();
        assert.equal(await editor.locator('[data-edit-time=start]').textContent(), '00:14');
        assert.equal(await editor.locator('[data-edit-time=end]').textContent(), '--:--');
        assert(await page.evaluate(() => originalAudio === document.getElementById('looper-audio')));
        await page.evaluate(() => Vz2Player.seek(24.654));
        await editor.locator('[data-capture=end]').click();
        await editor.locator('[name=label]').fill('Úsek ze společného přehrávače');
        failWrite = true;
        await editor.locator('.annotation-add-passages').click();
        await editor.locator('.annotation-error').filter({ hasText: /fetch/i }).waitFor();
        assert.equal(await editor.locator('[name=label]').inputValue(), 'Úsek ze společného přehrávače');
        failWrite = false;
        await editor.locator('.annotation-add-passages').click();
        await page.waitForFunction(() => document.querySelector('.annotation-inline[open]')?.dataset.kind === 'passage');
        await page.waitForFunction(() => Number(document.getElementById('looper-wave').dataset.rangeStart) === 14321);
        assert.equal(Number(await page.locator('#looper-wave').getAttribute('data-range-end')), 24654);
        const takeId = entries.find(e => e.body === 'Úsek ze společného přehrávače').id;
        assert.equal(writes.at(-1).time_ms, 14321);
        assert.equal(writes.at(-1).end_time_ms, 24654);
        assert.match(await editor.locator('[data-choice=parent] > button').textContent(), /Úsek ze společného přehrávače/);
        await page.locator('#looper-view-segments').click();
        const focusedPlot = page.locator('#looper-segments .segment-plot');
        assert.equal(Number(await focusedPlot.getAttribute('data-view-start')), 14321);
        assert.equal(Number(await focusedPlot.getAttribute('data-view-end')), 24654);
        await focusedPlot.waitFor({ state: 'visible' });
        await focusedPlot.click();
        assert(Math.abs((await state()).position - 19.4875) < .03, 'segment seeking respects the focused take');
        assert.equal(peakRequests, 1);
        await page.locator('#looper-view-wave').click();
        const canvas = page.locator('#looper-wave');
        const waveBox = await canvas.boundingBox();
        await canvas.click({ position: { x: waveBox.width / 2, y: waveBox.height - 12 } });
        assert(Math.abs((await state()).position - 19.4875) < .03, 'clicking the focused main wave uses take-relative coordinates');
        await editor.locator('[data-capture=start]').click();
        await page.evaluate(() => Vz2Player.seek(23.123));
        await editor.locator('[data-capture=end]').click();
        await editor.locator('[name=label]').fill('Pasáž ze společné wave');
        await editor.locator('.annotation-save').click();
        await editor.locator('.annotation-save-status').filter({ hasText: 'Uloženo' }).waitFor();
        assert.equal(writes.at(-1).parent_timestamp_id, takeId);
        assert.equal(writes.at(-1).end_time_ms, 23123);
        assert.equal(await editor.locator('[name=label]').inputValue(), '');
        assert.equal(Number(await canvas.getAttribute('data-range-start')), 14321, 'saving retains zoom');
        await editor.locator('[data-choice=parent] > button').click();
        await page.getByRole('option').filter({ hasText: 'Pokus' }).click();
        await page.waitForFunction(() => Number(document.getElementById('looper-wave').dataset.rangeStart) === 3000);
        assert.equal(Number(await canvas.getAttribute('data-range-end')), 12000);
        await page.locator('#looper-zoom-out').click();
        await page.waitForFunction(() => Number(document.getElementById('looper-wave').dataset.rangeEnd) > 12000);
        assert(Number(await canvas.getAttribute('data-range-end')) > 12000, 'zoom out expands a focused take');
        await actions.getByRole('button', { name: 'poznámka', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('.annotation-inline[open]')?.dataset.kind === 'note');
        await editor.locator('[name=label]').fill('Nezahodit');
        acceptDialog = false;
        await actions.getByRole('button', { name: 'úsek', exact: true }).click();
        assert.equal(await editor.getAttribute('data-kind'), 'note');
        assert.equal(await editor.locator('[name=label]').inputValue(), 'Nezahodit');
        await page.locator('#player-close').evaluate(e => e.click());
        assert.equal((await state()).id, '11', 'closing the player can be cancelled without losing the draft');
        acceptDialog = true;
        await actions.getByRole('button', { name: 'úsek', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('.annotation-inline[open]')?.dataset.kind === 'take');
        await editor.locator('.annotation-close').click();
        await drawer.locator('.ts-list [data-annotation-id="t' + takeId + '"]').getByRole('button', { name: 'Upravit', exact: true }).click();
        assert.equal(await editor.locator('[name=label]').inputValue(), 'Úsek ze společného přehrávače');
        await editor.locator('[name=label]').fill('Upravený úsek');
        await editor.locator('.annotation-save').click();
        await editor.locator('.annotation-save-status').filter({ hasText: 'Uloženo' }).waitFor();
        assert.equal(writes.at(-1).id, takeId);
        assert.match(await drawer.locator('.ts-list').textContent(), /Upravený úsek/);
        assert.equal(await page.locator('#looper-segments [data-segment-id="t' + takeId + '"] .segment-label').textContent(), 'Upravený úsek', 'editor save also refreshes segment labels');
        const previewDir = path.join(root, '_pomocne/dist/inline-timestamps'); fs.mkdirSync(previewDir, { recursive: true });
        for (const width of [320, 390, 767, 768, 960, 1440]) {
            await page.setViewportSize({ width, height: 844 });
            for (const [label, kind] of [['úsek', 'take'], ['pasáž', 'passage'], ['poznámka', 'note']]) {
                await actions.getByRole('button', { name: label, exact: true }).click();
                await page.waitForFunction(kind => document.querySelector('.annotation-inline[open]')?.dataset.kind === kind, kind);
                assert(await drawer.isVisible(), 'resizing keeps the active editor open');
                const formBox = await editor.boundingBox(), listBox = await drawer.locator('.vz2-timestamps').boundingBox();
                if (width < 768) assert(formBox.y + formBox.height <= listBox.y + 2, 'mobile form precedes timestamps');
                else assert(formBox.x >= listBox.x + listBox.width, 'desktop form is to the right of timestamps');
                assert(await drawer.evaluate(e => e.scrollWidth <= e.clientWidth + 1), 'drawer has no horizontal overflow at ' + width);
                assert.equal(await page.locator('.annotation-wave, .annotation-transport').count(), 0);
                assert(await page.evaluate(() => originalAudio === document.getElementById('looper-audio')));
                if (kind === 'take') {
                    await editor.locator('[data-edit-time=start]').click();
                    assert(await editor.evaluate(e => e.querySelector('.annotation-fine-start button') === document.activeElement), 'opening precise times focuses a button, not the keyboard');
                    assert.equal(await editor.locator('[data-edit-time=start]').isVisible(), false, 'precise controls replace ordinary time display');
                    assert.equal(await editor.locator('[data-capture=start]').isVisible(), false, 'precise controls replace capture buttons');

                    const start = await editor.locator('[name=start]').boundingBox(), end = await editor.locator('[name=end]').boundingBox();
                    assert(Math.abs(start.y - end.y) < 1 && end.x > start.x + start.width, 'precise times share a row at ' + width);
                    for (const edge of ['start', 'end']) {
                        const input = await editor.locator('[name=' + edge + ']').boundingBox();
                        const buttons = await editor.locator('.annotation-fine-' + edge + ' button').evaluateAll(nodes => nodes.map(n => { const r = n.getBoundingClientRect(); return { y: r.y, height: r.height }; }));
                        assert(buttons.every(b => b.y >= input.y + input.height && b.height <= 24 && Math.abs(b.y - buttons[0].y) < 1), 'all four compact adjustments share one row below their time');
                    }
                    assert(await drawer.evaluate(e => e.scrollWidth <= e.clientWidth + 1));
                    if (width === 390 || width === 1440) await page.screenshot({ path: path.join(previewDir, 'precise-' + width + '.png') });
                    await editor.locator('.annotation-fine summary').click();
                    assert(await editor.locator('[data-capture=start]').isVisible(), 'closing precise controls restores capture buttons');
                }
                if (width === 390 || width === 1440) await page.screenshot({ path: path.join(previewDir, kind + '-' + width + '.png') });
            }
        }
        await page.setViewportSize({ width: 390, height: 400 });
        await editor.locator('[name=label]').fill('Poznámka s klávesnicí');
        await editor.locator('.annotation-save').click();
        await editor.locator('.annotation-save-status').filter({ hasText: 'Uloženo' }).waitFor();
        assert.equal(writes.at(-1).body, 'Poznámka s klávesnicí');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('#player-fullscreen').click();
        assert(await editor.isVisible());
        assert(await page.locator('#looper-wave').isVisible());
        await page.keyboard.press('Escape');
        await actions.getByRole('button', { name: 'úsek', exact: true }).click();
        assert.equal(await drawer.locator('.annotation-inline').count(), 1);
        console.log('PASS inline desktop/mobile editors, shared wave capture and fit, save/edit/failure, dirty switch guard, keyboard and fullscreen');
        await page.setViewportSize({ width: 1440, height: 540 });
        for (const fullscreen of [false, true]) {
            if (await page.locator('#player-fullscreen').getAttribute('aria-pressed') !== String(fullscreen)) await page.locator('#player-fullscreen').click();
            for (const [label, kind, choice] of [['úsek', 'take', 'song'], ['pasáž', 'passage', 'passage_type']]) {
                await actions.getByRole('button', { name: label, exact: true }).click();
                await page.waitForFunction(kind => document.querySelector('.annotation-inline[open]')?.dataset.kind === kind, kind);
                if (kind === 'passage') {
                    await editor.locator('[data-choice=parent] > button').click();
                    await page.getByRole('option').filter({ hasText: 'Pokus' }).click();
                }
                await editor.locator('[data-choice=' + choice + '] > button').click();
                const popup = editor.locator('.annotation-choice-popup:not([hidden])');
                const visibility = await popup.evaluate(node => {
                    const box = node.getBoundingClientRect(), player = document.getElementById('looper-visuals').getBoundingClientRect();
                    const top = Math.max(box.top, player.top), bottom = Math.min(box.bottom, player.bottom);
                    return { overlap: bottom > top, visible: node.contains(document.elementFromPoint(box.x + box.width / 2, (top + bottom) / 2)) };
                });
                assert(visibility.overlap && visibility.visible, 'dropdown stays above the player: ' + choice + ', fullscreen=' + fullscreen);
                await page.screenshot({ path: path.join(previewDir, 'menu-' + choice + '-' + fullscreen + '.png') });
                await popup.getByRole('option').nth(1).click();
                assert.equal(await popup.count(), 0, 'selection closes the menu');
            }
        }
        console.log('PASS song and passage dropdowns remain clickable above the player, including fullscreen');


        await page.locator('#looper-view-slider').click();
        const peaksBeforeNextRecording = peakRequests;
        await page.locator('#player-close').evaluate(e => e.click());
        assert.equal(await state(), null);
        const audioDownloadsBeforeMissingWave = scriptAudioRequests;
        await page.locator('#recording-12 .recording-toggle').click();
        await page.locator('#recording-12 .recording-looper-entry').click();
        await page.waitForFunction(() => Vz2Player.getState()?.id === '12' && Vz2Player.getState().phase === 'ready');
        assert.equal(peakRequests, peaksBeforeNextRecording, 'slider skips peaks for a new recording even with wave previously enabled');
        await page.locator('#looper-view-segments').click();
        await page.waitForFunction(() => document.getElementById('looper-status').textContent.includes('Načítání křivky selhalo'));
        missingWaveStatus = 404;
        await page.locator('#looper-wave-retry').click();
        await page.waitForFunction(() => document.getElementById('looper-status').textContent.includes('JSON chybí'));
        const missingRequests = peakRequests;
        await page.locator('#looper-show-wave').uncheck();
        await page.locator('#looper-show-wave').check();
        await page.waitForFunction(() => document.getElementById('looper-status').textContent.includes('JSON chybí'));
        assert.equal(peakRequests, missingRequests + 1, 'reactivating wave retries missing JSON');
        assert.equal(scriptAudioRequests, audioDownloadsBeforeMissingWave, 'missing JSON never triggers a whole audio download for the Looper');
        await page.locator('#looper-play').click();
        const playingAudio = await page.evaluate(() => { window.creatingAudio = document.getElementById('looper-audio'); return creatingAudio.currentTime; });
        if (process.env.PLAYBACK_SCREENSHOT_DIR) {
            await page.setViewportSize({ width: 390, height: 844 });
            await page.screenshot({ path: path.join(process.env.PLAYBACK_SCREENSHOT_DIR, 'wave-create-mobile.png') });
            await page.setViewportSize({ width: 1440, height: 900 });
        }
        await page.locator('#looper-wave-create').click();
        await page.waitForFunction(() => document.getElementById('looper-wave-create').hidden);
        await page.waitForFunction(() => document.querySelector('#looper-segments .segment-wave'));
        assert.equal(scriptAudioRequests, audioDownloadsBeforeMissingWave + 1, 'explicit creation downloads audio once');
        assert.equal(peakWrites, 1, 'created peaks are shared with the server');
        assert(await page.evaluate(() => creatingAudio === document.getElementById('looper-audio') && !creatingAudio.paused), 'creation preserves the playing audio element');
        assert((await state()).position >= playingAudio, 'creation does not reset playback');
        await page.locator('#looper-play').click();
        const generatedRequests = peakRequests;
        await page.locator('#looper-view-wave').click();
        await page.locator('#looper-show-wave').uncheck();
        await page.locator('#looper-show-wave').check();
        await page.locator('#looper-view-segments').click();
        assert.equal(peakRequests, generatedRequests, 'generated waveform is reused between views');
        assert.equal(scriptAudioRequests, audioDownloadsBeforeMissingWave + 1);
        console.log('PASS waveform recovery: server error, missing JSON, retry, explicit creation, one audio download, shared peaks and uninterrupted playback');

        await toggle.click();
        assert.equal(await page.locator('#looper-visuals').count(), 1);
        assert.equal(await page.locator('#looper-segments .segment-note').count(), 0);
        assert.equal(await page.evaluate(() => originalAudio.isConnected), false);
        assert.equal(await page.locator('.annotation-inline').count(), 0, 'closing the recording cleans up the inline editor');
        assert.match(await page.locator('#looper-segments').textContent(), /zatím nemá časové značky/);
        writable = false;
        await reload.click();
        await page.waitForFunction(() => document.querySelector('#looper-action-row > .looper-timestamp-actions').textContent && document.querySelector('#looper-action-row > .looper-timestamp-actions > button:nth-child(2)').hidden);
        assert(await reload.isVisible(), 'refresh remains available in read-only mode');
        assert.deepEqual(errors, []);
        console.log('PASS close/reopen cleanup, empty recording, read-only controls, no JavaScript errors');
    } catch (error) {
        console.error('Page errors:', errors);
        if (process.env.PLAYBACK_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.PLAYBACK_SCREENSHOT_DIR, 'playback-failure.png') }).catch(() => {});
        throw error;
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
