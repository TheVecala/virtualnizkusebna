'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
(async () => {
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath(), headless: true });
    const page = await browser.newPage(), errors = [], counts = new Map();
    let fail = true, release, started = false, revision = 1, getRelease, getStarted = false;
    const gate = new Promise(r => { release = r; });
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.accept());
    await page.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<div id="manager"></div><script>window.VZ2={csrf:"test",cachePrefix:"shared-test:",write:true}</script>' });
        if (url.pathname.startsWith('/file')) {
            const id = Number(url.pathname.slice(5)); counts.set(id, (counts.get(id) || 0) + 1);
            if (id === 3 && fail) return route.fulfill({ status: 503, body: 'error' });
            if (id === 4) { started = true; await gate; }
            return route.fulfill({ contentType: 'audio/wav', body: 'audio' });
        }
        if (url.pathname.endsWith('vz2_timestamps.php')) {
            const fields = route.request().postDataJSON();
            const captured = revision;
            if (!fields && getRelease) { getStarted = true; await getRelease.promise; }
            if (fields) {
                if (fields.timestamps_revision !== revision) return route.fulfill({ status: 409, json: { ok: false, error: 'Konflikt' } });
                revision++;
            }
            return route.fulfill({ json: { ok: true, recording_id: 1, timestamps_revision: fields ? revision : captured, can_create: true,
                entries: [{ id: 1, recording_id: 1, kind: 'passage', time_ms: 1000, end_time_ms: 2000, body: 'Refrén', revision: fields ? revision : captured, can_edit: true, can_delete: true }], songs: [] } });
        }
        return route.abort();
    });
    try {
        await page.goto('http://shared.test/');
        for (const name of ['themes', 'vz2', 'vz2-timestamp-editor']) await page.addStyleTag({ path: path.join(root, 'css/' + name + '.css') });
        for (const name of ['vz2-cache', 'vz2-downloads', 'vz2-downloads-panel', 'vz2-timestamp-model', 'vz2-timestamp-store', 'vz2-timestamp-playback', 'vz2-note-editor', 'vz2-timestamp-controls', 'vz2-timestamp-editor', 'vz2-timestamps']) await page.addScriptTag({ path: path.join(root, 'js/' + name + '.js') });
        await page.evaluate(() => {
            window.files = [1,2,3,4,5].map(id => ({ id, sha256: 'a'.repeat(64), byte_size: 5, original_name: 'Track ' + id, url: '/file' + id }));
            window.catalog = { collections: [{ id: 1, title: 'Zkouška' }], recordings: [{ id: 1, collection_id: 1, title: 'Mix', lifecycle: 'active', kind: 'multitrack', files: files.slice(0,3) }] };
            Vz2DownloadsPanel.mount(document.querySelector('#manager'), () => catalog).open();
        });
        await page.evaluate(async () => {
            const p1 = Vz2Downloads.enqueue(files[0]), p2 = Vz2Downloads.enqueue(files[0]);
            if (p1 !== p2) throw Error('Duplicate queue task');
            await Promise.all([p1, p2]);
            await Vz2Downloads.enqueue(files[0]);
        });
        assert.equal(counts.get(1), 1, 'one download for duplicate and already saved file');
        await page.getByRole('button', { name: 'Vybrat zobrazené', exact: true }).click();
        await page.waitForFunction(() => document.querySelector('#manager').textContent.includes('1 v zařízení'));
        await page.getByRole('button', { name: 'Zařadit vybrané do fronty' }).click();
        await page.waitForFunction(() => Vz2Downloads.snapshot().some(t => t.file.id === 3 && t.state === 'failed'));
        assert.equal(await page.evaluate(async () => (await Vz2Downloads.inventory()).length), 2, 'failure preserves completed tracks');
        assert.match(await page.locator('#manager').textContent(), /2\/3 · neúplná/);
        fail = false;
        await page.getByRole('button', { name: 'Opakovat', exact: true }).click();
        await page.waitForFunction(() => Vz2Downloads.snapshot().find(t => t.file.id === 3)?.state === 'complete');
        assert.equal(counts.get(1), 1); assert.equal(counts.get(2), 1); assert.equal(counts.get(3), 2);
        // Cancel a queued task and an active download; a removed file cannot be resurrected.
        await page.evaluate(() => { void Vz2Downloads.enqueue(files[3]); void Vz2Downloads.enqueue(files[4]); });
        while (!started) await new Promise(r => setTimeout(r, 10));
        await page.evaluate(async () => { await Vz2Downloads.cancel(Vz2Downloads.key(files[4])); await Vz2Downloads.removeKey(Vz2Downloads.key(files[3])); });
        release();
        assert.equal(counts.get(5), undefined);
        assert.equal(await page.evaluate(async () => !!await Vz2Downloads.local(files[3])), false);
        await page.evaluate(async () => {
            const source = await Vz2Downloads.source(files[0]);
            if (!source.local || !source.url.startsWith('blob:')) throw Error('Local audio not preferred'); source.release();
        });
        assert.equal(counts.get(1), 1);
        console.log('PASS queue: deduplication, bulk selection, partial mixer, retry, cancellation, local source');
        // A late GET must not overwrite the revision returned by a completed mutation.
        await page.evaluate(() => Vz2TimestampStore.load(1));
        getRelease = {}; getRelease.promise = new Promise(r => { getRelease.resolve = r; });
        await page.evaluate(() => { window.oldLoad = Vz2TimestampStore.load(1); });
        while (!getStarted) await new Promise(r => setTimeout(r, 10));
        await page.evaluate(() => Vz2TimestampStore.save(1, { timestamps_revision: 1, action: 'save_interval' }));
        getRelease.resolve(); getRelease = null;
        await page.evaluate(() => oldLoad);
        assert.equal(await page.evaluate(() => Vz2TimestampStore.peek(1).timestamps_revision), 2);
        // Open the real interval editor without mounting a timestamp list. Conflict preserves draft.
        await page.evaluate(() => Vz2TimestampEditor.open({ recording_id: 1, item_id: 't1' }));
        await page.locator('[name=label]').fill('Rozepsaný refrén');
        revision++;
        await page.locator('.vz2-interval-editor [type=submit]').click();
        await page.waitForFunction(() => document.querySelector('.vz2-interval-editor .annotation-error').textContent.includes('Konflikt'));
        assert.equal(await page.locator('[name=label]').inputValue(), 'Rozepsaný refrén');
        await page.locator('.interval-reload').click();
        await page.locator('.annotation-rebase').click();
        await page.locator('.vz2-interval-editor [type=submit]').click();
        await page.waitForFunction(() => !document.querySelector('.vz2-interval-editor'));
        assert.equal(await page.evaluate(() => Vz2TimestampStore.peek(1).timestamps_revision), 4);
        console.log('PASS timestamp service: stale reads, shared editor without list, conflict and explicit rebase');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.addStyleTag({ path: path.join(root, 'css/vz2.css') });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        // Quota failure keeps already saved audio, and a reload offers retry without network traffic.
        await page.evaluate(async () => {
            const set = idbKeyval.set;
            idbKeyval.set = async (key, value, db) => { if (key.includes('audio:5:')) throw new DOMException('No space', 'QuotaExceededError'); return set(key, value, db); };
            try { await Vz2Downloads.enqueue(files[4]); } catch (_) {}
            idbKeyval.set = set;
        });
        assert.match(await page.evaluate(() => Vz2Downloads.snapshot().find(t => t.file.id === 5).error), /dost místa/);
        assert.equal(await page.evaluate(async () => (await Vz2Downloads.inventory()).length), 3);
        const requestsBeforeReload = counts.get(5);
        await page.reload();
        for (const name of ['vz2-cache', 'vz2-downloads']) await page.addScriptTag({ path: path.join(root, 'js/' + name + '.js') });
        assert.equal(await page.evaluate(() => Vz2Downloads.snapshot().find(t => t.file.id === 5)?.state), 'interrupted');
        assert.equal(counts.get(5), requestsBeforeReload);
        assert.equal(await page.evaluate(async () => (await Vz2Downloads.inventory()).length), 3);
        console.log('PASS storage: quota failure preserves audio; pending tasks survive reload without automatic transfer');
        assert.deepEqual(errors, []);
    } finally { release(); getRelease?.resolve(); await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
