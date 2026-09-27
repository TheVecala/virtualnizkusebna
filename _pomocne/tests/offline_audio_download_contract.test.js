'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
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
assert.match(client, /function offlineFileCategory\(pathParts\)/);
assert.match(client, /return 'Skladby'/);
assert.match(client, /return 'Zkoušky'/);
assert.match(client, /return 'Multitrack'/);
assert.doesNotMatch(client, /context:\s*pathParts\.join/);
assert.match(recordings, /data-audio-cache-url=/);

const privacyHelpers = client.slice(
    client.indexOf('function offlineFileCategory('),
    client.indexOf('function refreshOfflineFilesModal(')
);
const context = { URL, window: { location: { href: 'https://zkusebna.example/index.php' } } };
vm.runInNewContext(privacyHelpers, context);

assert.deepEqual(
    { ...context.offlineFileDetails('audio-v1:https://zkusebna.example/user/band/private/uploads/song/audio.mp3') },
    { name: 'audio.mp3', context: 'Skladby' }
);
assert.equal(context.offlineFileDetails('audio-v1:/user/band/private/zkousky/rehearsal/take.wav').context, 'Zkoušky');
assert.equal(context.offlineFileDetails('audio-v1:/user/band/private/multitracky/project/drums.wav').context, 'Multitrack');
assert.equal(context.offlineFileDetails('audio-v1:/private/storage/recording.wav').context, 'Ostatní');

console.log('Offline audio download contract: OK');
