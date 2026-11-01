'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');

(async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath() });
    const page = await browser.newPage();
    const errors = [], requests = [];
    page.on('pageerror', e => errors.push(e.message));
    let release, started = false;
    const gate = new Promise(resolve => { release = resolve; });
    await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<script>window.VZ2 = {cachePrefix:"audio-test:"}</script>' });
        requests.push(url.pathname);
        if (url.pathname === '/held') { started = true; await gate; }
        if (url.pathname === '/missing') return route.fulfill({ status: 404, body: 'missing' });
        if (url.pathname === '/network') return route.abort();
        return route.fulfill({ contentType: 'audio/wav', body: 'audio' });
    });
    try {
        await page.goto('http://audio.test/');
        for (const name of ['vz2-cache', 'vz2-downloads']) await page.addScriptTag({ path: path.join(root, 'js/' + name + '.js') });
        await page.evaluate(async () => {
            window.file = { id: 1, sha256: 'a'.repeat(64), byte_size: 5, url: '/audio' };
            window.db = idbKeyval.createStore('zkusebna-vz2-cache', 'audio');
            await idbKeyval.set(Vz2Downloads.key(file), new Blob(['audio']), db);
        });
        const local = await page.evaluate(async () => {
            const source = await Vz2Downloads.source(file, { download: true });
            const body = await (await fetch(source.url)).text();
            let revocations = 0;
            const revoke = URL.revokeObjectURL;
            URL.revokeObjectURL = url => { revocations++; revoke(url); };
            source.release(); source.release(); URL.revokeObjectURL = revoke;
            return { local: source.local, blob: source.blob.size, storageError: source.storageError, body, revocations };
        });
        assert.deepEqual(local, { local: true, blob: 5, storageError: false, body: 'audio', revocations: 1 });
        assert.deepEqual(requests, [], 'complete existing copy does not use HTTP');

        const fallback = await page.evaluate(async () => {
            // A different version or environment must not reuse this copy.
            const version = await Vz2Downloads.source({ ...file, sha256: 'b'.repeat(64) });
            VZ2.cachePrefix = 'another-environment:';
            const environment = await Vz2Downloads.source(file);
            VZ2.cachePrefix = 'audio-test:';
            await idbKeyval.set(Vz2Downloads.key(file), new Blob(['bad']), db);
            const incomplete = await Vz2Downloads.source(file);
            const decoded = await Vz2Downloads.read(file, { download: true });
            const unknownSize = await Vz2Downloads.read({ ...file, id: 2, byte_size: null }, { download: true });
            return { version: version.url, environment: environment.url, incomplete: incomplete.url,
                downloaded: decoded.blob.size, local: decoded.local, unknownSize: unknownSize.blob.size,
                storedSize: (await idbKeyval.get(Vz2Downloads.key(file), db)).size,
                inventory: (await Vz2Downloads.inventory()).length };
        });
        assert.deepEqual(fallback, { version: '/audio', environment: '/audio', incomplete: '/audio', downloaded: 5, local: false, unknownSize: 5, storedSize: 3, inventory: 1 });
        assert.equal(requests.length, 2, 'stream selection is lazy; only explicit full reads transfer audio');

        const unavailable = await page.evaluate(async () => {
            const get = idbKeyval.get;
            idbKeyval.get = async () => { throw new DOMException('Unavailable', 'SecurityError'); };
            try {
                const streamed = await Vz2Downloads.source(file);
                const memory = await Vz2Downloads.source(file, { download: true });
                const body = await (await fetch(memory.url)).text(); memory.release();
                return { url: streamed.url, storageError: streamed.storageError, local: memory.local, body };
            } finally { idbKeyval.get = get; }
        });
        assert.deepEqual(unavailable, { url: '/audio', storageError: true, local: false, body: 'audio' });
        console.log('PASS audio source: local priority, version/environment isolation, size validation, lazy streaming, memory-only download and unavailable storage');

        const beforeAbort = requests.length;
        const late = await page.evaluate(async () => {
            const get = idbKeyval.get, create = URL.createObjectURL;
            let resolve, urls = 0;
            idbKeyval.get = () => new Promise(done => { resolve = done; });
            URL.createObjectURL = blob => { urls++; return create(blob); };
            const controller = new AbortController();
            try {
                const pending = Vz2Downloads.source(file, { download: true, signal: controller.signal }).catch(e => e.name);
                controller.abort(); resolve(null);
                const name = await pending;
                const preAborted = await Vz2Downloads.source(file, { signal: controller.signal }).catch(e => e.name);
                return { name, preAborted, urls };
            } finally { idbKeyval.get = get; URL.createObjectURL = create; }
        });
        assert.deepEqual(late, { name: 'AbortError', preAborted: 'AbortError', urls: 0 });
        assert.equal(requests.length, beforeAbort, 'late storage read cannot start a cancelled download');

        await page.evaluate(() => {
            window.controller = new AbortController();
            window.playback = Vz2Downloads.read({ ...file, id: 3, url: '/held' }, { download: true, signal: controller.signal }).catch(e => e.name);
        });
        const deadline = Date.now() + 5000;
        while (!started && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
        assert(started, 'playback transfer started');
        const abort = await page.evaluate(async () => {
            // Playback cancellation must leave the independently requested offline queue alive.
            const saved = Vz2Downloads.enqueue({ ...file, id: 4 });
            controller.abort();
            return { playback: await playback, saved: (await saved).size, absent: await Vz2Downloads.local({ ...file, id: 3 }) };
        });
        release();
        assert.deepEqual(abort, { playback: 'AbortError', saved: 5, absent: null });
        const failures = await page.evaluate(async () => {
            const outcomes = [];
            for (const data of [{ url: '/missing' }, { url: '/network' }, { url: '/short', byte_size: 10 }]) {
                try { await Vz2Downloads.read({ ...file, id: 5, ...data }, { download: true }); outcomes.push('unexpected success'); }
                catch (e) { outcomes.push(e.message); }
            }
            return outcomes;
        });
        assert.match(failures[0], /není dostupné/); assert.match(failures[1], /selhalo/); assert.match(failures[2], /celé/);
        assert.deepEqual(errors, []);
        console.log('PASS audio cancellation: before/during storage, active HTTP, independent save queue; HTTP/network/size errors are rejected');
    } finally { release(); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
