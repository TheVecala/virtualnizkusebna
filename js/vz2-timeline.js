/* Shared normalized viewport and native pointer gestures. Never loads waveform data. */
(function (root) {
    'use strict';
    const minSpan = 1 / 256;
    function clamp(range) {
        const span = Math.max(minSpan, Math.min(1, range.end - range.start));
        const start = Math.max(0, Math.min(1 - span, range.start));
        return { start, end: start + span };
    }
    function mount(host, config) {
        const abort = new AbortController(), points = new Map();
        let base = null, moved = false, suppressUntil = 0, pending = null, frame = null;
        const flush = () => {
            if (frame != null) cancelAnimationFrame(frame);
            frame = null;
            if (pending) { const range = pending; pending = null; config.setRange(range); }
        };
        const schedule = range => { pending = clamp(range); if (frame == null) frame = requestAnimationFrame(flush); };
        const read = () => pending || clamp(config.getRange());
        const fraction = (x, box) => Math.max(0, Math.min(1, (x - box.left) / box.width));
        function rebase() {
            flush();
            const values = [...points.values()], box = config.getRect();
            if (!values.length || !box?.width) { base = null; return; }
            const a = values[0], b = values[1];
            base = { range: read(), box, x: b ? (a.x + b.x) / 2 : a.x, y: a.y,
                distance: b ? Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) : null };
        }
        host.addEventListener('pointerdown', e => {
            if (e.button !== 0 || !config.accepts(e.target)) return;
            if (!points.size) { moved = false; suppressUntil = 0; }
            points.set(e.pointerId, { x: e.clientX, y: e.clientY }); rebase();
            if (points.size > 1) { moved = true; for (const id of points.keys()) host.setPointerCapture(id); e.preventDefault(); }
        }, { signal: abort.signal });
        root.addEventListener('pointermove', e => {
            if (!points.has(e.pointerId) || !base) return;
            points.set(e.pointerId, { x: e.clientX, y: e.clientY });
            const values = [...points.values()], a = values[0], b = values[1];
            if (!moved && !b && Math.hypot(a.x - base.x, a.y - base.y) < 6) return;
            moved = true; suppressUntil = performance.now() + 600;
            host.setPointerCapture(e.pointerId); e.preventDefault();
            const span = base.range.end - base.range.start;
            if (b && base.distance) {
                const nextSpan = Math.max(minSpan, Math.min(1, span * base.distance / Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))));
                const anchor = base.range.start + fraction(base.x, base.box) * span;
                const start = anchor - fraction((a.x + b.x) / 2, base.box) * nextSpan;
                schedule({ start, end: start + nextSpan });
            } else {
                const start = base.range.start - (a.x - base.x) / base.box.width * span;
                schedule({ start, end: start + span });
            }
        }, { signal: abort.signal, passive: false });
        const finish = e => {
            if (!points.has(e.pointerId)) return;
            flush(); points.delete(e.pointerId);
            if (host.hasPointerCapture(e.pointerId)) host.releasePointerCapture(e.pointerId);
            if (moved) suppressUntil = performance.now() + 600;
            if (points.size) rebase(); else base = null;
        };
        root.addEventListener('pointerup', finish, { signal: abort.signal });
        root.addEventListener('pointercancel', finish, { signal: abort.signal });
        const preventGestureClick = e => {
            if (e.detail > 0 && (e.target === host || config.accepts(e.target)) && (moved && points.size || performance.now() < suppressUntil)) { e.preventDefault(); e.stopImmediatePropagation(); }
        };
        host.addEventListener('click', preventGestureClick, { capture: true, signal: abort.signal });
        host.addEventListener('dblclick', preventGestureClick, { capture: true, signal: abort.signal });
        function zoomBy(factor, anchor = .5) {
            const range = read(), span = range.end - range.start;
            const nextSpan = Math.max(minSpan, Math.min(1, span / factor));
            const start = range.start + anchor * (span - nextSpan);
            schedule({ start, end: start + nextSpan });
        }
        host.addEventListener('wheel', e => {
            if (!e.ctrlKey || !config.accepts(e.target)) return;
            const box = config.getRect(); if (!box?.width) return;
            e.preventDefault();
            const pixels = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? box.width : 1);
            zoomBy(Math.exp(-Math.max(-200, Math.min(200, pixels)) * .005), fraction(e.clientX, box));
        }, { passive: false, signal: abort.signal });
        return {
            zoomBy,
            reset() { schedule({ start: 0, end: 1 }); },
            destroy() { abort.abort(); if (frame != null) cancelAnimationFrame(frame); points.clear(); pending = null; }
        };
    }
    function controls(timeline) {
        const bar = document.createElement('div'); bar.className = 'timeline-zoom-controls'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', 'Přiblížení časové osy');
        for (const [text, label, action] of [['−', 'Oddálit', () => timeline.zoomBy(.5)], ['+', 'Přiblížit', () => timeline.zoomBy(2)], ['Celá nahrávka', 'Celá nahrávka', () => timeline.reset()]]) {
            const button = document.createElement('button'); button.type = 'button'; button.textContent = text; button.title = label; button.setAttribute('aria-label', label); button.onclick = action; bar.append(button);
        }
        return bar;
    }
    root.Vz2Timeline = { mount, controls, clamp };
})(window);
