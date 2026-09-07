'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'multitrack.php'), 'utf8');
const client = fs.readFileSync(path.join(root, 'js', 'multitrack.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'css', 'multitrack.css'), 'utf8');
const upload = fs.readFileSync(path.join(root, 'php', 'actions', 'upload_multitrack.php'), 'utf8');
const serverHelpers = fs.readFileSync(path.join(root, 'php', 'inc', 'multitracky.php'), 'utf8');

const requestedIds = Array.from(client.matchAll(/byId\('([^']+)'\)/g), match => match[1]);
const missingIds = requestedIds.filter(id => !page.includes(`id="${id}"`) && !page.includes(`id='${id}'`));
assert.deepEqual(missingIds, [], `HTML postrádá ID používaná klientem: ${missingIds.join(', ')}`);

[
    '.mt-status-row',
    '.mt-status-name',
    '.mt-status-value',
    '.mt-channel-buttons',
    '.mt-channel-button',
    '.mt-fader',
    '.is-solo-muted'
].forEach(selector => {
    assert.ok(styles.includes(selector), `CSS postrádá dynamický selektor ${selector}`);
});

assert.match(page, /detailUrl[^\n]+multitracky\.php\?id=\{id\}/);
assert.match(
    page,
    /<form id="mt-upload-form" action="php\/actions\/upload_multitrack\.php" method="post"\s+enctype="multipart\/form-data"/,
    'Upload form must remain a valid multipart POST even without JavaScript'
);
assert.match(client, /searchParams\.set\('id', item\.id\)/);
assert.match(client, /formData\.append\('track_count', String\(files\.length\)\)/);
assert.match(upload, /\$_POST\['track_count'\]/);
assert.match(upload, /count\(\$uploads\) !== \$expectedTrackCount/);
assert.match(upload, /multitrack_require_upload_permission\(\)/);
assert.match(upload, /multitrack_verify_csrf/);
assert.match(serverHelpers, /ma_pravo\('upload'\)/);
assert.match(serverHelpers, /logged_in_single/);

console.log(`Multitrack HTML/JS/PHP contract: OK (${requestedIds.length} DOM IDs)`);
