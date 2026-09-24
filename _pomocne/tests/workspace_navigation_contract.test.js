'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');

const page = fs.readFileSync(path.join(root, 'index.php'), 'utf8');
const client = fs.readFileSync(path.join(root, 'js/workspace.js'), 'utf8');
const context = fs.readFileSync(path.join(root, 'php/inc/content_context.php'), 'utf8');
const selection = fs.readFileSync(path.join(root, 'php/ajax/ulozit_pracovni_polozku.php'), 'utf8');

for (const mode of ['skladby', 'zkousky', 'multitrack']) {
    assert.match(page, new RegExp(`data-workspace-mode="${mode}"`));
    assert.match(client, new RegExp(`${mode}:`));
}
assert.match(page, /id="workspace-mode-mobile"/);
assert.match(page, /<span id="topbar-val">/);
assert.doesNotMatch(page, /id="topbar-val"[^>]+onclick=/);
assert.match(page, />Správa offline souborů</);
assert.doesNotMatch(page, />smazat offline soubory</i);
assert.match(client, /if \(open === active\) return;/, 'Aktivní režim nesmí znovu přepínat workspace.');
assert.match(client, /looperZavrit/);
assert.match(client, /MultitrackApp\.pause\(\)/);
assert.match(client, /sessionStorage\.setItem\(stateKey\(mode\)/);
assert.match(context, /content_last_items/);
assert.match(selection, /last_multitrack_id/);
assert.match(selection, /multitrack_require_id/);
assert.match(selection, /multitrack_list\(\)/);

console.log('Workspace navigation contract: OK');
