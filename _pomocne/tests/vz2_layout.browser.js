'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

module.exports = async ({ base, clients, good, request, check, temp, upload, wav }) => {
    const collection = await good('admin', { action: 'collection_create', kind: 'song', title: 'Dlouhá skladba — večerní zkouška a pracovní nahrávky' });
    const documentBody = Array.from({ length: 160 }, (_, i) => `Sloka ${i + 1}   Am      C      G\nDlouhý text písně ${'slovo'.repeat(24)}`).join('\n');
    for (const kind of ['lyrics_chords', 'tablature']) {
        const r = await request(clients.admin, 'php/ajax/vz2_content.php', { action: 'document_save', collection_id: collection.id, kind, document_id: null, current_revision: 0, title: kind === 'tablature' ? 'Kytara' : 'Text a akordy', body: documentBody });
        assert.equal(r.status, 200, r.text);
    }
    for (let i = 0; i < 4; i++) assert.equal((await upload('admin', collection.id, 'Pracovní nahrávka ' + (i + 1), 'single', ['take.wav'], [wav(1)])).status, 201);
    const executablePath = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, chromium.executablePath(), 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && fs.existsSync(p));
    const browser = await chromium.launch({ headless: true, executablePath });
    try {
        const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
        const [name, value] = clients.admin.cookie.split('='); await context.addCookies([{ name, value, url: base }]);
        const page = await context.newPage(), errors = [];
        async function resize(width, height) {
            await page.setViewportSize({ width, height });
            await page.waitForFunction(expected => document.body.dataset.layout === expected, width < 768 ? 'mobile' : width < 1200 ? 'tablet' : 'desktop');
        }
        page.on('pageerror', e => errors.push(e.message));
        await page.route('https://cdn.jsdelivr.net/**', r => r.abort());
        await page.goto(base + 'index.php?v=2&collection_id=' + collection.id);
        await page.locator('#lyrics-content .document-preview').getByText(/Sloka 160/).waitFor();
        const visible = () => page.locator('#content-area > .panel:visible').evaluateAll(nodes => nodes.sort((a, b) => a.getBoundingClientRect().x - b.getBoundingClientRect().x).map(n => n.dataset.panel));
        const toggle = id => page.locator('[data-desktop-panel="' + id + '"]');
        assert.deepEqual(await visible(), ['recordings', 'lyrics', 'tablature']);
        await toggle('discussion').click();
        assert.deepEqual(await visible(), ['recordings', 'lyrics', 'tablature', 'discussion']);
        for (const width of [360, 390, 767, 768, 1024, 1199, 1200, 1280, 1440, 1920]) {
            await resize(width, 800);
            assert.equal((await visible()).length, width < 768 ? 1 : width < 1200 ? 2 : 4);
            const geometry = await page.evaluate(() => {
                const panels = [...document.querySelectorAll('.panel:not([hidden])')].map(n => n.getBoundingClientRect());
                return { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, viewport: innerHeight, panels: panels.map(n => ({ x: n.x, y: n.y, width: n.width, bottom: n.bottom })), nav: getComputedStyle(document.getElementById('bottom-nav')).display };
            });
            assert(geometry.width <= width + 1, 'No page horizontal overflow at ' + width);
            assert(geometry.height <= geometry.viewport + 1, 'No page vertical overflow at ' + width);
            assert(geometry.panels.every(p => p.bottom <= 801), 'Panels remain in viewport at ' + width);
            assert(Math.max(...geometry.panels.map(p => p.width)) - Math.min(...geometry.panels.map(p => p.width)) < 2, 'Equal panel widths');
            assert.equal(geometry.nav !== 'none', width < 768);
            await page.screenshot({ path: path.join(temp, 'ui-stage1-' + width + '.png') });
        }
        check(true, 'layout: all 10 requested widths, exact panel counts, equal widths, no document overflow');
        await resize(1440, 900);
        await page.locator('#lyrics-content').evaluate(n => n.scrollTop = 500);
        assert((await page.locator('#lyrics-content').evaluate(n => n.scrollTop)) > 0);
        assert.equal(await page.locator('#tablature-content').evaluate(n => n.scrollTop), 0);
        assert.equal(await page.evaluate(() => scrollY), 0);
        for (const id of ['recordings', 'lyrics', 'tablature']) await toggle(id).click();
        assert.deepEqual(await visible(), ['discussion']);
        assert(await toggle('discussion').isDisabled());
        await page.reload(); assert.deepEqual(await visible(), ['discussion']);
        await resize(1024, 800);
        assert.deepEqual(await visible(), ['recordings', 'lyrics']);
        await page.getByLabel('Levý panel', { exact: true }).selectOption('lyrics');
        assert.deepEqual(await visible(), ['lyrics', 'recordings']);
        assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Levý panel');
        await page.getByLabel('Pravý panel', { exact: true }).selectOption('discussion');
        await page.reload(); assert.deepEqual(await visible(), ['lyrics', 'discussion']);
        await resize(390, 800);
        await page.locator('[data-mobile-panel=tablature]').click();
        await page.reload(); assert.deepEqual(await visible(), ['tablature']);
        await resize(1024, 800); assert.deepEqual(await visible(), ['lyrics', 'discussion']);
        await resize(1440, 900); assert.deepEqual(await visible(), ['discussion']);
        check(true, 'layout: independent scrolling, last desktop panel protected, tablet swap, separate persisted choices');
        await resize(390, 400);
        await page.locator('#catalog-picker').click();
        await page.locator('#create-collection-open').click();
        await page.locator('#create-collection input').fill('Nová skladba z mobilního dialogu');
        await resize(390, 300);
        await page.locator('#create-collection').getByRole('button', { name: 'Vytvořit', exact: true }).click();
        await page.locator('#collection-title').getByText('Nová skladba z mobilního dialogu', { exact: true }).waitFor();
        assert.equal(await page.locator('#catalog-dialog').isVisible(), false);
        assert.equal(await page.locator('#create-collection-dialog').isVisible(), false);
        assert(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1));
        await resize(1024, 400);
        await page.locator('#catalog-picker').click();
        await page.getByRole('button', { name: 'Zkoušky', exact: true }).click();
        await page.locator('#create-collection-open').click();
        assert.equal(await page.locator('#create-collection-title').textContent(), 'Nová zkouška');
        await page.locator('#create-collection-cancel').click();
        await resize(1200, 400);
        assert.equal(await page.locator('#catalog-dialog').isVisible(), false);
        assert(await page.locator('#sidebar-slot #sidebar').isVisible());
        check(true, 'layout: mobile creation, short viewport/keyboard-sized resize, rehearsal dialog and sidebar migration');
        await page.evaluate(() => { for (const key of Object.keys(localStorage)) if (key.includes('layout:')) localStorage.setItem(key, '{broken'); });
        await page.reload(); assert.deepEqual(await visible(), ['recordings', 'lyrics', 'tablature']);
        assert.deepEqual(errors, []);
        check(true, 'layout: invalid stored preferences recover defaults; no JavaScript errors');
    } finally { await browser.close(); }
};
