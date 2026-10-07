'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');

module.exports = async function ({ base, clients, request, check, song, rehearsal, source, clip, directClip, start, end }) {
    const executablePath = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, chromium.executablePath()].find(p => p && fs.existsSync(p));
    const browser = await chromium.launch({ headless: true, executablePath });
    try {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        const [name, value] = clients.admin.cookie.split('=');
        await context.addCookies([{ name, value, url: base }]);
        const page = await context.newPage(), errors = [];
        page.setDefaultTimeout(15000);
        page.on('pageerror', e => errors.push(e.message));
        page.on('dialog', d => d.accept());
        // Keep the boot stylesheet loader working without external network dependencies.
        await page.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
        await page.goto(base + 'index.php?v=2&collection_id=' + rehearsal.id);
        await page.waitForFunction(() => !document.documentElement.classList.contains('vz2-booting'));
        const history = page.locator('#history-workspace'), add = page.locator('#history-add'), detail = page.locator('#history-detail');
        async function openHistory() {
            const menu = page.locator('.shell-menu');
            if ((await menu.getAttribute('open')) === null) await menu.locator('summary').click();
            await page.locator('#show-history').click();
            await history.locator('.history-table').waitFor();
        }
        const cell = () => history.locator('tbody tr').filter({ has: page.locator('th', { hasText: 'Historie – zkouška' }) }).locator('td').filter({ has: page.getByRole('button', { name: 'Zařadit existující úsek nebo výstřižek: Historie – skladba × Historie – zkouška', exact: true }) });
        async function addCandidate(value) {
            await cell().locator('.history-add').click();
            await add.locator('input[value="' + value + '"]').check();
            await add.getByRole('button', { name: 'Přidat', exact: true }).click();
            await add.waitFor({ state: 'hidden' });
        }
        await openHistory();
        assert.equal(await page.locator('#app-shell').isVisible(), false);
        await addCandidate('i:' + source + ':' + start.id + ':' + end.id);
        await cell().locator('.history-play').click();
        await detail.waitFor();
        assert.equal(await detail.locator('audio').count(), 1);
        const sourceAudio = detail.locator('audio');
        await sourceAudio.evaluate(a => a.load());
        await page.waitForFunction(() => {
            const a = document.querySelector('#history-detail audio');
            return a.readyState >= 1 && Math.abs(a.currentTime - 1) < .1;
        });
        await detail.getByText('Poznámky (2)', { exact: true }).click();
        assert((await detail.textContent()).includes('Poznámka uvnitř'));
        assert(!(await detail.textContent()).includes('Poznámka za úsekem'));
        await detail.getByText('Úpravy', { exact: true }).click();
        await detail.locator('select').selectOption(String(clip));
        await detail.getByRole('button', { name: 'Uložit výstřižek', exact: true }).click();
        await detail.waitFor({ state: 'hidden' });
        await cell().getByRole('button', { name: 'Výstřižek: vystrizek.wav', exact: true }).click();
        assert.equal(await detail.locator('audio').count(), 2);
        await detail.locator('[data-history-close]').click();
        await addCandidate('c:' + directClip);
        assert.equal(await cell().locator('.history-play').count(), 2);
        check(true, 'browser history: menu opens matrix; interval assignment seeks original audio and connects clip; two attempts share a cell');
        await page.locator('#history-song-filter').selectOption(String(song.id));
        assert.equal(await history.locator('thead th').count(), 2);
        await page.locator('#history-orientation').click();
        assert.equal(await page.locator('#history-orientation').getAttribute('aria-pressed'), 'true');
        assert.equal(await history.locator('tbody tr').count(), 1);
        await page.locator('#history-audio-filter').check();
        assert.equal(await history.locator('.history-play').count(), 2);
        await page.locator('#history-close').click();
        assert.equal(await page.locator('#app-shell').isVisible(), true);
        await page.setViewportSize({ width: 390, height: 844 });
        await openHistory();
        assert.equal(await history.isVisible(), true);
        assert(await page.locator('#history-close').isVisible());
        const bounds = await history.boundingBox();
        assert(bounds.x >= 0 && bounds.width <= 390, 'matrix stays within mobile viewport');
        await history.getByRole('button', { name: 'Výstřižek: samostatny-pokus.wav', exact: true }).click();
        assert.equal(await detail.locator('audio').count(), 1);
        await detail.getByText('Úpravy', { exact: true }).click();
        await detail.getByRole('button', { name: 'Odebrat pokus', exact: true }).click();
        await detail.waitFor({ state: 'hidden' });
        assert.equal(await history.locator('.history-play').count(), 1);
        // Restore the second attempt through the same UI, with the default orientation.
        await page.locator('#history-orientation').click();
        await addCandidate('c:' + directClip);
        assert.deepEqual(errors, []);
        check(true, 'browser history: song/audio filters, axis swap, mobile detail, safe removal and return to catalogue work');
        const guest = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const [guestName, guestValue] = clients.guest.cookie.split('=');
        await guest.addCookies([{ name: guestName, value: guestValue, url: base }]);
        const guestPage = await guest.newPage();
        await guestPage.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ contentType: 'text/css', body: '' }));
        await guestPage.goto(base + 'index.php?v=2');
        await guestPage.waitForFunction(() => !document.documentElement.classList.contains('vz2-booting'));
        await guestPage.locator('.shell-menu > summary').click();
        await guestPage.locator('#show-history').click();
        await guestPage.locator('#history-matrix .history-table').waitFor();
        assert.equal(await guestPage.locator('#history-matrix .history-add').count(), 0);
        await guestPage.getByRole('button', { name: 'Výstřižek: vystrizek.wav', exact: true }).click();
        assert.equal(await guestPage.locator('#history-detail audio').count(), 2);
        assert.equal(await guestPage.locator('#history-detail select').count(), 0);
        check(true, 'browser history: guest can browse and listen but has no edit controls');
    } finally { await browser.close(); }
};
