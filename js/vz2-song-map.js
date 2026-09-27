(function () {
    'use strict';
    const make = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
    const button = (label, run, cls) => { const b = make('button', label, cls); b.type = 'button'; b.addEventListener('click', run); return b; };
    let current, serial = 0;
    const { Draft, types } = window.Vz2SongMapModel;
    const live = ctx => current === ctx;
    function modal(title) {
        const dialog = make('dialog', undefined, 'vz2-content-dialog song-map-dialog');
        dialog.setAttribute('aria-label', title);
        const header = make('div', undefined, 'dialog-header');
        const close = button('×', () => dialog.dispatchEvent(new Event('cancel', { cancelable: true })), 'modal-close');
        close.setAttribute('aria-label', 'Zavřít ' + title); header.append(make('h2', title), close); dialog.append(header);
        document.body.append(dialog); dialog.addEventListener('close', () => dialog.remove());
        return dialog;
    }
    function ask(text, title = 'Potvrzení', yes = 'Potvrdit', no = 'Zrušit') {
        return new Promise(resolve => {
            const dialog = modal(title), actions = make('div', undefined, 'toolbar');
            const finish = value => { dialog.close(); resolve(value); };
            const stay = button(no, () => finish(false));
            actions.append(stay, button(yes, () => finish(true))); dialog.append(make('p', text), actions);
            dialog.addEventListener('cancel', e => { e.preventDefault(); finish(false); }); dialog.showModal(); stay.focus();
        });
    }
    async function sectionName(ctx, section) {
        const name = await new Promise(resolve => {
            const dialog = modal(section ? 'Přejmenovat sekci' : 'Nová sekce'), form = make('form');
            const input = make('input'); input.maxLength = 200; input.required = true; input.value = section?.name || '';
            const field = make('label', 'Název sekce'); field.append(input);
            if (!section) {
                const select = make('select'); select.setAttribute('aria-label', 'Vybrat sekci');
                ['', 'Intro', 'Sloka', 'Refrén', 'Bridge', 'Sólo', 'Outro', 'Jiná'].forEach(value => {
                    const option = make('option', value || 'Zvolte sekci'); option.value = value; select.append(option);
                });
                select.addEventListener('change', () => { input.value = select.value === 'Jiná' ? '' : select.value; input.focus(); }); form.append(select);
            }
            const submit = make('button', section ? 'Přejmenovat' : 'Použít sekci'); submit.type = 'submit';
            form.append(field, submit); dialog.append(form, make('p', section ? '' : 'Sekce vznikne až s prvním zadaným taktem.', 'muted'));
            const finish = value => { dialog.close(); resolve(value); };
            form.addEventListener('submit', e => { e.preventDefault(); if (input.value.trim()) finish(input.value.trim()); });
            dialog.addEventListener('cancel', e => { e.preventDefault(); finish(null); }); dialog.showModal(); input.focus();
        });
        if (!name || !live(ctx)) return;
        if (section) ctx.draft.rename(section.id, name); else { ctx.draft.queue(name); ctx.tool = null; }
        render(ctx);
    }
    async function api(query, fields) {
        const response = await fetch('php/ajax/vz2_content.php' + (fields ? '' : '?' + new URLSearchParams(query)), {
            method: fields ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
            headers: fields ? { 'Content-Type': 'application/json', 'X-CSRF-Token': window.VZ2.csrf } : {},
            body: fields ? JSON.stringify(fields) : undefined
        });
        let data; try { data = await response.json(); } catch (_) { throw new Error('Server nevrátil platnou odpověď.'); }
        if (!response.ok || !data.ok) { const e = new Error(data.error || 'Operace selhala.'); e.status = response.status; throw e; }
        return data;
    }
    function symbol(bar) {
        if (bar.special) return { unknown: '?', pause: '—', stop: '■' }[bar.special];
        if (bar.fill === 4) return 'F4';
        return (bar.base === 'ride' ? '○' : '□') + (bar.crash ? '✦' : bar.fill ? 'F' + bar.fill : '');
    }
    function label(bar) {
        if (bar.special) return { unknown: 'Neurčený takt', pause: 'Pauza', stop: 'Stop' }[bar.special];
        if (bar.fill === 4) return 'F4';
        return (bar.base === 'ride' ? 'Ride' : 'Hi-hat') + (bar.crash ? ' + Crash na začátku' : bar.fill ? ' + F' + bar.fill : '');
    }
    function render(ctx) {
        const draft = ctx.draft, map = draft.map;
        ctx.host.replaceChildren(); ctx.actions.replaceChildren();
        if (ctx.notice) { const notice = make('p', ctx.notice, 'song-map-notice'); notice.setAttribute('role', 'status'); ctx.host.append(notice); }
        if (!map) {
            ctx.host.append(make('p', 'Tato skladba zatím nemá mapu.', 'muted'));
            if (ctx.response?.can_edit) ctx.host.append(button('Vytvořit mapu', () => { draft.create(); ctx.mode = 'edit'; render(ctx); sectionName(ctx); }));
            return;
        }
        const modes = make('div', undefined, 'song-map-modes'); modes.setAttribute('role', 'group'); modes.setAttribute('aria-label', 'Režim Mapy');
        [['map','MAPA'],['edit','UPRAVIT'],['listen','ZÁPIS POSLECHEM']].forEach(([mode, title]) => {
            if (mode !== 'map' && !ctx.response.can_edit) return;
            const control = button(title, () => { ctx.mode = mode; ctx.tool = null; ctx.copy = null; render(ctx); });
            control.setAttribute('aria-pressed', String(ctx.mode === mode)); modes.append(control);
        });
        ctx.host.append(modes);
        ctx.actions.append(make('span', draft.dirty ? 'Neuloženo' : 'Uloženo', 'song-map-save-state'));
        if (!ctx.preview) {
            if (ctx.response.can_edit) { const save = button('Uložit mapu', () => saveMap(ctx)); save.disabled = !draft.dirty || ctx.busy; ctx.actions.append(save); }
            if (ctx.response.document) ctx.actions.append(button('Historie mapy', () => history(ctx)));
            if (ctx.conflict) ctx.host.append(button('Porovnat aktuální verzi', () => compare(ctx)));
        }
        if (ctx.mode !== 'map') {
            const undo = button('↶ Zpět', () => { draft.undo(); ctx.copy = null; render(ctx); }); undo.disabled = !draft.history.length; ctx.host.append(undo);
            if (ctx.mode === 'edit') {
                const tools = make('div', undefined, 'toolbar song-map-tools');
                tools.append(button('Vybrat takt', () => { ctx.tool = null; render(ctx); }), button('Nová sekce', () => sectionName(ctx)));
                ctx.host.append(tools);
            }
            if (!ctx.copy) palette(ctx);
            if (draft.pending) ctx.host.append(make('p', 'Další takt začne: ' + draft.pending, 'song-map-pending'));
            if (!draft.sections.length && !draft.pending) ctx.host.append(button('Zvolit první sekci', () => sectionName(ctx)));
        }
        if (ctx.copy) {
            const tools = make('div', undefined, 'toolbar');
            tools.append(make('span', 'Vyberte cílové takty (' + ctx.copy.targets.size + ')'), button('Použít detail na vybrané takty', () => applyCopy(ctx)), button('Ukončit kopírování', () => { ctx.copy = null; render(ctx); }));
            ctx.host.append(tools);
        }
        const view = make('div', undefined, 'song-map'); view.dataset.mode = ctx.mode;
        let number = 0;
        map.sections.forEach((section, sectionIndex) => {
            const block = make('section', undefined, 'song-map-section'); block.dataset.sectionId = section.id;
            const header = make('div', undefined, 'song-map-section-header'); header.append(make('h3', section.name));
            if (ctx.mode === 'edit') {
                const controls = make('div', undefined, 'toolbar');
                const up = button('↑', () => { draft.moveSection(section.id, -1); render(ctx); }); up.disabled = sectionIndex === 0; up.title = 'Posunout sekci výše'; up.setAttribute('aria-label', up.title);
                const down = button('↓', () => { draft.moveSection(section.id, 1); render(ctx); }); down.disabled = sectionIndex === map.sections.length - 1; down.title = 'Posunout sekci níže'; down.setAttribute('aria-label', down.title);
                controls.append(up, down, button('Přejmenovat', () => sectionName(ctx, section)), button('Duplikovat', () => { draft.duplicate(section.id); render(ctx); }),
                    button('+ Takt', () => { draft.selected = section.bars[section.bars.length - 1].id; draft.insert(true); ctx.tool = null; render(ctx); }),
                    button('Smazat sekci', async () => { if (await ask('Smazat sekci „' + section.name + '“ včetně jejích taktů a Detailů?', 'Smazat sekci', 'Smazat sekci') && live(ctx)) { draft.removeSection(section.id); render(ctx); } }));
                header.append(controls);
            }
            block.append(header);
            for (let i = 0; i < section.bars.length; i += 8) {
                const row = make('div', undefined, 'song-map-row');
                section.bars.slice(i, i + 8).forEach(bar => {
                    const cell = button('', () => {
                        if (ctx.mode === 'map' || ctx.mode === 'listen') return detail(ctx, bar);
                        if (ctx.copy) { if (bar.id !== ctx.copy.source) { const targets = ctx.copy.targets; if (targets.has(bar.id)) targets.delete(bar.id); else targets.add(bar.id); } }
                        else { draft.selected = bar.id; if (ctx.tool) draft.setType(ctx.tool); }
                        render(ctx);
                    }, 'song-map-bar');
                    cell.append(make('span', symbol(bar)));
                    cell.dataset.barId = bar.id; cell.dataset.base = bar.base || '';
                    cell.setAttribute('aria-label', 'Takt ' + (++number) + ': ' + label(bar)); cell.title = label(bar);
                    if (ctx.mode === 'edit') { cell.append(make('small', String(number), 'song-map-number')); cell.setAttribute('aria-pressed', String(draft.selected === bar.id || ctx.copy?.targets.has(bar.id))); }
                    if (bar.detail) cell.classList.add('has-detail'); row.append(cell);
                });
                block.append(row);
            }
            view.append(block);
        });
        ctx.host.append(view);
        if (ctx.mode === 'edit' && draft.find() && !ctx.copy) selectedTools(ctx);
        [...ctx.host.querySelectorAll('button'), ...ctx.actions.querySelectorAll('button')].forEach(control => { if (ctx.busy) control.disabled = true; });
    }
    function palette(ctx) {
        const palette = make('div', undefined, 'song-map-palette'); palette.setAttribute('aria-label', 'Takty');
        const other = make('div', undefined, 'toolbar song-map-secondary');
        types.forEach((type, index) => {
            const control = button(type.name, () => {
                if (ctx.mode === 'listen' || ctx.draft.pending) {
                    if (!ctx.draft.append(type)) ctx.notice = 'Nejprve zvolte první sekci.';
                } else { ctx.tool = type; ctx.draft.setType(type); }
                render(ctx);
            });
            control.dataset.type = type.name;
            if (type.special === 'unknown') control.title = 'Neurčený takt – takt jsem slyšel, ale nestihl jsem určit jeho obsah.';
            control.setAttribute('aria-pressed', String(ctx.tool === type));
            if (index >= 12) other.append(control); else palette.append(control);
        });
        ctx.host.append(make('strong', 'TAKTY'), palette);
        if (ctx.mode === 'listen') {
            const sections = make('div', undefined, 'toolbar song-map-quick-sections');
            ['Intro','Sloka','Refrén','Bridge','Sólo','Outro','Jiná'].forEach(name => sections.append(button(name, () => {
                if (name === 'Jiná') sectionName(ctx); else { ctx.draft.queue(name); render(ctx); }
            })));
            ctx.host.append(make('strong', 'SEKCE'), sections);
        }
        ctx.host.append(make('small', 'DALŠÍ'), other);
    }
    function fields(ctx, action) {
        return { action, kind: 'song_map', collection_id: Number(ctx.collection.id), document_id: ctx.response.document?.id ?? null, current_revision: ctx.response.document?.current_revision ?? 0 };
    }
    async function write(ctx, fields) {
        if (ctx.busy || !live(ctx)) return false;
        ctx.busy = true; ctx.notice = 'Ukládám mapu…'; render(ctx);
        try {
            const response = await api(null, fields);
            if (!live(ctx)) return false;
            ctx.response = response; ctx.draft.reset(JSON.parse(response.version.body)); ctx.conflict = false; ctx.copy = null;
            ctx.notice = 'Mapa uložena · verze ' + response.document.current_revision; return true;
        } catch (e) {
            if (live(ctx)) { ctx.notice = e.message; ctx.conflict = e.status === 409; }
            return false;
        } finally { ctx.busy = false; if (live(ctx)) render(ctx); }
    }
    function saveMap(ctx) { return write(ctx, { ...fields(ctx, 'document_save'), body: JSON.stringify(ctx.draft.map) }); }
    async function compare(ctx) {
        if (ctx.busy) return;
        try {
            const latest = await api({ action: 'document', kind: 'song_map', collection_id: ctx.collection.id });
            if (!live(ctx)) return;
            const dialog = modal('Porovnání Mapy');
            dialog.append(make('p', 'Rozpracovaná Mapa zůstává zachovaná. Aktuálně na serveru: verze ' + (latest.document?.current_revision || 0)));
            const text = make('pre', latest.version ? JSON.stringify(JSON.parse(latest.version.body), null, 2) : 'Mapa zatím neexistuje.', 'content-preview'); dialog.append(text);
            if (latest.can_edit) dialog.append(button('Použít aktuální revizi pro další uložení', async () => {
                if (!await ask('Dalším uložením vytvoříte novou verzi ze své rozpracované Mapy nad touto serverovou verzí. Pokračovat?', 'Použít aktuální revizi', 'Použít revizi')) return;
                if (!live(ctx)) return;
                ctx.response = latest; ctx.conflict = false; ctx.notice = 'Zkontrolujte změny a použijte Uložit mapu.'; dialog.close(); render(ctx);
            }));
            dialog.addEventListener('cancel', e => { e.preventDefault(); dialog.close(); }); dialog.showModal();
        } catch (e) { ctx.notice = e.message; render(ctx); }
    }
    function history(ctx) {
        if (ctx.busy) return;
        const dialog = modal('Historie mapy'), status = make('p', 'Načítám…'), list = make('div');
        const older = button('Starší verze', () => load(before)); let before, loading = false; older.hidden = true;
        dialog.append(status, list, older); dialog.addEventListener('cancel', e => { e.preventDefault(); dialog.close(); }); dialog.showModal();
        async function load(cursor) {
            if (loading) return; loading = true; older.disabled = true;
            try {
                const result = await api({ action: 'history', kind: 'song_map', collection_id: ctx.collection.id, ...(cursor ? { before: cursor } : {}) });
                if (!dialog.isConnected) return;
                status.textContent = '';
                result.versions.forEach(version => {
                    const row = make('div', undefined, 'song-map-history-row');
                    row.append(make('span', 'Verze ' + version.revision + ' · ' + new Date(version.created_at).toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' }) + ' · ' + version.author + (Number(version.author_active) === 0 ? ' (neaktivní účet)' : '')),
                        button('Zobrazit', () => preview(version.revision))); list.append(row);
                });
                before = result.next_before; older.hidden = !before;
            } catch (e) { status.textContent = e.message; status.append(button('Zkusit znovu', () => load(cursor))); }
            finally { loading = false; older.disabled = false; }
        }
        async function preview(revision) {
            try {
                const result = await api({ action: 'document', kind: 'song_map', collection_id: ctx.collection.id, revision });
                if (!dialog.isConnected || !live(ctx)) return;
                const viewer = modal('Verze ' + revision), host = make('div'), actions = make('div', undefined, 'toolbar');
                viewer.append(actions, host); render({ ...ctx, host, actions, draft: new Draft(JSON.parse(result.version.body)), response: result, mode: 'map', preview: true, notice: '', copy: null, conflict: false });
                if (ctx.response.can_edit) viewer.append(button('Obnovit tuto verzi', async () => {
                    if (!await ask('Obnovit verzi ' + revision + ' jako novou verzi Mapy?' + (ctx.draft.dirty ? ' Rozpracované změny se nahradí.' : ''), 'Obnovit Mapu', 'Obnovit tuto verzi')) return;
                    viewer.close(); dialog.close(); await write(ctx, { ...fields(ctx, 'document_restore'), source_revision: Number(revision) });
                }));
                viewer.addEventListener('cancel', e => { e.preventDefault(); viewer.close(); }); viewer.showModal();
            } catch (e) { status.textContent = e.message; }
        }
        load();
    }
    function selectedTools(ctx) {
        const tools = make('div', undefined, 'toolbar song-map-selected-tools');
        const found = ctx.draft.find();
        const before = button('← Posunout takt', () => { ctx.draft.moveBar(-1); render(ctx); }); before.disabled = found.index === 0;
        const after = button('Posunout takt →', () => { ctx.draft.moveBar(1); render(ctx); }); after.disabled = found.index === found.section.bars.length - 1;
        tools.append(button('Vložit před', () => { ctx.draft.insert(false); ctx.tool = null; render(ctx); }), button('Vložit za', () => { ctx.draft.insert(true); ctx.tool = null; render(ctx); }),
            button('Odstranit takt', () => { ctx.draft.removeBar(); render(ctx); }), before, after,
            button('Detail taktu', () => detail(ctx, found.bar)), button('Kopírovat detail', () => { ctx.copy = { source: found.bar.id, targets: new Set() }; ctx.tool = null; render(ctx); }));
        ctx.host.append(tools);
    }
    async function applyCopy(ctx) {
        if (!ctx.copy?.targets.size) return;
        const copy = ctx.copy;
        const overwrite = [...copy.targets].some(id => ctx.draft.find(id)?.bar.detail);
        if (overwrite && !await ask('Některé cílové takty už obsahují Detail. Přepsat jejich text?', 'Přepsat Detaily', 'Přepsat detaily')) return;
        if (!live(ctx)) return;
        ctx.draft.copyDetail(copy.source, [...copy.targets]); ctx.copy = null; render(ctx);
    }
    function detail(ctx, bar) {
        const dialog = modal('Detail taktu'); dialog.classList.add('song-map-detail');
        const editable = ctx.mode === 'edit' && ctx.response.can_edit;
        const text = make('textarea'); text.value = bar.detail; text.rows = 10; text.spellcheck = false; text.readOnly = !editable; text.name = 'bar_detail';
        ctx.detailDialog = dialog;
        text.addEventListener('input', () => { ctx.detailDirty = editable && text.value !== bar.detail; });
        dialog.addEventListener('close', () => { ctx.detailDirty = false; if (ctx.detailDialog === dialog) ctx.detailDialog = null; });
        const field = make('label', 'Tabelatura / poznámka'); field.append(text);
        const error = make('p', '', 'error'); error.setAttribute('role', 'alert');
        const actions = make('div', undefined, 'toolbar');
        const close = async () => {
            if (editable && text.value !== bar.detail && !await ask('Zahodit rozepsaný Detail taktu?', 'Neuložený detail', 'Zahodit změny', 'Zůstat')) return;
            dialog.close();
        };
        if (editable) actions.append(button('Uložit detail', () => {
            if (new TextEncoder().encode(text.value).length > 65536) { error.textContent = 'Detail může mít nejvýše 64 KiB.'; return; }
            ctx.draft.setDetail(bar.id, text.value); dialog.close(); render(ctx);
        }), button('Kopírovat detail', async () => {
            if (text.value !== bar.detail) { error.textContent = 'Nejprve uložte rozepsaný detail do pracovní Mapy.'; return; }
            ctx.copy = { source: bar.id, targets: new Set() }; dialog.close(); render(ctx);
        }));
        actions.append(button(editable ? 'Zrušit' : 'Zavřít', close));
        dialog.append(field, error, actions); dialog.addEventListener('cancel', e => { e.preventDefault(); close(); }); dialog.showModal();
    }
    async function mount(collection) {
        if (current?.collection.id === collection?.id) return;
        const ticket = ++serial;
        const host = document.getElementById('tablature-content'), actions = document.getElementById('tablature-actions');
        current = null; host.replaceChildren(); actions.replaceChildren();
        if (!collection || collection.kind !== 'song') { host.append(make('p', collection ? 'Mapa skladby je dostupná u skladeb.' : 'Vyberte skladbu.', 'muted')); return; }
        const ctx = { collection, host, actions, draft: new Draft(), response: null, mode: 'map', tool: null, copy: null, notice: '', busy: false }; current = ctx;
        host.append(make('p', 'Načítám mapu…', 'muted'));
        try {
            ctx.response = await api({ action: 'document', collection_id: collection.id, kind: 'song_map' });
            if (ticket !== serial) return;
            ctx.draft.reset(ctx.response.version ? JSON.parse(ctx.response.version.body) : null); render(ctx);
        } catch (e) { if (ticket === serial) host.replaceChildren(make('p', e.message, 'error'), button('Zkusit znovu', () => { current = null; mount(collection); })); }
    }
    let leaving;
    async function canLeave(nextCollectionId) {
        const ctx = current;
        if (!ctx || (nextCollectionId !== undefined && String(nextCollectionId) === String(ctx.collection.id))) return true;
        if (ctx.busy) return false;
        if (!ctx.draft.dirty && !ctx.detailDirty) return true;
        if (leaving) return false;
        leaving = ask('Mapa obsahuje neuložené změny. Chcete je zahodit?', 'Neuložené změny', 'Zahodit změny', 'Zůstat');
        let discard; try { discard = await leaving; } finally { leaving = null; }
        if (!discard) return false;
        if (live(ctx)) { ctx.detailDialog?.close(); ctx.draft.reset(ctx.response.version ? JSON.parse(ctx.response.version.body) : null); ctx.mode = 'map'; ctx.copy = null; ctx.notice = ''; render(ctx); }
        return true;
    }
    window.addEventListener('beforeunload', e => { if (current?.draft.dirty || current?.detailDirty || current?.busy) { e.preventDefault(); e.returnValue = ''; } });
    window.Vz2SongMap = { mount, canLeave };
}());
