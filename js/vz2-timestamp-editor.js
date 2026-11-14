/* Shared implementation of separate take, passage and point-note dialogs. */
(function (root) {
    'use strict';
    const Model = root.Vz2TimestampModel, Store = root.Vz2TimestampStore;
    const format = ms => Model.format(ms);
    const names = { take: 'úsek', passage: 'pasáž', note: 'poznámka' };
    const make = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
    let active = null, opening = false;
    function mount({ recording_id, list, adapter, kind, item, finish, draft }) {
        const dialog = make('dialog', null, 'vz2-annotation-editor vz2-interval-editor');
        dialog.setAttribute('aria-labelledby', 'annotation-title');
        dialog.dataset.kind = kind;
        dialog.innerHTML = `<form autocomplete="off" novalidate>
            <div class="annotation-header"><div><h2 id="annotation-title"></h2><p class="interval-context"></p></div><button type="button" class="annotation-close" aria-label="Zavřít editor">×</button></div>
            <div class="annotation-parent"><div class="annotation-field"><span>Úsek</span><div data-choice="parent"></div></div><p class="annotation-parent-hint" role="status"></p></div>
            <div class="annotation-player"></div>
            <div class="annotation-scroll">
                <fieldset class="annotation-entry">
                    <legend class="visually-hidden">Údaje značky</legend>
                    <div class="annotation-top-row">
                        <div class="annotation-times">
                            <div class="annotation-boundaries">
                                <div class="annotation-time-row" role="group" aria-label="Začátek"><button type="button" data-edit-time="start"></button><button type="button" data-capture="start">zač</button></div>
                                <span class="annotation-time-dash" aria-hidden="true">–</span>
                                <div class="annotation-time-row annotation-end" role="group" aria-label="Konec"><button type="button" data-edit-time="end"></button><button type="button" data-capture="end" aria-label="Nastavit konec podle přehrávače">kon</button></div>
                            </div>
                        </div>
                        <div class="annotation-song" data-choice="song"></div>
                    </div>
                    <p class="annotation-time-error error" role="alert"></p>
                    <details class="annotation-fine"><summary>Zavřít přesné časy</summary><div class="annotation-fine-rows"></div><button type="button" class="annotation-clear-end">Doplnit konec později</button></details>
                    <div class="annotation-passage annotation-field"><span>Typ pasáže</span><div data-choice="passage_type"></div></div>
                    <div class="annotation-caption-row">
                        <div class="annotation-title-field"><label for="annotation-label" class="visually-hidden">Popisek</label><input id="annotation-label" name="label" placeholder="Popisek" maxlength="4000"><button type="button" class="annotation-note-open" aria-label="Doplňující poznámka">+poz</button></div>
                        <button type="submit" class="annotation-save">uložit</button>
                    </div>
                    <p class="annotation-preview-note"></p>
                    <span class="annotation-save-status" role="status"></span>
                </fieldset>
                <div class="annotation-existing"><span>Rozpracovaný úsek</span><div data-choice="existing"></div></div>
                <p class="error annotation-error" role="alert"></p>
                <div class="interval-current" hidden></div><button type="button" class="interval-reload" hidden>Načíst aktuální verzi k porovnání</button><button type="button" class="annotation-rebase" hidden>Použít aktuální revizi</button>
                <section class="annotation-reference" aria-label="Časové značky nahrávky"><h3></h3><ol tabindex="0" aria-label="Seznam časových značek"></ol></section>
            </div>
        </form>`;
        document.body.append(dialog);
        const form = dialog.querySelector('form'), error = dialog.querySelector('.annotation-error'), timeError = dialog.querySelector('.annotation-time-error');
        const label = form.elements.label, choices = {}, controls = root.Vz2TimestampControls;
        let selected = item, revision = list.timestamps_revision, busy = false, start, end, note = '', baseline, pendingLatest = null, noteDialog = null, latestList = list;
        let suggestedLabel = '', saved = !!item, justSaved = false;
        const invalidTimes = new Map();
        const state = (overrides = {}) => JSON.stringify({ kind, start, end, label: label.value, note, song: choices.song.value, passage_type: choices.passage_type.value, parent: choices.parent.value, ...overrides });
        const dirty = () => baseline !== state() || invalidTimes.size > 0;
        const currentTime = () => Math.max(0, Math.round(adapter?.currentTimeMs?.() ?? 0));
        const report = text => { error.textContent = text; };
        active = { dialog, dirty: () => dirty() || !!noteDialog && noteDialog.querySelector('textarea').value !== note, recording_id, adapter };
        for (const [key, title, search] of [['existing', 'Rozpracovaný úsek', true], ['song', 'Skladba', true], ['passage_type', 'Typ pasáže', false], ['parent', 'Úsek', true]]) {
            choices[key] = controls.choice(dialog.querySelector('[data-choice="' + key + '"]'), title, search);
        }
        const items = () => Model.items(latestList);
        const parentTake = () => items().find(i => i.kind === 'take' && i.end_ms !== null && String(i.timestamp_id) === choices.parent.value);
        const passageError = () => {
            if (kind !== 'passage') return '';
            const parent = parentTake();
            if (!parent) return 'Nejdřív vyberte úsek s vyplněným začátkem a koncem.';
            if (start < parent.start_ms || start >= parent.end_ms || end != null && (end <= start || end > parent.end_ms)) return 'Pasáž musí ležet uvnitř vybraného úseku (' + format(parent.start_ms) + ' – ' + format(parent.end_ms) + ').';
            if (end == null) return 'Doplňte konec pasáže ve vybraném úseku.';
            return '';
        };
        function fillOptions() {
            const song = choices.song.value;
            choices.song.setOptions([{ value: '', label: 'Bez přiřazení' }, ...(latestList.songs || []).filter(s => s.lifecycle !== 'archived' || String(s.id) === song || s.id === selected?.song_id).map(s => ({ value: s.id, label: s.title }))]);
            choices.passage_type.setOptions(Object.entries(Model.passageTypes).map(([value, label]) => ({ value, label })));
            choices.parent.setOptions([{ value: '', label: 'Vyberte úsek…' }, ...items().filter(i => i.kind === 'take').map(i => ({ value: i.timestamp_id, disabled: i.end_ms === null, label: format(i.start_ms) + (i.end_ms === null ? ' · nejdřív doplňte konec' : ' – ' + format(i.end_ms)) + ' · ' + [i.song_title, i.label].filter(Boolean).join(' · ') }))]);
            const open = items().filter(i => i.kind === kind && i.status === 'open' && i.can_edit);
            choices.existing.setOptions([{ value: '', label: 'Nový úsek' }, ...open.map(i => ({ value: i.timestamp_id, label: format(i.start_ms) + ' · ' + (i.song_title || i.label) }))]);
            dialog.querySelector('.annotation-existing').hidden = !!selected || kind === 'note' || !open.length;
        }
        function reference() {
            const host = dialog.querySelector('.annotation-reference ol'), scroll = host.scrollTop; host.replaceChildren();
            const rows = kind === 'passage' ? items().filter(i => i.kind === 'passage' && String(i.source.parent_timestamp_id) === choices.parent.value) : items(); dialog.querySelector('.annotation-reference h3').textContent = 'Časové značky · ' + rows.length;
            if (!rows.length) host.append(make('li', 'Zatím žádné časové značky.', 'muted'));
            rows.forEach(i => {
                const row = make('li'); if (i.parent_id) row.classList.add('annotation-child');
                if (i.id === selected?.id) row.classList.add('annotation-selected');
                row.append(make('span', format(i.start_ms) + (i.end_ms == null ? i.kind === 'note' ? '' : ' – …' : '–' + format(i.end_ms))), make('span', [i.song_title, i.label].filter(Boolean).join(' · ')));
                if (i.note_text) row.title = i.note_text;
                host.append(row);
            }); host.scrollTop = scroll;
        }
        function update() {
            const point = kind === 'note';
            dialog.querySelector('#annotation-title').textContent = selected ? 'Upravit ' + names[kind] : kind === 'take' ? 'Nový úsek' : kind === 'passage' ? 'Nová pasáž' : 'Nová poznámka';
            dialog.querySelector('.annotation-end').hidden = point;
            dialog.querySelector('.annotation-boundaries').classList.toggle('annotation-point', point);
            dialog.querySelector('.annotation-time-dash').hidden = point;
            dialog.querySelector('.annotation-time-row').setAttribute('aria-label', point ? 'Čas poznámky' : 'Začátek');
            dialog.querySelector('[data-capture=start]').setAttribute('aria-label', point ? 'Nastavit čas poznámky' : 'Nastavit začátek');
            dialog.querySelector('[data-capture=start]').title = point ? 'Nastavit čas poznámky podle přehrávače' : 'Nastavit začátek podle přehrávače';
            const exact = ms => format(ms) + (ms % 1000 ? ',' + String(ms % 1000).padStart(3, '0') : '');
            dialog.querySelector('[data-capture=start]').textContent = point ? 'teď' : 'zač';
            dialog.querySelector('[data-edit-time=start]').textContent = exact(start);
            dialog.querySelector('[data-edit-time=end]').textContent = end == null ? '—' : exact(end);
            dialog.querySelector('[data-edit-time=start]').setAttribute('aria-label', (point ? 'Upravit čas poznámky ' : 'Upravit začátek ') + exact(start));
            dialog.querySelector('[data-edit-time=end]').setAttribute('aria-label', end == null ? 'Doplnit konec' : 'Upravit konec ' + exact(end));
            dialog.querySelector('.annotation-song').hidden = kind !== 'take';
            dialog.querySelector('.annotation-passage').hidden = dialog.querySelector('.annotation-parent').hidden = kind !== 'passage';
            dialog.querySelector('label[for=annotation-label]').textContent = point ? 'Text poznámky' : 'Popisek';
            label.setAttribute('aria-label', point ? 'Text poznámky' : 'Popisek');
            label.placeholder = point ? 'Text poznámky' : 'Popisek';
            const noteButton = dialog.querySelector('.annotation-note-open'); noteButton.hidden = point; noteButton.classList.toggle('has-note', !!note.trim()); noteButton.setAttribute('aria-label', note.trim() ? 'Upravit doplňující poznámku' : 'Doplňující poznámka');
            dialog.querySelector('.annotation-clear-end').hidden = point || end == null;
            dialog.querySelector('.annotation-fine-end').hidden = point;
            dialog.querySelector('.annotation-save').setAttribute('aria-label', kind === 'take' ? 'Uložit úsek' : kind === 'passage' ? 'Uložit pasáž' : 'Uložit poznámku');
            const parent = parentTake();
            dialog.querySelector('.annotation-entry').disabled = busy || kind === 'passage' && !parent;
            dialog.querySelector('.annotation-parent-hint').textContent = parent ? 'Pasáže vkládáte do úseku ' + format(parent.start_ms) + ' – ' + format(parent.end_ms) + '.' : 'Nejdřív vyberte úsek s vyplněným začátkem a koncem.';
            if (!choices.song.value) dialog.querySelector('.annotation-song > button').textContent = 'skladba ▾';
            dialog.querySelector('.annotation-preview-note').textContent = point ? '' : note;
            const clean = saved && !dirty();
            dialog.querySelector('.annotation-save-status').textContent = busy ? 'Ukládání…' : clean ? '✓ Uloženo' : justSaved && !dirty() ? '✓ Uloženo · Nová značka' : 'Neuložené změny';
            dialog.querySelector('.annotation-save').disabled = busy || clean;
            for (const edge of ['start', 'end']) {
                const ms = edge === 'start' ? start : end;
                if (invalidTimes.has(edge) || document.activeElement === form.elements[edge]) continue;
                form.elements[edge].value = ms == null ? '' : format(ms) + (ms % 1000 ? ',' + String(ms % 1000).padStart(3, '0') : '');
            }
        }
        function setEdge(edge, value) {
            const total = adapter?.durationMs?.() || latestList.duration_ms;
            if (!Number.isSafeInteger(value) || value < 0 || total != null && value > total) { timeError.textContent = 'Čas musí ležet v nahrávce.'; invalidTimes.set(edge, timeError.textContent); update(); return; }
            if (kind === 'passage') {
                const parent = parentTake();
                if (!parent || value < parent.start_ms || value > parent.end_ms || edge === 'start' && value === parent.end_ms) {
                    timeError.textContent = parent ? 'Čas musí ležet ve vybraném úseku (' + format(parent.start_ms) + ' – ' + format(parent.end_ms) + ').' : 'Nejdřív vyberte úsek.';
                    invalidTimes.set(edge, timeError.textContent); update(); return;
                }
            }
            invalidTimes.delete(edge);
            if (edge === 'start') start = value; else end = value;
            timeError.textContent = end != null && end <= start ? 'Konec musí být po začátku.' : '';
            update();
        }
        const fine = dialog.querySelector('.annotation-fine-rows');
        for (const [edge, title] of [['start', 'Začátek'], ['end', 'Konec']]) {
            const row = make('div', null, 'annotation-fine-row annotation-fine-' + edge);
            const input = make('input'); input.name = edge; input.setAttribute('aria-label', title + ' přesně'); input.placeholder = 'mm:ss'; input.inputMode = 'text';
            row.append(make('label', title)); row.firstChild.append(input);
            for (const [delta, text] of [[-1000, '−1 s'], [-100, '−0,1 s'], [100, '+0,1 s'], [1000, '+1 s']]) {
                const b = make('button', text); b.type = 'button'; b.setAttribute('aria-label', title + ' ' + text);
                b.onclick = () => { const at = edge === 'start' ? start : end; if (at == null) { timeError.textContent = 'Nejprve nastavte konec.'; return; } setEdge(edge, Math.max(0, at + delta)); }; row.append(b);
            }
            input.oninput = input.onchange = () => { try { if (edge === 'end' && !input.value.trim()) { end = null; invalidTimes.delete(edge); timeError.textContent = ''; update(); } else setEdge(edge, Model.parse(input.value)); } catch (e) { timeError.textContent = e.message; invalidTimes.set(edge, e.message); update(); } };
            fine.append(row);
        }
        function populate(value, initial = false) {
            selected = value; kind = value?.kind || kind; invalidTimes.clear();
            start = value?.start_ms ?? draft.time_ms ?? currentTime();
            const capturedEnd = finish && value && value.end_ms == null && adapter?.canPlay?.() && draft.time_ms > start ? draft.time_ms : null;
            end = kind === 'note' ? null : value?.end_ms ?? capturedEnd ?? draft.end_time_ms ?? null;
            label.value = value?.source.body?.replace(/^[↑↓]$/, '') || draft.body || '';
            note = value?.note_text || ''; suggestedLabel = ''; fillOptions();
            choices.song.value = value ? value.song_id : latestList.default_song_id;
            choices.passage_type.value = value?.passage_type || 'custom';
            choices.parent.value = value ? value.source.parent_timestamp_id : '';
            saved = !!value; justSaved = false;
            if (initial) baseline = state(capturedEnd == null ? {} : { end: value.end_ms });
            update(); reference();
        }
        populate(item, true);
        dialog.querySelector('.interval-context').textContent = latestList.source_filename || latestList.title || 'Nahrávka';
        const player = controls.transport(dialog.querySelector('.annotation-player'), adapter, latestList, () => ({ start, end: kind === 'note' ? null : end }), report);
        const readiness = setInterval(() => {
            const ready = !!adapter?.canPlay?.();
            dialog.querySelectorAll('[data-capture]').forEach(b => b.disabled = busy || !ready);
        }, 200);
        dialog.querySelectorAll('[data-capture]').forEach(b => b.onclick = () => { if (adapter?.canPlay?.()) setEdge(b.dataset.capture, currentTime()); });
        dialog.querySelectorAll('[data-edit-time]').forEach(b => b.onclick = () => {
            dialog.querySelector('.annotation-fine').open = true;
            const input = form.elements[b.dataset.editTime]; input.focus(); input.select();
        });
        label.oninput = update;
        choices.song.onChange(update);
        dialog.querySelector('.annotation-clear-end').onclick = () => { end = null; invalidTimes.delete('end'); timeError.textContent = ''; update(); };
        choices.existing.onChange(value => {
            if (dirty() && !confirm('Zahodit rozepsané změny a otevřít jiný úsek?')) { choices.existing.value = selected?.timestamp_id || ''; return; }
            populate(items().find(i => String(i.timestamp_id) === value) || null, true);
        });
        const suggestLabel = () => {
            if (selected || label.value && label.value !== suggestedLabel) return;
            const type = choices.passage_type.value, parent = choices.parent.value;
            const count = items().filter(i => i.kind === 'passage' && i.passage_type === type && String(i.source.parent_timestamp_id ?? '') === parent).length;
            suggestedLabel = type === 'custom' ? '' : Model.passageTypes[type] + (count ? ' ' + (count + 1) : ''); label.value = suggestedLabel;
        };
        choices.passage_type.onChange(() => { suggestLabel(); update(); });
        choices.parent.onChange(() => {
            const parent = parentTake();
            if (parent) {
                start = parent.start_ms; end = null; invalidTimes.clear(); timeError.textContent = ''; report('');
                player.seek(start);
            }
            update(); reference();
        });
        dialog.querySelector('.annotation-note-open').onclick = () => {
            noteDialog = make('dialog', null, 'annotation-note-dialog'); noteDialog.setAttribute('aria-labelledby', 'annotation-note-title');
            noteDialog.innerHTML = '<h2 id="annotation-note-title">Doplňující poznámka</h2><label>Text poznámky<textarea maxlength="4000" rows="5"></textarea></label><div><button type="button" class="note-cancel">Zrušit</button><button type="button" class="note-done">Hotovo</button></div>';
            const textarea = noteDialog.querySelector('textarea'); textarea.value = note;
            const close = () => { if (textarea.value !== note && !confirm('Zahodit změny poznámky?')) return; noteDialog.close(); };
            noteDialog.querySelector('.note-cancel').onclick = close;
            noteDialog.querySelector('.note-done').onclick = () => { note = textarea.value; update(); noteDialog.close(); };
            noteDialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
            noteDialog.addEventListener('close', () => { noteDialog.remove(); noteDialog = null; dialog.querySelector('.annotation-note-open').focus(); });
            document.body.append(noteDialog); noteDialog.showModal(); resize(); textarea.focus();
        };
        const close = () => { if (!busy && (!dirty() || confirm('Zahodit rozepsané změny?'))) dialog.close(); };
        dialog.querySelector('.annotation-close').onclick = close;
        dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
        const unsubscribe = Store.subscribe(value => {
            if (Number(value.recording_id) === Number(recording_id)) { latestList = value; fillOptions(); update(); reference(); }
        });
        const resize = () => {
            const viewport = root.visualViewport;
            const height = viewport?.height || innerHeight;
            dialog.classList.toggle('annotation-small', height < 650); dialog.classList.toggle('annotation-tiny', height < 420);
            if (noteDialog) { noteDialog.style.maxHeight = Math.max(100, height - 16) + 'px'; noteDialog.style.top = (viewport?.offsetTop || 0) + 8 + 'px'; }
            if (viewport && matchMedia('(max-width: 767px)').matches) { dialog.style.setProperty('--annotation-height', viewport.height + 'px'); dialog.style.setProperty('--annotation-top', viewport.offsetTop + 'px'); }
        };
        root.visualViewport?.addEventListener('resize', resize); root.visualViewport?.addEventListener('scroll', resize); root.addEventListener('resize', resize);
        dialog.addEventListener('close', () => {
            clearInterval(readiness); unsubscribe(); player.destroy(); Object.values(choices).forEach(c => c.destroy());
            root.visualViewport?.removeEventListener('resize', resize); root.visualViewport?.removeEventListener('scroll', resize); root.removeEventListener('resize', resize);
            dialog.remove(); if (active?.dialog === dialog) active = null;
        });
        dialog.querySelector('.interval-reload').onclick = async () => {
            try {
                pendingLatest = await Store.reload(recording_id); latestList = pendingLatest;
                const now = selected && Model.items(pendingLatest).find(i => i.id === selected.id);
                const comparison = dialog.querySelector('.interval-current'); comparison.hidden = false; comparison.replaceChildren();
                if (selected && !now) { comparison.textContent = 'Značka byla mezitím odstraněna. Váš rozepsaný text zůstává ve formuláři.'; pendingLatest = null; return; }
                comparison.append(make('strong', 'Aktuálně uložená verze'));
                if (now) {
                    for (const [title, value] of [['Název', now.label], ['Začátek', format(now.start_ms)], ['Konec', now.end_ms == null ? 'Nenastavený' : format(now.end_ms)], ['Skladba', now.song_title || 'Bez přiřazení'], ['Typ pasáže', Model.passageTypes[now.passage_type] || '—'], ['Úsek', items().find(i => i.id === now.parent_id)?.label || 'Samostatná pasáž'], ['Poznámka', now.note_text || '—']]) comparison.append(make('p', title + ': ' + value));
                } else comparison.append(make('p', 'Seznam byl obnoven. Rozepsané údaje zůstávají.'));
                dialog.querySelector('.annotation-rebase').hidden = false;
            } catch (e) { report(e.message); }
        };
        dialog.querySelector('.annotation-rebase').onclick = () => {
            if (!pendingLatest) return;
            const now = selected ? Model.items(pendingLatest).find(i => i.id === selected.id) : null;
            if (selected && !now || now && !now.can_edit || !selected && !pendingLatest.can_create) { report('K této změně již nemáte oprávnění.'); return; }
            selected = now; revision = pendingLatest.timestamps_revision; fillOptions();
            dialog.querySelector('.annotation-rebase').hidden = dialog.querySelector('.interval-reload').hidden = true;
            pendingLatest = null; report('Zkontrolujte svoje údaje a znovu uložte.');
        };
        form.onsubmit = async e => {
            e.preventDefault(); if (busy || saved && !dirty()) return;
            timeError.textContent = ''; report('');
            if (passageError()) { report(passageError()); return; }
            if (!selected && !latestList.can_create) { report('K přidání značky již nemáte oprávnění.'); return; }
            if (invalidTimes.size) { timeError.textContent = [...invalidTimes.values()][0]; dialog.querySelector('.annotation-fine').open = true; return; }
            if (kind !== 'note' && end != null && end <= start) { timeError.textContent = 'Konec musí být po začátku.'; dialog.querySelector('[data-edit-time=end]').focus(); return; }
            if (kind === 'note' && !label.value.trim()) { report('U poznámky vyplňte text.'); update(); label.focus(); return; }
            const fields = { timestamps_revision: revision, time_ms: start, body: label.value };
            if (selected) { fields.id = selected.timestamp_id; fields.revision = selected.source.revision; }
            if (kind !== 'note') Object.assign(fields, { kind: kind === 'take' ? 'song_start' : 'passage', end_time_ms: end, note_text: note,
                song_collection_id: kind === 'take' && choices.song.value ? Number(choices.song.value) : null,
                passage_type: kind === 'passage' ? choices.passage_type.value : null,
                parent_timestamp_id: kind === 'passage' && choices.parent.value ? Number(choices.parent.value) : null });
            busy = true; update(); const buttons = [...form.querySelectorAll('button,input')]; buttons.forEach(b => b.disabled = true);
            try {
                latestList = await (kind === 'note' ? Store.saveNote(recording_id, fields) : Store.saveInterval(recording_id, fields));
                revision = latestList.timestamps_revision;
                // A successful save starts a blank annotation without replacing the player or its waveform.
                const parentId = choices.parent.value;
                item = null; finish = false; draft = { time_ms: currentTime() }; pendingLatest = null;
                populate(null);
                choices.song.value = ''; choices.passage_type.value = 'custom'; choices.parent.value = kind === 'passage' ? parentId : ''; choices.existing.value = '';
                const parent = parentTake();
                if (kind === 'passage' && parent && (start < parent.start_ms || start >= parent.end_ms)) start = parent.start_ms;
                reference();
                baseline = state(); justSaved = true;
                dialog.querySelector('.annotation-fine').open = false;
                dialog.querySelector('.interval-current').hidden = dialog.querySelector('.interval-reload').hidden = dialog.querySelector('.annotation-rebase').hidden = true;
            }
            catch (err) { report(err.message); dialog.querySelector('.interval-reload').hidden = err.status !== 409; error.scrollIntoView({ block: 'nearest' }); }
            finally { busy = false; buttons.forEach(b => b.disabled = false); update(); }
        };
        dialog.showModal(); resize(); dialog.querySelector('.annotation-close').focus({ preventScroll: true });
    }
    root.Vz2TimestampEditor = {
        isOpen: () => !!active?.dialog.open,
        async open({ recording_id, kind = 'take', item_id = null, adapter = null, finish = false, draft = {}, list = null }) {
            if (opening) return;
            if (active?.dialog.open) { active.dialog.focus(); return; }
            // Capture before any asynchronous list loading, not when the form finishes opening.
            draft = { time_ms: Math.max(0, Math.round(adapter?.currentTimeMs?.() ?? 0)), ...draft };
            opening = true;
            try {
                list = list || await Store.load(recording_id);
                const item = item_id ? Model.items(list).find(i => i.id === item_id) : null;
                if (item_id && !item) throw Error('Značka již neexistuje.');
                if (item ? !item.can_edit : !list.can_create) throw Error('K úpravě nemáte oprávnění.');
                kind = item?.kind || kind;
                if (!['take', 'passage', 'note'].includes(kind)) throw Error('Vyberte úsek, pasáž nebo poznámku.');
                mount({ recording_id, list, adapter, kind, item, finish, draft });
            } finally { opening = false; }
        }
    };
    root.addEventListener('beforeunload', e => { if (active?.dirty()) { e.preventDefault(); e.returnValue = ''; } });
})(window);
