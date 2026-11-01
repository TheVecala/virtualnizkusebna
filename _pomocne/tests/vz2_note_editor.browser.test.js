'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
(async () => {
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath(), headless: true });
    const page = await browser.newPage();
    let revision = 1, rows = [], writable = true, networkFailure = false, lastWrite;
    const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('dialog', d => d.accept());
    await page.route('**/*', async route => {
        if (new URL(route.request().url()).pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<script>window.VZ2={csrf:"test",write:true}</script>' });
        if (networkFailure) return route.abort();
        const fields = route.request().postDataJSON();
        if (fields) {
            if (fields.timestamps_revision !== revision) return route.fulfill({ status: 409, json: { ok: false, error: 'Konflikt revizí' } });
            lastWrite = fields; revision++;
            const entry = { id: fields.id || 1, recording_id: 1, time_ms: fields.time_ms, body: fields.body, kind: 'note', revision, can_edit: writable, can_delete: writable };
            rows = [entry];
        }
        return route.fulfill({ json: { ok: true, recording_id: 1, entries: rows, timestamps_revision: revision, can_create: writable } });
    });
    try {
        await page.goto('http://notes.test/');
        for (const name of ['vz2-timestamp-model', 'vz2-timestamp-store', 'vz2-note-editor', 'vz2-timestamp-editor']) await page.addScriptTag({ path: path.join(root, 'js/' + name + '.js') });
        await page.addStyleTag({ path: path.join(root, 'css/themes.css') });
        await page.addStyleTag({ path: path.join(root, 'css/vz2.css') });
        const editor = page.locator('.vz2-timestamp-editor');
        await page.evaluate(() => Vz2TimestampEditor.open({ recording_id: 1, kind: 'note', draft: { time_ms: 1234, body: 'Nástup' } }));
        await editor.getByRole('button', { name: 'Uložit poznámku', exact: true }).click();
        await editor.waitFor({ state: 'hidden' });
        assert.equal(lastWrite.time_ms, 1234); assert.equal(lastWrite.kind, 'note');
        assert.equal(await page.evaluate(() => typeof window.Vz2Timestamps), 'undefined');
        await page.evaluate(() => Vz2TimestampEditor.open({ recording_id: 1, item_id: 't1' }));
        await editor.locator('[name=body]').fill('<img src=x> Rozepsaná poznámka');
        revision++; rows[0] = { ...rows[0], revision, body: 'Druhé okno' };
        await editor.getByRole('button', { name: 'Poznámka', exact: true }).click();
        await editor.locator('.ts-rebase').waitFor({ state: 'visible' });
        assert.equal(await editor.locator('[name=body]').inputValue(), '<img src=x> Rozepsaná poznámka');
        await editor.locator('.ts-rebase').click();
        assert.match(await editor.locator('.ts-current').textContent(), /Druhé okno/);
        assert.equal(await editor.locator('img').count(), 0);
        await editor.getByRole('button', { name: 'Poznámka', exact: true }).click();
        await editor.waitFor({ state: 'hidden' });
        assert.equal(lastWrite.time_ms, 1234, 'text edits preserve exact milliseconds');
        for (const width of [320, 390, 1440]) {
            await page.setViewportSize({ width, height: 844 });
            await page.evaluate(() => Vz2TimestampEditor.open({ recording_id: 1, item_id: 't1' }));
            const box = await editor.boundingBox(); assert(box.x >= 0 && box.x + box.width <= width + 1);
            await editor.locator('.ts-close').click();
        }
        await page.evaluate(() => Vz2TimestampEditor.open({ recording_id: 1, item_id: 't1' }));
        await editor.locator('[name=body]').fill('Zachovat při výpadku'); networkFailure = true;
        await editor.getByRole('button', { name: 'Poznámka', exact: true }).click();
        await editor.locator('.error').filter({ hasText: /fetch/i }).waitFor();
        assert.equal(await editor.locator('[name=body]').inputValue(), 'Zachovat při výpadku');
        networkFailure = false; await editor.locator('.ts-close').click();
        writable = false; rows[0].can_edit = false;
        assert.match(await page.evaluate(() => Vz2TimestampEditor.open({ recording_id: 1, item_id: 't1' }).then(() => '', e => e.message)), /oprávnění/);
        assert.match(await page.evaluate(() => Vz2TimestampEditor.open({ recording_id: 1, kind: 'note' }).then(() => '', e => e.message)), /oprávnění/);
        rows = [];
        assert.match(await page.evaluate(() => Vz2TimestampEditor.open({ recording_id: 1, item_id: 't1' }).then(() => '', e => e.message)), /neexistuje/);
        assert.deepEqual(errors, []);
        console.log('PASS independent note editor: create/edit without list, precision, conflict/rebase, escaping, mobile, network failure, permissions and deletion');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
