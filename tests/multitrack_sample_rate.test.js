'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scriptPath = path.resolve(__dirname, '..', 'js', 'multitrack.js');
const source = fs.readFileSync(scriptPath, 'utf8');
const context = {
    window: {
        MULTITRACK_CONFIG: {},
        addEventListener() {}
    },
    document: {
        readyState: 'loading',
        addEventListener() {}
    },
    URL,
    Blob,
    console,
    setTimeout,
    clearTimeout
};

vm.runInNewContext(source, context, { filename: scriptPath });
const detect = context.window.MultitrackApp.detectSourceSampleRate;

function writeAscii(bytes, offset, value) {
    for (let index = 0; index < value.length; index += 1) {
        bytes[offset + index] = value.charCodeAt(index);
    }
}

function wav(sampleRate, container = 'RIFF') {
    const buffer = new ArrayBuffer(44);
    const bytes = new Uint8Array(buffer);
    const view = new DataView(buffer);
    writeAscii(bytes, 0, container);
    view.setUint32(4, 36, true);
    writeAscii(bytes, 8, 'WAVE');
    writeAscii(bytes, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeAscii(bytes, 36, 'data');
    return buffer;
}

function flac(sampleRate) {
    const buffer = new ArrayBuffer(42);
    const bytes = new Uint8Array(buffer);
    writeAscii(bytes, 0, 'fLaC');
    bytes[4] = 0x80; // Poslední metadata blok, STREAMINFO.
    bytes[7] = 34;
    bytes[18] = sampleRate >> 12;
    bytes[19] = (sampleRate >> 4) & 0xff;
    bytes[20] = (sampleRate & 0x0f) << 4;
    return buffer;
}

function mp3Mpeg1(sampleRateIndex) {
    return Uint8Array.from([
        0xff,
        0xfb, // MPEG-1, Layer III.
        0x90 | ((sampleRateIndex & 0x03) << 2),
        0x00
    ]).buffer;
}

function mp3WithId3(sampleRateIndex) {
    const bytes = new Uint8Array(14);
    writeAscii(bytes, 0, 'ID3');
    bytes[3] = 4;
    bytes.set(new Uint8Array(mp3Mpeg1(sampleRateIndex)), 10);
    return bytes.buffer;
}

assert.equal(detect(wav(44100), 'track.wav'), 44100);
assert.equal(detect(wav(48000), 'track.WAV'), 48000);
assert.equal(detect(wav(48000, 'BW64'), 'track.wav'), 48000);
assert.equal(detect(flac(96000), 'track.flac'), 96000);
assert.equal(detect(mp3Mpeg1(0), 'track.mp3'), 44100);
assert.equal(detect(mp3Mpeg1(1), 'track.mp3'), 48000);
assert.equal(detect(mp3WithId3(0), 'track.mp3'), 44100);
assert.equal(detect(new ArrayBuffer(16), 'track.mp3'), null);
assert.equal(detect(wav(44100), 'track.ogg'), null);

console.log('Multitrack sample-rate parser: OK');
