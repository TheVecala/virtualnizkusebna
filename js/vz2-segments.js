(function () {
    'use strict';
    const $ = id => document.getElementById(id), M = window.Vz2SegmentsModel;
    const make = (tag, text) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; return n; };
    let catalog = null, selectedIds = new Set(), selection = null, loadedAudio = null, loadSerial = 0, playSerial = 0, animation = null;
    let audioSource = null;
    const audio = $('segments-audio'), waveCache = new Map();
    const panel = window.Vz2SegmentsPanel.mount($('segments-panel'), {
        onSelect: select,
        onActivate(value) { select(value); if (!$('segments-play').disabled) play(); }
    });
    function status(text, error = false) { $('segments-status').textContent = text; $('segments-status').classList.toggle('is-error', error); }
    async function get(url) {
        const r = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
        let data; try { data = await r.json(); } catch (_) { throw Error('Server nevrátil data. Ověřte přihlášení.'); }
        if (!r.ok || !data.ok) throw Error(data.error || 'Data nelze načíst.');
        return data;
    }
    function available() {
        return (catalog?.recordings || []).filter(r => r.lifecycle === 'active' && catalog.collections.some(c => String(c.id) === String(r.collection_id) && ['active', 'archived'].includes(c.lifecycle)));
    }
    function collectionName(r) { return catalog.collections.find(c => String(c.id) === String(r.collection_id))?.title || ''; }
    function matches(r) {
        const query = $('segments-search').value.trim().toLocaleLowerCase('cs');
        return (!$('segments-collection').value || String(r.collection_id) === $('segments-collection').value)
            && (!query || (M.name(r) + ' ' + r.title + ' ' + collectionName(r)).toLocaleLowerCase('cs').includes(query));
    }
    function stop() { window.Vz2TimestampPlayback.stop(); ++playSerial; audio.pause(); cancelAnimationFrame(animation); animation = null; }
    function clearSelection() {
        stop(); selection = null; loadedAudio = null; audioSource?.release(); audioSource = null; audio.removeAttribute('src'); audio.load();
        $('segments-selection').hidden = true; panel.clearSelection();
    }
    function list() {
        const host = $('segments-recordings'); host.replaceChildren();
        const stack = $('segments-view').value === 'stack';
        $('segments-select-all').hidden = $('segments-select-none').hidden = !stack;
        for (const r of available().filter(matches)) {
            const label = make('label'); label.className = 'segments-recording-option'; label.title = M.name(r);
            const input = make('input'); input.type = stack ? 'checkbox' : 'radio'; input.name = 'segment-recording'; input.value = r.id; input.checked = selectedIds.has(String(r.id));
            input.onchange = () => {
                if (!stack) selectedIds = new Set([String(r.id)]);
                else if (input.checked) selectedIds.add(String(r.id)); else selectedIds.delete(String(r.id));
                if (selection && !selectedIds.has(String(selection.recording_id))) clearSelection();
                render();
            };
            const text = make('span'); text.append(make('strong', M.name(r)), make('small', collectionName(r) + ' · ' + (r.duration_ms == null ? 'délka neznámá' : M.format(r.duration_ms))));
            label.append(input, text); host.append(label);
        }
        if (!host.childElementCount) host.append(make('p', 'Žádná nahrávka neodpovídá filtru.'));
        $('segments-count').textContent = selectedIds.size + ' vybráno / ' + available().length;
    }
    function options() {
        return { color: $('segments-color').value, scale: $('segments-scale').value, zoom: Number($('segments-zoom').value),
            wave: $('segments-wave').checked, compact: $('segments-compact').checked,
            labels: $('segments-labels').checked, takes: $('segments-takes').checked, passages: $('segments-passages').checked, notes: $('segments-notes').checked };
    }
    function legend(recordings) {
        const host = $('segments-legend'); host.replaceChildren(); const mode = $('segments-color').value;
        const entries = new Map();
        if (mode === 'type') for (const [kind, title] of [['recording', 'Celá nahrávka'], ['take', 'Úsek / skladba'], ['passage', 'Pasáž'], ['note', 'Poznámka'], ['boundary', 'Nespárovaný konec']]) entries.set(title, M.color({ kind }, 0, mode));
        else if (mode === 'mono') entries.set('Jednotná barva · význam určuje popisek a řádek', M.color({}, 0, mode));
        else for (const r of recordings) {
            if (mode === 'recording') entries.set(M.name(r), M.color({}, r.id, mode));
            else for (const s of M.build(r, catalog).segments) entries.set(s.song_title || 'Bez přiřazené skladby', M.color(s, r.id, mode));
        }
        for (const [title, color] of entries) { const item = make('span'), swatch = make('i'); swatch.className = 'segments-swatch'; swatch.style.setProperty('--segment-color', color); item.append(swatch, make('span', title)); host.append(item); }
    }
    async function loadWaves(recordings) {
        // Existing peaks only: enabling this view never downloads or decodes whole recordings.
        const queue = [...recordings];
        async function worker() {
            while (queue.length && $('segments-wave').checked) {
                const r = queue.shift(), file = r.files?.[0];
                if (r.kind === 'multitrack') { panel.setWaveform(r.id, { message: 'Křivka společného mixu není k dispozici; jednotlivé stopy otevřete v mixéru.' }); continue; }
                if (!file?.url || !file.sha256) { panel.setWaveform(r.id, { message: 'Křivka není k dispozici.' }); continue; }
                const key = String(file.id) + ':' + file.sha256;
                if (!waveCache.has(key)) waveCache.set(key, get('php/ajax/vz2_peaks.php?id=' + encodeURIComponent(file.id) + '&hash=' + encodeURIComponent(file.sha256)).then(data => {
                    if (!Array.isArray(data.peaks) || !data.peaks.length || data.peaks.length > 4096 || !data.peaks.every(v => Number.isFinite(v) && v >= 0 && v <= 1) || Number(data.duration_ms) !== Number(file.duration_ms)) throw Error('Uložená křivka neodpovídá nahrávce.');
                    return data;
                }).catch(e => ({ message: e.message })));
                const data = await waveCache.get(key);
                // Ignore a response for a file replaced during a catalogue refresh.
                if (available().find(item => String(item.id) === String(r.id))?.files?.[0]?.sha256 === file.sha256) panel.setWaveform(r.id, data);
            }
        }
        await Promise.all([worker(), worker(), worker()]);
    }
    function render() {
        if (!catalog) return;
        list(); const recordings = available().filter(r => selectedIds.has(String(r.id)));
        panel.setOptions(options()); panel.setData(recordings, catalog); legend(recordings);
        if ($('segments-wave').checked) void loadWaves(recordings);
    }
    function selectedFile() { return selection?.recording.kind === 'single' ? selection.recording.files?.[0] : null; }
    function select(value, refresh = false) {
        if (!refresh) stop(); selection = value; const { recording: r, segment: s } = value;
        const file = selectedFile();
        if (!refresh && loadedAudio !== file?.url) { audio.removeAttribute('src'); audio.load(); audioSource?.release(); audioSource = null; loadedAudio = null; }
        else if (!refresh && audio.readyState > 0) audio.currentTime = s.start_ms / 1000;
        $('segments-selection').hidden = false;
        $('segments-selected-title').textContent = s.label;
        $('segments-selected-info').textContent = [M.name(r), s.song_title].filter(Boolean).join(' · ');
        $('segments-selected-time').textContent = M.format(s.start_ms) + (s.end_ms === null ? ' · bod' : ' – ' + M.format(s.end_ms));
        $('segments-selected-body').textContent = s.boundary === 'derived' ? 'Pasáž končí na následující hranici nebo na konci úseku či nahrávky.' : s.boundary === 'open' ? 'Začátek zatím nemá spárovaný konec.' : '';
        $('segments-play').disabled = !file?.url; audio.hidden = !file?.url;
        $('segments-loop').disabled = s.end_ms === null; if (s.end_ms === null) $('segments-loop').checked = false;
        const params = new URLSearchParams({ v: '2', collection_id: r.collection_id, recording_id: r.id, view: r.kind === 'multitrack' ? 'mixer' : 'looper', time_ms: Math.round(s.start_ms) });
        $('segments-open').href = 'index.php?' + params;
        $('segments-open').textContent = r.kind === 'multitrack' ? 'Otevřít v mixéru' : 'Otevřít v looperu';
        $('segments-audio-status').textContent = r.kind === 'multitrack' ? 'Vícestopou nahrávku přehrajete v mixéru.' : file?.url ? loadedAudio ? 'Připraveno k přehrávání od vybrané značky.' : 'Audio se načte až po spuštění přehrávání.' : 'Audio není dostupné; značky zůstávají zobrazené.';
        $('segments-edit').textContent = s.kind === 'note' ? 'Upravit poznámku' : 'Upravit úsek';
        $('segments-edit').hidden = !s.can_edit || !['take', 'passage', 'note'].includes(s.kind);
        $('segments-finish').hidden = $('segments-edit').hidden || s.kind === 'note' || s.end_ms !== null;
        $('segments-delete').hidden = !s.can_delete;
        $('segments-new-take').hidden = $('segments-new-passage').hidden = $('segments-new-note').hidden = !window.VZ2.write;
        if (!refresh) {
            panel.setPlayhead(r.id, s.start_ms);
            window.Vz2TimestampStore.select({ recording_id: r.id, item_id: s.id });
        }
    }
    function atBoundary() {
        if (selection) panel.setPlayhead(selection.recording_id, audio.currentTime * 1000);
    }
    function tick() { atBoundary(); if (!audio.paused) animation = requestAnimationFrame(tick); }
    async function play() {
        if (!selection || !selectedFile()?.url) return;
        if (!audio.paused) { stop(); return; }
        const token = ++playSerial, value = selection, file = selectedFile();
        try {
            if (loadedAudio !== file.url) {
                const source = await window.Vz2Downloads.source(file);
                if (token !== playSerial) { source.release(); return; }
                audioSource?.release(); audioSource = source;
                audio.src = source.url; loadedAudio = file.url; audio.load();
            }
            await window.Vz2TimestampPlayback.play(adapter, { ...value.segment, recording_id: value.recording_id }, {
                repeat: $('segments-loop').checked, onError: text => { $('segments-audio-status').textContent = text; }
            });
            if (token !== playSerial) return;
            $('segments-audio-status').textContent = value.segment.end_ms === null ? 'Přehrávání od vybrané značky.' : 'Přehrávání vybraného úseku.';
            $('segments-audio-status').textContent += audioSource?.local ? ' Ze zařízení.' : ' Ze sítě.';
        } catch (e) { if (token === playSerial) $('segments-audio-status').textContent = 'Audio nelze přehrát. ' + e.message; }
    }
    audio.addEventListener('play', () => { $('segments-play').textContent = '❚❚ Pozastavit'; cancelAnimationFrame(animation); animation = requestAnimationFrame(tick); });
    audio.addEventListener('pause', () => { $('segments-play').textContent = '▶ Přehrát úsek'; cancelAnimationFrame(animation); });
    audio.addEventListener('timeupdate', atBoundary); audio.addEventListener('ended', atBoundary);
    audio.addEventListener('loadedmetadata', () => {
        if (selection && loadedAudio) audio.currentTime = Math.min(selection.segment.start_ms / 1000, Number.isFinite(audio.duration) ? audio.duration : Infinity);
    });
    audio.addEventListener('error', () => { $('segments-audio-status').textContent = 'Audio se nepodařilo načíst. Zkuste ho otevřít v přehrávači.'; });
    $('segments-play').onclick = play;
    async function load() {
        const serial = ++loadSerial; $('segments-reload').disabled = true; status('Načítám nahrávky…');
        try {
            const data = await get('php/ajax/vz2.php?action=catalog');
            if (serial !== loadSerial) return;
            clearSelection(); catalog = data; waveCache.clear(); panel.clearWaveforms();
            const rows = available(); selectedIds = new Set([...selectedIds].filter(id => rows.some(r => String(r.id) === id)));
            const requested = new URLSearchParams(location.search).get('recording_id');
            if (!selectedIds.size) {
                const first = rows.find(r => String(r.id) === requested) || rows.find(r => r.timestamps?.some(t => t.kind === 'song_start')) || rows[0];
                if (first) selectedIds.add(String(first.id));
            }
            const filter = $('segments-collection'), old = filter.value; filter.replaceChildren(new Option('Všechny', ''));
            catalog.collections.filter(c => rows.some(r => String(r.collection_id) === String(c.id))).forEach(c => filter.append(new Option(c.title, c.id)));
            filter.value = [...filter.options].some(o => o.value === old) ? old : '';
            render(); status(rows.length ? 'Společné časové značky · ' + rows.length + ' nahrávek' : 'Zatím nejsou žádné nahrávky.');
        } catch (e) { if (serial === loadSerial) status(e.message + (catalog ? ' Zobrazená data jsou z předchozího načtení.' : ' Zkuste Obnovit data.'), true); }
        finally { if (serial === loadSerial) $('segments-reload').disabled = false; }
    }
    $('segments-reload').onclick = load;
    $('segments-view').onchange = () => {
        if ($('segments-view').value === 'single' && selectedIds.size > 1) selectedIds = new Set([[...selectedIds][0]]);
        if (selection && !selectedIds.has(String(selection.recording_id))) clearSelection(); render();
    };
    for (const key of ['color', 'scale', 'zoom', 'wave', 'compact', 'labels', 'takes', 'passages', 'notes']) $('segments-' + key).onchange = render;
    $('segments-search').oninput = list; $('segments-collection').onchange = list;
    $('segments-select-all').onclick = () => { available().filter(matches).forEach(r => selectedIds.add(String(r.id))); render(); };
    $('segments-select-none').onclick = () => { selectedIds.clear(); clearSelection(); render(); };
    document.addEventListener('vz2:timestamps-updated', e => {
        const r = available().find(item => String(item.id) === String(e.detail.recording_id));
        if (r) { r.timestamps = e.detail.entries; r.annotations = e.detail.annotations; r.annotation_version = e.detail.annotation_version; r.duration_ms = e.detail.duration_ms; if (String(selection?.recording_id) === String(r.id)) {
                const item = M.build(r, catalog).segments.find(i => i.id === selection.segment.id);
                if (item) select({ ...selection, recording: r, segment: item }, true);
                else if (selection.segment.kind !== 'recording') clearSelection();
            } render(); }
    });
    const adapter = {
        canPlay: () => !!loadedAudio,
        isLoading: () => audio.readyState === 0 || audio.seeking,
        pause: () => audio.pause(),
        isPlaying: () => !audio.paused && !audio.ended,
        durationMs: () => Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : selection?.recording.duration_ms,
        get file() { return selectedFile(); },
        prepare: async () => {
            const file = selectedFile(), owner = selection;
            if (!file?.url || loadedAudio === file.url) return;
            const source = await window.Vz2Downloads.source(file);
            if (selection !== owner) { source.release(); return; }
            audioSource?.release(); audioSource = source; audio.src = source.url; loadedAudio = file.url; audio.load();
        },
        play: () => audio.play(),
        playRange: async start => { audio.currentTime = start / 1000; await audio.play(); },
        currentTimeMs: () => Math.round(audio.currentTime * 1000),
        seek: ms => { audio.currentTime = ms / 1000; }
    };
    const edit = async (kind, existing = false, finish = false) => {
        if (!selection) return;
        try { await window.Vz2TimestampEditor.open({ recording_id: selection.recording_id, kind,
            item_id: existing ? selection.segment.id : null, finish, adapter,
            draft: { time_ms: selection.segment.start_ms, end_time_ms: selection.segment.end_ms } }); }
        catch (e) { status(e.message, true); }
    };
    $('segments-loop').onchange = () => {
        const state = window.Vz2TimestampPlayback.state();
        if (state && selection) state.repeat = $('segments-loop').checked && selection.segment.end_ms !== null;
    };
    $('segments-edit').onclick = () => edit(selection?.segment.kind, true);
    $('segments-finish').onclick = () => edit(selection?.segment.kind, true, true);
    $('segments-new-take').onclick = () => edit('take');
    $('segments-new-passage').onclick = () => edit('passage');
    $('segments-new-note').onclick = () => edit('note');
    $('segments-delete').onclick = async () => {
        if (!selection || !confirm('Smazat vybrané časové značky? Nahrávka zůstane zachovaná.')) return;
        const chosen = selection;
        try {
            const list = await window.Vz2TimestampStore.load(chosen.recording_id);
            const current = window.Vz2TimestampModel.items(list).find(i => i.id === chosen.segment.id);
            if (!current || current.source.revision !== chosen.segment.source.revision) throw Error('Úsek byl změněn. Zkontrolujte aktuální údaje.');
            await window.Vz2TimestampStore.removeWithHistory(chosen.recording_id, current, list.timestamps_revision);
        } catch (e) { status(e.message, true); }
    };
    document.addEventListener('vz2:timestamp-selected', e => {
        if (!e.detail || (selection?.recording_id === e.detail.recording_id && selection?.segment.id === e.detail.item_id)) return;
        panel.select(e.detail.recording_id, e.detail.item_id);
    });
    const downloads = window.Vz2DownloadsPanel.mount($('segments-downloads').querySelector('div'), () => catalog);
    $('segments-downloads').addEventListener('toggle', () => { if ($('segments-downloads').open) downloads.open(); });
    window.addEventListener('pagehide', () => { stop(); audioSource?.release(); });
    void load();
})();
