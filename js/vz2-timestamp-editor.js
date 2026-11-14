/* One editor for takes, passages and point notes, independent of the host view. */
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
        dialog.innerHTML = `<form autocomplete="off" novalidate>
            <div class="annotation-header"><div><h2 id="annotation-title" class="visually-hidden"></h2><p class="interval-context"></p></div><button type="button" class="annotation-close" aria-label="Zavřít editor">×</button></div>
            <div class="annotation-player"></div>
            <div class="annotation-scroll">
                <div class="annotation-kinds" role="group" aria-label="Typ časové značky"><button type="button" data-kind="take">Úsek</button><button type="button" data-kind="passage">Pasáž</button><button type="button" data-kind="note">Poznámka</button></div>
                <div class="annotation-existing"><span>Rozpracovaný úsek</span><div data-choice="existing"></div></div>
                <div class="annotation-times">
                    <div class="annotation-boundaries">
                        <div class="annotation-time-row" role="group" aria-label="Začátek"><button type="button" data-capture="start">Začátek teď</button></div>
                        <div class="annotation-time-row annotation-end" role="group" aria-label="Konec"><button type="button" data-capture="end" aria-label="Nastavit konec podle přehrávače">Konec teď</button></div>
                    </div>
                    <p class="annotation-time-error error" role="alert"></p>
                    <details class="annotation-fine"><summary aria-label="Přesné časy">Časy</summary><div class="annotation-fine-rows"></div><button type="button" class="annotation-clear-end">Doplnit konec později</button></details>
                </div>
                <div class="annotation-fields">
                    <div class="annotation-song annotation-field"><span>Skladba</span><div data-choice="song"></div></div>
                    <div class="annotation-passage annotation-field"><span>Typ pasáže</span><div data-choice="passage_type"></div></div>
                    <div class="annotation-parent annotation-field"><span>Úsek</span><div data-choice="parent"></div></div>
                    <div class="annotation-field-tools"><button type="button" class="annotation-label-toggle" aria-expanded="false" aria-controls="annotation-caption">Popisek</button><button type="button" class="annotation-note-open" aria-label="Doplňující poznámka">Poznámka</button></div>
                    <section class="annotation-reference" aria-label="Časové značky nahrávky"><h3></h3><ol tabindex="0" aria-label="Seznam časových značek"></ol></section>
                </div>
                <p class="error annotation-error" role="alert"></p>
                <div class="interval-current" hidden></div><button type="button" class="interval-reload" hidden>Načíst aktuální verzi k porovnání</button><button type="button" class="annotation-rebase" hidden>Použít aktuální revizi</button>
            </div>
            <div class="annotation-footer">
                <div class="annotation-actions"><button type="button" class="annotation-new">Nová značka</button><button type="submit" class="annotation-save">Uložit úsek</button></div>
                <div id="annotation-caption" class="annotation-title-field" hidden><label for="annotation-label">Popisek</label><input id="annotation-label" name="label" maxlength="4000"></div>
                <div class="annotation-preview" role="group" aria-label="Náhled ukládané značky"><div class="annotation-preview-times"><button type="button" data-edit-time="start"></button><span class="annotation-preview-end"><span aria-hidden="true"> – </span><button type="button" data-edit-time="end"></button></span></div><div class="annotation-preview-text"><span class="annotation-preview-caption"></span><p class="annotation-preview-note"></p></div></div>
                <span class="annotation-save-status" role="status"></span>
            </div>
        </form>`;
        document.body.append(dialog);
        const form = dialog.querySelector('form'), error = dialog.querySelector('.annotation-error'), timeError = dialog.querySelector('.annotation-time-error');
        const label = form.elements.label, choices = {}, controls = root.Vz2TimestampControls;
        let selected = item, revision = list.timestamps_revision, busy = false, start, end, note = '', baseline, pendingLatest = null, noteDialog = null, latestList = list;
        let suggestedLabel = '', typeDrafts = {}, saved = !!item, captionOpen = !!item || kind === 'note';
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
        function fillOptions() {
            const song = choices.song.value;
            choices.song.setOptions([{ value: '', label: 'Bez přiřazení' }, ...(latestList.songs || []).filter(s => s.lifecycle !== 'archived' || String(s.id) === song || s.id === selected?.song_id).map(s => ({ value: s.id, label: s.title }))]);
            choices.passage_type.setOptions(Object.entries(Model.passageTypes).map(([value, label]) => ({ value, label })));
            choices.parent.setOptions([{ value: '', label: 'Samostatná pasáž' }, ...items().filter(i => i.kind === 'take').map(i => ({ value: i.timestamp_id, label: format(i.start_ms) + ' · ' + (i.song_title || i.label) + (i.end_ms === null ? ' · chybí konec' : '') }))]);
            const open = items().filter(i => i.kind === kind && i.status === 'open' && i.can_edit);
            choices.existing.setOptions([{ value: '', label: 'Nový úsek' }, ...open.map(i => ({ value: i.timestamp_id, label: format(i.start_ms) + ' · ' + (i.song_title || i.label) }))]);
            dialog.querySelector('.annotation-existing').hidden = !!selected || kind === 'note' || !open.length;
        }
        function reference() {
            const host = dialog.querySelector('.annotation-reference ol'), scroll = host.scrollTop; host.replaceChildren();
            const rows = items(); dialog.querySelector('.annotation-reference h3').textContent = 'Časové značky · ' + rows.length;
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
            dialog.querySelectorAll('[data-kind]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.kind === kind)); b.disabled = !!selected || busy; });
            dialog.querySelector('.annotation-end').hidden = point;
            dialog.querySelector('.annotation-boundaries').classList.toggle('annotation-point', point);
            dialog.querySelector('.annotation-time-row').setAttribute('aria-label', point ? 'Čas poznámky' : 'Začátek');
            dialog.querySelector('[data-capture=start]').setAttribute('aria-label', point ? 'Nastavit čas poznámky' : 'Nastavit začátek');
            dialog.querySelector('[data-capture=start]').title = point ? 'Nastavit čas poznámky podle přehrávače' : 'Nastavit začátek podle přehrávače';
            const exact = ms => format(ms) + (ms % 1000 ? ',' + String(ms % 1000).padStart(3, '0') : '');
            dialog.querySelector('[data-capture=start]').textContent = point ? 'Čas teď' : 'Začátek teď';
            dialog.querySelector('[data-edit-time=start]').textContent = exact(start);
            dialog.querySelector('[data-edit-time=end]').textContent = end == null ? 'konec neurčen' : exact(end);
            dialog.querySelector('[data-edit-time=start]').setAttribute('aria-label', (point ? 'Upravit čas poznámky ' : 'Upravit začátek ') + exact(start));
            dialog.querySelector('[data-edit-time=end]').setAttribute('aria-label', end == null ? 'Doplnit konec' : 'Upravit konec ' + exact(end));
            dialog.querySelector('.annotation-preview-end').hidden = point;
            dialog.querySelector('.annotation-song').hidden = kind !== 'take';
            dialog.querySelector('.annotation-passage').hidden = dialog.querySelector('.annotation-parent').hidden = kind !== 'passage';
            dialog.querySelector('label[for=annotation-label]').textContent = point ? 'Text poznámky' : 'Popisek';
            label.setAttribute('aria-label', point ? 'Text poznámky' : 'Popisek');
            const noteButton = dialog.querySelector('.annotation-note-open'); noteButton.hidden = point; noteButton.classList.toggle('has-note', !!note.trim()); noteButton.setAttribute('aria-label', note.trim() ? 'Upravit doplňující poznámku' : 'Doplňující poznámka');
            dialog.querySelector('.annotation-clear-end').hidden = point || end == null;
            dialog.querySelector('.annotation-fine-end').hidden = point;
            dialog.querySelector('.annotation-save').textContent = kind === 'take' ? 'Uložit úsek' : kind === 'passage' ? 'Uložit pasáž' : 'Uložit poznámku';
            dialog.querySelector('.annotation-title-field').hidden = !captionOpen && !point;
            dialog.querySelector('.annotation-label-toggle').setAttribute('aria-expanded', String(captionOpen || point));
            dialog.querySelector('.annotation-label-toggle').textContent = point ? 'Text poznámky' : 'Popisek';
            // Use the same normalization as the timestamp list, including default captions and inherited songs.
            const previewId = selected?.timestamp_id ?? Math.max(0, ...(latestList.entries || []).map(e => Number(e.id))) + 1;
            const source = { ...selected?.source, id: previewId, kind: point ? 'note' : kind === 'take' ? 'song_start' : 'passage', time_ms: start,
                end_time_ms: end, body: label.value, song_collection_id: kind === 'take' ? choices.song.value || null : null, song_title: '', history_song_title: '',
                passage_type: choices.passage_type.value, parent_timestamp_id: kind === 'passage' ? choices.parent.value || null : null };
            const previewEntries = (latestList.entries || []).filter(e => Number(e.id) !== previewId);
            previewEntries.push(source);
            const preview = Model.normalize({ recording_id, entries: previewEntries }, { collections: latestList.songs || [] }).find(i => i.timestamp_id === previewId);
            dialog.querySelector('.annotation-preview-caption').textContent = [preview?.song_title, preview?.label].filter(Boolean).join(' · ');
            dialog.querySelector('.annotation-preview-note').textContent = point ? '' : note;
            const clean = saved && !dirty();
            dialog.querySelector('.annotation-save-status').textContent = busy ? 'Ukládání…' : clean ? '✓ Uloženo' : 'Neuložené změny';
            dialog.querySelector('.annotation-save').disabled = busy || clean;
            dialog.querySelector('.annotation-new').disabled = busy || !latestList.can_create;
            dialog.querySelector('.annotation-preview').classList.toggle('is-saved', clean);
            for (const edge of ['start', 'end']) {
                const ms = edge === 'start' ? start : end;
                if (invalidTimes.has(edge) || document.activeElement === form.elements[edge]) continue;
                form.elements[edge].value = ms == null ? '' : format(ms) + (ms % 1000 ? ',' + String(ms % 1000).padStart(3, '0') : '');
            }
        }
        function setEdge(edge, value) {
            const total = adapter?.durationMs?.() || latestList.duration_ms;
            if (!Number.isSafeInteger(value) || value < 0 || total != null && value > total) { timeError.textContent = 'Čas musí ležet v nahrávce.'; invalidTimes.set(edge, timeError.textContent); update(); return; }
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
            const parents = Model.containingTakes(latestList, start, end);
            choices.parent.value = value ? value.source.parent_timestamp_id : parents.length === 1 ? parents[0].timestamp_id : '';
            saved = !!value; captionOpen = !!value || kind === 'note';
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
        dialog.querySelector('.annotation-label-toggle').onclick = () => {
            captionOpen = !captionOpen; update(); if (captionOpen || kind === 'note') label.focus();
        };
        label.oninput = update;
        choices.song.onChange(update);
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
        choices.passage_type.onChange(() => { suggestLabel(); update(); }); choices.parent.onChange(() => { suggestLabel(); update(); });
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
        dialog.querySelector('.annotation-new').onclick = () => {
            if (busy || !latestList.can_create || dirty() && !confirm('Zahodit rozepsané změny a začít novou značku?')) return;
            const song = choices.song.value, passageType = choices.passage_type.value;
            item = null; finish = false; draft = { time_ms: currentTime() }; typeDrafts = {}; pendingLatest = null;
            populate(null);
            choices.song.value = song; choices.passage_type.value = passageType; choices.existing.value = '';
            baseline = state(); report(''); timeError.textContent = '';
            dialog.querySelector('.interval-current').hidden = dialog.querySelector('.interval-reload').hidden = dialog.querySelector('.annotation-rebase').hidden = true;
            dialog.querySelector('.annotation-fine').open = false;
            update();
        };
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
            if (!selected && !latestList.can_create) { report('K přidání značky již nemáte oprávnění.'); return; }
            if (invalidTimes.size) { timeError.textContent = [...invalidTimes.values()][0]; dialog.querySelector('.annotation-fine').open = true; return; }
            if (kind !== 'note' && end != null && end <= start) { timeError.textContent = 'Konec musí být po začátku.'; dialog.querySelector('[data-edit-time=end]').focus(); return; }
            if (kind === 'note' && !label.value.trim()) { report('U poznámky vyplňte text.'); captionOpen = true; update(); label.focus(); return; }
            const fields = { timestamps_revision: revision, time_ms: start, body: label.value };
            if (selected) { fields.id = selected.timestamp_id; fields.revision = selected.source.revision; }
            if (kind !== 'note') Object.assign(fields, { kind: kind === 'take' ? 'song_start' : 'passage', end_time_ms: end, note_text: note,
                song_collection_id: kind === 'take' && choices.song.value ? Number(choices.song.value) : null,
                passage_type: kind === 'passage' ? choices.passage_type.value : null,
                parent_timestamp_id: kind === 'passage' && choices.parent.value ? Number(choices.parent.value) : null });
            const previousIds = new Set(items().map(i => i.timestamp_id));
            busy = true; update(); const buttons = [...form.querySelectorAll('button,input')]; buttons.forEach(b => b.disabled = true);
            try {
                latestList = await (kind === 'note' ? Store.saveNote(recording_id, fields) : Store.saveInterval(recording_id, fields));
                revision = latestList.timestamps_revision;
                // Retain the authoritative saved annotation; subsequent saves update it instead of duplicating it.
                const stored = items().find(i => fields.id ? i.timestamp_id === fields.id : i.kind === kind && !previousIds.has(i.timestamp_id));
                if (!stored) throw Error('Uloženou značku nelze načíst. Zavřete editor a obnovte seznam.');
                finish = false; draft = {}; typeDrafts = {}; pendingLatest = null;
                populate(stored, true);
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
