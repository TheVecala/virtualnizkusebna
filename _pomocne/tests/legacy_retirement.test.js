'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const removed = read('_pomocne/deploy/vz1-retirement/removed-files.txt').trim().split(/\r?\n/);
for (const file of removed) assert(!fs.existsSync(path.join(root, file)), 'Retired file survives: ' + file);
const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes:true }).flatMap(entry => {
    const name = dir + '/' + entry.name;
    return entry.isDirectory() ? (name === 'php/vendor' ? [] : walk(name)) : [name];
});
const runtime = ['index.php','admin.php','help.php',...walk('php'),...walk('js'),...walk('css')];
for (const file of runtime.filter(f => /\.(php|js|css)$/.test(f))) {
    const text = read(file);
    for (const old of removed) {
        // The removed root page shares its basename with the active php/ajax/vz2.php API.
        if (old === 'vz2.php') continue;
        assert(!text.includes(old), file + ' references retired path ' + old);
    }
    assert(!/VZ2_ONLY|jQuery|modal_multitrack|storage_refresh/.test(text), 'Legacy branch remains in ' + file);
}
for (const page of ['index.php','admin.php','help.php','php/loginbox4.php']) {
    for (const match of read(page).matchAll(/(?:src|href)="((?:js|css|meat)\/[^"?<]+)/g)) {
        assert(fs.existsSync(path.join(root, match[1])), page + ' missing asset: ' + match[1]);
    }
}
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'vz1-release-test-'));
const out = path.join(temp, 'bundle');
execFileSync(process.execPath, [path.join(root, '_pomocne/tools/vz2_release.js'), out], { cwd:root, windowsHide:true });
const manifest = JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));
assert.deepEqual(manifest.removed_files, removed);
assert(manifest.files.some(f => f.path === 'php/login/connect.php'));
assert(manifest.files.some(f => f.path === 'js/multitrack.js'));
assert(manifest.files.some(f => f.path === 'maintenance.html'));
for (const name of ['prehled.php', 'useky.php', 'config.theme.php']) {
    assert(manifest.files.some(f => f.path === name), 'Complete release omits root application file: ' + name);
}
assert.deepEqual(manifest.preserved_server_files, ['config.php', 'config.vz2.php']);
assert(!manifest.files.some(f => f.path === 'vz2.php'));
for (const file of manifest.files) {
    assert(!removed.includes(file.path));
    assert(!['config.php', 'config.vz2.php', '.gitignore', 'AGENTS.md'].includes(file.path));
    assert(!/^(user\/|_vz2_storage\/|_pomocne\/|\.codex-|tools\/)/.test(file.path));
    assert(fs.existsSync(path.join(out, '1_soubory', file.path)));
}
console.log(`PASS retirement: ${removed.length} absent paths; references and ${manifest.runtime_files} packaged files verified. Bundle: ${out}`);

// A private synthetic repository exercises new paths without modifying the user's tree.
const fixture = path.join(temp, 'source');
fs.mkdirSync(fixture);
const put = (name, content) => {
    const target = path.join(fixture, name);
    fs.mkdirSync(path.dirname(target), {recursive:true});
    fs.writeFileSync(target, content);
};
const fixtureGit = (...args) => execFileSync('git', args, {cwd:fixture, windowsHide:true, stdio:'pipe'});
for (const name of ['index.php','php/auth.php','php/loginbox4.php','php/ajax/vz2.php','js/multitrack.js',
    'nový přehled.php','novy-adresar/asset.webmanifest','.htaccess']) put(name, 'fixture: ' + name);
put('config.php', 'PRIVATE TEST CONFIGURATION');
put('config.vz2.php', 'PRIVATE TEST CONFIGURATION');
put('.gitignore', '/_pomocne/dist/\n');
put('_pomocne/AGENTS.md', 'Development instructions, not web content.');
put('_pomocne/tools/vz2_release.js', read('_pomocne/tools/vz2_release.js'));
put('_pomocne/deploy/vz1-retirement/removed-files.txt', read('_pomocne/deploy/vz1-retirement/removed-files.txt'));
put('_pomocne/deploy/current/README.cs.md', read('_pomocne/deploy/current/README.cs.md'));
fixtureGit('init', '--quiet');
fixtureGit('add', '--', '.');
fixtureGit('-c','user.name=Release test','-c','user.email=release-test@example.invalid','commit','--quiet','-m','Fixture');
const build = destination => execFileSync(process.execPath,
    [path.join(fixture, '_pomocne/tools/vz2_release.js'), destination], {cwd:fixture, windowsHide:true, stdio:'pipe'});
const synthetic = path.join(temp, 'synthetic-bundle');
build(synthetic);
const syntheticFiles = JSON.parse(fs.readFileSync(path.join(synthetic,'manifest.json'))).files.map(file => file.path);
assert.deepEqual(syntheticFiles.sort(), ['index.php','php/auth.php','php/loginbox4.php','php/ajax/vz2.php',
    'js/multitrack.js','nový přehled.php','novy-adresar/asset.webmanifest','.htaccess'].sort());
assert(!fs.existsSync(path.join(synthetic, '1_soubory/config.php')));
assert(!fs.existsSync(path.join(synthetic, '1_soubory/config.vz2.php')));
put('unreviewed.php', 'Unreviewed code');
assert.throws(() => build(path.join(temp,'untracked-bundle')), /Review and track new runtime files/);
fs.unlinkSync(path.join(fixture,'unreviewed.php'));
fs.unlinkSync(path.join(fixture,'nový přehled.php'));
assert.throws(() => build(path.join(temp,'missing-bundle')), /Tracked runtime file is missing/);
assert.throws(() => build(path.join(fixture,'dist','bundle')), /belong under _pomocne/);
console.log('PASS release: new directories, Unicode paths and webserver files included; private configuration, helper files, unreviewed/missing code and misplaced output guarded.');
