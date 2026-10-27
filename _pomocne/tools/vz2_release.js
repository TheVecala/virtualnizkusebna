'use strict';
// All tracked application files outside _pomocne belong in the web root.
// Private server configuration is preserved separately, never exported.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const [destination, mode = 'full'] = process.argv.slice(2);
assert(destination && ['full', 'beta'].includes(mode), 'Use: node _pomocne/tools/vz2_release.js <new-directory> [full|beta]');
const out = path.resolve(destination);
assert(!fs.existsSync(out), 'Output directory must not exist.');
const relativeOut = path.relative(root, out);
const outsideRepo = path.isAbsolute(relativeOut) || relativeOut === '..' || relativeOut.startsWith('..' + path.sep);
assert(outsideRepo || relativeOut.startsWith('_pomocne' + path.sep),
    'Generated bundles inside the repository belong under _pomocne/dist/.');
const gitRaw = (...args) => execFileSync('git', args, { cwd: root, windowsHide: true, encoding: 'utf8' });
const git = (...args) => gitRaw(...args).trim();
const gitPaths = (...args) => gitRaw('ls-files', '-z', ...args).split('\0').filter(Boolean);
const serverConfiguration = ['config.php', 'config.vz2.php'];
const auxiliary = name => name === '.gitignore' || name === '.git' || name.startsWith('.git/')
    || name === '_pomocne' || name.startsWith('_pomocne/');
const runtime = name => !auxiliary(name) && !serverConfiguration.includes(name);
const removed = fs.readFileSync(path.join(root, '_pomocne/deploy/vz1-retirement/removed-files.txt'), 'utf8').trim().split(/\r?\n/);
assert.equal(new Set(removed).size, removed.length, 'Duplicate retirement path');
for (const name of removed) {
    assert(/^(php|js|css|fonts|meat|data)\/[a-zA-Z0-9_./() -]+$/.test(name) || ['multitrack.php','vz2.php'].includes(name), 'Invalid retirement path: ' + name);
    assert(!name.split('/').includes('..'), 'Unsafe retirement path');
    assert(!fs.existsSync(path.join(root,name)), 'Retired file is still present: ' + name);
}
const names = gitPaths().filter(runtime).sort();
const untracked = gitPaths('--others','--exclude-standard').filter(runtime);
assert(!untracked.length, 'Review and track new runtime files before packaging: ' + untracked.join(', '));
for (const name of ['index.php','php/auth.php','php/loginbox4.php','php/ajax/vz2.php','js/multitrack.js']) assert(names.includes(name), 'Missing runtime: ' + name);
const entries = names.map(name => {
    const absolute = path.join(root,name);
    assert(fs.existsSync(absolute), 'Tracked runtime file is missing; review and stage its deletion: ' + name);
    assert(fs.lstatSync(absolute).isFile(), 'Runtime must be a regular file: ' + name);
    const content = fs.readFileSync(absolute);
    return { path:name, content, bytes:content.length, sha256:crypto.createHash('sha256').update(content).digest('hex') };
});
fs.mkdirSync(out,{recursive:true});
for (const entry of entries) {
    const target=path.join(out,'1_soubory',entry.path);
    fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,entry.content);
}
fs.copyFileSync(path.join(root,'_pomocne/deploy/current/README.cs.md'),path.join(out,'README.cs.md'));
fs.writeFileSync(path.join(out,'removed-files.txt'),removed.join('\n')+'\n');
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({
    mode:'full', source_commit:git('rev-parse','HEAD'), working_tree_changes:git('status','--porcelain'),
    note:'Hashes identify working-tree content. Files outside _pomocne are included automatically, except Git metadata and preserved server configuration. removed-files.txt applies only to this installation.',
    preserved_server_files:serverConfiguration,
    runtime_files:entries.length, removed_files:removed,
    files:entries.map(({content,...entry})=>entry)
},null,2)+'\n');
console.log(JSON.stringify({directory:out,runtime_files:entries.length,removed_files:removed.length}));
