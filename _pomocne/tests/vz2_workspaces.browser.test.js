'use strict';
// Actual application assets with isolated API fixtures; no live site or database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const php = fs.readFileSync(path.join(root, 'index.php'), 'utf8');
const config = { csrf: 'test', write: true, admin: true, canCreate: true, canUpload: true, canReorder: true, cachePrefix: 'workspaces-test:' };
const html = php.slice(php.indexOf('<!doctype html>'))
    .replace("<?php readfile(__DIR__ . '/css/themes.css'); ?>", fs.readFileSync(path.join(root, 'css/themes.css'), 'utf8'))
    .replace(/<\?=json_encode\(\$config,[\s\S]*?\?>/, JSON.stringify(config)).replace(/<\?[\s\S]*?\?>/g, '');
const wav = Buffer.alloc(44 + 8000 * 180 * 2);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
const hash = createHash('sha256').update(wav).digest('hex');
const collections = ['Nová skladba', 'Poslední vlak', 'Zkouška 8. října', 'Zkouška 1. října'].map((title, index) => ({ id: index + 1, title, kind: index < 2 ? 'song' : 'rehearsal', lifecycle: 'active', author: 'Petr', recordings_revision: 1 }));
const file = id => ({ id, url: '/sample.wav', state: 'available', original_name: 'zkouška.wav', title: 'zkouška', sha256: hash, byte_size: wav.length, duration_ms: 180000, mime: 'audio/wav' });
const recordings = [
    { id: 11, collection_id: 3, kind: 'single', lifecycle: 'active', audio_state: 'available', title: 'Celá zkouška', revision: 1, author: 'Petr', duration_ms: 180000, files: [file(1)], can_edit: true, can_move: true },
    { id: 12, collection_id: 3, kind: 'multitrack', lifecycle: 'active', audio_state: 'available', title: 'Společný mix', revision: 1, author: 'Klára', duration_ms: 180000, files: [file(2)] },
    { id: 13, collection_id: 1, kind: 'single', lifecycle: 'active', audio_state: 'available', title: 'Domácí nahrávka', revision: 1, author: 'Petr', duration_ms: 180000, files: [file(3)], can_move: true },
    { id: 14, collection_id: 3, kind: 'single', lifecycle: 'active', audio_state: 'available', title: '', revision: 1, author: 'Petr', duration_ms: 180000, files: [{ ...file(4), original_name: 'bez-popisku.wav', title: 'bez-popisku' }], can_edit: true }
];
const links = [{ id: 3, song_collection_id: 1, rehearsal_collection_id: 3, source_recording_id: 11, clip_recording_id: null, start_ms: 15000, start_body: 'Další pokus', end_ms: 20000 },
    { id: 1, song_collection_id: 1, rehearsal_collection_id: 3, source_recording_id: 11, clip_recording_id: null, start_ms: 5000, start_body: 'Začátek skladby', end_ms: 10000 },
    { id: 2, song_collection_id: 1, rehearsal_collection_id: 3, source_recording_id: null, clip_recording_id: 13, start_ms: null, end_ms: null }];
const catalog = { ok: true, collections, recordings, recording_links: links, attachments: [], operations: [], orders: [{ kind: "song", revision: 1 }, { kind: "rehearsal", revision: 1 }] };
const matrix = { ok: true, songs: collections.slice(0, 2), rehearsals: collections.slice(2), can_edit: true, plays: [
    { id: 3, song_collection_id: 1, rehearsal_collection_id: 3, song_title: 'Nová skladba', rehearsal_title: 'Zkouška 8. října', source_recording_id: 11, source: recordings[0], start_ms: 15000, end_ms: 20000, start_body: 'Další pokus', notes: [] },
    { id: 1, song_collection_id: 1, rehearsal_collection_id: 3, song_title: 'Nová skladba', rehearsal_title: 'Zkouška 8. října', source_recording_id: 11, source: recordings[0], start_ms: 5000, end_ms: 10000, start_body: 'Začátek skladby', notes: [{ time_ms: 6000, body: 'Poznámka' }], can_edit: true },
    { id: 2, song_collection_id: 1, rehearsal_collection_id: 3, clip_recording_id: 13, clip: recordings[2] },
    { id: 4, song_collection_id: 2, rehearsal_collection_id: 3, song_title: 'Poslední vlak', rehearsal_title: 'Zkouška 8. října', source_recording_id: 11, source: recordings[0], clip: recordings[2], clip_recording_id: 13, start_ms: 20000, end_ms: 30000, start_body: 'Připojený výstřižek', notes: [] },
    { id: 5, song_collection_id: 1, rehearsal_collection_id: 4, song_title: 'Nová skladba', rehearsal_title: 'Zkouška 1. října', source_recording_id: 44, source: { ...recordings[0], id: 44, audio_state: 'deleted', files: [{ ...file(44), url: null }] }, start_ms: 40000, end_ms: 50000, start_body: 'Smazaná nahrávka', notes: [] }
], unassigned_intervals: [], unassigned_clips: [] };
const timestampRows = [
    { id: 101, time_ms: 1000, kind: 'song_start', body: 'Začátek výstřižku' },
    { id: 102, time_ms: 2000, kind: 'song_end', paired_timestamp_id: 101, body: 'Konec výstřižku' }
].map(row => ({ author: 'Petr', editor: 'Petr', created_by: 1, updated_by: 1, revision: 1,
    created_at: '2026-10-16 10:00:00', updated_at: '2026-10-16 10:00:00', can_edit: false, can_delete: false, ...row }));
function gate() { let release; const promise = new Promise(resolve => release = resolve); return { promise, release }; }
(async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath() });
    const errors = [], confirmations = [], deletionDialogs = [], recordingDeletions = [];
    const carNotes = [];
    let carTimestampRevision = 1;
    let peakRequests = 0;
    let holdMixer = null, mixerRequested = null;
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', async dialog => {
        confirmations.push(dialog.message());
        if (dialog.message().includes('odstranit položku') || dialog.message().includes('Odstranit soubory') || dialog.message().includes('Úplně smazat nahrávku')) deletionDialogs.push(dialog.type());
        const filename = ['old.jpg', 'active.jpg'].find(name => dialog.message().includes(name));
        await dialog.accept(filename);
    });
    const savedMaps = new Map(), savedOverviews = new Map();
    await context.route('https://cdn.jsdelivr.net/**', r => r.abort());
    await context.route('http://vz2-workspaces.test/**', async route => {
        const url = new URL(route.request().url()), json = value => route.fulfill({ json: value });
        if (url.pathname === '/index.php') return route.fulfill({ contentType: 'text/html', body: html });
        if (/^\/(css|js|meat)\//.test(url.pathname)) {
            const target = path.join(root, url.pathname);
            return route.fulfill({ contentType: url.pathname.endsWith('.css') ? 'text/css' : url.pathname.endsWith('.js') ? 'text/javascript' : 'image/png', body: fs.readFileSync(target) });
        }
        if (url.pathname === '/sample.wav') {
            const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range || '');
            if (range) {
                const start = Number(range[1]), end = range[2] ? Math.min(Number(range[2]), wav.length - 1) : wav.length - 1;
                return route.fulfill({ status: 206, contentType: 'audio/wav', headers: { 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${wav.length}` }, body: wav.subarray(start, end + 1) });
            }
            return route.fulfill({ contentType: 'audio/wav', headers: { 'accept-ranges': 'bytes' }, body: wav });
        }
        if (url.pathname === '/php/ajax/vz2.php') {
            if (route.request().method() === 'POST') {
                const input = route.request().postDataJSON();
                if (input.action === 'recording_update') {
                    const recording = recordings.find(row => row.id === input.id);
                    recording.title = input.title;
                    recording.revision++;
                }
                if (input.action === 'track_update') {
                    const recording = recordings.find(row => row.id === input.id);
                    recording.files.find(entry => entry.id === input.file_id).title = input.title;
                    recording.revision++;
                }
                if (input.action === 'remove_attachment') {
                    assert.equal(input.confirm, catalog.attachments.find(entry => entry.id === input.id)?.original_name);
                    catalog.attachments.splice(catalog.attachments.findIndex(entry => entry.id === input.id), 1);
                }
                if (input.action === 'remove_audio' || input.action === 'delete_recording') {
                    const recording = recordings.find(entry => entry.id === input.id);
                    assert.equal(input.confirm, recording.title || recording.files[0].original_name);
                    recordingDeletions.push(input.action);
                    if (input.action === 'remove_audio') {
                        recording.audio_state = 'deleted';
                        recording.files[0].state = 'deleted';
                        recording.files[0].url = null;
                        recording.revision++;
                    } else recordings.splice(recordings.indexOf(recording), 1);
                }
                return json({ ok: true });
            }
            if (url.searchParams.get('action') !== 'mixer') return json(catalog);
            if (!url.searchParams.has('id')) {
                mixerRequested?.release(); if (holdMixer) await holdMixer.promise;
                return json({ ok: true, multitracks: [{ id: 12, name: 'Společný mix' }] });
            }
            return json({ ok: true, multitrack: { version: 1, id: 12, name: 'Společný mix', created: '2026-10-08', tracks: [{ file: 'sample.wav', originalName: 'zkouška.wav', fileId: 2, sha256: hash, name: 'Kapela', order: 1, url: '/sample.wav' }] } });
        }
        if (url.pathname === '/php/ajax/vz2_content.php') {
            const query = route.request().method() === 'POST' ? route.request().postDataJSON() : Object.fromEntries(url.searchParams);
            if (query.action === 'draft_from_starts') return json({ ok: true, text: 'Nahrávka 1 — zkouška.wav\n  00:05  Písnička\n' });
            if (query.kind === 'rehearsal_starts') {
                const key = String(query.collection_id);
                if (query.action === 'document_save') {
                    const previous = savedOverviews.get(key);
                    savedOverviews.set(key, { body: query.body, revision: (previous?.revision || 0) + 1 });
                }
                const saved = savedOverviews.get(key);
                return json({ ok: true, can_edit: true,
                    document: saved ? { id: 8, title: 'Začátky skladeb', current_revision: saved.revision, author: 'Petr', editor: 'Petr', updated_at: '2026-10-17T10:00:00Z' } : null,
                    version: saved ? { body: saved.body } : null });
            }
            if (query.kind === 'song_map') {
                if (query.action === 'document_save') savedMaps.set(String(query.collection_id), query.body);
                const body = savedMaps.get(String(query.collection_id));
                return json({ ok: true, can_edit: true, document: body ? { id: 7, current_revision: 1 } : null, version: body ? { body } : null });
            }
            if (query.action === 'document') return json({ ok: true, can_edit: true, document: { title: 'Text a akordy', current_revision: 1 }, version: { body: ('Ukázkový text a akordy\n').repeat(70) } });
            return json({ ok: true, can_create: true, thread: { id: 9, global_key: query.scope === 'ideas' ? 'ideas' : null, title: 'Diskuse' }, posts: [], next_before: null });
        }
        if (url.pathname === '/php/ajax/vz2_history.php') return json(matrix);
        if (url.pathname === '/php/ajax/vz2_timestamps.php') {
            const input = route.request().method() === 'POST' ? route.request().postDataJSON() : null;
            const recordingId = Number(input?.recording_id || url.searchParams.get('recording_id'));
            if (input?.action === 'create') {
                assert.equal(input.timestamps_revision, carTimestampRevision);
                assert.equal(input.kind, 'note');
                carNotes.push({ id: 200 + carNotes.length, recording_id: recordingId, kind: 'note', time_ms: input.time_ms, body: input.body,
                    author: 'Petr', editor: 'Petr', created_by: 1, updated_by: 1, revision: 1, can_edit: false, can_delete: false,
                    created_at: '2026-10-23 10:00:00', updated_at: '2026-10-23 10:00:00' });
                carTimestampRevision++;
            }
            return json({ ok: true, recording_id: recordingId, entries: [11, 12].includes(recordingId) ? [...timestampRows, ...carNotes.filter(row => row.recording_id === recordingId)] : [], duration_ms: 180000, timestamps_revision: carTimestampRevision, can_create: true, source_filename: 'zkouška.wav' });
        }
        if (url.pathname === '/php/ajax/vz2_peaks.php') { peakRequests++; return json({ ok: true, peaks: [0.1, 0.6, 0.2, 0.8, 0.1], duration_ms: 180000 }); }
        return route.fulfill({ status: 204, body: '' });
    });
    const nav = name => page.locator(`[data-workspace-target="${name}"]:visible`);
    async function switchTo(name) { await nav(name).click(); await page.waitForFunction(workspace => document.body.dataset.workspace === workspace, name); }
    async function ready() { await page.waitForFunction(() => !document.documentElement.classList.contains('vz2-booting')); }
    async function shot(name) { if (process.env.WORKSPACE_SCREENSHOT_DIR) await page.screenshot({ path: path.join(process.env.WORKSPACE_SCREENSHOT_DIR, name + '.png') }); }
    try {
        await page.goto('http://vz2-workspaces.test/index.php?v=2'); await ready();
        assert.equal(await page.locator('#content-area > .panel:visible').count(), 3);
        assert.equal(await page.locator('#player-title').textContent(), '');
        for (const width of [320, 390, 767, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            const emptyPlayer = await page.evaluate(() => {
                const shell = document.querySelector('#player-shell').getBoundingClientRect();
                const label = document.querySelector('#player-mode').getBoundingClientRect();
                const controls = document.querySelector('.looper-header-controls').getBoundingClientRect();
                return { height: shell.height, sameRow: Math.abs(label.y + label.height / 2 - controls.y - controls.height / 2) < 3,
                    inside: controls.right <= shell.right - 1, overflow: document.documentElement.scrollWidth > innerWidth + 1 };
            });
            assert(emptyPlayer.sameRow && emptyPlayer.inside && !emptyPlayer.overflow && emptyPlayer.height < 70, `Empty player fits in one row at ${width}: ${JSON.stringify(emptyPlayer)}`);
        }
        await page.setViewportSize({ width: 320, height: 900 });
        assert(await page.locator('#player-shell .player-emblem').isVisible(), 'The empty player shows its logo');
        await page.locator('#player-mode').click();
        assert(await page.locator('#player-help-dialog').isVisible(), 'Clicking the empty player title opens help');
        await page.locator('#player-help-close').click();
        await page.locator('#player-shell .player-emblem').click();
        assert(await page.locator('#player-help-dialog').isVisible(), 'Clicking the player logo opens help');
        await page.locator('#player-help-close').click();
        await page.locator('#player-shell').click({ position: { x: 2, y: 2 } });
        assert(await page.locator('#player-help-dialog').isVisible(), 'Clicking empty player background opens help');
        await page.locator('#player-help-close').click();
        await page.locator('#looper-play').focus();
        await page.keyboard.press('Enter');
        assert(await page.locator('#player-help-dialog').isVisible(), 'Empty player controls still open help by keyboard');
        await page.locator('#player-help-close').click();
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.waitForFunction(() => document.querySelectorAll('#content-area > .panel:not([hidden])').length === 3);
        const playerBounds = await page.locator('#player-shell').boundingBox(), sidebarBounds = await page.locator('#sidebar').boundingBox();
        assert(sidebarBounds.y >= playerBounds.y + playerBounds.height, 'The catalog starts below the global player');
        await page.locator('#tablature-content').getByRole('button', { name: 'Vytvořit mapu', exact: true }).click();
        await page.locator('.song-map-add-bar').click();
        await switchTo('rehearsals');
        assert.equal(await page.locator('#panel-tablature').isVisible(), true);
        assert.equal(await page.locator('#panel-tablature h2').textContent(), 'Začátky skladeb');
        assert.equal(await page.locator('#panel-lyrics h2').textContent(), 'Zápis ze zkoušky');
        await page.locator('#rehearsal-starts-content').getByText('Zatím bez dokumentu.', { exact: true }).waitFor();
        await page.locator('#rehearsal-starts-actions button').click();
        const overviewEditor = page.locator('.vz2-content-dialog');
        await overviewEditor.getByRole('button', { name: 'Předvyplnit ze začátků skladeb', exact: true }).click();
        await overviewEditor.getByText('Návrh je v editoru. Upravte ho a uložte jako novou verzi.', { exact: true }).waitFor();
        assert.equal(savedOverviews.size, 0, 'Prefill does not save a version');
        assert.equal(await overviewEditor.locator('[name=document_body]').inputValue(), 'Nahrávka 1 — zkouška.wav\n  00:05  Písnička\n');
        await overviewEditor.locator('[name=document_body]').fill('Ručně upravený přehled');
        await overviewEditor.getByRole('button', { name: 'Uložit novou verzi', exact: true }).click();
        await overviewEditor.getByText('Nová verze uložena.', { exact: true }).waitFor();
        assert.equal(savedOverviews.get('3').body, 'Ručně upravený přehled');
        await overviewEditor.getByRole('button', { name: 'Zavřít', exact: true }).click();
        await page.locator('#rehearsal-starts-content .document-preview').getByText('Ručně upravený přehled', { exact: true }).waitFor();
        await page.locator('#collections .collection > button').filter({ hasText: 'Zkouška 1. října' }).click();
        await switchTo('songs');
        assert.equal(await page.locator('.song-map-bar').count(), 1, 'A rehearsal switch keeps the unfinished song map');
        assert.equal(await page.locator('.song-map-save-state').textContent(), 'Neuloženo');
        await page.locator('#collections .collection > button').filter({ hasText: 'Poslední vlak' }).click();
        await page.getByRole('dialog', { name: 'Neuložené změny', exact: true }).getByRole('button', { name: 'Zůstat', exact: true }).click();
        assert.equal(await page.locator('#collection-title-name').textContent(), 'Nová skladba');
        await page.locator('#tablature-actions').getByRole('button', { name: 'Uložit', exact: true }).click();
        await page.getByText('Mapa uložena · verze 1', { exact: true }).waitFor();
        console.log('PASS: existing map editor and save; rehearsal has its own panels; draft survives workspace changes, collection guard remains');

        for (const width of [320, 390, 767, 768, 1024, 1199, 1200, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            for (const workspace of ['songs', 'rehearsals', 'history', 'ideas']) {
                await switchTo(workspace);
                if (workspace === 'history') await page.locator('.history-table').waitFor();
                const geometry = await page.evaluate(() => {
                    const rect = selector => document.querySelector(selector).getBoundingClientRect();
                    return { overflow: document.documentElement.scrollWidth > innerWidth + 1,
                        height: document.documentElement.scrollHeight > innerHeight + 1,
                        dockHeight: rect('#mobile-dock').height,
                        topMenuBelowPlayer: rect('#mobile-dock').top >= rect('#player-shell').bottom - 1,
                        topMenuAboveContent: rect('#mobile-dock').bottom <= rect('.layout').top + 1,
                        bottomMenuBelowContent: rect('#mobile-sections-dock').top >= rect('.layout').bottom - 1,
                        menusInsideFrame: rect('#mobile-dock').top >= rect('#workspace-frame').top - 1 &&
                            rect('#mobile-sections-dock').bottom <= rect('#workspace-frame').bottom + 1,
                        frameBorder: getComputedStyle(document.querySelector('#workspace-frame')).borderTopColor,
                        menuBorder: getComputedStyle(document.querySelector('#mobile-dock')).borderBottomColor };
                });
                assert(!geometry.overflow && !geometry.height, `${workspace}: viewport overflow at ${width}`);
                if (width < 768) {
                    assert(geometry.topMenuBelowPlayer && geometry.topMenuAboveContent, `${workspace}: main navigation belongs below the player at ${width} px`);
                    if (workspace === 'songs' || workspace === 'rehearsals') {
                        assert(await page.locator('#mobile-panels').isVisible());
                        assert(geometry.bottomMenuBelowContent && geometry.menusInsideFrame && geometry.frameBorder === geometry.menuBorder,
                            `${workspace}: the navigation frame contains both fixed menus and the content at ${width} px`);
                        const labelsFit = await page.locator('#mobile-panels button:visible .section-button-label').evaluateAll(labels => labels.every(label => label.getBoundingClientRect().width > 0 && label.scrollWidth <= label.clientWidth + 1));
                        assert(labelsFit, `${workspace}: section tab labels fit at ${width} px`);
                    }
                    else {
                        const header = workspace === 'history' ? '#history-workspace .workspace-header' : '#ideas-workspace .workspace-header';
                        const controls = workspace === 'history' ? '#history-controls' : '#ideas-controls';
                        const headerBox = await page.locator(header).boundingBox(), controlsBox = await page.locator(controls).boundingBox();
                        assert(controlsBox.y >= headerBox.y && controlsBox.y + controlsBox.height <= headerBox.y + headerBox.height + 1, `${workspace}: controls fit in one header row`);
                    }
                    assert(geometry.dockHeight < 80, `${workspace}: main navigation fits below the player`);
                }
                if (width === 390 || width === 1440) await shot(`${workspace}-${width}`);
            }
        }
        console.log('PASS: all four workspaces at 320–1440 px, no document overflow, main navigation below the player and section navigation below the content');

        await page.setViewportSize({ width: 390, height: 844 });
        await switchTo('history');
        await page.locator('td[data-song-id="1"][data-rehearsal-id="3"] .history-count').click();
        assert.equal(await page.locator('#history-list .history-source-group').count(), 1, 'excerpts from one recording share one group');
        assert.equal(await page.locator('#history-list .history-source-group .history-source-title').textContent(), 'Zdroj: zkouška.wav');
        assert.deepEqual(await page.locator('#history-list .history-source-clips .history-list-text strong').allTextContents(), ['Začátek skladby', 'Další pokus'], 'excerpts are ordered by start time and use start timestamp titles');
        assert.equal(await page.locator('#history-list .history-source-clips').getByText('zkouška.wav').count(), 0, 'source filename is shown once in the group heading');
        assert.equal(await page.locator('#history-list .history-list-row').count(), 3, 'standalone clip remains its own row');
        assert.deepEqual(await page.locator('#history-list .history-list-row .history-origin-badge').allTextContents(), ['Úsek bez výstřižku', 'Úsek bez výstřižku', 'Samostatný soubor']);
        assert(await page.locator('#history-list').evaluate(list => list.scrollWidth <= list.clientWidth + 1), 'origin badges fit in the list on mobile');
        await shot('matrix-list-390');
        await page.locator('#history-list .history-list-row').first().click();
        assert.equal(await page.locator('#history-detail .history-detail-context').textContent(), 'zkouška: Zkouška 8. října × skladba: Nová skladba');
        assert.equal(await page.locator('#history-detail-title').textContent(), 'Začátek skladby');
        assert.equal(await page.locator('#history-detail .history-detail-card').count(), 2, 'source and clip use separate cards');
        const sourceCard = page.locator('#history-detail .history-detail-card').first();
        assert.equal(await sourceCard.locator('summary').textContent(), 'Původní nahrávka ze zkoušky');
        assert.equal(await sourceCard.getAttribute('open'), '', 'source card is expanded by default');
        const jump = sourceCard.getByRole('button', { name: 'Přejít na začátek úseku 00:05' });
        assert.equal(await jump.textContent(), 'Úsek 00:05–00:10');
        const lineBounds = await sourceCard.evaluate(card => ({ name: card.querySelector('.history-card-filename').getBoundingClientRect().toJSON(), jump: card.querySelector('.history-range-jump').getBoundingClientRect().toJSON() }));
        assert(Math.abs((lineBounds.name.top + lineBounds.name.bottom) / 2 - (lineBounds.jump.top + lineBounds.jump.bottom) / 2) < 8, `source filename and jump link share one row on mobile: ${JSON.stringify(lineBounds)}`);
        await sourceCard.locator('audio').evaluate(audio => { audio.load(); });
        await page.waitForFunction(() => document.querySelector('#history-detail audio').readyState >= 1);
        await sourceCard.locator('audio').evaluate(audio => { audio.currentTime = 17; });
        await jump.click();
        await page.waitForFunction(() => Math.abs(document.querySelector('#history-detail audio').currentTime - 5) < .1);
        assert.equal(await page.locator('#history-detail .history-add-clip').isVisible(), true);
        assert.equal(await page.locator('#history-detail').getByText('Úpravy').count(), 0);
        assert.equal(await page.locator('#history-detail .history-detail-body > .danger').isVisible(), true);
        await page.locator('#history-detail .history-add-clip').click();
        assert.equal(await page.locator('#history-detail .history-add-clip').isVisible(), false);
        assert.equal(await page.locator('#history-detail .history-detail-card').last().isVisible(), true);
        assert.equal(await page.locator('#history-detail').getByLabel('Připojený výstřižek').count(), 1);
        assert.equal(await page.locator('#history-detail').getByRole('button', { name: 'Připojit výstřižek' }).isDisabled(), true);
        assert.equal(await page.locator('#history-detail .vz2-audio-trigger, #history-detail .vz2-audio-collapse').count(), 0, 'Matrix detail has no separate play or collapse button');
        assert.equal(await page.locator('#history-detail .vz2-audio-transport:visible').count(), 1, 'Matrix detail shows its player immediately');
        await page.locator('#history-detail .vz2-audio-play-pause').click();
        await page.waitForFunction(() => !document.querySelector('#history-detail audio').paused);
        await shot('matrix-player-390');
        await page.setViewportSize({ width: 320, height: 844 });
        const matrixPlayerFits = await page.locator('#history-detail .vz2-audio-transport').evaluate(element => element.scrollWidth <= element.clientWidth);
        assert(matrixPlayerFits, 'Matrix player fits without horizontal scrolling at 320 px');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('#history-detail [data-history-close]').click();
        await page.locator('#history-list [data-history-close]').click();
        await page.locator('td[data-song-id="2"][data-rehearsal-id="3"] .history-count').click();
        assert.equal(await page.locator('#history-list .history-list-row .history-origin-badge').textContent(), 'Úsek + výstřižek');
        await page.locator('#history-list .history-list-row').click();
        assert.equal(await page.locator('#history-detail .history-detail-card').count(), 2, 'attached clip has its own card');
        assert.equal(await page.locator('#history-detail .vz2-audio-transport:visible').count(), 1, 'closed clip card does not show a second player');
        await page.locator('#history-detail .history-detail-card').last().locator('summary').click();
        assert.equal(await page.locator('#history-detail .vz2-audio-transport:visible').count(), 2, 'opening the clip reveals its player');
        await page.locator('#history-detail [data-history-close]').click();
        await page.locator('#history-list [data-history-close]').click();
        await page.locator('td[data-song-id="1"][data-rehearsal-id="4"] .history-count').click();
        await page.locator('#history-list .history-list-row').click();
        assert.equal(await page.locator('#history-detail .history-detail-card').first().locator('summary').textContent(), 'Původní nahrávka ze zkoušky (smazána)');
        assert.equal(await page.locator('#history-detail audio').count(), 0, 'deleted recording has no player');
        await page.locator('#history-detail [data-history-close]').click();
        await page.locator('#history-list [data-history-close]').click();
        console.log('PASS: matrix detail shows the shared playback row without an extra play button');

        for (const width of [320, 390]) {
            await page.setViewportSize({ width, height: 900 });
            await switchTo('rehearsals');
            assert.equal(await page.locator('#collection-kind-inline').textContent(), 'Zkouška:');
            const titleLayout = await page.evaluate(() => {
                const name = document.querySelector('#collection-title-name');
                const picker = document.querySelector('#catalog-picker');
                const chevron = picker.querySelector('.catalog-chevron');
                const original = name.textContent;
                name.textContent = 'S120 — zkouška s delším názvem složky';
                const nameBox = name.getBoundingClientRect();
                const pickerBox = picker.getBoundingClientRect();
                const chevronBox = chevron.getBoundingClientRect();
                const layout = { clipped: name.scrollWidth > name.clientWidth + 1,
                    chevronVisible: chevronBox.right <= pickerBox.right + 1 && chevronBox.left >= nameBox.right - 1 && chevronBox.left - nameBox.right <= 12 };
                name.textContent = original;
                return layout;
            });
            assert(titleLayout.clipped && titleLayout.chevronVisible, `Long collection names should shorten while the picker arrow stays visible at ${width}`);
            const shortTitle = await page.evaluate(() => {
                const name = document.querySelector('#collection-title-name');
                const picker = document.querySelector('#catalog-picker');
                const original = name.textContent;
                name.textContent = 'Tváře';
                const nameBox = name.getBoundingClientRect();
                const pickerBox = document.querySelector('#catalog-picker').getBoundingClientRect();
                const panel = document.querySelector('#content-area > .panel:not([hidden])');
                const result = { oneLine: nameBox.height < 40, compact: pickerBox.width < innerWidth * .75,
                    inHeader: picker.closest('.panel-header') === panel.querySelector('.panel-header'),
                    button: getComputedStyle(document.querySelector('#catalog-picker')).borderTopWidth !== '0px' };
                name.textContent = original;
                return result;
            });
            assert(shortTitle.oneLine && shortTitle.compact && shortTitle.inHeader && shortTitle.button,
                `Collection picker should fit in the active panel header at ${width}`);
            await switchTo('songs');
            assert.equal(await page.locator('#collection-kind-inline').textContent(), 'Skladba:');
        }
        console.log('PASS: long collection names remain readable with the picker arrow on mobile');

        await page.setViewportSize({ width: 320, height: 900 });
        await switchTo('songs');
        await page.locator('#catalog-picker').click();
        const compactCatalog = await page.locator('#catalog-dialog').boundingBox();
        const compactHeading = await page.locator('#catalog-heading-mobile').boundingBox();
        const compactCreate = await page.locator('#create-collection-open').boundingBox();
        const compactClose = await page.locator('#catalog-close').boundingBox();
        assert.equal(await page.locator('#catalog-heading-mobile').textContent(), 'Skladby');
        assert(compactCatalog.width < 320 - 16 && compactHeading.x >= compactCatalog.x + 9
            && compactClose.x + compactClose.width <= compactCatalog.x + compactCatalog.width - 9,
            'Catalog header has padding and fits at 320 px');
        assert(Math.abs(compactHeading.y + compactHeading.height / 2 - compactCreate.y - compactCreate.height / 2) < 2, 'Song title and creation button share one row at 320 px');
        await page.locator('#catalog-close').click();

        await page.setViewportSize({ width: 320, height: 900 });
        await switchTo('songs');
        for (const panel of ['lyrics', 'tablature', 'discussion']) {
            await page.locator(`[data-mobile-panel=${panel}]`).click();
            assert(await page.locator(`#panel-${panel}`).isVisible());
            const fit = await page.evaluate(() => {
                const header = document.querySelector('#content-area > .panel:not([hidden]) > .panel-header');
                const tabs = document.querySelector('#mobile-panels').getBoundingClientRect();
                const picker = document.querySelector('#catalog-picker').getBoundingClientRect();
                const actions = header.querySelector('.panel-header-actions').getBoundingClientRect();
                const fullscreen = header.querySelector('.panel-fullscreen-button').getBoundingClientRect();
                return { overflow: document.documentElement.scrollWidth > innerWidth + 1,
                    tabWidth: document.querySelector('#mobile-panels button').getBoundingClientRect().width,
                    headerHeight: header.getBoundingClientRect().height,
                    tabsBelow: tabs.top >= header.getBoundingClientRect().bottom - 2,
                    oneRow: Math.abs((picker.top + picker.bottom) / 2 - (actions.top + actions.bottom) / 2) < 6 &&
                        Math.abs((picker.top + picker.bottom) / 2 - (fullscreen.top + fullscreen.bottom) / 2) < 6 };
            });
            assert(!fit.overflow && fit.tabWidth >= 60 && fit.tabsBelow && fit.headerHeight < 65 && fit.oneRow, `${panel}: bottom section tabs and picker should fit at 320 px: ${JSON.stringify(fit)}`);
            if (panel === 'tablature') await shot('songs-map-320');
        }
        await page.locator('[data-mobile-panel=recordings]').click();
        await page.setViewportSize({ width: 390, height: 844 });
        await switchTo('songs');
        assert.equal(await page.locator('#mobile-panels button:visible').count(), 4);
        assert.deepEqual(await page.locator('#mobile-panels .section-button-label').allTextContents(), ['Nahrávky', 'Text', 'Mapa', 'Diskuse']);
        await page.locator('[data-mobile-panel=tablature]').click();
        assert(await page.locator('#panel-tablature').isVisible());
        assert.equal(await page.locator('#mobile-panels').evaluate(node => node.parentElement.id), 'mobile-sections-dock');
        assert.equal(await page.locator('#catalog-picker').evaluate(node => node.closest('.panel').id), 'panel-tablature');
        assert.equal(await page.locator('#mobile-panels [data-mobile-panel=tablature]').getAttribute('aria-pressed'), 'true');
        await page.locator('[data-mobile-panel=recordings]').click();
        console.log('PASS: labeled mobile section tabs switch panels while the collection picker follows the active panel');

        await page.setViewportSize({ width: 390, height: 500 });
        await page.locator('[data-mobile-panel=lyrics]').click();
        await page.waitForFunction(() => {
            const body = document.querySelector('#lyrics-content');
            return body.scrollHeight > body.clientHeight + 100;
        });
        const sectionsBeforeScroll = await page.locator('#mobile-sections-dock').boundingBox();
        const lyricsScroll = await page.locator('#lyrics-content').evaluate(body => { body.scrollTop = 180; return body.scrollTop; });
        const sectionsAfterScroll = await page.locator('#mobile-sections-dock').boundingBox();
        assert(lyricsScroll > 0 && sectionsAfterScroll.y === sectionsBeforeScroll.y, 'The bottom sections stay fixed while the active content scrolls');
        await page.locator('[data-mobile-panel=recordings]').click();

        await page.setViewportSize({ width: 1200, height: 900 });
        assert.equal(await page.locator('#catalog-search').count(), 0);
        for (const [workspace, control, slot] of [
            ['songs', '#desktop-panels', 'sidebar'],
            ['rehearsals', '#desktop-panels', 'sidebar'],
            ['history', '#history-controls', 'history-controls-slot'],
            ['ideas', '#ideas-controls', 'ideas-controls-slot']
        ]) {
            await switchTo(workspace);
            assert.equal(await page.locator(control).evaluate(node => node.parentElement.id), slot);
            assert(await page.locator(control).isVisible(), `${workspace} controls should be visible`);
            assert.equal(await page.locator('#collection-header').isVisible(), false);
            const topbar = await page.evaluate(() => {
                const navigation = document.querySelector('#workspace-navigation');
                const menu = document.querySelector('#topbar .shell-menu');
                return { fits: navigation.scrollWidth <= navigation.clientWidth + 1,
                    separate: navigation.getBoundingClientRect().right <= menu.getBoundingClientRect().left + 1 };
            });
            assert(topbar.fits && topbar.separate, `${workspace} submenu overlaps the desktop topbar at 1200 px`);
            if (workspace === 'songs' || workspace === 'rehearsals') {
                const sidebar = await page.evaluate(() => {
                    const top = selector => document.querySelector(selector).getBoundingClientRect().top;
                    return { ordered: top('#desktop-panels') < top('#catalog-heading') && top('#catalog-heading') < top('.catalog-header') && top('.catalog-header') < top('#collections'),
                        buttonWidth: document.querySelector('#desktop-panels button').getBoundingClientRect().width,
                        sameIcon: document.querySelector('#desktop-panels [data-desktop-panel=recordings] use').getAttribute('href') === document.querySelector('#panel-recordings .panel-header use').getAttribute('href') };
                });
                assert(sidebar.ordered && sidebar.buttonWidth >= 40 && sidebar.sameIcon, `${workspace} sidebar section controls should stay above the scrolling list`);
            }
        }
        await switchTo('songs');
        await page.locator('#desktop-panels [data-desktop-panel=discussion]').click();
        assert(await page.locator('#panel-discussion').isVisible());
        await page.locator('#desktop-panels [data-desktop-panel=discussion]').click();
        console.log('PASS: icon controls stay above the desktop catalog and toggle panels; matrix and ideas controls stay in their headers');

        await page.setViewportSize({ width: 390, height: 844 });
        await switchTo('ideas');
        await page.locator('#ideas-write textarea').fill('Rozepsaný nápad');
        await page.locator('[data-idea-section=draw]').click();
        assert(await page.locator('#ideas-draw').isVisible());
        await switchTo('songs'); await switchTo('ideas');
        assert(await page.locator('#ideas-draw').isVisible());
        await page.locator('[data-idea-section=write]').click();
        assert.equal(await page.locator('#ideas-write textarea').inputValue(), 'Rozepsaný nápad');
        await page.setViewportSize({ width: 390, height: 320 });
        await page.locator('#ideas-write').getByRole('button', { name: 'Odeslat', exact: true }).click();
        await page.getByText('Příspěvek uložen.', { exact: true }).waitFor();
        await page.setViewportSize({ width: 390, height: 844 });
        await switchTo('history');
        await page.locator('#history-orientation').click(); await page.locator('#history-audio-filter').check();
        await page.locator('#history-filter summary').click();
        const popup = await page.locator('.history-filter-menu').boundingBox(), header = await page.locator('#history-workspace .workspace-header').boundingBox(), mainNavigation = await page.locator('#bottom-nav').boundingBox();
        assert(header.y >= mainNavigation.y + mainNavigation.height - 1 && popup.y >= header.y + header.height - 1 && popup.y + popup.height < 844,
            `Filter opens below the header within the viewport: ${JSON.stringify({popup, header, mainNavigation})}`);
        assert(popup.x >= 0 && popup.x + popup.width <= 390, 'Filter fits inside the mobile viewport');
        await page.locator('#history-song-filter').selectOption('1');
        await page.locator('#history-options summary').click();
        const optionsMenu = await page.locator('#history-menu').boundingBox();
        assert(optionsMenu.x >= 0 && optionsMenu.x + optionsMenu.width <= 390, 'Matrix options fit inside the mobile viewport');
        await page.locator('#history-options summary').click();
        await switchTo('songs'); await switchTo('history');
        assert.equal(await page.locator('#history-orientation').getAttribute('aria-pressed'), 'true');
        assert(await page.locator('#history-audio-filter').isChecked());
        assert.equal(await page.locator('#history-song-filter').inputValue(), '1');
        await page.locator('#history-workspace .panel-fullscreen-button').click();
        await page.locator('#history-controls-slot #history-orientation').waitFor({ state: 'visible' });
        await page.keyboard.press('Escape');
        assert(await page.locator('#history-controls-slot #history-orientation').isVisible());
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.locator('#history-controls-slot #history-orientation').waitFor({ state: 'visible' });
        assert(await page.locator('#history-audio-filter').isChecked());
        await page.locator('#history-filter summary').click();
        assert(await page.locator('#history-song-filter').isVisible(), 'Desktop song filter opens inside its details menu');
        await page.locator('#history-filter summary').click();
        console.log('PASS: ideas draft and selected section persist; matrix filters persist and use the same controls on mobile, desktop and fullscreen');

        await page.setViewportSize({ width: 390, height: 844 });
        await switchTo('rehearsals');
        assert.equal(await page.locator('#collection-title-name').textContent(), 'Zkouška 1. října');
        await page.locator('#catalog-picker').click();
        assert.equal(await page.locator('#catalog-picker').getAttribute('aria-expanded'), 'true');
        const title = await page.locator('#catalog-picker').boundingBox(), dropdown = await page.locator('#catalog-dialog').boundingBox();
        assert(dropdown.y >= title.y + title.height, 'Catalog drops down from the large title');
        const heading = await page.locator('#catalog-heading-mobile').boundingBox(), create = await page.locator('#create-collection-open').boundingBox();
        assert(Math.abs(heading.y + heading.height / 2 - create.y - create.height / 2) < 2, 'Catalog title and creation button share one row');
        assert(heading.x >= dropdown.x + 9, 'Catalog heading is inset from the dialog border');
        assert(dropdown.width < 390 - 16, 'Mobile catalog uses less than the full viewport width');
        await shot('catalog-rehearsals-390');
        assert.equal(await page.locator('#collections .collection:visible').count(), 2);
        await page.locator('#collections .collection > button').filter({ hasText: 'Zkouška 8. října' }).click();
        assert.equal(await page.locator('#recording-11 .recording-title').textContent(), 'zkouška.wav');
        assert.equal(await page.locator('#mobile-panels button:visible').count(), 4);
        for (const width of [390, 320]) {
            await page.setViewportSize({ width, height: 844 });
            const tabRows = await page.locator('#mobile-panels button:visible').evaluateAll(buttons =>
                buttons.map(button => Math.round(button.getBoundingClientRect().top)));
            assert.equal(new Set(tabRows).size, 1, `All rehearsal section tabs fit on one row at ${width} px`);
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('[data-mobile-panel=recordings]').click();
        assert.equal(await page.locator('#recording-14 .recording-toggle').getAttribute('aria-expanded'), 'false');
        assert.equal(await page.locator('#recording-14 .recording-caption-text').textContent(), 'Přidat popisek');
        await page.locator('#recording-14').getByRole('button', { name: 'Přidat krátký popisek' }).click();
        assert(await page.locator('#editor').isVisible(), 'The pencil opens the editor for a recording without a caption');
        assert.equal(await page.locator('#edit-form [name=title]').inputValue(), '');
        await page.locator('#edit-form [name=title]').fill('Nový popisek');
        await page.locator('#edit-form').getByRole('button', { name: 'Uložit' }).click();
        await page.waitForFunction(() => document.querySelector('#recording-14 .recording-caption-text')?.textContent === 'Nový popisek');
        assert(await page.locator('#recording-14').getByRole('button', { name: 'Upravit krátký popisek' }).isVisible());
        assert.equal(recordings.pop().id, 14, 'The caption fixture does not change later recording-picker tests');
        assert(await page.locator('#recording-11 .recording-caption').isVisible(), 'The short caption is visible while the recording is collapsed');
        assert.equal(await page.locator('#recording-11 .recording-caption-text').textContent(), 'Celá zkouška');
        assert.equal(await page.locator('#recording-11 .recording-author').textContent(), 'Vložil Petr');
        assert.equal(await page.locator('#recording-11 .recording-body .vz2-attribution').filter({ hasText: 'Vložil Petr' }).count(), 0);
        await shot('recording-caption-390');
        await page.locator('#recording-11 .recording-caption-edit').click();
        assert(await page.locator('#editor').isVisible(), 'The caption icon opens the existing editor');
        assert.equal(await page.locator('#edit-form [name=title]').inputValue(), 'Celá zkouška');
        await page.locator('#edit-cancel').click();
        await page.locator('#recording-11 .recording-toggle').click();
        assert.equal(await page.locator('#recording-11 .recording-heading .recording-order-controls button').count(), 2, 'Ordering arrows are beside the filename');
        await page.locator('#recording-11 .recording-toggle').click();
        assert.equal(await page.locator('#recording-11 .recording-toggle').getAttribute('aria-expanded'), 'false', 'The icon row works while details are collapsed');
        assert.equal(await page.locator('#recording-11 .recording-actions > button:visible').count(), 6, 'Six main actions share one row on mobile');
        assert.equal(await page.locator('#recording-11 .recording-actions > button').first().getAttribute('class'), 'vz2-audio-trigger');
        assert.deepEqual(await page.locator('#recording-11 .recording-actions > button').evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label'))),
            ['Přehrát zkouška.wav', 'Otevřít v Looperu', 'Uložit offline', 'Otevřít časové značky', 'Poslech v autě', 'Další'],
            'The icon row keeps the agreed action order');
        assert.equal(await page.locator('#recording-11 .vz2-audio-transport:visible').count(), 0, 'The player starts collapsed');
        await page.locator('#recording-11 .vz2-audio-trigger').click();
        await page.waitForFunction(() => !document.querySelector('#recording-11 audio').paused);
        assert(await page.locator('#recording-11 .vz2-audio-transport').isVisible(), 'Play reveals the shared controls');
        assert.equal(await page.locator('#recording-11 .vz2-audio-trigger').getAttribute('aria-label'), 'Zavřít přehrávač zkouška.wav');
        assert.equal(await page.locator('#recording-11 .vz2-audio-collapse').count(), 0, 'The action-row close button replaces the second collapse button');
        const playerJoin = await page.evaluate(() => {
            const actions = document.querySelector('#recording-11 .recording-actions').getBoundingClientRect();
            const player = document.querySelector('#recording-11 .vz2-inline-player').getBoundingClientRect();
            return player.top - actions.bottom;
        });
        assert(Math.abs(playerJoin) <= 1, 'The opened player touches the action row without a gap');
        await shot('recording-player-open-390');
        await page.setViewportSize({ width: 320, height: 844 });
        const narrowPlayer = await page.evaluate(() => {
            const transport = document.querySelector('#recording-11 .vz2-audio-transport');
            const actions = [...document.querySelectorAll('#recording-11 .recording-actions > button')].filter(button => button.getClientRects().length);
            const progress = transport.querySelector('.vz2-audio-progress').getBoundingClientRect();
            const controls = transport.querySelector('.vz2-audio-controls').getBoundingClientRect();
            const slider = transport.querySelector('input[type=range]').getBoundingClientRect();
            const buttons = [...transport.querySelectorAll('.vz2-audio-controls button')].map(button => button.getBoundingClientRect());
            return { overflow: transport.scrollWidth > transport.clientWidth, height: transport.getBoundingClientRect().height,
                sliderWidth: slider.width, progressWidth: progress.width, twoRows: controls.top >= progress.bottom,
                buttonsOneRow: buttons.every(rect => Math.abs(rect.y - buttons[0].y) < 2),
                actionsOneRow: actions.every(button => Math.abs(button.getBoundingClientRect().top - actions[0].getBoundingClientRect().top) < 2) };
        });
        await shot('recording-player-open-320');
        assert(!narrowPlayer.overflow && narrowPlayer.twoRows && narrowPlayer.buttonsOneRow && narrowPlayer.actionsOneRow
            && narrowPlayer.sliderWidth > narrowPlayer.progressWidth / 2 && narrowPlayer.height < 85,
            'Compact playback uses a wide timeline and one button row at 320 px: ' + JSON.stringify(narrowPlayer));
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('#recording-11 .vz2-audio-transport input').fill('10');
        await page.waitForFunction(() => document.querySelector('#recording-11 audio').currentTime >= 9.9);
        await page.locator('#recording-11 .vz2-audio-back').click();
        assert((await page.locator('#recording-11 audio').evaluate(audio => audio.currentTime)) < 6, 'Back skips five seconds');
        await page.locator('#recording-11 .vz2-audio-forward').click();
        assert((await page.locator('#recording-11 audio').evaluate(audio => audio.currentTime)) >= 9, 'Forward skips five seconds');
        await page.locator('#recording-11 .vz2-audio-restart').click();
        assert((await page.locator('#recording-11 audio').evaluate(audio => audio.currentTime)) < 1, 'Restart seeks to the beginning');
        await page.locator('#recording-11 .vz2-audio-loop').click();
        assert.equal(await page.locator('#recording-11 audio').evaluate(audio => audio.loop), true, 'Repeat toggles audio looping');
        await page.locator('#recording-11 .vz2-audio-loop').click();
        await page.locator('#recording-11 .vz2-audio-mute').click();
        assert.equal(await page.locator('#recording-11 audio').evaluate(audio => audio.muted), true, 'Mute controls the recording');
        await page.locator('#recording-11 .vz2-audio-mute').click();
        await page.locator('#recording-11 .vz2-audio-play-pause').click();
        assert(await page.locator('#recording-11 .vz2-audio-transport').isVisible(), 'Pause keeps the player expanded');
        await page.locator('#recording-11 .vz2-audio-play-pause').click();
        await page.waitForFunction(() => !document.querySelector('#recording-11 audio').paused);
        await page.locator('#recording-11 .vz2-audio-trigger').click();
        assert.equal(await page.locator('#recording-11 .vz2-audio-transport:visible').count(), 0, 'The player can be collapsed manually');
        assert(await page.locator('#recording-11 audio').evaluate(audio => audio.paused), 'Closing the player pauses its audio');
        await page.locator('#recording-11 .recording-actions').getByRole('button', { name: 'Otevřít časové značky' }).click();
        assert.equal(await page.locator('#recording-11 .recording-timestamps .ts-summary:visible').count(), 0, 'The former timestamp heading is replaced by its icon');
        await page.locator('#recording-11 .ts-song_start').getByRole('button', { name: 'Smyčka' }).click();
        await page.waitForFunction(() => !document.querySelector('#recording-11 audio').paused);
        await page.locator('#recording-11 audio').evaluate(audio => { audio.currentTime = 2.1; });
        await page.waitForFunction(() => {
            const audio = document.querySelector('#recording-11 audio');
            return !audio.paused && audio.currentTime >= 1 && audio.currentTime < 2;
        });
        await page.locator('#recording-11 .vz2-audio-trigger').click();
        await page.locator('#recording-11 audio').evaluate(audio => { audio.currentTime = 2.1; });
        await page.waitForTimeout(150);
        assert(await page.locator('#recording-11 audio').evaluate(audio => audio.paused), 'Closing the player stops the timestamp loop');
        assert.equal(await page.locator('#recording-11 .vz2-audio-transport:visible').count(), 0, 'The timestamp loop does not reopen a closed player');
        await shot('recording-expanded-390');
        await page.locator('#recording-11 .recording-actions').getByRole('button', { name: 'Další' }).click();
        assert.equal(await page.locator('#recording-actions-11 .recording-action-order, #recording-actions-11 .recording-action-edit').count(), 0, 'The actions dialog has no edit or ordering section');
        assert.equal(await page.locator('#recording-actions-11 .recording-action-files').getByRole('button', { name: 'Přesunout' }).count(), 1, 'Move is grouped with file actions');
        await page.locator('#recording-actions-11').getByRole('button', { name: 'Přejmenovat soubor' }).click();
        assert.equal(await page.locator('#edit-form [name=title]').inputValue(), 'zkouška.wav');
        await page.locator('#edit-form [name=title]').fill('Nový název.wav');
        await page.locator('#edit-form').getByRole('button', { name: 'Uložit' }).click();
        await page.waitForFunction(() => document.querySelector('#recording-11 .recording-title')?.textContent === 'Nový název.wav');
        if (await page.locator('#recording-actions-11').isVisible()) await page.locator('#recording-actions-11 .modal-close').click();
        await page.locator('#recording-11').getByRole('button', { name: 'Otevřít v Looperu', exact: true }).click();
        await page.waitForFunction(() => window.Vz2Player.getState()?.phase === 'ready');
        await page.locator('.looper-timestamp-actions').getByRole('button', { name: 'Otevřít časové značky' }).click();
        await page.locator('#looper-timestamps .ts-song_start').getByRole('button', { name: 'Smyčka' }).click();
        await page.waitForFunction(() => !document.querySelector('#looper-audio').paused);
        await page.locator('#looper-play').click();
        await page.locator('#looper-audio').evaluate(audio => { audio.currentTime = 2.1; });
        await page.waitForTimeout(150);
        assert(await page.locator('#looper-audio').evaluate(audio => audio.paused), 'Manual Looper pause stops its timestamp loop');
        await page.locator('.looper-timestamp-actions').getByRole('button', { name: 'Zavřít časové značky' }).click();
        await page.locator('.looper-timestamp-actions').getByRole('button', { name: 'Přidat značku' }).click();
        const editorBox = await page.locator('.vz2-timestamp-editor').boundingBox();
        const playerBox = await page.locator('#player-shell').boundingBox();
        assert(editorBox.y >= playerBox.y + playerBox.height, 'The mobile timestamp editor opens below the player');
        assert(editorBox.height < 380, 'The mobile timestamp editor uses only the height its controls need');
        assert(Math.abs(editorBox.y + editorBox.height - (844 - 8)) <= 2, 'The mobile timestamp editor stays at the bottom');
        assert(await page.locator('.vz2-timestamp-editor [name=body]').isVisible(), 'The timestamp input is visible');
        await shot('timestamp-editor-390');
        await page.locator('.vz2-timestamp-editor .ts-close').click();
        const normalWaveHeight = (await page.locator('#looper-wave').boundingBox()).height;
        await page.locator('#player-fullscreen').click();
        assert.equal((await page.locator('#looper-wave').boundingBox()).height, normalWaveHeight, 'Mobile fullscreen preserves waveform height');
        assert(await page.locator('#looper-timestamps .ts-song_start').isVisible(), 'Mobile fullscreen opens timestamps automatically');
        await page.locator('.looper-timestamp-actions').getByRole('button', { name: 'Přidat značku' }).click();
        const fullscreenEditorBox = await page.locator('.vz2-timestamp-editor').boundingBox();
        const timelineBox = await page.locator('#looper-panel .timeline').boundingBox();
        assert(fullscreenEditorBox.y >= timelineBox.y + timelineBox.height, 'The editor opens below the fullscreen Looper controls');
        assert(fullscreenEditorBox.height < 380 && fullscreenEditorBox.y + fullscreenEditorBox.height <= 844, 'The fullscreen editor stays compact and visible');
        await shot('timestamp-editor-fullscreen-390');
        await page.locator('.vz2-timestamp-editor .ts-close').click();
        await page.locator('#player-fullscreen').click();
        await page.locator('#looper-play').click();
        await page.waitForFunction(() => window.Vz2Player.getState()?.playing);
        await page.evaluate(() => window.testAudio = document.getElementById('looper-audio'));
        await page.locator('#player-collapse').click();
        const beforeBack = await page.evaluate(() => window.testAudio.currentTime);
        await switchTo('history'); await page.goBack();
        await page.waitForFunction(() => document.body.dataset.workspace === 'rehearsals');
        const backAudio = await page.evaluate(() => ({ time: window.testAudio.currentTime, paused: window.testAudio.paused, same: window.testAudio === document.getElementById('looper-audio') }));
        assert(backAudio.time >= beforeBack && !backAudio.paused && backAudio.same, 'Back to a recording URL must preserve the playing audio: ' + JSON.stringify(backAudio));
        const start = await page.evaluate(() => window.Vz2Player.getState().position);
        for (const workspace of ['songs', 'history', 'ideas', 'rehearsals']) await switchTo(workspace);
        assert(await page.evaluate(() => document.getElementById('looper-audio') === window.testAudio && !window.testAudio.paused && window.testAudio.currentTime > 0));
        assert((await page.evaluate(() => window.Vz2Player.getState().position)) > start);
        await page.locator('#player-title').click();
        assert.equal(await page.locator('#collection-title-name').textContent(), 'Zkouška 8. října');
        assert(await page.evaluate(() => !window.testAudio.paused));
        await switchTo('ideas');
        await page.locator('#looper-options summary').click(); await page.locator('#looper-close').click();
        assert.equal(await page.evaluate(() => window.Vz2Player.getState()), null);
        assert.equal(await page.locator('body').getAttribute('data-workspace'), 'ideas');
        console.log('PASS: actual Looper audio keeps its element, playback and position across workspaces; source link and close retain browsing context');

        await switchTo('rehearsals'); await page.locator('#recording-12 .recording-toggle').click();
        holdMixer = gate(); mixerRequested = gate();
        await page.locator('#recording-12').getByRole('button', { name: 'Otevřít v Mixéru', exact: true }).click();
        await mixerRequested.promise; await switchTo('songs'); holdMixer.release(); holdMixer = null;
        await page.waitForFunction(() => window.Vz2Player.getState()?.mode === 'mixer' && window.Vz2Player.getState()?.phase === 'ready');
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.locator('#mixer-timestamps .ts-summary').click();
        await page.waitForFunction(() => {
            const button = document.querySelector('#mixer-timestamps .ts-song_start .ts-action');
            return button && !button.disabled;
        });
        await page.locator('#mixer-timestamps .ts-song_start').getByRole('button', { name: 'Smyčka' }).click();
        await page.waitForFunction(() => window.MultitrackApp.getState()?.playing);
        await page.locator('#mt-play').evaluate(button => button.click());
        await page.evaluate(() => window.MultitrackApp.seek(2.1));
        await page.waitForTimeout(150);
        assert.equal(await page.evaluate(() => window.MultitrackApp.getState()?.playing), false, 'Manual Mixer pause stops its timestamp loop');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('#looper-play').click(); await page.waitForFunction(() => window.MultitrackApp.getState()?.playing);
        await switchTo('history'); await switchTo('ideas'); await switchTo('rehearsals');
        assert(await page.evaluate(() => window.MultitrackApp.getState()?.playing));
        assert.equal(await page.evaluate(() => window.MultitrackApp.getState().id), '12');
        await page.locator('#looper-options > summary').click(); await page.locator('#looper-close').click();
        assert.equal(await page.evaluate(() => window.MultitrackApp.getState()), null);
        await page.goBack();
        await page.waitForFunction(() => document.body.dataset.workspace === 'ideas');
        await page.goForward();
        await page.waitForFunction(() => document.body.dataset.workspace === 'rehearsals');
        await page.reload(); await ready();
        assert.equal(await page.locator('body').getAttribute('data-workspace'), 'rehearsals');
        assert.equal(await page.locator('#collection-title-name').textContent(), 'Zkouška 8. října');
        assert.deepEqual(confirmations, [], 'Browsing must not prompt to stop playback');
        assert.deepEqual(errors, []);
        console.log('PASS: pending Mixer continues loading while browsing; playing Mixer survives navigation; Back/Forward and reload restore the workspace');

        await switchTo('songs');
        assert.equal(await page.locator('#recording-13').count(), 1, 'Home recording retains its original card');
        const rehearsalGroup = page.locator('.linked-recordings .linked-recording-group');
        assert.equal(await rehearsalGroup.count(), 1, 'Intervals from the same source appear under one recording');
        assert.equal(await rehearsalGroup.locator('.linked-recording-group-title').textContent(), 'Nový název.wav', 'The shared heading uses the current source filename');
        assert.equal(await rehearsalGroup.locator('.recording-caption-text').textContent(), 'Celá zkouška');
        assert.equal(await rehearsalGroup.locator('.recording-author').count(), 1);
        assert.equal(await rehearsalGroup.locator('.linked-recording-group-source').textContent(), 'Zkouška: Zkouška 8. října');
        assert.deepEqual(await rehearsalGroup.locator('.linked-interval-label .recording-title').allTextContents(), ['Výstřížek 00:05–00:10', 'Výstřížek 00:15–00:20'], 'Linked intervals are sorted by start time');
        assert.deepEqual(await rehearsalGroup.locator('.linked-interval-note').allTextContents(), ['Začátek skladby', 'Další pokus']);
        assert.equal(await rehearsalGroup.locator('.linked-recording-card .recording-caption, .linked-recording-card .linked-recording-context').count(), 0, 'Interval details do not repeat source metadata');
        const rehearsalInterval = rehearsalGroup.locator('.linked-recording-card').first();
        await rehearsalInterval.locator('.recording-toggle').click();
        assert.equal(await rehearsalInterval.locator('audio').count(), 1, 'The linked interval has an inline player');
        assert.equal(await rehearsalInterval.getByRole('button', { name: /Otevřít ve zkoušce/ }).count(), 1);
        assert.equal(await rehearsalInterval.getByRole('button', { name: /Smazat|Odstranit|Přesunout|Upravit/ }).count(), 0, 'Source management is absent from the linked card');
        await page.waitForFunction(() => {
            const audio = document.querySelector('.linked-recordings audio');
            return audio && audio.readyState >= 1 && audio.currentTime >= 4.9;
        });
        assert.equal(await rehearsalInterval.locator('.vz2-audio-trigger, .vz2-audio-collapse').count(), 0, 'The linked excerpt has no separate play or collapse button');
        assert.equal(await rehearsalInterval.locator('.vz2-audio-transport:visible').count(), 1, 'The linked excerpt shows its controls directly');
        await rehearsalInterval.locator('.vz2-audio-play-pause').click();
        await page.waitForFunction(() => !document.querySelector('.linked-recordings audio').paused);
        assert.equal(await rehearsalInterval.locator('.vz2-audio-transport input').getAttribute('max'), '5', 'The seek range covers only the excerpt');
        await rehearsalInterval.locator('.vz2-audio-play-pause').click();
        await rehearsalInterval.locator('audio').evaluate(audio => { audio.currentTime = 11; });
        await page.waitForFunction(() => document.querySelector('.linked-recordings audio').currentTime <= 10);
        await rehearsalInterval.locator('audio').evaluate(async audio => { audio.currentTime = 9.8; await audio.play(); });
        await page.waitForFunction(() => {
            const audio = document.querySelector('.linked-recordings audio');
            return audio.paused && audio.currentTime >= 9.95 && audio.currentTime <= 10;
        });
        await page.locator('#recording-13 .recording-toggle').click();
        await page.locator('#recording-13 .recording-actions').getByRole('button', { name: 'Další' }).click();
        await page.locator('#recording-actions-13').getByRole('button', { name: 'Přesunout' }).click();
        assert((await page.locator('#move-links-info').textContent()).includes('matici'));
        assert.deepEqual(await page.locator('#move-form select option').allTextContents(), ['Nová skladba', 'Poslední vlak']);
        await page.locator('#move-cancel').click();
        await page.locator('.linked-recordings').getByRole('button', { name: /Otevřít úsek/ }).first().click();
        await page.waitForFunction(() => window.Vz2Player.getState()?.phase === 'ready');
        assert.equal(await page.locator('body').getAttribute('data-workspace'), 'songs');
        assert.equal(await page.locator('#bn-skladby').getAttribute('aria-pressed'), 'true', 'The mobile dock stays on Songs while the interval plays');
        assert.equal(await page.locator('#bn-zkousky').getAttribute('aria-pressed'), 'false');
        assert.equal(await page.locator('#collection-title-name').textContent(), 'Nová skladba');
        await page.waitForFunction(() => window.Vz2Player.getState()?.position >= 4.9);
        assert.equal(await page.evaluate(() => window.Vz2Player.getState()?.id), '11');
        assert.equal(await page.locator('#recording-13').count(), 1, 'The song recording stays in the folder view');
        assert.equal(new URL(page.url()).searchParams.get('collection_id'), '1');
        assert.equal(new URL(page.url()).searchParams.get('keep_collection'), '1');
        await page.reload(); await ready();
        await page.waitForFunction(() => window.Vz2Player.getState()?.phase === 'ready');
        assert.equal(await page.locator('body').getAttribute('data-workspace'), 'songs');
        assert.equal(await page.locator('#collection-title-name').textContent(), 'Nová skladba');
        assert.equal(await page.evaluate(() => window.Vz2Player.getState()?.id), '11');
        await page.locator('.linked-recordings .recording-toggle').first().click();
        await page.locator('.linked-recordings').getByRole('button', { name: /Otevřít ve zkoušce/ }).first().click();
        assert.equal(await page.locator('#recording-11 .recording-toggle').getAttribute('aria-expanded'), 'true', 'The source recording opens in its rehearsal');
        assert.equal(await page.locator('#collection-title-name').textContent(), 'Zkouška 8. října');
        assert.equal(await page.locator('.linked-recordings li').count(), 1, 'Rehearsal links the song-owned clip without duplicating its own card');
        const songClip = page.locator('.linked-recordings .linked-recording-card');
        await songClip.locator('.recording-toggle').click();
        assert.equal(await songClip.locator('audio').count(), 1, 'The song clip has a full inline player');
        await page.locator('.linked-recordings').getByRole('button', { name: /Otevřít nahrávku/ }).click();
        await page.waitForFunction(() => window.Vz2Player.getState()?.id === '13');
        assert.equal(await page.locator('#collection-title-name').textContent(), 'Zkouška 8. října', 'Opening the player keeps the rehearsal folder');
        await page.locator('.linked-recordings').getByRole('button', { name: /Otevřít ve skladbě/ }).click();
        assert.equal(await page.locator('#collection-title-name').textContent(), 'Nová skladba');
        assert.equal(await page.locator('#recording-13').count(), 1);
        catalog.attachments.push(
            { id: 21, collection_id: 1, title: '', original_name: 'old.jpg', state: 'deleted', url: null, author: 'Petr', revision: 2, can_remove: true },
            { id: 22, collection_id: 1, title: '', original_name: 'active.jpg', state: 'available', url: '/sample.wav', author: 'Petr', revision: 1, can_remove: true }
        );
        await page.reload(); await ready();
        const oldAttachment = page.locator('.attachment-card').filter({ hasText: 'old.jpg' });
        await oldAttachment.locator('.recording-toggle').click();
        assert((await oldAttachment.textContent()).includes('Soubor odstraněn'));
        await oldAttachment.getByRole('button', { name: 'Smazat položku' }).click();
        await page.waitForFunction(() => !document.querySelector('.attachment-card')?.textContent.includes('old.jpg'));
        const activeAttachment = page.locator('.attachment-card').filter({ hasText: 'active.jpg' });
        await activeAttachment.locator('.recording-toggle').click();
        await activeAttachment.getByRole('button', { name: 'Odstranit přílohu' }).click();
        await page.waitForFunction(() => !document.querySelector('.attachment-card'));
        recordings[2].can_remove = true;
        await page.reload(); await ready();
        await page.evaluate(() => { window.VZ2.admin = false; });
        await page.locator('#recording-13 .recording-toggle').click();
        await page.locator('#recording-13 .recording-actions').getByRole('button', { name: 'Další' }).click();
        await page.locator('#recording-actions-13').getByRole('button', { name: 'Odstranit audio' }).click();
        await page.waitForFunction(() => document.querySelector('#recording-13 .recording-status')?.dataset.state === 'deleted');
        if (await page.locator('#recording-13 .recording-toggle').getAttribute('aria-expanded') === 'false') await page.locator('#recording-13 .recording-toggle').click();
        await page.locator('#recording-13 .recording-actions').getByRole('button', { name: 'Další' }).click();
        assert.equal(await page.evaluate(() => window.VZ2.admin), false);
        assert.equal(await page.locator('#recording-actions-13').getByRole('button', { name: 'Úplně smazat' }).count(), 1, 'Uploader sees full deletion after audio removal');
        await page.locator('#recording-actions-13').getByRole('button', { name: 'Úplně smazat' }).click();
        await page.waitForFunction(() => !document.querySelector('#recording-13'));
        assert.deepEqual(recordingDeletions, ['remove_audio', 'delete_recording']);
        assert.deepEqual(deletionDialogs.slice(-2), ['confirm', 'confirm'], 'Deleting a recording only asks for yes/no confirmation');
        assert.deepEqual(errors, []);
        console.log('PASS: linked recordings, attachment removal, and recording deletion without name entry');

        timestampRows.push(...[5000, 10000, 20000, 30000, 40000, 50000].map((timeMs, index) => ({
            id: 110 + index, time_ms: timeMs, kind: 'song_start', body: 'Část ' + (index + 1),
            author: 'Petr', editor: 'Petr', created_by: 1, updated_by: 1, revision: 1, can_edit: false, can_delete: false,
            created_at: '2026-10-23 10:00:00', updated_at: '2026-10-23 10:00:00'
        })));
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto('http://vz2-workspaces.test/index.php?v=2&recording_id=11&view=looper&time_ms=15000');
        await ready();
        await page.waitForFunction(() => window.Vz2Player.getState()?.phase === 'ready');
        await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: value => { window.copiedTimeLink = value; return Promise.resolve(); } } }));
        await page.locator('#looper-options summary').click();
        await page.locator('#looper-copy-link').click();
        assert(await page.locator('#time-link-dialog').isVisible());
        await page.locator('#time-link-copy').click();
        assert.equal(new URL(await page.evaluate(() => window.copiedTimeLink)).searchParams.has('listen'), false);
        await page.locator('#time-link-car').check();
        await page.locator('#time-link-copy').click();
        const carUrl = await page.evaluate(() => window.copiedTimeLink);
        assert.equal(new URL(carUrl).searchParams.get('listen'), '1');
        assert.equal(new URL(carUrl).searchParams.get('view'), 'audio');
        const peaksBeforeCar = peakRequests;
        await page.locator('#time-link-close').click();
        await page.setViewportSize({ width: 390, height: 780 });
        await page.locator('#car-mode-menu-open').click();
        await page.waitForFunction(() => window.Vz2CarMode.getState()?.phase === 'ready');
        assert.equal(await page.evaluate(() => window.Vz2Player.getState()), null, 'Entering car mode closes Looper');
        assert.equal(peakRequests, peaksBeforeCar, 'Entering car mode does not load another waveform');
        assert(Math.abs(await page.evaluate(() => window.Vz2CarMode.getState().position) - 15) < 1, 'Entering car mode keeps the current time');
        await page.locator('#car-close').click();
        await page.goto(carUrl); await ready();
        await page.waitForFunction(() => window.Vz2CarMode.getState()?.phase === 'ready');
        assert(await page.locator('#car-mode').isVisible());
        assert.equal(await page.evaluate(() => window.Vz2Player.getState()), null, 'The mobile link does not open Looper');
        assert.equal(peakRequests, peaksBeforeCar, 'Car mode does not request waveform peaks');
        assert.equal(await page.evaluate(() => window.Vz2CarMode.getState().playing), false, 'The mobile deep link waits for Play');
        assert(Math.abs(await page.evaluate(() => window.Vz2CarMode.getState().position) - 15) < 1, 'The mobile deep link keeps its time');
        await page.locator('#car-chapter-list .car-chapter').first().waitFor();
        assert.equal(await page.locator('#car-chapter-list .car-chapter').count(), 7, 'All song starts are available');
        await page.waitForFunction(() => document.querySelector('#car-chapter-list .car-chapter.is-current')?.textContent.includes('Část 2'));
        await page.setViewportSize({ width: 320, height: 700 });
        assert(await page.evaluate(() => document.querySelector('#car-mode').scrollWidth <= innerWidth + 1 && document.querySelector('#car-chapter-list').clientHeight > 100), 'Car controls and chapters fit a narrow screen');
        await page.setViewportSize({ width: 390, height: 780 });
        await shot('car-mode-mobile');
        await page.locator('#car-back').click();
        assert(Math.abs(await page.evaluate(() => window.Vz2CarMode.getState().position) - 5) < 1);
        await page.locator('#car-forward').click();
        assert(Math.abs(await page.evaluate(() => window.Vz2CarMode.getState().position) - 15) < 1);
        await page.locator('#car-up').click();
        try { await page.waitForFunction(() => document.querySelector('#car-status').textContent.includes('Hodnocení uloženo'), undefined, { timeout: 3000 }); }
        catch (_) { throw new Error('Car rating status: ' + await page.locator('#car-status').textContent() + '; notes: ' + JSON.stringify(carNotes)); }
        assert.equal(carNotes.at(-1)?.body, '👍');
        assert(Math.abs(carNotes.at(-1).time_ms - 15000) < 1000);
        await page.locator('#car-down').click();
        await page.waitForFunction(() => document.querySelector('#car-status').textContent.includes('Hodnocení uloženo') && !document.querySelector('#car-down').disabled);
        assert.equal(carNotes.at(-1)?.body, '👎');
        await page.locator('#car-recording').click();
        await page.locator('#car-picker-folder').click();
        assert(await page.locator('#car-picker-folders').isVisible());
        await shot('car-mode-folders');
        await page.locator('[data-car-kind=song]').click();
        assert(await page.locator('#car-picker-folder-list').getByText('Nová skladba').isVisible());
        assert.equal(await page.evaluate(() => window.Vz2CarMode.getState().id), '11', 'Browsing folders leaves playback intact');
        await page.locator('[data-car-kind=rehearsal]').click();
        await page.locator('#car-picker-folder-list').getByRole('button', { name: /Zkouška 8. října/ }).click();
        assert.equal(await page.locator('#car-picker-recordings .car-picker-row').count(), 2);
        await page.locator('#car-picker-close').click();
        await page.locator('#car-chapter-list .car-chapter').filter({ hasText: 'Část 3' }).click();
        await page.waitForFunction(() => window.Vz2CarMode.getState()?.playing && window.Vz2CarMode.getState()?.position >= 19);
        await page.evaluate(() => { document.getElementById('car-audio').currentTime = 23; });
        assert.equal(await page.evaluate(() => window.Vz2CarMode.getState().playing), true, 'Song end does not stop car playback');
        await page.locator('#car-recording').click();
        await page.locator('#car-picker-recordings .car-picker-row').nth(1).click();
        await page.waitForFunction(() => window.Vz2CarMode.getState()?.id === '12' && window.Vz2CarMode.getState()?.phase === 'ready');
        assert.equal(new URL(page.url()).searchParams.get('listen'), '1', 'Selecting another recording retains car mode');
        assert((await page.locator('#car-recording').textContent()).includes('zkouška'));
        await page.locator('#car-close').click();
        assert.equal(new URL(page.url()).searchParams.has('listen'), false);
        assert.equal(await page.locator('#car-mode').isVisible(), false);
        await page.goto('http://vz2-workspaces.test/index.php?v=2&collection_id=3'); await ready();
        await page.locator('#car-mode-menu-open').click();
        assert(await page.locator('#car-picker-folders').isVisible(), 'The main menu car icon opens folder selection without a player');
        await page.locator('#car-picker-close').click();
        await page.locator('#car-close').click();
        await page.locator('#car-mode-collection-open').click();
        assert(await page.locator('#car-mode').isVisible(), 'The collection header car icon opens car mode');
        assert(await page.locator('#car-picker-recordings').isVisible(), 'The collection icon starts with recordings from the current folder');
        await page.locator('#car-picker-recordings .car-picker-row').first().click();
        await page.waitForFunction(() => window.Vz2CarMode.getState()?.mode === 'audio' && window.Vz2CarMode.getState()?.phase === 'ready');
        assert.equal(peakRequests, peaksBeforeCar, 'Selecting an ordinary recording in car mode skips peaks');
        await page.locator('#car-close').click();
        await page.locator('#recording-11 .recording-car-entry').click();
        await page.waitForFunction(() => window.Vz2CarMode.getState()?.id === '11' && window.Vz2CarMode.getState()?.phase === 'ready');
        assert(await page.locator('#car-mode').isVisible(), 'The recording car icon opens that recording in car mode');
        await page.locator('#car-close').click();
        await page.evaluate(() => {
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: value => { window.copiedTimeLink = value; return Promise.resolve(); } } });
            window.Vz2CarMode.openShare(11, '', 5000);
        });
        await page.locator('#time-link-car').check();
        await page.locator('#time-link-copy').click();
        assert.equal(new URL(await page.evaluate(() => window.copiedTimeLink)).searchParams.get('view'), 'audio', 'Inline car links use the regular audio player');
        await page.locator('#time-link-close').click();
        const oldCarUrl = new URL(carUrl); oldCarUrl.searchParams.set('view', 'looper');
        await page.goto(oldCarUrl.href); await ready();
        await page.waitForFunction(() => window.Vz2CarMode.getState()?.phase === 'ready');
        assert.equal(await page.evaluate(() => window.Vz2Player.getState()), null, 'Older car links also skip Looper');
        assert.equal(peakRequests, peaksBeforeCar, 'Older car links do not request peaks');
        assert.deepEqual(errors, []);
        console.log('PASS: car mode deep link, compact chapters, rating notes, folder chooser, and continuous playback');
    } catch (error) {
        console.error('Browser errors:', errors);
        console.error(await page.locator('#vz2-boot-status, #message').allTextContents());
        await shot('failure'); throw error;
    } finally { holdMixer?.release(); await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
