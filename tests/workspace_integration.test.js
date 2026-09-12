'use strict';

// Isolated PHP copy and a dedicated test database. Never uses the site's config/DB.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const php = process.env.PHP_BIN;
const dbPort = Number(process.env.WORKSPACE_TEST_DB_PORT);
assert.ok(php && dbPort > 1024 && dbPort !== 3306, 'Set PHP_BIN and a dedicated WORKSPACE_TEST_DB_PORT');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zkusebna-workspace-'));
const dbName = 'workspace_' + Date.now();
function write(file, content) { fs.mkdirSync(path.dirname(path.join(temp, file)), { recursive: true }); fs.writeFileSync(path.join(temp, file), content); }
for (const file of ['index.php', 'multitrack.php', 'help.php']) fs.copyFileSync(path.join(root, file), path.join(temp, file));
for (const dir of ['php', 'js', 'css', 'data', 'fonts', 'meat']) fs.cpSync(path.join(root, dir), path.join(temp, dir), { recursive: true });
const config = fs.readFileSync(path.join(root, 'config.php'), 'utf8').split('// Osobní účty:')[0]
    .replace(/define\('DB_HOST',.*?\);/, `define('DB_HOST', '127.0.0.1:${dbPort}');`)
    .replace(/define\('DB_USER',.*?\);/, "define('DB_USER', 'root');")
    .replace(/define\('DB_PASS',.*?\);/, `define('DB_PASS', ${JSON.stringify(process.env.WORKSPACE_TEST_DB_PASS || '')});`)
    .replace(/define\('DB_NAME',.*?\);/, `define('DB_NAME', '${dbName}');`);
write('config.php', config + '\nfunction auth_is_admin() { return ($_SESSION["role"] ?? "") === "admin"; }\n');
write('_session.php', `<?php session_start(); $_SESSION = ['logged_in_single'=>true, 'role'=>($_GET['role'] ?? 'muzikant'), 'kapela'=>'kapela', 'befelemepesseveze'=>'test', 'user_name'=>'Tester', 'multitrack_csrf'=>str_repeat('a',64)];`);
write('_db.php', `<?php require 'config.php'; $db = new mysqli(DB_HOST, DB_USER, DB_PASS); $db->query('CREATE DATABASE ${dbName}'); $db->select_db(DB_NAME); $db->query('CREATE TABLE recording_notes (id INT AUTO_INCREMENT PRIMARY KEY, file_path VARCHAR(1000), cas BIGINT, typ TINYINT, jmeno VARCHAR(50), poznamka TEXT)');`);
write('_drop.php', `<?php require 'config.php'; $db = new mysqli(DB_HOST, DB_USER, DB_PASS); $db->query('DROP DATABASE ${dbName}');`);
execFileSync(php, [path.join(temp, '_db.php')], { cwd: temp, windowsHide: true });
for (const section of ['uploads', 'zkousky']) {
    write(`user/kapela/test/${section}/Spolecny/data/nazev_valu.txt`, section === 'uploads' ? 'Skladba A' : 'Zkouška 13. září');
    write(`user/kapela/test/${section}/Spolecny/texty/akordy.txt`, section + ' text');
    write(`user/kapela/test/${section}/Spolecny/texty/tabelatura.txt`, section + ' tab');
}
function wav(seconds = 30) {
    const n = 8000 * seconds;
    const b = Buffer.alloc(44 + n * 2);
    b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28);
    b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
    return b;
}
for (const [id, count] of [['jedna', 1], ['kapela', 3]]) {
    const tracks = Array.from({ length: count }, (_, i) => ({ name: ['Bicí', 'Basa', 'Kytara'][i], file: `track-${i}.wav`, order: i + 1 }));
    tracks.forEach(t => write(`user/kapela/test/multitracky/${id}/${t.file}`, wav()));
    write(`user/kapela/test/multitracky/${id}/multitrack.json`, JSON.stringify({ version: 1, name: id === 'jedna' ? 'Kontrolní stereo záznam' : 'Zkouška — celý záznam', created: '2026-09-13T18:00:00+02:00', tracks }));
}

(async function() {
    const socket = require('node:net').createServer();
    await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
    const port = socket.address().port;
    await new Promise(resolve => socket.close(resolve));
    const server = spawn(php, ['-d', `session.save_path=${temp}`, '-S', `127.0.0.1:${port}`, '-t', temp], { cwd: temp, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const log = fs.createWriteStream(path.join(temp, 'server.log'));
    server.stdout.pipe(log); server.stderr.pipe(log);
    let browser;
    const base = `http://127.0.0.1:${port}/`;
    let cookie = '';
    async function request(url, fields, json = false, csrf = 'a'.repeat(64)) {
        const headers = { Cookie: cookie, 'X-Requested-With': 'XMLHttpRequest' };
        if (fields) { headers['Content-Type'] = json ? 'application/json' : 'application/x-www-form-urlencoded'; headers['X-CSRF-Token'] = csrf; }
        const response = await fetch(base + url, { headers, method: fields ? 'POST' : 'GET', body: fields ? (json ? JSON.stringify(fields) : new URLSearchParams(fields)) : undefined });
        if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
        const text = await response.text();
        return { status: response.status, text, json: () => JSON.parse(text) };
    }
    try {
        for (let i = 0; i < 30; i++) {
            try { await request('_session.php'); break; } catch (error) { await new Promise(resolve => setTimeout(resolve, 100)); }
        }
        assert.match((await request('index.php?sekce=uploads')).text, /Skladba A/);
        assert.match((await request('index.php?sekce=zkousky')).text, /Zkouška 13. září/);
        assert.match((await request('php/ajax/ajax_text_raw.php?sekce=uploads')).text, /uploads text/);
        assert.match((await request('php/ajax/ajax_text_raw.php?sekce=zkousky')).text, /zkousky text/);
        await request('php/actions/vlozit_akordy.php?sekce=zkousky', { editor: 'Nový zápis zkoušky', soubor_akordu: 'akordy.txt' });
        assert.equal(fs.readFileSync(path.join(temp, 'user/kapela/test/uploads/Spolecny/texty/akordy.txt'), 'utf8'), 'uploads text');
        assert.equal(fs.readFileSync(path.join(temp, 'user/kapela/test/zkousky/Spolecny/texty/akordy.txt'), 'utf8'), 'Nový zápis zkoušky');
        assert.equal((await request('index.php?sekce=../uploads')).status, 400);
        await request('php/ajax/vlozit_komentar.php?sekce=uploads', { text: 'Pouze skladba', name: 'Tester' });
        await request('php/ajax/vlozit_komentar.php?sekce=zkousky', { text: 'Pouze zkouška', name: 'Tester' });
        const songs = (await request('php/ajax/ajax_diskuse.php?sekce=uploads')).text;
        const rehearsals = (await request('php/ajax/ajax_diskuse.php?sekce=zkousky')).text;
        assert.ok(songs.includes('Pouze skladba') && !songs.includes('Pouze zkouška'));
        assert.ok(rehearsals.includes('Pouze zkouška') && !rehearsals.includes('Pouze skladba'));
        await request('php/actions/vytvorit_adresar.php?sekce=zkousky', { jmeno_adresare: 'Dalsi zkouska', navrat: '/' });
        assert.ok(fs.existsSync(path.join(temp, 'user/kapela/test/zkousky/Dalsi zkouska')));
        assert.ok(!fs.existsSync(path.join(temp, 'user/kapela/test/uploads/Dalsi zkouska')));
        await request('php/ajax/zmenit_slozku_ajax.php?sekce=zkousky', { cilova_slozka: 'Spolecny' });
        console.log('OK: separate directories, text writes, discussion tables, folder creation and section validation');

        const noteUrl = 'php/ajax/multitrack_notes.php';
        assert.equal((await request(noteUrl, { id: 'jedna', revision: 0, action: 'entry', kind: 'bad', time: -1, text: '' }, true)).status, 400);
        assert.equal((await request(noteUrl + '?id=jedna')).status, 200);
        assert.equal((await request('php/ajax/multitracky.php')).status, 200);
        let result = await request(noteUrl, { id: 'kapela', revision: 0, action: 'summary', text: 'Procvičit nástupy.' }, true);
        assert.equal(result.status, 200, result.text);
        let notes = result.json().notes;
        result = await request(noteUrl, { id: 'kapela', revision: notes.revision, action: 'entry', kind: 'chapter', time: 0, text: 'První skladba' }, true);
        notes = result.json().notes;
        result = await request(noteUrl, { id: 'kapela', revision: notes.revision, action: 'entry', kind: 'note', time: 12, text: 'Znovu nástup refrénu.' }, true);
        notes = result.json().notes;
        assert.equal(notes.entries[1].author, 'Tester');
        assert.equal((await request(noteUrl, { id: 'kapela', revision: 0, action: 'summary', text: 'Old write' }, true)).status, 409);
        assert.equal((await request(noteUrl, { id: 'kapela', revision: notes.revision, action: 'summary', text: 'Invalid CSRF' }, true, 'bad')).status, 403);
        await request('_session.php?role=host');
        assert.equal((await request(noteUrl + '?id=kapela')).status, 200);
        assert.equal((await request(noteUrl, { id: 'kapela', revision: notes.revision, action: 'summary', text: 'Guest' }, true)).status, 403);
        await request('_session.php');
        // Upload an actual one-track WAV via the production endpoint.
        const upload = new FormData();
        upload.set('name', 'Jedna nova'); upload.set('track_count', '1'); upload.set('csrf', 'a'.repeat(64));
        upload.append('tracks[]', new Blob([wav(1)], { type: 'audio/wav' }), 'stereo.wav');
        const uploadResponse = await fetch(base + 'php/actions/upload_multitrack.php', { method: 'POST', headers: { Cookie: cookie }, body: upload });
        assert.equal(uploadResponse.status, 201, await uploadResponse.text());
        console.log('OK: notes persistence, conflict protection, CSRF, guest permissions and one-track upload');

        const executablePath = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, chromium.executablePath(),
            'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']
            .find(candidate => candidate && fs.existsSync(candidate));
        browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        await page.context().addCookies([{ name: 'PHPSESSID', value: cookie.split('=')[1], url: base }]);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base + 'index.php?sekce=uploads');
        await page.locator('#nav-multitrack').click();
        await page.locator('[data-mt-id="jedna"]').click();
        await page.waitForFunction(() => window.MultitrackApp.getState()?.phase === 'ready');
        assert.ok(await page.locator('#mt-mixer-toggle').isHidden());
        assert.ok(await page.locator('#mt-mixer').isHidden());
        assert.ok(await page.locator('#mt-master-volume').isVisible());
        await page.locator('[data-mt-id="kapela"]').click();
        await page.locator('#mt-switch-confirm').click();
        await page.waitForFunction(() => window.MultitrackApp.getState()?.id === 'kapela' && window.MultitrackApp.getState().phase === 'ready');
        await page.locator('#mt-mixer-toggle').click();
        assert.ok(await page.locator('#mt-tracks').isVisible());
        await page.locator('#mt-outline .mt-note-time').nth(1).click();
        assert.equal(Math.round(await page.evaluate(() => window.MultitrackApp.getState().position)), 12);
        await page.locator('#mt-add-note').click();
        assert.equal(await page.locator('#mt-note-time').inputValue(), '00:12');
        await page.locator('#mt-note-text').fill('Nová připomínka z prohlížeče');
        await page.locator('#mt-note-form button[type="submit"]').click();
        await page.getByText('Nová připomínka z prohlížeče', { exact: true }).waitFor();
        assert.ok((await page.locator('.mt-transport').boundingBox()).y >= 46, 'Transport stays above the scrolling notes');
        await page.screenshot({ path: path.join(temp, 'desktop.png'), fullPage: true });
        await page.locator('#mt-play').click();
        await page.locator('#nav-multitrack').click();
        assert.equal(await page.evaluate(() => window.MultitrackApp.getState().playing), false);
        assert.ok(await page.locator('#sidebar').isVisible());
        await page.locator('#nav-multitrack').click();
        assert.equal(await page.evaluate(() => window.MultitrackApp.getState().id), 'kapela');
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        await page.screenshot({ path: path.join(temp, 'mobile.png'), fullPage: true });
        assert.deepEqual(errors, []);
        await page.locator('#nav-multitrack').click();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        await page.screenshot({ path: path.join(temp, 'mobile-songs.png'), fullPage: true });
        await page.locator('#bn-skladby').click();
        await page.locator('#val-drawer .content-section-switch a[href$="zkousky"]').click();
        await page.waitForURL('**/index.php?sekce=zkousky');
        assert.equal(await page.evaluate(() => VZ.sekce), 'zkousky');
        await page.screenshot({ path: path.join(temp, 'mobile-rehearsals.png'), fullPage: true });
        console.log('OK: integrated browser view, single/master controls, mixer, timestamp seeking, note creation, view return and mobile width');

        result = await request(noteUrl + '?id=kapela'); notes = result.json().notes;
        result = await request(noteUrl, { id: 'kapela', revision: notes.revision, action: 'removeAudio' }, true);
        assert.equal(result.status, 200, result.text);
        assert.equal(result.json().notes.summary, 'Procvičit nástupy.');
        assert.ok(!fs.existsSync(path.join(temp, 'user/kapela/test/multitracky/kapela/track-0.wav')));
        assert.equal((await request('php/ajax/multitracky.php')).json().multitracks.find(x => x.id === 'kapela').audioDeleted, true);
        // A server-side removal of the recording directory must not hide its saved notes.
        fs.renameSync(path.join(temp, 'user/kapela/test/multitracky/kapela'), path.join(temp, 'removed-audio-directory'));
        assert.equal((await request(noteUrl + '?id=kapela')).json().notes.entries.length, 3);
        assert.ok((await request('php/ajax/multitracky.php')).json().multitracks.some(x => x.id === 'kapela' && x.audioDeleted));
        assert.equal((await request(noteUrl, { id: 'kapela', revision: result.json().notes.revision, action: 'summary', text: 'Archivovaný závěr' }, true)).status, 200);
        await page.locator('#nav-multitrack').click();
        await page.locator('[data-mt-id="kapela"]').click();
        await page.waitForFunction(() => window.MultitrackApp.getState()?.phase === 'archived');
        await page.waitForFunction(() => document.getElementById('mt-summary').value === 'Archivovaný závěr');
        assert.ok(await page.locator('#mt-outline .mt-note-time').first().isDisabled());
        assert.ok(await page.locator('#mt-play').isDisabled());
        assert.ok(await page.locator('#mt-remove-audio').isHidden());
        await page.screenshot({ path: path.join(temp, 'mobile-archive.png'), fullPage: true });
        console.log('OK: audio deletion and external folder removal preserve the discoverable, editable archive');
        console.log('Preview artifacts: ' + temp);
    } finally {
        if (browser) await browser.close();
        server.kill();
        execFileSync(php, [path.join(temp, '_drop.php')], { cwd: temp, windowsHide: true });
    }
})().catch(error => { console.error(error); console.error('Fixtures: ' + temp); process.exitCode = 1; });
