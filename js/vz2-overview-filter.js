(function (root) {
    'use strict';
    const enabled = (filters, key) => filters[key] !== false;

    function entryKey(scope, entry) {
        if (entry.type === 'document') {
            if (entry.kind === 'lyrics_chords') return scope === 'rehearsal' ? 'rehearsal_notes' : 'song_lyrics';
            if (entry.kind === 'rehearsal_starts') return 'rehearsal_starts';
            if (entry.kind === 'tablature') return scope === 'song' ? 'song_tablature' : 'rehearsal_other';
            return `${scope}_other`;
        }
        if (entry.type === 'summary') return `${scope}_summary`;
        if (entry.type === 'attachment_note') return `${scope}_attachment`;
        if (entry.type === 'discussion') return `${scope}_discussion`;
        if (entry.type === 'map') return scope === 'song' ? 'song_map_sections' : 'rehearsal_other';
        if (entry.type === 'map_detail') return scope === 'song' ? 'song_map_details' : 'rehearsal_other';
        if (entry.type === 'marker') {
            if (['song_start', 'song_end', 'passage', 'note'].includes(entry.kind)) return `${scope}_marker_${entry.kind}`;
        }
        return `${scope}_other`;
    }

    function filterOverview(data, filters = {}, selected = {}) {
        const apply = (scope, key, collections) => {
            if (!enabled(filters, key)) return [];
            return collections.filter(item => !selected[scope] || selected[scope].has(Number(item.id))).map(item => {
                const entries = item.entries.filter(entry => enabled(filters, entryKey(scope, entry)));
                const played_songs = scope === 'rehearsal' && enabled(filters, 'rehearsal_played') ? item.played_songs : [];
                return { ...item, entries, played_songs };
            }).filter(item => enabled(filters, 'show_empty') || item.entries.length > 0 || item.played_songs.length > 0);
        };
        return { ...data,
            rehearsals: apply('rehearsal', 'rehearsals', data.rehearsals),
            songs: apply('song', 'songs', data.songs)
        };
    }

    const api = { entryKey, filterOverview };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.Vz2OverviewFilter = api;
}(typeof window === 'undefined' ? globalThis : window));
