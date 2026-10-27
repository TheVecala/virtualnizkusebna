'use strict';
const collections = [
    { id: 1, kind: 'rehearsal', title: 'Zkouška · 24. října', lifecycle: 'active' },
    { id: 2, kind: 'rehearsal', title: 'Zkouška · 17. října', lifecycle: 'active' },
    { id: 3, kind: 'song', title: 'Poslední vlak', lifecycle: 'active' },
    { id: 4, kind: 'song', title: 'Za obzorem', lifecycle: 'active' }
];
const timestamps = [
    { id: 1, kind: 'song_start', time_ms: 10000, body: 'Pokus 1' },
    { id: 2, kind: 'song_end', time_ms: 65000, paired_timestamp_id: 1, body: '↓' },
    { id: 3, kind: 'song_start', time_ms: 80000, body: 'Pokus 2' },
    { id: 4, kind: 'song_end', time_ms: 155000, paired_timestamp_id: 3, body: '↓' },
    { id: 5, kind: 'song_start', time_ms: 170000, body: 'Pokus 3' },
    { id: 6, kind: 'song_end', time_ms: 215000, paired_timestamp_id: 5, body: '↓' },
    { id: 7, kind: 'song_start', time_ms: 230000, body: 'Pokus 4 · celý průchod' },
    { id: 8, kind: 'song_end', time_ms: 365000, paired_timestamp_id: 7, body: '↓' },
    { id: 9, kind: 'passage', time_ms: 238000, body: 'Sloka' },
    { id: 10, kind: 'passage', time_ms: 270000, body: 'Refrén' },
    { id: 11, kind: 'passage', time_ms: 300000, body: 'Sloka 2' },
    { id: 12, kind: 'passage', time_ms: 330000, body: 'Refrén + závěr' },
    { id: 13, kind: 'note', time_ms: 282000, body: '👍 Tohle tempo sedí' },
    { id: 14, kind: 'note', time_ms: 188000, body: 'Zkusit pomalejší nástup' }
];
const file = (id, duration) => ({ id, display_name: 'zkouska-' + id + '.wav', original_name: 'zkouska-' + id + '.wav', url: '/sample.wav', sha256: 'a'.repeat(64), duration_ms: duration, state: 'available' });
const recordings = [
    { id: 11, collection_id: 1, title: 'Hlavní záznam', kind: 'single', lifecycle: 'active', duration_ms: 420000, timestamps, files: [file(11, 420000)] },
    { id: 12, collection_id: 2, title: 'Minulá zkouška', kind: 'single', lifecycle: 'active', duration_ms: 360000, timestamps: timestamps.slice(0, 6), files: [file(12, 360000)] },
    { id: 13, collection_id: 1, title: 'Vícestopý záznam', kind: 'multitrack', lifecycle: 'active', duration_ms: 420000, timestamps: timestamps.slice(6), files: [file(13, 420000), file(14, 420000)] },
    { id: 14, collection_id: 2, title: 'Záznam bez značek', kind: 'single', lifecycle: 'active', duration_ms: null, timestamps: [], files: [] }
];
const recording_links = [
    { id: 1, source_recording_id: 11, start_timestamp_id: 1, end_timestamp_id: 2, start_ms: 10000, end_ms: 65000, song_collection_id: 3 },
    { id: 2, source_recording_id: 11, start_timestamp_id: 3, end_timestamp_id: 4, start_ms: 80000, end_ms: 155000, song_collection_id: 3 },
    { id: 3, source_recording_id: 11, start_timestamp_id: 5, end_timestamp_id: 6, start_ms: 170000, end_ms: 215000, song_collection_id: 4 },
    { id: 4, source_recording_id: 11, start_timestamp_id: 7, end_timestamp_id: 8, start_ms: 230000, end_ms: 365000, song_collection_id: 3 }
];
module.exports = { ok: true, collections, recordings, recording_links };
