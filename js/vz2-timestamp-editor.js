/* One editor for takes, passages and point notes, independent of the host view. */
(function (root) {
    'use strict';
    const Model = root.Vz2TimestampModel, Store = root.Vz2TimestampStore;
    const format = ms => Model.format(ms);
    const names = { take: 'pokus', passage: 'pasáž', note: 'poznámka' };
    const make = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
    let active = null, opening = false;
    function mount({ recording_id, list, adapter, kind, item, finish, draft }) {
        const dialog = make('dialog', null, 'vz2-annotation-editor vz2-interval-editor');
        dialog.setAttribute('aria-labelledby', 'annotation-title');
        dialog.innerHTML = `<form autocomplete="off" novalidate>
            <div class="annotation-header"><div><h2 id="annotation-title" class="visually-hidden"></h2><p class="interval-context"></p></div><button type="button" class="annotation-close" aria-label="Zavřít editor">×</button></div>
            <div class="annotation-player"></div>
            <div class="annotation-kinds" role="group" aria-label="Typ časové značky"><button type="button" data-kind="take">Pokus</button><button type="button" data-kind="passage">Pasáž</button><button type="button" data-kind="note">Poznámka</button></div>
            <div class="annotation-scroll">
                <div class="annotation-existing"><span>Rozpracovaný úsek</span><div data-choice="existing"></div></div>
                <div class="annotation-times">
                    <div class="annotation-boundaries">
                        <div class="annotation-time-row" role="group" aria-label="Začátek"><button type="button" class="annotation-time" data-goto="start"></button><button type="button" data-capture="start" aria-label="Nastavit začátek" title="Nastavit začátek podle přehrávače">Nastavit</button></div>
                        <div class="annotation-time-row annotation-end" role="group" aria-label="Konec"><button type="button" class="annotation-time" data-goto="end"></button><button type="button" data-capture="end" aria-label="Nastavit konec" title="Nastavit konec podle přehrávače">Nastavit</button></div>
                    </div>
                    <p class="annotation-time-error error" role="alert"></p>
                    <details class="annotation-fine"><summary aria-label="Jemné doladění" title="Jemné doladění"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h6m4 0h6M4 17h10m4 0h2"/><circle cx="12" cy="7" r="2"/><circle cx="16" cy="17" r="2"/></svg></summary><div class="annotation-fine-rows"></div><button type="button" class="annotation-clear-end">Doplnit konec později</button></details>
                </div>
                <div class="annotation-fields">
                    <div class="annotation-song annotation-field"><span>Skladba</span><div data-choice="song"></div></div>
                    <div class="annotation-passage annotation-field"><span>Typ pasáže</span><div data-choice="passage_type"></div></div>
                    <div class="annotation-parent annotation-field"><span>Pokus</span><div data-choice="parent"></div></div>
                    <div class="annotation-field annotation-title-field"><label for="annotation-label">Název</label><input id="annotation-label" name="label" maxlength="4000"><button type="button" class="annotation-note-open" aria-label="Doplňující poznámka" title="Doplňující poznámka">+</button></div>
                    <section class="annotation-reference" aria-label="Časové značky nahrávky"><h3></h3><ol tabindex="0" aria-label="Seznam časových značek"></ol></section>
                </div>
                <p class="error annotation-error" role="alert"></p>
                <div class="interval-current" hidden></div><button type="button" class="interval-reload" hidden>Načíst aktuální verzi k porovnání</button><button type="button" class="annotation-rebase" hidden>Použít aktuální revizi</button>
            </div>
            <div class="annotation-footer"><output class="annotation-summary"></output><div><button type="button" class="interval-cancel">Zrušit</button><button type="submit" class="annotation-save">Uložit úsek</button></div></div>
        </form>`;
        document.body.append(dialog);
        const form = dialog.querySelector('form'), error = dialog.querySelector('.annotation-error'), timeError = dialog.querySelector('.annotation-time-error');
        const label = form.elements.label, choices = {}, controls = root.Vz2TimestampControls;
        let selected = item, revision = list.timestamps_revision, busy = false, start, end, note = '', baseline, pendingLatest = null, noteDialog = null, latestList = list;
        let suggestedLabel = '', typeDrafts = {};
        const invalidTimes = new Map();
        const state = () => JSON.stringify({ kind, start, end, label: label.value, note, song: choices.song.value, passage_type: choices.passage_type.value, parent: choices.parent.value });
        const dirty = () => baseline !== state();
        const currentTime = () => Math.max(0, Math.round(adapter?.currentTimeMs?.() ?? 0));
        const report = text => { error.textContent = text; };
        active = { dialog, dirty: () => dirty() || !!noteDialog && noteDialog.querySelector('textarea').value !== note, recording_id, adapter };
        for (const [key, title, search] of [['existing', 'Rozpracovaný úsek', true], ['song', 'Skladba', true], ['passage_type', 'Typ pasáže', false], ['parent', 'Pokus', true]]) {
            choices[key] = controls.choice(dialog.querySelector('[data-choice="' + key + '"]'), title, search);
        }
        const items = () => Model.items(latestList);
        function fillOptions() {
            const song = choices.song.value;
            choices.song.setOptions([{ value: '', label: 'Bez přiřazení' }, ...(latestList.songs || []).filter(s => s.lifecycle !== 'archived' || String(s.id) === song || s.id === selected?.song_id).map(s => ({ value: s.id, label: s.title }))]);
            choices.passage_type.setOptions(Object.entries(Model.passageTypes).map(([value, label]) => ({ value, label })));
            choices.parent.setOptions([{ value: '', label: 'Samostatná pasáž' }, ...items().filter(i => i.kind === 'take').map(i => ({ value: i.timestamp_id, label: format(i.start_ms) + ' · ' + (i.song_title || i.label) + (i.end_ms === null ? ' · chybí konec' : '') }))]);
            const open = items().filter(i => i.kind === kind && i.status === 'open' && i.can_edit);
            choices.existing.setOptions([{ value: '', label: 'Nový úsek' }, ...open.map(i => ({ value: i.timestamp_id, label: format(i.start_ms) + ' · ' + (i.song_title || i.label) }))]);
            dialog.querySelector('.annotation-existing').hidden = !!item || kind === 'note' || !open.length;
        }
        function reference() {
            const host = dialog.querySelector('.annotation-reference ol'), scroll = host.scrollTop; host.replaceChildren();
            const rows = items(); dialog.querySelector('.annotation-reference h3').textContent = 'Časové značky · ' + rows.length;
            if (!rows.length) host.append(make('li', 'Zatím žádné časové značky.', 'muted'));
            rows.forEach(i => {
                const row = make('li'); if (i.parent_id) row.classList.add('annotation-child');
                if (i.id === selected?.id) row.classList.add('annotation-selected');
                row.append(make('span', format(i.start_ms) + (i.end_ms == null ? i.kind === 'note' ? '' : ' – …' : '–' + format(i.end_ms))), make('span', i.label));
                if (i.note_text) row.title = i.note_text;
                host.append(row);
            }); host.scrollTop = scroll;
        }
        function update() {
            const point = kind === 'note';
            dialog.querySelector('#annotation-title').textContent = selected ? 'Upravit ' + names[kind] : kind === 'take' ? 'Nový pokus' : kind === 'passage' ? 'Nová pasáž' : 'Nová poznámka';
            dialog.querySelectorAll('[data-kind]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.kind === kind)); b.disabled = !!selected || busy; });
            dialog.querySelector('.annotation-end').hidden = point;
            dialog.querySelector('.annotation-boundaries').classList.toggle('annotation-point', point);
            dialog.querySelector('.annotation-time-row').setAttribute('aria-label', point ? 'Čas poznámky' : 'Začátek');
            dialog.querySelector('[data-capture=start]').setAttribute('aria-label', point ? 'Nastavit čas poznámky' : 'Nastavit začátek');
            dialog.querySelector('[data-capture=start]').title = point ? 'Nastavit čas poznámky podle přehrávače' : 'Nastavit začátek podle přehrávače';
            dialog.querySelector('[data-goto=start]').textContent = format(start);
            dialog.querySelector('[data-goto=end]').textContent = end == null ? '—' : format(end);
            dialog.querySelector('[data-goto=start]').setAttribute('aria-label', (point ? 'Přejít na čas poznámky ' : 'Přejít na začátek ') + format(start));
            dialog.querySelector('[data-goto=end]').setAttribute('aria-label', end == null ? 'Konec zatím není nastavený' : 'Přejít na konec ' + format(end));
            dialog.querySelector('.annotation-song').hidden = kind !== 'take';
            dialog.querySelector('.annotation-passage').hidden = dialog.querySelector('.annotation-parent').hidden = kind !== 'passage';
            dialog.querySelector('label[for=annotation-label]').textContent = point ? 'Text' : 'Název';
            label.setAttribute('aria-label', point ? 'Text poznámky' : 'Název');
            const noteButton = dialog.querySelector('.annotation-note-open'); noteButton.hidden = point; noteButton.classList.toggle('has-note', !!note.trim()); noteButton.setAttribute('aria-label', note.trim() ? 'Upravit doplňující poznámku' : 'Doplňující poznámka');
            dialog.querySelector('.annotation-clear-end').hidden = point || end == null;
            dialog.querySelector('.annotation-fine-end').hidden = point;
            dialog.querySelector('.annotation-save').textContent = kind === 'take' ? 'Uložit pokus' : kind === 'passage' ? 'Uložit pasáž' : 'Uložit poznámku';
            dialog.querySelector('.annotation-summary').textContent = point ? format(start) : format(start) + (end == null ? ' · konec doplním později' : '–' + format(end) + ' · ' + ((end - start) / 1000).toLocaleString('cs-CZ', { maximumFractionDigits: 3 }) + ' s');
            for (const edge of ['start', 'end']) {
                const ms = edge === 'start' ? start : end;
                form.elements[edge].value = ms == null ? '' : format(ms) + (ms % 1000 ? ',' + String(ms % 1000).padStart(3, '0') : '');
            }
        }
        function setEdge(edge, value) {
            const total = adapter?.durationMs?.() || latestList.duration_ms;
            if (!Number.isSafeInteger(value) || value < 0 || total != null && value > total) { timeError.textContent = 'Čas musí ležet v nahrávce.'; invalidTimes.set(edge, timeError.textContent); return; }
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
            input.onchange = () => { try { if (edge === 'end' && !input.value.trim()) { end = null; invalidTimes.delete(edge); update(); } else setEdge(edge, Model.parse(input.value)); } catch (e) { timeError.textContent = e.message; invalidTimes.set(edge, e.message); } };
            fine.append(row);
        }
        function populate(value, initial = false) {
            selected = value; kind = value?.kind || kind; invalidTimes.clear();
            start = value?.start_ms ?? draft.time_ms ?? currentTime();
            const capturedEnd = finish && value && adapter?.canPlay?.() && draft.time_ms > start ? draft.time_ms : null;
            end = kind === 'note' ? null : value?.end_ms ?? capturedEnd ?? draft.end_time_ms ?? null;
            label.value = value?.source.body?.replace(/^[↑↓]$/, '') || draft.body || '';
            note = value?.note_text || ''; suggestedLabel = ''; fillOptions();
            choices.song.value = value ? value.song_id : latestList.default_song_id;
            choices.passage_type.value = value?.passage_type || 'custom';
            const parents = Model.containingTakes(latestList, start, end);
            choices.parent.value = value ? value.source.parent_timestamp_id : parents.length === 1 ? parents[0].timestamp_id : '';
            update(); reference(); if (initial) baseline = state();
        }
        populate(item, true);
        dialog.querySelector('.interval-context').textContent = latestList.source_filename || latestList.title || 'Nahrávka';
        const player = controls.transport(dialog.querySelector('.annotation-player'), adapter, latestList, () => ({ start, end: kind === 'note' ? null : end }), report);
        const readiness = setInterval(() => {
            const ready = !!adapter?.canPlay?.();
            dialog.querySelectorAll('[data-capture], [data-goto]').forEach(b => b.disabled = busy || !ready || b.dataset.goto === 'end' && end == null);
        }, 200);
        dialog.querySelectorAll('[data-capture]').forEach(b => b.onclick = () => { if (adapter?.canPlay?.()) setEdge(b.dataset.capture, currentTime()); });
        dialog.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => player.seek(b.dataset.goto === 'start' ? start : end));
        dialog.querySelector('.annotation-clear-end').onclick = () => { end = null; invalidTimes.delete('end'); timeError.textContent = ''; update(); };
        dialog.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => {
            if (selected || b.dataset.kind === kind) return;
            typeDrafts[kind] = { start, end, label: label.value, note, song: choices.song.value, type: choices.passage_type.value, parent: choices.parent.value };
            const next = typeDrafts[b.dataset.kind]; kind = b.dataset.kind;
            if (next) { start = next.start; end = next.end; label.value = next.label; note = next.note; choices.song.value = next.song; choices.passage_type.value = next.type; choices.parent.value = next.parent; }
            else if (kind === 'note') { end = null; }
            fillOptions(); update(); timeError.textContent = '';
        });
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
        choices.passage_type.onChange(suggestLabel); choices.parent.onChange(suggestLabel);
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
        dialog.querySelector('.annotation-close').onclick = close; dialog.querySelector('.interval-cancel').onclick = close;
        dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
        const unsubscribe = Store.subscribe(value => {
            if (Number(value.recording_id) === Number(recording_id)) { latestList = value; reference(); }
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
                    for (const [title, value] of [['Název', now.label], ['Začátek', format(now.start_ms)], ['Konec', now.end_ms == null ? 'Nenastavený' : format(now.end_ms)], ['Skladba', now.song_title || 'Bez přiřazení'], ['Typ pasáže', Model.passageTypes[now.passage_type] || '—'], ['Pokus', items().find(i => i.id === now.parent_id)?.label || 'Samostatná pasáž'], ['Poznámka', now.note_text || '—']]) comparison.append(make('p', title + ': ' + value));
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
            e.preventDefault(); if (busy) return;
            timeError.textContent = ''; report('');
            if (invalidTimes.size) { timeError.textContent = [...invalidTimes.values()][0]; dialog.querySelector('.annotation-fine').open = true; return; }
            if (kind !== 'note' && end != null && end <= start) { timeError.textContent = 'Konec musí být po začátku.'; dialog.querySelector('[data-goto=end]').focus(); return; }
            if (kind === 'note' && !label.value.trim()) { report('U poznámky vyplňte text.'); label.focus(); return; }
            const fields = { timestamps_revision: revision, time_ms: start, body: label.value };
            if (selected) { fields.id = selected.timestamp_id; fields.revision = selected.source.revision; }
            if (kind !== 'note') Object.assign(fields, { kind: kind === 'take' ? 'song_start' : 'passage', end_time_ms: end, note_text: note,
                song_collection_id: kind === 'take' && choices.song.value ? Number(choices.song.value) : null,
                passage_type: kind === 'passage' ? choices.passage_type.value : null,
                parent_timestamp_id: kind === 'passage' && choices.parent.value ? Number(choices.parent.value) : null });
            busy = true; const buttons = [...form.querySelectorAll('button,input')]; buttons.forEach(b => b.disabled = true);
            try { await (kind === 'note' ? Store.saveNote(recording_id, fields) : Store.saveInterval(recording_id, fields)); dialog.close(); }
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
                if (!['take', 'passage', 'note'].includes(kind)) throw Error('Vyberte pokus, pasáž nebo poznámku.');
                mount({ recording_id, list, adapter, kind, item, finish, draft });
            } finally { opening = false; }
        }
    };
    root.addEventListener('beforeunload', e => { if (active?.dirty()) { e.preventDefault(); e.returnValue = ''; } });
})(window);
