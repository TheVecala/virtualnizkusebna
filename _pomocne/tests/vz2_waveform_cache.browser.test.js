'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true });
    const context = await browser.newContext();
    let requests = 0;
    await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><body></body>' });
        if (url.pathname.endsWith('vz2_peaks.php')) {
            requests++;
            await new Promise(resolve => setTimeout(resolve, 60));
            return route.fulfill({ json: url.searchParams.get('id') === '1' ? { ok: true, duration_ms: 10000, peaks: [.1, .5, .3] } : { ok: false } });
        }
        return route.abort();
    });
    async function setup(page) {
        await page.goto('http://wave-cache.test/');
        await page.addScriptTag({ path: path.resolve(__dirname, '../../js/vz2-cache.js') });
        await page.addScriptTag({ path: path.resolve(__dirname, '../../js/vz2-timestamp-controls.js') });
        await page.evaluate(() => {
            window.VZ2 = { cachePrefix: 'test-wave:', write: false };
            window.file = { id: 1, sha256: 'a', url: '/audio', duration_ms: 10000 };
            window.downloads = 0; window.decodes = 0;
            window.Vz2Downloads = { read: async () => { downloads++; return { blob: new Blob(['audio']) }; } };
            window.AudioContext = class {
                async decodeAudioData() { decodes++; await new Promise(r => setTimeout(r, 30)); return { duration: 10, length: 4, numberOfChannels: 1, getChannelData: () => [.1, -.2, .4, .6] }; }
                async close() {}
            };
        });
    }
    try {
        const page = await context.newPage(); await setup(page);
        const result = await page.evaluate(async () => {
            const abort = new AbortController();
            const first = Vz2TimestampControls.fileWaveform(file, abort.signal, { decode: false });
            const others = [Vz2TimestampControls.fileWaveform(file, null, { decode: false }), Vz2TimestampControls.fileWaveform(file)];
            abort.abort();
            const results = await Promise.allSettled([first, ...others]);
            return { aborted: results[0].reason?.name, shared: results[1].value === results[2].value, downloads, decodes };
        });
        assert.deepEqual(result, { aborted: 'AbortError', shared: true, downloads: 0, decodes: 0 });
        assert.equal(requests, 1, 'concurrent consumers share one JSON request even when one closes');
        await page.evaluate(() => Vz2TimestampControls.fileWaveform(file));
        assert.equal(requests, 1, 'repeated activation uses memory');
        const second = await context.newPage(); await setup(second);
        await second.evaluate(() => Vz2TimestampControls.fileWaveform(file, null, { decode: false }));
        assert.equal(requests, 1, 'another page uses the shared IndexedDB cache');
        await second.evaluate(() => Vz2TimestampControls.fileWaveform({ ...file, sha256: 'b' }, null, { decode: false }));
        assert.equal(requests, 2, 'a replacement file gets its own peaks');
        assert.equal(await page.evaluate(() => Vz2TimestampControls.fileWaveform({ ...file, id: 2 }, null, { decode: false })), null);
        assert.equal(await page.evaluate(() => downloads), 0, 'missing JSON does not download audio without decode opt-in');
        const decoded = await page.evaluate(async () => {
            const f = { ...file, id: 2 }, blob = new Blob(['already loaded']);
            const data = await Promise.all([Vz2TimestampControls.fileWaveform(f, null, { blob }), Vz2TimestampControls.fileWaveform(f, null, { blob })]);
            return { shared: data[0] === data[1], downloads, decodes };
        });
        assert.deepEqual(decoded, { shared: true, downloads: 0, decodes: 1 });
        assert.equal(requests, 3, 'fallback decoding reuses the earlier JSON result');
        await second.evaluate(() => Vz2TimestampControls.fileWaveform({ ...file, id: 2 }, null, { decode: false }));
        assert.equal(requests, 3, 'generated peaks are cached across pages');
        console.log('PASS waveform cache: opt-in, concurrent requests, abort isolation, memory/IndexedDB reuse, file replacement and one decode from existing audio');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
