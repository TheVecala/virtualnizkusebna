'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'vz2.php'), 'utf8');
const markup = source.slice(source.indexOf('<section id="player-shell"'), source.indexOf('<div id="content-area">'))
    .replace('data-mode="empty"', 'data-mode="looper"').replaceAll(' hidden', '');
const data = { ok: true, recording_id: 1, title: 'Zkouška', can_create: true, timestamps_revision: 1, duration_ms: 100000,
    entries: Array.from({ length: 80 }, (_, i) => ({ id: i + 1, time_ms: i * 1000, kind: 'note', body: 'Značka ' + i,
        author: 'Tester', editor: 'Tester', created_by: 1, updated_by: 1, revision: 1,
        created_at: '2026-09-26 12:00:00', updated_at: '2026-09-26 12:00:00', can_edit: true, can_delete: true })) };
(async () => {
    const executablePath = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, chromium.executablePath(),
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && fs.existsSync(p));
    const browser = await chromium.launch({ headless: true, executablePath });
    try {
        const page = await browser.newPage();
        const errors = []; page.on('pageerror', e => errors.push(e.message));
        await page.route('http://looper.test/**', route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
        await page.goto('http://looper.test/');
        for (const width of [320, 390, 767, 1440]) {
            await page.setViewportSize({ width, height: 844 });
            await page.setContent(`<style>${fs.readFileSync(path.join(root, 'css/vz2.css'), 'utf8')}</style>${markup}<div>Obsah aplikace</div>`);
            await page.evaluate(value => {
                window.VZ2 = { cachePrefix: 'test-', csrf: 'test' };
                window.fetch = async () => ({ ok: true, json: async () => structuredClone(value) });
                const wave = document.getElementById('looper-wave'); wave.height = 90; wave.style.height = '90px';
                document.getElementById('looper-wave-track').style.height = '90px';
            }, data);
            await page.addScriptTag({ path: path.join(root, 'js/vz2-timestamps.js') });
            await page.evaluate(() => {
                window.notes = Vz2Timestamps.mount(document.getElementById('looper-timestamps'), 1,
                    { canPlay: () => true, currentTimeMs: () => 3000, durationMs: () => 100000, seek: ms => { window.seekTime = ms; } });
            });
            await page.waitForFunction(() => window.notes.list);
            const actions = page.locator('.looper-timestamp-actions');
            const notes = page.locator('#looper-timestamps');
            if (width <= 767) {
                assert(await actions.isVisible()); assert.equal(await notes.isVisible(), false);
                for (const button of await actions.locator('button').all()) {
                    const box = await button.boundingBox(); assert(box.x >= 0 && box.x + box.width <= width && box.y + box.height < 844);
                }
                await actions.getByRole('button', { name: 'Přidat značku', exact: true }).click();
                assert(await page.locator('.vz2-timestamp-editor').isVisible());
                assert.equal(await page.locator('.vz2-timestamp-editor input[name=time]').inputValue(), '00:03');
                const editor = page.locator('.vz2-timestamp-editor');
                await editor.getByRole('button', { name: 'Přičíst jednu sekundu', exact: true }).click();
                assert.equal(await editor.locator('input[name=time]').inputValue(), '00:04');
                await editor.getByRole('button', { name: 'Odečíst jednu sekundu', exact: true }).click();
                assert.equal(await editor.locator('input[name=time]').inputValue(), '00:03');
                await editor.locator('input[name=time]').fill('00:12');
                await editor.getByRole('button', { name: 'Aktualizovat čas', exact: true }).click();
                assert.equal(await editor.locator('input[name=time]').inputValue(), '00:03');
                assert.equal(await editor.getByRole('radio').count(), 4);
                for (const kind of ['Začátek', 'Konec', 'Pasáž', 'Poznámka']) assert(await editor.getByRole('radio', { name: kind, exact: true }).isVisible());
                assert.equal(await notes.isVisible(), false);
                await page.locator('.ts-close').click();
                await actions.getByRole('button', { name: 'Export', exact: true }).click();
                assert(await page.locator('.vz2-timestamp-export').isVisible());
                await page.locator('.ts-export-close').first().click();
                const before = await page.locator('#looper-wave').boundingBox();
                await actions.getByRole('button', { name: 'Otevřít časové značky', exact: true }).click();
                await page.waitForFunction(() => document.getElementById('looper-timestamps').getAnimations().every(a => a.playState === 'finished'));
                assert(await notes.isVisible());
                assert.equal(await actions.locator('button').first().getAttribute('aria-expanded'), 'true');
                const bounds = await notes.boundingBox(), row = await actions.boundingBox();
                assert(bounds.y >= row.y + row.height && bounds.height > 100);
                if (process.env.LOOPER_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.LOOPER_SCREENSHOT_DIR, `looper-drawer-${width}.png`) });
                const scroll = await notes.evaluate(n => { n.scrollTop = n.scrollHeight; return n.scrollTop; }); assert(scroll > 0);
                assert.deepEqual(await page.locator('#looper-wave').boundingBox(), before);
                await notes.locator('.ts-time').last().click();
                assert.equal(await page.evaluate(() => window.seekTime), 79000);
                await actions.getByRole('button', { name: 'Zavřít časové značky', exact: true }).click();
                assert.equal(await notes.isVisible(), false);
                await actions.locator('button').first().click(); await page.keyboard.press('Escape');
                assert.equal(await notes.isVisible(), false);
                await page.evaluate(() => {
                    document.getElementById('player-shell').classList.add('player-fullscreen');
                    const wave = document.getElementById('looper-wave'); wave.height = 180; wave.style.height = '180px';
                    document.getElementById('looper-wave-track').style.height = '180px';
                });
                await actions.locator('button').first().click(); assert(await notes.isVisible());
                assert((await notes.boundingBox()).height > 100);
            } else {
                assert.equal(await actions.isVisible(), false);
                await notes.locator('summary').click();
                assert(await notes.getByRole('button', { name: 'Přidat značku', exact: true }).isVisible());
                assert(await notes.evaluate(n => n.scrollHeight > n.clientHeight));
            }
            await page.evaluate(() => window.notes.destroy());
            assert.equal(await actions.count(), 0);
            console.log(`Looper drawer ${width}px: PASS`);
        }
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
