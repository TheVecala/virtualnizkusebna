(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const mode = $('car-mode'), picker = $('car-picker'), linkDialog = $('time-link-dialog');
    const mobile = matchMedia('(max-width: 767px)');
    let context, browseCollectionId, browseKind = 'song', pickerLevel = 'recordings';
    let timestampList = null, timestampId = null, timestampSerial = 0, activeChapter = null;
    let previousFocus = null, pendingPlay = null, linkTarget = null, ratingBusy = false;
    const format = seconds => window.Vz2Timestamps.format(Math.max(0, Number(seconds) || 0) * 1000);
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
    function setStatus(value, error = false) {
        $('car-status').textContent = value;
        $('car-status').classList.toggle('is-error', error);
    }
    function refreshContext() {
        context = window.Vz2App?.getCarContext();
        const recording = currentRecording();
        const folder = collection(recording?.collection_id) || collection(context?.selected);
        $('car-folder').textContent = folder?.title || 'Vybrat složku';
        $('car-recording').querySelector('strong').textContent = recordingName(recording);
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
            const result = await window.Vz2Timestamps.getList(id);
            if (serial !== timestampSerial || String(timestampId) !== String(id)) return;
            timestampList = result;
            renderChapters();
        } catch (error) { if (serial === timestampSerial) setStatus(error.message, true); }
    }
    function renderChapters() {
        const host = $('car-chapter-list');
        host.replaceChildren();
        const starts = (timestampList?.entries || []).filter(row => row.kind === 'song_start')
            .sort((a, b) => Number(a.time_ms) - Number(b.time_ms) || Number(a.id) - Number(b.id));
        if (!starts.length) {
            host.append(text('p', timestampId ? timestampList ? 'Žádné začátky skladeb.' : 'Načítám začátky skladeb…' : 'Po výběru nahrávky se zobrazí začátky skladeb.', 'car-empty'));
            return;
        }
        for (const row of starts) {
            const button = text('button', '', 'car-chapter');
            button.type = 'button'; button.dataset.chapterId = row.id;
            button.append(text('span', format(Number(row.time_ms) / 1000), 'car-chapter-time'),
                text('span', row.body.trim() === '↑' ? 'Začátek skladby' : row.body || 'Začátek skladby', 'car-chapter-name'),
                text('span', '', 'car-chapter-play'));
            button.lastElementChild.setAttribute('aria-hidden', 'true');
            button.addEventListener('click', async () => {
                if (context?.player?.phase !== 'ready') return;
                try {
                    window.Vz2Player.seek(Number(row.time_ms) / 1000);
                    await window.Vz2Player.play();
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
        context = window.Vz2App?.getCarContext();
        const player = context?.player, ready = player?.phase === 'ready';
        const position = Number.isFinite(player?.position) ? player.position : 0;
        const duration = Number.isFinite(player?.duration) ? player.duration : 0;
        $('car-position').textContent = format(position);
        $('car-duration').textContent = format(duration);
        const seek = $('car-seek');
        seek.max = String(duration); seek.disabled = !ready || duration <= 0;
        if (document.activeElement !== seek) seek.value = String(Math.min(position, duration));
        for (const id of ['car-back', 'car-forward', 'car-play']) $(id).disabled = !ready;
        for (const id of ['car-up', 'car-down']) $(id).disabled = !ready || !timestampList?.can_create || ratingBusy;
        $('car-chapter-list').querySelectorAll('.car-chapter').forEach(button => { button.disabled = !ready; });
        $('car-play').querySelector('span').classList.toggle('is-playing', !!player?.playing);
        $('car-play').setAttribute('aria-label', player?.playing ? 'Pozastavit' : 'Přehrát');
        const starts = (timestampList?.entries || []).filter(row => row.kind === 'song_start' && Number(row.time_ms) <= position * 1000)
            .sort((a, b) => Number(b.time_ms) - Number(a.time_ms) || Number(b.id) - Number(a.id));
        const nextActive = starts[0]?.id || null;
        if (String(nextActive) !== String(activeChapter)) {
            activeChapter = nextActive;
            $('car-chapter-list').querySelectorAll('.car-chapter').forEach(button => {
                const isCurrent = String(button.dataset.chapterId) === String(nextActive);
                button.classList.toggle('is-current', isCurrent);
                if (isCurrent) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current');
                if (isCurrent && picker.hidden) button.scrollIntoView({ block: 'nearest' });
            });
        }
        if (String(player?.id || '') !== String(timestampId || '')) refreshContext();
    }
    function renderPicker() {
        const folder = collection(browseCollectionId);
        $('car-picker-folder').querySelector('strong').textContent = folder?.title || 'Vybrat složku';
        $('car-picker-recordings').hidden = pickerLevel !== 'recordings';
        $('car-picker-folders').hidden = pickerLevel !== 'folders';
        $('car-picker-hint').textContent = pickerLevel === 'folders' ? 'Vyber složku a potom nahrávku.' : 'Vyber nahrávku. Po výběru se spustí od začátku.';
        if (pickerLevel === 'folders') {
            const host = $('car-picker-folder-list'); host.replaceChildren();
            for (const tab of document.querySelectorAll('[data-car-kind]')) tab.setAttribute('aria-pressed', String(tab.dataset.carKind === browseKind));
            const folders = (context?.collections || []).filter(row => row.lifecycle === 'active' && row.kind === browseKind);
            if (!folders.length) host.append(text('p', 'Žádné složky.', 'car-empty'));
            folders.forEach(row => {
                const button = text('button', '', 'car-picker-row'); button.type = 'button';
                button.append(text('strong', row.title), text('small', context.recordings.filter(r => String(r.collection_id) === String(row.id) && available(r)).length + ' nahrávek'));
                button.addEventListener('click', () => { browseCollectionId = row.id; pickerLevel = 'recordings'; renderPicker(); });
                host.append(button);
            });
        } else {
            const host = $('car-picker-recordings'); host.replaceChildren();
            const recordings = (context?.recordings || []).filter(row => String(row.collection_id) === String(browseCollectionId) && row.lifecycle === 'active');
            if (!recordings.length) host.append(text('p', 'V této složce nejsou nahrávky.', 'car-empty'));
            recordings.forEach(row => {
                const button = text('button', '', 'car-picker-row'); button.type = 'button';
                button.disabled = !available(row);
                button.append(text('span', row.kind === 'multitrack' ? '≋' : '♪', 'car-picker-icon'),
                    text('strong', recordingName(row)), text('small', button.disabled ? 'Audio není dostupné' : row.kind === 'multitrack' ? 'Mixér' : format(Number(row.files?.[0]?.duration_ms || 0) / 1000)));
                if (String(row.id) === String(context?.player?.id)) button.classList.add('is-selected');
                button.addEventListener('click', () => chooseRecording(row));
                host.append(button);
            });
        }
    }
    function showPicker(level = 'recordings') {
        context = window.Vz2App?.getCarContext();
        const recording = currentRecording();
        browseCollectionId = recording?.collection_id || context?.selected;
        browseKind = collection(browseCollectionId)?.kind || context?.kind || 'song';
        pickerLevel = !browseCollectionId ? 'folders' : level;
        renderPicker(); picker.hidden = false; $('car-picker-close').focus();
    }
    function hidePicker() { picker.hidden = true; $('car-recording').focus(); }
    async function chooseRecording(recording) {
        hidePicker();
        pendingPlay = String(recording.id);
        setStatus('Načítám nahrávku…');
        try {
            if (!await window.Vz2App.openCarRecording(recording)) { pendingPlay = null; setStatus('Nahrávku se nepodařilo otevřít.', true); return; }
            refreshContext();
        } catch (error) { pendingPlay = null; setStatus(error.message, true); }
    }
    async function tryPendingPlay() {
        if (!pendingPlay) return;
        const player = window.Vz2Player.getState();
        if (String(player?.id) !== pendingPlay || player?.phase !== 'ready') return;
        pendingPlay = null;
        try { window.Vz2Player.seek(0); await window.Vz2Player.play(); setStatus(''); }
        catch (_) { setStatus('Nahrávka je připravena. Spusť ji tlačítkem Play.'); }
    }
    function open(manual = false, initialLevel = 'folders') {
        if (!mobile.matches) return;
        if (mode.hidden) { previousFocus = document.activeElement; window.Vz2Timestamps?.stopLoop(); }
        mode.hidden = false; document.body.classList.add('car-mode-open');
        if (manual) window.Vz2App?.setCarRoute(true);
        refreshContext(); $('car-close').focus();
        if (!context?.player && manual) showPicker(initialLevel);
    }
    function close(manual = false) {
        if (mode.hidden) return;
        picker.hidden = true; mode.hidden = true; pendingPlay = null;
        document.body.classList.remove('car-mode-open');
        if (manual) window.Vz2App?.setCarRoute(false);
        previousFocus?.focus?.();
    }
    function sync() {
        if (mobile.matches && new URLSearchParams(location.search).get('listen') === '1') {
            if (mode.hidden) open(); else refreshContext();
        } else close();
    }
    async function rate(symbol) {
        const player = window.Vz2Player.getState();
        if (!player || !timestampList?.can_create || ratingBusy) return;
        ratingBusy = true;
        $('car-up').disabled = $('car-down').disabled = true;
        setStatus('Ukládám hodnocení…');
        try {
            await window.Vz2Timestamps.addQuickNote(player.id, symbol, Math.round(player.position * 1000));
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
    $('car-mode-collection-open').onclick = () => open(true, 'recordings');
    $('car-close').onclick = () => close(true);
    $('car-folder').onclick = () => showPicker('folders');
    $('car-recording').onclick = () => showPicker();
    $('car-picker-folder').onclick = () => { pickerLevel = 'folders'; renderPicker(); };
    $('car-picker-close').onclick = hidePicker;
    picker.addEventListener('click', event => { if (event.target === picker) hidePicker(); });
    document.querySelectorAll('[data-car-kind]').forEach(button => button.addEventListener('click', () => { browseKind = button.dataset.carKind; renderPicker(); }));
    $('car-play').onclick = async () => {
        try { if (window.Vz2Player.getState()?.playing) window.Vz2Player.pause(); else await window.Vz2Player.play(); setStatus(''); }
        catch (_) { setStatus('Přehrávání se nepodařilo spustit.', true); }
        tick();
    };
    $('car-back').onclick = () => window.Vz2Player.seek(Math.max(0, (window.Vz2Player.getState()?.position || 0) - 10));
    $('car-forward').onclick = () => window.Vz2Player.seek((window.Vz2Player.getState()?.position || 0) + 10);
    $('car-seek').onchange = event => window.Vz2Player.seek(Number(event.target.value));
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
            ...(linkTarget.view || listen ? { view: linkTarget.view || 'looper' } : {}), ...(listen ? { listen: '1' } : {}) });
        try { await navigator.clipboard.writeText(url.href); $('time-link-status').textContent = 'Odkaz zkopírován.'; }
        catch (error) { $('time-link-status').textContent = 'Kopírování se nezdařilo: ' + error.message; }
    };
    setInterval(() => { if (!mode.hidden) { tick(); tryPendingPlay(); } }, 200);
    window.Vz2CarMode = { open, close, sync, openShare };
    sync();
}());
