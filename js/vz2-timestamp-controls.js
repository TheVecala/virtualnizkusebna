/* Controls shared by the timestamp editor. Playback remains owned by its host. */
(function (root) {
    'use strict';
    const make = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
    const format = ms => root.Vz2TimestampModel.format(ms);
    let serial = 0;
    function choice(host, label, searchable = false) {
        const id = 'annotation-choice-' + (++serial), button = make('button', '', 'annotation-choice-trigger');
        button.type = 'button'; button.setAttribute('aria-label', label); button.setAttribute('aria-haspopup', 'listbox'); button.setAttribute('aria-expanded', 'false');
        const popup = make('div', null, 'annotation-choice-popup'); popup.hidden = true;
        const search = make('input'); search.type = 'search'; search.placeholder = 'Hledat…'; search.setAttribute('aria-label', 'Hledat: ' + label); search.hidden = !searchable;
        const list = make('div', null, 'annotation-choice-list'); list.id = id; list.role = 'listbox'; list.setAttribute('aria-label', label); button.setAttribute('aria-controls', id);
        popup.append(search, list); host.classList.add('annotation-choice'); host.append(button);
        const dialog = host.closest('dialog'); dialog.append(popup);
        let options = [], value = '', changed = () => {}, active = 0;
        const close = (focus = false) => { popup.hidden = true; button.setAttribute('aria-expanded', 'false'); if (focus) button.focus(); };
        const filtered = () => options.filter(o => !searchable || o.label.toLocaleLowerCase('cs').includes(search.value.toLocaleLowerCase('cs')));
        function render() {
            list.replaceChildren();
            filtered().forEach((option, index) => {
                const row = make('button', option.label); row.type = 'button'; row.role = 'option'; row.tabIndex = index === active ? 0 : -1;
                row.dataset.value = option.value; row.setAttribute('aria-selected', String(option.value === value)); row.disabled = !!option.disabled;
                row.onclick = () => { value = option.value; updateLabel(); close(true); changed(value); };
                list.append(row);
            });
            if (!list.children.length) list.append(make('p', 'Žádná shoda.'));
        }
        const updateLabel = () => { button.textContent = (options.find(o => o.value === value)?.label || 'Vybrat…') + ' ▾'; };
        const position = () => {
            if (popup.hidden) return;
            const box = button.getBoundingClientRect(), viewport = root.visualViewport;
            const top = viewport?.offsetTop || 0, bottom = top + (viewport?.height || innerHeight);
            const above = box.top - top - 8, below = bottom - box.bottom - 8;
            const up = below < 210 && above > below;
            const maxHeight = Math.max(80, Math.min(260, up ? above : below));
            popup.style.maxHeight = maxHeight + 'px';
            const width = Math.min(Math.max(210, box.width), (viewport?.width || innerWidth) - 16);
            popup.style.width = width + 'px'; popup.style.left = Math.max(8, Math.min(box.left, (viewport?.width || innerWidth) - width - 8)) + 'px';
            popup.style.top = (up ? Math.max(top + 8, box.top - Math.min(maxHeight, popup.scrollHeight) - 3) : box.bottom + 3) + 'px';
        };
        button.onclick = () => {
            if (!popup.hidden) return close();
            host.closest('dialog')?.dispatchEvent(new Event('annotation-close-choices'));
            search.value = ''; active = Math.max(0, options.findIndex(o => o.value === value)); render(); popup.hidden = false;
            button.setAttribute('aria-expanded', 'true'); position();
            // Avoid opening the phone keyboard until the user explicitly chooses search.
            list.querySelector('[tabindex="0"]')?.focus({ preventScroll: true });
        };
        search.oninput = () => { active = 0; render(); };
        const keyboard = e => {
            if (e.key === 'Escape' && !popup.hidden) { e.preventDefault(); e.stopPropagation(); close(true); }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
                if (popup.hidden) { if (e.target === button) { e.preventDefault(); button.click(); } return; }
                if (e.target === search && e.key !== 'ArrowDown') return;
                e.preventDefault(); const rows = [...list.querySelectorAll('[role=option]:not(:disabled)')];
                let index = rows.indexOf(document.activeElement);
                index = e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, index + (e.key === 'ArrowUp' ? -1 : 1)));
                rows[index]?.focus();
            }
        };
        host.addEventListener('keydown', keyboard); popup.addEventListener('keydown', keyboard);
        const outside = e => { if (!host.contains(e.target) && !popup.contains(e.target)) close(); };
        const focusOutside = outside;
        document.addEventListener('pointerdown', outside); document.addEventListener('focusin', focusOutside);
        const closeOthers = () => close();
        dialog?.addEventListener('annotation-close-choices', closeOthers);
        root.visualViewport?.addEventListener('resize', position);
        root.addEventListener('resize', position); dialog.addEventListener('scroll', position, true);
        return {
            get value() { return value; }, set value(v) { value = String(v ?? ''); updateLabel(); },
            setOptions(rows) { options = rows.map(o => ({ ...o, value: String(o.value ?? '') })); updateLabel(); render(); },
            onChange(fn) { changed = fn; }, close,
            destroy() { document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', focusOutside); dialog?.removeEventListener('annotation-close-choices', closeOthers); root.visualViewport?.removeEventListener('resize', position); root.removeEventListener('resize', position); dialog.removeEventListener('scroll', position, true); popup.remove(); }
        };
    }
    const waveCache = new Map();
    let peakStore;
    async function fileWaveform(file, signal) {
        if (!file?.url) return null;
        const key = (root.VZ2?.cachePrefix || '') + 'peaks:' + file.id + ':' + file.sha256;
        if (waveCache.has(key)) return waveCache.get(key);
        const valid = data => data && Array.isArray(data.peaks) && data.peaks.length > 0 && data.peaks.length <= 4096 && data.peaks.every(p => Number.isFinite(p) && p >= 0 && p <= 1) && data.duration_ms > 0 && (file.duration_ms == null || Number(file.duration_ms) === Number(data.duration_ms));
        let data;
        try { if (root.idbKeyval) { peakStore ||= root.idbKeyval.createStore('zkusebna-vz2-cache', 'audio'); data = await root.idbKeyval.get(key, peakStore); } } catch (_) { /* Offline cache is optional. */ }
        if (!valid(data)) {
            try {
                const response = await fetch('php/ajax/vz2_peaks.php?id=' + encodeURIComponent(file.id) + '&hash=' + encodeURIComponent(file.sha256), { credentials: 'same-origin', signal });
                if (response.ok) data = await response.json();
            } catch (e) { if (signal.aborted) throw e; }
        }
        if (!valid(data)) {
            const source = await root.Vz2Downloads.read(file, { download: true, signal });
            signal.throwIfAborted();
            const context = new (root.AudioContext || root.webkitAudioContext)();
            try {
                const buffer = await context.decodeAudioData(await source.blob.arrayBuffer()); signal.throwIfAborted();
                const peaks = new Array(Math.min(4096, buffer.length)).fill(0);
                for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
                    const samples = buffer.getChannelData(channel);
                    for (let i = 0; i < peaks.length; i++) {
                        const from = Math.floor(i * samples.length / peaks.length), to = Math.floor((i + 1) * samples.length / peaks.length);
                        for (let j = from; j < to; j++) peaks[i] = Math.max(peaks[i], Math.min(1, Math.abs(samples[j]) || 0));
                    }
                }
                data = { peaks, duration_ms: Math.round(buffer.duration * 1000) };
            } finally { await context.close(); }
        }
        signal.throwIfAborted(); waveCache.set(key, data);
        if (peakStore) root.idbKeyval.set(key, data, peakStore).catch(() => {});
        if (waveCache.size > 6) waveCache.delete(waveCache.keys().next().value);
        return data;
    }
    function transport(host, adapter, recording, getRange, onError) {
        host.innerHTML = `<div class="annotation-wave" role="slider" tabindex="0" aria-label="Pozice přehrávání" aria-valuemin="0"><canvas></canvas><span class="annotation-wave-message">Načítám křivku…</span><span class="annotation-playhead"><b></b></span><span class="annotation-edge annotation-edge-start"><b>A</b></span><span class="annotation-edge annotation-edge-end"><b>B</b></span></div><div class="annotation-ruler"><span class="annotation-ticks"></span><span class="annotation-duration"></span></div><div class="annotation-transport"><button type="button" data-seek="-5000" aria-label="Zpět o 5 sekund">−5 s</button><button type="button" class="annotation-play" aria-label="Přehrát">▶</button><button type="button" data-seek="5000" aria-label="Vpřed o 5 sekund">+5 s</button><span></span><button type="button" data-zoom="out" aria-label="Oddálit křivku">−</button><button type="button" data-zoom="in" aria-label="Přiblížit křivku">+</button></div>`;
        const wave = host.querySelector('.annotation-wave'), canvas = wave.querySelector('canvas'), context = canvas.getContext('2d');
        const message = wave.querySelector('.annotation-wave-message'), playhead = wave.querySelector('.annotation-playhead'), play = host.querySelector('.annotation-play');
        const abort = new AbortController(); let data = null, dead = false, zoom = 1, start = 0, frame, lastDraw = '', gesture = null;
        const duration = () => Math.max(0, adapter?.durationMs?.() || recording.duration_ms || data?.duration_ms || 0);
        const current = () => Math.max(0, Math.round(adapter?.currentTimeMs?.() || 0));
        const span = () => Math.max(1, duration() / zoom);
        const clampStart = value => Math.max(0, Math.min(Math.max(0, duration() - span()), value));
        const seek = ms => {
            if (!adapter?.canPlay?.()) return;
            root.Vz2TimestampPlayback?.stop(); adapter.seek(Math.max(0, Math.min(duration() || Infinity, ms)));
        };
        const position = (node, at) => { node.hidden = at == null || at < start || at > start + span(); if (!node.hidden) { node.style.left = Math.max(0, Math.min(100, (at - start) / span() * 100)) + '%'; node.querySelector('b').style.transform = (at - start) / span() > .8 ? 'translateX(-100%)' : ''; } };
        function draw() {
            if (dead) return;
            const at = current(), total = duration(), ready = !!adapter?.canPlay?.(), playing = !!adapter?.isPlaying?.();
            if (playing && !gesture && (at < start || at > start + span())) start = clampStart(at - span() / 2);
            const range = getRange(), width = wave.clientWidth, height = wave.clientHeight;
            const signature = [start, span(), width, height, range.start, range.end, !!data, document.documentElement.dataset.theme].join(':');
            if (signature !== lastDraw && width && height) {
                lastDraw = signature; const dpr = root.devicePixelRatio || 1;
                canvas.width = width * dpr; canvas.height = height * dpr; context.setTransform(dpr, 0, 0, dpr, 0, 0);
                const colors = getComputedStyle(host);
                if (range.end != null) {
                    const left = Math.max(0, (range.start - start) / span() * width), right = Math.min(width, (range.end - start) / span() * width);
                    context.fillStyle = colors.getPropertyValue('--color-primary').trim() || '#008a91'; context.globalAlpha = .12;
                    context.fillRect(left, 0, Math.max(0, right - left), height); context.globalAlpha = 1;
                }
                context.strokeStyle = colors.getPropertyValue('--color-text-muted').trim() || '#718089'; context.beginPath();
                if (data?.peaks?.length) {
                    for (let x = 0; x < width; x += 2) {
                        const a = Math.floor((start + x / width * span()) / data.duration_ms * data.peaks.length);
                        const b = Math.ceil((start + (x + 2) / width * span()) / data.duration_ms * data.peaks.length);
                        let peak = 0; for (let i = Math.max(0, a); i < Math.min(data.peaks.length, b); i++) peak = Math.max(peak, data.peaks[i]);
                        const h = Math.max(1, peak * (height - 28) / 2); context.moveTo(x, height / 2 - h); context.lineTo(x, height / 2 + h);
                    }
                } else { context.moveTo(0, height / 2); context.lineTo(width, height / 2); }
                context.stroke();
                const ticks = host.querySelector('.annotation-ticks'); ticks.replaceChildren();
                for (let i = 0; i < 4; i++) {
                    const tick = make('span', format(start + span() * i / 4)); tick.style.left = (i * 25) + '%'; ticks.append(tick);
                    if (i && i / 4 * width + tick.offsetWidth > width - host.querySelector('.annotation-duration').offsetWidth - 12) tick.remove();
                }
            }
            wave.dataset.viewStart = String(start); wave.dataset.viewEnd = String(start + span());
            wave.setAttribute('aria-valuemax', String(total)); wave.setAttribute('aria-valuenow', String(at)); wave.setAttribute('aria-valuetext', format(at)); wave.setAttribute('aria-disabled', String(!ready));
            position(playhead, at); playhead.querySelector('b').textContent = format(at);
            position(wave.querySelector('.annotation-edge-start'), range.start); position(wave.querySelector('.annotation-edge-end'), range.end);
            host.querySelector('.annotation-duration').textContent = total ? 'celkem ' + format(total) : 'délka neznámá';
            host.querySelectorAll('[data-seek]').forEach(b => b.disabled = !ready);
            play.disabled = !ready; play.textContent = playing ? 'Ⅱ' : '▷'; play.setAttribute('aria-label', playing ? 'Pozastavit' : 'Přehrát');
            host.querySelector('[data-zoom=in]').disabled = !total || span() <= 2000;
            host.querySelector('[data-zoom=out]').disabled = zoom <= 1;
            frame = requestAnimationFrame(draw);
        }
        host.querySelectorAll('[data-seek]').forEach(b => b.onclick = () => seek(current() + Number(b.dataset.seek)));
        play.onclick = async () => {
            try { root.Vz2TimestampPlayback?.stop(); if (adapter.isPlaying?.()) adapter.pause(); else await (adapter.play ? adapter.play() : adapter.playRange(current())); }
            catch (e) { if (!dead) onError(e.message); }
        };
        host.querySelectorAll('[data-zoom]').forEach(b => b.onclick = () => {
            zoom = Math.max(1, Math.min(Math.max(1, duration() / 2000), zoom * (b.dataset.zoom === 'in' ? 2 : .5)));
            start = clampStart(current() - span() / 2);
        });
        wave.onpointerdown = e => { if (e.button !== 0 || !adapter?.canPlay?.()) return; gesture = { x: e.clientX, start, moved: false }; wave.setPointerCapture(e.pointerId); };
        wave.onpointermove = e => { if (gesture && Math.abs(e.clientX - gesture.x) > 6) { gesture.moved = true; start = clampStart(gesture.start - (e.clientX - gesture.x) / wave.clientWidth * span()); } };
        wave.onpointerup = e => { if (gesture && !gesture.moved) seek(start + (e.clientX - wave.getBoundingClientRect().left) / wave.clientWidth * span()); gesture = null; };
        wave.onpointercancel = () => { gesture = null; };
        wave.onkeydown = e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); seek(e.key === 'Home' ? 0 : e.key === 'End' ? duration() : current() + (e.key === 'ArrowLeft' ? -1000 : 1000)); start = clampStart(current() - span() / 2); } };
        Promise.resolve().then(async () => {
            await adapter?.prepare?.(); if (dead) return;
            data = await adapter?.waveform?.(abort.signal);
            if (!data && adapter?.file) data = await fileWaveform(adapter.file, abort.signal);
            if (!dead) { lastDraw = ''; message.hidden = !!data?.peaks?.length; message.textContent = 'Křivka není dostupná'; }
        }).catch(() => { if (!dead) message.textContent = 'Křivka není dostupná'; });
        draw();
        return { seek, destroy() { dead = true; abort.abort(); cancelAnimationFrame(frame); } };
    }
    root.Vz2TimestampControls = { choice, transport, fileWaveform };
})(window);
