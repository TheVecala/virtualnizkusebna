'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
(async () => {
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let revision = 1, writes = [], fail = false, delayRead = false;
    let entries = [{ id: 1, recording_id: 1, kind: 'song_start', time_ms: 25000, body: 'Pokus 1', revision: 1, can_edit: true, can_delete: true },
        { id: 2, recording_id: 1, kind: 'song_end', time_ms: 190000, paired_timestamp_id: 1, body: '↓', revision: 1, can_edit: true, can_delete: true },
        { id: 3, recording_id: 1, kind: 'passage', time_ms: 72000, end_time_ms: 96000, parent_timestamp_id: 1, body: 'Refrén', passage_type: 'chorus', revision: 1, can_edit: true, can_delete: true },
        ...Array.from({ length: 12 }, (_, i) => ({ id: 10 + i, recording_id: 1, kind: 'note', time_ms: 200000 + i * 1000, body: 'Poznámka ' + i, revision: 1, can_edit: true, can_delete: true }))];
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/*', async route => {
        if (new URL(route.request().url()).pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<html lang="cs" data-theme="light"><meta name="viewport" content="width=device-width, initial-scale=1"><script>window.VZ2={csrf:"test",write:true}</script><body></body></html>' });
        if (!route.request().url().includes('vz2_timestamps.php')) return route.abort();
        const f = route.request().postDataJSON();
        if (fail) return route.abort();
        if (f) {
            if (f.timestamps_revision !== revision) return route.fulfill({ status: 409, json: { ok: false, error: 'Značky se mezitím změnily.' } });
            writes.push(f); revision++;
            if (f.kind === 'note') {
                const entry = { id: f.id || 50, recording_id: 1, ...f, revision, can_edit: true, can_delete: true };
                entries = [...entries.filter(e => e.id !== entry.id), entry];
            }
        } else if (delayRead) await new Promise(r => setTimeout(r, 250));
        await route.fulfill({ json: { ok: true, recording_id: 1, source_filename: 'Zkouška 2. 11. · Nahrávka 1', duration_ms: 2900000, can_create: true,
            timestamps_revision: revision, entries, songs: Array.from({ length: 35 }, (_, i) => ({ id: i + 1, title: 'Skladba ' + (i + 1), lifecycle: 'active' })) } });
    });
    const editor = page.locator('.vz2-annotation-editor');
    const open = async (options = {}) => page.evaluate(options => Vz2TimestampEditor.open({ recording_id: 1, adapter: window.adapter, ...options }), options);
    const close = async () => { await editor.locator('.annotation-close').click(); await editor.waitFor({ state: 'hidden' }); };
    const choose = async (name, text) => {
        await editor.locator('[data-choice="' + name + '"] > button').click();
        await page.getByRole('option', { name: text, exact: true }).click();
    };
    try {
        await page.goto('http://annotation.test/');
        for (const name of ['themes', 'vz2', 'vz2-workspaces', 'vz2-timestamp-editor']) await page.addStyleTag({ path: path.join(root, 'css', name + '.css') });
        for (const name of ['vz2-timestamp-model', 'vz2-timestamp-store', 'vz2-timestamp-controls', 'vz2-timestamp-editor']) await page.addScriptTag({ path: path.join(root, 'js', name + '.js') });
        await page.evaluate(() => {
            window.position = 734567; window.playing = true;
            window.adapter = { currentTimeMs: () => position, durationMs: () => 2900000, canPlay: () => true,
                seek: ms => { position = ms; }, isPlaying: () => playing, pause: () => { playing = false; }, play: () => { playing = true; },
                waveform: () => ({ duration_ms: 2900000, peaks: Array.from({ length: 2000 }, (_, i) => .1 + Math.abs(Math.sin(i * .17)) * .7) }) };
        });
        delayRead = true;
        await page.evaluate(() => { window.openPromise = Vz2TimestampEditor.open({ recording_id: 1, kind: 'take', adapter }); position = 740000; });
        await page.evaluate(() => openPromise); delayRead = false;
        assert.equal(await editor.locator('[data-goto=start]').textContent(), '12:14', 'captures at click before fetching');
        assert.equal(await page.evaluate(() => playing), true, 'opening preserves playback');
        await editor.getByRole('button', { name: 'Pozastavit', exact: true }).click();
        assert.equal(await page.evaluate(() => playing), false);
        await editor.getByRole('button', { name: 'Vpřed o 5 sekund' }).click();
        assert.equal(await page.evaluate(() => position), 745000);
        await editor.locator('[data-capture=end]').click();
        await editor.locator('[data-goto=start]').click();
        assert.equal(await page.evaluate(() => position), 734567, 'time button still seeks; it does not capture');
        assert.equal(await editor.locator('[data-goto=end]').textContent(), '12:25');
        await editor.locator('[data-goto=end]').click();
        assert.equal(await page.evaluate(() => position), 745000);
        await editor.getByRole('button', { name: 'Přiblížit křivku' }).click();
        await editor.getByRole('button', { name: 'Přiblížit křivku' }).click();
        await page.waitForFunction(() => Number(document.querySelector('.annotation-wave').dataset.viewStart) > 0);
        const viewport = await editor.locator('.annotation-wave').evaluate(w => [Number(w.dataset.viewStart), Number(w.dataset.viewEnd)]);
        assert(Math.abs((viewport[0] + viewport[1]) / 2 - 745000) < 1, 'zoom centers on current playback');
        await editor.locator('[data-choice=song] > button').click();
        await page.getByRole('searchbox', { name: 'Hledat: Skladba' }).press('Escape');
        assert(await editor.isVisible(), 'escape closes menu, not the editor');
        await choose('song', 'Skladba 12');
        assert.equal(await editor.locator('select:visible').count(), 0, 'no native selectors');
        await editor.locator('[name=label]').fill('Pokus 2');
        await editor.locator('.annotation-note-open').click();
        await page.locator('.annotation-note-dialog textarea').fill('Doplňující <img src=x> poznámka');
        await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
        assert.equal(await editor.locator('.annotation-note-open.has-note').count(), 1);
        assert(await editor.locator('.annotation-reference ol').evaluate(e => e.scrollHeight > e.clientHeight));
        assert.equal(await editor.locator('.annotation-reference img').count(), 0);
        const previewDir = path.join(root, '_pomocne/dist/ui-a5'); fs.mkdirSync(previewDir, { recursive: true });
        await page.screenshot({ path: path.join(previewDir, 'mobile.png') });
        await page.evaluate(() => document.documentElement.dataset.theme = 'dark');
        await page.screenshot({ path: path.join(previewDir, 'mobile-dark.png') });
        await page.evaluate(() => document.documentElement.dataset.theme = 'light');
        await editor.getByRole('button', { name: 'Uložit pokus', exact: true }).click(); await editor.waitFor({ state: 'hidden' });
        assert.deepEqual([writes.at(-1).time_ms, writes.at(-1).end_time_ms, writes.at(-1).song_collection_id], [734567, 745000, 12]);
        assert.equal(writes.at(-1).note_text, 'Doplňující <img src=x> poznámka');
        console.log('PASS capture before async load, same player, zoom anchor, custom selector, note dialog, timestamp reference, exact save');
        await open({ kind: 'passage' });
        await editor.locator('.annotation-fine').evaluate(e => e.open = true);
        await editor.locator('[name=start]').fill('chybny cas');
        await editor.locator('[name=start]').press('Tab');
        const writeCount = writes.length;
        await editor.locator('.annotation-save').click();
        assert.equal(writes.length, writeCount, 'invalid manual time cannot silently save old value');
        await editor.locator('[data-capture=start]').click();
        await choose('passage_type', 'Refrén'); await choose('parent', '00:25 · Pokus 1');
        await page.evaluate(() => position = 77000); await editor.locator('[data-capture=start]').click();
        await page.evaluate(() => position = 74000); await editor.locator('[data-capture=end]').click();
        await editor.locator('.annotation-save').click();
        assert.match(await editor.locator('.annotation-time-error').textContent(), /Konec musí/);
        await page.evaluate(() => position = 78000); await editor.locator('[data-capture=end]').click();
        revision++;
        await editor.locator('.annotation-save').click(); await editor.locator('.interval-reload').waitFor({ state: 'visible' });
        const draft = await editor.locator('[name=label]').inputValue();
        await editor.locator('.interval-reload').click(); await editor.locator('.annotation-rebase').click();
        assert.equal(await editor.locator('[name=label]').inputValue(), draft);
        await editor.locator('.annotation-save').click(); await editor.waitFor({ state: 'hidden' });
        assert.equal(writes.at(-1).parent_timestamp_id, 1);
        assert.equal(writes.at(-1).passage_type, 'chorus');
        console.log('PASS invalid interval, conflict comparison and explicit rebase preserve draft and parent');
        await open({ kind: 'note' });
        await editor.locator('[name=label]').fill('Bodová poznámka');
        fail = true; await editor.locator('.annotation-save').click(); await editor.locator('.annotation-error').filter({ hasText: /fetch/i }).waitFor();
        assert.equal(await editor.locator('[name=label]').inputValue(), 'Bodová poznámka'); fail = false;
        await editor.locator('.annotation-save').click(); await editor.waitFor({ state: 'hidden' });
        const noteTime = writes.at(-1).time_ms;
        await open({ item_id: 't50' }); await editor.locator('[name=label]').fill('Upravená poznámka');
        await editor.locator('.annotation-save').click(); await editor.waitFor({ state: 'hidden' });
        assert.equal(writes.at(-1).time_ms, noteTime);
        console.log('PASS note creates/edits with exact time and retains text after network failure');
        for (const [width, height] of [[320, 568], [390, 844], [390, 420], [390, 320], [844, 390], [1440, 1000]]) {
            await page.setViewportSize({ width, height }); await open();
            const boxes = await editor.evaluate(e => {
                const box = e.getBoundingClientRect(), footer = e.querySelector('.annotation-footer').getBoundingClientRect(), wave = e.querySelector('.annotation-wave').getBoundingClientRect();
                return { left: box.left, right: box.right, bottom: footer.bottom, waveTop: wave.top, overflow: e.scrollWidth > e.clientWidth };
            });
            assert(boxes.left >= 0 && boxes.right <= width + 1 && boxes.bottom <= height + 1 && boxes.waveTop >= 0 && !boxes.overflow, JSON.stringify({ width, height, boxes }));
            const boundaryLayout = await editor.evaluate(e => {
                const selectors = ['[data-goto=start]', '[data-capture=start]', '[data-goto=end]', '[data-capture=end]', '.annotation-fine summary'];
                return selectors.map(selector => { const b = e.querySelector(selector), r = b.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, width: r.width, textFits: b.scrollWidth <= b.clientWidth }; });
            });
            assert(boundaryLayout.every(b => Math.abs(b.top - boundaryLayout[0].top) < 1 && b.left >= 0 && b.right <= width && b.textFits), 'five boundary controls fit one row at ' + width);
            assert(boundaryLayout.every((b, i) => !i || b.left >= boundaryLayout[i - 1].right), 'boundary control order');
            assert.equal(await editor.locator('[data-capture=start]').textContent(), 'Nastavit');
            assert.equal(await editor.locator('[data-goto=end]').textContent(), '—');
            assert((await editor.locator('#annotation-title').boundingBox()).height <= 1, 'heading has no visible row');
            await editor.locator('.annotation-fine summary').click();
            assert(await editor.locator('[name=start]').isVisible(), 'icon opens fine tuning');
            await editor.locator('.annotation-fine summary').click();
            assert.equal(await editor.locator('[name=start]').isVisible(), false);
            await editor.locator('[data-choice=song] > button').click();
            await page.getByRole('searchbox', { name: 'Hledat: Skladba' }).fill('Skladba 30');
            await page.getByRole('option', { name: 'Skladba 30', exact: true }).click();
            await close();
        }
        await page.setViewportSize({ width: 1440, height: 1000 }); await open({ item_id: 't3' });
        await page.screenshot({ path: path.join(previewDir, 'desktop.png') }); await close();
        console.log('PASS mobile, narrow viewport, keyboard-sized viewport, landscape, desktop and dropdown reachability');
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
