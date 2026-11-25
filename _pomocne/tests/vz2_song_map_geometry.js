(function () {
    'use strict';
    const { meterFor } = window.Vz2SongMapModel;
    const { render } = window.Vz2SongMapSvg;
    const patterns = [
        ['Přechod', () => 'fill', () => false],
        ['Pauza', () => 'pause', () => false],
        ['Kombinace', unit => ['fill', 'pause', null][(unit - 1) % 3], () => false],
        ['Crash', () => null, () => true],
        ['Přechod + Crash', () => 'fill', () => true]
    ];
    const close = (actual, expected) => Math.abs(actual - expected) < 0.02;
    function check(condition, message) {
        if (!condition) throw new Error(message);
    }

    const preview = document.getElementById('preview');
    const result = document.getElementById('result');
    try {
        let count = 0;
        for (const key of ['2/4', '3/4', '4/4', '5/4', '6/4', '6/8', '7/8', '8/8', '9/8']) {
            const meter = key === '8/8' ? { numerator: 8, denominator: 8, groups: [3, 3, 2] } : meterFor(key);
            const height = Math.ceil(meter.numerator / 2) * 24;
            const section = document.createElement('section');
            const heading = document.createElement('h2');
            heading.textContent = key;
            section.append(heading);
            const table = document.createElement('table');
            const head = table.createTHead().insertRow();
            for (const title of ['Nástroj a značky', '24 px', '32 px', '64 px', '128 px']) {
                const cell = document.createElement('th');
                cell.scope = 'col';
                cell.textContent = title;
                head.append(cell);
            }
            section.append(table);
            preview.append(section);
            const body = table.createTBody();
            for (const base of ['hihat', 'ride']) {
                for (const [name, stateFor, crashFor] of patterns) {
                    const row = body.insertRow();
                    const heading = document.createElement('th');
                    heading.scope = 'row';
                    heading.textContent = (base === 'ride' ? 'Ride' : 'Hi-hat') + ' · ' + name;
                    row.append(heading);
                    const marks = Array.from({ length: meter.numerator }, (_, index) => ({
                        unit: index + 1, state: stateFor(index + 1), crash: crashFor(index + 1)
                    }));
                    for (const width of [24, 32, 64, 128]) {
                        const svg = render({ kind: 'rhythm', base, meter, marks, unresolved_fill: null });
                        svg.style.width = width + 'px';
                        row.insertCell().append(svg);
                        const box = svg.getBoundingClientRect();
                        const context = key + ' ' + heading.textContent + ' ' + width;
                        check(close(box.width, width) && close(box.height, width * (height + 16) / 64), context + ' · škálování');
                        check(svg.getAttribute('viewBox') === '-8 -8 64 ' + (height + 16), context + ' · viewBox');
                        const outline = svg.querySelector('rect');
                        check(outline.getAttribute('width') === '48' && Number(outline.getAttribute('height')) === height
                            && Number(outline.getAttribute('rx')) === (base === 'ride' ? 24 : 2)
                            && outline.getAttribute('stroke-width') === '1.8', context + ' · obrys');
                        const dots = [...svg.querySelectorAll('circle')];
                        const crosses = [...svg.querySelectorAll('g')];
                        const crashes = [...svg.querySelectorAll('.song-map-symbol-crash')];
                        check(dots.length === marks.filter(mark => mark.state === 'fill').length, context + ' · počet teček');
                        check(crosses.length === marks.filter(mark => mark.state === 'pause').length, context + ' · počet křížků');
                        check(crashes.length === marks.filter(mark => mark.crash).length, context + ' · počet crashů');
                        for (const dot of dots) {
                            check(dot.getAttribute('r') === '8.8' && close(dot.getBoundingClientRect().width, width * 17.6 / 64),
                                context + ' · průměr tečky');
                        }
                        if (meter.numerator % 2 && marks.at(-1).state === 'fill') {
                            check(dots.at(-1).getAttribute('cx') === '24' && Number(dots.at(-1).getAttribute('cy')) === height - 12,
                                context + ' · poslední lichá doba');
                        }
                        for (const cross of crosses) {
                            const bounds = cross.getBBox();
                            check(bounds.width === 14 && bounds.height === 14 && cross.getAttribute('stroke-width') === '3.6',
                                context + ' · křížek 14 + 3,6 = 17,6');
                        }
                        for (const crash of crashes) {
                            const bounds = crash.getBoundingClientRect();
                            const halfStroke = width / 64;
                            const allowedBleed = 2 * width / 64 + 0.02;
                            check(crash.getAttribute('stroke-width') === '2' && close(bounds.width, width * 18 / 64)
                                && getComputedStyle(svg).overflow === 'visible'
                                && bounds.left - halfStroke >= box.left - allowedBleed
                                && bounds.right + halfStroke <= box.right + allowedBleed
                                && bounds.top - halfStroke >= box.top - allowedBleed
                                && bounds.bottom + halfStroke <= box.bottom + allowedBleed,
                            context + ' · zvětšený crash bez oříznutí');
                        }
                        count++;
                    }
                }
            }
        }
        result.textContent = 'Ověřeno ' + count + ' ikon.';
        result.dataset.status = 'pass';
    } catch (error) {
        result.textContent = error.message;
        result.dataset.status = 'fail';
        throw error;
    }
}());
