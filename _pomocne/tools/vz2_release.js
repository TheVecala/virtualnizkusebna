'use strict';
// Build a local FTP bundle. Never reads config.php, user data or credentials.
// node tools/vz2_release.js <new-output-directory> [beta|full|stage6|session]
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..', '..');
const [destination, mode = 'beta'] = process.argv.slice(2);
const baseline = mode === 'session' ? '7466cbdf5505fce3b9a1bcff0e2070334f11f2c0'
    : mode === 'stage6' ? '4de4c3e80e08dd238fc30142daa62941242f9534' : 'd8fd9722d4777b0cac7a413031215076792d30bc';
assert(destination && ['beta', 'full', 'stage6', 'session'].includes(mode), 'Use: node tools/vz2_release.js <new-directory> [beta|full|stage6|session]');
const out = path.resolve(destination);
assert(!fs.existsSync(out), 'Output directory must not exist; existing files are never replaced.');
const git = (...args) => execFileSync('git', args, { cwd: root, windowsHide: true, encoding: 'utf8' }).trim();
const runtime = name => /^(php|js|css|fonts|meat|data)\//.test(name)
    || ['index.php', 'vz2.php', 'admin.php', 'help.php', 'multitrack.php', '404.html', 'favicon.ico'].includes(name);
const tracked = git('ls-files').split(/\r?\n/).filter(runtime);
const untracked = git('ls-files', '--others', '--exclude-standard').split(/\r?\n/).filter(runtime);
// The session update explicitly includes this reviewed new helper before commit.
assert(untracked.every(name => mode === 'session' && name === 'php/inc/session.php'), 'Review and track new runtime files before packaging.');
const changed = new Set(git('diff', '--name-only', baseline, '--').split(/\r?\n/));
const names = [...tracked.filter(name => mode === 'full' || changed.has(name)), ...untracked].sort();
if (mode === 'stage6') assert.deepEqual(names, ['js/multitrack.js','js/vz2.js','vz2.php'], 'Review stage 6 runtime file set.');
else if (mode === 'session') {
    assert(names.length === 41 && names.includes('php/inc/session.php') && names.includes('php/ajax/vz2.php') && names.includes('index.php'), 'Incomplete session update.');
    assert(names.every(name => name.endsWith('.php')), 'Unexpected non-PHP session update.');
}
else assert(names.includes('index.php') && names.includes('php/auth.php'), 'Incomplete stage 5 release.');
const sources = names.map(name => [name, '1_soubory/' + name]);
if (mode === 'beta' || mode === 'full') sources.push(['_pomocne/tools/vz2_preflight.php', '2_docasna_kontrola/tools/vz2_preflight.php']);
const stage = mode === 'session' ? 'session' : mode === 'stage6' ? 'stage6' : 'stage5';
sources.push(['_pomocne/deploy/vz2-' + stage + '/README.cs.md', 'README.cs.md']);
sources.push(['_pomocne/docs/vz2/' + stage + '.md', 'STAV.cs.md']);
const entries = sources.map(([source, target]) => {
    const absolute = path.join(root, source);
    assert(fs.lstatSync(absolute).isFile(), 'Source must be a regular file: ' + source);
    const content = fs.readFileSync(absolute);
    return { source, path: target, content, bytes: content.length, sha256: crypto.createHash('sha256').update(content).digest('hex') };
});
fs.mkdirSync(out, { recursive: true });
for (const entry of entries) { const target = path.join(out, entry.path); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, entry.content); }
const manifest = { mode, baseline, source_commit: git('rev-parse', 'HEAD'), runtime_files: names.length,
    note: 'Hashes identify working-tree content, including changes not yet committed. No configuration, SQL or user data.',
    files: entries.map(({ content, ...entry }) => entry) };
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ directory: out, mode, runtime_files: names.length, files: entries.length + 1 }));
