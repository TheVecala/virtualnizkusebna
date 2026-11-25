'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
module.exports = async ({ base, clients, id, collection, wav, check, temp, request, mixId, db, media }) => {
    const executablePath = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, chromium.executablePath(), 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && fs.existsSync(p));
    const browser = await chromium.launch({ headless: true, executablePath, args: ['--autoplay-policy=no-user-gesture-required'] });
    try {
        const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
        const [name, value] = clients.alice.cookie.split('='); await context.addCookies([{ name, value, url: base }]);
        const page = await context.newPage(), errors = [];
        page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(15000);
        page.on('pageerror', err => { errors.push(err.message); console.log('BROWSER ERROR ' + err.message); });
        page.on('dialog', d => { console.log('BROWSER DIALOG ' + d.message()); d.accept(); });
        await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
        // Serve repository assets directly; keep PHP uploads, catalog and media on HTTP.
        await page.route(base + '**', route => {
            const url = new URL(route.request().url()), pathname = url.pathname;
            if (/^\/(js|css|meat)\//.test(pathname)) return route.fulfill({ path: path.join(__dirname, '../..', pathname) });
            // PHP's Windows development server can stall binary/static responses.
            // Use the actual committed media file; all mutations still use real HTTP.
            if (pathname === '/php/ajax/vz2_files.php' && url.searchParams.get('type') === 'audio') {
                const file = db('SELECT relative_path,sha256 FROM vz2_audio_files WHERE id=?', [Number(url.searchParams.get('id'))])[0];
                assert.equal(file.sha256, url.searchParams.get('hash'));
                return route.fulfill({ contentType: 'audio/wav', path: path.join(media, file.relative_path) });
            }
            return route.continue();
        });
        await page.goto(base + 'index.php?v=2&collection_id=' + collection.id, { waitUntil: 'domcontentloaded' });
        const card = page.locator('#recording-' + id);
        await card.locator('.recording-toggle').click();
        await card.getByRole('button', { name: 'Další', exact: true }).click();
        await page.locator('#recording-actions-' + id).getByRole('button', { name: 'Nahradit soubor', exact: true }).click();
        const dialog = page.locator('.audio-replacement-dialog');
        await dialog.locator('[type=file]').setInputFiles({ name: 'short.wav', mimeType: 'audio/wav', buffer: wav(5) });
        await dialog.getByRole('button', { name: 'Nahrát a zkontrolovat' }).click();
        await dialog.getByRole('button', { name: 'Potvrdit náhradu' }).waitFor({ state: 'visible' });
        assert.match(await dialog.locator('.replacement-status').textContent(), /00:12,000.*00:05,000.*−00:07,000/);
        assert.match(await dialog.locator('.replacement-warning').textContent(), /nahrávky: 2.*konec: 1/);
        assert.equal(Number((await request(clients.alice, 'php/ajax/vz2.php')).json().recordings.find(r => Number(r.id) === id).duration_ms), 12000);
        await page.screenshot({ path: path.join(temp, 'audio-replacement-warning.png') });
        await dialog.getByRole('button', { name: 'Potvrdit náhradu' }).click();
        await dialog.waitFor({ state: 'detached' });
        await page.waitForFunction(id => document.querySelector('#recording-' + id + ' .recording-duration')?.textContent === '00:05', id);
        const actions = page.locator('#recording-actions-' + id);
        if (await actions.isVisible()) await actions.getByRole('button', { name: 'Zavřít', exact: true }).click();
        await card.getByRole('button', { name: 'Otevřít v looperu', exact: true }).click();
        const panel = page.locator('#looper-timestamps');
        await page.getByRole('button', { name: 'Otevřít časové značky', exact: true }).click();
        await panel.getByText('— Mimo délku nahrávky', { exact: true }).waitFor();
        const outside = panel.locator('li').filter({ hasText: 'Upravená poznámka za koncem' });
        assert.equal(await outside.locator('.ts-time').isDisabled(), true);
        const take = panel.locator('li[data-annotation-id]').filter({ hasText: 'Záběr' });
        assert.match(await take.textContent(), /Přesahuje konec/);
        const loop = take.getByRole('button', { name: 'Smyčka', exact: true });
        await page.waitForFunction(() => document.querySelector('#looper-panel audio')?.readyState > 0);
        await loop.click();
        await page.locator('#looper-panel audio').evaluate(a => { a.currentTime = 4.98; });
        await page.waitForFunction(() => { const active = window.Vz2TimestampPlayback.state(); return active?.adapter.currentTimeMs() < 2000; });
        assert.equal(await page.evaluate(() => window.Vz2TimestampPlayback.state().item.end_ms), 9000, 'loop keeps stored end while repeating at actual end');
        await page.evaluate(() => { window.Vz2Timestamps.stopLoop(); document.querySelectorAll('audio').forEach(a => a.pause()); });
        await page.screenshot({ path: path.join(temp, 'audio-replacement-timestamps.png') });
        check(true, 'browser: replacement dialog warns before commit; out-of-range timestamp stays visible and clipped loop repeats');

        await page.goto(base + 'index.php?v=2&collection_id=' + collection.id);
        await card.locator('.recording-toggle').click();
        await page.setViewportSize({ width: 390, height: 844 });
        await card.getByRole('button', { name: 'Další', exact: true }).click();
        await actions.getByRole('button', { name: 'Nahradit soubor', exact: true }).click();
        const size = await dialog.evaluate(d => ({ width: d.getBoundingClientRect().width, viewport: innerWidth }));
        assert(size.width <= size.viewport);
        await page.screenshot({ path: path.join(temp, 'audio-replacement-mobile.png') });
        await dialog.getByRole('button', { name: 'Zrušit', exact: true }).click();
        assert.deepEqual(errors, []);
        check(true, 'browser: replacement fits mobile width and cancels cleanly without JavaScript errors');

        await page.setViewportSize({ width: 1280, height: 1000 });
        await page.goto(base + 'index.php?v=2&collection_id=' + collection.id + '&recording_id=' + mixId + '&view=mixer');
        await page.waitForFunction(() => window.MultitrackApp?.getState()?.phase === 'ready');
        await page.evaluate(() => {
            const fader = document.querySelector('.mt-volume'); fader.value = '40'; fader.dispatchEvent(new Event('input', { bubbles: true }));
            document.querySelector('.mt-mute').click(); document.querySelectorAll('.mt-solo')[1].click();
        });
        const mixBefore = await page.evaluate(() => window.MultitrackApp.getState().tracks.map(t => ({ file: t.file, volume: t.volume, muted: t.muted, solo: t.solo })));
        const mixCard = page.locator('#recording-' + mixId);
        if (await mixCard.locator('.recording-toggle').getAttribute('aria-expanded') !== 'true') await mixCard.locator('.recording-toggle').click();
        await mixCard.getByRole('button', { name: 'Další', exact: true }).click();
        await page.locator('#recording-actions-' + mixId).getByRole('button', { name: /^Nahradit soubor:/ }).first().click();
        await dialog.locator('[type=file]').setInputFiles({ name: 'new-left.wav', mimeType: 'audio/wav', buffer: wav(4) });
        await dialog.getByRole('button', { name: 'Nahrát a zkontrolovat' }).click();
        await dialog.getByRole('button', { name: 'Potvrdit náhradu' }).click();
        await page.waitForFunction(() => {
            const s = window.MultitrackApp?.getState(); return s?.phase === 'ready' && s.tracks[0].duration === 4 && s.tracks[0].volume === .4;
        });
        assert.deepEqual(await page.evaluate(() => window.MultitrackApp.getState().tracks.map(t => ({ file: t.file, volume: t.volume, muted: t.muted, solo: t.solo }))), mixBefore);
        assert.deepEqual(errors, []);
        check(true, 'browser: replacing an open mixer track reloads new audio and preserves volume, mute and solo');
    } finally { await browser.close(); }
};
