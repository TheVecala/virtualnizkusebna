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
        const row = make('div', undefined, `overview-entry${entry.type === 'marker' ? ' overview-entry-marker' : ''}`);
        const attribution = [filters.show_author ? entry.author : '', filters.show_entry_date ? date(entry.at) : ''].filter(Boolean).join(' · ');
        const content = make('div', undefined, 'overview-entry-content');
        if (entry.type === 'marker') {
            const kind = markerNames[entry.kind] || 'Značka';
            const markerText = entry.body || kind;
            row.append(make('span', time(entry.time_ms), 'overview-marker-time'));
            content.append(make('span', `${kind}: `, 'overview-visually-hidden'));
            content.append(make('span', markerText, 'overview-entry-body'));
            if (entry.recording_name) {
                const recording = make('small', ` · nahr. ${entry.recording_name}`, 'overview-marker-recording');
                recording.title = `Nahrávka: ${entry.recording_name}`;
                content.append(recording);
            }
            if (attribution) content.append(make('small', ` · ${attribution}`, 'overview-entry-meta'));
            row.append(content);
            if (entry.kind === 'song_start' || entry.kind === 'song_end') {
                const icon = make('span', entry.kind === 'song_start' ? '↑' : '↓',
                    `overview-marker-icon${entry.kind === 'song_end' ? ' overview-marker-icon-end' : ''}`);
                icon.title = kind; icon.setAttribute('aria-hidden', 'true'); row.append(icon);
            }
            return row;
        }
        row.append(make('strong', entry.label, 'overview-entry-label'));
        content.append(make(entry.type === 'document' ? 'pre' : 'span', entry.body || '', 'overview-entry-body'));
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
            for (const entry of collection.entries) entries.append(renderEntry(entry, filters));
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
