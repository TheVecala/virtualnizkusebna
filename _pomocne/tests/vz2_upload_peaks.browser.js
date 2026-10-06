'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
module.exports = async ({ base, clients, good, wav, db, media, check }) => {
    const collection = await good('admin', { action: 'collection_create', kind: 'song', title: 'Upload křivek' });
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
    try {
        const context = await browser.newContext();
        const [name, value] = clients.admin.cookie.split('=');
        await context.addCookies([{ name, value, url: base }]);
        const page = await context.newPage();
        await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
        await page.goto(base + 'index.php?v=2&collection_id=' + collection.id);
        await page.locator('#upload-open').click();
        const dialog = page.locator('#upload-dialog');
        const option = dialog.locator('[name=create_peaks]');
        assert.equal(await option.isChecked(), false);
        await dialog.locator('.upload-kind label').filter({ hasText: 'Příloha' }).click();
        assert.equal(await option.isVisible(), false);
        await dialog.locator('.upload-kind label').filter({ hasText: 'Vícestopá' }).click();
        await option.check();
        await dialog.locator('[name=title]').fill('Test křivek');
        await dialog.locator('[type=file]').setInputFiles([
            { name: 'left.wav', mimeType: 'audio/wav', buffer: wav(2) },
            { name: 'right.wav', mimeType: 'audio/wav', buffer: wav(1) }
        ]);
        let observed = false;
        await page.route('**/php/ajax/vz2_peaks.php', async route => {
            if (route.request().method() === 'POST') {
                observed = true;
                assert.match(await dialog.locator('.upload-status').textContent(), /Ukládám křivku do JSON/);
                assert.equal(await dialog.locator('progress').getAttribute('value'), null);
                assert.equal(await dialog.locator('button[type=submit]').isDisabled(), true);
            }
            await route.continue();
        });
        await dialog.locator('button[type=submit]').click();
        await dialog.waitFor({ state: 'hidden' });
        assert(observed);
        const files = db('SELECT f.* FROM vz2_audio_files f JOIN vz2_recordings r ON r.id=f.recording_id WHERE r.collection_id=? ORDER BY f.sort_order', [collection.id]);
        assert.equal(files.length, 2);
        for (const file of files) {
            const cached = JSON.parse(fs.readFileSync(path.join(media, '.cache/peaks', `${file.id}-${file.sha256}-v1.json`)));
            assert.equal(cached.file_id, Number(file.id));
            assert.equal(cached.duration_ms, Number(file.duration_ms));
            assert.equal(cached.peaks.length, 4096);
            assert(cached.peaks.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
        }
        check(true, 'upload checkbox creates persistent JSON peaks for each track, with post-upload progress');
        await page.locator('#upload-open').click();
        await dialog.locator('[name=title]').fill('Chyba cache');
        await dialog.locator('[type=file]').setInputFiles({ name: 'failure.wav', mimeType: 'audio/wav', buffer: wav() });
        await page.unroute('**/php/ajax/vz2_peaks.php');
        await page.route('**/php/ajax/vz2_peaks.php', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Test chyby zápisu' }) }));
        await option.check();
        await dialog.locator('button[type=submit]').click();
        await page.waitForFunction(() => document.querySelector('#upload-dialog .upload-error')?.textContent.includes('Test chyby zápisu'));
        assert.equal(await dialog.locator('button[type=submit]').isDisabled(), true);
        assert.equal(db('SELECT id FROM vz2_recordings WHERE collection_id=?', [collection.id]).length, 2);
        check(true, 'peaks save failure preserves successful upload and prevents duplicate submission');
    } finally { await browser.close(); }
};
