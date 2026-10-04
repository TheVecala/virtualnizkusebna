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
const runtime = ['index.php','vz2.php','admin.php','help.php',...walk('php'),...walk('js'),...walk('css')];
for (const file of runtime.filter(f => /\.(php|js|css)$/.test(f))) {
    const text = read(file);
    for (const old of removed) assert(!text.includes(old), file + ' references retired path ' + old);
    assert(!/VZ2_ONLY|jQuery|modal_multitrack|storage_refresh/.test(text), 'Legacy branch remains in ' + file);
}
for (const page of ['vz2.php','admin.php','help.php','php/loginbox4.php']) {
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
for (const file of manifest.files) {
    assert(!removed.includes(file.path));
    assert(!/^(config|user\/|_vz2_storage\/|_pomocne\/|tools\/)/.test(file.path));
    assert(fs.existsSync(path.join(out, '1_soubory', file.path)));
}
console.log(`PASS retirement: ${removed.length} absent paths; references and ${manifest.runtime_files} packaged files verified. Bundle: ${out}`);
