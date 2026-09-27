'use strict';
// Real PHP HTTP responses, isolated sessions, no application config or database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawn} = require('node:child_process');
const php = process.env.PHP_BIN;
assert(php, 'Set PHP_BIN');
const root = path.resolve(__dirname, '..', '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vz2-cookie-'));
fs.copyFileSync(path.join(root, 'php/inc/session.php'), path.join(temp, 'session.php'));
fs.writeFileSync(path.join(temp, 'index.php'), `<?php
// The test router simulates trusted webserver metadata, not a forwarded header.
$_SERVER['HTTPS'] = $_GET['https'] ?? 'off';
session_set_cookie_params(['lifetime'=>600,'path'=>'/','domain'=>'',
 'secure'=>isset($_GET['force_secure']),'samesite'=>$_GET['same_site']??'']);
require __DIR__.'/session.php';
app_session_start(); app_session_start();
$previous = session_id();
if (isset($_GET['rotate'])) session_regenerate_id(true);
$_SESSION['visits'] = ($_SESSION['visits'] ?? 0) + 1;
header('Content-Type: application/json');
echo json_encode(['id'=>session_id(),'previous'=>$previous,'visits'=>$_SESSION['visits'],
 'params'=>session_get_cookie_params()]);
`);
(async () => {
    const socket = require('node:net').createServer();
    await new Promise(r => socket.listen(0, '127.0.0.1', r));
    const port = socket.address().port;
    await new Promise(r => socket.close(r));
    const server = spawn(php, ['-d','session.save_path='+temp,'-d','display_errors=1',
        '-S','127.0.0.1:'+port,'-t',temp], {windowsHide:true, stdio:['ignore','pipe','pipe']});
    let log=''; server.stdout.on('data', b=>log+=b); server.stderr.on('data', b=>log+=b);
    const request = async (query='', headers={}) => {
        const r=await fetch('http://127.0.0.1:'+port+'/?'+query, {headers, signal:AbortSignal.timeout(5000)});
        assert.equal(r.status, 200);
        return {cookie:r.headers.get('set-cookie'), body:await r.json()};
    };
    try {
        for(let i=0;i<50;i++) {
            try { await request(); break; } catch(e) { if(i===49) throw e; await new Promise(r=>setTimeout(r,100)); }
        }
        const http = await request();
        assert.match(http.cookie, /; HttpOnly/i); assert.match(http.cookie, /; SameSite=Lax/i);
        assert.doesNotMatch(http.cookie, /; secure/i);
        assert.equal(http.body.params.lifetime, 600); assert.equal(http.body.params.domain,'');
        assert.match(http.cookie, /; Max-Age=600/i);
        console.log('PASS: local HTTP, HttpOnly/Lax, preserved lifetime and host-only scope');
        for(const https of ['on','1','ON']) {
            const r=await request('https='+https);
            assert.match(r.cookie, /; secure/i); assert.match(r.cookie, /; HttpOnly/i);
            assert.match(r.cookie, /; SameSite=Lax/i);
        }
        console.log('PASS: HTTPS cookie flags on actual PHP Set-Cookie headers');
        for(const https of ['','off','0','OFF']) {
            const r=await request('https='+https, {'X-Forwarded-Proto':'https','Forwarded':'proto=https'});
            assert.doesNotMatch(r.cookie, /; secure/i);
        }
        console.log('PASS: untrusted forwarding headers do not change transport detection');
        const explicit=await request('force_secure=1&same_site=Strict');
        assert.match(explicit.cookie, /; secure/i); assert.match(explicit.cookie, /; SameSite=Strict/i);
        console.log('PASS: existing Secure and SameSite=Strict settings retained');
        const cookie=http.cookie.split(';')[0];
        const resumed=await request('https=on', {Cookie:cookie});
        assert.equal(resumed.body.id,http.body.id); assert.equal(resumed.body.visits,2);
        assert.equal(resumed.body.params.secure,true); assert.equal(resumed.body.params.httponly,true);
        const rotated=await request('https=on&rotate=1', {Cookie:cookie});
        assert.notEqual(rotated.body.id,http.body.id); assert.equal(rotated.body.visits,3);
        assert.match(rotated.cookie,/; secure/i); assert.match(rotated.cookie,/; HttpOnly/i);
        const old=await request('https=on',{Cookie:cookie}); assert.equal(old.body.visits,1);
        console.log('PASS: existing session survives; rotation upgrades cookie and invalidates old session');
        assert.doesNotMatch(log, /PHP (Warning|Fatal|Notice)/);
        // All production session entry points must use the common policy.
        const scan=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?scan(path.join(dir,e.name)):[path.join(dir,e.name)]);
        for(const file of [...scan(path.join(root,'php')), ...['index.php','admin.php','vz2.php'].map(f=>path.join(root,f))]) {
            if(!file.endsWith('.php') || file===path.join(root,'php/inc/session.php'))continue;
            assert.doesNotMatch(fs.readFileSync(file,'utf8'), /(?<![\w])session_start\s*\(/, file+' bypasses session policy');
        }
        console.log('PASS: all application entry points use the shared policy');
    } finally { server.kill(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
