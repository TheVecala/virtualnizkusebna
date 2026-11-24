(function () {
    'use strict';
    const ns = 'http://www.w3.org/2000/svg';
    const DOT_DIAMETER = 17.6;
    const geometry = Object.freeze({
        OUTLINE_WIDTH: 48,
        OUTLINE_STROKE: 1.8,
        CELL_SIZE: 24,
        DOT_RADIUS: DOT_DIAMETER / 2,
        CROSS_HALF_SIZE: 7,
        CROSS_STROKE: 3.6,
        CRASH_RADIUS: 6,
        CRASH_INNER_RADIUS: 1.8,
        CRASH_STROKE: 1.5,
        HIHAT_CORNER_RADIUS: 2,
        RIDE_CORNER_RADIUS: 24,
        RIDE_MARK_INSET: 2,
        RIDE_CRASH_CORNER: 7.0294,
        SVG_PADDING: 8,
        SPECIAL_SIZE: 48,
        UNKNOWN_BASELINE: 40
    });
    const {
        OUTLINE_WIDTH, OUTLINE_STROKE, CELL_SIZE, DOT_RADIUS, CROSS_HALF_SIZE, CROSS_STROKE,
        CRASH_RADIUS, CRASH_INNER_RADIUS, CRASH_STROKE, HIHAT_CORNER_RADIUS, RIDE_CORNER_RADIUS,
        RIDE_MARK_INSET, RIDE_CRASH_CORNER, SVG_PADDING, SPECIAL_SIZE, UNKNOWN_BASELINE
    } = geometry;
    const crashPath = `M0 -${CRASH_RADIUS} L${CRASH_INNER_RADIUS} -${CRASH_INNER_RADIUS}
        L${CRASH_RADIUS} 0 L${CRASH_INNER_RADIUS} ${CRASH_INNER_RADIUS}
        L0 ${CRASH_RADIUS} L-${CRASH_INNER_RADIUS} ${CRASH_INNER_RADIUS}
        L-${CRASH_RADIUS} 0 L-${CRASH_INNER_RADIUS} -${CRASH_INNER_RADIUS} Z`;

    function shape(tag, attributes) {
        const element = document.createElementNS(ns, tag);
        Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
        return element;
    }

    function layout(meter, base) {
        // An unmetered historic takt keeps the 48 × 48 outline and its opening Crash.
        const count = meter?.numerator ?? 1;
        const rows = meter ? Math.ceil(count / 2) : 2;
        const height = rows * CELL_SIZE;
        const starts = new Set();
        let start = 1;
        for (const group of meter?.groups || []) {
            if (start > 1) starts.add(start);
            start += group;
        }
        const positions = Array.from({ length: count }, (_, index) => {
            const row = Math.floor(index / 2);
            const col = index % 2;
            const top = row === 0;
            const bottom = row === rows - 1;
            const centered = Boolean(meter && count % 2 && index === count - 1);
            const trackY = CELL_SIZE / 2 + row * CELL_SIZE;
            let x = centered ? OUTLINE_WIDTH / 2 : CELL_SIZE / 2 + col * CELL_SIZE;
            let y = trackY;
            if (base === 'ride' && !centered && (top || bottom)) {
                x += col ? -RIDE_MARK_INSET : RIDE_MARK_INSET;
                if (top !== bottom) y += top ? RIDE_MARK_INSET : -RIDE_MARK_INSET;
            }
            const corner = base === 'ride' && rows > 1 ? RIDE_CRASH_CORNER : 0;
            const edge = col ? OUTLINE_WIDTH : 0;
            const crash = centered ? { x: OUTLINE_WIDTH / 2, y: height }
                : rows === 1 && base === 'ride' ? { x: edge, y: trackY }
                : top || bottom ? { x: col ? edge - corner : corner, y: top ? corner : height - corner }
                : { x: edge, y: trackY };
            return { unit: index + 1, groupStart: starts.has(index + 1), x, y, crash };
        });
        return { height, positions, width: OUTLINE_WIDTH + SVG_PADDING * 2, padding: SVG_PADDING };
    }

    function appendCross(svg, x, y) {
        const half = CROSS_HALF_SIZE;
        const cross = shape('g', {
            transform: `translate(${x} ${y})`, stroke: 'currentColor',
            'stroke-width': CROSS_STROKE, 'stroke-linecap': 'round', fill: 'none'
        });
        cross.append(shape('path', { d: `M-${half} -${half} L${half} ${half}` }),
            shape('path', { d: `M-${half} ${half} L${half} -${half}` }));
        svg.append(cross);
    }

    function render(value, large = false) {
        const bar = window.Vz2SongMapModel.fromLegacy(value);
        const rhythm = bar.kind === 'rhythm' && bar.base;
        const { height, positions, width, padding } = layout(rhythm ? bar.meter : null, bar.base);
        const viewHeight = height + padding * 2;
        const svg = shape('svg', {
            viewBox: `-${padding} -${padding} ${width} ${viewHeight}`, width, height: viewHeight,
            'aria-hidden': 'true', class: large ? 'song-map-symbol song-map-symbol-large' : 'song-map-symbol'
        });
        if (bar.kind === 'stop') {
            svg.append(shape('rect', { x: 0, y: 0, width: SPECIAL_SIZE, height: SPECIAL_SIZE,
                rx: HIHAT_CORNER_RADIUS, fill: 'currentColor' }));
            return svg;
        }
        if (!rhythm) {
            const glyph = bar.kind === 'rhythm' ? 'F' + bar.unresolved_fill : bar.kind === 'unknown' ? '?' : '—';
            const text = shape('text', { x: OUTLINE_WIDTH / 2, y: UNKNOWN_BASELINE, 'text-anchor': 'middle',
                'font-size': SPECIAL_SIZE, 'font-family': 'sans-serif' });
            text.textContent = glyph;
            svg.append(text);
            return svg;
        }
        svg.append(shape('rect', { x: 0, y: 0, width: OUTLINE_WIDTH, height,
            rx: bar.base === 'ride' ? RIDE_CORNER_RADIUS : HIHAT_CORNER_RADIUS,
            fill: 'none', stroke: 'currentColor', 'stroke-width': OUTLINE_STROKE, class: 'song-map-symbol-outline' }));
        const marks = new Map(bar.marks.map(mark => [mark.unit, mark]));
        for (const { unit, x, y, crash } of positions) {
            const mark = marks.get(unit);
            if (mark?.state === 'fill') svg.append(shape('circle', { cx: x, cy: y, r: DOT_RADIUS, fill: 'currentColor' }));
            if (mark?.state === 'pause') appendCross(svg, x, y);
            if (mark?.crash) svg.append(shape('path', { d: crashPath, transform: `translate(${crash.x} ${crash.y})`,
                'stroke-width': CRASH_STROKE, class: 'song-map-symbol-crash' }));
        }
        if (bar.unresolved_fill) {
            const text = shape('text', { x: OUTLINE_WIDTH / 2, y: height / 2 + 5,
                'text-anchor': 'middle', 'font-size': 14 });
            text.textContent = 'F' + bar.unresolved_fill;
            svg.append(text);
        }
        return svg;
    }

    window.Vz2SongMapSvg = { layout, render };
}());
