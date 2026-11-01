'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const theme = process.env.VZ2_TEST_THEME === 'light' ? 'light' : 'dark';
const source = fs.readFileSync(path.join(root, 'index.php'), 'utf8');
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
        for (const width of [320, 390, 767, 960, 1440]) {
            await page.evaluate(() => localStorage.removeItem('vz2-timestamp-add-view'));
            await page.setViewportSize({ width, height: 844 });
            await page.setContent(`<style>${fs.readFileSync(path.join(root, 'css/themes.css'), 'utf8')}${fs.readFileSync(path.join(root, 'css/vz2.css'), 'utf8')}</style>${markup}<div>Obsah aplikace</div>`);
            await page.evaluate(value => { document.documentElement.dataset.theme = value; }, theme);
            assert.equal(await page.locator('#player-shell').evaluate(node => getComputedStyle(node).getPropertyValue('--color-player-bg').trim()),
                theme === 'light' ? '#FFFFFF' : '#292F2B');
            await page.evaluate(value => {
                window.VZ2 = { cachePrefix: 'test-', csrf: 'test' };
                window.timestampWrites = [];
                delete window.seekTime;
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
                    { canPlay: () => true, currentTimeMs: () => 3000, durationMs: () => 100000, seek: ms => { window.seekTime = ms; }, playRange: async ms => { window.playTime = ms; } });
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
                const editor = page.locator('.vz2-timestamp-editor');
                assert(await editor.getByRole('button', { name: 'Otevřít pokročilé možnosti' }).isVisible());
                assert(await editor.getByRole('button', { name: 'Uložit poznámku' }).isVisible());
                assert.equal(await editor.locator('.ts-simple-time-value').textContent(), '00:03');
                assert.equal(await editor.locator('.ts-time-row').isVisible(), false);
                if (process.env.LOOPER_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.LOOPER_SCREENSHOT_DIR, `looper-simple-${width}.png`) });
                if (width === 320) {
                    await editor.locator('[name=body]').focus();
                    await page.evaluate(() => {
                        window.simpleVisualViewport = window.visualViewport;
                        Object.defineProperty(window, 'visualViewport', { configurable: true, value: { offsetTop: 0, height: innerHeight - 300 } });
                        document.querySelector('.vz2-timestamp-editor input[name=body]').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
                    });
                    const footer = await editor.locator('.ts-editor-footer').boundingBox();
                    assert(footer.y + footer.height <= 844 - 300 + 1, 'simple save stays above the mobile keyboard');
                    await page.evaluate(() => { Object.defineProperty(window, 'visualViewport', { configurable: true, value: window.simpleVisualViewport }); });
                    await editor.focus();
                }
                await editor.locator('[name=body]').fill('Rozepsaná poznámka');
                await editor.getByRole('button', { name: 'Otevřít pokročilé možnosti' }).click();
                assert.equal(await editor.locator('[name=body]').inputValue(), 'Rozepsaná poznámka');
                await editor.getByRole('checkbox', { name: 'Vrátit na čas' }).check();
                await editor.getByRole('button', { name: 'Zpět k jednoduchému zobrazení' }).click();
                assert.equal(await editor.locator('[name=body]').inputValue(), 'Rozepsaná poznámka');
                if (width === 320) await editor.locator('[name=body]').press('Enter');
                else await editor.getByRole('button', { name: 'Uložit poznámku' }).click();
                assert.deepEqual(await page.evaluate(() => {
                    const { kind, time_ms, body } = window.timestampWrites.at(-1);
                    return { kind, time_ms, body };
                }), { kind: 'note', time_ms: 3000, body: 'Rozepsaná poznámka' });
                assert.equal(await page.evaluate(() => window.seekTime), undefined);
                assert.equal(await editor.locator('[name=body]').inputValue(), '');
                await editor.getByRole('button', { name: 'Otevřít pokročilé možnosti' }).click();
                assert.equal(await page.locator('.vz2-timestamp-editor').evaluate(e => e.matches(':modal')), false);
                assert.equal(await page.locator('.vz2-timestamp-editor').evaluate(e => e.parentElement.tagName), 'BODY');
                assert.equal(await page.evaluate(() => document.activeElement?.matches('input[name=body],input[name=time]')), false);
                await page.locator('#looper-play').click();
                if (process.env.LOOPER_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.LOOPER_SCREENSHOT_DIR, `looper-add-${width}.png`) });
                assert.equal(await page.locator('.vz2-timestamp-editor input[name=time]').inputValue(), '00:03');
                assert.equal(await editor.locator('[name=body]').getAttribute('autocomplete'), 'off');
                assert.deepEqual(await editor.locator('.ts-time-row > *').evaluateAll(elements => elements.map(element => element.name || element.dataset.delta || element.className)),
                    ['time', '-1000', '1000', 'ts-time-current']);
                await editor.getByRole('button', { name: 'Přičíst jednu sekundu', exact: true }).click();
                assert.equal(await editor.locator('input[name=time]').inputValue(), '00:04');
                await editor.getByRole('button', { name: 'Odečíst jednu sekundu', exact: true }).click();
                assert.equal(await editor.locator('input[name=time]').inputValue(), '00:03');
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
                assert.equal(await editor.locator('[name=paired_timestamp_id]').isVisible(), false);
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
                        { canPlay: () => true, currentTimeMs: () => 3000, durationMs: () => 100000, seek: ms => { window.seekTime = ms; }, playRange: async ms => { window.playTime = ms; } });
                });
                await page.waitForFunction(() => window.notes.list);
                assert.equal(await editor.locator('[name=body]').inputValue(), 'Rozepsaný text', 'draft survives a player refresh');
                assert.equal(await editor.evaluate(e => e.parentElement.tagName), 'BODY');
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
                await actions.getByRole('button', { name: 'Zavřít časové značky', exact: true }).waitFor();
                if (process.env.LOOPER_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.LOOPER_SCREENSHOT_DIR, `looper-drawer-${width}.png`) });
                const scroll = await notes.evaluate(n => { n.scrollTop = n.scrollHeight; return n.scrollTop; }); assert(scroll > 0);
                assert.deepEqual(await page.locator('#looper-wave').boundingBox(), before);
                await notes.locator('.ts-time').last().click();
                assert.equal(await page.evaluate(() => window.playTime), 79000);
                await actions.getByRole('button', { name: 'Zavřít časové značky', exact: true }).click();
                assert.equal(await notes.isVisible(), false);
                await actions.locator('button').first().click(); await page.keyboard.press('Escape');
                assert.equal(await notes.isVisible(), false);
                await page.evaluate(() => {
                    document.getElementById('player-shell').classList.add('player-fullscreen');
                });
                assert(await notes.isVisible(), 'fullscreen timestamps open automatically');
                assert.equal(await actions.locator('button').first().isVisible(), false, 'fullscreen timestamps cannot be collapsed');
                assert(await notes.locator('details').evaluate(node => node.open));
                const reload = actions.getByRole('button', { name: 'Obnovit značky', exact: true });
                assert(await reload.isVisible());
                assert(await reload.evaluate(node => node.previousElementSibling.textContent === 'Přidat značku'));
                assert((await notes.boundingBox()).height > 100);
                await actions.getByRole('button', { name: 'Přidat značku', exact: true }).click();
                assert(await notes.isVisible() && await actions.isVisible(), 'adding a timestamp keeps the list and actions visible');
                assert.equal(await editor.evaluate(node => node.parentElement.id), 'looper-timestamps');
                for (const view of ['advanced', 'simple']) {
                    if (view === 'simple') await editor.getByRole('button', { name: 'Zpět k jednoduchému zobrazení' }).click();
                    const formBox = await editor.boundingBox();
                    const firstRow = await notes.locator('li').first().boundingBox();
                    const actionsBox = await actions.boundingBox();
                    assert(formBox.y >= actionsBox.y + actionsBox.height, 'form does not cover actions');
                    assert(firstRow.y >= formBox.y + formBox.height && firstRow.y + firstRow.height <= 844, 'timestamp rows remain visible below the form');
                }
                await notes.locator('.ts-time').first().click();
                assert.equal(await page.evaluate(() => window.playTime), 0, 'list remains interactive while adding');
                await reload.click();
                assert(await editor.isVisible(), 'refresh keeps the form open');
                await editor.getByRole('button', { name: 'Zavřít časovou značku' }).click();
                assert(await notes.isVisible() && await actions.isVisible());
                await page.evaluate(() => document.getElementById('player-shell').classList.remove('player-fullscreen'));
                assert.equal(await notes.isVisible(), false, 'leaving fullscreen restores the closed drawer');
                await actions.getByRole('button', { name: 'Otevřít časové značky' }).click();
                assert(await notes.getByRole('button', { name: 'Obnovit značky' }).isVisible(), 'refresh returns to the drawer');
            } else {
                assert.equal(await actions.isVisible(), false);
                await notes.locator('summary').click();
                assert(await notes.getByRole('button', { name: 'Přidat značku', exact: true }).isVisible());
                await notes.getByRole('button', { name: 'Přidat značku', exact: true }).click();
                const editor = page.locator('.vz2-timestamp-editor');
                assert(await editor.getByRole('button', { name: 'Otevřít pokročilé možnosti' }).isVisible());
                assert.equal(await editor.evaluate(e => e.matches(':modal')), false);
                assert.equal(await editor.evaluate(e => e.parentElement.id), 'looper-timestamps');
                const listBox = await notes.locator('.vz2-timestamps').boundingBox();
                const editorBox = await editor.boundingBox();
                if (width >= 1100) {
                    assert(editorBox.x >= listBox.x + listBox.width - 1, 'wide desktop editor stays beside the timestamp list');
                    assert(Math.abs(editorBox.y - listBox.y) <= 2, 'wide desktop editor aligns with the timestamp heading');
                }
                else assert(editorBox.y + editorBox.height <= listBox.y + 1, 'narrow desktop editor stays above the timestamp list');
                await page.locator('#looper-play').click();
                if (process.env.LOOPER_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.LOOPER_SCREENSHOT_DIR, `looper-simple-${width}.png`) });
                await editor.locator('[name=body]').fill('Poznámka z desktopu');
                await editor.getByRole('button', { name: 'Uložit poznámku' }).click();
                assert.equal(await editor.isVisible(), true);
                assert.equal(await editor.locator('[name=body]').inputValue(), '');
                assert.deepEqual(await page.evaluate(() => {
                    const { kind, time_ms, body } = window.timestampWrites.at(-1);
                    return { kind, time_ms, body };
                }), { kind: 'note', time_ms: 3000, body: 'Poznámka z desktopu' });
                await editor.getByRole('button', { name: 'Zavřít časovou značku' }).click();
                await notes.getByRole('button', { name: 'Upravit', exact: true }).first().click();
                assert.equal(await editor.getByRole('button', { name: 'Otevřít pokročilé možnosti' }).isVisible(), false);
                assert(await editor.getByRole('button', { name: 'Poznámka', exact: true }).isVisible());
                await editor.getByRole('button', { name: 'Zavřít časovou značku' }).click();
                await notes.getByRole('button', { name: 'Přidat značku', exact: true }).click();
                assert(await editor.getByRole('button', { name: 'Otevřít pokročilé možnosti' }).isVisible());
                await editor.getByRole('button', { name: 'Otevřít pokročilé možnosti' }).click();
                if (process.env.LOOPER_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.LOOPER_SCREENSHOT_DIR, `looper-advanced-${width}.png`) });
                if (width === 1440) {
                    await page.setViewportSize({ width, height: 500 });
                    const footer = await editor.locator('.ts-editor-footer').boundingBox();
                    assert(footer.y + footer.height <= 500, 'advanced save buttons remain visible in a short desktop window');
                    await page.setViewportSize({ width, height: 844 });
                }
                await editor.locator('[name=body]').fill('Rozepsáno na desktopu');
                await editor.getByRole('button', { name: 'Zpět k jednoduchému zobrazení' }).click();
                assert.equal(await editor.locator('[name=body]').inputValue(), 'Rozepsáno na desktopu');
                await editor.getByRole('button', { name: 'Otevřít pokročilé možnosti' }).click();
                await editor.getByRole('button', { name: 'Zavřít časovou značku' }).click();
                await notes.getByRole('button', { name: 'Přidat značku', exact: true }).click();
                assert(await editor.getByRole('button', { name: 'Zpět k jednoduchému zobrazení' }).isVisible());
                assert.equal(await page.evaluate(() => localStorage.getItem('vz2-timestamp-add-view')), 'advanced');
                await editor.getByRole('button', { name: 'Zavřít časovou značku' }).click();
                await page.waitForFunction(() => !document.getElementById('looper-timestamps').classList.contains('ts-editor-open'));
                assert(await notes.evaluate(n => n.scrollHeight > n.clientHeight));
                if (width === 1440) {
                    await notes.getByRole('button', { name: 'Přidat značku', exact: true }).click();
                    await editor.locator('[name=body]').fill('Rozepsáno při změně šířky');
                    await page.setViewportSize({ width: 390, height: 844 });
                    await page.waitForFunction(() => document.querySelector('.vz2-timestamp-editor.ts-inline')?.open);
                    assert.equal(await editor.locator('[name=body]').inputValue(), 'Rozepsáno při změně šířky');
                    await page.setViewportSize({ width: 1440, height: 844 });
                    await page.waitForFunction(() => document.querySelector('#looper-timestamps > .vz2-timestamp-editor.ts-docked')?.open);
                    assert.equal(await editor.locator('[name=body]').inputValue(), 'Rozepsáno při změně šířky');
                    await editor.getByRole('button', { name: 'Zavřít časovou značku' }).click();
                }
            }
            await page.evaluate(() => window.notes.destroy());
            assert.equal(await actions.count(), 0);
            console.log(`Looper drawer ${width}px: PASS`);
        }
        await page.setViewportSize({ width: 1440, height: 844 });
        await page.evaluate(() => localStorage.removeItem('vz2-timestamp-add-view'));
        await page.setContent(`<style>${fs.readFileSync(path.join(root, 'css/vz2.css'), 'utf8')}</style><div class="recording-body" id="recording-body-1"><button id="recording-play" type="button">Přehrát</button></div>`);
        await page.evaluate(value => {
            window.VZ2 = { csrf: 'test' };
            window.recordingClicks = 0;
            document.getElementById('recording-play').onclick = () => { window.recordingClicks++; };
            window.fetch = async (_url, options) => {
                if (options?.body) window.recordingWrite = JSON.parse(options.body);
                return { ok: true, json: async () => structuredClone(value) };
            };
        }, data);
        await page.addScriptTag({ path: path.join(root, 'js/vz2-timestamps.js') });
        await page.evaluate(() => {
            window.recordingNotes = Vz2Timestamps.mount(document.getElementById('recording-body-1'), 1,
                { canPlay: () => true, currentTimeMs: () => 5123, durationMs: () => 100000, seek: () => {}, playRange: async () => {} });
        });
        await page.waitForFunction(() => window.recordingNotes.list);
        const recording = page.locator('#recording-body-1'), recordingEditor = page.locator('.vz2-timestamp-editor');
        await recording.locator('summary').click();
        await recording.getByRole('button', { name: 'Přidat značku' }).click();
        assert.equal(await recordingEditor.evaluate(e => e.matches(':modal')), false);
        assert.equal(await recordingEditor.evaluate(e => e.parentElement.id), 'recording-body-1');
        const playBox = await recording.locator('#recording-play').boundingBox(), formBox = await recordingEditor.boundingBox();
        assert(formBox.y >= playBox.y + playBox.height, 'recording editor appears beneath playback controls');
        await recording.locator('#recording-play').click();
        assert.equal(await page.evaluate(() => window.recordingClicks), 1);
        await recordingEditor.getByRole('button', { name: 'Otevřít pokročilé možnosti' }).click();
        await recordingEditor.locator('[name=body]').fill('Konec testu');
        await recordingEditor.getByRole('button', { name: 'Konec', exact: true }).click();
        const pair = recordingEditor.locator('.ts-pair-inline');
        assert(await pair.isVisible(), 'pairing appears within the nonmodal editor');
        await recording.locator('#recording-play').click();
        assert.equal(await page.evaluate(() => window.recordingClicks), 2);
        await pair.getByRole('button', { name: 'Zpět' }).click();
        assert.equal(await recordingEditor.locator('[name=body]').inputValue(), 'Konec testu');
        await recordingEditor.getByRole('button', { name: 'Konec', exact: true }).click();
        await pair.getByRole('button', { name: 'Uložit konec' }).click();
        assert.equal(await page.evaluate(() => window.recordingWrite.kind), 'song_end');
        assert.equal(await recordingEditor.isVisible(), true, 'desktop creation stays open for another timestamp');
        await recordingEditor.getByRole('button', { name: 'Zavřít časovou značku' }).click();
        await recording.getByRole('button', { name: 'Upravit', exact: true }).first().click();
        assert.equal(await recordingEditor.evaluate(e => e.matches(':modal')), false);
        assert.equal(await recordingEditor.evaluate(e => e.parentElement.id), 'recording-body-1');
        assert.equal(await recordingEditor.getByRole('button', { name: 'Otevřít pokročilé možnosti' }).isVisible(), false);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForFunction(() => document.querySelector('.vz2-timestamp-editor')?.matches(':modal'));
        await page.setViewportSize({ width: 1440, height: 844 });
        await page.waitForFunction(() => document.querySelector('#recording-body-1 > .vz2-timestamp-editor.ts-docked')?.open);
        await recording.locator('#recording-play').click();
        assert.equal(await page.evaluate(() => window.recordingClicks), 3);
        await recordingEditor.getByRole('button', { name: 'Zavřít časovou značku' }).click();
        await page.evaluate(() => window.recordingNotes.destroy());
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
