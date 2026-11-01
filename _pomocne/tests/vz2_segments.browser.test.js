'use strict';
// Application assets with isolated catalogue, peaks and silent-audio fixtures; no live writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const fixture = require('./vz2_segments.fixture.js');
const php = fs.readFileSync(path.join(root, 'useky.php'), 'utf8');
const html = php.slice(php.indexOf('<!doctype html>')).replace(/<\?[\s\S]*?\?>/g, '').replace('data-theme=""', 'data-theme="dark"');
const wav = Buffer.alloc(44 + 8000 * 420 * 2);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
(async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath() });
    try {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        const page = await context.newPage(), errors = [], requests = [];
        let failCatalog = false;
        page.on('pageerror', e => errors.push(e.message));
        await page.route('**/*', async route => {
            const url = new URL(route.request().url()), pathname = url.pathname;
            requests.push({ path: pathname, method: route.request().method() });
            if (pathname === '/useky.php') return route.fulfill({ contentType: 'text/html', body: html });
            if (pathname === '/php/ajax/vz2.php') return route.fulfill({ status: failCatalog ? 503 : 200, json: failCatalog ? { ok: false, error: 'Test nedostupnosti' } : fixture });
            if (pathname === '/php/ajax/vz2_peaks.php') return route.fulfill({ json: { ok: true, peaks: Array.from({ length: 500 }, (_, i) => .15 + Math.abs(Math.sin(i * .33)) * .65), duration_ms: url.searchParams.get('id') === '12' ? 360000 : 420000 } });
            if (pathname === '/sample.wav') {
                const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range || '');
                const start = range ? Number(range[1]) : 0, end = range && range[2] ? Math.min(Number(range[2]), wav.length - 1) : wav.length - 1;
                return route.fulfill({ status: range ? 206 : 200, contentType: 'audio/wav', body: wav.subarray(start, end + 1),
                    headers: { 'Accept-Ranges': 'bytes', 'Content-Length': String(end - start + 1), ...(range ? { 'Content-Range': `bytes ${start}-${end}/${wav.length}` } : {}) } });
            }
            const file = path.join(root, pathname);
            if (pathname.startsWith('/js/') || pathname.startsWith('/css/')) return route.fulfill({ contentType: pathname.endsWith('.js') ? 'text/javascript' : 'text/css', body: fs.readFileSync(file) });
            return route.fulfill({ status: 404, body: 'Not found' });
        });
        await page.goto('http://segments.test/useky.php');
        await page.locator('.segment-recording').waitFor();
        assert.equal(await page.locator('.segment-range').count(), 9);
        assert.equal(await page.locator('.segment-point').count(), 2);
        assert.equal(requests.filter(r => r.path.includes('peaks') || r.path === '/sample.wav').length, 0, 'no media downloads before opt-in');
        await page.locator('[data-segment-id="t10"]').click();
        assert.equal(await page.locator('#segments-selected-title').textContent(), 'Refrén');
        assert.equal(await page.locator('#segments-selected-time').textContent(), '04:30 – 05:00');
        assert.match(await page.locator('#segments-open').getAttribute('href'), /recording_id=11.*time_ms=270000/);
        await page.locator('#segments-view').selectOption('stack');
        await page.locator('input[name="segment-recording"][value="12"]').check();
        assert.equal(await page.locator('.segment-recording').count(), 2);
        const widths = () => page.locator('.segment-baseline .segment-item').evaluateAll(items => items.map(i => i.getBoundingClientRect().width));
        let sizes = await widths(); assert(Math.abs(sizes[1] / sizes[0] - 360 / 420) < .001, 'common time scale');
        await page.locator('#segments-scale').selectOption('fit'); sizes = await widths(); assert(Math.abs(sizes[1] - sizes[0]) < 1, 'fit each recording');
        await page.locator('#segments-color').selectOption('song');
        const color = await page.locator('[data-segment-id="t1"]').first().evaluate(e => e.style.getPropertyValue('--segment-color'));
        assert.equal(await page.locator('[data-segment-id="t9"]').evaluate(e => e.style.getPropertyValue('--segment-color')), color, 'passage inherits song color');
        await page.locator('#segments-takes').uncheck(); assert.equal(await page.locator('.segment-take').count(), 0); assert.equal(await page.locator('.segment-passage').count(), 4);
        await page.locator('#segments-takes').check();
        await page.locator('#segments-wave').check(); await page.waitForFunction(() => document.querySelectorAll('.segment-wave').length === 2);
        await page.locator('#segments-zoom').selectOption('4');
        assert(await page.locator('.segment-scroll').evaluate(e => e.scrollWidth > e.clientWidth * 3.9));
        await page.locator('#segments-zoom').selectOption('1');
        await page.locator('#segments-color').selectOption('type');
        await page.locator('#segments-scale').selectOption('shared');
        const screenshots = process.env.SEGMENTS_SCREENSHOT_DIR;
        if (screenshots) { fs.mkdirSync(screenshots, { recursive: true }); await page.screenshot({ path: path.join(screenshots, 'segments-desktop.png'), fullPage: true }); }
        // Actual media transport and interval boundary behavior.
        await page.locator('[data-segment-id="t1"]').first().click();
        await page.locator('#segments-play').click();
        await page.waitForFunction(() => { const a = document.querySelector('audio'); return !a.paused && a.readyState >= 2 && !a.seeking && a.currentTime >= 10 && a.currentTime < 12; }).catch(async e => {
            console.error(await page.locator('audio').evaluate(a => ({ src: a.currentSrc, ready: a.readyState, paused: a.paused, current: a.currentTime, seeking: a.seeking, network: a.networkState, error: a.error?.message, status: document.querySelector('#segments-audio-status').textContent })));
            throw e;
        });
        await page.evaluate(() => { document.querySelector('audio').currentTime = 65.1; });
        await page.waitForFunction(() => document.querySelector('audio').paused, null, { timeout: 5000 }).catch(async e => {
            console.error(await page.locator('audio').evaluate(a => ({ ready: a.readyState, paused: a.paused, current: a.currentTime, seeking: a.seeking, error: a.error?.message, loop: document.querySelector('#segments-loop').checked, selected: document.querySelector('#segments-selected-time').textContent })));
            throw e;
        });
        assert(Math.abs(await page.locator('audio').evaluate(a => a.currentTime) - 65) < .05);
        await page.locator('#segments-loop').check(); await page.locator('#segments-play').click();
        await page.evaluate(() => { document.querySelector('audio').currentTime = 65.1; });
        await page.waitForFunction(() => { const a = document.querySelector('audio'); return !a.paused && a.currentTime < 11; });
        await page.locator('[data-segment-id="t14"]').click();
        assert(await page.locator('audio').evaluate(a => a.paused), 'new selection stops old playback');
        assert(await page.locator('#segments-loop').isDisabled(), 'point markers cannot loop');
        await page.setViewportSize({ width: 390, height: 844 });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mobile has no page overflow');
        await page.locator('#segments-compact').check();
        if (screenshots) await page.screenshot({ path: path.join(screenshots, 'segments-mobile.png'), fullPage: true });
        await page.locator('#segments-search').fill('bez značek'); assert.equal(await page.locator('.segments-recording-option').count(), 1);
        await page.locator('#segments-select-none').click(); await page.locator('input[name="segment-recording"][value="14"]').check();
        assert.match(await page.locator('.segment-panel').textContent(), /zatím nemá časové značky/);
        assert.match(await page.locator('.segment-panel').textContent(), /Délka neznámá/);
        await page.locator('#segments-search').fill('');
        await page.locator('#segments-view').selectOption('single'); await page.locator('input[name="segment-recording"][value="13"]').check();
        await page.locator('[data-segment-id="t7"]').click();
        assert(await page.locator('#segments-play').isDisabled(), 'multitrack never plays just the first track');
        assert.match(await page.locator('#segments-open').getAttribute('href'), /view=mixer/);
        // Untrusted labels remain text, updates use the shared event contract.
        await page.evaluate(() => document.dispatchEvent(new CustomEvent('vz2:timestamps-updated', { detail: { recording_id: 13, duration_ms: 420000, entries: [{ id: 999, time_ms: 10000, kind: 'note', body: '<img src=x onerror=alert(1)>' }] } })));
        assert.equal(await page.locator('.segment-panel img').count(), 0);
        await page.locator('[data-segment-id="t999"]').click();
        assert.equal(await page.locator('#segments-selected-title').textContent(), '<img src=x onerror=alert(1)>');
        failCatalog = true; await page.locator('#segments-reload').click();
        await page.waitForFunction(() => document.querySelector('#segments-status').textContent.includes('Test nedostupnosti'));
        assert.match(await page.locator('#segments-status').textContent(), /předchozího načtení/);
        assert(requests.every(r => r.method === 'GET'), 'panel never writes to shared data');
        assert.deepEqual(errors, []);
        console.log('PASS browser: selection, shared/fit scale, colors, filters, zoom, peaks, audio stop/loop, mobile, empty/multitrack, events, escaping, retry');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
