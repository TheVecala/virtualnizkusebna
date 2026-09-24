(function () {
    'use strict';
    const $ = id => document.getElementById(id), shell = $('player-shell'), body = $('player-body');
    const store = window.idbKeyval.createStore('zkusebna-vz2-cache', 'audio');
    let mode = 'empty', id = null, looper = null, collapsed = false, fullscreen = null, mixerPending = false, ideasPrevious = null;
    const mixer = $('mixer-panel'); body.append(mixer);
    // Retain the Mixer IDs and event handlers; expose secondary actions in the shared header.
    $('player-actions').append($('mixer-copy-link'), $('mt-offline'));
    const copy = $('looper-copy-link'), offline = $('looper-offline'), download = $('looper-export');
    const looperMenu = $('looper-options');
    function offlineLabel(cached) {
        $('looper-offline-label').textContent = cached ? 'Odebrat offline kopii' : 'Uložit pro offline';
        $('looper-offline-status').textContent = cached ? 'uloženo v tomto prohlížeči' : 'přehrávám ze sítě';
    }
    function getState() {
        if (mode === 'looper' && looper) return { mode, id, phase: looper.phase, loading: looper.phase === 'loading' || looper.decoding, playing: !looper.audio.paused, position: looper.audio.currentTime, duration: looper.audio.duration, collapsed, fullscreen: !!fullscreen };
        if (mode === 'mixer') { const s = window.MultitrackApp.getState(); return { ...s, mode, id, loading: mixerPending || ['metadata', 'loading', 'awaiting-confirmation'].includes(s?.phase), collapsed, fullscreen: !!fullscreen }; }
        return null;
    }
    function clock(value) { if (!Number.isFinite(value)) return '0:00'; return Math.floor(value / 60) + ':' + String(Math.floor(value % 60)).padStart(2, '0'); }
    function validPeaks(data, file) {
        return data && Array.isArray(data.peaks) && data.peaks.length > 0 && data.peaks.length <= 4096
            && Number(data.duration_ms) === Number(file.duration_ms)
            && data.peaks.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1);
    }
    function error(text) { if (mode === 'looper') $('looper-status').textContent = text; else { $('mt-notice').hidden = false; $('mt-notice').textContent = text; } }
    function update() {
        const s = getState();
        $('player-play').disabled = !s || s.phase !== 'ready';
        $('player-play').textContent = s?.playing ? '❚❚' : '▶';
        $('player-play').setAttribute('aria-label', s?.playing ? 'Pozastavit' : 'Přehrát');
        if (mode !== 'looper' || !looper) return;
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
        if (!collapsed) draw();
    }
    function layout() {
        shell.dataset.mode = mode; shell.classList.toggle('player-collapsed', collapsed);
        body.hidden = mode === 'empty' || collapsed;
        $('looper-panel').hidden = mode !== 'looper'; mixer.hidden = mode !== 'mixer';
        $('player-mode').textContent = mode === 'mixer' ? 'MIXÉR' : mode === 'looper' ? 'LOOPER' : 'PŘEHRÁVAČ';
        for (const name of ['player-collapse', 'player-fullscreen', 'player-close']) $(name).disabled = mode === 'empty';
        $('player-collapse').disabled = mode === 'empty' || !!fullscreen;
        $('player-collapse').setAttribute('aria-expanded', String(!collapsed));
        $('player-collapse').setAttribute('aria-label', collapsed ? 'Rozbalit přehrávač' : 'Sbalit přehrávač');
        $('player-collapse').firstElementChild.className = collapsed ? 'ti ti-chevron-down' : 'ti ti-chevron-up';
        $('player-options').hidden = mode === 'empty';
        $('mixer-copy-link').hidden = $('mt-offline').hidden = mode !== 'mixer';
        if (mode !== 'looper') looperMenu.open = false;
        update();
    }
    function exitFullscreen() {
        if (!fullscreen) return;
        const previous = fullscreen; fullscreen = null;
        shell.classList.remove('player-fullscreen'); collapsed = previous.collapsed;
        $('player-fullscreen').setAttribute('aria-pressed', 'false'); $('player-fullscreen').setAttribute('aria-label', 'Celá obrazovka');
        $('looper-fullscreen').querySelector('i').className = 'ti ti-maximize';
        $('looper-fullscreen').querySelector('span').textContent = 'Celá obrazovka';
        if (mode === 'mixer' && previous.mixerExpanded !== !$('mt-mixer').hidden && !$('mt-mixer-toggle').hidden) $('mt-mixer-toggle').click();
        layout(); body.scrollTop = previous.scroll; $('looper-wave-scroll').scrollLeft = previous.waveScroll;
    }
    function resetShell() {
        exitFullscreen(); mode = 'empty'; id = null; collapsed = false; mixerPending = false;
        $('player-title').textContent = 'Vyberte nahrávku'; $('player-title').title = ''; $('looper-wave-name').textContent = '';
        $('player-options').open = false; looperMenu.open = false; layout();
    }
    function closeLooper() {
        const old = looper; looper = null;
        if (old) {
            old.abort.abort(); old.notes?.destroy(); old.audio.pause(); old.audio.removeAttribute('src'); old.audio.load(); old.audio.remove();
            if (old.url) URL.revokeObjectURL(old.url);
            if (old.context) old.context.close().catch(() => {});
            old.peaks = null;
        }
        $('looper-wave-regions').replaceChildren(); $('looper-wave-markers').replaceChildren();
        if (mode === 'looper') resetShell();
    }
    function select(nextMode, recording) {
        if (mode !== nextMode || id !== String(recording.id)) { exitFullscreen(); collapsed = false; $('player-options').open = false; looperMenu.open = false; }
        mode = nextMode; id = String(recording.id);
        const title = nextMode === 'looper' ? (looper?.file?.title || recording.title) : recording.title;
        $('player-title').textContent = title; $('player-title').title = title;
        $('looper-wave-name').textContent = nextMode === 'looper' ? title : '';
        layout();
    }
    async function openLooper(recording, file, seconds = 0, seekRequested = false) {
        if (mode === 'looper' && id === String(recording.id) && looper) { select('looper', recording); if (seekRequested && looper.phase === 'ready') looper.audio.currentTime = Math.max(0, Math.min(looper.audio.duration || 0, seconds)); return; }
        closeLooper();
        const audio = document.createElement('audio'); audio.id = 'looper-audio'; audio.preload = 'auto'; audio.setAttribute('playsinline', ''); audio.hidden = true;
        const current = { audio, abort: new AbortController(), phase: 'loading', decoding: false, file, recording, peaks: null, url: null, context: null, blob: null, timestamps: [], markersDirty: true };
        looper = current; $('looper-panel').append(audio); select('looper', recording);
        $('looper-status').textContent = 'Načítám audio…'; $('looper-zoom').value = 1; $('looper-wave-scroll').scrollLeft = 0; offlineLabel(false);
        audio.volume = Number($('looper-volume').value);
        const live = () => looper === current;
        const uploadPeaks = peakValues => {
            if (!window.VZ2.write) return;
            fetch('php/ajax/vz2_peaks.php', {
                method: 'POST', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.VZ2.csrf },
                body: JSON.stringify({ file_id: file.id, sha256: file.sha256, peaks: peakValues })
            }).then(async response => {
                if (response.ok || !live()) return;
                let reason = 'HTTP ' + response.status;
                try { const data = await response.json(); if (typeof data.error === 'string' && data.error) reason = data.error; } catch (_) { /* HTTP status remains available. */ }
                if (live()) $('looper-status').textContent = 'Průběh se nepodařilo uložit na server: ' + reason;
            }).catch(() => {
                if (live()) $('looper-status').textContent = 'Průběh se nepodařilo uložit na server: chyba spojení.';
            });
        };
        const adapter = {
            canPlay: () => live() && current.phase === 'ready' && !audio.error,
            currentTimeMs: () => Math.round(audio.currentTime * 1000),
            durationMs: () => Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : null,
            seek: ms => { if (live()) audio.currentTime = Math.max(0, Math.min(audio.duration || 0, ms / 1000)); },
            timestampsChanged: entries => { if (live()) { current.timestamps = entries; current.markersDirty = true; if (!collapsed) draw(); } },
            playRange: async (start) => { if (!live() || current.phase !== 'ready') throw new Error('Looper není připravený.'); audio.loop = false; audio.currentTime = start / 1000; await audio.play(); }
        };
        current.notes = window.Vz2Timestamps.mount($('looper-timestamps'), recording.id, adapter);
        audio.addEventListener('play', () => { if (live()) document.querySelectorAll('#content audio').forEach(a => a.pause()); });
        audio.addEventListener('loadedmetadata', () => { if (live()) { audio.currentTime = Math.max(0, Math.min(audio.duration || 0, seconds)); current.phase = 'ready'; update(); } }, { once: true });
        audio.addEventListener('error', () => { if (live()) { current.phase = 'error'; error('Audio nelze přehrát. Zavřete Looper a obnovte seznam.'); update(); } });
        current.cacheKey = window.VZ2.cachePrefix + 'audio:' + file.id + ':' + file.sha256;
        current.peakCacheKey = window.VZ2.cachePrefix + 'peaks:' + file.id + ':' + file.sha256;
        download.href = 'php/ajax/vz2_timestamps.php?action=export&recording_id=' + encodeURIComponent(recording.id);
        offline.disabled = true;
        try {
            const peaksUrl = 'php/ajax/vz2_peaks.php?id=' + encodeURIComponent(file.id) + '&hash=' + encodeURIComponent(file.sha256);
            const [offlineResult, peaksResult, localPeaksResult] = await Promise.allSettled([
                window.idbKeyval.get(current.cacheKey, store),
                fetch(peaksUrl, { credentials: 'same-origin', cache: 'no-store', signal: current.abort.signal }),
                window.idbKeyval.get(current.peakCacheKey, store)
            ]);
            if (!live()) return;
            let blob = offlineResult.status === 'fulfilled' ? offlineResult.value : null;
            current.cached = blob instanceof Blob;
            let peakData = null;
            if (peaksResult.status === 'fulfilled' && peaksResult.value.ok) {
                try {
                    const data = await peaksResult.value.json();
                    if (data.ok && validPeaks(data, file)) peakData = data;
                } catch (_) { /* A missing or damaged peaks file can be rebuilt. */ }
            }
            const serverPeaks = !!peakData;
            if (!peakData && localPeaksResult.status === 'fulfilled' && validPeaks(localPeaksResult.value, file)) peakData = localPeaksResult.value;
            if (peakData) {
                if (!live()) return;
                current.peaks = Float32Array.from(peakData.peaks);
                current.blob = current.cached ? blob : null;
                if (current.cached) { current.url = URL.createObjectURL(blob); audio.src = current.url; }
                else audio.src = file.url;
                offlineLabel(current.cached); offline.disabled = false;
                $('looper-status').textContent = ''; update();
                if (!serverPeaks) uploadPeaks(peakData.peaks);
                return;
            }
            if (!current.cached) {
                const response = await fetch(file.url, { credentials: 'same-origin', cache: 'no-store', signal: current.abort.signal });
                if (!response.ok) throw new Error('Audio nelze načíst. Obnovte přihlášení a seznam.');
                blob = await response.blob();
                if (blob.size !== Number(file.byte_size)) throw new Error('Audio se nestáhlo celé.');
            }
            if (!live()) return;
            current.blob = blob; current.url = URL.createObjectURL(blob); audio.src = current.url;
            offlineLabel(current.cached); offline.disabled = false;
            $('looper-status').textContent = 'Připravuji průběh…'; current.decoding = true;
            try {
                const context = new (window.AudioContext || window.webkitAudioContext)(); current.context = context;
                const buffer = await context.decodeAudioData(await blob.arrayBuffer());
                if (!live()) return;
                const count = Math.min(4096, buffer.length), peaks = new Float32Array(count);
                for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
                    const samples = buffer.getChannelData(channel);
                    for (let i = 0; i < count; i++) {
                        const start = Math.floor(i * samples.length / count), end = Math.floor((i + 1) * samples.length / count);
                        for (let j = start; j < end; j++) {
                            const sample = Math.abs(samples[j]);
                            if (Number.isFinite(sample)) peaks[i] = Math.max(peaks[i], Math.min(1, sample));
                        }
                    }
                }
                current.peaks = peaks; $('looper-status').textContent = '';
                const peakValues = Array.from(peaks);
                window.idbKeyval.set(current.peakCacheKey, { peaks: peakValues, duration_ms: file.duration_ms }, store).catch(() => {});
                uploadPeaks(peakValues);
            } catch (_) { if (live()) $('looper-status').textContent = 'Průběh není dostupný; audio a časový posuvník lze dál používat.'; }
            finally { if (current.context) { const context = current.context; current.context = null; if (context.state !== 'closed') await context.close().catch(() => {}); } current.decoding = false; }
            if (live()) update();
        } catch (e) { if (live()) { current.phase = 'error'; error(e.message); update(); } }
    }
    function renderWaveTimestamps(current, width, durationMs) {
        const regions = document.createDocumentFragment(), markers = document.createDocumentFragment();
        const entries = current.timestamps || [];
        const visuals = {
            song_start: { icon: '♪', color: '#58c878', name: 'Začátek skladby' },
            passage: { icon: '↔', color: '#f0a044', name: 'Pasáž' },
            note: { icon: '●', color: '#59aaf5', name: 'Poznámka' }
        };
        if (durationMs > 0) entries.forEach(entry => {
            const start = Number(entry.time_ms);
            if (entry.kind !== 'passage' || !Number.isFinite(start) || start < 0 || start > durationMs) return;
            const end = window.Vz2Timestamps.endOf(entry, entries, durationMs);
            if (end == null || end <= start) return;
            const region = document.createElement('div'); region.className = 'looper-wave-region';
            region.style.left = (start / durationMs * width) + 'px';
            region.style.width = (Math.min(end, durationMs) - start) / durationMs * width + 'px';
            regions.append(region);
        });
        if (durationMs > 0) entries.forEach(entry => {
            const ms = Number(entry.time_ms), visual = visuals[entry.kind];
            if (!visual || !Number.isFinite(ms) || ms < 0 || ms > durationMs) return;
            const x = Math.min(width - 1, ms / durationMs * width);
            const marker = document.createElement('button'); marker.type = 'button';
            marker.className = 'looper-wave-marker' + (x > width - 155 ? ' is-end' : '');
            marker.dataset.timestampId = entry.id;
            marker.style.left = x + 'px'; marker.style.setProperty('--marker-color', visual.color);
            const description = visual.name + ': ' + entry.body + ' (' + window.Vz2Timestamps.format(ms) + ')';
            marker.title = description; marker.setAttribute('aria-label', description);
            const label = document.createElement('span'); label.className = 'looper-wave-marker-label';
            const icon = document.createElement('span'); icon.className = 'looper-wave-marker-icon'; icon.textContent = visual.icon; icon.setAttribute('aria-hidden', 'true');
            const text = document.createElement('span'); text.className = 'looper-wave-marker-text'; text.textContent = entry.body;
            label.append(icon, text); marker.append(label);
            marker.onclick = event => { event.stopPropagation(); seek(ms / 1000); };
            markers.append(marker);
        });
        $('looper-wave-regions').replaceChildren(regions);
        $('looper-wave-markers').replaceChildren(markers);
        current.markerWidth = width; current.markerDuration = durationMs; current.markersDirty = false;
    }
    function draw() {
        const canvas = $('looper-wave'), width = Math.max(1, Math.min(16384, $('looper-wave-scroll').clientWidth * Number($('looper-zoom').value))), height = fullscreen ? 180 : 90;
        if (!looper || !width) return;
        $('looper-wave-track').style.width = width + 'px'; $('looper-wave-track').style.height = height + 'px';
        canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
        const durationMs = Number.isFinite(looper.audio.duration) ? looper.audio.duration * 1000 : 0;
        if (looper.markersDirty || looper.markerWidth !== width || looper.markerDuration !== durationMs) renderWaveTimestamps(looper, width, durationMs);
        const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, width, height);
        const peaks = looper.peaks;
        const x = (looper.audio.currentTime / (looper.audio.duration || 1)) * width;
        if (peaks) {
            for (const played of [false, true]) {
                ctx.strokeStyle = played ? '#c4cf24' : '#aeb3b7'; ctx.beginPath();
                for (let i = 0; i < peaks.length; i++) {
                    const px = i / peaks.length * width;
                    if ((px <= x) !== played) continue;
                    const h = Math.max(1, peaks[i] * (height / 2 - 3));
                    ctx.moveTo(px, height / 2 - h); ctx.lineTo(px, height / 2 + h);
                }
                ctx.stroke();
            }
        }
        ctx.strokeStyle = '#e2e4e1'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    $('player-collapse').onclick = () => { collapsed = !collapsed; layout(); };
    $('player-fullscreen').onclick = () => {
        if (fullscreen) exitFullscreen();
        else { fullscreen = { collapsed, scroll: body.scrollTop, waveScroll: $('looper-wave-scroll').scrollLeft, mixerExpanded: !$('mt-mixer').hidden }; collapsed = false; shell.classList.add('player-fullscreen'); if (mode === 'mixer' && $('mt-mixer').hidden && !$('mt-mixer-toggle').hidden) $('mt-mixer-toggle').click(); $('player-fullscreen').setAttribute('aria-pressed', 'true'); $('player-fullscreen').setAttribute('aria-label', 'Opustit celou obrazovku'); $('looper-fullscreen').querySelector('i').className = 'ti ti-minimize'; $('looper-fullscreen').querySelector('span').textContent = 'Ukončit celou obrazovku'; layout(); }
    };
    $('looper-fullscreen').onclick = () => { looperMenu.open = false; $('player-fullscreen').click(); };
    $('looper-close').onclick = () => { looperMenu.open = false; $('player-close').click(); };
    $('player-close').onclick = () => document.dispatchEvent(new Event('vz2:player-close'));
    $('player-play').onclick = async () => {
        try { if (mode === 'looper') { if (looper.audio.paused) await looper.audio.play(); else looper.audio.pause(); } else if (mode === 'mixer') { if (window.MultitrackApp.getState()?.playing) window.MultitrackApp.pause(); else { document.querySelectorAll('#content audio').forEach(a => a.pause()); await window.MultitrackApp.play(); } } update(); }
        catch (e) { error(e.message); }
    };
    $('looper-play').onclick = () => $('player-play').click();
    const seek = seconds => { if (!looper || looper.phase !== 'ready') return; window.Vz2Timestamps.stopLoop(); looper.audio.currentTime = Math.max(0, Math.min(looper.audio.duration || 0, seconds)); update(); };
    $('looper-restart').onclick = () => seek(0); $('looper-back').onclick = () => seek((looper?.audio.currentTime || 0) - 5); $('looper-forward').onclick = () => seek((looper?.audio.currentTime || 0) + 5);
    $('looper-seek').oninput = e => seek(Number(e.target.value)); $('looper-zoom').oninput = draw;
    $('looper-zoom-out').onclick = () => { $('looper-zoom').value = Math.max(1, Number($('looper-zoom').value) - 1); draw(); };
    $('looper-zoom-in').onclick = () => { $('looper-zoom').value = Math.min(16, Number($('looper-zoom').value) + 1); draw(); };
    $('looper-wave').onclick = e => { if (looper) seek(e.offsetX / $('looper-wave').clientWidth * looper.audio.duration); };
    $('looper-volume').oninput = e => { if (looper) { looper.audio.volume = Number(e.target.value); looper.audio.muted = false; update(); } };
    $('looper-mute').onclick = () => { if (looper) { looper.audio.muted = !looper.audio.muted; update(); } };
    $('looper-loop').onclick = () => { if (looper) { window.Vz2Timestamps.stopLoop(); looper.audio.loop = !looper.audio.loop; update(); } };
    copy.onclick = async () => { if (!looper) return; looperMenu.open = false; try { const url = new URL('index.php', location.href); url.search = new URLSearchParams({ v: '2', recording_id: id, view: 'looper', time_ms: Math.round(looper.audio.currentTime * 1000) }); await navigator.clipboard.writeText(url.href); $('looper-status').textContent = 'Odkaz zkopírován.'; } catch (e) { error(e.message); } };
    download.onclick = () => { looperMenu.open = false; };
    offline.onclick = async () => {
        const current = looper; if (!current) return;
        if (current.cached && !confirm('Odebrat tuto offline kopii pouze z prohlížeče?')) return;
        offline.disabled = true;
        try {
            if (current.cached) await window.idbKeyval.del(current.cacheKey, store);
            else {
                if (!current.blob) {
                    const response = await fetch(current.file.url, { credentials: 'same-origin', cache: 'no-store', signal: current.abort.signal });
                    if (!response.ok) throw new Error('Audio nelze uložit offline.');
                    const blob = await response.blob();
                    if (blob.size !== Number(current.file.byte_size)) throw new Error('Audio se nestáhlo celé.');
                    current.blob = blob;
                }
                if (looper !== current) return;
                await window.idbKeyval.set(current.cacheKey, current.blob, store);
            }
            current.cached = !current.cached;
            if (looper === current) offlineLabel(current.cached);
        }
        catch (e) { if (looper === current) error(e.message); }
        finally { if (looper === current) offline.disabled = false; }
    };
    document.addEventListener('multitrack:selected', () => { mixerPending = false; });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && looperMenu.open) { looperMenu.open = false; e.preventDefault(); return; }
        if (!fullscreen || document.querySelector('dialog[open]')) return;
        if (e.key === 'Escape') { if ($('player-options').open) $('player-options').open = false; else exitFullscreen(); e.preventDefault(); }
        if (e.key === 'Tab') { const controls = [...shell.querySelectorAll('button,input,select,a,summary')].filter(n => !n.disabled && n.getClientRects().length); const first = controls[0], last = controls.at(-1); if (e.shiftKey && document.activeElement === first) { last?.focus(); e.preventDefault(); } else if (!e.shiftKey && document.activeElement === last) { first?.focus(); e.preventDefault(); } }
    });
    document.addEventListener('click', e => { if (looperMenu.open && !looperMenu.contains(e.target)) looperMenu.open = false; });
    new ResizeObserver(() => { if (looper && !collapsed) draw(); }).observe($('looper-wave-scroll'));
    setInterval(update, 100);
    window.Vz2Player = {
        getState, openLooper, closeLooper,
        setIdeasMode(active) {
            if (active) { exitFullscreen(); ideasPrevious = { mode, id, collapsed }; if (mode !== 'empty') collapsed = true; }
            else { if (ideasPrevious?.mode === mode && ideasPrevious.id === id) collapsed = ideasPrevious.collapsed; ideasPrevious = null; }
            layout();
        },
        showMixer(recording) { closeLooper(); if (mode !== 'mixer' || id !== String(recording.id)) mixerPending = true; select('mixer', recording); },
        hideMixer() { if (mode === 'mixer') resetShell(); },
        mixerFailed() { mixerPending = false; },
        canLeave(nextId, nextMode) { const current = getState(); if (!current || (String(nextId) === id && nextMode === mode)) return true; return (!current.playing && !current.loading) || confirm('Přehrávač hraje nebo načítá audio. Zastavit jej a přejít jinam?'); }
    };
    layout();
}());
