(function () {
    'use strict';
    const { meters, meterFor, label } = window.Vz2SongMapModel;
    const Svg = window.Vz2SongMapSvg;
    const Detail = window.Vz2BarDetail;

    function make(tag, text, className) {
        const node = document.createElement(tag);
        if (text !== undefined) node.textContent = text;
        if (className) node.className = className;
        return node;
    }

    function button(text, action) {
        const node = make('button', text);
        node.type = 'button';
        node.addEventListener('click', action);
        return node;
    }

    function field(title, control) {
        const node = make('label', title);
        control.setAttribute('aria-label', title);
        node.append(control);
        return node;
    }

    function options(values) {
        const select = make('select');
        select.setAttribute('data-native-select', '');
        for (const [value, text] of values) select.add(new Option(text, value));
        return select;
    }

    function open({ bar, title, submitLabel, position, barActions, onSubmit, onClose }) {
        const draft = structuredClone(bar);
        let base = bar.base;
        const overlay = make('div', undefined, 'song-map-editor-overlay');
        const panel = make('div', undefined, 'song-map-editor');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-label', title);
        const obscured = [...document.body.children].filter(node => !node.inert);
        obscured.forEach(node => { node.inert = true; });
        overlay.append(panel);
        document.body.append(overlay);

        const kind = options([['rhythm', 'Rytmus'], ['unknown', 'Neurčený'], ['pause', 'Pauza'], ['stop', 'Stop']]);
        kind.value = draft.kind;
        const meter = options([['', 'Neurčené'], ...Object.keys(meters).map(key => [key, key])]);
        const groups = make('input');
        groups.type = 'text';
        groups.inputMode = 'text';
        groups.maxLength = 24;
        const settings = make('div', undefined, 'song-map-editor-settings');
        const foundations = make('div', undefined, 'song-map-editor-bases');
        const hihat = button('Hi-hat', () => chooseBase('hihat'));
        const ride = button('Ride', () => chooseBase('ride'));
        foundations.append(hihat, ride);
        foundations.setAttribute('role', 'group');
        foundations.setAttribute('aria-label', 'Rytmický základ');

        const figure = make('div', undefined, 'song-map-editor-figure');
        const marks = make('div', undefined, 'song-map-editor-targets');
        const picture = make('div', undefined, 'song-map-editor-picture');
        figure.append(picture, marks);
        const summary = make('span', '', 'song-map-editor-description');
        summary.setAttribute('role', 'status');
        const legacy = button('', () => {
            if (draft.base || base) {
                draft.base = base;
                draft.unresolved_fill = null;
                renderFigure();
                (base === 'ride' ? ride : hihat).focus();
            }
        });
        const detail = make('details');
        detail.append(make('summary', 'Detail taktu'));
        const text = make('textarea');
        text.value = Detail.normalize(bar.detail);
        text.rows = 5;
        text.wrap = 'off';
        text.spellcheck = false;
        const textEditor = Detail.attach(text, () => {});
        const textActions = make('div', undefined, 'toolbar');
        const template = options(Detail.meters.map(value => [value, value]));
        template.value = draft.meter ? draft.meter.numerator + '/' + draft.meter.denominator : Detail.meterPreference.get();
        const fillTemplate = () => {
            textEditor.replace(Detail.template(template.value));
            text.focus();
        };
        textActions.append(field('Šablona', template), button('Předvyplnit', () => {
            textEditor.flush();
            if (!text.value) fillTemplate();
            else confirmAction('Nahradit celý text šablonou?', 'Nahradit', fillTemplate);
        }), button('Zpět', () => { textEditor.undo(); text.focus(); }),
        button('Znovu', () => { textEditor.redo(); text.focus(); }));
        detail.append(textActions, field('Tabulatura / poznámka', text));

        const message = make('div', undefined, 'song-map-editor-message');
        message.setAttribute('aria-live', 'polite');
        const actions = make('div', undefined, 'toolbar song-map-editor-actions');
        const cancel = button('Zrušit', requestClose);
        const submit = button(submitLabel, apply);
        actions.append(cancel, submit);
        settings.append(field('Typ', kind), field('Metrum', meter), field('Členění', groups));
        if (position) panel.append(make('p', position, 'song-map-editor-position'));
        panel.append(foundations, settings, figure, legacy, summary, detail, message, actions);
        if (barActions) {
            const menu = make('details', undefined, 'song-map-editor-menu');
            menu.append(make('summary', 'Akce taktu'));
            for (const [caption, action] of barActions) {
                const run = () => { close(); action(); };
                menu.append(button(caption, () => {
                    if (isDirty()) confirmAction('Zahodit rozpracované změny taktu a pokračovat?', 'Pokračovat', run);
                    else run();
                }));
            }
            panel.append(menu);
        }

        function chooseBase(value) {
            base = value;
            draft.kind = 'rhythm';
            draft.base = base;
            kind.value = draft.kind;
            renderFigure();
        }

        function renderFigure(focusKey) {
            picture.replaceChildren(Svg.render(draft, true));
            marks.replaceChildren();
            hihat.setAttribute('aria-pressed', String(draft.kind === 'rhythm' && draft.base === 'hihat'));
            ride.setAttribute('aria-pressed', String(draft.kind === 'rhythm' && draft.base === 'ride'));
            summary.textContent = label(draft);
            legacy.hidden = !draft.unresolved_fill || draft.kind !== 'rhythm';
            legacy.disabled = !draft.base;
            legacy.textContent = 'Odstranit původní F' + draft.unresolved_fill;
            if (draft.kind !== 'rhythm' || !draft.base || !draft.meter) return;
            const layout = Svg.layout(draft.meter, draft.base);
            for (const point of layout.positions) {
                const mark = draft.marks.find(item => item.unit === point.unit);
                const group = point.groupStart ? ', začátek skupiny' : '';
                const state = mark?.state === 'fill' ? 'přechod' : mark?.state === 'pause' ? 'pauza' : 'základní rytmus';
                const center = target(point, 'state', state + group, layout);
                center.textContent = mark?.state ? '' : String(point.unit);
                center.classList.toggle('song-map-group-start', point.groupStart);
                const edge = target({ ...point.crash, unit: point.unit }, 'crash', 'Crash', layout);
                edge.setAttribute('aria-pressed', String(Boolean(mark?.crash)));
                edge.textContent = mark?.crash ? '' : '·';
                marks.append(center, edge);
            }
            if (focusKey) marks.querySelector('[data-target="' + focusKey + '"]')?.focus();
        }

        function target(point, type, state, { width, height, padding }) {
            const key = point.unit + '-' + type;
            const node = button('', () => {
                const mark = draft.marks.find(item => item.unit === point.unit) ||
                    { unit: point.unit, state: null, crash: false };
                if (type === 'crash') mark.crash = !mark.crash;
                else mark.state = mark.state === null ? 'fill' : mark.state === 'fill' ? 'pause' : null;
                draft.marks = draft.marks.filter(item => item.unit !== point.unit);
                if (mark.state || mark.crash) draft.marks.push(mark);
                draft.marks.sort((a, b) => a.unit - b.unit);
                renderFigure(key);
            });
            node.className = 'song-map-editor-target song-map-editor-target-' + type;
            node.dataset.target = key;
            node.style.left = (point.x + padding) / width * 100 + '%';
            node.style.top = (point.y + padding) / (height + padding * 2) * 100 + '%';
            node.setAttribute('aria-label', point.unit + '. pozice: ' + state);
            return node;
        }

        function setMeterFields() {
            meter.value = draft.meter ? draft.meter.numerator + '/' + draft.meter.denominator : '';
            groups.value = draft.meter?.groups.join('+') || '';
            groups.disabled = !draft.meter;
            groups.setCustomValidity('');
        }

        function confirmAction(question, actionLabel, action, restore = document.activeElement) {
            message.replaceChildren(make('span', question), button('Zpět', () => {
                message.replaceChildren();
                restore?.focus();
            }), button(actionLabel, () => {
                message.replaceChildren();
                action();
            }));
            message.querySelector('button').focus();
        }

        meter.addEventListener('change', () => {
            const next = meter.value ? meterFor(meter.value) : null;
            const discarded = draft.marks.some(mark => next
                ? mark.unit > next.numerator || (draft.meter && draft.meter.denominator !== next.denominator && mark.unit > 1)
                : mark.unit !== 1 || mark.state !== null);
            const use = () => {
                draft.marks = draft.marks.flatMap(mark => {
                    if (!next) return mark.unit === 1 && mark.crash ? [{ ...mark, state: null }] : [];
                    if (mark.unit > next.numerator || (draft.meter && draft.meter.denominator !== next.denominator && mark.unit > 1)) return [];
                    return [mark];
                });
                draft.meter = next;
                setMeterFields();
                renderFigure();
                meter.focus();
            };
            if (discarded) {
                setMeterFields();
                confirmAction('Při změně metra se některé značky odstraní. Pokračovat?', 'Změnit metrum', use, meter);
            } else use();
        });

        function readGroups() {
            if (!draft.meter) return true;
            const input = groups.value.trim();
            const values = input.split('+').map(Number);
            const valid = /^\d+(\s*\+\s*\d+)*$/.test(input) && values.every(n => n > 0)
                && values.reduce((sum, n) => sum + n, 0) === draft.meter.numerator;
            groups.setCustomValidity(valid ? '' : 'Součet členění musí odpovídat čitateli metra.');
            if (valid) draft.meter.groups = values;
            return valid;
        }

        groups.addEventListener('input', () => { if (readGroups()) renderFigure(); });
        kind.addEventListener('change', () => {
            draft.kind = kind.value;
            if (draft.kind === 'rhythm' && !draft.base && draft.unresolved_fill !== 4) chooseBase(base || 'hihat');
            renderFigure();
        });

        function apply() {
            if (message.querySelector('button')) return;
            if (!readGroups()) { groups.reportValidity(); return; }
            textEditor.flush();
            if (new TextEncoder().encode(text.value).length > 65536) {
                message.textContent = 'Detail může mít nejvýše 64 KiB.';
                return;
            }
            const value = { ...draft, detail: text.value === Detail.normalize(bar.detail) ? bar.detail : text.value };
            if (value.kind !== 'rhythm') Object.assign(value, { base: null, marks: [], unresolved_fill: null });
            close(onSubmit(value));
        }

        function isDirty() {
            return JSON.stringify(draft) !== JSON.stringify(bar) || text.value !== Detail.normalize(bar.detail);
        }

        function requestClose() {
            textEditor.flush();
            const valid = readGroups();
            if (valid && !isDirty()) close();
            else confirmAction('Zahodit rozpracované změny taktu?', 'Zahodit', () => close());
        }

        function close(result) {
            textEditor.destroy();
            overlay.remove();
            obscured.forEach(node => { node.inert = false; });
            onClose(result);
        }

        overlay.addEventListener('keydown', event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                const back = message.querySelector('button');
                if (back) back.click();
                else requestClose();
            }
            if (event.key !== 'Tab') return;
            const controls = [...panel.querySelectorAll('button, select, input, textarea, summary')]
                .filter(node => !node.disabled && node.getClientRects().length > 0);
            const first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        });
        setMeterFields();
        renderFigure();
        (base === 'ride' ? ride : hihat).focus();
        return {
            dirty: isDirty,
            close: () => close()
        };
    }

    window.Vz2SongMapEditor = { open };
}());
