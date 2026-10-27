(function (root) {
    'use strict';
    const kinds = ['song_start', 'song_end', 'passage', 'note'];
    const time = value => value !== null && value !== '' && value !== undefined && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
    const clean = value => String(value || '').trim().replace(/^[↑↓]$/, '');
    function format(ms) {
        const seconds = Math.floor(Math.max(0, Number(ms) || 0) / 1000);
        return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
    }
    function name(recording) {
        const files = recording.files || [];
        return files[0]?.display_name || files[0]?.original_name || recording.title || 'Nahrávka #' + recording.id;
    }
    // Immutable projection of catalogue/timestamp responses. Never persists derived intervals.
    function build(recording, { collections = [], recording_links = [] } = {}) {
        const recordingId = recording.id ?? recording.recording_id;
        const duration = time(recording.duration_ms);
        const entries = (recording.timestamps || recording.entries || []).filter(t => kinds.includes(t.kind) && time(t.time_ms) !== null)
            .map(t => ({ ...t, time_ms: Number(t.time_ms) })).sort((a, b) => a.time_ms - b.time_ms || Number(a.id) - Number(b.id));
        const source = entries.filter(t => duration === null || t.time_ms <= duration);
        const segments = [], usedEnds = new Set();
        const collection = collections.find(c => String(c.id) === String(recording.collection_id));
        const fallbackSong = collection?.kind === 'song' ? collection : null;
        let take = 0;
        for (const start of source.filter(t => t.kind === 'song_start')) {
            take++;
            const end = source.find(t => t.kind === 'song_end' && String(t.paired_timestamp_id) === String(start.id) && t.time_ms > start.time_ms && !usedEnds.has(String(t.id)));
            if (end) usedEnds.add(String(end.id));
            const candidates = recording_links.filter(p => String(p.source_recording_id) === String(recordingId) && (p.start_timestamp_id != null
                ? String(p.start_timestamp_id) === String(start.id)
                : time(p.start_ms) === start.time_ms && end && time(p.end_ms) === end.time_ms));
            const link = candidates.length === 1 ? candidates[0] : null;
            const song = collections.find(c => String(c.id) === String(link?.song_collection_id)) || fallbackSong;
            segments.push({ id: 't' + start.id, timestamp_id: start.id, end_timestamp_id: end?.id ?? null, kind: 'take',
                start_ms: start.time_ms, end_ms: end?.time_ms ?? null, label: clean(start.body) || 'Pokus ' + take,
                song_id: song?.id ?? link?.song_collection_id ?? null, song_title: song?.title || start.history_song_title || '',
                source: start, boundary: end ? 'paired' : 'open', parent_id: null });
        }
        const takes = segments.filter(s => s.end_ms !== null);
        const parentFor = at => takes.filter(s => s.start_ms <= at && at < s.end_ms)
            .sort((a, b) => (a.end_ms - a.start_ms) - (b.end_ms - b.start_ms))[0];
        for (const entry of source.filter(t => t.kind !== 'song_start')) {
            if (entry.kind === 'song_end' && usedEnds.has(String(entry.id))) continue;
            const parent = parentFor(entry.time_ms);
            let end = null;
            if (entry.kind === 'passage') {
                // A passage stops at the next structural marker or its containing take's end.
                const next = source.find(t => t.time_ms > entry.time_ms && ['passage', 'song_start', 'song_end'].includes(t.kind));
                const limits = [next?.time_ms, parent?.end_ms, duration].filter(v => v !== null && v !== undefined && v > entry.time_ms);
                if (limits.length) end = Math.min(...limits);
            }
            segments.push({ id: 't' + entry.id, timestamp_id: entry.id, end_timestamp_id: null,
                kind: entry.kind === 'song_end' ? 'boundary' : entry.kind, start_ms: entry.time_ms, end_ms: end,
                label: clean(entry.body) || (entry.kind === 'song_end' ? 'Konec bez začátku' : 'Poznámka'),
                song_id: parent?.song_id ?? fallbackSong?.id ?? null, song_title: parent?.song_title || fallbackSong?.title || '',
                source: entry, boundary: end === null ? 'point' : 'derived', parent_id: parent?.id ?? null });
        }
        segments.sort((a, b) => a.start_ms - b.start_ms || a.id.localeCompare(b.id));
        return { id: recordingId, recording, name: name({ ...recording, id: recordingId }), collection,
            duration_ms: duration, extent_ms: Math.max(1000, duration ?? (source.at(-1)?.time_ms || 0)), segments,
            omitted: entries.length - source.length, incomplete: segments.filter(s => s.kind === 'boundary' || s.kind === 'take' && s.end_ms === null).length };
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
