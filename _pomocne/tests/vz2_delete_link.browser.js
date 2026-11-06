'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
module.exports = async ({ base, clients, good, upload, wav, request, db, check }) => {
    const song = await good('admin', { action: 'collection_create', kind: 'song', title: 'Skladba mazání značek' });
    const rehearsal = await good('admin', { action: 'collection_create', kind: 'rehearsal', title: 'Zkouška mazání značek' });
    const source = (await upload('admin', rehearsal.id, 'Zdroj', 'single', ['source.wav'], [wav(10)])).json().id;
    const clip = (await upload('admin', song.id, 'Výstřižek', 'single', ['clip.wav'], [wav(2)])).json().id;
    const endpoint = 'php/ajax/vz2_timestamps.php';
    async function add(title, time) {
        const current = (await request(clients.admin, endpoint + '?recording_id=' + source)).json();
        const response = await request(clients.admin, endpoint, { action: 'save_interval', recording_id: source, timestamps_revision: current.timestamps_revision,
            kind: 'song_start', time_ms: time, end_time_ms: time + 1000, song_collection_id: song.id, body: title });
        assert.equal(response.status, 201, response.text);
        return response.json().annotations.find(item => item.label === title);
    }
    const first = await add('Značky v seznamu', 1000), second = await add('Značky na ose', 4000);
    const link = db('SELECT * FROM vz2_rehearsal_plays WHERE start_timestamp_id=?', [first.timestamp_id])[0];
    const attached = await request(clients.admin, 'php/ajax/vz2_history.php', { action: 'update', id: link.id, revision: link.revision,
        song_collection_id: song.id, rehearsal_collection_id: rehearsal.id, clip_recording_id: clip });
    assert.equal(attached.status, 200, attached.text);
    const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath() });
    try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const [name, value] = clients.admin.cookie.split('='); await context.addCookies([{ name, value, url: base }]);
        const page = await context.newPage(), errors = [], dialogs = []; let decisions = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('dialog', async dialog => { dialogs.push(dialog.message()); if (decisions.shift() === false) await dialog.dismiss(); else await dialog.accept(); });
        await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
        await page.goto(base + 'index.php?v=2&collection_id=' + rehearsal.id);
        const card = page.locator('#recording-' + source); await card.locator('.recording-toggle').click();
        await card.getByRole('button', { name: 'Otevřít časové značky', exact: true }).click();
        const row = card.locator('.ts-song_start').filter({ hasText: 'Značky v seznamu' }); await row.waitFor();
        decisions = [true, false];
        const declined = page.waitForEvent('dialog', { predicate: dialog => dialog.message().includes('matici') });
        await row.getByRole('button', { name: 'Smazat', exact: true }).click(); await declined;
        assert.equal(db('SELECT id FROM vz2_timestamps WHERE id=?', [first.timestamp_id]).length, 1, 'cancel leaves timestamps untouched');
        assert.equal(db('SELECT source_recording_id FROM vz2_rehearsal_plays WHERE id=?', [link.id])[0].source_recording_id, source, 'cancel leaves link untouched');
        assert.match(dialogs.at(-1), /matice|matici/); assert.match(dialogs.at(-1), /Nahrávka se nesmaže/);
        decisions = [true, true]; await row.getByRole('button', { name: 'Smazat', exact: true }).click(); await row.waitFor({ state: 'detached' });
        assert.equal(db('SELECT id FROM vz2_timestamps WHERE id IN (?,?)', [first.timestamp_id, first.end_timestamp_id]).length, 0);
        const savedClip = db('SELECT source_recording_id,clip_recording_id FROM vz2_rehearsal_plays WHERE id=?', [link.id])[0];
        assert.equal(savedClip.source_recording_id, null); assert.equal(savedClip.clip_recording_id, clip);
        assert.equal(await page.evaluate(({ songId, sourceId }) => (Vz2App.getCarContext().linkedRecordings[String(songId)] || []).filter(id => Number(id) === Number(sourceId)).length, { songId: song.id, sourceId: source }), 1, 'cached catalogue drops the deleted link and keeps the other');
        await page.goto(base + 'useky.php');
        await page.locator('#segments-recordings input[value="' + source + '"]').check();
        const point = page.locator('[data-segment-id="' + second.id + '"]'); await point.waitFor(); await point.click();
        decisions = [true, true]; await page.locator('#segments-delete').click(); await point.waitFor({ state: 'detached' });
        assert.equal(db('SELECT id FROM vz2_timestamps WHERE id IN (?,?)', [second.timestamp_id, second.end_timestamp_id]).length, 0);
        assert.equal(db('SELECT id FROM vz2_rehearsal_plays WHERE start_timestamp_id=?', [second.timestamp_id]).length, 0);
        assert.equal(db('SELECT id FROM vz2_recordings WHERE id IN (?,?)', [source, clip]).length, 2, 'source and clip recordings are preserved');
        assert.deepEqual(errors, []);
        check(true, 'browser: confirmation cancels safely or deletes linked timestamp boundaries, retains clip and works in both views');
    } finally { await browser.close(); }
};
