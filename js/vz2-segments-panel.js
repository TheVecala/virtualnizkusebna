(function (root) {
    'use strict';
    const M = root.Vz2SegmentsModel;
    const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
    const rangeText = s => M.format(s.start_ms) + (s.end_ms === null ? ' · bod' : ' – ' + M.format(s.end_ms));
    // Embeddable view: receives data, reports selections; owns neither fetch nor playback.
    function mount(host, config = {}) {
        let models = [], options = { color: 'type', scale: 'shared', wave: false, labels: true, compact: false, zoom: 1, takes: true, passages: true, notes: true, ...config.options };
        let selected = null, playhead = null;
        const waves = new Map();
        host.classList.add('segment-panel');
        function choose(model, s) {
            selected = { recording_id: model.id, segment: s };
            host.querySelectorAll('[data-segment-id]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.segmentId === s.id && b.dataset.recordingId === String(model.id))));
            config.onSelect?.({ ...selected, recording: model.recording });
        }
        function segment(model, s, duration) {
            const b = el('button', undefined, 'segment-item ' + (s.end_ms === null ? 'segment-point' : 'segment-range') + ' segment-' + (s.kind === 'recording' ? 'whole' : s.kind));
            b.type = 'button'; b.dataset.segmentId = s.id; b.dataset.recordingId = model.id;
            const title = s.label + ' · ' + rangeText(s) + (s.song_title ? ' · ' + s.song_title : '') + (s.boundary === 'open' ? ' · chybí konec' : '');
            b.title = title; b.setAttribute('aria-label', title);
            b.setAttribute('aria-pressed', String(String(selected?.recording_id) === String(model.id) && selected?.segment.id === s.id));
            b.style.left = (s.start_ms / duration * 100) + '%';
            if (s.start_ms / duration > .8) b.classList.add('segment-near-end');
            if (s.end_ms !== null) b.style.width = ((s.end_ms - s.start_ms) / duration * 100) + '%';
            b.style.setProperty('--segment-color', M.color(s, model.id, options.color));
            const label = el('span', s.label, 'segment-label'); label.hidden = !options.labels; b.append(label);
            b.onclick = () => choose(model, s);
            b.ondblclick = () => config.onActivate?.({ recording_id: model.id, recording: model.recording, segment: s });
            return b;
        }
        function renderWave(model, plot, duration) {
            const data = waves.get(String(model.id));
            if (!options.wave) return;
            if (!data?.peaks?.length) { plot.append(el('span', data?.message || 'Křivka není načtená', 'segment-wave-message')); return; }
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.classList.add('segment-wave'); svg.setAttribute('viewBox', '0 0 1000 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
            svg.style.width = (data.duration_ms / duration * 100) + '%';
            const path = document.createElementNS(svg.namespaceURI, 'path');
            path.setAttribute('d', data.peaks.map((v, i) => 'M' + (i / data.peaks.length * 1000).toFixed(2) + ',' + (50 - v * 47).toFixed(2) + 'v' + (v * 94).toFixed(2)).join(' '));
            svg.append(path); plot.append(svg);
        }
        function render() {
            const scroll = host.querySelector('.segment-scroll')?.scrollLeft || 0;
            const focus = host.contains(document.activeElement) ? { ...document.activeElement.dataset } : null;
            host.replaceChildren(); host.classList.toggle('segment-compact', options.compact);
            if (!models.length) { host.append(el('p', 'Vyberte alespoň jednu nahrávku.', 'segment-empty')); return; }
            const viewport = el('div', undefined, 'segment-scroll'); viewport.tabIndex = 0; viewport.setAttribute('aria-label', 'Časový přehled nahrávek');
            const surface = el('div', undefined, 'segment-surface'); surface.style.width = (options.zoom * 100) + '%'; viewport.append(surface); host.append(viewport);
            const commonDuration = Math.max(...models.map(m => m.extent_ms));
            for (const model of models) {
                const duration = options.scale === 'shared' ? commonDuration : model.extent_ms;
                const card = el('section', undefined, 'segment-recording'); card.dataset.recordingId = model.id;
                const header = el('header', undefined, 'segment-recording-header');
                header.append(el('strong', model.name), el('span', (model.collection?.title || '') + ' · ' + (model.duration_ms === null ? 'Délka neznámá; osa po poslední značku' : M.format(model.duration_ms))));
                card.append(header);
                const ruler = el('div', undefined, 'segment-ruler');
                for (let i = 0; i <= 8; i++) { const tick = el('span', M.format(duration * i / 8)); tick.style.left = (i * 12.5) + '%'; ruler.append(tick); }
                card.append(ruler);
                const plot = el('div', undefined, 'segment-plot'); plot.dataset.recordingId = model.id; plot.dataset.duration = duration;
                renderWave(model, plot, duration);
                const visible = model.segments.filter(s => s.kind === 'take' ? options.takes : s.kind === 'passage' ? options.passages : options.notes);
                const takes = visible.filter(s => s.kind === 'take');
                // Keep passages below their take; overlapping takes receive separate rows.
                const rows = [];
                for (const takeRow of M.lanes(takes)) {
                    rows.push(takeRow);
                    const ids = new Set(takeRow.map(s => s.id));
                    rows.push(...M.lanes(visible.filter(s => s.kind === 'passage' && ids.has(s.parent_id))));
                }
                rows.push(...M.lanes(visible.filter(s => s.kind === 'passage' && (!s.parent_id || !takes.some(t => t.id === s.parent_id)))));
                // Point markers use lanes as well, keeping coincident annotations selectable.
                const pointSpacing = duration * (options.labels ? 155 : 24) / Math.max(200, viewport.clientWidth * options.zoom - 48);
                rows.push(...M.lanes(visible.filter(s => s.kind === 'note' || s.kind === 'boundary'), pointSpacing));
                if (!rows.length) plot.append(el('p', model.segments.length ? 'Tento výběr neobsahuje viditelné úseky.' : 'Nahrávka zatím nemá časové značky.', 'segment-empty'));
                for (const row of rows) { const lane = el('div', undefined, 'segment-lane'); for (const s of row) lane.append(segment(model, s, duration)); plot.append(lane); }
                const baseline = el('div', undefined, 'segment-lane segment-baseline');
                if (model.duration_ms !== null && model.duration_ms > 0) baseline.append(segment(model, { id: 'recording', kind: 'recording', label: 'Celá nahrávka', start_ms: 0, end_ms: model.duration_ms }, duration));
                else baseline.append(el('span', 'Konec nahrávky není známý', 'segment-unknown-end'));
                plot.append(baseline);
                const cursor = el('div', undefined, 'segment-playhead'); cursor.hidden = true; plot.append(cursor);
                card.append(plot);
                if (model.incomplete || model.omitted) card.append(el('p', [model.incomplete ? 'Nespárované hranice: ' + model.incomplete : '', model.omitted ? 'Značky mimo délku nahrávky: ' + model.omitted : ''].filter(Boolean).join(' · '), 'segment-warning'));
                surface.append(card);
            }
            viewport.scrollLeft = scroll;
            if (playhead) setPlayhead(playhead.recording_id, playhead.time_ms);
            if (focus?.segmentId) [...host.querySelectorAll('[data-segment-id]')].find(b => b.dataset.segmentId === focus.segmentId && b.dataset.recordingId === focus.recordingId)?.focus({ preventScroll: true });
        }
        function setPlayhead(id, ms) {
            playhead = { recording_id: id, time_ms: ms };
            for (const plot of host.querySelectorAll('.segment-plot')) {
                const cursor = plot.querySelector('.segment-playhead');
                cursor.hidden = String(id) !== plot.dataset.recordingId || ms === null;
                cursor.style.left = Math.max(0, Math.min(100, (ms || 0) / Number(plot.dataset.duration) * 100)) + '%';
            }
        }
        return {
            setData(recordings, context = {}) { models = recordings.map(r => M.build(r, context)); render(); },
            setOptions(next) { options = { ...options, ...next }; render(); },
            setWaveform(id, data) { waves.set(String(id), data); render(); },
            clearWaveforms() { waves.clear(); },
            clearSelection() { selected = null; host.querySelectorAll('[aria-pressed]').forEach(b => b.setAttribute('aria-pressed', 'false')); setPlayhead(null, null); },
            select(id, segmentId) { const model = models.find(m => String(m.id) === String(id)); const s = model?.segments.find(s => s.id === segmentId); if (s) choose(model, s); },
            setPlayhead,
            destroy() { host.replaceChildren(); host.classList.remove('segment-panel', 'segment-compact'); waves.clear(); }
        };
    }
    root.Vz2SegmentsPanel = { mount };
})(window);
