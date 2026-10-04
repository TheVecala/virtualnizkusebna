'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const page = fs.readFileSync(path.join(root, 'vz2.php'), 'utf8');
const client = fs.readFileSync(path.join(root, 'js/multitrack.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'css/multitrack.css'), 'utf8');
for (const id of ['mt-mixer', 'mt-tracks', 'mt-loading-panel', 'mt-offline', 'mt-notice', 'mt-seek']) {
    assert(page.includes(`id="${id}"`), `Missing mixer control ${id}`);
    assert(client.includes(`byId('${id}')`));
}
for (const selector of ['.mt-status-row','.mt-status-name','.mt-status-value','.mt-channel-buttons','.mt-channel-button','.mt-fader','.is-solo-muted']) assert(styles.includes(selector), selector);
assert.match(page, /detailUrl:'php\/ajax\/vz2.php\?action=mixer&id=\{id\}'/);
assert.match(client, /return new URL\(configuredUrl, window.location.href\).href/);
assert.doesNotMatch(client, /jQuery|modal_multitrack|uploadUrl|submitUpload|managedNavigation/);
assert.doesNotMatch(styles, /multitrack-page|mt-upload|#mt-page/);
console.log('Current mixer HTML/JS/CSS contract: OK');
