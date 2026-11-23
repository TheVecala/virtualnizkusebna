(() => {
    'use strict';
    const make = (tag, text, className) => {
        const element = document.createElement(tag);
        if (text !== undefined) element.textContent = text;
        if (className) element.className = className;
        return element;
    };
    const date = value => {
        if (!value) return '';
        const iso = value.replace(' ', 'T');
        const parsed = new Date(iso.endsWith('Z') ? iso : `${iso}Z`);
        return Number.isNaN(parsed.getTime()) ? '' : new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'medium', timeZone: 'Europe/Prague' }).format(parsed);
    };
    const time = window.Vz2TimestampModel.format;
    const markerNames = { take: 'Úsek', boundary: 'Konec bez začátku', passage: 'Pasáž', note: 'Poznámka' };

    function renderEntry(entry, filters) {
        const body = entry.body || '';
        const wide = entry.type !== 'marker' && (entry.type === 'document' || entry.type === 'map' || body.includes('\n') || body.length > 100);
        const row = make('div', undefined, `overview-entry${entry.type === 'marker' ? ' overview-entry-marker' : ''}${wide ? ' overview-entry-wide' : ''}${entry.type === 'map_detail' ? ' overview-entry-map-detail' : ''}`);
        const attribution = [filters.show_author ? entry.author : '', filters.show_entry_date ? date(entry.at) : ''].filter(Boolean).join(' · ');
        const content = make('div', undefined, 'overview-entry-content');
        if (entry.type === 'song_details') {
            row.classList.add('overview-entry-wide', 'overview-song-details');
            const tempos = (entry.tempos || []).map(n => Number(n).toLocaleString('cs-CZ', { maximumFractionDigits: 2, useGrouping: false })).join(' / ');
            const music = [tempos ? tempos + ' BPM' : '', (entry.meters || []).join(' + ')].filter(Boolean).join(' · ');
            if (music) content.append(make('strong', music, 'overview-song-music'));
            if (body) content.append(make('div', body, 'overview-entry-body'));
            row.append(content); return row;
        }
        if (entry.type === 'marker') {
            const kind = markerNames[entry.kind] || 'Značka';
            const markerText = entry.body || kind;
            const range = make('span', time(entry.start_ms), 'overview-marker-time');
            if (entry.end_ms !== null) { range.append(document.createElement('br'), document.createTextNode('– ' + time(entry.end_ms))); }
            row.append(range);
            content.append(make('span', `${kind}: `, 'overview-visually-hidden'));
            content.append(make('span', markerText, 'overview-entry-body'));
            if (entry.song_title) content.append(make('small', ' · ' + entry.song_title, 'overview-entry-meta'));
            if (entry.passage_type) content.append(make('small', ' · ' + (window.Vz2TimestampModel.passageTypes[entry.passage_type] || entry.passage_type), 'overview-entry-meta'));
            if (entry.status === 'open') content.append(make('small', ' · Doplnit konec', 'overview-entry-meta'));
            if (entry.note_text) content.append(make('div', entry.note_text, 'overview-annotation-note'));
            if (attribution) content.append(make('small', ` · ${attribution}`, 'overview-entry-meta'));
            if (entry.end_body || entry.end_author && entry.end_author !== entry.author) {
                const endMeta = [filters.show_author ? entry.end_author : '', filters.show_entry_date ? date(entry.end_at) : ''].filter(Boolean).join(' · ');
                content.append(make('div', ['Konec: ' + (entry.end_body || time(entry.end_ms)), endMeta].filter(Boolean).join(' · '), 'overview-annotation-note'));
            }
            row.append(content);
            if (entry.kind === 'take' || entry.kind === 'boundary') {
                const icon = make('span', entry.kind === 'take' ? '↔' : '↓',
                    `overview-marker-icon${entry.kind === 'boundary' ? ' overview-marker-icon-end' : ''}`);
                icon.title = kind; icon.setAttribute('aria-hidden', 'true'); row.append(icon);
            }
            return row;
        }
        if (entry.type === 'map') {
            row.append(make('strong', entry.label, 'overview-entry-label'));
            const map = make('div', undefined, 'overview-map');
            for (const section of entry.sections || []) {
                const block = make('section', undefined, 'overview-map-section');
                block.append(make('h4', section.name));
                const bars = Array.isArray(section.bars) ? section.bars : [];
                for (let index = 0; index < bars.length; index += 8) {
                    const barRow = make('div', undefined, 'overview-map-row');
                    bars.slice(index, index + 8).forEach((bar, offset) => {
                        const cell = make('span', window.Vz2SongMapModel.symbol(bar),
                            `overview-map-bar${bar.has_detail ? ' has-detail' : ''}`);
                        const description = `Takt ${Number(section.first_bar) + index + offset}: ${window.Vz2SongMapModel.label(bar)}`;
                        cell.dataset.base = bar.base || '';
                        cell.setAttribute('role', 'img');
                        cell.setAttribute('aria-label', description);
                        cell.title = description;
                        barRow.append(cell);
                    });
                    block.append(barRow);
                }
                map.append(block);
            }
            content.append(map);
            if (attribution) content.append(make('small', attribution, 'overview-entry-meta'));
            row.append(content);
            return row;
        }
        row.append(make('strong', entry.label, 'overview-entry-label'));
        content.append(make(entry.type === 'document' ? 'pre' : 'span', body, 'overview-entry-body'));
        if (attribution) content.append(make('small', ` · ${attribution}`, 'overview-entry-meta'));
        row.append(content);
        return row;
    }

    function renderCollection(collection, kind, filters, visibleSongIds, { showHeading = true } = {}) {
        const article = make('article', undefined, 'overview-collection');
        article.id = `${kind}-${collection.id}`;
        if (showHeading) {
            const header = make('header', undefined, 'overview-collection-heading');
            const title = make('h3');
            if (collection.lifecycle === 'archived') title.textContent = collection.title;
            else {
                const link = make('a', collection.title);
                link.href = `index.php?v=2&kind=${kind === 'song' ? 'song' : 'rehearsal'}&collection_id=${collection.id}`;
                title.append(link);
            }
            header.append(title);
            const created = filters.show_created ? date(collection.created_at) : '';
            const details = [created ? `Založeno ${created}` : '', collection.lifecycle === 'archived' ? 'Archiv' : ''].filter(Boolean).join(' · ');
            if (details) header.append(make('span', details, 'overview-collection-meta'));
            article.append(header);
        }
        if (kind === 'rehearsal' && collection.played_songs.length) {
            const songs = make('div', undefined, 'overview-played');
            songs.append(make('span', 'Hrané skladby:', 'overview-played-label'));
            for (const song of collection.played_songs) {
                const label = `${song.title}${song.count > 1 ? ` ×${song.count}` : ''}`;
                if (visibleSongIds.has(Number(song.id))) {
                    const songLink = make('a', label);
                    songLink.href = `#song-${song.id}`;
                    songs.append(songLink);
                } else songs.append(make('span', label));
            }
            article.append(songs);
        }
        if (collection.entries.length) {
            const entries = make('div', undefined, 'overview-entries');
            let markerGroup = null, markerRecordingId = null;
            for (const entry of collection.entries) {
                if (entry.type !== 'marker') {
                    markerGroup = null;
                    entries.append(renderEntry(entry, filters));
                    continue;
                }
                if (!markerGroup || markerRecordingId !== entry.recording_id) {
                    markerGroup = make('section', undefined, 'overview-marker-group');
                    markerGroup.append(make('h4', `Nahrávka: ${entry.recording_name}`, 'overview-marker-heading'));
                    entries.append(markerGroup);
                    markerRecordingId = entry.recording_id;
                }
                markerGroup.append(renderEntry(entry, filters));
            }
            article.append(entries);
        } else if (!collection.played_songs.length) article.append(make('p', 'Zatím bez textových zápisků.', 'overview-empty'));
        return article;
    }

    window.Vz2OverviewRender = { renderCollection };
})();
