(function () {
    'use strict';
    const Model = window.Vz2TimestampModel, Store = window.Vz2TimestampStore;
    const $ = id => document.getElementById(id);
    const mode = $('car-mode'), picker = $('car-picker'), linkDialog = $('time-link-dialog'), audio = $('car-audio');
    const mobile = matchMedia('(max-width: 767px)');
    let context, browseCollectionId, browseKind = 'song', pickerLevel = 'recordings';
    let timestampList = null, timestampId = null, timestampSerial = 0, activeChapter = null;
    let previousFocus = null, pendingSelection = null, linkTarget = null, ratingBusy = false;
    let single = null, audioSerial = 0;
    const format = seconds => Model.format(Math.max(0, Number(seconds) || 0) * 1000);
    const text = (tag, content, className) => {
        const node = document.createElement(tag);
        node.textContent = content;
        if (className) node.className = className;
        return node;
    };
    const currentRecording = () => context?.recordings.find(row => String(row.id) === String(context.player?.id));
    const collection = id => context?.collections.find(row => String(row.id) === String(id) && row.lifecycle === 'active');
    const fileName = file => {
        const name = file?.title || file?.display_name || file?.original_name || '';
        const ext = file?.format || /\.([^.]+)$/.exec(file?.original_name || file?.display_name || '')?.[1];
        return name && ext && !name.toLowerCase().endsWith('.' + ext.toLowerCase()) ? name + '.' + ext : name;
    };
    const recordingName = recording => {
        if (!recording) return 'Vybrat nahrávku';
        const names = (recording.files || []).map(fileName).filter(Boolean);
        return recording.kind === 'single' ? names[0] || recording.title || 'Nahrávka'
            : names.length > 1 ? names[0] + ' +' + (names.length - 1) : names[0] || recording.title || 'Vícestopá nahrávka';
    };
    const available = recording => recording?.lifecycle === 'active' && recording.files?.some(file => file.url);
    function playerState() {
        if (!single) return window.Vz2Player.getState();
        const duration = Number.isFinite(audio.duration) ? audio.duration : Number(single.file.duration_ms || 0) / 1000;
        return { id: single.id, mode: 'audio', phase: single.phase, loading: single.phase === 'loading',
            playing: single.phase === 'ready' && !audio.paused && !audio.ended,
            position: single.phase === 'ready' ? audio.currentTime : single.seconds, duration };
    }
    function readContext() {
        const app = window.Vz2App?.getCarContext();
        return app && { ...app, player: playerState() };
    }
    function releaseSingle() {
        ++audioSerial;
        const previous = single;
        single = null;
        audio.pause(); audio.removeAttribute('src'); audio.load();
        previous?.abort.abort(); previous?.audioSource?.release();
    }
    async function openSingle(recording, seconds = 0, recovering = false) {
        const file = recording.files.find(item => item.url);
        if (!file) { setStatus('Audio není dostupné.', true); return; }
        releaseSingle();
        const current = { id: String(recording.id), file, phase: 'loading', seconds: Math.max(0, Number(seconds) || 0), abort: new AbortController(), audioSource: null, autoRetried: false, recovering };
        single = current;
        const serial = audioSerial;
        audio.loop = false;
        tick();
        try {
            const source = await window.Vz2Downloads.source(file, { signal: current.abort.signal });
            if (serial !== audioSerial || single !== current) { source.release(); return; }
            current.audioSource = source; audio.src = source.url;
            audio.load();
        } catch (error) { if (single === current) { current.phase = 'error'; setStatus(error.message, true); tick(); } }
    }
    audio.addEventListener('loadedmetadata', () => {
        if (!single) return;
        const duration = Number.isFinite(audio.duration) ? Math.max(0, audio.duration) : single.seconds;
        audio.currentTime = Math.min(duration, single.seconds);
        single.phase = 'ready';
        if (single.recovering) { single.recovering = false; setStatus(audio.paused ? 'Nahrávka je připravená. Stiskni Play.' : ''); }
        tick();
    });
    function retrySingle(current, requestPlay = false) {
        if (single !== current) return;
        if (!current.audioSource) {
            const recording = context?.recordings.find(row => String(row.id) === current.id);
            if (recording) { setStatus('Znovu načítám nahrávku…'); void openSingle(recording, current.seconds, true); }
            return;
        }
        current.phase = 'loading'; current.recovering = true;
        setStatus('Znovu načítám nahrávku…'); tick();
        audio.src = current.audioSource.url; audio.load();
        if (requestPlay) audio.play().catch(() => {
            if (single === current && current.phase !== 'error') setStatus('Nahrávka se načítá. Po načtení stiskni Play.');
        });
    }
    audio.addEventListener('timeupdate', () => {
        if (single?.phase === 'ready' && Number.isFinite(audio.currentTime)) single.seconds = audio.currentTime;
    });
    audio.addEventListener('error', () => {
        const current = single;
        if (!current) return;
        if (!current.autoRetried && current.audioSource) {
            current.autoRetried = true; retrySingle(current); return;
        }
        current.phase = 'error'; current.recovering = false;
        setStatus('Audio nelze načíst. Stiskni Play pro další pokus.', true); tick();
    });
    audio.addEventListener('play', () => {
        document.querySelectorAll('audio').forEach(other => { if (other !== audio) other.pause(); });
        window.MultitrackApp?.pause();
        if (single) single.autoRetried = false;
    });
    function syncSingle() {
        if (mode.hidden || !mobile.matches) return;
        const app = window.Vz2App?.getCarContext();
        if (!app) return;
        const query = new URLSearchParams(location.search);
        const routeRecording = app.recordings.find(row => String(row.id) === query.get('recording_id'));
        const underlying = app.player;
        const selected = routeRecording || (underlying?.mode === 'looper' ? app.recordings.find(row => String(row.id) === underlying.id) : null);
        if (selected?.kind === 'single' && available(selected)) {
            if (!single || single.id !== String(selected.id)) {
                const transfer = underlying?.mode === 'looper' && String(underlying.id) === String(selected.id) ? underlying : null;
                if (underlying?.mode === 'looper') window.Vz2Player.closeLooper();
                const requestedMs = Number(query.get('time_ms') || 0);
                const seconds = transfer?.position ?? (Number.isFinite(requestedMs) ? Math.max(0, requestedMs) / 1000 : 0);
                openSingle(selected, seconds);
            }
        } else if (single && routeRecording?.kind === 'multitrack') releaseSingle();
    }
    function seek(seconds) {
        window.Vz2TimestampPlayback.stop();
        if (!single) return window.Vz2Player.seek(seconds);
        const duration = Number.isFinite(audio.duration) ? audio.duration : Number(single.file.duration_ms || 0) / 1000;
        const position = Math.max(0, Math.min(duration || 0, Number(seconds) || 0));
        single.seconds = position;
        if (single.phase === 'ready') audio.currentTime = position;
        tick();
    }
    async function play() {
        window.Vz2TimestampPlayback.stop();
        if (single) {
            if (single.phase === 'ready') { await audio.play(); setStatus(''); }
            else if (single.phase === 'error') { single.autoRetried = true; retrySingle(single, true); }
        }
        else await window.Vz2Player.play();
        tick();
    }
    function pause() { if (single) audio.pause(); else window.Vz2Player.pause(); tick(); }
    function setStatus(value, error = false) {
        $('car-status').textContent = value;
        $('car-status').classList.toggle('is-error', error);
    }
    function refreshContext() {
        syncSingle();
        context = readContext();
        const recording = currentRecording();
        const folder = collection(recording?.collection_id) || collection(context?.selected);
        const folderName = folder?.title || 'Vybrat složku';
        const name = recordingName(recording);
        $('car-folder').textContent = folderName;
        $('car-folder').setAttribute('aria-label', 'Změnit složku: ' + folderName);
        $('car-recording-name').textContent = name;
        $('car-recording-name').title = name;
        $('car-recording-name').classList.toggle('is-long', name.length > 26);
        $('car-recording').textContent = recording ? 'Změnit' : 'Vybrat';
        $('car-recording').setAttribute('aria-label', recording ? 'Změnit nahrávku: ' + name : 'Vybrat nahrávku');
        if (browseCollectionId == null) browseCollectionId = folder?.id;
        if (!picker.hidden) renderPicker();
        if ((timestampId == null ? '' : String(timestampId)) !== (recording?.id == null ? '' : String(recording.id))) loadTimestamps(recording?.id);
        if (!recording && !context?.player) setStatus('Vyber složku a nahrávku.');
        else if (recording && $('car-status').textContent === 'Vyber složku a nahrávku.') setStatus('');
    }
    async function loadTimestamps(id) {
        const serial = ++timestampSerial;
        timestampId = id || null;
        timestampList = null;
        activeChapter = null;
        renderChapters();
        if (!id) return;
        try {
            const result = await Store.load(id);
            if (serial !== timestampSerial || String(timestampId) !== String(id)) return;
            timestampList = result;
            renderChapters();
        } catch (error) { if (serial === timestampSerial) setStatus(error.message, true); }
    }
    function renderChapters() {
        const host = $('car-chapter-list');
        host.replaceChildren(); activeChapter = null;
        const starts = timestampList ? Model.items(timestampList).filter(item => item.kind === 'take') : [];
        if (!starts.length) {
            host.append(text('p', timestampId ? timestampList ? 'Žádné úseky.' : 'Načítám úseky…' : 'Po výběru nahrávky se zobrazí úseky.', 'car-empty'));
            return;
        }
        for (const row of starts) {
            const button = text('button', '', 'car-chapter');
            button.type = 'button'; button.dataset.chapterId = row.id;
            button.append(text('span', format(row.start_ms / 1000) + (row.end_ms === null ? '\nbez konce' : '\n– ' + format(row.end_ms / 1000)), 'car-chapter-time'),
                text('span', [row.song_title, row.label].filter((value, i, values) => value && values.indexOf(value) === i).join(' · '), 'car-chapter-name'),
                text('span', '', 'car-chapter-play'));
            if (row.end_ms === null) button.title = 'Konec úseku není doplněný.';
            button.lastElementChild.setAttribute('aria-hidden', 'true');
            button.addEventListener('click', async () => {
                if (context?.player?.phase !== 'ready') return;
                try {
                    Store.select({ recording_id: timestampId, item_id: row.id });
                    seek(row.start_ms / 1000);
                    await play();
                    setStatus('');
                    tick();
                } catch (error) { setStatus('Přehrávání se nepodařilo spustit. Stiskni Play.', true); }
            });
            host.append(button);
        }
        tick();
    }
    function tick() {
        if (mode.hidden) return;
        context = readContext();
        const player = context?.player, ready = player?.phase === 'ready';
        const position = Number.isFinite(player?.position) ? player.position : 0;
        const duration = Number.isFinite(player?.duration) ? player.duration : 0;
        $('car-position').textContent = format(position);
        $('car-duration').textContent = format(duration);
        const seek = $('car-seek');
        seek.max = String(duration); seek.disabled = !ready || duration <= 0;
        if (document.activeElement !== seek) seek.value = String(Math.min(position, duration));
        for (const id of ['car-back', 'car-forward']) $(id).disabled = !ready;
        $('car-play').disabled = !ready && !(single?.phase === 'error');
        for (const id of ['car-up', 'car-down']) $(id).disabled = !ready || !timestampList?.can_create || ratingBusy;
        $('car-chapter-list').querySelectorAll('.car-chapter').forEach(button => { button.disabled = !ready; });
        $('car-play').querySelector('span').classList.toggle('is-playing', !!player?.playing);
        $('car-play').setAttribute('aria-label', player?.playing ? 'Pozastavit' : 'Přehrát');
        const current = timestampList ? Model.activeTakes(timestampList, position * 1000) : [];
        const ids = new Set(current.map(item => item.id)), nextActive = [...ids].join(',');
        if (nextActive !== activeChapter) {
            activeChapter = nextActive;
            $('car-chapter-list').querySelectorAll('.car-chapter').forEach(button => {
                const isCurrent = ids.has(button.dataset.chapterId);
                button.classList.toggle('is-current', isCurrent);
                if (isCurrent) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current');
                if (isCurrent && button.dataset.chapterId === current[0]?.id && picker.hidden) button.scrollIntoView({ block: 'nearest' });
            });
        }
        if (String(player?.id || '') !== String(timestampId || '')) refreshContext();
    }
    function folderRecordings(id) {
        const linked = new Set((context?.linkedRecordings?.[String(id)] || []).map(String));
        return (context?.recordings || []).filter(row => row.lifecycle === 'active' && (String(row.collection_id) === String(id) || linked.has(String(row.id))));
    }
    function nameParts(value) {
        const name = text('strong', '', 'car-name');
        const chars = Array.from(value);
        const split = Math.ceil(chars.length * .65);
        name.append(text('span', chars.slice(0, split).join(''), 'car-name-start'), text('span', chars.slice(split).join(''), 'car-name-end'));
        name.title = value;
        return name;
    }
    function renderPicker() {
        const folder = collection(browseCollectionId);
        $('car-picker-folder').querySelector('strong').textContent = folder?.title || 'Vybrat složku';
        $('car-picker-recordings').hidden = pickerLevel !== 'recordings';
        $('car-picker-folders').hidden = pickerLevel !== 'folders';
        $('car-picker-hint').textContent = pickerLevel === 'folders' ? 'Vyber složku a potom nahrávku.' : 'Vyber nahrávku. Přehrávání spustíš tlačítkem Play.';
        if (pickerLevel === 'folders') {
            const host = $('car-picker-folder-list'); host.replaceChildren();
            for (const tab of document.querySelectorAll('[data-car-kind]')) tab.setAttribute('aria-pressed', String(tab.dataset.carKind === browseKind));
            const folders = (context?.collections || []).filter(row => row.lifecycle === 'active' && row.kind === browseKind);
            if (!folders.length) host.append(text('p', 'Žádné složky.', 'car-empty'));
            folders.forEach(row => {
                const button = text('button', '', 'car-picker-row'); button.type = 'button';
                const count = folderRecordings(row.id).filter(available).length + ' nahrávek';
                button.setAttribute('aria-label', row.title + ' · ' + count);
                button.append(nameParts(row.title), text('small', count));
                button.addEventListener('click', () => { browseCollectionId = row.id; pickerLevel = 'recordings'; renderPicker(); });
                host.append(button);
            });
        } else {
            const host = $('car-picker-recordings'); host.replaceChildren();
            const recordings = folderRecordings(browseCollectionId);
            if (!recordings.length) host.append(text('p', 'V této složce nejsou nahrávky.', 'car-empty'));
            recordings.forEach(row => {
                const button = text('button', '', 'car-picker-row'); button.type = 'button';
                button.disabled = !available(row);
                button.setAttribute('aria-label', recordingName(row));
                button.append(text('span', row.kind === 'multitrack' ? '≋' : '♪', 'car-picker-icon'),
                    nameParts(recordingName(row)), text('small', button.disabled ? 'Audio není dostupné' : row.kind === 'multitrack' ? 'Mixér' : format(Number(row.files?.[0]?.duration_ms || 0) / 1000)));
                if (String(row.id) === String(context?.player?.id)) button.classList.add('is-selected');
                button.addEventListener('click', () => chooseRecording(row));
                host.append(button);
            });
        }
    }
    function showPicker(level = 'recordings') {
        context = readContext();
        const recording = currentRecording();
        browseCollectionId = recording?.collection_id || context?.selected;
        browseKind = collection(browseCollectionId)?.kind || context?.kind || 'song';
        pickerLevel = !browseCollectionId ? 'folders' : level;
        renderPicker(); picker.hidden = false; $('car-picker-close').focus();
    }
    function hidePicker() { picker.hidden = true; $('car-recording').focus(); }
    async function chooseRecording(recording) {
        hidePicker();
        pause();
        pendingSelection = String(recording.id);
        setStatus('Načítám nahrávku…');
        try {
            if (!await window.Vz2App.openCarRecording(recording)) { pendingSelection = null; setStatus('Nahrávku se nepodařilo otevřít.', true); return; }
            refreshContext();
        } catch (error) { pendingSelection = null; setStatus(error.message, true); }
    }
    function finishPendingSelection() {
        if (!pendingSelection) return;
        const player = playerState();
        if (String(player?.id) !== pendingSelection || player?.phase !== 'ready') return;
        pendingSelection = null;
        seek(0); setStatus('');
    }
    function open(manual = false, initialLevel = 'folders') {
        if (!mobile.matches) return;
        if (mode.hidden) {
            previousFocus = document.activeElement;
            window.Vz2TimestampPlayback.stop();
            document.querySelectorAll('audio').forEach(other => other.pause());
            window.Vz2Player.pause();
        }
        mode.hidden = false; document.body.classList.add('car-mode-open');
        if (manual) window.Vz2App?.setCarRoute(true, window.Vz2Player.getState());
        refreshContext(); $('car-close').focus();
        if (!context?.player && manual) showPicker(initialLevel);
    }
    function close(manual = false) {
        if (mode.hidden) return;
        const current = playerState();
        picker.hidden = true; mode.hidden = true; pendingSelection = null;
        document.body.classList.remove('car-mode-open');
        if (manual) window.Vz2App?.setCarRoute(false, current);
        if (single) releaseSingle();
        previousFocus?.focus?.();
    }
    function sync() {
        if (mobile.matches && new URLSearchParams(location.search).get('listen') === '1') {
            if (mode.hidden) open(); else refreshContext();
        } else close();
    }
    async function rate(symbol) {
        const player = playerState();
        if (!player || !timestampList?.can_create || ratingBusy) return;
        ratingBusy = true;
        $('car-up').disabled = $('car-down').disabled = true;
        setStatus('Ukládám hodnocení…');
        try {
            await Store.addQuickNote(player.id, symbol, Math.round(player.position * 1000));
            setStatus('Hodnocení uloženo jako poznámka.');
        } catch (error) { setStatus(error.message, true); }
        finally { ratingBusy = false; tick(); }
    }
    function openShare(id, view, ms) {
        linkTarget = { id, view, ms };
        $('time-link-car').checked = false;
        $('time-link-status').textContent = '';
        linkDialog.showModal(); $('time-link-car').focus();
    }
    $('car-mode-menu-open').onclick = () => open(true);
    $('car-close').onclick = () => close(true);
    $('car-folder').onclick = () => showPicker('folders');
    $('car-recording').onclick = () => showPicker();
    $('car-picker-folder').onclick = () => { pickerLevel = 'folders'; renderPicker(); };
    $('car-picker-close').onclick = hidePicker;
    picker.addEventListener('click', event => { if (event.target === picker) hidePicker(); });
    document.querySelectorAll('[data-car-kind]').forEach(button => button.addEventListener('click', () => { browseKind = button.dataset.carKind; renderPicker(); }));
    $('car-play').onclick = async () => {
        try { if (playerState()?.playing) { pause(); setStatus(''); } else await play(); }
        catch (_) { setStatus('Přehrávání se nepodařilo spustit.', true); }
        tick();
    };
    $('car-back').onclick = () => seek(Math.max(0, (playerState()?.position || 0) - 10));
    $('car-forward').onclick = () => seek((playerState()?.position || 0) + 10);
    $('car-seek').onchange = event => seek(Number(event.target.value));
    $('car-up').onclick = () => rate('👍'); $('car-down').onclick = () => rate('👎');
    document.addEventListener('vz2:timestamps-updated', event => {
        if (String(event.detail.recording_id) !== String(timestampId)) return;
        timestampList = event.detail; renderChapters();
    });
    document.addEventListener('vz2:car-context', sync);
    window.addEventListener('popstate', sync);
    mobile.addEventListener('change', sync);
    document.addEventListener('keydown', event => {
        if (mode.hidden) return;
        if (event.key === 'Escape') { picker.hidden ? close(true) : hidePicker(); event.preventDefault(); return; }
        if (event.key !== 'Tab') return;
        const host = picker.hidden ? mode : picker;
        const focusable = [...host.querySelectorAll('button:not(:disabled):not([hidden]), input:not(:disabled):not([hidden])')]
            .filter(element => element.getClientRects().length);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { last.focus(); event.preventDefault(); }
        else if (!event.shiftKey && document.activeElement === last) { first.focus(); event.preventDefault(); }
    }, true);
    $('time-link-close').onclick = () => linkDialog.close();
    $('time-link-copy').onclick = async () => {
        if (!linkTarget) return;
        const url = new URL('index.php', location.href);
        const listen = $('time-link-car').checked;
        url.search = new URLSearchParams({ v: '2', recording_id: linkTarget.id, time_ms: String(linkTarget.ms),
            ...(linkTarget.view || listen ? { view: listen && linkTarget.view !== 'mixer' ? 'audio' : linkTarget.view } : {}), ...(listen ? { listen: '1' } : {}) });
        try { await navigator.clipboard.writeText(url.href); $('time-link-status').textContent = 'Odkaz zkopírován.'; }
        catch (error) { $('time-link-status').textContent = 'Kopírování se nezdařilo: ' + error.message; }
    };
    setInterval(() => { if (!mode.hidden) { tick(); finishPendingSelection(); } }, 200);
    window.Vz2CarMode = {
        open, close, sync, openShare, getState: playerState,
        async openRecording(recording) {
            if (!mobile.matches) return;
            open(true);
            await chooseRecording(recording);
        }
    };
    sync();
}());
