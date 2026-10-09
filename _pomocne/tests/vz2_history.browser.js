'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');

module.exports = async function ({ base, clients, request, check, song, rehearsal, source, clip, directClip, start, end }) {
    const executablePath = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, chromium.executablePath()].find(p => p && fs.existsSync(p));
    const browser = await chromium.launch({ headless: true, executablePath, args: ['--autoplay-policy=no-user-gesture-required'] });
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
        const history = page.locator('#history-workspace'), add = page.locator('#history-add'), detail = page.locator('#history-detail'), list = page.locator('#history-list');
        async function openHistory() {
            const menu = page.locator('.shell-menu');
            if ((await menu.getAttribute('open')) === null) await menu.locator('summary').click();
            await page.locator('#show-history').click();
            await history.locator('.history-table').waitFor();
        }
        const cell = () => history.locator('td[data-song-id="'+song.id+'"][data-rehearsal-id="'+rehearsal.id+'"]');
        async function openList() {
            if (!await list.isVisible()) await cell().locator('.history-count').click();
            await list.waitFor();
            assert.equal(await page.locator('#history-list-title').textContent(), 'skladba: Historie – skladba × zkouška: Historie – zkouška');
            assert.equal(await page.locator('dialog[open]').count(), 1);
        }
        async function closeList() {
            if (await list.isVisible()) await list.locator('[data-history-close]').click();
        }
        async function openAttempt(name) {
            await openList();
            assert(await list.evaluate(n=>n.scrollWidth<=n.clientWidth+1), 'compact list fits viewport');
            await list.locator('.history-list-row').filter({ hasText: name }).click();
            await detail.waitFor();
            assert.equal(await list.isVisible(), false);
            assert.equal(await page.locator('dialog[open]').count(), 1);
        }
        async function addCandidate(value) {
            await openList();
            await page.locator('#history-list-add').click();
            await add.locator('input[value="' + value + '"]').check();
            await add.getByRole('button', { name: 'Přidat', exact: true }).click();
            await add.waitFor({ state: 'hidden' });
            await list.waitFor();
        }
        await page.evaluate(async rid => {
            const catalog = await (await fetch('php/ajax/vz2.php?action=catalog')).json();
            const recording = catalog.recordings.find(r => Number(r.id) === rid);
            await window.Vz2Player.openLooper(recording, recording.files[0]);
            window.songPanelBeforeHistory = document.getElementById('content-area');
        }, source);
        await page.waitForFunction(() => window.Vz2Player.getState()?.phase === 'ready');
        await page.locator('#looper-audio').evaluate(async audio => { audio.muted = true; audio.loop = true; await audio.play(); });
        await openHistory();
        assert.equal(await page.locator('#app-shell').isVisible(), true);
        assert.equal(await page.locator('#sidebar-slot #sidebar').isVisible(), true);
        assert.equal(await page.locator('#song-workspace').isVisible(), false);
        assert.equal(await page.locator('#player-shell').isVisible(), true);
        assert.equal(await page.evaluate(() => window.Vz2Player.getState().playing), true);
        const geometry = await page.evaluate(() => {
            const history = document.getElementById('history-workspace').getBoundingClientRect();
            const player = document.getElementById('player-shell').getBoundingClientRect();
            const sidebar = document.getElementById('sidebar-slot').getBoundingClientRect();
            return { history: { x: history.x, y: history.y, bottom: history.bottom, width: history.width }, playerBottom: player.bottom, sidebarRight: sidebar.right };
        });
        assert(geometry.history.x >= geometry.sidebarRight && geometry.history.y >= geometry.playerBottom && geometry.history.bottom <= 1000);
        await history.locator('.panel-fullscreen-button').click();
        assert.equal(await history.locator('.panel-fullscreen-button').getAttribute('aria-pressed'), 'true');
        assert.deepEqual(await history.evaluate(n => { const r = n.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; }), [0, 0, 1440, 1000]);
        assert.equal(await page.evaluate(() => window.Vz2Player.getState().playing), true);
        await page.keyboard.press('Escape');
        assert.equal(await history.locator('.panel-fullscreen-button').getAttribute('aria-pressed'), 'false');
        assert.equal(await page.locator('#player-fullscreen').isVisible(), true);
        assert.equal(await page.locator('#looper-fullscreen').count(), 0);
        check(true, 'browser history: workspace retains sidebar and playing Looper; shared header fullscreen restores on Escape');
        await addCandidate('i:' + source + ':' + start.id + ':' + end.id);
        await openAttempt('Začátek pokusu');
        await detail.waitFor();
        assert.equal(await page.locator('#history-detail-title').textContent(), 'Začátek pokusu');
        assert.equal(await detail.locator('.history-detail-context').textContent(), 'skladba: Historie – skladba × zkouška: Historie – zkouška');
        assert.equal(await detail.locator('.history-start').count(), 0);
        assert.equal(await detail.locator('#history-detail-back').count(), 0);
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
        assert.equal(await detail.getByRole('button', { name: 'Připojit výstřižek', exact: true }).isDisabled(), true);
        await detail.getByLabel('Připojený výstřižek', { exact: true }).selectOption(String(clip));
        await detail.getByRole('button', { name: 'Připojit výstřižek', exact: true }).click();
        await detail.waitFor({ state: 'hidden' });
        await openAttempt('vystrizek.wav');
        assert.equal(await detail.locator('audio').count(), 2);
        await detail.getByText('Úpravy', { exact: true }).click();
        assert.equal(await detail.getByRole('button', { name: 'Změnit připojený výstřižek', exact: true }).isDisabled(), true);
        await detail.getByLabel('Připojený výstřižek', { exact: true }).selectOption('');
        assert.equal(await detail.getByRole('button', { name: 'Odpojit výstřižek', exact: true }).isEnabled(), true);
        await detail.getByRole('button', { name: 'Zavřít detail a vrátit se k seznamu', exact: true }).click();
        await list.waitFor();
        assert.equal(await list.locator('.history-list-row').count(), 1);
        await addCandidate('c:' + directClip);
        assert.equal(await list.locator('.history-list-row').count(), 2);
        assert.equal(await list.locator('audio').count(), 0, 'audio controls only appear in the selected attempt detail');
        await closeList();
        assert.equal(await cell().locator('.history-count').textContent(), '2');
        assert.equal(await cell().locator('button').count(), 1, 'matrix cell has one count regardless of attempt count');
        assert.equal(await history.locator('.history-list-row, .history-add').count(), 0);
        check(true, 'browser history: menu opens matrix; interval assignment seeks original audio and connects clip; two attempts share a single count and open via a compact list');
        await page.locator('#history-song-filter').selectOption(String(song.id));
        assert.equal(await history.locator('thead th').count(), 2);
        await page.locator('#history-orientation').click();
        assert.equal(await page.locator('#history-orientation').getAttribute('aria-pressed'), 'true');
        assert.equal(await history.locator('tbody tr').count(), 1);
        await page.locator('#history-audio-filter').check();
        assert.equal(await cell().locator('.history-count').textContent(), '2');
        await page.locator('[data-workspace-target="panels"]').click();
        assert.equal(await page.locator('#song-workspace').isVisible(), true);
        assert.equal(await page.evaluate(() => window.songPanelBeforeHistory === document.getElementById('content-area')), true);
        assert.equal(await page.evaluate(() => window.Vz2Player.getState().playing), true);
        await page.setViewportSize({ width: 390, height: 844 });
        await openHistory();
        assert.equal(await history.isVisible(), true);
        assert.equal(await page.locator('#history-song-filter').inputValue(), String(song.id));
        assert.equal(await page.locator('#history-orientation').getAttribute('aria-pressed'), 'true');
        assert.equal(await page.locator('#history-audio-filter').isChecked(), true);
        assert.equal(await page.evaluate(() => window.Vz2Player.getState().playing), true);
        assert(await page.locator('#history-close').isVisible());
        const bounds = await history.boundingBox();
        assert(bounds.x >= 0 && bounds.width <= 390, 'matrix stays within mobile viewport');
        await openAttempt('samostatny-pokus.wav');
        assert.equal(await detail.locator('audio').count(), 1);
        assert.equal(await page.locator('#history-detail-title').textContent(), 'samostatny-pokus.wav', 'standalone clip uses its filename as the heading');
        await detail.getByText('Úpravy', { exact: true }).click();
        await detail.getByRole('button', { name: 'Odebrat pokus z historie', exact: true }).click();
        await detail.waitFor({ state: 'hidden' });
        await list.waitFor();
        assert.equal(await list.locator('.history-list-row').count(), 1);
        await closeList();
        assert.equal(await cell().locator('.history-count').textContent(), '1');
        // Restore the second attempt through the same UI, with the default orientation.
        await page.locator('#history-orientation').click();
        await addCandidate('c:' + directClip);
        await closeList();
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
        const guestCell = guestPage.locator('td[data-song-id="'+song.id+'"][data-rehearsal-id="'+rehearsal.id+'"]');
        assert.equal(await guestCell.locator('button').count(), 1);
        assert.equal(await guestCell.locator('.history-count').textContent(), '2');
        await guestCell.locator('.history-count').click();
        assert.equal(await guestPage.locator('#history-list .history-list-row').count(), 2);
        assert.equal(await guestPage.locator('#history-list-add').isVisible(), false);
        await guestPage.locator('#history-list .history-list-row').filter({ hasText: 'vystrizek.wav' }).click();
        assert.equal(await guestPage.locator('#history-detail audio').count(), 2);
        assert.equal(await guestPage.locator('#history-detail-title').textContent(), 'Začátek pokusu');
        assert.equal(await guestPage.locator('#history-detail select').count(), 0);
        check(true, 'browser history: guest can browse and listen but has no edit controls');
    } finally { await browser.close(); }
};
