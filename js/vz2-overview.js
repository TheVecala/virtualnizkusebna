(() => {
    'use strict';
    const $ = id => document.getElementById(id);
    const filterPanel = $('overview-filters');
    if (!filterPanel) return;
    const workspace = $('overview-workspace'), generate = $('overview-generate');
    const status = $('overview-status'), retry = $('overview-retry');
    const make = (tag, text, className) => {
        const element = document.createElement(tag);
        if (text !== undefined) element.textContent = text;
        if (className) element.className = className;
        return element;
    };
    const dateTime = value => {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? '' : new Intl.DateTimeFormat('cs-CZ', {
            dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Prague'
        }).format(parsed);
    };
    const presets = {
        song_details: ['songs', 'song_details'],
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
    let snapshot = null, loading = false;
    const fixedInputs = () => [...document.querySelectorAll('#overview-filters input[data-filter]')];
    const currentFilters = () => Object.fromEntries(fixedInputs().map(input => [input.dataset.filter, input.checked]));
    const selectedSets = () => Object.fromEntries(['rehearsal', 'song'].map(kind => [kind,
        new Set([...selected[kind]].filter(([, checked]) => checked).map(([id]) => id))]));

    function setActivePreset(name) {
        let label = 'Vlastní';
        document.querySelectorAll('[data-overview-preset]').forEach(button => {
            const active = button.dataset.overviewPreset === name;
            button.setAttribute('aria-pressed', String(active));
            if (active) label = 'Předvolba: ' + button.textContent;
        });
        $('overview-preset-status').textContent = label;
    }

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

    function render(data, filters, original) {
        const rehearsals = $('overview-rehearsal-list'), songs = $('overview-song-list');
        rehearsals.replaceChildren(); songs.replaceChildren();
        const visibleSongIds = new Set(data.songs.map(item => Number(item.id)));
        for (const item of data.rehearsals) rehearsals.append(window.Vz2OverviewRender.renderCollection(item, 'rehearsal', filters, visibleSongIds));
        for (const item of data.songs) songs.append(window.Vz2OverviewRender.renderCollection(item, 'song', filters, visibleSongIds));
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

    workspace?.addEventListener('click', event => {
        const link = event.target.closest('a[href^="#"]');
        if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        const target = $(link.hash.slice(1));
        if (!target) return;
        event.preventDefault();
        target.scrollIntoView({ block: 'start' });
    });
    const filterPopupOpen = () => filterPanel.open && !filterPanel.closest('#tool-sidebar-slot');
    document.addEventListener('pointerdown', event => {
        if (filterPopupOpen() && !filterPanel.contains(event.target)) filterPanel.open = false;
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && filterPopupOpen()) filterPanel.open = false;
    });

    $('overview-filters').addEventListener('change', event => {
        const input = event.target;
        if (input.matches('input[data-collection-id]')) selected[input.dataset.collectionKind].set(Number(input.dataset.collectionId), input.checked);
        if (!input.matches('input[data-filter], input[data-collection-id]')) return;
        setActivePreset(null); updateFilterCount(); renderSnapshot();
    });
    $('overview-filter-all').addEventListener('click', () => {
        for (const input of fixedInputs()) input.checked = true;
        for (const kind of ['rehearsal', 'song']) {
            defaultSelected[kind] = true;
            for (const id of selected[kind].keys()) selected[kind].set(id, true);
        }
        for (const input of filterPanel.querySelectorAll('input[data-collection-id]')) input.checked = true;
        setActivePreset(null); updateFilterCount(); renderSnapshot();
    });
    $('overview-filter-none').addEventListener('click', () => {
        const keep = new Set(['rehearsals', 'songs', 'show_created', 'show_author', 'show_entry_date']);
        for (const input of fixedInputs()) input.checked = keep.has(input.dataset.filter);
        setActivePreset(null); updateFilterCount(); renderSnapshot();
    });
    $('overview-presets').addEventListener('click', event => {
        const button = event.target.closest('button[data-overview-preset]');
        if (!button) return;
        const name = button.dataset.overviewPreset;
        const keys = name === 'all' ? fixedInputs().map(input => input.dataset.filter) : presets[name];
        if (!keys) return;
        const enabled = new Set(keys);
        for (const input of fixedInputs()) {
            if (name === 'all' || !metadataFilters.has(input.dataset.filter)) input.checked = enabled.has(input.dataset.filter);
        }
        setActivePreset(name); updateFilterCount(); renderSnapshot();
    });
    $('overview-collection-filters').addEventListener('click', event => {
        const button = event.target.closest('button[data-select-kind]');
        if (!button) return;
        const kind = button.dataset.selectKind, checked = button.dataset.select === 'all';
        defaultSelected[kind] = checked;
        for (const id of selected[kind].keys()) selected[kind].set(id, checked);
        for (const input of filterPanel.querySelectorAll(`input[data-collection-kind="${kind}"]`)) input.checked = checked;
        setActivePreset(null); updateFilterCount(); renderSnapshot();
    });

    async function loadOverview() {
        if (loading) return;
        loading = true;
        if (generate) generate.disabled = true;
        retry.hidden = true;
        status.textContent = 'Sestavuji aktuální výpis…';
        try {
            const response = await fetch('php/ajax/vz2_overview.php', { credentials: 'same-origin', cache: 'no-store' });
            const data = await response.json();
            if (!response.ok || !data.ok) throw new Error(data.error || 'Výpis se nepodařilo načíst.');
            snapshot = data;
            updateCollectionChoices(data);
            renderSnapshot();
            status.textContent = generate ? 'Hotovo. Dalším kliknutím výpis aktualizujete.' : '';
            if (generate) generate.textContent = 'Aktualizovat výpis';
        } catch (error) {
            status.textContent = error.message || 'Výpis se nepodařilo načíst.';
            retry.hidden = !workspace;
        } finally {
            loading = false;
            if (generate) generate.disabled = false;
        }
    }
    if (workspace) {
        retry.addEventListener('click', loadOverview);
        document.addEventListener('vz2:workspace-changed', event => {
            if (event.detail.workspace === 'overview') void loadOverview();
        });
        if (!workspace.hidden) void loadOverview();
    } else generate.addEventListener('click', loadOverview);
})();
