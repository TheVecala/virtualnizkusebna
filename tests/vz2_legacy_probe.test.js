'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const {spawn} = require('node:child_process');
const {prepare, readManifest} = require('../tools/vz2_storage_http_check');
const php = process.env.PHP_BIN;
assert(php, 'Set PHP_BIN');
let checks = 0;
function ok(condition, label) { assert(condition, label); console.log('OK '+(++checks)+': '+label); }
(async () => {
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vz2-legacy-probe-'));
    const pkg = prepare(path.join(temp, 'package'));
    const manifest = readManifest(path.join(pkg, 'manifest.json'));
    const app = path.join(pkg, 'public', 'zkusebna');
    for (const file of ['tools/vz2_storage_probe.php', 'tools/vz2_storage_probe_legacy.php', 'php/inc/vz2_file_io.php']) {
        fs.mkdirSync(path.dirname(path.join(app, file)), {recursive: true});
        fs.copyFileSync(path.join(__dirname, '..', file), path.join(app, file));
    }
    // Local fixture reproduces the session keys assigned by 6ef87325/loginbox4.php.
    // It is never packaged for hosting and contains no production configuration.
    fs.writeFileSync(path.join(app, 'fixture-login.php'), `<?php
session_start(); $_SESSION = [];
if (isset($_GET['role'])) { $_SESSION['role'] = $_GET['role']; }
if (($_GET['logged'] ?? '') === 'yes') { $_SESSION['logged_in_single'] = true; }
echo 'fixture';
`);
    const staging = path.join(pkg, 'public', '_vz2_storage', '.staging');
    const before = fs.readdirSync(staging);
    const portServer = net.createServer();
    await new Promise(resolve => portServer.listen(0, '127.0.0.1', resolve));
    const port = portServer.address().port;
    await new Promise(resolve => portServer.close(resolve));
    const server = spawn(php, ['-d', 'disable_functions=link', '-d', 'session.save_path='+temp,
        '-S', '127.0.0.1:'+port, '-t', app], {windowsHide: true, stdio: 'ignore'});
    const base = 'http://127.0.0.1:'+port;
    let spawnError;
    server.on('error', error => { spawnError = error; });
    try {
        let ready = false;
        for (let i=0; i<80; i++) {
            if (spawnError) throw spawnError;
            try { await fetch(base+'/fixture-login.php'); ready = true; break; } catch {}
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        assert(ready, 'PHP server started');
        const endpoint = base+'/tools/vz2_storage_probe_legacy.php';
        const login = async (role, logged='yes') => {
            const response = await fetch(base+'/fixture-login.php?role='+role+'&logged='+logged);
            return response.headers.get('set-cookie').split(';')[0];
        };
        ok((await fetch(endpoint)).status === 403, 'anonymous denied');
        for (const role of ['host', 'muzikant']) {
            const cookie = await login(role);
            ok((await fetch(endpoint, {headers: {Cookie: cookie}})).status === 403, role+' denied');
        }
        const roleOnly = await login('admin', 'no');
        ok((await fetch(endpoint, {headers: {Cookie: roleOnly}})).status === 403, 'admin role without login denied');
        const cookie = await login('admin');
        const response = await fetch(endpoint, {headers: {Cookie: cookie}});
        const html = await response.text();
        const token = html.match(/name="csrf" value="([a-f0-9]{64})"/);
        ok(response.status === 200 && token, 'legacy admin gets CSRF form without modern auth or config');
        const post = body => fetch(endpoint, {method: 'POST', headers: {
            Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded'}, body});
        for (const body of ['', 'csrf=wrong', 'csrf[]=bad']) {
            ok((await post(body)).status === 403, 'invalid CSRF denied: '+body);
        }
        ok(JSON.stringify(before) === JSON.stringify(fs.readdirSync(staging)), 'GET and rejected requests leave storage untouched');
        const otherCookie = await login('admin');
        ok((await fetch(endpoint, {method: 'POST', headers: {Cookie: otherCookie,
            'Content-Type': 'application/x-www-form-urlencoded'}, body: 'csrf='+token[1]})).status === 403,
            'token cannot be used in a different session');
        const success = await post('csrf='+token[1]);
        const successHtml = await success.text();
        ok(success.status === 200 && successHtml.includes(manifest.dataset)
            && successHtml.includes('&quot;exclusive_copy&quot;: true')
            && successHtml.includes('&quot;link_available&quot;: false')
            && successHtml.includes('&quot;flock&quot;: true'), 'legacy admin POST runs common probe with link disabled');
        ok(JSON.stringify(before) === JSON.stringify(fs.readdirSync(staging)), 'successful probe cleans its scratch files');
        fs.unlinkSync(path.join(pkg, 'public', '_vz2_storage', manifest.probes[0]));
        ok((await post('csrf='+token[1])).status === 422, 'missing shared probe fails clearly');
        console.log('PASS '+checks+' legacy diagnostic checks; fixtures at '+temp);
    } finally {
        if (server.exitCode === null) {
            const exited = new Promise(resolve => server.once('exit', resolve));
            server.kill();
            await exited;
        }
    }
})().catch(error => { console.error(error); process.exitCode=1; });
