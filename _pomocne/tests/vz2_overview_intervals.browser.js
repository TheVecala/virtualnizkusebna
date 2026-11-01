'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
module.exports = async ({ base, clients, check }) => {
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath(), headless: true });
    try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const [name, value] = clients.guest.cookie.split('='); await context.addCookies([{ name, value, url: base }]);
        const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.goto(base + 'prehled.php'); await page.getByRole('button', { name: 'Vytvořit výpis' }).click();
        const rows = page.locator('.overview-entry-marker');
        const passage = rows.filter({ hasText: 'Refrén přehledu' }); await passage.waitFor();
        assert.equal(await passage.locator('.overview-marker-time').innerText(), '02:10\n– 02:25');
        assert.match(await passage.textContent(), /Tichý nástup/);
        assert.match(await rows.filter({ hasText: 'Otevřená pasáž přehledu' }).textContent(), /Doplnit konec/);
        assert.equal(await rows.filter({ hasText: 'Poznámka na konci' }).count(), 1);
        assert.match(await rows.filter({ hasText: 'Poznámka na konci' }).locator('.overview-marker-time').innerText(), /02:00\n– 03:00/);
        await page.locator('#overview-filters > summary').click();
        await page.locator('input[data-filter="rehearsal_marker_passage"]').uncheck();
        assert.equal(await passage.count(), 0);
        await page.locator('input[data-filter="rehearsal_marker_song_start"]').uncheck();
        assert.equal(await rows.filter({ hasText: 'Poznámka na konci' }).count(), 0);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        assert.deepEqual(errors, []);
        check(true, 'overview browser: explicit intervals, passage notes, missing ends, paired end text and compatible filters on mobile');
    } finally { await browser.close(); }
};
