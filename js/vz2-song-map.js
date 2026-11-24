(function () {
    'use strict';
    const make = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
    const button = (label, run, cls) => { const b = make('button', label, cls); b.type = 'button'; b.addEventListener('click', run); return b; };
    let current, serial = 0;
    const { Draft, types, meterFor, label, collectDetails } = window.Vz2SongMapModel;
    const Detail = window.Vz2BarDetail;
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
            const submit = make('button', section ? 'Přejmenovat' : 'Vytvořit sekci'); submit.type = 'submit';
            form.append(field, submit); dialog.append(form);
            const finish = value => { dialog.close(); resolve(value); };
            form.addEventListener('submit', e => { e.preventDefault(); if (input.value.trim()) finish(input.value.trim()); });
            dialog.addEventListener('cancel', e => { e.preventDefault(); finish(null); }); dialog.showModal(); input.focus();
        });
        if (!name || !live(ctx)) return;
        if (section) ctx.draft.rename(section.id, name);
        else if (ctx.mode === 'listen') ctx.draft.queue(name);
        else {
            const sectionId = ctx.draft.addSection(name);
            render(ctx);
            focusSectionAction(ctx, sectionId, 'new', false);
            return;
        }
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
    function render(ctx) {
        const draft = ctx.draft, map = draft.map;
        const savedDetails = new Map((ctx.response?.version ? JSON.parse(ctx.response.version.body).sections : []).flatMap(section => section.bars.map(bar => [bar.id, bar.detail])));
        const previousScroll = ctx.host.querySelector('.song-map-scroll')?.scrollTop || 0;
        ctx.host.replaceChildren(); ctx.actions.replaceChildren();
        const controls = make('div', undefined, 'song-map-controls');
        if (ctx.notice) { const notice = make('p', ctx.notice, 'song-map-notice'); notice.setAttribute('role', 'status'); controls.append(notice); }
        if (!map) {
            if (ctx.notice) ctx.host.append(controls);
            ctx.host.append(make('p', 'Tato skladba zatím nemá mapu.', 'muted'));
            if (ctx.response?.can_edit) ctx.host.append(button('Vytvořit mapu', () => { draft.create(); ctx.mode = 'edit'; render(ctx); }));
            return;
        }
        const modeRow = compact => {
            const row = make('div', undefined, compact ? 'song-map-mode-row song-map-mode-row-mobile' : 'song-map-mode-row');
            const modes = make('div', undefined, 'song-map-modes'); modes.setAttribute('role', 'group'); modes.setAttribute('aria-label', 'Režim Mapy');
            [['map','MAPA'],['edit','UPRAVIT'],['listen','ZÁPIS POSLECHEM']].forEach(([mode, title]) => {
                if (mode !== 'map' && !ctx.response.can_edit) return;
                const control = button(compact && mode === 'listen' ? 'POSLECH' : title, () => { ctx.mode = mode; ctx.copy = null; ctx.barCopy = null; render(ctx); });
                if (compact) { control.setAttribute('aria-label', title); control.title = title; }
                control.setAttribute('aria-pressed', String(ctx.mode === mode)); modes.append(control);
            });
            row.append(modes);
            if (ctx.mode !== 'map') {
                const undo = button(compact ? '↶' : '↶ Zpět', () => { draft.undo(); ctx.copy = null; ctx.barCopy = null; ctx.scrollToEnd = ctx.mode === 'listen'; render(ctx); }, 'song-map-undo');
                if (compact) { undo.setAttribute('aria-label', 'Zpět'); undo.title = 'Zpět'; }
                undo.disabled = !draft.history.length; row.append(undo);
            }
            return row;
        };
        controls.append(modeRow(false));
        ctx.actions.append(modeRow(true));
        const saveState = make('span', draft.dirty ? 'Neuloženo' : 'Uloženo', 'song-map-save-state');
        saveState.dataset.dirty = String(draft.dirty); saveState.title = saveState.textContent;
        saveState.setAttribute('aria-label', saveState.textContent);
        ctx.actions.append(saveState);
        if (!ctx.preview) {
            if (ctx.response.can_edit) { const save = button('Uložit', () => saveMap(ctx)); save.setAttribute('aria-label', 'Uložit mapu'); save.disabled = !draft.dirty || ctx.busy; ctx.actions.append(save); }
            if (ctx.response.document) {
                const versions = button('Historie', () => history(ctx));
                versions.setAttribute('aria-label', 'Historie mapy');
                ctx.actions.append(versions);
            }
            if (ctx.conflict) controls.append(button('Porovnat aktuální verzi', () => compare(ctx)));
        }
        if (!ctx.copy && ctx.mode === 'listen') palette(ctx, controls);
        if (ctx.mode === 'edit' && !ctx.copy && !ctx.barCopy) controls.append(button('+ Sekce', () => sectionName(ctx)));
        if (ctx.barCopy) {
            controls.append(make('span', 'Vyberte místo pro vložení taktu.'),
                button('Ukončit kopírování taktu', () => { ctx.barCopy = null; render(ctx); }));
        }
        const details = collectDetails(map.sections);
        if (details.size) ctx.actions.append(button('Výpis detailů', () => detailList(ctx, details)));
        if (ctx.copy) {
            const tools = make('div', undefined, 'toolbar');
            tools.append(make('span', 'Vyberte cílové takty (' + ctx.copy.targets.size + ')'), button('Použít detail na vybrané takty', () => applyCopy(ctx)), button('Ukončit kopírování', () => { ctx.copy = null; render(ctx); }));
            controls.append(tools);
        }
        controls.classList.toggle('song-map-controls-only-modes', controls.childElementCount === 1);
        const scroll = make('div', undefined, 'song-map-scroll');
        const view = make('div', undefined, 'song-map'); view.dataset.mode = ctx.mode;
        let number = 0;
        map.sections.forEach((section, sectionIndex) => {
            const block = make('section', undefined, 'song-map-section'); block.dataset.sectionId = section.id;
            const header = make('div', undefined, 'song-map-section-header'); header.append(make('h3', section.name));
            if (ctx.mode === 'edit') header.append(sectionActions(ctx, section, sectionIndex));
            block.append(header);
            for (let i = 0; i < section.bars.length; i += 8) {
                const row = make('div', undefined, 'song-map-row');
                section.bars.slice(i, i + 8).forEach(bar => {
                    const cell = button('', () => {
                        if (ctx.mode === 'map' || ctx.mode === 'listen') return detail(ctx, bar);
                        if (ctx.barCopy) return pasteAtBar(ctx, bar.id);
                        if (!ctx.copy) return openBarEditor(ctx, section, { barId: bar.id, trigger: cell });
                        if (bar.id !== ctx.copy.source) {
                            const targets = ctx.copy.targets;
                            if (targets.has(bar.id)) targets.delete(bar.id); else targets.add(bar.id);
                        }
                        render(ctx);
                    }, 'song-map-bar');
                    cell.append(window.Vz2SongMapSvg.render(bar));
                    cell.dataset.barId = bar.id; cell.dataset.base = bar.base || '';
                    cell.setAttribute('aria-label', 'Takt ' + (++number) + ': ' + label(bar)); cell.title = label(bar);
                    if (ctx.mode === 'edit') {
                        cell.append(make('small', String(number), 'song-map-number'));
                        if (ctx.copy) cell.setAttribute('aria-pressed', String(ctx.copy.targets.has(bar.id)));
                    }
                    if (Detail.hasDetail(savedDetails.get(bar.id))) cell.classList.add('has-detail'); row.append(cell);
                });
                block.append(row);
            }
            view.append(block);
        });
        scroll.append(view);
        ctx.host.append(controls, scroll);
        scroll.scrollTop = ctx.scrollToEnd ? scroll.scrollHeight : previousScroll;
        ctx.scrollToEnd = false;
        [...ctx.host.querySelectorAll('button'), ...ctx.actions.querySelectorAll('button')].forEach(control => { if (ctx.busy) control.disabled = true; });
    }
    function focusSectionAction(ctx, sectionId, action, preventScroll = true) {
        ctx.host.querySelector('[data-section-id="' + sectionId + '"] [data-add="' + action + '"]')?.focus({ preventScroll });
    }
    function focusBar(ctx, id, preventScroll = true) {
        ctx.host.querySelector('[data-bar-id="' + id + '"]')?.focus({ preventScroll });
    }
    function sectionActions(ctx, section, sectionIndex) {
        const toolbar = make('div', undefined, 'song-map-section-actions');
        if (ctx.copy) return toolbar;
        if (ctx.barCopy) {
            toolbar.append(button('Vložit na konec sekce', () => pasteBar(ctx, section.id, section.bars.length)));
            return toolbar;
        }
        const last = section.bars[section.bars.length - 1];
        const repeat = button('Přidat stejný takt', () => {
            ctx.draft.copyBar(last.id, section.id, section.bars.length);
            render(ctx);
            focusSectionAction(ctx, section.id, 'repeat');
        });
        repeat.disabled = !last;
        repeat.dataset.add = 'repeat';
        const add = button('Přidat nový takt', () => openBarEditor(ctx, section, { trigger: add }));
        add.dataset.add = 'new';
        const menu = make('details', undefined, 'song-map-section-menu');
        menu.append(make('summary', 'Akce sekce'));
        const up = button('Posunout výše', () => { ctx.draft.moveSection(section.id, -1); render(ctx); });
        up.disabled = sectionIndex === 0;
        const down = button('Posunout níže', () => { ctx.draft.moveSection(section.id, 1); render(ctx); });
        down.disabled = sectionIndex === ctx.draft.sections.length - 1;
        menu.append(up, down, button('Přejmenovat', () => sectionName(ctx, section)),
            button('Duplikovat sekci', () => { ctx.draft.duplicate(section.id); render(ctx); }),
            button('Smazat sekci', async () => {
                if (await ask('Smazat sekci „' + section.name + '“ včetně jejích taktů?', 'Smazat sekci', 'Smazat sekci') && live(ctx)) {
                    ctx.draft.removeSection(section.id);
                    render(ctx);
                }
            }));
        toolbar.append(repeat, add, menu);
        return toolbar;
    }
    function openBarEditor(ctx, section, { barId, index = section.bars.length, trigger, position } = {}) {
        if (ctx.editor || ctx.busy || !live(ctx)) return;
        const found = barId && ctx.draft.find(barId);
        const anchor = section.bars[index - 1] || section.bars[index];
        const bar = found?.bar || {
            kind: 'rhythm', base: 'hihat', meter: anchor?.meter || meterFor('4/4'),
            marks: [], unresolved_fill: null, detail: ''
        };
        ctx.editor = window.Vz2SongMapEditor.open({
            bar, title: found ? 'Upravit takt' : 'Přidat takt',
            submitLabel: found ? 'Použít' : 'Přidat takt', position,
            barActions: found && barActions(ctx, found, trigger),
            onSubmit: value => {
                if (found) { ctx.draft.replaceBar(barId, value); return barId; }
                return ctx.draft.insertBar(section.id, index, value);
            },
            onClose: result => {
                ctx.editor = null;
                if (!result) { trigger?.focus({ preventScroll: true }); return; }
                render(ctx);
                if (trigger?.dataset.add === 'new') focusSectionAction(ctx, section.id, 'new');
                else focusBar(ctx, result);
            }
        });
    }
    function barActions(ctx, { section, bar, index }, trigger) {
        const insert = after => openBarEditor(ctx, section, {
            index: index + Number(after), trigger,
            position: (after ? 'Vložit za takt ' : 'Vložit před takt ') + trigger.querySelector('.song-map-number').textContent
        });
        const move = delta => { ctx.draft.selected = bar.id; ctx.draft.moveBar(delta); render(ctx); focusBar(ctx, bar.id); };
        const actions = [
            ['Vložit před', () => insert(false)], ['Vložit za', () => insert(true)],
            ['Duplikovat', () => { const copy = ctx.draft.copyBar(bar.id, section.id, index + 1); render(ctx); focusBar(ctx, copy); }],
            ['Opakovat…', () => repeatBar(ctx, bar.id, section.id, index + 1)],
            ['Kopírovat takt', () => { ctx.barCopy = bar.id; render(ctx); }],
            ['Kopírovat detail', () => { ctx.copy = { source: bar.id, targets: new Set() }; render(ctx); }],
            ['Smazat takt', () => {
                ctx.draft.selected = bar.id;
                ctx.draft.removeBar();
                render(ctx);
                if (ctx.draft.selected) focusBar(ctx, ctx.draft.selected);
                else focusSectionAction(ctx, section.id, 'new');
            }]
        ];
        if (index > 0) actions.push(['Posunout doleva', () => move(-1)]);
        if (index + 1 < section.bars.length) actions.push(['Posunout doprava', () => move(1)]);
        return actions;
    }
    function repeatBar(ctx, source, sectionId, index) {
        const dialog = modal('Opakovat takt'), form = make('form');
        const field = make('label', 'Počet kopií'), count = make('input');
        const total = ctx.draft.sections.reduce((sum, item) => sum + item.bars.length, 0);
        const available = 8192 - total;
        if (available < 1) {
            dialog.remove();
            ctx.notice = 'Mapa může obsahovat nejvýše 8192 taktů.';
            render(ctx);
            return;
        }
        Object.assign(count, { type: 'number', min: '1', max: String(available), value: '1', required: true });
        field.append(count);
        const submit = make('button', 'Přidat kopie'); submit.type = 'submit';
        form.append(field, submit);
        form.addEventListener('submit', event => {
            event.preventDefault();
            if (!live(ctx)) return;
            const copy = ctx.draft.copyBar(source, sectionId, index, Number(count.value));
            if (copy) { dialog.close(); render(ctx); focusBar(ctx, copy, false); }
        });
        dialog.append(form);
        dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close(); });
        dialog.showModal(); count.select();
    }
    function pasteBar(ctx, sectionId, index) {
        const copy = ctx.draft.copyBar(ctx.barCopy, sectionId, index);
        if (!copy) ctx.notice = 'Kopii taktu se nepodařilo vložit.';
        ctx.barCopy = null;
        render(ctx);
        if (copy) focusBar(ctx, copy);
    }
    function pasteAtBar(ctx, barId) {
        const { section, index } = ctx.draft.find(barId);
        const dialog = modal('Vložit kopii taktu');
        const place = after => { dialog.close(); pasteBar(ctx, section.id, index + Number(after)); };
        dialog.append(button('Vložit před', () => place(false)), button('Vložit za', () => place(true)));
        dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close(); });
        dialog.showModal();
    }
    function detailList(ctx, details) {
        const dialog = modal('Výpis detailů skladby');
        for (const [text, occurrences] of details) {
            const item = make('article', undefined, 'song-map-detail-item');
            item.append(make('pre', text, 'content-preview'));
            const links = make('div', undefined, 'toolbar');
            for (const { id, number, section } of occurrences) {
                links.append(button(section + ' · takt ' + number, () => { dialog.close(); focusBar(ctx, id, false); }));
            }
            item.append(links);
            dialog.append(item);
        }
        dialog.addEventListener('cancel', event => { event.preventDefault(); dialog.close(); });
        dialog.showModal();
    }
    function palette(ctx, host) {
        const palette = make('div', undefined, 'song-map-palette song-map-palette-' + ctx.mode); palette.setAttribute('aria-label', 'Takty');
        if (ctx.mode === 'listen') {
            const sections = make('div', undefined, 'toolbar song-map-quick-sections');
            ['Intro','Sloka','Refrén','Bridge','Sólo','Outro','Jiná'].forEach(name => sections.append(button(name, () => {
                if (name === 'Jiná') sectionName(ctx); else { ctx.draft.queue(name); render(ctx); }
            })));
            host.append(make('strong', 'SEKCE'), sections);
        }
        const heading = make('div', undefined, 'song-map-palette-heading');
        heading.append(make('strong', 'TAKTY'));
        if (ctx.draft.pending) heading.append(make('span', 'Další takt začne: ' + ctx.draft.pending, 'song-map-pending'));
        host.append(heading);
        types.forEach(type => {
            const control = button(type.name, () => {
                ctx.draft.append(type); ctx.scrollToEnd = true;
                render(ctx);
            });
            control.dataset.type = type.name;
            if (type.special === 'unknown') control.title = 'Neurčený takt – takt jsem slyšel, ale nestihl jsem určit jeho obsah.';
            palette.append(control);
        });
        host.append(palette);
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
            ctx.response = response; ctx.draft.reset(JSON.parse(response.version.body)); ctx.conflict = false; ctx.copy = null; ctx.barCopy = null;
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
                viewer.append(actions, host); render({ ...ctx, host, actions, draft: new Draft(JSON.parse(result.version.body)), response: result, mode: 'map', preview: true, notice: '', copy: null, barCopy: null, conflict: false });
                if (ctx.response.can_edit) viewer.append(button('Obnovit tuto verzi', async () => {
                    if (!await ask('Obnovit verzi ' + revision + ' jako novou verzi Mapy?' + (ctx.draft.dirty ? ' Rozpracované změny se nahradí.' : ''), 'Obnovit Mapu', 'Obnovit tuto verzi')) return;
                    viewer.close(); dialog.close(); await write(ctx, { ...fields(ctx, 'document_restore'), source_revision: Number(revision) });
                }));
                viewer.addEventListener('cancel', e => { e.preventDefault(); viewer.close(); }); viewer.showModal();
            } catch (e) { status.textContent = e.message; }
        }
        load();
    }
    async function applyCopy(ctx) {
        if (!ctx.copy?.targets.size) return;
        const copy = ctx.copy;
        const overwrite = [...copy.targets].some(id => ctx.draft.find(id)?.bar.detail);
        if (overwrite && !await ask('Některé cílové takty už obsahují Detail. Přepsat jejich text?', 'Přepsat Detaily', 'Přepsat detaily')) return;
        if (!live(ctx)) return;
        ctx.draft.copyDetail(copy.source, [...copy.targets]); ctx.copy = null; render(ctx);
    }
    function unsavedChoice(message, title = 'Neuložený detail') {
        return new Promise(resolve => {
            const dialog = modal(title), actions = make('div', undefined, 'toolbar');
            const finish = value => { dialog.close(); resolve(value); };
            const stay = button('Zůstat', () => finish('stay'));
            actions.append(stay, button('Zahodit změny', () => finish('discard')), button('Uložit', () => finish('save')));
            dialog.append(make('p', message), actions);
            dialog.addEventListener('cancel', e => { e.preventDefault(); finish('stay'); });
            dialog.showModal(); stay.focus();
        });
    }
    function detail(ctx, bar) {
        if (ctx.detailDialog?.open) return;
        const dialog = modal('Detail taktu'); dialog.classList.add('song-map-detail');
        const editable = (ctx.mode === 'edit' || ctx.mode === 'map') && ctx.response.can_edit && !ctx.preview;
        const savedText = () => {
            const savedMap = ctx.response.version ? JSON.parse(ctx.response.version.body) : null;
            return Detail.normalize(savedMap?.sections.flatMap(section => section.bars).find(item => item.id === bar.id)?.detail);
        };
        const text = make('textarea'); text.value = Detail.normalize(bar.detail); text.rows = 10; text.spellcheck = false; text.readOnly = !editable; text.name = 'bar_detail';
        text.wrap = 'off'; text.autocomplete = 'off'; text.setAttribute('autocorrect', 'off'); text.setAttribute('autocapitalize', 'off');
        const status = make('span', '', 'muted'); status.setAttribute('role', 'status');
        const changed = () => { ctx.detailDirty = editable && text.value !== savedText(); status.textContent = ctx.detailDirty ? 'Neuloženo' : 'Uloženo'; };
        const editor = Detail.attach(text, changed);
        ctx.detailDialog = dialog; changed();
        let saving = false, closing = false;
        const field = make('label', 'Tabulatura / poznámka'); field.append(text);
        const error = make('p', '', 'error'); error.setAttribute('role', 'alert');
        const tools = make('div', undefined, 'toolbar song-map-detail-tools');
        if (editable) {
            const meter = make('select'); meter.setAttribute('aria-label', 'Metrum pro předvyplnění');
            Detail.meters.forEach(value => { const option = make('option', value); option.value = value; meter.append(option); });
            meter.value = Detail.meterPreference.get();
            meter.addEventListener('change', () => Detail.meterPreference.set(meter.value));
            const label = make('label', 'Metrum pro předvyplnění'); label.append(meter);
            tools.append(label, button('Předvyplnit', async () => {
                editor.flush();
                if (text.value !== '' && !await ask('Předvyplnění nahradí celý aktuální text detailu. Chcete pokračovat?', 'Předvyplnit detail', 'Nahradit')) return;
                if (!dialog.open || saving) return;
                editor.replace(Detail.template(meter.value));
            }));
        }
        let fontSize = 16;
        const smaller = button('−', () => resize(-2)), bigger = button('+', () => resize(2));
        smaller.setAttribute('aria-label', 'Zmenšit písmo'); bigger.setAttribute('aria-label', 'Zvětšit písmo');
        // Mouse/touch controls must not collapse the editor selection or move its caret.
        [smaller, bigger].forEach(control => control.addEventListener('mousedown', event => event.preventDefault()));
        function resize(delta) { fontSize = Math.max(12, Math.min(28, fontSize + delta)); text.style.fontSize = fontSize + 'px'; smaller.disabled = fontSize === 12; bigger.disabled = fontSize === 28; }
        const fontControls = make('span', undefined, 'song-map-detail-font');
        fontControls.setAttribute('role', 'group'); fontControls.setAttribute('aria-label', 'Velikost písma');
        fontControls.append(smaller, bigger); tools.append(fontControls); resize(0);
        if (editable) tools.append(make('span', 'Přepis', 'muted'), button('Zpět', () => { editor.undo(); text.focus(); }), button('Znovu', () => { editor.redo(); text.focus(); }));
        tools.append(status);
        const actions = make('div', undefined, 'toolbar');
        const save = async () => {
            if (!editable || saving || ctx.busy || !live(ctx)) return false;
            editor.flush(); changed();
            if (new TextEncoder().encode(text.value).length > 65536) { error.textContent = 'Detail může mít nejvýše 64 KiB.'; return false; }
            if (!ctx.detailDirty && !ctx.draft.dirty) { dialog.close(); return true; }
            // Save through the existing versioned map endpoint. Do not change the draft or
            // the saved indicator until the server accepts the revision.
            const snapshot = JSON.parse(JSON.stringify(ctx.draft.map));
            const target = snapshot.sections.flatMap(section => section.bars).find(item => item.id === bar.id);
            if (!target) { error.textContent = 'Takt již není v rozpracované mapě.'; return false; }
            target.detail = text.value;
            saving = true; text.readOnly = true; error.textContent = '';
            const controls = [...dialog.querySelectorAll('button, select')], disabled = controls.map(control => control.disabled);
            controls.forEach(control => { control.disabled = true; });
            const selected = ctx.draft.selected;
            const ok = await write(ctx, { ...fields(ctx, 'document_save'), body: JSON.stringify(snapshot) });
            saving = false; text.readOnly = !editable;
            controls.forEach((control, index) => { control.disabled = disabled[index]; });
            if (ok) {
                ctx.detailDirty = false; ctx.draft.selected = selected;
                dialog.close(); render(ctx);
            } else {
                error.textContent = ctx.notice || 'Uložení selhalo. Zkuste Uložit detail znovu.';
                if (ctx.conflict) error.append(button('Porovnat aktuální verzi', () => compare(ctx)));
                changed();
            }
            return ok;
        };
        ctx.detailSave = save;
        ctx.detailFlush = () => { editor.flush(); changed(); };
        const discard = () => {
            // Copied details can already be in the working map. Discard only this text.
            if (editable && Detail.normalize(ctx.draft.find(bar.id)?.bar.detail) !== savedText()) ctx.draft.setDetail(bar.id, savedText());
            dialog.close(); if (live(ctx)) render(ctx);
        };
        const close = async () => {
            if (saving || closing) return;
            editor.flush(); changed(); closing = true;
            try {
                if (!ctx.detailDirty) { dialog.close(); return; }
                const choice = await unsavedChoice('Detail obsahuje neuložené změny. Uložit, zahodit, nebo pokračovat v editaci?');
                if (choice === 'save') await save();
                else if (choice === 'discard') discard();
            } finally { closing = false; }
        };
        if (editable) actions.append(button('Uložit detail', save), button('Kopírovat detail', () => {
            if (ctx.detailDirty) { error.textContent = 'Nejprve uložte rozepsaný detail.'; return; }
            ctx.copy = { source: bar.id, targets: new Set() }; dialog.close(); render(ctx);
        }));
        actions.append(button(editable ? 'Zrušit' : 'Zavřít', close));
        dialog.append(tools, field);
        if (editable) dialog.append(make('p', 'Uložit detail uloží novou verzi celé mapy včetně jejích rozpracovaných změn. Metrum výše slouží jen pro příští předvyplnění.', 'muted'));
        dialog.append(error, actions);
        dialog.addEventListener('close', () => { editor.destroy(); if (ctx.detailDialog === dialog) { ctx.detailDirty = false; ctx.detailDialog = null; ctx.detailSave = null; ctx.detailFlush = null; } });
        dialog.addEventListener('cancel', e => { e.preventDefault(); close(); }); dialog.showModal();
    }
    async function mount(collection) {
        if (current?.collection.id === collection?.id) return;
        const ticket = ++serial;
        const host = document.getElementById('song-map-content'), actions = document.getElementById('tablature-actions');
        current = null; host.replaceChildren(); actions.replaceChildren();
        if (!collection || collection.kind !== 'song') { host.append(make('p', collection ? 'Mapa skladby je dostupná u skladeb.' : 'Vyberte skladbu.', 'muted')); return; }
        const ctx = { collection, host, actions, draft: new Draft(), response: null, mode: 'map', copy: null, notice: '', busy: false }; current = ctx;
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
        if (ctx.busy || ctx.editor) return false;
        ctx.detailFlush?.();
        if (!ctx.draft.dirty && !ctx.detailDirty) { ctx.detailDialog?.close(); return true; }
        if (leaving) return false;
        leaving = ctx.detailDirty
            ? unsavedChoice('Detail obsahuje neuložené změny. Uložení uloží i rozpracovanou mapu.', 'Neuložené změny')
            : ask('Mapa obsahuje neuložené změny. Chcete je zahodit?', 'Neuložené změny', 'Zahodit změny', 'Zůstat').then(discard => discard ? 'discard' : 'stay');
        let choice; try { choice = await leaving; } finally { leaving = null; }
        if (choice === 'stay') return false;
        if (choice === 'save') return ctx.detailSave ? ctx.detailSave() : false;
        if (live(ctx)) { ctx.detailDialog?.close(); ctx.draft.reset(ctx.response.version ? JSON.parse(ctx.response.version.body) : null); ctx.mode = 'map'; ctx.copy = null; ctx.notice = ''; render(ctx); }
        return true;
    }
    window.addEventListener('beforeunload', e => { if (current?.draft.dirty || current?.detailDirty || current?.editor?.dirty() || current?.busy) { e.preventDefault(); e.returnValue = ''; } });
    window.Vz2SongMap = { mount, canLeave };
}());
