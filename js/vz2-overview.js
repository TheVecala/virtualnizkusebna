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

    function renderEntry(entry) {
        const row = make('div', undefined, 'overview-entry');
        const heading = make('div', undefined, 'overview-entry-heading');
        const label = entry.type === 'marker'
            ? `${markerNames[entry.kind] || 'Značka'} · ${time(entry.time_ms)}` : entry.label;
        heading.append(make('strong', label));
        const attribution = [entry.author, date(entry.at)].filter(Boolean).join(' · ');
        if (attribution) heading.append(make('small', attribution));
        const body = make(entry.type === 'document' ? 'pre' : 'p', entry.body || '', 'overview-entry-body');
        if (entry.type === 'marker' && !entry.body) body.textContent = '—';
        row.append(heading, body);
        return row;
    }

    function renderCollection(collection, kind) {
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
        const created = date(collection.created_at);
        const details = [created ? `Založeno ${created}` : '', collection.lifecycle === 'archived' ? 'Archiv' : ''].filter(Boolean).join(' · ');
        if (details) header.append(make('span', details, 'overview-collection-meta'));
        article.append(header);
        if (kind === 'rehearsal' && collection.played_songs.length) {
            const songs = make('div', undefined, 'overview-played');
            songs.append(make('span', 'Hrané skladby:', 'overview-played-label'));
            for (const song of collection.played_songs) {
                const songLink = make('a', `${song.title}${song.count > 1 ? ` ×${song.count}` : ''}`);
                songLink.href = `#song-${song.id}`;
                songs.append(songLink);
            }
            article.append(songs);
        }
        if (collection.entries.length) {
            const entries = make('div', undefined, 'overview-entries');
            for (const entry of collection.entries) entries.append(renderEntry(entry));
            article.append(entries);
        } else article.append(make('p', 'Zatím bez textových zápisků.', 'overview-empty'));
        return article;
    }

    function render(data) {
        const rehearsals = $('overview-rehearsal-list'), songs = $('overview-song-list');
        rehearsals.replaceChildren(); songs.replaceChildren();
        for (const item of data.rehearsals) rehearsals.append(renderCollection(item, 'rehearsal'));
        for (const item of data.songs) songs.append(renderCollection(item, 'song'));
        if (!data.rehearsals.length) rehearsals.append(make('p', 'Žádné zkoušky.', 'overview-empty'));
        if (!data.songs.length) songs.append(make('p', 'Žádné skladby.', 'overview-empty'));
        $('overview-meta').textContent = `Vytvořeno ${dateTime(data.generated_at)} · ${data.rehearsals.length} zkoušek · ${data.songs.length} skladeb`;
        $('overview-output').hidden = false;
    }

    $('overview-generate').addEventListener('click', async () => {
        const button = $('overview-generate'), status = $('overview-status');
        button.disabled = true;
        status.textContent = 'Sestavuji aktuální výpis…';
        try {
            const response = await fetch('php/ajax/vz2_overview.php', { credentials: 'same-origin', cache: 'no-store' });
            const data = await response.json();
            if (!response.ok || !data.ok) throw new Error(data.error || 'Výpis se nepodařilo načíst.');
            render(data);
            status.textContent = 'Hotovo. Dalším kliknutím výpis aktualizujete.';
            button.textContent = 'Aktualizovat výpis';
        } catch (error) {
            status.textContent = error.message || 'Výpis se nepodařilo načíst.';
        } finally { button.disabled = false; }
    });
})();
