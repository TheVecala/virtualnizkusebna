'use strict';
// Two real PHP installations, one disposable database and physical storage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

module.exports = async ({ base, clients, request, db, check, temp, web, media, php, write }) => {
    const alpha = path.join(temp, 'alpha');
    fs.cpSync(web, alpha, { recursive: true });
    const socket = require('node:net').createServer();
    await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
    const port = socket.address().port;
    await new Promise(resolve => socket.close(resolve));
    const alphaBase = 'http://127.0.0.1:' + port + '/';
    const betaConfig = fs.readFileSync(path.join(web, 'config.php'), 'utf8');
    const alphaConfig = betaConfig.replace(base.slice(0, -1), alphaBase.slice(0, -1))
        .replace("define('VZ2_ENVIRONMENT','beta')", "define('VZ2_ENVIRONMENT','alpha')")
        .replace('<?php', "<?php define('VZ2_ONLY',true);");
    const configure = (dir, config, writable) => write(path.join(dir, 'config.php'), config.replace(
        "define('VZ2_WRITES_ENABLED',true)", "define('VZ2_WRITES_ENABLED'," + writable + ')'));
    configure(alpha, alphaConfig, false);
    const sessions = path.join(temp, 'alpha-sessions'); fs.mkdirSync(sessions);
    // Test fixture simulates an old password-only session; never part of deployment.
    write(path.join(alpha, 'old-session.php'), "<?php session_start(); $_SESSION=['logged_in_single'=>true,'role'=>'admin'];");
    const server = spawn(php, ['-d', 'opcache.enable=0', '-d', 'disable_functions=link', '-d', 'session.save_path=' + sessions,
        '-S', '127.0.0.1:' + port, '-t', alpha], { cwd: alpha, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const log = fs.createWriteStream(path.join(temp, 'alpha-http.log')); server.stdout.pipe(log); server.stderr.pipe(log);
    const admin = {};
    async function call(client, url, fields, form = false) {
        const headers = { Cookie: client.cookie || '', 'X-CSRF-Token': client.csrf || '' };
        if (fields) headers['Content-Type'] = form ? 'application/x-www-form-urlencoded' : 'application/json';
        const r = await fetch(alphaBase + url, { method: fields ? 'POST' : 'GET', headers, redirect: 'manual',
            body: fields ? (form ? new URLSearchParams(fields).toString() : JSON.stringify(fields)) : undefined,
            signal: AbortSignal.timeout(15000) });
        if (r.headers.get('set-cookie')) client.cookie = r.headers.get('set-cookie').split(';')[0];
        const buffer = Buffer.from(await r.arrayBuffer()), text = buffer.toString();
        return { status: r.status, text, buffer, json: () => JSON.parse(text) };
    }
    try {
        for (let i = 0; i < 50; i++) { try { await call({}, 'index.php'); break; } catch (_) { await new Promise(r => setTimeout(r, 100)); } }
        const old = {}; await call(old, 'old-session.php');
        check((await call(old, 'php/ajax/vz2.php')).status === 401 && (await call(old, 'admin.php')).status === 403,
            'alpha invalidates legacy shared-password admin session');
        const login = await call(admin, 'index.php', { submit_single: '1', heslo: 'admin-test' }, true);
        assert.equal(login.status, 302, login.text);
        const page = await call(admin, 'index.php?v=1');
        const alphaUi = JSON.parse(page.text.match(/window.VZ2=(.*?);/)[1]); admin.csrf = alphaUi.csrf;
        const betaPage = await request(clients.admin, 'index.php?v=2');
        const betaUi = JSON.parse(betaPage.text.match(/window.VZ2=(.*?);/)[1]);
        check(page.status === 200 && !page.text.includes('Původní zkušebna') && alphaUi.cachePrefix !== betaUi.cachePrefix,
            'alpha default and v=1 open VZ2 with a distinct cache namespace');
        const betaCatalog = (await request(clients.admin, 'php/ajax/vz2.php')).json();
        const alphaCatalog = (await call(admin, 'php/ajax/vz2.php')).json();
        check(JSON.stringify(alphaCatalog.collections) === JSON.stringify(betaCatalog.collections), 'alpha reads exactly the beta collections without copying data');
        const file = db("SELECT id,relative_path FROM vz2_audio_files WHERE state='available' LIMIT 1")[0];
        assert(file);
        const streamed = await call(admin, 'php/ajax/vz2_files.php?type=audio&id=' + file.id);
        check(streamed.status === 200 && streamed.buffer.equals(fs.readFileSync(path.join(media, file.relative_path))),
            'alpha serves identical bytes from shared physical storage');
        const preflight = (await call(admin, 'tools/vz2_preflight.php')).json();
        check(preflight.ok && preflight.details.environment === 'alpha' && !preflight.details.writes_enabled
            && preflight.details.available_files.count > 0 && preflight.details.site_url === alphaBase.slice(0, -1),
            'alpha read-only preflight validates schema, files and environment URL');
        const held = path.join(media, file.relative_path); fs.renameSync(held, held + '.held');
        try {
            const missing = await call(admin, 'tools/vz2_preflight.php');
            check(missing.status === 503 && missing.json().details.available_files.invalid_count === 1, 'handover preflight rejects missing available audio');
        } finally { fs.renameSync(held + '.held', held); }
        const completed = db("SELECT id FROM vz2_file_operations WHERE state='completed' LIMIT 1")[0];
        assert(completed); db("UPDATE vz2_file_operations SET state='failed' WHERE id=?", [completed.id]);
        try {
            const pending = await call(admin, 'tools/vz2_preflight.php');
            check(pending.status === 503 && pending.json().details.pending_operations.length === 1, 'handover preflight rejects unfinished file operations');
        } finally { db("UPDATE vz2_file_operations SET state='completed' WHERE id=?", [completed.id]); }
        const create = title => ({ action: 'collection_create', kind: 'song', title });
        check((await call(admin, 'php/ajax/vz2.php', create('Must not appear'))).status === 403, 'alpha cannot write before handover');
        const accountsPage = await call(admin, 'admin.php');
        check(accountsPage.status === 200 && accountsPage.text.includes('Server — obsah VZ2')
            && !accountsPage.text.includes('Úložiště kapely není dostupné') && !accountsPage.text.includes('Adresářový strom'),
            'VZ2-only administration reports VZ2 without a legacy user directory');
        const accountFields = { action: 'member', csrf: accountsPage.text.match(/name="csrf" value="([a-f0-9]+)"/)[1],
            id: '3', name: 'Bob Nový', role: 'muzikant', active: '1', password: '', password_confirmation: '' };
        check((await call(admin, 'admin.php', accountFields, true)).status === 403, 'read-only site rejects account mutations too');
        // Real switch: stop beta first, verify both read-only, then enable alpha.
        configure(web, betaConfig.replace('<?php', "<?php define('VZ2_ONLY',true);"), false);
        check((await request(clients.admin, 'php/ajax/vz2.php', create('Must not appear'))).status === 403, 'beta writes stop before alpha activation');
        configure(alpha, alphaConfig, true);
        const previousAccountLogs = db("SELECT id FROM vz2_activity_log WHERE target_type='user' AND target_id=3 AND environment='alpha'").length;
        check((await call(admin, 'admin.php', accountFields, true)).status === 303
            && db("SELECT id FROM vz2_activity_log WHERE target_type='user' AND target_id=3 AND environment='alpha'").length === previousAccountLogs + 1,
            'replacement site uses personal accounts and audits their changes as alpha');
        const created = await call(admin, 'php/ajax/vz2.php', create('Created on alpha'));
        assert(created.status < 300, created.text); const id = created.json().id;
        check(db("SELECT id FROM vz2_activity_log WHERE target_type='collection' AND target_id=? AND environment='alpha'", [id]).length === 1
            && (await request(clients.admin, 'php/ajax/vz2.php')).json().collections.some(c => Number(c.id) === id),
            'alpha writes shared data with alpha audit; read-only beta sees it immediately');
        const legacyEndpoints = ['php/ajax', 'php/actions'].flatMap(dir => fs.readdirSync(path.join(alpha, dir))
            .filter(name => name.endsWith('.php') && !name.startsWith('vz2'))
            .map(name => dir + '/' + name));
        for (const endpoint of legacyEndpoints) {
            check((await call(admin, endpoint, {})).status === 410 && (await request(clients.admin, endpoint, {})).status === 410,
                'VZ2-only blocks legacy writes on both sites: ' + endpoint);
        }
        db("UPDATE users SET role='muzikant' WHERE id=1");
        try { check((await call(admin, 'admin.php')).status === 403 && (await call(admin, 'tools/vz2_preflight.php')).status === 403,
            'alpha refreshes revoked admin role before administration and diagnostics'); }
        finally { db("UPDATE users SET role='admin' WHERE id=1"); }
        // Rollback transfers writer only; no database restore or storage copy.
        configure(alpha, alphaConfig, false);
        configure(web, betaConfig.replace('<?php', "<?php define('VZ2_ONLY',true);"), true);
        check((await call(admin, 'php/ajax/vz2.php', create('Must not appear'))).status === 403, 'rollback stops alpha writes');
        const rollback = await request(clients.admin, 'php/ajax/vz2.php', { action: 'collection_rename', id, revision: 1, title: 'Continued on beta' });
        check(rollback.status === 200 && db("SELECT title FROM vz2_collections WHERE id=?", [id])[0].title === 'Continued on beta'
            && db("SELECT id FROM vz2_activity_log WHERE target_type='collection' AND target_id=? AND environment='beta'", [id]).length === 1,
            'rollback beta edits alpha-created data and keeps both audit environments');
        if (process.env.VZ2_TEST_BROWSER === '1') {
            const { chromium } = require('playwright');
            const executablePath = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, chromium.executablePath(),
                'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && fs.existsSync(p));
            const browser = await chromium.launch({ headless: true, executablePath });
            const errors = [];
            try {
                for (const who of ['admin', 'bob', 'guest']) {
                    const context = await browser.newContext({ viewport: { width: who === 'guest' ? 390 : 1360, height: 900 } });
                    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
                    await page.route('https://**', r => r.abort());
                    await page.goto(base);
                    await page.locator('[name=heslo]').fill(who + '-test');
                    await page.locator('[name=submit_single]').click();
                    await page.locator('#collections button').first().waitFor({ state: 'attached' });
                    assert.equal(await page.getByText('Původní zkušebna', { exact: true }).count(), 0);
                    assert.equal(await page.locator('#create-collection').count(), who === 'guest' ? 0 : 1);
                    if (who === 'admin') {
                        await page.locator('.shell-menu > summary').click();
                        await page.getByRole('link', { name: 'Účty', exact: true }).click();
                        await page.getByRole('heading', { name: 'Server — obsah VZ2' }).waitFor();
                        await page.screenshot({ path: path.join(temp, 'stage5-accounts.png'), fullPage: true });
                        await page.getByRole('link', { name: '← Zpět do zkušebny', exact: true }).click();
                    }
                    await page.screenshot({ path: path.join(temp, 'stage5-' + who + '.png'), fullPage: true });
                    await page.locator('.shell-menu > summary').click();
                    await page.getByRole('button', { name: 'Odhlásit', exact: true }).click();
                    await page.locator('[name=heslo]').waitFor();
                    const response = await page.request.get(base + 'php/ajax/vz2.php');
                    assert.equal(response.status(), 401);
                    check(true, 'browser: VZ2-only root login, role controls and logout for ' + who);
                    await context.close();
                }
                check(errors.length === 0, 'browser: VZ2-only navigation and administration have no JavaScript errors');
            } finally { await browser.close(); }
        }
    } finally {
        write(path.join(web, 'config.php'), betaConfig);
        server.kill();
    }
};
