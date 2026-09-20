'use strict';
// Build a local FTP bundle. Never reads config.php, user data or credentials.
// node tools/vz2_release.js <new-output-directory> [beta|full]
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const baseline = 'd8fd9722d4777b0cac7a413031215076792d30bc';
const [destination, mode = 'beta'] = process.argv.slice(2);
assert(destination && ['beta', 'full'].includes(mode), 'Use: node tools/vz2_release.js <new-directory> [beta|full]');
const out = path.resolve(destination);
assert(!fs.existsSync(out), 'Output directory must not exist; existing files are never replaced.');
const git = (...args) => execFileSync('git', args, { cwd: root, windowsHide: true, encoding: 'utf8' }).trim();
const runtime = name => /^(php|js|css|fonts|meat|data)\//.test(name)
    || ['index.php', 'vz2.php', 'admin.php', 'help.php', 'multitrack.php', '404.html', 'favicon.ico'].includes(name);
const tracked = git('ls-files').split(/\r?\n/).filter(runtime);
assert(!git('ls-files', '--others', '--exclude-standard').split(/\r?\n/).some(runtime), 'Review and track new runtime files before packaging.');
const changed = new Set(git('diff', '--name-only', baseline, '--').split(/\r?\n/));
const names = tracked.filter(name => mode === 'full' || changed.has(name)).sort();
assert(names.includes('index.php') && names.includes('php/auth.php'), 'Incomplete stage 5 release.');
const sources = names.map(name => [name, '1_soubory/' + name]);
sources.push(['tools/vz2_preflight.php', '2_docasna_kontrola/tools/vz2_preflight.php']);
sources.push(['deploy/vz2-stage5/README.cs.md', 'README.cs.md']);
sources.push(['docs/vz2/stage5.md', 'STAV.cs.md']);
const entries = sources.map(([source, target]) => {
    const absolute = path.join(root, source);
    assert(fs.lstatSync(absolute).isFile(), 'Source must be a regular file: ' + source);
    const content = fs.readFileSync(absolute);
    return { source, path: target, content, bytes: content.length, sha256: crypto.createHash('sha256').update(content).digest('hex') };
});
fs.mkdirSync(out);
for (const entry of entries) { const target = path.join(out, entry.path); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, entry.content); }
const manifest = { mode, baseline, source_commit: git('rev-parse', 'HEAD'), runtime_files: names.length,
    note: 'Hashes identify working-tree content, including changes not yet committed. No configuration, SQL or user data.',
    files: entries.map(({ content, ...entry }) => entry) };
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ directory: out, mode, runtime_files: names.length, files: entries.length + 1 }));
