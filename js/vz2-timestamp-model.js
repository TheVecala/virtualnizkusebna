(function (root) {
    'use strict';
    // Public, view-independent contract. All times are integer milliseconds.
    const version = 1;
    const passageTypes = { intro: 'Intro', verse: 'Sloka', chorus: 'Refrén', bridge: 'Bridge', solo: 'Sólo', outro: 'Outro', custom: 'Vlastní' };
    const time = value => value !== null && value !== undefined && value !== '' && Number.isSafeInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 604800000 ? Number(value) : null;
    const clean = value => String(value || '').trim().replace(/^[↑↓]$/, '');
    function normalize(recording, context = {}) {
        const recordingId = Number(recording.id ?? recording.recording_id);
        const duration = time(recording.duration_ms);
        const entries = (recording.entries || recording.timestamps || []).filter(t => ['song_start', 'song_end', 'passage', 'note'].includes(t.kind) && time(t.time_ms) !== null && (duration === null || Number(t.time_ms) <= duration))
            .map(t => ({ ...t, time_ms: Number(t.time_ms) })).sort((a, b) => a.time_ms - b.time_ms || Number(a.id) - Number(b.id));
        const used = new Set(), items = [];
        let takeNumber = 0;
        for (const entry of entries.filter(t => t.kind !== 'song_end')) {
            const take = entry.kind === 'song_start';
            if (take) takeNumber++;
            const ends = take ? entries.filter(e => e.kind === 'song_end' && Number(e.paired_timestamp_id) === Number(entry.id) && e.time_ms > entry.time_ms) : [];
            const end = ends.length === 1 ? ends[0] : null;
            if (end) used.add(Number(end.id));
            const explicitEnd = take ? end?.time_ms ?? null : entry.kind === 'passage' ? time(entry.end_time_ms) : null;
            const endMs = explicitEnd !== null && explicitEnd > entry.time_ms && (duration === null || explicitEnd <= duration) ? explicitEnd : null;
            const link = (context.recording_links || []).find(p => Number(p.source_recording_id) === recordingId && Number(p.start_timestamp_id) === Number(entry.id));
            const songId = take ? (entry.song_collection_id ?? link?.song_collection_id ?? null) : null;
            const song = (context.collections || []).find(c => Number(c.id) === Number(songId));
            items.push({ id: 't' + entry.id, recording_id: recordingId, timestamp_id: Number(entry.id), end_timestamp_id: end ? Number(end.id) : null,
                kind: take ? 'take' : entry.kind, start_ms: entry.time_ms, end_ms: endMs,
                status: entry.kind === 'note' ? 'point' : endMs === null ? 'open' : 'complete',
                label: clean(entry.body) || (take ? 'Pokus ' + takeNumber : passageTypes[entry.passage_type] || 'Poznámka'),
                passage_type: entry.kind === 'passage' ? entry.passage_type || 'custom' : null, note_text: entry.note_text || '',
                parent_id: entry.parent_timestamp_id ? 't' + entry.parent_timestamp_id : null,
                song_id: songId === null ? null : Number(songId), song_title: song?.title || entry.song_title || entry.history_song_title || '',
                can_edit: !!entry.can_edit && (!end || !!end.can_edit), can_delete: !!entry.can_delete && (!end || !!end.can_delete),
                source: entry, end_source: end, boundary: entry.kind === 'note' ? 'point' : endMs === null ? 'open' : take ? 'paired' : 'explicit' });
        }
        for (const item of items) {
            const parent = items.find(p => p.kind === 'take' && p.id === item.parent_id);
            if (parent) { item.song_id = parent.song_id; item.song_title = parent.song_title; }
        }
        for (const entry of entries.filter(e => e.kind === 'song_end' && !used.has(Number(e.id)))) {
            items.push({ id: 't' + entry.id, recording_id: recordingId, timestamp_id: Number(entry.id), end_timestamp_id: null,
                kind: 'boundary', start_ms: entry.time_ms, end_ms: null, status: 'orphan', label: clean(entry.body) || 'Konec bez začátku',
                passage_type: null, note_text: '', parent_id: null, song_id: null, song_title: '', can_edit: !!entry.can_edit, can_delete: !!entry.can_delete,
                source: entry, end_source: null, boundary: 'open' });
        }
        return items.sort((a, b) => a.start_ms - b.start_ms || a.timestamp_id - b.timestamp_id);
    }
    function items(recording, context) {
        return recording.annotation_version === version && Array.isArray(recording.annotations) ? recording.annotations : normalize(recording, context);
    }
    function endOf(entry, entries, duration) {
        return normalize({ id: entry.recording_id || 0, entries, duration_ms: duration }).find(i => i.timestamp_id === Number(entry.id))?.end_ms ?? null;
    }
    function containingTakes(recording, start, end = null) {
        return items(recording).filter(i => i.kind === 'take' && i.start_ms <= start && (i.end_ms === null || (start < i.end_ms && (end === null || end <= i.end_ms))));
    }
    const api = { version, passageTypes, time, normalize, items, endOf, containingTakes };
    if (typeof module !== 'undefined') module.exports = api;
    root.Vz2TimestampModel = api;
})(typeof window === 'undefined' ? globalThis : window);
