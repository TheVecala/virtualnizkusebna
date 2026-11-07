'use strict';
// Real application and media elements; isolated HTTP/IndexedDB fixtures, no live writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
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
let revision = 1, writable = true;
(async () => {
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true,
        args: ['--autoplay-policy=no-user-gesture-required'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/*', async route => {
        const url = new URL(route.request().url()), p = url.pathname;
        if (url.hostname !== 'playback.test') return route.abort();
        if (p === '/index.php') return route.fulfill({ contentType: 'text/html', body: html });
        if (/^\/(js|css|meat)\//.test(p)) return route.fulfill({ contentType: p.endsWith('.js') ? 'text/javascript' : p.endsWith('.css') ? 'text/css' : 'image/png', body: fs.readFileSync(path.join(root, p)) });
        if (p === '/sample.wav') {
            const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range || '');
            const start = range ? Number(range[1]) : 0, end = range?.[2] ? Math.min(Number(range[2]), wav.length - 1) : wav.length - 1;
            return route.fulfill({ status: range ? 206 : 200, contentType: 'audio/wav', body: wav.subarray(start, end + 1),
                headers: { 'accept-ranges': 'bytes', ...(range ? { 'content-range': `bytes ${start}-${end}/${wav.length}` } : {}) } });
        }
        if (p === '/php/ajax/vz2.php') return route.fulfill({ json: url.searchParams.get('action') === 'mixer' ? { ok: true, multitracks: [] } : catalog });
        if (p === '/php/ajax/vz2_peaks.php') return route.fulfill({ json: { ok: true, duration_ms: 40000, peaks: Array.from({ length: 200 }, (_, i) => .2 + Math.abs(Math.sin(i)) * .5) } });
        if (p === '/php/ajax/vz2_timestamps.php') {
            const data = route.request().postDataJSON();
            if (data) { revision++; entries.push(entry({ id: 100 + revision, kind: data.kind, time_ms: data.time_ms, body: data.body })); }
            const id = Number(url.searchParams.get('recording_id') || data?.recording_id);
            return route.fulfill({ json: { ok: true, recording_id: id, timestamps_revision: revision, duration_ms: 40000, can_create: writable, entries: id === 11 ? entries : [] } });
        }
        if (p === '/php/ajax/vz2_history.php') return route.fulfill({ json: { ok: true, songs: [], rehearsals: [], plays: [], unassigned_intervals: [], unassigned_clips: [] } });
        if (p === '/php/ajax/vz2_content.php') return route.fulfill({ json: { ok: true, document: null, version: null, posts: [], thread: { id: 1 }, can_edit: false } });
        return route.fulfill({ status: 204, body: '' });
    });
    const state = () => page.evaluate(() => Vz2Player.getState());
    const drawer = page.locator('#looper-timestamps'), actions = page.locator('#looper-panel > .looper-timestamp-actions');
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
        assert((await page.locator('#looper-seek').boundingBox()).y >= (await page.locator('.looper-header-controls').boundingBox()).y + (await page.locator('.looper-header-controls').boundingBox()).height);
        assert.equal(await actions.getByRole('button', { name: 'Export', exact: true }).count(), 0);
        const reload = actions.getByRole('button', { name: 'Obnovit značky', exact: true });
        assert(await reload.isVisible());
        assert.equal(await reload.evaluate(e => e.previousElementSibling.textContent), 'Přidat značku');
        await page.locator('#looper-view-wave').click();
        await page.locator('.looper-wave-marker').first().waitFor();
        assert(await page.locator('#looper-wave').isVisible());
        assert.equal(await drawer.isVisible(), false, 'wave works independently of the timestamp drawer');
        assert.equal(await drawer.locator('#looper-visuals, .looper-view-switch').count(), 0);
        assert.equal(await page.locator('#looper-seek').isVisible(), false, 'wave replaces the basic slider');
        await page.locator('#looper-play').click();
        await page.waitForFunction(() => Vz2Player.getState().playing);
        await page.evaluate(() => { window.originalAudio = document.getElementById('looper-audio'); });
        const before = (await state()).position;
        await page.locator('#looper-view-segments').click();
        assert.equal((await state()).playing, true);
        assert((await state()).position >= before && (await state()).position < before + 2);
        assert(await page.evaluate(() => originalAudio === document.getElementById('looper-audio')));
        assert.equal(await page.locator('#looper-wave').isVisible(), false);
        assert.equal(await page.locator('#looper-seek').isVisible(), false);
        assert.equal(await drawer.isVisible(), false, 'segments also work with the drawer closed');
        await page.locator('#looper-play').click();
        await page.locator('#looper-segments [data-segment-id="t1"]').click();
        assert(Math.abs((await state()).position - 3) < .1);
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
        for (const width of [320, 390, 767, 960, 1440]) {
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
                const bar = await actions.boundingBox();
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
        await page.locator('#player-close').evaluate(e => e.click());
        assert.equal(await state(), null);
        await page.locator('#recording-12 .recording-toggle').click();
        await page.locator('#recording-12 .recording-looper-entry').click();
        await page.waitForFunction(() => Vz2Player.getState()?.id === '12' && Vz2Player.getState().phase === 'ready');
        await toggle.click();
        assert.equal(await page.locator('#looper-visuals').count(), 1);
        assert.equal(await page.locator('#looper-segments .segment-note').count(), 0);
        assert.equal(await page.evaluate(() => originalAudio.isConnected), false);
        assert.match(await page.locator('#looper-segments').textContent(), /zatím nemá časové značky/);
        writable = false;
        await reload.click();
        await page.waitForFunction(() => document.querySelector('#looper-panel > .looper-timestamp-actions').textContent && document.querySelector('#looper-panel > .looper-timestamp-actions > button:nth-child(2)').hidden);
        assert(await reload.isVisible(), 'refresh remains available in read-only mode');
        assert.deepEqual(errors, []);
        console.log('PASS close/reopen cleanup, empty recording, read-only controls, no JavaScript errors');
    } catch (error) {
        console.error('Page errors:', errors);
        if (process.env.PLAYBACK_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.PLAYBACK_SCREENSHOT_DIR, 'playback-failure.png') }).catch(() => {});
        throw error;
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
