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
        let uploads = 0;
        page.on('request', request => {
            if (request.method() === 'POST' && request.url().endsWith('/php/ajax/vz2.php')) uploads++;
        });
        await page.addInitScript(() => {
            window.uploadDecodeCount = 0;
            const decode = AudioContext.prototype.decodeAudioData;
            AudioContext.prototype.decodeAudioData = function (...args) {
                window.uploadDecodeCount++;
                if (window.failUploadDecode) {
                    window.failUploadDecode = false;
                    return Promise.reject(new DOMException('Test decoder failure', 'EncodingError'));
                }
                return decode.apply(this, args);
            };
        });
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
        await dialog.locator('.upload-kind label').filter({ hasText: 'Vícestopá' }).click();
        await dialog.locator('[type=file]').setInputFiles([
            { name: 'saved.wav', mimeType: 'audio/wav', buffer: wav() },
            { name: 'failure.wav', mimeType: 'audio/wav', buffer: wav(2) },
            { name: 'also-saved.wav', mimeType: 'audio/wav', buffer: wav() }
        ]);
        await page.unroute('**/php/ajax/vz2_peaks.php');
        const attempts = [];
        await page.route('**/php/ajax/vz2_peaks.php', route => {
            attempts.push(route.request().postDataJSON().file_id);
            if (attempts.length === 4) return route.abort('failed');
            if (attempts.length === 5) return route.fulfill({ status: 200, contentType: 'text/html', body: '<html>Login</html>' });
            return attempts.length === 2
                ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Test chyby zápisu' }) })
                : route.continue();
        });
        await option.check();
        await dialog.locator('button[type=submit]').click();
        await page.waitForFunction(() => document.querySelector('#upload-dialog .upload-error')?.textContent.includes('Test chyby zápisu'));
        const retry = dialog.getByRole('button', { name: 'Zkusit vytvořit JSON znovu' });
        await retry.waitFor();
        assert.equal(await retry.isEnabled(), true);
        assert.equal(await dialog.locator('[type=file]').isDisabled(), true);
        assert.equal(db('SELECT id FROM vz2_recordings WHERE collection_id=?', [collection.id]).length, 2);
        assert.equal(attempts.length, 3, 'a failed track does not stop the remaining tracks');
        const decoded = await page.evaluate(() => window.uploadDecodeCount);
        await retry.click();
        await page.waitForFunction(() => document.querySelector('#upload-dialog button[type=submit]')?.disabled === false);
        assert.match(await dialog.locator('.upload-error').textContent(), /Nahrávka je uložená/);
        await retry.click();
        await page.waitForFunction(() => document.querySelector('#upload-dialog .upload-error')?.textContent.includes('Server nepotvrdil'));
        await retry.click();
        await dialog.waitFor({ state: 'hidden' });
        assert.equal(uploads, 2, 'retry never uploads the audio again');
        assert.deepEqual(attempts, [attempts[0], attempts[1], attempts[2], attempts[1], attempts[1], attempts[1]], 'retries save only the failed track');
        assert.equal(await page.evaluate(() => window.uploadDecodeCount), decoded, 'save retry reuses the already computed peaks');
        const recoveredFiles = db('SELECT f.* FROM vz2_audio_files f JOIN vz2_recordings r ON r.id=f.recording_id WHERE r.collection_id=?', [collection.id]);
        for (const file of recoveredFiles) assert(fs.existsSync(path.join(media, '.cache/peaks', `${file.id}-${file.sha256}-v1.json`)));
        check(true, 'partial peaks failure can be retried without duplicate uploads, decoding or writes to completed tracks');

        await page.locator('#upload-open').click();
        await dialog.locator('[type=file]').setInputFiles({ name: 'decode.wav', mimeType: 'audio/wav', buffer: wav() });
        await option.check();
        await page.evaluate(() => { window.failUploadDecode = true; });
        await dialog.locator('button[type=submit]').click();
        await retry.waitFor();
        assert.match(await dialog.locator('.upload-error').textContent(), /dekódovat/);
        await retry.click();
        await dialog.waitFor({ state: 'hidden' });
        assert.equal(uploads, 3);
        assert.equal(db('SELECT id FROM vz2_recordings WHERE collection_id=?', [collection.id]).length, 3);
        check(true, 'decoder failure is explained and retry preserves the uploaded recording');

        const recoveredRecording = (await good('admin')).recordings.find(recording => recording.files.some(file => file.original_name === 'decode.wav'));
        const cachedWave = await page.evaluate(async file => {
            const before = window.uploadDecodeCount;
            const wave = await window.Vz2TimestampControls.fileWaveform(file, null, { decode: false });
            return { count: wave.peaks.length, duration: wave.duration_ms, decodes: window.uploadDecodeCount - before };
        }, recoveredRecording.files[0]);
        assert.deepEqual(cachedWave, { count: 4096, duration: recoveredRecording.files[0].duration_ms, decodes: 0 });
        check(true, 'the new player waveform service reads the uploaded JSON without decoding audio again');

        const beforePlainUpload = await page.evaluate(() => window.uploadDecodeCount);
        const writesBeforePlainUpload = attempts.length;
        await page.locator('#upload-open').click();
        await dialog.locator('[type=file]').setInputFiles({ name: 'plain.wav', mimeType: 'audio/wav', buffer: wav() });
        assert.equal(await option.isChecked(), false);
        await dialog.locator('button[type=submit]').click();
        await dialog.waitFor({ state: 'hidden' });
        assert.equal(await page.evaluate(() => window.uploadDecodeCount), beforePlainUpload);
        assert.equal(attempts.length, writesBeforePlainUpload);
        assert.equal(uploads, 4);
        check(true, 'upload without the JSON checkbox does not decode audio or save peaks');
    } finally { await browser.close(); }
};
