(function () {
    'use strict';
    const ns = 'http://www.w3.org/2000/svg';

    function shape(tag, attributes) {
        const element = document.createElementNS(ns, tag);
        Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
        return element;
    }

    function positions(meter) {
        const count = meter?.numerator || 1;
        const columns = Math.min(3, count);
        const rows = Math.ceil(count / columns);
        const starts = new Set();
        let start = 1;
        for (const group of meter?.groups || [1]) {
            if (start > 1) starts.add(start);
            start += group;
        }
        return Array.from({ length: count }, (_, index) => {
            const angle = index / count * Math.PI * 2 - Math.PI * 0.75;
            return {
                unit: index + 1, groupStart: starts.has(index + 1),
                x: 50 + (index % columns - (columns - 1) / 2) * 19,
                y: 50 + (Math.floor(index / columns) - (rows - 1) / 2) * 19,
                dx: Math.cos(angle), dy: Math.sin(angle)
            };
        });
    }

    function crashPoint(position, base) {
        const { dx, dy } = position;
        const scale = base === 'ride' ? 43 : 42 / Math.max(Math.abs(dx), Math.abs(dy));
        return { x: 50 + dx * scale, y: 50 + dy * scale };
    }

    function miniature(bar) {
        if (!bar.meter || bar.meter.numerator <= 6) return bar;
        const groups = [...bar.meter.groups];
        if (groups.length > 6) groups.splice(5, groups.length - 5, groups.slice(5).reduce((sum, size) => sum + size, 0));
        const marks = [];
        let first = 1;
        for (const [index, size] of groups.entries()) {
            const contained = bar.marks.filter(mark => mark.unit >= first && mark.unit < first + size);
            const states = new Set(contained.map(mark => mark.state));
            if (contained.length) marks.push({
                unit: index + 1,
                state: states.has('fill') ? 'fill' : states.has('pause') ? 'pause' : null,
                mixed: states.has('fill') && states.has('pause'),
                crash: contained.some(mark => mark.crash)
            });
            first += size;
        }
        return { ...bar, meter: { numerator: groups.length, groups: groups.map(() => 1) }, marks };
    }

    function render(value, large = false) {
        const rhythm = window.Vz2SongMapModel.fromLegacy(value);
        const bar = large ? rhythm : miniature(rhythm);
        const svg = shape('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true',
            class: large ? 'song-map-symbol song-map-symbol-large' : 'song-map-symbol' });
        if (bar.kind !== 'rhythm' || !bar.base) {
            const glyph = bar.kind === 'rhythm' ? 'F' + bar.unresolved_fill : { unknown: '?', pause: '—', stop: '■' }[bar.kind];
            const text = shape('text', { x: 50, y: 66, 'text-anchor': 'middle', 'font-size': 50 });
            text.textContent = glyph;
            svg.append(text);
            return svg;
        }
        const outline = bar.base === 'ride'
            ? shape('circle', { cx: 50, cy: 50, r: 43 })
            : shape('rect', { x: 8, y: 8, width: 84, height: 84 });
        outline.setAttribute('class', 'song-map-symbol-outline');
        svg.append(outline);
        const marks = new Map(bar.marks.map(mark => [mark.unit, mark]));
        for (const position of positions(bar.meter)) {
            const { unit, x, y } = position;
            const mark = marks.get(unit);
            if (mark?.state === 'fill') {
                svg.append(shape('circle', { cx: x, cy: y, r: 4.5 }));
            }
            if (mark?.state === 'pause' || mark?.mixed) {
                const offset = mark.mixed ? 5 : 0;
                svg.append(shape('path', { d: `M ${x - 4 + offset} ${y - 4} l 8 8 m -8 0 l 8 -8`, class: 'song-map-symbol-cross' }));
            }
            if (mark?.crash) {
                const point = crashPoint(position, bar.base);
                svg.append(shape('path', { d: 'M 0 -8 L 2 -2 L 8 0 L 2 2 L 0 8 L -2 2 L -8 0 L -2 -2 Z',
                    transform: `translate(${point.x} ${point.y})`, class: 'song-map-symbol-crash' }));
            }
        }
        if (bar.unresolved_fill) {
            const text = shape('text', { x: 50, y: 57, 'text-anchor': 'middle', 'font-size': 23 });
            text.textContent = 'F' + bar.unresolved_fill;
            svg.append(text);
        }
        return svg;
    }

    window.Vz2SongMapSvg = { positions, crashPoint, render };
}());
