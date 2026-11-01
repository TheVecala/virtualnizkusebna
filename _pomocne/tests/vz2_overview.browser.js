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
        const measureGrid = () => page.evaluate(() => {
            const list = document.querySelector('#overview-rehearsal-list');
            const card = list.querySelector('.overview-collection');
            return {
                columns: Math.round(list.getBoundingClientRect().width / card.getBoundingClientRect().width),
                outputWidth: document.querySelector('#overview-output').getBoundingClientRect().width,
                filterWidth: document.querySelector('#overview-filters').getBoundingClientRect().width,
                overflow: document.documentElement.scrollWidth - window.innerWidth
            };
        });
        const desktopGrid = await measureGrid();
        assert(desktopGrid.columns >= 3 && desktopGrid.outputWidth > desktopGrid.filterWidth,
            'overview uses multiple columns while the filter keeps its width');
        await page.setViewportSize({ width: 2560, height: 900 });
        const wideGrid = await measureGrid();
        assert(wideGrid.columns >= 6 && wideGrid.outputWidth > 2400,
            'very wide screens can fit many overview columns');
        assert(Math.abs(wideGrid.filterWidth - desktopGrid.filterWidth) < 2, 'filter width stays unchanged on wide screens');
        assert(wideGrid.overflow <= 1, 'wide overview has no horizontal overflow');
        await page.setViewportSize({ width: 1200, height: 720 });
        const masonry = await page.locator('#overview-rehearsal-list').evaluate(list => {
            const longBottom = list.querySelector('.overview-collection').getBoundingClientRect().bottom;
            const probes = Array.from({ length: 6 }, (_, index) => {
                const card = document.createElement('article');
                card.className = 'overview-collection';
                card.style.height = index === 0 ? '220px' : '90px';
                list.append(card);
                return card;
            });
            const positions = probes.map(card => {
                const rect = card.getBoundingClientRect();
                return { x: rect.x, y: rect.y };
            });
            probes.forEach(card => card.remove());
            return positions.some((item, index) => positions.some((previous, before) =>
                before < index && Math.abs(item.x - previous.x) < 2 && item.y > previous.y && item.y < longBottom - 20));
        });
        assert(masonry, 'short cards fill space beside a much taller card');
        check(true, 'browser: responsive columns pack cards of different heights');

        const rehearsalGroups = page.locator('#overview-rehearsal-list .overview-marker-group');
        assert.deepEqual(await rehearsalGroups.locator('.overview-marker-heading').allTextContents(),
            ['Nahrávka: Zkouška ranní.wav', 'Nahrávka: Druhý pokus']);
        assert((await rehearsalGroups.first().locator('.overview-entry-marker').count()) > 1,
            'one recording heading covers multiple timestamps');
        assert.equal(await rehearsalGroups.nth(1).locator('.overview-entry-marker').count(), 1);
        const start = rehearsalGroups.first().locator('.overview-entry-marker').filter({ hasText: 'Nová píseň' }).first();
        const positions = await start.evaluate(row => {
            const rect = selector => row.querySelector(selector).getBoundingClientRect();
            const time = rect('.overview-marker-time'), text = rect('.overview-entry-body'), icon = rect('.overview-marker-icon');
            return { timeX: time.x, timeY: time.y, textX: text.x, textY: text.y, iconX: icon.x, iconY: icon.y };
        });
        assert.equal(await start.locator('.overview-marker-recording').count(), 0);
        const headingAndRow = await rehearsalGroups.first().evaluate(group => ({
            headingBottom: group.querySelector('.overview-marker-heading').getBoundingClientRect().bottom,
            firstRowTop: group.querySelector('.overview-entry-marker').getBoundingClientRect().top
        }));
        assert(headingAndRow.headingBottom <= headingAndRow.firstRowTop, 'recording heading sits above its timestamps');
        assert(positions.timeX < positions.textX && positions.textX < positions.iconX,
            'marker order is time, text, start icon');
        assert(Math.abs(positions.timeY - positions.textY) < 8 && Math.abs(positions.textY - positions.iconY) < 12,
            'short timestamp stays on one row');
        const summary = page.locator('.overview-entry').filter({ hasText: 'Zrychlit refrén.' }).first();
        const summaryRows = await summary.evaluate(row => ({
            label: row.querySelector('.overview-entry-label').getBoundingClientRect().y,
            body: row.querySelector('.overview-entry-body').getBoundingClientRect().y
        }));
        assert(Math.abs(summaryRows.label - summaryRows.body) < 8, 'short summary stays on one row');
        check(true, 'browser: one recording heading above each timestamp group');

        const documentLayout = await page.locator('#overview-songs .overview-entry-wide').filter({ hasText: 'Text písně' }).first().evaluate(row => {
            const label = row.querySelector('.overview-entry-label').getBoundingClientRect();
            const body = row.querySelector('.overview-entry-body').getBoundingClientRect();
            return { labelBottom: label.bottom, bodyTop: body.top, bodyWidth: body.width, rowWidth: row.getBoundingClientRect().width };
        });
        assert(documentLayout.bodyTop >= documentLayout.labelBottom && documentLayout.bodyWidth >= documentLayout.rowWidth - 2,
            'document text uses the full card width below its label');
        const detailFont = await page.locator('.overview-entry-map-detail .overview-entry-body').first()
            .evaluate(element => getComputedStyle(element).fontFamily);
        assert(detailFont.includes('monospace'), 'bar details use a monospaced font');
        check(true, 'browser: full-width documents and monospaced bar details');

        const map = page.locator('#overview-songs .overview-map');
        assert.equal(await map.count(), 1);
        const sections = map.locator('.overview-map-section');
        assert.deepEqual(await sections.locator('h4').allTextContents(), ['Refrén', 'Bridge']);
        assert.equal(await sections.first().locator('.overview-map-row').count(), 2, 'nine bars wrap after the eighth');
        assert.deepEqual(await sections.first().locator('.overview-map-bar').allTextContents(),
            ['□', '○F2', '□✦', 'F4', '?', '—', '■', '○✦', '□F3']);
        assert.equal(await map.locator('.overview-map-bar.has-detail').count(), 1);
        assert.equal(await sections.nth(1).locator('.overview-map-bar').getAttribute('aria-label'), 'Takt 10: Ride');
        const mapRow = await sections.first().locator('.overview-map-row').first().evaluate(row => {
            const bars = [...row.children].map(bar => bar.getBoundingClientRect());
            return { tops: bars.map(bar => bar.top), groupGap: bars[4].left - bars[3].right,
                cellGap: bars[1].left - bars[0].right, overflow: row.scrollWidth > row.clientWidth + 1 };
        });
        assert(new Set(mapRow.tops).size === 1 && mapRow.groupGap > mapRow.cellGap && !mapRow.overflow,
            'playing map keeps the four-plus-four bar grouping');
        check(true, 'browser: playing map shows bar symbols and section order');

        await page.locator('#overview-filters > summary').click();
        const presets = [
            ['lyrics', ['songs', 'song_lyrics']],
            ['starts_notes', ['rehearsals', 'rehearsal_starts', 'rehearsal_notes']],
            ['bar_details', ['songs', 'song_map_details']],
            ['markers', ['rehearsals', 'songs', ...['rehearsal', 'song'].flatMap(kind =>
                ['song_start', 'song_end', 'passage', 'note'].map(marker => `${kind}_marker_${marker}`))]],
            ['summaries', ['rehearsals', 'songs', 'rehearsal_summary', 'song_summary']]
        ];
        for (const [name, keys] of presets) {
            await page.locator(`[data-overview-preset="${name}"]`).click();
            const checked = await page.locator('#overview-filters input[data-filter]:checked')
                .evaluateAll(inputs => inputs.map(input => input.dataset.filter));
            assert.deepEqual(checked.sort(), ['show_created', 'show_author', 'show_entry_date', ...keys].sort(),
                `preset ${name} selects its content types`);
            if (name === 'lyrics') {
                assert(await page.locator('#overview-rehearsals').isHidden());
                assert.equal(await page.locator('#overview-songs .overview-entry').count(), 1,
                    'text preset shows only song lyrics');
            }
            if (name === 'starts_notes') {
                assert(await page.locator('#overview-songs').isHidden());
                assert.equal(await page.locator('#overview-rehearsal-list .overview-entry').count(), 2,
                    'starts and notes preset shows only the two rehearsal documents');
            }
            if (name === 'bar_details') {
                assert.equal(await page.locator('#overview-songs .overview-entry-map-detail').count(), 1);
                assert.equal(await page.locator('#overview-songs .overview-entry').count(), 1,
                    'bar details preset hides other song content');
            }
        }
        await page.locator('#overview-filter-all').click();
        await page.locator('#overview-filters > summary').click();
        assert.equal(overviewRequests, 1, 'presets filter the existing snapshot without a new request');
        check(true, 'browser: content presets select the requested checkboxes');

        for (const width of [390, 320]) {
            await page.setViewportSize({ width, height: 480 });
            const compactRow = await map.locator('.overview-map-row').first().evaluate(row => ({
                tops: [...row.children].map(bar => bar.getBoundingClientRect().top),
                overflow: row.scrollWidth > row.clientWidth + 1
            }));
            assert(new Set(compactRow.tops).size === 1 && !compactRow.overflow,
                `playing map keeps eight bars on one row at ${width}px`);
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        }
        await page.setViewportSize({ width: 390, height: 480 });
        const mobileGrid = await measureGrid();
        assert(mobileGrid.columns === 1 && mobileGrid.overflow <= 1, 'mobile overview uses one column without horizontal overflow');
        const mobileMarker = await start.evaluate(row => ({
            timeY: row.querySelector('.overview-marker-time').getBoundingClientRect().y,
            textY: row.querySelector('.overview-entry-body').getBoundingClientRect().y,
            iconY: row.querySelector('.overview-marker-icon').getBoundingClientRect().y
        }));
        assert(Math.abs(mobileMarker.timeY - mobileMarker.textY) < 8 && Math.abs(mobileMarker.textY - mobileMarker.iconY) < 12,
            'short marker still fits on one mobile row');
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
        assert.equal(await rehearsalGroups.count(), 2, 'recording headings remain while notes are visible');
        await page.locator('input[data-filter="rehearsal_marker_note"]').uncheck();
        assert.equal(await rehearsalGroups.count(), 0, 'recording headings disappear when all their timestamps are hidden');
        await page.locator('input[data-filter="rehearsal_marker_note"]').check();
        await page.locator('input[data-filter="rehearsal_marker_song_start"]').check();
        assert.equal(await start.count(), 1, 'filter restores the start marker');
        assert.equal(overviewRequests, 1, 'filter changes do not load a new overview');
        assert.deepEqual(errors, []);
        check(true, 'browser: pinned filter, internal scrolling and local filtering');
    } finally { await browser.close(); }
};
