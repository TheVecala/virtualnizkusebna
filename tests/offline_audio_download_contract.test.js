'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const client = fs.readFileSync(path.join(root, 'js', 'main.js'), 'utf8');
const recordings = fs.readFileSync(path.join(root, 'php', 'ajax', 'ajax_nahravky.php'), 'utf8');

assert.match(client, /function saveAudioBlobAsFile\(blob, fileName\)/);
assert.match(client, /URL\.createObjectURL\(blob\)/);
assert.match(client, /link\.download = fileName/);
assert.match(client, /\.offline-file-save/);
assert.match(client, /idbKeyval\.get\(key, cacheStore\)/);
assert.match(client, /\.download-btn\[data-audio-cache-url\]/);
assert.match(client, /idbKeyval\.get\(getAudioCacheKey\(cesta\), cacheStore\)/);
assert.match(client, /if \(blob instanceof Blob\) \{\s*saveAudioBlobAsFile\(blob, fileName\);\s*return;\s*\}\s*downloadAudioFromServer/s);
assert.match(recordings, /data-audio-cache-url=/);

console.log('Offline audio download contract: OK');
