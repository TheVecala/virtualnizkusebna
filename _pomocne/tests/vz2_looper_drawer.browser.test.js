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
                window.timestampWrites = [];
                window.fetch = async (_url, options) => {
                    if (options?.body) window.timestampWrites.push(JSON.parse(options.body));
                    return { ok: true, json: async () => structuredClone(value) };
                };
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
                assert(await actions.getByRole('button', { name: 'Přidat poznámku: palec nahoru' }).isVisible());
                assert(await actions.getByRole('button', { name: 'Přidat poznámku: palec dolů' }).isVisible());
                for (const button of await actions.locator('button').all()) {
                    const box = await button.boundingBox(); assert(box.x >= 0 && box.x + box.width <= width && box.y + box.height < 844);
                }
                await actions.getByRole('button', { name: 'Přidat značku', exact: true }).click();
                assert(await page.locator('.vz2-timestamp-editor').isVisible());
                assert.equal(await page.locator('.vz2-timestamp-editor').evaluate(e => e.matches(':modal')), false);
                assert.equal(await page.locator('.vz2-timestamp-editor').evaluate(e => e.parentElement.id), 'looper-panel');
                assert.equal(await page.evaluate(() => document.activeElement?.matches('input[name=body],input[name=time]')), false);
                await page.locator('#looper-play').click();
                if (process.env.LOOPER_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.LOOPER_SCREENSHOT_DIR, `looper-add-${width}.png`) });
                assert.equal(await page.locator('.vz2-timestamp-editor input[name=time]').inputValue(), '00:03');
                const editor = page.locator('.vz2-timestamp-editor');
                assert.equal(await editor.locator('[name=body]').getAttribute('autocomplete'), 'off');
                assert.deepEqual(await editor.locator('.ts-time-row > *').evaluateAll(elements => elements.map(element => element.name || element.dataset.delta || element.className)),
                    ['time', '-1000', '1000', 'ts-time-current']);
                await editor.getByRole('button', { name: 'Přičíst jednu sekundu', exact: true }).click();
                assert.equal(await editor.locator('input[name=time]').inputValue(), '00:00:04.000');
                await editor.getByRole('button', { name: 'Odečíst jednu sekundu', exact: true }).click();
                assert.equal(await editor.locator('input[name=time]').inputValue(), '00:00:03.000');
                await editor.locator('input[name=time]').fill('00:12');
                await editor.getByRole('button', { name: 'Zachytit čas', exact: true }).click();
                assert.equal(await editor.locator('input[name=time]').inputValue(), '00:03');
                assert.equal(await editor.getByRole('radio').count(), 0);
                for (const kind of ['Začátek', 'Konec', 'Pasáž', 'Poznámka']) assert(await editor.getByRole('button', { name: kind, exact: true }).isVisible());
                assert.equal(await editor.getByRole('button', { name: 'Zrušit', exact: true }).count(), 0);
                assert.equal(await editor.locator('[name=keep]').count(), 0);
                assert(await editor.getByRole('checkbox', { name: 'Vrátit na čas', exact: true }).isVisible());
                for (const label of ['Přidat poznámku: palec nahoru', 'Přidat poznámku: palec dolů']) {
                    const quick = editor.getByRole('button', { name: label });
                    assert(await quick.isVisible());
                    assert((await quick.boundingBox()).x > (await editor.locator('.ts-return').boundingBox()).x);
                }
                assert.equal(await editor.locator('[name=body]').evaluate(e => e.tagName), 'INPUT');
                assert.equal(await editor.locator('[name=paired_timestamp_id]').count(), 0);
                assert(await editor.locator('[name=body]').evaluate(input => input.compareDocumentPosition(input.closest('.ts-editor-body').querySelector('[name=time]')) & Node.DOCUMENT_POSITION_FOLLOWING));
                assert.notEqual(await editor.evaluate(e => getComputedStyle(e).borderColor), 'rgb(96, 107, 114)');
                await editor.locator('[name=body]').focus();
                await page.evaluate(() => {
                    window.testVisualViewport = window.visualViewport;
                    Object.defineProperty(window, 'visualViewport', { configurable: true, value: { offsetTop: 0, height: innerHeight - 300 } });
                    document.querySelector('.vz2-timestamp-editor input[name=body]').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
                });
                const footer = await editor.locator('.ts-editor-footer').boundingBox();
                const editorBox = await editor.boundingBox();
                assert(footer.y + footer.height <= 844 - 300 + 1, 'save buttons stay above the simulated mobile keyboard');
                assert(footer.y >= editorBox.y && footer.y + footer.height <= editorBox.y + editorBox.height + 1,
                    'save buttons stay inside the form');
                assert((await editor.locator('[name=body]').boundingBox()).y < footer.y, 'text field remains above the save buttons');
                assert((await page.locator('#looper-wave').boundingBox()).y < footer.y, 'waveform remains visible');
                await editor.locator('[name=body]').fill('Poznámka s klávesnicí');
                await editor.getByRole('button', { name: 'Poznámka', exact: true }).click();
                assert.equal(await page.evaluate(() => window.timestampWrites.at(-1)?.body), 'Poznámka s klávesnicí');
                assert(await editor.isVisible(), 'form stays usable after saving with the keyboard visible');
                await page.evaluate(() => {
                    Object.defineProperty(window, 'visualViewport', { configurable: true, value: window.testVisualViewport });
                    document.querySelector('.vz2-timestamp-editor').focus();
                });
                await editor.locator('[name=body]').fill('Rozepsaný text');
                await page.evaluate(() => {
                    window.notes.destroy();
                    window.notes = Vz2Timestamps.mount(document.getElementById('looper-timestamps'), 1,
                        { canPlay: () => true, currentTimeMs: () => 3000, durationMs: () => 100000, seek: ms => { window.seekTime = ms; } });
                });
                await page.waitForFunction(() => window.notes.list);
                assert.equal(await editor.locator('[name=body]').inputValue(), 'Rozepsaný text', 'draft survives a player refresh');
                assert.equal(await editor.evaluate(e => e.parentElement.id), 'looper-panel');
                await editor.getByRole('button', { name: 'Přidat poznámku: palec nahoru' }).click();
                assert.equal(await editor.locator('[name=body]').inputValue(), 'Rozepsaný text');
                await editor.getByRole('button', { name: 'Poznámka', exact: true }).click();
                assert(await editor.isVisible(), 'mobile creation stays open after saving');
                assert.equal(await editor.locator('[name=body]').inputValue(), '');
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
                await actions.getByRole('button', { name: 'Přidat značku', exact: true }).click();
                assert.equal(await notes.isVisible(), false, 'opening the form closes the timestamp drawer');
                assert.equal(await actions.locator('button').first().getAttribute('aria-expanded'), 'false');
                assert(await editor.isVisible());
                await editor.getByRole('button', { name: 'Zavřít časovou značku' }).click();
                await actions.waitFor({ state: 'visible' });
                await actions.getByRole('button', { name: 'Otevřít časové značky', exact: true }).click();
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
