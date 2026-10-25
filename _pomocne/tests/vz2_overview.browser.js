'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

module.exports = async ({ base, clients, db, check, rehearsalRecordingId }) => {
    // Enough entries to exercise the sticky filter after a real page scroll.
    for (let index = 0; index < 18; index++) {
        db("INSERT INTO vz2_timestamps(recording_id,kind,time_ms,body,created_by,updated_by,created_at,updated_at) VALUES (?,'note',? ,?,1,1,UTC_TIMESTAMP(),UTC_TIMESTAMP())",
            [rehearsalRecordingId, 130000 + index * 1000, 'Další poznámka ' + index]);
    }
    const browser = await chromium.launch({ headless: true,
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath() });
    try {
        const context = await browser.newContext({ viewport: { width: 1200, height: 720 } });
        const [name, value] = clients.guest.cookie.split('=');
        await context.addCookies([{ name, value, url: base }]);
        const page = await context.newPage(), errors = [];
        let overviewRequests = 0;
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => { if (request.url().includes('vz2_overview.php')) overviewRequests++; });
        await page.goto(base + 'prehled.php');
        assert.equal(await page.locator('.overview-entry').count(), 0, 'page starts without a generated overview');
        await page.getByRole('button', { name: 'Vytvořit výpis' }).click();
        await page.locator('#overview-output:not([hidden])').waitFor();
        assert.equal(overviewRequests, 1);

        const start = page.locator('.overview-entry-marker').filter({ hasText: 'Nová píseň' }).first();
        const positions = await start.evaluate(row => {
            const rect = selector => row.querySelector(selector).getBoundingClientRect();
            const time = rect('.overview-marker-time'), text = rect('.overview-entry-body'), icon = rect('.overview-marker-icon');
            return { timeX: time.x, timeY: time.y, textX: text.x, textY: text.y, iconX: icon.x, iconY: icon.y };
        });
        assert(positions.timeX < positions.textX && positions.textX < positions.iconX, 'marker order is time, text, start icon');
        assert(Math.abs(positions.timeY - positions.textY) < 8 && Math.abs(positions.textY - positions.iconY) < 12,
            'short timestamp stays on one row');
        const summary = page.locator('.overview-entry').filter({ hasText: 'Zrychlit refrén.' }).first();
        const summaryRows = await summary.evaluate(row => ({
            label: row.querySelector('.overview-entry-label').getBoundingClientRect().y,
            body: row.querySelector('.overview-entry-body').getBoundingClientRect().y
        }));
        assert(Math.abs(summaryRows.label - summaryRows.body) < 8, 'short summary stays on one row');
        check(true, 'browser: timestamp order and short text layout');

        await page.setViewportSize({ width: 390, height: 480 });
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const sticky = await page.locator('#overview-filters').evaluate(element => ({
            top: element.getBoundingClientRect().top, scroll: window.scrollY,
            position: getComputedStyle(element).position
        }));
        assert(sticky.scroll > 100 && Math.abs(sticky.top) < 2 && sticky.position === 'sticky', 'filter stays at viewport top');
        await page.locator('#overview-filters > summary').click();
        const panel = await page.locator('.overview-filter-body').evaluate(element => ({
            position: getComputedStyle(element).position, height: element.clientHeight, scrollHeight: element.scrollHeight
        }));
        assert(panel.position === 'absolute' && panel.scrollHeight > panel.height, 'expanded filter scrolls independently');
        await page.locator('input[data-filter="rehearsal_marker_song_start"]').uncheck();
        assert.equal(await start.count(), 0, 'filter hides the start marker');
        await page.locator('input[data-filter="rehearsal_marker_song_start"]').check();
        assert.equal(await start.count(), 1, 'filter restores the start marker');
        assert.equal(overviewRequests, 1, 'filter changes do not load a new overview');
        assert.deepEqual(errors, []);
        check(true, 'browser: pinned filter, internal scrolling and local filtering');
    } finally { await browser.close(); }
};
