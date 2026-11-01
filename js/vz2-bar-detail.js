(function (root) {
    'use strict';
    const groups = { '2/4': [4,4], '3/4': [4,4,4], '4/4': [4,4,4,4], '5/4': [4,4,4,4,4], '6/4': [4,4,4,4,4,4], '3/8': [6], '6/8': [6,6], '7/8': [4,4,6], '9/8': [6,6,6], '12/8': [6,6,6,6] };
    const meters = Object.keys(groups), preferenceKey = 'vz2.song-map.bar-detail.template-meter';
    const normalize = text => typeof text === 'string' ? text.replace(/\r\n?/g, '\n') : '';
    const hasDetail = text => typeof text === 'string' && text.trim().length > 0;
    function template(meter) {
        if (!Object.hasOwn(groups, meter)) throw new Error('Neplatné metrum');
        const eighths = meter.endsWith('/8'), wide = meter === '12/8';
        let beat = 0;
        const tens = [], header = [], rows = [];
        for (const count of groups[meter]) {
            let top = '', bottom = '';
            for (let i = 0; i < count; i += eighths ? 2 : 4) {
                beat++;
                top += (beat >= 10 ? String(Math.floor(beat / 10)) : ' ') + ' ';
                bottom += eighths ? String(beat % 10) + '&' : beat + 'e&a';
            }
            tens.push(top); header.push(bottom); rows.push('-'.repeat(count));
        }
        return ['Metrum: ' + meter, ...(wide ? ['     ' + tens.join(' ')] : []), '     ' + header.join(' '),
            ...['HH', 'SD', 'BD'].map(name => name + ' | ' + rows.join(' ') + ' |')].join('\n');
    }
    function preference(storage = () => root.sessionStorage) {
        let memory = '4/4', available = true;
        return {
            get() { if (available) try { const value = storage().getItem(preferenceKey); memory = meters.includes(value) ? value : '4/4'; } catch (_) { available = false; } return memory; },
            set(value) { memory = meters.includes(value) ? value : '4/4'; if (available) try { storage().setItem(preferenceKey, memory); } catch (_) { available = false; } }
        };
    }
    const meterPreference = preference();
    const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
    function graphemes(text) {
        if (segmenter) return Array.from(segmenter.segment(text), part => part.segment);
        // Older engines: preserve surrogate pairs, combining marks, emoji modifiers and ZWJ sequences.
        const parts = [];
        for (const point of text) {
            const last = parts.length - 1;
            if (last >= 0 && (/^[\p{Mark}\uFE0F\u200D\p{Emoji_Modifier}]$/u.test(point) || parts[last].endsWith('\u200D') || (/^\p{Regional_Indicator}$/u.test(point) && /^\p{Regional_Indicator}$/u.test(parts[last])))) parts[last] += point;
            else parts.push(point);
        }
        return parts;
    }
    function boundaries(text) { let offset = 0; return [0, ...graphemes(text).map(part => offset += part.length)]; }
    function range(state) {
        const points = boundaries(state.value);
        const start = points.filter(p => p <= state.start).pop();
        const end = state.start === state.end ? start : points.find(p => p >= state.end);
        return { start, end };
    }
    // UTF-16 selection offsets at the DOM boundary; every edit consumes whole graphemes.
    function edit(state, type, data = '') {
        let { start, end } = range(state);
        const value = state.value;
        let inserted = normalize(data), cursor;
        if (type.startsWith('delete')) {
            if (start === end) {
                if (type === 'deleteContentBackward') {
                    if (start === 0 || value[start - 1] === '\n') return { ...state };
                    start = boundaries(value).filter(p => p < start).pop(); cursor = start;
                } else if (type === 'deleteContentForward') {
                    if (end === value.length || value[end] === '\n') return { ...state };
                    end = boundaries(value).find(p => p > end); cursor = start;
                } else return { ...state }; // word/line deletion is handled by the native editor
                inserted = ' ';
            } else inserted = '';
        } else if (type === 'insertLineBreak' || type === 'insertParagraph') inserted = '\n';
        else if (start === end && !inserted.includes('\n') && type !== 'replaceAll') {
            const lineEnd = value.indexOf('\n', end), stop = lineEnd < 0 ? value.length : lineEnd;
            end += graphemes(value.slice(end, stop)).slice(0, graphemes(inserted).length).join('').length;
        }
        cursor ??= start + inserted.length;
        return { value: value.slice(0, start) + inserted + value.slice(end), start: cursor, end: cursor };
    }
    function attach(text, onChange) {
        const snapshot = () => ({ value: text.value, start: text.selectionStart, end: text.selectionEnd, direction: text.selectionDirection });
        let stable = snapshot(), pending = null, composition = null, compositionTimer = null;
        const undo = [], redo = [];
        const show = state => { const top = text.scrollTop, left = text.scrollLeft; text.value = state.value; text.setSelectionRange(state.start, state.end, state.direction || 'none'); text.scrollTop = top; text.scrollLeft = left; stable = snapshot(); onChange(); };
        const commit = (before, after) => {
            if (before.value !== after.value) { undo.push(before); redo.length = 0; }
            show(after);
        };
        const apply = (type, data) => { const before = snapshot(); commit(before, edit(before, type, data)); };
        const history = backwards => {
            if (text.readOnly || composition) return;
            const from = backwards ? undo : redo, to = backwards ? redo : undo;
            if (!from.length) return;
            to.push(snapshot()); show(from.pop());
        };
        const insertedText = (before, after) => {
            const prefix = before.value.slice(0, before.start), suffix = before.value.slice(before.end);
            if (after.startsWith(prefix) && after.endsWith(suffix) && after.length >= prefix.length + suffix.length) return after.slice(prefix.length, after.length - suffix.length);
            return null;
        };
        const finishComposition = () => {
            if (!composition || !composition.ended) return;
            clearTimeout(compositionTimer);
            const before = composition.before, after = snapshot();
            const data = insertedText(before, after.value);
            composition = null; pending = null;
            if (after.value === before.value) { show(before); return; }
            commit(before, data === null ? after : edit(before, 'insertText', data));
        };
        text.addEventListener('compositionstart', () => { if (!text.readOnly) { finishComposition(); composition = { before: snapshot(), ended: false }; pending = null; } });
        text.addEventListener('compositionend', () => { if (composition) { composition.ended = true; compositionTimer = setTimeout(finishComposition, 0); } });
        text.addEventListener('beforeinput', event => {
            if (text.readOnly) return;
            if (composition || event.isComposing) return;
            const type = event.inputType;
            pending = { before: snapshot(), type, data: event.data };
            if (type === 'historyUndo' || type === 'historyRedo') {
                if (event.cancelable) { event.preventDefault(); pending = null; history(type === 'historyUndo'); }
                return;
            }
            const known = ['insertText', 'insertReplacementText', 'insertFromPaste', 'insertLineBreak', 'insertParagraph', 'deleteContentBackward', 'deleteContentForward'].includes(type);
            const data = event.dataTransfer?.getData('text/plain') ?? event.data;
            if (event.cancelable && known && (!type.startsWith('insert') || data != null || ['insertLineBreak', 'insertParagraph'].includes(type))) {
                event.preventDefault(); pending = null; apply(type, data || '');
            }
        });
        text.addEventListener('input', event => {
            if (text.readOnly) { show(stable); return; }
            if (composition || event.isComposing) { onChange(); return; }
            const before = pending?.before || stable, type = pending?.type || event.inputType, after = snapshot();
            pending = null;
            if (type === 'historyUndo' || type === 'historyRedo') { show(before); history(type === 'historyUndo'); return; }
            if (['deleteContentBackward', 'deleteContentForward', 'insertLineBreak', 'insertParagraph'].includes(type)) commit(before, edit(before, type));
            else if (['insertText', 'insertReplacementText', 'insertFromPaste'].includes(type)) {
                const data = insertedText(before, after.value);
                commit(before, data === null ? after : edit(before, type, data));
            } else commit(before, after); // cut, selected word deletion and other native structural edits
        });
        text.addEventListener('paste', event => {
            if (text.readOnly || !event.clipboardData || composition) return;
            event.preventDefault(); pending = null; apply('insertFromPaste', event.clipboardData.getData('text/plain'));
        });
        // Text dragging is deliberately unsupported; paste has unambiguous caret/selection semantics.
        text.addEventListener('drop', event => event.preventDefault());
        text.addEventListener('dragstart', event => event.preventDefault());
        text.addEventListener('keydown', event => {
            finishComposition();
            if (event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) return;
            const key = event.key.toLowerCase();
            if (key === 'z' || (key === 'y' && !event.metaKey)) { event.preventDefault(); history(key === 'z' && !event.shiftKey); }
        });
        const rememberSelection = () => { if (!composition && !pending && stable.value === text.value) stable = snapshot(); };
        ['select', 'selectionchange', 'keyup', 'pointerup', 'focus'].forEach(type => text.addEventListener(type, rememberSelection));
        return {
            replace(value) { if (text.readOnly) return; finishComposition(); const before = snapshot(); commit(before, { value: normalize(value), start: 0, end: 0 }); text.focus(); },
            undo: () => history(true), redo: () => history(false),
            flush: finishComposition,
            destroy() { clearTimeout(compositionTimer); }
        };
    }
    const exported = { meters, preferenceKey, preference, meterPreference, template, normalize, hasDetail, graphemes, edit, attach };
    if (typeof module !== 'undefined' && module.exports) module.exports = exported;
    else root.Vz2BarDetail = exported;
}(typeof window === 'undefined' ? globalThis : window));
