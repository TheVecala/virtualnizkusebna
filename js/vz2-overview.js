(() => {
    'use strict';
    const $ = id => document.getElementById(id);
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
    const dateTime = value => {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? '' : new Intl.DateTimeFormat('cs-CZ', {
            dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Prague'
        }).format(parsed);
    };
    const time = milliseconds => {
        const seconds = Math.floor(Number(milliseconds) / 1000);
        return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    };
    const markerNames = { song_start: 'Začátek skladby', song_end: 'Konec skladby', passage: 'Pasáž', note: 'Poznámka' };
    const presets = {
        lyrics: ['songs', 'song_lyrics'],
        starts_notes: ['rehearsals', 'rehearsal_starts', 'rehearsal_notes'],
        bar_details: ['songs', 'song_map_details'],
        markers: ['rehearsals', 'songs', ...['rehearsal', 'song'].flatMap(kind =>
            ['song_start', 'song_end', 'passage', 'note'].map(marker => `${kind}_marker_${marker}`))],
        summaries: ['rehearsals', 'songs', 'rehearsal_summary', 'song_summary']
    };
    const metadataFilters = new Set(['show_created', 'show_author', 'show_entry_date']);
    const selected = { rehearsal: new Map(), song: new Map() };
    const defaultSelected = { rehearsal: true, song: true };
    let snapshot = null;
    const fixedInputs = () => [...document.querySelectorAll('#overview-filters input[data-filter]')];
    const currentFilters = () => Object.fromEntries(fixedInputs().map(input => [input.dataset.filter, input.checked]));
    const selectedSets = () => Object.fromEntries(['rehearsal', 'song'].map(kind => [kind,
        new Set([...selected[kind]].filter(([, checked]) => checked).map(([id]) => id))]));

    function updateFilterCount() {
        const inputs = fixedInputs();
        const checked = inputs.filter(input => input.checked).length;
        const totalItems = selected.rehearsal.size + selected.song.size;
        const checkedItems = [...selected.rehearsal.values(), ...selected.song.values()].filter(Boolean).length;
        $('overview-filter-count').textContent = checked === inputs.length && checkedItems === totalItems
            ? 'Vše' : `${checked}/${inputs.length} voleb${totalItems ? ` · ${checkedItems}/${totalItems} položek` : ''}`;
    }

    function updateCollectionChoices(data) {
        for (const [kind, items, hostId] of [
            ['rehearsal', data.rehearsals, 'overview-rehearsal-options'],
            ['song', data.songs, 'overview-song-options']
        ]) {
            const state = selected[kind], ids = new Set(items.map(item => Number(item.id)));
            for (const id of state.keys()) if (!ids.has(id)) state.delete(id);
            const host = $(hostId); host.replaceChildren();
            for (const item of items) {
                const id = Number(item.id);
                if (!state.has(id)) state.set(id, defaultSelected[kind]);
                const label = make('label'), input = make('input');
                input.type = 'checkbox'; input.checked = state.get(id);
                input.dataset.collectionKind = kind; input.dataset.collectionId = String(id);
                label.append(input, document.createTextNode(' ' + item.title));
                host.append(label);
            }
            if (!items.length) host.append(make('p', 'Žádné položky.', 'overview-empty'));
        }
        $('overview-collection-filters').hidden = false;
        updateFilterCount();
    }

    function renderEntry(entry, filters) {
        const body = entry.body || '';
        const wide = entry.type !== 'marker' && (entry.type === 'document' || entry.type === 'map' || body.includes('\n') || body.length > 100);
        const row = make('div', undefined, `overview-entry${entry.type === 'marker' ? ' overview-entry-marker' : ''}${wide ? ' overview-entry-wide' : ''}${entry.type === 'map_detail' ? ' overview-entry-map-detail' : ''}`);
        const attribution = [filters.show_author ? entry.author : '', filters.show_entry_date ? date(entry.at) : ''].filter(Boolean).join(' · ');
        const content = make('div', undefined, 'overview-entry-content');
        if (entry.type === 'marker') {
            const kind = markerNames[entry.kind] || 'Značka';
            const markerText = entry.body || kind;
            row.append(make('span', time(entry.time_ms), 'overview-marker-time'));
            content.append(make('span', `${kind}: `, 'overview-visually-hidden'));
            content.append(make('span', markerText, 'overview-entry-body'));
            if (attribution) content.append(make('small', ` · ${attribution}`, 'overview-entry-meta'));
            row.append(content);
            if (entry.kind === 'song_start' || entry.kind === 'song_end') {
                const icon = make('span', entry.kind === 'song_start' ? '↑' : '↓',
                    `overview-marker-icon${entry.kind === 'song_end' ? ' overview-marker-icon-end' : ''}`);
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

    function renderCollection(collection, kind, filters, visibleSongIds) {
        const article = make('article', undefined, 'overview-collection');
        article.id = `${kind}-${collection.id}`;
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

    function render(data, filters, original) {
        const rehearsals = $('overview-rehearsal-list'), songs = $('overview-song-list');
        rehearsals.replaceChildren(); songs.replaceChildren();
        const visibleSongIds = new Set(data.songs.map(item => Number(item.id)));
        for (const item of data.rehearsals) rehearsals.append(renderCollection(item, 'rehearsal', filters, visibleSongIds));
        for (const item of data.songs) songs.append(renderCollection(item, 'song', filters, visibleSongIds));
        if (filters.rehearsals && !data.rehearsals.length) rehearsals.append(make('p', 'Žádné zkoušky neodpovídají filtru.', 'overview-empty'));
        if (filters.songs && !data.songs.length) songs.append(make('p', 'Žádné skladby neodpovídají filtru.', 'overview-empty'));
        $('overview-rehearsals').hidden = !filters.rehearsals;
        $('overview-songs').hidden = !filters.songs;
        const jumps = $('overview-output').querySelectorAll('.overview-jump a');
        jumps[0].hidden = !filters.rehearsals; jumps[1].hidden = !filters.songs;
        $('overview-output').querySelector('.overview-jump').hidden = !filters.rehearsals && !filters.songs;
        $('overview-no-results').hidden = filters.rehearsals || filters.songs;
        $('overview-meta').textContent = `Vytvořeno ${dateTime(data.generated_at)} · zkoušky ${data.rehearsals.length}/${original.rehearsals.length} · skladby ${data.songs.length}/${original.songs.length}`;
        $('overview-output').hidden = false;
    }

    function renderSnapshot() {
        if (!snapshot) return;
        const filters = currentFilters();
        render(window.Vz2OverviewFilter.filterOverview(snapshot, filters, selectedSets()), filters, snapshot);
    }

    const filterPanel = $('overview-filters');
    document.addEventListener('pointerdown', event => {
        if (filterPanel.open && !filterPanel.contains(event.target)) filterPanel.open = false;
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && filterPanel.open) filterPanel.open = false;
    });

    $('overview-filters').addEventListener('change', event => {
        const input = event.target;
        if (input.matches('input[data-collection-id]')) selected[input.dataset.collectionKind].set(Number(input.dataset.collectionId), input.checked);
        if (!input.matches('input[data-filter], input[data-collection-id]')) return;
        updateFilterCount(); renderSnapshot();
    });
    $('overview-filter-all').addEventListener('click', () => {
        for (const input of fixedInputs()) input.checked = true;
        for (const kind of ['rehearsal', 'song']) {
            defaultSelected[kind] = true;
            for (const id of selected[kind].keys()) selected[kind].set(id, true);
        }
        for (const input of document.querySelectorAll('input[data-collection-id]')) input.checked = true;
        updateFilterCount(); renderSnapshot();
    });
    $('overview-filter-none').addEventListener('click', () => {
        const keep = new Set(['rehearsals', 'songs', 'show_created', 'show_author', 'show_entry_date']);
        for (const input of fixedInputs()) input.checked = keep.has(input.dataset.filter);
        updateFilterCount(); renderSnapshot();
    });
    $('overview-filters').addEventListener('click', event => {
        const button = event.target.closest('button[data-overview-preset]');
        if (!button) return;
        const keys = presets[button.dataset.overviewPreset];
        if (!keys) return;
        const enabled = new Set(keys);
        for (const input of fixedInputs()) {
            if (!metadataFilters.has(input.dataset.filter)) input.checked = enabled.has(input.dataset.filter);
        }
        updateFilterCount(); renderSnapshot();
    });
    $('overview-collection-filters').addEventListener('click', event => {
        const button = event.target.closest('button[data-select-kind]');
        if (!button) return;
        const kind = button.dataset.selectKind, checked = button.dataset.select === 'all';
        defaultSelected[kind] = checked;
        for (const id of selected[kind].keys()) selected[kind].set(id, checked);
        for (const input of document.querySelectorAll(`input[data-collection-kind="${kind}"]`)) input.checked = checked;
        updateFilterCount(); renderSnapshot();
    });

    $('overview-generate').addEventListener('click', async () => {
        const button = $('overview-generate'), status = $('overview-status');
        button.disabled = true;
        status.textContent = 'Sestavuji aktuální výpis…';
        try {
            const response = await fetch('php/ajax/vz2_overview.php', { credentials: 'same-origin', cache: 'no-store' });
            const data = await response.json();
            if (!response.ok || !data.ok) throw new Error(data.error || 'Výpis se nepodařilo načíst.');
            snapshot = data;
            updateCollectionChoices(data);
            renderSnapshot();
            status.textContent = 'Hotovo. Dalším kliknutím výpis aktualizujete.';
            button.textContent = 'Aktualizovat výpis';
        } catch (error) {
            status.textContent = error.message || 'Výpis se nepodařilo načíst.';
        } finally { button.disabled = false; }
    });
})();
