(function () {
    'use strict';
    const $ = id => document.getElementById(id), shell = $('player-shell'), body = $('player-body');
    let mode = 'empty', id = null, looper = null, collapsed = false, fullscreen = null, mixerPending = false, mixerVolumeBeforeMute = 1;
    let waveColors;
    let looperView = 'slider';
    const showWave = { wave: true, segments: false };
    function waveformColors() {
        if (waveColors) return waveColors;
        const styles = getComputedStyle(document.documentElement);
        waveColors = {
            idle: styles.getPropertyValue('--color-waveform-idle').trim(),
            played: styles.getPropertyValue('--color-waveform-played').trim(),
            playhead: styles.getPropertyValue('--color-waveform-playhead').trim()
        };
        return waveColors;
    }
    const mixer = $('mixer-panel'); body.append(mixer);
    function fileName(file) {
        const name = file?.title || file?.display_name || file?.original_name || '';
        const extension = file?.format || /\.([^.]+)$/.exec(file?.original_name || file?.display_name || '')?.[1];
        return name && extension && !name.toLowerCase().endsWith('.' + extension.toLowerCase()) ? name + '.' + extension : name;
    }
    // Retain Mixer handlers while showing secondary actions in the shared menu.
    $('mixer-menu-actions').prepend($('mt-offline'), $('mixer-copy-link'));
    const copy = $('looper-copy-link'), offline = $('looper-offline'), download = $('looper-export');
    const looperMenu = $('looper-options');
    const mixerMedia = matchMedia('(max-width: 767px)');
    function positionMixerDrawer() {
        if (mode !== 'mixer' || !mixerMedia.matches || $('mt-mixer').hidden) return;
        const notesActions = mixer.querySelector('.looper-timestamp-actions');
        const anchor = notesActions?.getBoundingClientRect().height ? notesActions : $('mt-mixer-toggle');
        mixer.style.setProperty('--mt-drawer-top', Math.max(0, anchor.getBoundingClientRect().bottom + 8) + 'px');
    }
    function offlineLabel(cached) {
        $('looper-offline-label').textContent = cached ? 'Odebrat offline kopii' : 'Uložit pro offline';
        $('looper-offline-status').textContent = cached ? 'uloženo v zařízení · ' + (looper?.source === 'offline' ? 'přehrávání ze zařízení' : 'přehrávání z původního zdroje')
            : looper?.blob ? 'přehrávání z načteného souboru · kopie není uložená' : 'přehrávání ze sítě';
        $('looper-offline-icon').className = cached ? 'ti ti-trash' : 'ti ti-wifi-off';
    }
    function getState() {
        if (mode === 'looper' && looper) return { mode, id, phase: looper.phase, loading: looper.phase === 'loading', playing: !looper.audio.paused, position: looper.audio.currentTime, duration: looper.audio.duration, collapsed, fullscreen: !!fullscreen };
        if (mode === 'mixer') { const s = window.MultitrackApp.getState(); return { ...s, mode, id, loading: mixerPending || ['metadata', 'loading', 'awaiting-confirmation'].includes(s?.phase), collapsed, fullscreen: !!fullscreen }; }
        return null;
    }
    function clock(value) { return window.Vz2Timestamps.format(Number.isFinite(value) ? value * 1000 : 0); }
    function error(text) { if (mode === 'looper') $('looper-status').textContent = text; else { $('mt-notice').hidden = false; $('mt-notice').textContent = text; } }
    function update() {
        const s = getState();
        shell.dataset.source = mode === 'looper' ? looper?.source || '' : mode === 'mixer' ? s?.source || '' : '';
        $('player-play').disabled = !s || s.phase !== 'ready';
        $('player-play').textContent = s?.playing ? '❚❚' : '▶';
        $('player-play').setAttribute('aria-label', s?.playing ? 'Pozastavit' : 'Přehrát');
        if (mode === 'mixer') {
            const ready = s?.phase === 'ready', volume = Number($('mt-master-volume').value) / 100;
            for (const name of ['looper-restart', 'looper-back', 'looper-play', 'looper-forward', 'looper-volume', 'looper-mute']) $(name).disabled = !ready;
            $('looper-play').firstElementChild.className = s?.playing ? 'ti ti-player-pause-filled' : 'ti ti-player-play-filled';
            $('looper-play').setAttribute('aria-label', s?.playing ? 'Pozastavit' : 'Přehrát');
            $('looper-play').title = s?.playing ? 'Pozastavit' : 'Přehrát';
            if (document.activeElement !== $('looper-volume')) $('looper-volume').value = volume;
            $('looper-volume-value').textContent = Math.round(volume * 100) + '%';
            $('looper-mute').setAttribute('aria-pressed', String(volume === 0));
            $('looper-mute').firstElementChild.className = volume === 0 ? 'ti ti-volume-off' : 'ti ti-volume';
            $('looper-mute').setAttribute('aria-label', volume === 0 ? 'Zapnout zvuk' : 'Ztlumit zvuk');
            $('looper-mute').title = volume === 0 ? 'Zapnout zvuk' : 'Ztlumit zvuk';
            return;
        }
        if (mode !== 'looper' || !looper) return;
        updateWaveActions();
        const a = looper.audio, ready = looper.phase === 'ready';
        for (const control of ['looper-restart', 'looper-back', 'looper-play', 'looper-forward', 'looper-loop', 'looper-seek']) $(control).disabled = !ready;
        $('looper-play').firstElementChild.className = s.playing ? 'ti ti-player-pause-filled' : 'ti ti-player-play-filled';
        $('looper-play').setAttribute('aria-label', s.playing ? 'Pozastavit' : 'Přehrát');
        $('looper-play').title = s.playing ? 'Pozastavit' : 'Přehrát';
        $('looper-seek').max = Number.isFinite(a.duration) ? a.duration : 0;
        if (document.activeElement !== $('looper-seek')) $('looper-seek').value = a.currentTime;
        $('looper-time').textContent = clock(a.currentTime); $('looper-duration').textContent = clock(a.duration);
        $('looper-loop').setAttribute('aria-pressed', String(a.loop));
        $('looper-mute').setAttribute('aria-pressed', String(a.muted));
        $('looper-mute').firstElementChild.className = a.muted || a.volume === 0 ? 'ti ti-volume-off' : 'ti ti-volume';
        $('looper-mute').setAttribute('aria-label', a.muted ? 'Zapnout zvuk' : 'Ztlumit zvuk');
        $('looper-mute').title = a.muted ? 'Zapnout zvuk' : 'Ztlumit zvuk';
        $('looper-volume-value').textContent = Math.round(a.volume * 100) + '%';
        if (!collapsed) {
            draw();
            if (looperView === 'segments') looper.segments?.setPlayhead(id, a.currentTime * 1000);
        }
    }
    function layout() {
        shell.dataset.mode = mode; shell.classList.toggle('player-collapsed', collapsed);
        for (const name of ['looper-restart', 'looper-back', 'looper-play', 'looper-forward', 'looper-loop']) {
            const control = $(name);
            if (mode === 'empty') {
                // Keep help reachable by mouse and keyboard; playback is blocked below.
                control.disabled = false;
                control.setAttribute('aria-disabled', 'true');
                control.setAttribute('aria-haspopup', 'dialog');
                control.setAttribute('aria-controls', 'player-help-dialog');
            } else {
                control.removeAttribute('aria-disabled');
                control.removeAttribute('aria-haspopup');
                control.removeAttribute('aria-controls');
            }
        }
        if (mode === 'empty') {
            $('looper-play').firstElementChild.className = 'ti ti-player-play-filled';
            $('looper-play').setAttribute('aria-label', 'Přehrát'); $('looper-play').title = 'Přehrát';
            $('looper-loop').setAttribute('aria-pressed', 'false');
        }
        body.hidden = mode === 'empty' || collapsed;
        $('looper-panel').hidden = mode !== 'looper'; mixer.hidden = mode !== 'mixer';
        $('player-mode').textContent = mode === 'mixer' ? 'Mixér' : mode === 'looper' ? 'Looper' : 'Přehrávač';
        for (const name of ['player-collapse', 'player-fullscreen', 'player-close']) $(name).disabled = mode === 'empty';
        $('player-collapse').disabled = mode === 'empty' || !!fullscreen;
        $('player-collapse').setAttribute('aria-expanded', String(!collapsed));
        $('player-collapse').setAttribute('aria-label', collapsed ? 'Rozbalit přehrávač' : 'Sbalit přehrávač');
        $('player-collapse').firstElementChild.className = collapsed ? 'ti ti-chevron-down' : 'ti ti-chevron-up';
        $('looper-menu-actions').hidden = mode !== 'looper';
        $('mixer-menu-actions').hidden = mode !== 'mixer';
        looperMenu.querySelector('summary').setAttribute('aria-label', mode === 'mixer' ? 'Otevřít menu Mixéru' : 'Otevřít menu Looperu');
        $('looper-close').querySelector('span').textContent = mode === 'mixer' ? 'Zavřít mixér' : 'Zavřít looper';
        $('mixer-copy-link').hidden = $('mt-offline').hidden = mode !== 'mixer';
        if (mode === 'empty') looperMenu.open = false;
        positionMixerDrawer();
        update();
    }
    function exitFullscreen() { window.Vz2Layout.exitFullscreen(shell); }
    function restoreFullscreen() {
        if (!fullscreen) return;
        const previous = fullscreen; fullscreen = null;
        shell.classList.remove('player-fullscreen'); collapsed = previous.collapsed;
        layout(); body.scrollTop = previous.scroll; $('looper-wave-scroll').scrollLeft = previous.waveScroll;
    }
    function resetShell() {
        exitFullscreen(); mode = 'empty'; id = null; collapsed = false; mixerPending = false;
        $('player-title').disabled = true; $('player-title-full').textContent = ''; $('player-title-mobile').textContent = ''; $('player-title').title = ''; $('looper-wave-name').textContent = '';
        looperMenu.open = false; layout();
    }
    function closeLooper() {
        const old = looper; looper = null;
        if (old) {
            old.segments?.destroy();
            old.abort.abort(); old.unwatch?.(); old.notes?.destroy(); old.audio.pause(); old.audio.removeAttribute('src'); old.audio.load(); old.audio.remove();
            old.audioSource?.release();
            if (old.url) URL.revokeObjectURL(old.url);
            old.peaks = null;
        }
        $('looper-wave-markers').replaceChildren();
        if (mode === 'looper') resetShell();
    }
    function select(nextMode, recording) {
        if (mode !== nextMode || id !== String(recording.id)) { exitFullscreen(); collapsed = false; looperMenu.open = false; }
        mode = nextMode; id = String(recording.id);
        const names = (recording.files || []).map(fileName).filter(Boolean);
        const title = nextMode === 'looper' ? (fileName(looper?.file) || recording.title) : (names.join(', ') || recording.title);
        const sourceTitle = recording.collection_title ? recording.collection_title + ' · ' + title : title;
        $('player-title-full').textContent = sourceTitle;
        const firstFile = recording.files?.[0];
        $('player-title-mobile').textContent = nextMode === 'mixer'
            ? (fileName(firstFile) || recording.title)
            : sourceTitle;
        $('player-title').title = 'Přejít k nahrávce: ' + sourceTitle; $('player-title').disabled = false;
        $('looper-wave-name').textContent = nextMode === 'looper' ? title : '';
        layout();
    }
    async function openLooper(recording, file, seconds = 0, seekRequested = false) {
        if (mode === 'looper' && id === String(recording.id) && looper) { select('looper', recording); if (seekRequested && looper.phase === 'ready') looper.audio.currentTime = Math.max(0, Math.min(looper.audio.duration || 0, seconds)); return; }
        closeLooper();
        const audio = document.createElement('audio'); audio.id = 'looper-audio'; audio.preload = 'auto'; audio.setAttribute('playsinline', ''); audio.hidden = true;
        const current = { audio, abort: new AbortController(), phase: 'loading', file, recording, peaks: null, url: null, blob: null, timestamps: [], markersDirty: true };
        looper = current; $('looper-panel').append(audio); select('looper', recording);
        $('looper-status').textContent = 'Načítám audio…'; $('looper-wave-scroll').scrollLeft = 0; offlineLabel(false);
        audio.volume = Number($('looper-volume').value);
        const live = () => looper === current;
        const adapter = {
            file,
            isPlaying: () => live() && !audio.paused && !audio.ended,
            pause: () => { if (live()) audio.pause(); },
            play: () => { if (!live()) throw Error('Looper již není otevřený.'); return audio.play(); },
            showWave: () => { if (live() && looperView === 'slider') setLooperView('wave'); },
            fitRange: (start, end) => {
                if (!live() || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) return;
                current.waveRange = { start, end }; current.markersDirty = true;
                $('looper-wave-scroll').scrollLeft = 0;
                if (current.phase === 'ready' && (audio.currentTime * 1000 < start || audio.currentTime * 1000 >= end)) seek(start / 1000);
                setLooperView(looperView === 'slider' ? 'wave' : looperView);
            },
            setAnnotationRange: range => {
                if (!live() || JSON.stringify(current.annotationRange) === JSON.stringify(range)) return;
                current.annotationRange = range; current.markersDirty = true; current.segments?.setDraftRange(range); draw();
            },
            waveform: () => current.peaks ? { peaks: current.peaks, duration_ms: file.duration_ms || Math.round(audio.duration * 1000) } : null,
            isLoading: () => audio.dataset.sourceSwitching === 'true',
            canPlay: () => live() && current.phase === 'ready' && !audio.error,
            currentTimeMs: () => Math.round(audio.currentTime * 1000),
            durationMs: () => Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : null,
            seek: ms => { if (live()) audio.currentTime = Math.max(0, Math.min(audio.duration || 0, ms / 1000)); },
            timestampsChanged: entries => { if (live()) { current.timestamps = entries; current.markersDirty = true; refreshSegments(current); if (!collapsed) draw(); } },
            playRange: async (start) => { if (!live() || current.phase !== 'ready') throw new Error('Looper není připravený.'); audio.loop = false; audio.currentTime = start / 1000; await audio.play(); }
        };
        current.notes = window.Vz2Timestamps.mount($('looper-timestamps'), recording.id, adapter);
        current.segments = window.Vz2SegmentsPanel.mount($('looper-segments'), {
            options: { compact: true }, controls: false,
            onViewportChange: setLooperViewport,
            onSelect: ({ segment }) => {
                if (!live()) return;
                window.Vz2TimestampStore.select({ recording_id: recording.id, item_id: segment.id });
            },
            onSeek: ({ time_ms }) => { if (live()) seek(time_ms / 1000); },
            onActivate: async ({ segment }) => {
                if (!live() || !adapter.canPlay()) return;
                try { await window.Vz2TimestampPlayback.play(adapter, { ...segment, recording_id: recording.id }, { owner: current.notes, onError: error }); }
                catch (e) { if (live()) error(e.message); }
            }
        });
        refreshSegments(current); setLooperView(looperView);
        audio.addEventListener('play', () => { if (live()) document.querySelectorAll('#content audio').forEach(a => a.pause()); });
        audio.addEventListener('loadedmetadata', () => { if (live()) audio.currentTime = Math.max(0, Math.min(audio.duration || 0, seconds)); }, { once: true });
        audio.addEventListener('loadedmetadata', () => { if (live()) { current.phase = 'ready'; refreshSegments(current); update(); } });
        audio.addEventListener('error', () => { if (live()) { current.phase = 'error'; error('Audio nelze přehrát. Zavřete Looper a obnovte seznam.'); update(); } });
        current.unwatch = window.Vz2Downloads.watch(file, audio, saved => {
            if (looper !== current) return;
            current.cached = saved; offlineLabel(saved);
        });
        current.cacheKey = window.Vz2Downloads.key(file);
        download.href = 'php/ajax/vz2_timestamps.php?action=export&recording_id=' + encodeURIComponent(recording.id);
        offline.disabled = true;
        try {
            const source = await window.Vz2Downloads.source(file, { signal: current.abort.signal });
            if (!live()) { source.release(); return; }
            current.audioSource = source; current.blob = source.blob; current.cached = source.local;
            current.source = source.local ? 'offline' : source.blob ? 'memory' : 'web';
            audio.src = source.url;
            offlineLabel(current.cached); offline.disabled = false; $('looper-status').textContent = '';
            ensureWaveform(current);
        } catch (e) { if (live()) { current.phase = 'error'; error(e.message); update(); } }
    }
    function updateWaveActions() {
        const visible = looper && looperView !== 'slider' && !looper.peaks;
        $('looper-wave-create').hidden = !visible;
        $('looper-wave-create').disabled = !looper?.audioSource || !!looper?.wavePromise;
        $('looper-wave-retry').hidden = !visible || !looper.waveFailed || !$('looper-show-wave').checked;
        $('looper-wave-retry').disabled = !!looper?.wavePromise;
    }
    function ensureWaveform(current = looper, { create = false } = {}) {
        if (!current || !current.audioSource || current.peaks || current.wavePromise ||
            (!create && (looperView === 'slider' || !$('looper-show-wave').checked))) return;
        current.waveFailed = false;
        $('looper-status').textContent = create ? 'Vytvářím křivku…' : 'Načítám křivku…';
        current.wavePromise = window.Vz2TimestampControls.fileWaveform(current.file, current.abort.signal,
            { blob: current.blob, decode: create || !!current.blob }).then(data => {
            if (looper !== current) return;
            current.peaks = data?.peaks || null;
            current.waveFailed = !data;
            current.segments.setWaveform(current.recording.id, data);
            $('looper-status').textContent = data ? '' : 'Křivka zatím není uložená (JSON chybí). Můžete ji vytvořit z audia.';
        }).catch(error => {
            if (looper === current && error.name !== 'AbortError') {
                current.waveFailed = true;
                $('looper-status').textContent = create ? 'Křivku se nepodařilo vytvořit. Zkuste to znovu.' : error.message;
            }
        }).finally(() => {
            current.wavePromise = null;
            if (looper === current) update();
        });
        updateWaveActions();
    }
    $('looper-wave-retry').onclick = () => ensureWaveform();
    $('looper-wave-create').onclick = () => {
        if (!looper || looper.wavePromise) return;
        showWave[looperView] = true;
        $('looper-show-wave').checked = true;
        looper.segments?.setOptions({ wave: true });
        ensureWaveform(looper, { create: true });
    };

    function renderWaveTimestamps(current, width, durationMs, view) {
        const markers = document.createDocumentFragment();
        const entries = window.Vz2TimestampModel.items({ id: current.recording.id, entries: current.timestamps || [], duration_ms: Math.round(durationMs) }).flatMap(item => {
            const start = { ...item.source, body: window.Vz2TimestampModel.timelineLabel(item), annotationId: item.id };
            if (item.end_ms === null) return [start];
            return [start, { annotationId: item.id, id: item.end_timestamp_id || item.timestamp_id, kind: item.kind === 'take' ? 'song_end' : 'passage_end', time_ms: item.end_ms,
                body: item.end_source?.body?.replace(/^[↑↓]$/, '') || window.Vz2TimestampModel.timelineLabel(item) }];
        }).sort((a, b) => a.time_ms - b.time_ms || Number(a.id) - Number(b.id));
        const visuals = {
            song_start: { arrow: 'M1 1V9H15 M10 4L15 9L10 14', name: 'Začátek skladby' },
            song_end: { arrow: 'M19 1V9H5 M10 4L5 9L10 14', name: 'Konec skladby' },
            passage: { name: 'Začátek pasáže' },
            passage_end: { name: 'Konec pasáže' },
            note: { name: 'Poznámka' }
        };
        if (durationMs > 0) entries.forEach(entry => {
            const ms = Number(entry.time_ms), visual = visuals[entry.kind];
            if (!visual || !Number.isFinite(ms) || ms < view.start || ms > view.end) return;
            const x = Math.min(width - 1, (ms - view.start) / (view.end - view.start) * width);
            const marker = document.createElement('button'); marker.type = 'button';
            const labelOnLeft = entry.kind === 'song_end' ? x >= 155 : x > width - 155;
            marker.className = 'looper-wave-marker' + (labelOnLeft ? ' is-label-left' : '');
            marker.dataset.timestampId = entry.id;
            marker.dataset.annotationId = entry.annotationId;
            const selected = window.Vz2TimestampStore.selection();
            marker.setAttribute('aria-pressed', String(selected?.recording_id === Number(current.recording.id) && selected?.item_id === entry.annotationId));
            marker.dataset.kind = entry.kind;
            marker.style.left = x + 'px';
            const description = visual.name + ': ' + entry.body + ' (' + window.Vz2Timestamps.format(ms) + ')';
            marker.title = description; marker.setAttribute('aria-label', description);
            if (visual.arrow) {
                const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                arrow.classList.add('looper-wave-boundary'); arrow.setAttribute('viewBox', '0 0 20 16');
                arrow.setAttribute('aria-hidden', 'true');
                const path = document.createElementNS(arrow.namespaceURI, 'path'); path.setAttribute('d', visual.arrow);
                arrow.append(path); marker.append(arrow);
            }
            if (entry.kind !== 'song_end' && entry.kind !== 'passage_end') {
                const label = document.createElement('span'); label.className = 'looper-wave-marker-label';
                const text = document.createElement('span'); text.className = 'looper-wave-marker-text'; text.textContent = entry.body;
                label.append(text); marker.append(label);
            }
            marker.onclick = event => { event.stopPropagation(); window.Vz2TimestampStore.select({ recording_id: current.recording.id, item_id: entry.annotationId }); seek(ms / 1000); };
            markers.append(marker);
        });
        for (const [edge, ms] of Object.entries(current.annotationRange || {})) {
            if (ms == null || ms < view.start || ms > view.end) continue;
            const marker = document.createElement('span'); marker.className = 'looper-draft-edge';
            marker.style.left = Math.min(width - 2, (ms - view.start) / (view.end - view.start) * width) + 'px';
            marker.textContent = edge === 'start' ? 'A' : 'B'; marker.setAttribute('aria-hidden', 'true'); markers.append(marker);
        }
        $('looper-wave-markers').replaceChildren(markers);
        current.markerWidth = width; current.markerDuration = durationMs; current.markersDirty = false;
    }
    function refreshSegments(current) {
        // Catalogue annotations are a snapshot; rebuild segments from the live timestamp list.
        current.segments?.setData([{ ...current.recording, annotations: undefined, entries: current.timestamps, timestamps: current.timestamps,
            duration_ms: Number.isFinite(current.audio.duration) ? Math.round(current.audio.duration * 1000) : current.recording.duration_ms }]);
    }
    function setLooperView(view) {
        looperView = view;
        $('looper-show-wave').checked = showWave[view] || false;
        const segments = view === 'segments';
        for (const name of ['slider', 'wave', 'segments']) $('looper-view-' + name).setAttribute('aria-pressed', String(view === name));
        $('looper-seek').hidden = view !== 'slider';
        $('looper-wave-scroll').hidden = view !== 'wave';
        $('looper-segments').hidden = !segments;
        $('looper-wave-option').hidden = view === 'slider';
        $('looper-zoom-controls').hidden = view === 'slider';
        if (segments) looper?.segments?.setOptions({ wave: $('looper-show-wave').checked, viewRange: looper.waveRange || null });
        ensureWaveform();
        update();
    }
    $('looper-show-wave').onchange = () => { showWave[looperView] = $('looper-show-wave').checked; setLooperView(looperView); };
    $('looper-view-slider').onclick = () => setLooperView('slider');
    $('looper-view-wave').onclick = () => setLooperView('wave');
    $('looper-view-segments').onclick = () => setLooperView('segments');
    const waveDuration = () => Math.max(1, Number.isFinite(looper?.audio.duration) ? looper.audio.duration * 1000 : looper?.file.duration_ms || 1);
    function waveRange() {
        const total = waveDuration();
        const range = looper?.waveRange;
        return range && range.start < total ? { start: range.start, end: Math.min(total, range.end) } : { start: 0, end: total };
    }
    function draw() {
        if (!$('looper-wave-scroll').clientWidth) return;
        const canvas = $('looper-wave'), width = Math.max(1, $('looper-wave-scroll').clientWidth), height = fullscreen && !matchMedia('(max-width: 767px)').matches ? 180 : 90;
        if (!looper || !width) return;
        $('looper-wave-track').style.width = width + 'px'; $('looper-wave-track').style.height = height + 'px';
        canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
        const durationMs = Number.isFinite(looper.audio.duration) ? looper.audio.duration * 1000 : 0;
        const view = waveRange(), span = view.end - view.start;
        canvas.dataset.rangeStart = view.start; canvas.dataset.rangeEnd = view.end;
        if (looper.markersDirty || looper.markerWidth !== width || looper.markerDuration !== durationMs) renderWaveTimestamps(looper, width, durationMs, view);
        const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, width, height);
        const colors = waveformColors();
        const peaks = $('looper-show-wave').checked ? looper.peaks : null;
        const x = (looper.audio.currentTime * 1000 - view.start) / span * width;
        if (peaks) {
            for (const played of [false, true]) {
                ctx.strokeStyle = played ? colors.played : colors.idle; ctx.beginPath();
                for (let i = 0; i < peaks.length; i++) {
                    const px = (i / peaks.length * durationMs - view.start) / span * width;
                    if (px < 0 || px > width) continue;
                    if ((px <= x) !== played) continue;
                    const h = Math.max(1, peaks[i] * (height / 2 - 3));
                    ctx.moveTo(px, height / 2 - h); ctx.lineTo(px, height / 2 + h);
                }
                ctx.stroke();
            }
        }
        ctx.strokeStyle = colors.playhead; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    shell.addEventListener('click', e => {
        if (mode !== 'empty') return;
        e.preventDefault(); e.stopImmediatePropagation();
        if (!$('player-help-dialog').open) $('player-help-dialog').showModal();
    }, true);
    $('player-help-close').onclick = () => $('player-help-dialog').close();
    $('player-collapse').onclick = () => { collapsed = !collapsed; layout(); };
    window.Vz2Layout.registerFullscreen(shell, {
        enter() {
            fullscreen = { collapsed, scroll: body.scrollTop, waveScroll: $('looper-wave-scroll').scrollLeft };
            collapsed = false; shell.classList.add('player-fullscreen');
            layout();
        },
        exit: restoreFullscreen
    });
    $('looper-close').onclick = () => { looperMenu.open = false; $('player-close').click(); };
    $('player-close').onclick = () => document.dispatchEvent(new Event('vz2:player-close'));
    $('mt-mixer-toggle').addEventListener('click', () => queueMicrotask(() => {
        if ($('mt-mixer-toggle').getAttribute('aria-expanded') !== 'true') return;
        const notesToggle = mixer.querySelector('.looper-timestamp-actions > button:first-child');
        if (notesToggle?.getAttribute('aria-expanded') === 'true') notesToggle.click();
        positionMixerDrawer();
    }));
    document.addEventListener('vz2:timestamp-actions-changed', positionMixerDrawer);
    window.addEventListener('resize', positionMixerDrawer);
    new ResizeObserver(positionMixerDrawer).observe(mixer);
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape' || mode !== 'mixer' || !mixerMedia.matches || $('mt-mixer').hidden || document.querySelector('dialog[open]')) return;
        $('mt-mixer-toggle').click(); $('mt-mixer-toggle').focus(); e.preventDefault(); e.stopPropagation();
    }, true);
    $('player-title').onclick = () => document.dispatchEvent(new Event('vz2:player-source'));
    $('player-play').onclick = async () => {
        window.Vz2Timestamps?.stopLoop();
        try { if (mode === 'looper') { if (looper.audio.paused) await looper.audio.play(); else looper.audio.pause(); } else if (mode === 'mixer') { if (window.MultitrackApp.getState()?.playing) window.MultitrackApp.pause(); else { document.querySelectorAll('#content audio').forEach(a => a.pause()); await window.MultitrackApp.play(); } } update(); }
        catch (e) { error(e.message); }
    };
    $('looper-play').onclick = () => $('player-play').click();
    const seek = seconds => { if (!looper || looper.phase !== 'ready') return; window.Vz2Timestamps.stopLoop(); looper.audio.currentTime = Math.max(0, Math.min(looper.audio.duration || 0, seconds)); update(); };
    $('looper-restart').onclick = () => mode === 'mixer' ? $('mt-restart').click() : seek(0);
    $('looper-back').onclick = () => mode === 'mixer' ? $('mt-backward').click() : seek((looper?.audio.currentTime || 0) - 5);
    $('looper-forward').onclick = () => mode === 'mixer' ? $('mt-forward').click() : seek((looper?.audio.currentTime || 0) + 5);
    $('looper-seek').oninput = e => seek(Number(e.target.value));
    function setLooperViewport(range) {
        if (!looper) return;
        const total = waveDuration();
        looper.waveRange = range.start === 0 && range.end === 1 ? null : { start: range.start * total, end: range.end * total };
        looper.markersDirty = true;
        looper.segments?.setOptions({ viewRange: looper.waveRange });
        draw();
    }
    const timeline = window.Vz2Timeline.mount($('looper-wave-scroll'), {
        accepts: () => true,
        getRect: () => $('looper-wave').getBoundingClientRect(),
        getRange: () => { const range = waveRange(), total = waveDuration(); return { start: range.start / total, end: range.end / total }; },
        setRange: setLooperViewport
    });
    $('looper-zoom-out').onclick = () => timeline.zoomBy(.5);
    $('looper-zoom-in').onclick = () => timeline.zoomBy(2);
    $('looper-zoom-reset').onclick = () => timeline.reset();
    $('looper-wave').onclick = e => { if (looper) { const range = waveRange(); seek((range.start + e.offsetX / $('looper-wave').clientWidth * (range.end - range.start)) / 1000); } };
    $('looper-volume').oninput = e => {
        if (mode === 'mixer') {
            $('mt-master-volume').value = Math.round(Number(e.target.value) * 100);
            $('mt-master-volume').dispatchEvent(new Event('input', { bubbles: true }));
            if (Number(e.target.value) > 0) mixerVolumeBeforeMute = Number(e.target.value);
            update();
        } else if (looper) { looper.audio.volume = Number(e.target.value); looper.audio.muted = false; update(); }
    };
    $('looper-mute').onclick = () => {
        if (mode === 'mixer') {
            const current = Number($('mt-master-volume').value) / 100;
            if (current > 0) mixerVolumeBeforeMute = current;
            $('mt-master-volume').value = Math.round((current === 0 ? mixerVolumeBeforeMute : 0) * 100);
            $('mt-master-volume').dispatchEvent(new Event('input', { bubbles: true }));
            update();
        } else if (looper) { looper.audio.muted = !looper.audio.muted; update(); }
    };
    $('looper-loop').onclick = () => { if (looper) { window.Vz2Timestamps.stopLoop(); looper.audio.loop = !looper.audio.loop; update(); } };
    copy.onclick = () => { if (!looper) return; looperMenu.open = false; window.Vz2CarMode.openShare(id, 'looper', Math.round(looper.audio.currentTime * 1000)); };
    download.onclick = () => { looperMenu.open = false; };
    offline.onclick = async () => {
        const current = looper; if (!current) return;
        if (current.cached && !confirm('Odebrat tuto offline kopii pouze z prohlížeče?')) return;
        offline.disabled = true;
        const wasCached = current.cached;
        try {
            if (wasCached) await window.Vz2Downloads.removeKey(current.cacheKey);
            else {
                $('looper-offline-status').textContent = 'ukládám do zařízení…';
                current.blob = await window.Vz2Downloads.enqueue(current.file, { blob: current.blob, decode: !!current.blob });
                if (looper !== current) return;
                if (!current.audioSource?.blob && !current.url) {
                    current.url = window.Vz2Offline.useBlob(current.audio, current.blob, error);
                    current.audioSource?.release();
                }
                current.source = 'offline';
            }
            current.cached = !wasCached;
            if (looper === current) offlineLabel(current.cached);
        }
        catch (e) { if (looper === current) { offlineLabel(current.cached); error(e.message); } }
        finally { if (looper === current) offline.disabled = false; }
    };
    document.addEventListener('vz2:timestamp-selected', e => {
        if (e.detail?.recording_id === Number(looper?.recording.id)) looper.segments?.select(e.detail.recording_id, e.detail.item_id, false);
        else looper?.segments?.clearSelection();
        $('looper-wave-markers').querySelectorAll('[data-annotation-id]').forEach(marker => marker.setAttribute('aria-pressed',
            String(e.detail?.recording_id === Number(looper?.recording.id) && e.detail?.item_id === marker.dataset.annotationId)));
    });
    document.addEventListener('multitrack:selected', () => { mixerPending = false; });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && looperMenu.open) { looperMenu.open = false; e.preventDefault(); return; }
    });
    document.addEventListener('click', e => { if (looperMenu.open && !looperMenu.contains(e.target)) looperMenu.open = false; });
    new ResizeObserver(() => { if (looper && !collapsed) draw(); }).observe($('looper-wave-scroll'));
    new ResizeObserver(() => {
        if (!looper) return;
        const width = $('looper-segments').clientWidth;
        if (width === looper.segmentsWidth) return;
        looper.segmentsWidth = width;
        if (width) looper.segments?.setOptions({});
    }).observe($('looper-segments'));
    setInterval(update, 100);
    window.Vz2Player = {
        getState, openLooper, closeLooper,
        seek(seconds) {
            window.Vz2Timestamps.stopLoop();
            if (mode === 'looper') seek(seconds);
            else if (mode === 'mixer') window.MultitrackApp.seek(seconds);
        },
        async play() {
            window.Vz2Timestamps.stopLoop();
            if (mode === 'looper' && looper?.phase === 'ready') await looper.audio.play();
            else if (mode === 'mixer' && getState()?.phase === 'ready') await window.MultitrackApp.play();
            update();
        },
        pause() { if (mode === 'looper') looper?.audio.pause(); else if (mode === 'mixer') window.MultitrackApp.pause(); update(); },
        showMixer(recording) { closeLooper(); if (mode !== 'mixer' || id !== String(recording.id)) mixerPending = true; select('mixer', recording); },
        hideMixer() { if (mode === 'mixer') resetShell(); },
        mixerFailed() { mixerPending = false; },
        canLeave(nextId, nextMode) { const current = getState(); if (!current || (String(nextId) === id && nextMode === mode)) return true; return window.Vz2TimestampEditor.canLeave() && ((!current.playing && !current.loading) || confirm('Přehrávač hraje nebo načítá audio. Zastavit jej a přejít jinam?')); }
    };
    layout();
}());
