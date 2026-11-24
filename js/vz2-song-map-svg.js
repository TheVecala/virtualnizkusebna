(function () {
    'use strict';
    const ns = 'http://www.w3.org/2000/svg';

    function shape(tag, attributes) {
        const element = document.createElementNS(ns, tag);
        Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
        return element;
    }

    // The 4/4 positions follow the numbered examples in navrh_svg_takty.
    const grids = {
        1: [[50, 50]],
        2: [[28, 50], [72, 50]],
        3: [[28, 28], [72, 28], [50, 72]],
        4: [[28, 28], [72, 28], [28, 72], [72, 72]],
        5: [[28, 28], [72, 28], [28, 72], [50, 72], [72, 72]],
        6: [[28, 28], [50, 28], [72, 28], [28, 72], [50, 72], [72, 72]],
        7: [[28, 28], [50, 28], [72, 28], [28, 50], [72, 50], [28, 72], [72, 72]],
        9: [[28, 28], [50, 28], [72, 28], [28, 50], [50, 50], [72, 50], [28, 72], [50, 72], [72, 72]]
    };
    const crashPath = 'M 0 -8 Q 1.5 -1.5 8 0 Q 1.5 1.5 0 8 Q -1.5 1.5 -8 0 Q -1.5 -1.5 0 -8 Z';

    function positions(meter) {
        const count = meter?.numerator || 1;
        const starts = new Set();
        let start = 1;
        for (const group of meter?.groups || [1]) {
            if (start > 1) starts.add(start);
            start += group;
        }
        return grids[count].map(([x, y], index) => ({
            unit: index + 1, groupStart: starts.has(index + 1), x, y,
            // A central slot has no radial direction. Give it a free point on the outline.
            dx: x === 50 && y === 50 ? (count === 1 ? -1 : Math.SQRT2 - 1) : x - 50,
            dy: x === 50 && y === 50 ? -1 : y - 50
        }));
    }

    function crashPoint(position, base) {
        const { dx, dy } = position;
        const scale = 35 / (base === 'ride' ? Math.hypot(dx, dy) : Math.max(Math.abs(dx), Math.abs(dy)));
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
            ? shape('circle', { cx: 50, cy: 50, r: 35 })
            : shape('rect', { x: 15, y: 15, width: 70, height: 70, rx: 6 });
        outline.setAttribute('class', 'song-map-symbol-outline');
        svg.append(outline);
        const marks = new Map(bar.marks.map(mark => [mark.unit, mark]));
        for (const position of positions(bar.meter)) {
            const { unit, x, y } = position;
            const mark = marks.get(unit);
            if (mark?.state === 'fill') {
                svg.append(shape('circle', { cx: x, cy: y, r: 4.4 }));
            }
            if (mark?.state === 'pause' || mark?.mixed) {
                const offset = mark.mixed ? 5 : 0;
                svg.append(shape('path', { d: `M ${x - 4 + offset} ${y - 4} l 8 8 m -8 0 l 8 -8`, class: 'song-map-symbol-cross' }));
            }
            if (mark?.crash) {
                const point = crashPoint(position, bar.base);
                svg.append(shape('path', { d: crashPath,
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
