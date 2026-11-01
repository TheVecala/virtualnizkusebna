'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

module.exports = async ({ base, clients, good, upload, wav, request, check, temp }) => {
    const collection = await good('admin', { action: 'collection_create', kind: 'song', title: 'Hranice ve waveformu' });
    const tone = wav(10);
    for (let i = 0; i < (tone.length - 44) / 2; i++) tone.writeInt16LE(Math.round(Math.sin(i / 8000 * 440 * Math.PI * 2) * 12000), 44 + i * 2);
    const recording = (await upload('admin', collection.id, 'Test hranic', 'single', ['hranice.wav'], [tone])).json();
    const first = (await request(clients.admin, 'php/ajax/vz2_timestamps.php?recording_id=' + recording.id)).json();
    const start = await request(clients.admin, 'php/ajax/vz2_timestamps.php', {
        action: 'create', recording_id: recording.id, timestamps_revision: first.timestamps_revision,
        kind: 'song_start', time_ms: 2000, body: 'Začátek testu'
    });
    assert.equal(start.status, 201, start.text);
    const startId = start.json().entries.find(entry => entry.kind === 'song_start').id;
    const end = await request(clients.admin, 'php/ajax/vz2_timestamps.php', {
        action: 'create', recording_id: recording.id, timestamps_revision: start.json().timestamps_revision,
        kind: 'song_end', time_ms: 6000, body: 'Konec testu', paired_timestamp_id: startId
    });
    assert.equal(end.status, 201, end.text);
    const passageBody = 'Testovací pasáž s delším popisem a několika detaily pro zarovnání tlačítek';
    const passage = await request(clients.admin, 'php/ajax/vz2_timestamps.php', {
        action: 'create', recording_id: recording.id, timestamps_revision: end.json().timestamps_revision,
        kind: 'passage', time_ms: 3000, body: passageBody
    });
    assert.equal(passage.status, 201, passage.text);
    const note = await request(clients.admin, 'php/ajax/vz2_timestamps.php', {
        action: 'create', recording_id: recording.id, timestamps_revision: passage.json().timestamps_revision,
        kind: 'note', time_ms: 4000, body: 'Testovací poznámka'
    });
    assert.equal(note.status, 201, note.text);

    const executablePath = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, chromium.executablePath()].find(file => file && fs.existsSync(file));
    const browser = await chromium.launch({ headless: true, executablePath });
    try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const [name, value] = clients.admin.cookie.split('=');
        await context.addCookies([{ name, value, url: base }]);
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
        await page.goto(base + 'index.php?v=2&collection_id=' + collection.id);
        const card = page.locator('#recording-' + recording.id);
        await card.locator('.recording-toggle').click();
        await card.getByRole('button', { name: 'Otevřít v Looperu' }).click();
        await page.waitForFunction(id => {
            const state = window.Vz2Player?.getState();
            return state?.id === String(id) && state.phase === 'ready';
        }, recording.id);
        const startMarker = page.locator('.looper-wave-marker[data-kind=song_start]');
        const endMarker = page.locator('.looper-wave-marker[data-kind=song_end]');
        const passageMarker = page.locator('.looper-wave-marker[data-kind=passage]');
        const noteMarker = page.locator('.looper-wave-marker[data-kind=note]');
        await endMarker.waitFor({ state: 'visible' });
        await noteMarker.waitFor({ state: 'visible' });
        assert.equal(await page.locator('.looper-wave-marker-icon').count(), 0, 'Waveform timestamps have no label icons');
        assert.equal(await page.locator('#looper-wave-regions').count(), 0, 'Passage does not color a waveform interval');
        assert.equal(await passageMarker.locator('.looper-wave-marker-text').textContent(), passageBody);
        assert.equal(await noteMarker.locator('.looper-wave-marker-text').textContent(), 'Testovací poznámka');
        assert.equal(await startMarker.locator('.looper-wave-boundary path').count(), 1);
        assert.equal(await endMarker.locator('.looper-wave-boundary path').count(), 1);
        assert(await page.evaluate(() => {
            const start = document.querySelector('.looper-wave-marker[data-kind=song_start]');
            const end = document.querySelector('.looper-wave-marker[data-kind=song_end]');
            return start.querySelector('svg').getBoundingClientRect().right > start.getBoundingClientRect().right + 10
                && end.querySelector('svg').getBoundingClientRect().left < end.getBoundingClientRect().left - 10;
        }), 'The two arrows point in opposite directions from their vertical lines');
        await page.locator('#looper-wave-scroll').screenshot({ path: path.join(temp, 'wave-boundaries.png') });
        await startMarker.locator('.looper-wave-boundary').click({ position: { x: 15, y: 9 } });
        assert(Math.abs((await page.evaluate(() => window.Vz2Player.getState().position)) - 2) < 0.1, 'Arrow seeks to the start timestamp');
        await endMarker.locator('.looper-wave-marker-label').click();
        assert(Math.abs((await page.evaluate(() => window.Vz2Player.getState().position)) - 6) < 0.1, 'End marker seeks to its timestamp');
        await page.setViewportSize({ width: 1872, height: 844 });
        await page.locator('#player-fullscreen').click();
        const timestamps = page.locator('#looper-timestamps .vz2-timestamps');
        await timestamps.locator('.ts-summary').click();
        const layout = await timestamps.evaluate(shell => {
            const list = shell.querySelector('ol').getBoundingClientRect();
            const rows = [...shell.querySelectorAll('li .ts-row-main')].map(item => ({
                kind: item.parentElement.className,
                right: item.querySelector('.toolbar').getBoundingClientRect().right,
                width: item.getBoundingClientRect().width
            }));
            const actions = rows.map(item => item.right);
            return { listWidth: list.width, actionOffset: Math.max(...actions) - list.left, alignment: Math.max(...actions) - Math.min(...actions), rows };
        });
        assert(layout.listWidth > 1000 && layout.actionOffset < 550, 'Actions stay near timestamp text on a wide screen');
        assert(layout.alignment < 2, 'Actions remain aligned across timestamp kinds and text lengths: ' + JSON.stringify(layout));
        await page.locator('#looper-timestamps').screenshot({ path: path.join(temp, 'timestamp-actions-desktop.png') });
        assert.deepEqual(errors, []);
        check(true, 'browser: waveform labels and arrows, passage styling, seeking and aligned timestamp actions');
    } finally { await browser.close(); }
};
