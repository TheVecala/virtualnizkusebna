(function (root) {
    'use strict';
    const M = root.Vz2SegmentsModel;
    const el = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
    const rangeText = s => M.format(s.start_ms) + (s.end_ms === null ? (s.status === 'open' ? ' · doplnit konec' : ' · bod') : ' – ' + M.format(s.end_ms));
    // Embeddable view: receives data, reports selections; owns neither fetch nor playback.
    function mount(host, config = {}) {
        let models = [], options = { color: 'type', scale: 'shared', wave: false, labels: true, compact: false, zoom: 1, takes: true, passages: true, notes: true, ...config.options };
        let selected = null, playhead = null, draftRange = null, viewportRange = root.Vz2Timeline.clamp({ start: 0, end: 1 / Math.max(1, options.zoom) });
        const content = el('div', undefined, 'segment-content'); host.append(content);
        const waves = new Map();
        host.classList.add('segment-panel');
        function choose(model, s, notify = true) {
            selected = { recording_id: model.id, segment: s };
            host.querySelectorAll('[data-segment-id]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.segmentId === s.id && b.dataset.recordingId === String(model.id))));
            if (notify) config.onSelect?.({ ...selected, recording: model.recording });
        }
        function segment(model, s, view) {
            const b = el('button', undefined, 'segment-item ' + (s.end_ms === null ? 'segment-point' : 'segment-range') + ' segment-' + (s.kind === 'recording' ? 'whole' : s.kind));
            b.type = 'button'; b.dataset.segmentId = s.id; b.dataset.recordingId = model.id;
            const title = root.Vz2TimestampModel.timelineLabel(s) + ' · ' + rangeText(s) + (s.boundary === 'open' ? ' · chybí konec' : '');
            b.title = title; b.setAttribute('aria-label', title);
            b.setAttribute('aria-pressed', String(String(selected?.recording_id) === String(model.id) && selected?.segment.id === s.id));
            const start = Math.max(view.start, s.start_ms), span = view.end - view.start;
            b.style.left = ((start - view.start) / span * 100) + '%';
            if ((start - view.start) / span > .8) b.classList.add('segment-near-end');
            if (s.end_ms !== null) b.style.width = ((Math.min(view.end, s.end_ms) - start) / span * 100) + '%';
            b.style.setProperty('--segment-color', M.color(s, model.id, options.color));
            const label = el('span', root.Vz2TimestampModel.timelineLabel(s), 'segment-label'); label.hidden = !options.labels; b.append(label);
            b.onclick = () => choose(model, s);
            b.ondblclick = () => config.onActivate?.({ recording_id: model.id, recording: model.recording, segment: s });
            return b;
        }
        function renderWave(model, plot, view) {
            const data = waves.get(String(model.id));
            if (!options.wave) return;
            if (!data?.peaks?.length) { plot.append(el('span', data?.message || 'Křivka není načtená', 'segment-wave-message')); return; }
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.classList.add('segment-wave'); svg.setAttribute('viewBox', '0 0 1000 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
            svg.style.width = '100%';
            const path = document.createElementNS(svg.namespaceURI, 'path');
            path.setAttribute('d', data.peaks.map((v, i) => {
                const x = (i / data.peaks.length * data.duration_ms - view.start) / (view.end - view.start) * 1000;
                return x < 0 || x > 1000 ? '' : 'M' + x.toFixed(2) + ',' + (50 - v * 47).toFixed(2) + 'v' + (v * 94).toFixed(2);
            }).join(' '));
            svg.append(path); plot.append(svg);
        }
        function render() {
            const focus = host.contains(document.activeElement) ? { ...document.activeElement.dataset } : null;
            content.replaceChildren(); host.classList.toggle('segment-compact', options.compact);
            if (!models.length) { content.append(el('p', 'Vyberte alespoň jednu nahrávku.', 'segment-empty')); return; }
            const viewport = el('div', undefined, 'segment-scroll'); viewport.tabIndex = 0; viewport.setAttribute('aria-label', 'Časový přehled nahrávek');
            const surface = el('div', undefined, 'segment-surface'); viewport.append(surface); content.append(viewport);
            const commonDuration = Math.max(...models.map(m => m.extent_ms));
            for (const model of models) {
                const duration = Math.max(1, options.scale === 'shared' ? commonDuration : model.extent_ms);
                const range = getViewport();
                const view = options.viewRange && options.viewRange.start < duration && options.viewRange.end > options.viewRange.start ? { start: Math.max(0, options.viewRange.start), end: Math.min(duration, options.viewRange.end) }
                    : { start: range.start * duration, end: range.end * duration };
                const card = el('section', undefined, 'segment-recording'); card.dataset.recordingId = model.id;
                const header = el('header', undefined, 'segment-recording-header');
                header.append(el('strong', model.name), el('span', (model.collection?.title || '') + ' · ' + (model.duration_ms === null ? 'Délka neznámá; osa po poslední značku' : M.format(model.duration_ms))));
                card.append(header);
                const ruler = el('div', undefined, 'segment-ruler');
                for (let i = 0; i <= 8; i++) { const tick = el('span', M.format(view.start + (view.end - view.start) * i / 8)); tick.style.left = (i * 12.5) + '%'; ruler.append(tick); }
                card.append(ruler);
                const plot = el('div', undefined, 'segment-plot'); plot.dataset.recordingId = model.id; plot.dataset.duration = duration; plot.dataset.viewStart = view.start; plot.dataset.viewEnd = view.end;
                plot.tabIndex = 0; plot.setAttribute('role', 'slider'); plot.setAttribute('aria-label', 'Pozice v nahrávce ' + model.name);
                plot.setAttribute('aria-valuemin', '0'); plot.setAttribute('aria-valuemax', String(model.duration_ms || model.extent_ms));
                const seek = (time_ms, segment_id = null) => {
                    time_ms = Math.round(Math.max(0, Math.min(model.duration_ms || model.extent_ms, time_ms)));
                    setPlayhead(model.id, time_ms); config.onSeek?.({ recording_id: model.id, recording: model.recording, time_ms, segment_id });
                };
                plot.onclick = e => {
                    if (e.detail === 0) {
                        const button = e.target.closest('[data-segment-id]');
                        if (button) seek(model.segments.find(s => s.id === button.dataset.segmentId)?.start_ms || 0, button.dataset.segmentId);
                        return;
                    }
                    const box = plot.getBoundingClientRect();
                    seek(view.start + (e.clientX - box.left) / box.width * (view.end - view.start), e.target.closest('[data-segment-id]')?.dataset.segmentId);
                };
                plot.onkeydown = e => {
                    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
                    e.preventDefault();
                    const at = String(playhead?.recording_id) === String(model.id) ? playhead.time_ms : view.start;
                    seek(e.key === 'Home' ? view.start : e.key === 'End' ? view.end : at + (e.key === 'ArrowLeft' ? -1000 : 1000));
                };
                renderWave(model, plot, view);
                const visible = model.segments.filter(s => (s.end_ms == null ? s.start_ms >= view.start && s.start_ms <= view.end : s.start_ms < view.end && s.end_ms > view.start)
                    && (s.kind === 'take' ? options.takes : s.kind === 'passage' ? options.passages : options.notes));
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
                const pointSpacing = (view.end - view.start) * (options.labels ? options.compact ? 115 : 155 : 24) / Math.max(200, viewport.clientWidth - 48);
                rows.push(...M.lanes(visible.filter(s => s.kind === 'note' || s.kind === 'boundary'), pointSpacing));
                if (!rows.length) plot.append(el('p', model.segments.length ? 'Tento výběr neobsahuje viditelné úseky.' : 'Nahrávka zatím nemá časové značky.', 'segment-empty'));
                for (const row of rows) { const lane = el('div', undefined, 'segment-lane'); for (const s of row) lane.append(segment(model, s, view)); plot.append(lane); }
                const baseline = el('div', undefined, 'segment-lane segment-baseline');
                if (model.duration_ms !== null && model.duration_ms > 0) baseline.append(segment(model, { id: 'recording', kind: 'recording', label: 'Celá nahrávka', start_ms: 0, end_ms: model.duration_ms }, view));
                else baseline.append(el('span', 'Konec nahrávky není známý', 'segment-unknown-end'));
                plot.append(baseline);
                const cursor = el('div', undefined, 'segment-playhead'); cursor.hidden = true; plot.append(cursor);
                card.append(plot);
                if (model.incomplete || model.omitted) card.append(el('p', [model.incomplete ? 'Neúplné úseky a hranice: ' + model.incomplete : '', model.omitted ? 'Značky mimo délku nahrávky: ' + model.omitted : ''].filter(Boolean).join(' · '), 'segment-warning'));
                surface.append(card);
            }
            setDraftRange(draftRange);
            if (playhead) setPlayhead(playhead.recording_id, playhead.time_ms);
            if (focus?.segmentId) [...host.querySelectorAll('[data-segment-id]')].find(b => b.dataset.segmentId === focus.segmentId && b.dataset.recordingId === focus.recordingId)?.focus({ preventScroll: true });
        }
        function setPlayhead(id, ms) {
            playhead = { recording_id: id, time_ms: ms };
            for (const plot of host.querySelectorAll('.segment-plot')) {
                const cursor = plot.querySelector('.segment-playhead');
                const from = Number(plot.dataset.viewStart), to = Number(plot.dataset.viewEnd);
                cursor.hidden = String(id) !== plot.dataset.recordingId || ms === null || ms < from || ms > to;
                cursor.style.left = Math.max(0, Math.min(100, ((ms || 0) - from) / (to - from) * 100)) + '%';
                plot.setAttribute('aria-valuenow', String(String(id) === plot.dataset.recordingId ? ms || 0 : 0));
                plot.setAttribute('aria-valuetext', M.format(String(id) === plot.dataset.recordingId ? ms || 0 : 0));
            }
        }
        function setDraftRange(range) {
            draftRange = range;
            host.querySelectorAll('.segment-draft-edge').forEach(e => e.remove());
            for (const plot of host.querySelectorAll('.segment-plot')) {
                const from = Number(plot.dataset.viewStart), to = Number(plot.dataset.viewEnd);
                for (const [edge, ms] of Object.entries(range || {})) {
                    if (ms == null || ms < from || ms > to) continue;
                    const marker = el('span', edge === 'start' ? 'A' : 'B', 'segment-draft-edge');
                    marker.style.left = 'clamp(0px, ' + ((ms - from) / (to - from) * 100) + '%, calc(100% - 2px))'; marker.setAttribute('aria-hidden', 'true'); plot.append(marker);
                }
            }
        }
        function getViewport() {
            if (options.viewRange) {
                const total = Math.max(1, ...models.map(m => m.extent_ms));
                return { start: options.viewRange.start / total, end: options.viewRange.end / total };
            }
            return viewportRange;
        }
        const timeline = root.Vz2Timeline.mount(host, {
            accepts: target => !!target.closest('.segment-plot, .segment-ruler'),
            getRect: () => host.querySelector('.segment-plot')?.getBoundingClientRect(),
            getRange: getViewport,
            setRange(range) {
                if (config.onViewportChange) { config.onViewportChange(range); return; }
                viewportRange = range; options.zoom = 1 / (range.end - range.start);
                render(); config.onZoomChange?.(options.zoom);
            }
        });
        if (config.controls !== false) host.append(root.Vz2Timeline.controls(timeline));
        return {
            setDraftRange,
            setData(recordings, context = {}) { models = recordings.map(r => M.build(r, context)); render(); },
            setOptions(next) {
                if ('zoom' in next && next.zoom !== options.zoom && !config.onViewportChange) {
                    const center = (viewportRange.start + viewportRange.end) / 2, span = 1 / Math.max(1, next.zoom);
                    viewportRange = root.Vz2Timeline.clamp({ start: center - span / 2, end: center + span / 2 });
                }
                options = { ...options, ...next }; render();
            },
            setWaveform(id, data) { waves.set(String(id), data); render(); },
            clearWaveforms() { waves.clear(); },
            clearSelection() { selected = null; host.querySelectorAll('[aria-pressed]').forEach(b => b.setAttribute('aria-pressed', 'false')); setPlayhead(null, null); },
            select(id, segmentId, notify = true) { const model = models.find(m => String(m.id) === String(id)); const s = model?.segments.find(s => s.id === segmentId); if (s) choose(model, s, notify); },
            setPlayhead,
            destroy() { timeline.destroy(); host.replaceChildren(); host.classList.remove('segment-panel', 'segment-compact'); waves.clear(); }
        };
    }
    root.Vz2SegmentsPanel = { mount };
})(window);
