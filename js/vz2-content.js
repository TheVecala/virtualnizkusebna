(function () {
    'use strict';
    const titles = { lyrics_chords: 'Text a akordy', tablature: 'Tabulatura' };
    const make = (tag, text, cls) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
    const button = (label, run) => { const b = make('button', label); b.type = 'button'; b.onclick = run; return b; };
    const iconButton = (label, icon, run) => {
        const b = button('', run), i = make('i', undefined, 'ti ti-' + icon);
        b.className = 'vz2-icon-button'; b.title = label; b.setAttribute('aria-label', label);
        i.setAttribute('aria-hidden', 'true'); b.append(i); return b;
    };
    const date = value => new Date(value).toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' });
    const author = (name, active) => name + (Number(active) === 0 ? ' (neaktivní účet)' : '');
    let current, ideas;
    async function api(query, fields) {
        const r = await fetch('php/ajax/vz2_content.php' + (fields ? '' : '?' + new URLSearchParams(query)), {
            method: fields ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
            headers: fields ? { 'Content-Type': 'application/json', 'X-CSRF-Token': window.VZ2.csrf } : {},
            body: fields ? JSON.stringify(fields) : undefined
        });
        let data;
        try { data = await r.json(); } catch (_) { throw new Error('Server nevrátil platnou odpověď. Ověřte připojení a přihlášení.'); }
        if (!r.ok || !data.ok) { const e = new Error(data.error || 'Operace selhala.'); e.status = r.status; throw e; }
        return data;
    }
    function close(ctx) {
        if (ctx.busy || (ctx.dirty && !confirm('Zahodit rozepsané změny?'))) return false;
        ctx.dialog.close(); ctx.dialog.remove(); if (current === ctx) current = null;
        if (previewCollection) mountPreviews(previewCollection);
        return true;
    }
    function start(title) {
        if (current && !close(current)) return null;
        const dialog = make('dialog', undefined, 'vz2-content-dialog'), header = make('div', undefined, 'dialog-header');
        const ctx = { dialog, busy: false, dirty: false, status: make('p', 'Načítám…', 'error') };
        ctx.live = () => current === ctx && dialog.open;
        ctx.status.setAttribute('role', 'status');
        const closeButton = button('×', () => close(ctx));
        closeButton.className = 'modal-close'; closeButton.setAttribute('aria-label', 'Zavřít'); closeButton.title = 'Zavřít';
        header.append(make('h2', title), closeButton);
        dialog.append(header, ctx.status); document.body.append(dialog); current = ctx;
        dialog.addEventListener('cancel', e => { e.preventDefault(); close(ctx); });
        dialog.showModal(); return ctx;
    }
    async function busy(ctx, fn) {
        if (ctx.busy) return;
        ctx.busy = true; ctx.dialog.setAttribute('aria-busy', 'true');
        const controls = [...ctx.dialog.querySelectorAll('button,input,textarea')].map(n => [n,n.disabled]); controls.forEach(([n]) => n.disabled = true);
        try { await fn(); } catch (e) { if (ctx.live()) ctx.status.textContent = e.message; }
        finally { ctx.busy = false; ctx.dialog.removeAttribute('aria-busy'); controls.forEach(([n, disabled]) => n.disabled = disabled); }
    }
    function startIdeas() {
        if (current && !close(current)) return null;
        const host = document.getElementById('ideas-workspace');
        const header = make('div', undefined, 'panel-header'), content = make('div', undefined, 'panel-body content-editor');
        const title = make('h2', 'Nápady'); title.id = 'ideas-title'; host.setAttribute('aria-labelledby', title.id);
        const back = button('Zpět k panelům', () => window.Vz2Layout.hideIdeas()); back.id = 'ideas-back'; back.className = 'panel-header-action';
        header.append(title, back);
        const ctx = { dialog: content, busy: false, dirty: false, status: make('p', 'Načítám…', 'error') };
        ctx.status.setAttribute('role', 'status'); ctx.title = title; ctx.live = () => host.isConnected;
        content.append(ctx.status); host.replaceChildren(header, content); ideas = ctx;
        window.Vz2Layout.showIdeas(); return ctx;
    }
    window.addEventListener('beforeunload', e => { if (current?.dirty || current?.busy || ideas?.dirty || ideas?.busy) { e.preventDefault(); e.returnValue = ''; } });
    async function openDocument(collection, kind) {
        const ctx = start(titles[kind] + ' — ' + collection.title); if (!ctx) return;
        const query = { action: 'document', collection_id: collection.id, kind };
        const meta = make('p', '', 'muted'), form = make('form'), titleLabel = make('label', 'Název dokumentu'), title = make('input');
        title.required = true; title.maxLength = 200; title.name = 'document_title'; titleLabel.append(title);
        const bodyLabel = make('label', 'Obsah'), body = make('textarea'); body.name = 'document_body'; body.rows = 14; body.spellcheck = false; body.required = true; bodyLabel.append(body);
        const save = make('button', 'Uložit novou verzi'), compare = button('Načíst aktuální verzi k porovnání', compareLatest);
        compare.hidden = true;
        const comparison = make('pre', '', 'content-preview'); comparison.hidden = true;
        const controls = make('div', undefined, 'toolbar'); controls.append(save, compare);
        form.append(titleLabel, bodyLabel, controls);
        const history = make('section'), historyList = make('div'), preview = make('pre', '', 'content-preview'); preview.hidden = true;
        const restore = iconButton('Obnovit jako novou verzi', 'restore', restoreVersion); restore.hidden = true;
        const older = button('Starší verze', () => loadHistory(ctx.before)); older.hidden = true;
        const showHistory = button('Historie verzí', () => loadHistory(null));
        history.append(showHistory, historyList, older, preview, restore); ctx.dialog.append(meta, form, comparison, history);
        let state, viewed;
        [title, body].forEach(n => n.addEventListener('input', () => ctx.dirty = true));
        function showMeta() {
            meta.textContent = state.document ? 'Verze ' + state.document.current_revision + ' · vytvořil/a ' + author(state.document.author,state.document.author_active)
                + ' · upravil/a ' + author(state.document.editor,state.document.editor_active) + ' · ' + date(state.document.updated_at) : 'Dokument se vytvoří při prvním uložení.';
        }
        function assign(value) {
            state = value; title.value = value.document?.title || titles[kind]; body.value = value.version?.body || '';
            title.readOnly = body.readOnly = !value.can_edit; save.hidden = !value.can_edit; showHistory.hidden = !value.document;
            ctx.dirty = false; compare.hidden = comparison.hidden = true; ctx.status.textContent = ''; showMeta();
        }
        function fields(action) { return { action, collection_id: Number(collection.id), kind, document_id: state.document?.id ?? null, current_revision: state.document?.current_revision ?? 0 }; }
        async function compareLatest() {
            await busy(ctx, async () => {
                const latest = await api(query); if (!ctx.live()) return;
                comparison.hidden = false; comparison.textContent = 'Aktuálně na serveru — ' + (latest.document?.title || titles[kind]) + '\n\n' + (latest.version?.body || '(Dokument zatím neexistuje.)');
                // Show the current content first; accepting its revision is a separate action.
                accept.hidden = false; ctx.latest = latest;
            });
        }
        const accept = button('Použít aktuální revizi pro můj text', () => {
            if (!ctx.latest || !confirm('Ponechat rozepsaný text a použít načtenou revizi pro další uložení?')) return;
            state = ctx.latest; showMeta(); accept.hidden = true; compare.hidden = true;
            ctx.status.textContent = 'Zkontrolujte porovnání a uložte svou novou verzi.';
        }); accept.hidden = true; ctx.dialog.insertBefore(accept, history);
        form.addEventListener('submit', e => {
            e.preventDefault(); if (!state) return;
            busy(ctx, async () => {
                try {
                    const result = await api(null,{ ...fields('document_save'), title: title.value, body: body.value });
                    assign(result); historyList.replaceChildren(); older.hidden = preview.hidden = restore.hidden = accept.hidden = true; ctx.status.textContent = 'Nová verze uložena.';
                } catch (err) { compare.hidden = err.status !== 409; throw err; }
            });
        });
        async function loadHistory(before) {
            await busy(ctx, async () => {
                const result = await api({ ...query, action: 'history', ...(before ? { before } : {}) });
                if (!before) historyList.replaceChildren();
                result.versions.forEach(v => historyList.append(button('Verze ' + v.revision + ' · ' + author(v.author,v.author_active) + ' · ' + date(v.created_at), () => busy(ctx, async () => {
                    const old = await api({ ...query, revision: v.revision }); viewed = Number(v.revision);
                    preview.hidden = false; preview.textContent = 'Verze ' + viewed + '\n\n' + old.version.body; restore.hidden = !state.can_edit;
                }))));
                ctx.before = result.next_before; older.hidden = !ctx.before;
            });
        }
        async function restoreVersion() {
            if (!viewed || !confirm('Obnovit verzi ' + viewed + ' jako novou verzi dokumentu?' + (ctx.dirty ? ' Rozepsané změny ve formuláři se nahradí.' : ''))) return;
            await busy(ctx, async () => {
                try { assign(await api(null,{ ...fields('document_restore'), source_revision: viewed })); historyList.replaceChildren(); older.hidden = preview.hidden = restore.hidden = accept.hidden = true; ctx.status.textContent = 'Obnoveno jako nová verze.'; }
                catch (err) { compare.hidden = err.status !== 409; throw err; }
            });
        }
        await busy(ctx, async () => { assign(await api(query)); });
    }
    async function openDiscussion(scope) {
        const isIdeas = scope.scope === 'ideas';
        if (isIdeas && ideas) { window.Vz2Layout.showIdeas(); return; }
        const ctx = isIdeas ? startIdeas() : start('Diskuse'); if (!ctx) return;
        const form = make('form'), label = make('label', 'Nový příspěvek'), body = make('textarea'); body.rows = 5; body.name = 'post_body'; body.required = true; label.append(body);
        const save = make('button', 'Odeslat'), cancel = button('Zrušit úpravu', () => reset()), compare = button('Načíst aktuální příspěvek', compareLatest), comparison = make('pre', '', 'content-preview');
        const accept = button('Použít aktuální revizi pro můj text', () => {
            if (ctx.latest && confirm('Ponechat rozepsaný text a použít načtenou revizi pro další uložení?')) { editing = ctx.latest; accept.hidden = compare.hidden = true; ctx.status.textContent = 'Zkontrolujte porovnání a uložte svou úpravu.'; }
        });
        const actions = make('div', undefined, 'toolbar'); actions.append(save,cancel,compare);
        cancel.hidden = compare.hidden = comparison.hidden = accept.hidden = true; form.append(label,actions,comparison,accept);
        const list = make('div', undefined, 'content-posts'), reload = iconButton('Obnovit příspěvky', 'refresh', () => load()), older = button('Starší příspěvky', () => load(ctx.before)); older.hidden = true;
        ctx.dialog.append(form,reload,list,older);
        let thread, editing = null;
        body.addEventListener('input', () => ctx.dirty = true);
        function reset(force = false) {
            if (!force && ctx.dirty && !confirm('Zahodit rozepsaný příspěvek?')) return false;
            editing = null; body.value = ''; ctx.dirty = false; save.textContent = 'Odeslat'; label.firstChild.textContent = 'Nový příspěvek';
            cancel.hidden = compare.hidden = comparison.hidden = accept.hidden = true; return true;
        }
        async function compareLatest() {
            if (!editing) return;
            await busy(ctx, async () => {
                const result = await api({ action: 'discussion', thread_id: thread.id, post_id: editing.id });
                ctx.latest = result.posts[0]; comparison.textContent = 'Aktuální příspěvek:\n\n' + ctx.latest.body; comparison.hidden = accept.hidden = false;
            });
        }
        async function load(before) {
            await busy(ctx, async () => {
                const result = await api({ action: 'discussion', ...(thread ? { thread_id: thread.id } : scope), ...(before ? { before } : {}) });
                thread = result.thread; (ctx.title || ctx.dialog.querySelector('h2')).textContent = thread.global_key === 'ideas' ? 'Nápady' : 'Diskuse — ' + thread.title;
                if (ctx.status.textContent === 'Načítám…') ctx.status.textContent = '';
                form.hidden = !result.can_create;
                if (!before) list.replaceChildren();
                if (!before && !result.posts.length) list.append(make('p','Zatím žádné příspěvky.'));
                result.posts.forEach(p => {
                    const item = make('article'); item.dataset.postId = p.id;
                    item.append(make('small', author(p.author,p.author_active) + ' · ' + date(p.created_at) + (p.revision>1 ? ' · upravil/a ' + author(p.editor,p.editor_active) + ' · ' + date(p.updated_at) : '')), make('p',p.body));
                    const controls = make('div',undefined,'toolbar');
                    if (p.can_edit) controls.append(button('Upravit', () => {
                        if (!reset()) return; editing = p; body.value = p.body; save.textContent = 'Uložit úpravu'; label.firstChild.textContent = 'Upravit příspěvek'; cancel.hidden = false; body.focus();
                    }));
                    if (p.can_delete) controls.append(button('Smazat', async () => {
                        if (!confirm('Smazat tento příspěvek?')) return;
                        let deleted = false;
                        await busy(ctx, async () => { await api(null,{action:'post_delete',thread_id:thread.id,post_id:p.id,revision:p.revision}); deleted = true; });
                        if (deleted) { if (editing?.id === p.id) reset(true); await load(); }
                    }));
                    item.append(controls); list.append(item);
                }); ctx.before = result.next_before; older.hidden = !ctx.before;
            });
        }
        form.addEventListener('submit', async e => {
            e.preventDefault(); if (!thread) return;
            let saved = false;
            await busy(ctx, async () => {
                try { await api(null,{action:editing?'post_update':'post_create',thread_id:thread.id,body:body.value,...(editing?{post_id:editing.id,revision:editing.revision}:{})}); reset(true); saved = true; ctx.status.textContent = 'Příspěvek uložen.'; }
                catch (err) { compare.hidden = err.status !== 409; throw err; }
            });
            if (saved) await load();
        });
        await load();
    }
    // Read-only panel views share the existing API and modal editors. Editing,
    // conflict handling and history continue to use the code above unchanged.
    let previewCollection, previewSerial = 0;
    function mountPreviews(collection) {
        previewCollection = collection;
        const serial = ++previewSerial;
        const live = () => serial === previewSerial;
        const hosts = ['lyrics', 'tablature', 'discussion'].map(id => document.getElementById(id + '-content'));
        const actionHosts = ['lyrics', 'tablature', 'discussion'].map(id => document.getElementById(id + '-actions'));
        actionHosts.forEach(host => host.replaceChildren());
        hosts.forEach(host => host.replaceChildren(make('p', collection ? 'Načítám…' : 'Vyberte skladbu nebo zkoušku.', 'muted')));
        if (!collection) return;
        [['lyrics_chords', hosts[0]], ['tablature', hosts[1]]].forEach(async ([kind, host]) => {
            const edit = button('Otevřít editor', () => openDocument(collection, kind));
            const content = make('pre', '', 'document-preview'), status = make('p', 'Načítám…', 'muted');
            actionHosts[kind === 'lyrics_chords' ? 0 : 1].replaceChildren(edit);
            host.replaceChildren(status, content);
            async function load() {
                try {
                    const result = await api({ action: 'document', collection_id: collection.id, kind });
                    if (!live()) return;
                    edit.textContent = result.can_edit ? 'Upravit / historie' : 'Otevřít / historie';
                    status.textContent = result.document ? result.document.title + ' · verze ' + result.document.current_revision : 'Zatím bez dokumentu.';
                    content.textContent = result.version?.body || '';
                } catch (e) { if (live()) { status.textContent = e.message; status.append(button('Zkusit znovu', load)); } }
            }
            await load();
        });
        const host = hosts[2], status = make('p', 'Načítám…', 'muted'), posts = make('div', '', 'content-posts');
        let before, loading = false;
        const older = button('Starší příspěvky', () => loadDiscussion(before)); older.hidden = true;
        actionHosts[2].replaceChildren(button('Otevřít diskusi', () => openDiscussion({ collection_id: collection.id })));
        host.replaceChildren(status, posts, older);
        async function loadDiscussion(cursor) {
            if (loading) return;
            loading = true; older.disabled = true;
            try {
                const result = await api({ action: 'discussion', collection_id: collection.id, ...(cursor ? { before: cursor } : {}) });
                if (!live()) return;
                status.textContent = !cursor && !result.posts.length ? 'Zatím žádné příspěvky.' : '';
                result.posts.forEach(p => {
                    const item = make('article');
                    item.append(make('small', author(p.author, p.author_active) + ' · ' + date(p.created_at)), make('p', p.body));
                    posts.append(item);
                });
                before = result.next_before; older.hidden = !before;
            } catch (e) { if (live()) { status.textContent = e.message; status.append(button('Zkusit znovu', () => loadDiscussion(cursor))); } }
            finally { loading = false; older.disabled = false; }
        }
        loadDiscussion();
    }
    window.Vz2Content = { openDocument, openDiscussion, mountPreviews };
}());
