'use strict';
// Real HTTP + PHP + MariaDB, in a private temporary copy. Never loads site config.
// PHP_BIN and VZ2_TEST_DB_PORT (dedicated localhost, not 3306) are mandatory.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const php = process.env.PHP_BIN;
const dbPort = Number(process.env.VZ2_TEST_DB_PORT);
assert(php && Number.isInteger(dbPort) && dbPort > 1024 && dbPort < 65536 && dbPort !== 3306, 'Set PHP_BIN and dedicated VZ2_TEST_DB_PORT');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vz2-integration-'));
const web = path.join(temp, 'web');
const media = path.join(temp, 'media');
const database = 'vz2_test_' + crypto.randomBytes(6).toString('hex');
fs.mkdirSync(web); fs.mkdirSync(media);
const write = (name, value) => { fs.mkdirSync(path.dirname(name), { recursive: true }); fs.writeFileSync(name, value); };
const phpString = value => "'" + String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
for (const dir of ['php', 'js', 'css', 'migrations', 'data', 'fonts', 'meat', 'tools']) fs.cpSync(path.join(root, dir), path.join(web, dir), { recursive: true });
for (const file of ['index.php', 'vz2.php', 'admin.php', 'help.php']) fs.copyFileSync(path.join(root, file), path.join(web, file));
write(path.join(media, '.vz2-storage-id'), database);
write(path.join(temp, 'db.php'), `<?php
if(PHP_SAPI!=='cli')exit;
mysqli_report(MYSQLI_REPORT_ERROR|MYSQLI_REPORT_STRICT);
$db=new mysqli('127.0.0.1','root',${phpString(process.env.VZ2_TEST_DB_PASS || '')},'',${dbPort});
$db->set_charset('utf8mb4');
$command=json_decode(stream_get_contents(STDIN),true,32,JSON_THROW_ON_ERROR);
if($command['action']==='init'){
 $db->query('CREATE DATABASE ${database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');$db->select_db('${database}');
 $db->query("SET SESSION sql_mode='NO_ENGINE_SUBSTITUTION,NO_ZERO_DATE'");
 foreach(['001_personal_accounts.sql','002_vz2.sql','003_vz2_discussion_body.sql'] as $file){$db->multi_query(file_get_contents(${phpString(path.join(web, 'migrations') + '/')}.$file));do{if($r=$db->store_result())$r->free();}while($db->more_results()&&$db->next_result());}
 foreach([['Admin','admin','admin-test'],['Alice','muzikant','alice-test'],['Bob','muzikant','bob-test']] as $u){$s=$db->prepare('INSERT INTO users(name,role,password_hash) VALUES (?,?,?)');$s->execute([$u[0],$u[1],password_hash($u[2],PASSWORD_DEFAULT)]);}
 $s=$db->prepare('UPDATE auth_settings SET guest_enabled=1,guest_password_hash=? WHERE id=1');$s->execute([password_hash('guest-test',PASSWORD_DEFAULT)]);
 echo json_encode(['version'=>$db->server_info,'mode'=>$db->query('SELECT @@SESSION.sql_mode')->fetch_row()[0]]);
}elseif($command['action']==='drop'){$db->query('DROP DATABASE ${database}');echo '{}';}
elseif($command['action']==='runtime_mode'){
 $defaultMode=$db->query('SELECT @@SESSION.sql_mode')->fetch_row()[0];
 require ${phpString(path.join(web, 'config.php'))};
 $connection=auth_db();
 $authMode=$connection->query('SELECT @@SESSION.sql_mode')->fetch_row()[0];
 $connection->query('CREATE TEMPORARY TABLE strict_probe (v VARCHAR(1)) ENGINE=InnoDB');
 $rejected=false;
 try{$connection->query("INSERT INTO strict_probe VALUES ('too long')");}catch(mysqli_sql_exception $e){if($e->getCode()!==1406)throw $e;$rejected=true;}
 require ${phpString(path.join(web, 'php/inc/vz2_core.php'))};
 echo json_encode(['defaultMode'=>$defaultMode,'authMode'=>$authMode,'vz2Mode'=>vz2_db()->query('SELECT @@SESSION.sql_mode')->fetch_row()[0],'rejected'=>$rejected,'sameConnection'=>$connection===vz2_db()]);
}
else{$db->select_db('${database}');$s=$db->prepare($command['sql']);$s->execute($command['params']??[]);$r=$s->get_result();echo json_encode($r?$r->fetch_all(MYSQLI_ASSOC):['affected'=>$s->affected_rows,'id'=>$db->insert_id]);}
`);
function db(sql, params = []) { return JSON.parse(execFileSync(php, [path.join(temp, 'db.php')], { input: JSON.stringify({ action: 'query', sql, params }), windowsHide: true, timeout: 15000 }).toString()); }
function dbAction(action) { return JSON.parse(execFileSync(php, [path.join(temp, 'db.php')], { input: JSON.stringify({ action }), windowsHide: true, timeout: 30000 }).toString()); }
let checks = 0;
function check(ok, label) { assert(ok, label); console.log('OK ' + (++checks) + ': ' + label); }
function wav(seconds = 1) {
    const n = 8000 * seconds, b = Buffer.alloc(44 + n * 2);
    b.write('RIFF'); b.writeUInt32LE(b.length - 8, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28);
    b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); return b;
}
(async () => {
    let server, created = false;
    const socket = require('node:net').createServer();
    await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
    const port = socket.address().port;
    await new Promise(resolve => socket.close(resolve));
    const base = 'http://127.0.0.1:' + port + '/';
    write(path.join(web, 'config.php'), `<?php
define('DB_HOST','127.0.0.1:${dbPort}');define('DB_USER','root');define('DB_PASS',${phpString(process.env.VZ2_TEST_DB_PASS || '')});define('DB_NAME','${database}');
define('SITE_URL','${base.slice(0, -1)}');define('MAIL_FROM','test@example.invalid');
define('VZ2_ENABLED',true);define('VZ2_WRITES_ENABLED',true);define('VZ2_ENVIRONMENT','beta');define('VZ2_DATASET_KEY','${database}');define('VZ2_STORAGE_ROOT',${phpString(media)});
define('VZ2_PUBLIC_ROOT',${phpString(web)});define('VZ2_STORAGE_ACCESS','private');
$GLOBALS['PRAVA']=['host'=>[],'muzikant'=>['edit_text','upload','comment','reorder','move_file','delete_file','create_val','rename_val','edit_recording_label'],'admin'=>['edit_text','upload','comment','reorder','move_file','delete_file','create_val','rename_val','delete_val','edit_recording_label']];
function ma_pravo(string $p):bool{return in_array($p,$GLOBALS['PRAVA'][$_SESSION['role']??'']??[],true);}
require_once __DIR__.'/php/auth.php';auth_refresh_session();
`);
    const clients = Object.fromEntries(['admin', 'alice', 'bob', 'guest', 'anon'].map(n => [n, {}]));
    async function request(client, url, fields, options = {}) {
        const headers = { Cookie: client.cookie || '', ...(options.headers || {}) };
        let body;
        if (fields instanceof FormData) body = fields;
        else if (fields) { body = options.form ? new URLSearchParams(fields).toString() : JSON.stringify(fields); headers['Content-Type'] = options.form ? 'application/x-www-form-urlencoded' : 'application/json'; }
        if (fields && !options.noCsrf) headers['X-CSRF-Token'] = client.csrf || '';
        const r = await fetch(base + url, { method: fields ? 'POST' : 'GET', body, headers, redirect: 'manual', signal: AbortSignal.timeout(15000) });
        if (r.headers.get('set-cookie')) client.cookie = r.headers.get('set-cookie').split(';')[0];
        const buffer = Buffer.from(await r.arrayBuffer()), text = buffer.toString();
        return { status: r.status, text, buffer, headers: r.headers, json: () => JSON.parse(text) };
    }
    async function login(name) {
        const c = clients[name];
        await request(c, 'index.php?v=2');
        const r = await request(c, 'index.php?v=2', { submit_single: '1', heslo: name + '-test' }, { form: true });
        assert.equal(r.status, 302, r.text);
        const page = await request(c, 'index.php?v=2');
        assert.equal(page.status, 200, page.text);
        c.csrf = JSON.parse(page.text.match(/window.VZ2=(.*?);/)[1]).csrf;
    }
    const api = (who, fields, options) => request(clients[who], 'php/ajax/vz2.php', fields, options);
    async function good(who, fields) { const r = await api(who, fields); assert(r.status < 300, r.text); return r.json(); }
    const catalog = who => good(who);
    async function upload(who, collection, title, kind = 'single', names = ['take.wav'], bodies = [wav()], requestKey = crypto.randomBytes(16).toString('hex')) {
        const form = new FormData(); Object.entries({ action: 'upload', collection_id: collection, title, kind, file_count: names.length, request_key: requestKey }).forEach(([k, v]) => form.append(k, String(v)));
        names.forEach((n, i) => form.append('files[]', new Blob([bodies[i]]), n));
        return api(who, form);
    }
    try {
        console.log('TEMP ' + temp);
        const init = dbAction('init'); created = true; console.log('MariaDB ' + init.version);
        check(db("SHOW TABLES LIKE 'vz2_%'").length === 13, 'migration creates 13 tables');
        const requiredModes = ['STRICT_TRANS_TABLES','ERROR_FOR_DIVISION_BY_ZERO','NO_ENGINE_SUBSTITUTION'];
        const hasRequiredModes = mode => requiredModes.every(m => mode.split(',').includes(m));
        check(hasRequiredModes(init.mode) && init.mode.split(',').includes('NO_ZERO_DATE'), 'migration enables strict mode from a non-strict session and preserves additional modes');
        const runtimeMode = dbAction('runtime_mode');
        if (process.env.VZ2_TEST_EXPECT_NONSTRICT_DEFAULT === '1') check(!runtimeMode.defaultMode.includes('STRICT_'), 'test server reproduces non-strict hosting default');
        check(hasRequiredModes(runtimeMode.authMode) && hasRequiredModes(runtimeMode.vz2Mode) && runtimeMode.sameConnection, 'login, admin and VZ2 share a configured strict connection');
        check(runtimeMode.rejected, 'application connection rejects silent VARCHAR truncation');
        const preflight = execFileSync(php, [path.join(web, 'tools', 'vz2_preflight.php')], {windowsHide:true}).toString();
        check(preflight.includes('13 VZ2 tables') && !preflight.includes('FAIL'), 'read-only preflight succeeds against isolated configuration');
        // This fixture changes config between requests to test read-only deployment.
        server = spawn(php, ['-d', 'opcache.enable=0', '-d', 'disable_functions=link', '-d', 'session.save_path=' + temp, '-d', 'upload_max_filesize=8M', '-d', 'post_max_size=32M', '-S', '127.0.0.1:' + port, '-t', web], { cwd: web, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        const log = fs.createWriteStream(path.join(temp, 'http.log')); server.stdout.pipe(log); server.stderr.pipe(log);
        for (let i = 0; i < 50; i++) { try { await request(clients.anon, 'index.php?v=2'); break; } catch (_) { await new Promise(r => setTimeout(r, 100)); } }
        for (const name of ['admin', 'alice', 'bob', 'guest']) await login(name);
        for (const who of ['anon','guest','alice']) {
            const denied = await request(clients[who], 'tools/vz2_preflight.php');
            check(denied.status===403 && !denied.text.includes(database) && !denied.text.includes(media), 'browser preflight denies '+who+' without diagnostic details');
        }
        check((await request(clients.admin,'tools/vz2_preflight.php',{})).status===405, 'browser preflight accepts only read-only GET');
        const configBeforePreflight = fs.readFileSync(path.join(web,'config.php'),'utf8');
        write(path.join(web,'config.php'), configBeforePreflight.replace("define('VZ2_WRITES_ENABLED',true)","define('VZ2_WRITES_ENABLED',false)"));
        try {
            const browserCheck = await request(clients.admin,'tools/vz2_preflight.php');
            const report = browserCheck.json();
            assert.equal(browserCheck.status,200,browserCheck.text);
            assert.equal(report.details.writes_enabled,false,browserCheck.text);
            check(browserCheck.status===200 && report.ok && report.details.database===database
                && report.details.tables.length===13 && report.details.writes_enabled===false
                && hasRequiredModes(report.details.session_sql_mode), 'admin browser preflight checks real strict connection and storage with writes disabled');
            check((await api('admin',{action:'collection_create',kind:'song',title:'Read only'})).status===403
                && db('SELECT id FROM vz2_collections').length===0 && db('SELECT id FROM vz2_activity_log').length===0,
                'read-only deployment rejects writes and diagnostics leave content/audit untouched');
            check((await request(clients.admin,'php/ajax/vz2_timestamps.php',{action:'create',recording_id:1,timestamps_revision:1,kind:'note',time_ms:0,body:'Read only'})).status===403,
                'timestamp endpoint obeys read-only deployment switch');
            check((await request(clients.admin,'php/ajax/vz2_content.php',{action:'document_save',collection_id:1,kind:'lyrics_chords',current_revision:0,title:'Text',body:'Read only'})).status===403
                && (await request(clients.admin,'php/ajax/vz2_content.php',{action:'post_create',thread_id:1,body:'Read only'})).status===403,'documents and discussion obey read-only deployment switch');
            const readOnlyConfig = fs.readFileSync(path.join(web,'config.php'),'utf8');
            const withoutEnabled = readOnlyConfig.replace("define('VZ2_ENABLED',true);",'');
            const optionalConfig = path.join(web,'config.vz2.php');
            try {
                write(path.join(web,'config.php'),withoutEnabled);
                const missingConfig = await request(clients.admin,'tools/vz2_preflight.php');
                check(missingConfig.status===503 && !missingConfig.json().details.configuration.config_vz2_exists
                    && !missingConfig.json().details.configuration.enabled_defined,
                    'disabled preflight diagnoses an absent config without discarding details');
                write(optionalConfig,"<?php define('VZ2_ENABLED',true);");
                const unloadedConfig = await request(clients.admin,'tools/vz2_preflight.php');
                check(unloadedConfig.status===503 && unloadedConfig.json().details.configuration.config_vz2_exists
                    && !unloadedConfig.json().details.configuration.config_vz2_loaded
                    && !unloadedConfig.json().details.configuration.enabled_defined,
                    'preflight distinguishes an uploaded config from one loaded by the app and does not load it itself');
                write(path.join(web,'config.php'),withoutEnabled.replace('<?php',"<?php require_once __DIR__.'/config.vz2.php';"));
                const loadedConfig = await request(clients.admin,'tools/vz2_preflight.php');
                check(loadedConfig.status===200 && loadedConfig.json().details.configuration.config_vz2_loaded
                    && loadedConfig.json().details.configuration.enabled
                    && hasRequiredModes(loadedConfig.json().details.session_sql_mode),
                    'loading optional config before auth enables real application strict connection');
                write(optionalConfig,"<?php define('VZ2_ENABLED',false);");
                const falseConfig = await request(clients.admin,'tools/vz2_preflight.php');
                check(falseConfig.status===503 && falseConfig.json().details.configuration.config_vz2_loaded
                    && falseConfig.json().details.configuration.enabled_defined
                    && falseConfig.json().details.configuration.enabled_type==='boolean'
                    && !falseConfig.json().details.configuration.enabled,
                    'preflight distinguishes a loaded config with explicitly disabled VZ2');
            } finally {
                write(path.join(web,'config.php'),readOnlyConfig);
                if (fs.existsSync(optionalConfig)) fs.unlinkSync(optionalConfig);
            }
            db('RENAME TABLE vz2_activity_log TO vz2_unexpected_log');
            try {
                const wrongTables = await request(clients.admin,'tools/vz2_preflight.php');
                check(wrongTables.status===503 && wrongTables.json().ok===false
                    && wrongTables.json().checks.some(c=>!c.ok && c.label.includes('exact names')),
                    'preflight rejects wrong table names even when count is still 13');
            } finally { db('RENAME TABLE vz2_unexpected_log TO vz2_activity_log'); }
            db("DELETE FROM vz2_collection_orders WHERE kind='rehearsal'");
            try {
                const noSeed = await request(clients.admin,'tools/vz2_preflight.php');
                check(noSeed.status===503 && noSeed.json().checks.some(c=>!c.ok && c.label==='Collection order seed'), 'preflight rejects missing order seed');
            } finally { db("INSERT INTO vz2_collection_orders(kind) VALUES ('rehearsal')"); }
            write(path.join(media,'.vz2-storage-id'),'wrong-dataset');
            try {
                const badMarker = await request(clients.admin,'tools/vz2_preflight.php');
                check(badMarker.status===503 && badMarker.json().ok===false, 'preflight rejects mismatched storage dataset');
            } finally { write(path.join(media,'.vz2-storage-id'),database); }
            db("UPDATE users SET role='muzikant' WHERE id=1");
            try {
                check((await request(clients.admin,'tools/vz2_preflight.php')).status===403, 'preflight refreshes an admin role revoked in SQL');
            } finally { db("UPDATE users SET role='admin' WHERE id=1"); }
        } finally { write(path.join(web,'config.php'),configBeforePreflight); }
        const probePackage = require('../tools/vz2_storage_http_check').prepare(path.join(temp,'probe-package'));
        fs.cpSync(path.join(probePackage,'public','_vz2_storage'),path.join(temp,'_vz2_storage'),{recursive:true});
        check((await request(clients.anon,'tools/vz2_storage_probe.php')).status===403 && (await request(clients.guest,'tools/vz2_storage_probe.php')).status===403, 'temporary filesystem probe requires current admin identity');
        check((await request(clients.admin,'tools/vz2_storage_probe.php',{csrf:'invalid'},{form:true})).status===422, 'temporary filesystem probe requires CSRF for scratch writes');
        const fsProbe=await request(clients.admin,'tools/vz2_storage_probe.php',{csrf:clients.admin.csrf},{form:true});
        check(fsProbe.status===200 && fsProbe.text.includes('Kontrola souborů prošla'), 'admin can run pre-migration filesystem checks through the browser endpoint');
        check((await api('anon')).status === 401, 'anonymous API denied');
        check((await api('guest', { action: 'collection_create', kind: 'song', title: 'Denied' })).status === 403, 'guest write denied');
        check((await api('alice', { action: 'collection_create', kind: 'song', title: 'Denied' }, { noCsrf: true })).status === 403, 'CSRF required');
        const a = await good('alice', { action: 'collection_create', kind: 'song', title: 'První skladba' });
        const b = await good('bob', { action: 'collection_create', kind: 'rehearsal', title: 'Zkouška B' });
        check(!fs.existsSync(path.join(media, 'skladby')), 'collection without audio creates no folder');
        check((await catalog('guest')).collections.length === 2, 'guest can read both empty collections');
        check((await api('guest', {action:'logout'})).status === 200 && (await api('guest')).status === 401, 'guest logout invalidates API session');
        await login('guest');
        check((await api('bob', { action: 'collection_rename', id: a.id, revision: 1, title: 'Cizí' })).status === 403, 'direct HTTP foreign rename denied');
        await good('admin', { action: 'collection_rename', id: a.id, revision: 1, title: 'Nový název' });
        let c = (await catalog('alice')).collections.find(x => Number(x.id) === a.id);
        check(Number(c.created_by) === 2 && Number(c.updated_by) === 1, 'admin edit preserves original author');
        check((await api('alice', { action: 'collection_rename', id: a.id, revision: 1, title: 'Stale' })).status === 409, 'stale revision conflicts');
        const uploadKey = crypto.randomBytes(16).toString('hex');
        let result = await upload('alice', b.id, 'Moje nahrávka', 'single', ['same.wav'], [wav()], uploadKey);
        assert.equal(result.status, 201, result.text); const rId = result.json().id;
        result = await upload('alice', b.id, 'Moje nahrávka', 'single', ['same.wav'], [wav()], uploadKey);
        check(result.status === 201 && result.json().id === rId, 'idempotent upload returns the same recording');
        check((await upload('alice', b.id, 'Moje nahrávka', 'single', ['same.wav'], [wav(2)], uploadKey)).status === 409, 'same upload key rejects changed file content');
        let r = (await catalog('alice')).recordings.find(x => Number(x.id) === rId);
        check(r.duration_ms === 1000 && Number(r.created_by) === 2 && r.kind === 'single', 'upload into foreign collection records verified duration and author');
        const fId = r.files[0].id, originalPath = db('SELECT relative_path FROM vz2_audio_files WHERE id=?', [fId])[0].relative_path;
        const range = await request(clients.alice, r.files[0].url, undefined, { headers: { Range: 'bytes=0-3' } });
        check(range.status === 206 && range.text === 'RIFF' && range.headers.get('content-range').startsWith('bytes 0-3/'), 'authorized Range streaming');
        check((await request(clients.anon, r.files[0].url)).status === 401, 'file endpoint requires current login');
        check((await api('bob', { action: 'recording_update', id: rId, revision: r.revision, title: 'Cizí', summary: '' })).status === 403, 'collection ownership does not own child recording');
        await good('alice', { action: 'recording_update', id: rId, revision: r.revision, title: 'Přejmenováno', summary: 'Zápis zůstane' });
        r = (await catalog('alice')).recordings.find(x => Number(x.id) === rId);
        await good('alice', { action: 'recording_move', id: rId, revision: r.revision, collection_id: a.id });
        check(db('SELECT relative_path FROM vz2_audio_files WHERE id=?', [fId])[0].relative_path === originalPath, 'rename and move preserve physical path and file identity');
        result = await upload('alice', a.id, 'Jednostopý mix', 'multitrack', ['same.wav'], [wav(2)]);
        assert.equal(result.status, 201, result.text); const mixId = result.json().id;
        check((await catalog('alice')).recordings.find(x => Number(x.id) === mixId).kind === 'multitrack', 'one-track mixer retains explicit kind');
        const mixer = await request(clients.alice, 'php/ajax/vz2.php?action=mixer&id=' + mixId);
        check(mixer.status === 200 && mixer.json().multitrack.tracks[0].fileId > 0, 'mixer reads the SQL catalog');
        result = await upload('alice', a.id, 'Špatná sada', 'multitrack', ['bad.wav'], [Buffer.from('not wave')]);
        check(result.status === 422, 'invalid audio signature rejected');
        result = await upload('alice', a.id, 'Textová příloha', 'attachment', ['notes.txt'], [Buffer.from('Ahoj, zkouška')]);
        assert.equal(result.status, 201, result.text); const attachmentId = result.json().id;
        check((await catalog('alice')).attachments.some(x => Number(x.id) === attachmentId), 'non-audio attachment stays outside recordings');
        let order = (await catalog('alice')).collections.find(x => Number(x.id) === a.id).recordings_revision;
        check((await api('alice', { action: 'reorder', scope: 'recordings', collection_id: a.id, revision: order, ids: [rId, rId] })).status === 409, 'reorder rejects duplicate or foreign IDs');
        await good('bob', { action: 'reorder', scope: 'recordings', collection_id: a.id, revision: order, ids: [mixId, rId] });
        check((await api('alice', { action: 'reorder', scope: 'recordings', collection_id: a.id, revision: order, ids: [rId, mixId] })).status === 409, 'shared reorder permits member but detects conflicts');
        db("INSERT INTO vz2_timestamps(recording_id,kind,time_ms,body,created_by,updated_by,created_at,updated_at) VALUES (?,'note',100,'Zachovat zápis',2,2,UTC_TIMESTAMP(),UTC_TIMESTAMP())", [rId]);
        r = (await catalog('alice')).recordings.find(x => Number(x.id) === rId);
        check((await api('bob', { action: 'remove_audio', id: rId, revision: r.revision, confirm: r.title, request_key: crypto.randomBytes(16).toString('hex') })).status === 403, 'foreign audio deletion denied');
        await good('alice', { action: 'remove_audio', id: rId, revision: r.revision, confirm: r.title, request_key: crypto.randomBytes(16).toString('hex') });
        r = (await catalog('alice')).recordings.find(x => Number(x.id) === rId);
        check(r.audio_state === 'deleted' && r.duration_ms === 1000 && r.timestamps.length === 1 && r.summary === 'Zápis zůstane', 'audio removal preserves recording, duration, summary and timestamps');
        check(!fs.existsSync(path.join(media, originalPath)) && Number(r.files[0].deleted_by) === 2 && r.files[0].deleted_at, 'physical removal and deletion authorship');
        check((await request(clients.alice, 'php/ajax/vz2_files.php?type=audio&id=' + fId)).status === 410, 'removed file cannot play');
        check((await api('alice', { action: 'delete_recording', id: rId, revision: r.revision, confirm: r.title, request_key: crypto.randomBytes(16).toString('hex') })).status === 403, 'full deletion admin only');
        await good('admin', { action: 'delete_recording', id: rId, revision: r.revision, confirm: r.title, request_key: crypto.randomBytes(16).toString('hex') });
        check(db('SELECT id FROM vz2_recordings WHERE id=?', [rId]).length === 0 && db("SELECT id FROM vz2_activity_log WHERE target_type='recording' AND target_id=?", [rId]).length > 0, 'full deletion retains readable activity log');
        let mix = (await catalog('alice')).recordings.find(x => Number(x.id) === mixId);
        const mixPath = db('SELECT relative_path FROM vz2_audio_files WHERE recording_id=?', [mixId])[0].relative_path;
        fs.renameSync(path.join(media, mixPath), path.join(media, mixPath + '.held'));
        check((await catalog('alice')).recordings.find(x => Number(x.id) === mixId).audio_state === 'missing', 'unexpected missing audio distinguished');
        fs.mkdirSync(path.join(media, mixPath));
        result = await api('alice', { action: 'remove_audio', id: mixId, revision: mix.revision, confirm: mix.title, request_key: crypto.randomBytes(16).toString('hex') });
        check(result.status === 409, 'partial filesystem failure is reported, not false success');
        const op = (await catalog('alice')).operations.find(x => Number(x.target_id) === mixId);
        fs.rmdirSync(path.join(media, mixPath)); fs.renameSync(path.join(media, mixPath + '.held'), path.join(media, mixPath));
        await good('alice', { action: 'retry', operation_id: Number(op.id) });
        await good('alice', { action: 'retry', operation_id: Number(op.id) });
        check(db("SELECT id FROM vz2_activity_log WHERE operation_id=? AND action='audio.removed'", [op.id]).length === 1, 'recovery is idempotent and logs each successful removal once');
        const logResponse = await request(clients.admin, 'php/ajax/vz2.php?action=log');
        check(logResponse.status === 200 && !logResponse.text.includes('password_hash') && (await request(clients.alice, 'php/ajax/vz2.php?action=log')).status === 403, 'activity log restricted and sanitized');
        let adminPage = await request(clients.admin, 'admin.php');
        let adminToken = adminPage.text.match(/name="csrf" value="([a-f0-9]+)"/)[1];
        let account = await request(clients.admin, 'admin.php', {action:'member',csrf:adminToken,id:'3',name:'Bob Nový',role:'muzikant',active:'1',password:'',password_confirmation:''}, {form:true});
        check(account.status===303 && db("SELECT * FROM vz2_activity_log WHERE target_type='user' AND target_id=3").length===1, 'account administration and audit commit together');
        await require('./vz2_timestamps.integration')({ request, clients, db, good, upload, check, login });
        await require('./vz2_content.integration')({ request, clients, db, good, check, login });
        const marker=path.join(media,'.vz2-storage-id');fs.renameSync(marker,marker+'.held');
        check((await catalog('admin').then(()=>false,()=>true)), 'missing dataset marker stops catalog filesystem access');
        fs.renameSync(marker+'.held',marker);
        db('UPDATE users SET active=0 WHERE id=2');
        check((await api('alice')).status === 401, 'deactivation invalidates existing AJAX session');
        // Deletion also handles the document/current-version foreign-key cycle.
        db('INSERT INTO vz2_documents(collection_id,kind,title,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())', [b.id,'lyrics_chords','Text',3,3]);
        const documentId = db('SELECT id FROM vz2_documents')[0].id;
        db('INSERT INTO vz2_document_versions(document_id,revision,body,created_by,created_at) VALUES (?,1,?,3,UTC_TIMESTAMP())', [documentId,'Verze 1']);
        db('UPDATE vz2_documents SET current_revision=1 WHERE id=?', [documentId]);
        c = (await catalog('admin')).collections.find(x => Number(x.id) === b.id);
        await good('admin', { action:'delete_collection',id:b.id,revision:c.revision,confirm:c.title,request_key:crypto.randomBytes(16).toString('hex') });
        check(db('SELECT * FROM vz2_document_versions WHERE document_id=?',[documentId]).length===0 && db("SELECT * FROM vz2_discussion_threads WHERE global_key='ideas'").length===1, 'explicit collection deletion handles document cycle and preserves global ideas');
        result = await upload('admin', a.id, 'Neúplná sada', 'multitrack', ['left.wav','right.wav'], [wav(),wav(2)]);
        assert.equal(result.status,201,result.text); const partialId = result.json().id;
        const partialFile = db('SELECT relative_path FROM vz2_audio_files WHERE recording_id=? ORDER BY id',[partialId])[0].relative_path;
        fs.renameSync(path.join(media,partialFile),path.join(media,partialFile+'.held'));
        const partialMixer = (await request(clients.admin,'php/ajax/vz2.php?action=mixer&id='+partialId)).json().multitrack;
        check(partialMixer.tracks.length===2 && partialMixer.audioUnavailable===true && !partialMixer.audioDeleted, 'missing track stays in mixer identity and prevents falsely complete playback');
        fs.renameSync(path.join(media,partialFile+'.held'),path.join(media,partialFile));
        if (process.env.VZ2_TEST_BROWSER === '1') await require('./vz2_timestamps.browser')({ base, clients, good, upload, wav, request, db, media, check, temp });
        if (process.env.VZ2_TEST_BROWSER === '1') await require('./vz2_content.browser')({ base, clients, good, request, db, check, temp, upload, wav });
        console.log('PASS ' + checks + ' checks; isolated HTTP URL ' + base);
        if (process.env.VZ2_TEST_KEEP === '1') {
            await upload('admin',a.id,'Zkouška — pracovní nahrávka','single',['kytara.wav'],[wav(10)]);
            await upload('admin',a.id,'Zkouška — vícestopá nahrávka','multitrack',['basa.wav','bici.wav'],[wav(10),wav(10)]);
            console.log('KEEP: test server and private DB retained for browser verification; stop via Ctrl+C.');
            await new Promise(resolve => process.on('SIGINT', resolve));
        }
    } finally {
        if (server) server.kill();
        if (created) dbAction('drop');
        console.log('Diagnostics retained at ' + temp);
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
