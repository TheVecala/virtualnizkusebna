(function (root) {
    'use strict';
    const Model = typeof module !== 'undefined' && module.exports ? require('./vz2-timestamp-model.js') : root.Vz2TimestampModel;
    function format(ms) {
        const seconds = Math.floor(Math.max(0, Number(ms) || 0) / 1000);
        return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
    }
    function name(recording) {
        const files = recording.files || [];
        return files[0]?.display_name || files[0]?.original_name || recording.title || 'Nahrávka #' + recording.id;
    }
    function build(recording, context = {}) {
        const id = recording.id ?? recording.recording_id, duration = Model.time(recording.duration_ms);
        const segments = Model.items(recording, context);
        const entries = recording.timestamps || recording.entries || [];
        return { id, recording, name: name({ ...recording, id }), collection: (context.collections || []).find(c => String(c.id) === String(recording.collection_id)),
            duration_ms: duration, extent_ms: Math.max(1000, duration ?? Math.max(0, ...segments.map(s => s.end_ms ?? s.start_ms))), segments,
            omitted: entries.filter(e => Model.time(e.time_ms) !== null && duration !== null && Number(e.time_ms) > duration).length,
            incomplete: segments.filter(s => ['open', 'orphan'].includes(s.status)).length };
    }
    function lanes(segments, pointSpacing = 1) {
        const rows = [];
        for (const s of [...segments].sort((a, b) => a.start_ms - b.start_ms || (b.end_ms ?? b.start_ms) - (a.end_ms ?? a.start_ms))) {
            let row = rows.find(r => (r.at(-1).end_ms ?? r.at(-1).start_ms + pointSpacing) <= s.start_ms);
            if (!row) rows.push(row = []);
            row.push(s);
        }
        return rows;
    }
    function color(segment, recordingId, mode = 'type') {
        if (mode === 'mono') return '#9cbba8';
        if (mode === 'type') return ({ take: '#43c58a', passage: '#6b9df5', note: '#e7bc67', boundary: '#e88789', recording: '#e07479' })[segment.kind] || '#a6b5b0';
        const key = mode === 'recording' ? String(recordingId) : segment.song_id != null ? 'song:' + segment.song_id : null;
        if (key === null) return '#9ba9a1';
        let hash = 0; for (const c of key) hash = ((hash << 5) - hash + c.charCodeAt(0)) | 0;
        return ['#43c58a', '#6b9df5', '#e7bc67', '#c596ed', '#e88789', '#6fc7ce', '#b4c76e'][Math.abs(hash) % 7];
    }
    const api = { build, lanes, color, format, name };
    if (typeof module !== 'undefined') module.exports = api;
    root.Vz2SegmentsModel = api;
})(typeof window === 'undefined' ? globalThis : window);
