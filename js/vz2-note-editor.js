(function (root) {
    'use strict';
    const Model = root.Vz2TimestampModel, Store = root.Vz2TimestampStore;
    const format = Model.format, parse = Model.parse;
    const kinds = { song_start: 'Pokus', song_end: 'Nespárovaný konec', passage: 'Pasáž', note: 'Poznámka' };
    const el = (tag, text) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; return n; };
    const request = (id, fields) => fields ? fields.kind === 'note' ? Store.saveNote(id, fields) : Store.save(id, fields) : Store.load(id);
    const publish = value => Store.accept(value);
    const timestampBody = (kind, body) => {
        const value = body.trim();
        if (value) return value;
        if (kind === 'song_start') return '↑';
        if (kind === 'song_end') return '↓';
        throw Error('U poznámky vyplňte text.');
    };
    const openIntervalEditor = (context, kind, item, finish, draft) => root.Vz2TimestampEditor.open({
        recording_id: context.id, kind, item_id: item?.id, adapter: context.adapter, finish, draft, list: context.list
    }).catch(e => context.error(e.message));
    let editor, pairDialog, activeEditor, activePair;
    const addViewKey = 'vz2-timestamp-add-view';
    function rememberedAddView() {
        try { return localStorage.getItem(addViewKey) === 'advanced' ? 'advanced' : 'simple'; }
        catch (_) { return 'simple'; }
    }
    function rememberAddView(view) {
        try { localStorage.setItem(addViewKey, view); } catch (_) { /* Storage may be unavailable. */ }
    }
    async function saveEditor(context, fields) {
        if (context.busy || context.panel.quickBusy) return;
        const form = editor.querySelector('form');
        context.busy = true;
        const controls = [...form.querySelectorAll('button')]; controls.forEach(b => b.disabled = true);
        try {
            if (context.row) { fields.id = context.row.id; fields.revision = context.row.revision; }
            const result = await request(context.panel.id, fields); publish(result);
            context.revision = result.timestamps_revision;
            if (context.view === 'advanced' && form.elements.return_position.checked && context.panel.adapter?.canPlay()) context.panel.adapter.seek(fields.time_ms);
            editor.querySelector('.error').textContent = '';
            if ((editor.classList.contains('ts-inline') || editor.classList.contains('ts-docked')) && !context.row) {
                form.elements.body.value = '';
                setEditorTime(context.panel.adapter?.currentTimeMs() ?? fields.time_ms);
            } else editor.close();
        } catch (err) { editor.querySelector('.error').textContent = err.message; editor.querySelector('.ts-rebase').hidden = err.status !== 409; }
        finally {
            context.busy = false; controls.forEach(b => b.disabled = false);
            setEditorView(context.view);
            form.elements.return_position.disabled = !context.panel.adapter?.canPlay();
        }
    }
    // Keep the exact position separately from the editable mm:ss display.
    function setEditorTime(ms) {
        activeEditor.timeMs = Math.max(0, Math.round(Number(ms) || 0));
        activeEditor.timeText = format(activeEditor.timeMs);
        editor.querySelector('form').elements.time.value = activeEditor.timeText;
        editor.querySelector('.ts-simple-time-value').textContent = activeEditor.timeText;
    }
    function editorTimeMs() {
        const text = editor.querySelector('form').elements.time.value;
        return text === activeEditor.timeText ? activeEditor.timeMs : parse(text);
    }
    function closeInlinePair() {
        editor.querySelector('.ts-pair-inline').hidden = true;
        editor.querySelector('.ts-editor-body').hidden = false;
        editor.querySelector('.ts-editor-footer').hidden = false;
    }
    function openPairDialog(context, fields) {
        const inline = editor.classList.contains('ts-docked');
        if (!inline && !pairDialog) {
            pairDialog = el('dialog'); pairDialog.className = 'vz2-timestamp-pair';
            pairDialog.innerHTML = '<form><h2>Propojit konec se začátkem</h2><label>Začátek skladby<select name="paired_timestamp_id"><option value="">Bez propojení</option></select></label><div class="toolbar"><button type="button" class="ts-pair-back">Zpět</button><button type="submit">Uložit konec</button></div></form>';
            pairDialog.querySelector('.ts-pair-back').onclick = () => { pairDialog.close(); if (!editor.classList.contains('ts-inline')) editor.querySelector('[name=body]').focus(); };
            pairDialog.querySelector('form').addEventListener('submit', e => {
                e.preventDefault();
                const choice = pairDialog.querySelector('select').value;
                const draft = activePair;
                pairDialog.close();
                saveEditor(draft.context, { ...draft.fields, paired_timestamp_id: choice ? Number(choice) : null });
            });
            document.body.append(pairDialog);
        }
        activePair = { context, fields };
        const select = inline ? editor.querySelector('.ts-pair-inline select') : pairDialog.querySelector('select');
        select.replaceChildren(new Option('Bez propojení', ''));
        const used = new Set(context.panel.list.entries.filter(t => t.kind === 'song_end' && t.id !== context.row?.id && t.paired_timestamp_id).map(t => Number(t.paired_timestamp_id)));
        const starts = context.panel.list.entries.filter(t => t.kind === 'song_start' && Number(t.time_ms) < fields.time_ms && !used.has(Number(t.id)));
        starts.forEach(t => select.add(new Option(format(t.time_ms) + ' · ' + t.body, String(t.id))));
        select.value = context.row?.paired_timestamp_id ? String(context.row.paired_timestamp_id) : starts.length === 1 ? String(starts[0].id) : '';
        if (inline) {
            editor.querySelector('.ts-editor-body').hidden = true;
            editor.querySelector('.ts-editor-footer').hidden = true;
            editor.querySelector('.ts-pair-inline').hidden = false;
        } else pairDialog.showModal();
        select.focus();
    }
    function ensureEditor() {
        if (editor) return;
        editor = el('dialog'); editor.className = 'vz2-timestamp-editor';
        editor.innerHTML = `<form autocomplete="off">
            <div class="ts-editor-top"><p class="ts-mode"></p><p class="ts-context"></p><button type="button" class="ts-back-simple" aria-label="Zpět k jednoduchému zobrazení" title="Zpět k jednoduchému zobrazení" hidden>←</button><button type="button" class="ts-close modal-close" aria-label="Zavřít časovou značku" title="Zavřít">×</button></div>
            <div class="ts-editor-body">
                <p class="ts-simple-time" hidden>Čas značky <strong class="ts-simple-time-value"></strong></p>
                <label class="ts-body"><span class="visually-hidden">Text</span><input type="text" name="body" aria-label="Text časové značky" placeholder="Poznámka" autocomplete="off" autocapitalize="sentences" spellcheck="true"></label>
                <div class="ts-time-row"><input type="text" name="time" required inputmode="numeric" aria-label="Čas ve formátu minuty a sekundy" autocomplete="off" spellcheck="false"><button type="button" class="ts-time-adjust" data-delta="-1000" aria-label="Odečíst jednu sekundu">−</button><button type="button" class="ts-time-adjust" data-delta="1000" aria-label="Přičíst jednu sekundu">+</button><button type="button" class="ts-time-current" title="Převzít čas z přehrávače">Zachytit čas</button></div>
                <div class="ts-editor-options"><label class="ts-return"><input type="checkbox" name="return_position"> Vrátit na čas</label><div class="ts-quick-notes"><button type="button" class="ts-quick-note" data-symbol="👍" aria-label="Přidat poznámku: palec nahoru" title="Přidat poznámku: palec nahoru">👍</button><button type="button" class="ts-quick-note" data-symbol="👎" aria-label="Přidat poznámku: palec dolů" title="Přidat poznámku: palec dolů">👎</button></div></div>
                <p role="alert" class="error"></p><pre class="ts-current" hidden></pre>
            </div>
            <div class="ts-editor-footer">
                <div class="ts-simple-actions" hidden><button type="button" class="ts-open-advanced">Otevřít pokročilé možnosti</button><button type="submit" name="kind" value="note" class="ts-save-note">Uložit poznámku</button></div>
                <div class="ts-advanced-actions"><button type="button" name="kind" value="song_start" class="ts-new-take">Pokus</button><button type="submit" name="kind" value="song_end">Konec</button><button type="button" name="kind" value="passage" class="ts-new-passage">Pasáž</button><button type="submit" name="kind" value="note">Poznámka</button></div>
                <button type="button" class="ts-rebase" hidden>Načíst aktuální verzi k porovnání</button>
            </div>
            <div class="ts-pair-inline" hidden><h2>Propojit konec se začátkem</h2><label>Začátek skladby<select name="paired_timestamp_id"><option value="">Bez propojení</option></select></label><div class="toolbar"><button type="button" class="ts-pair-back">Zpět</button><button type="button" class="ts-pair-save">Uložit konec</button></div></div>
        </form>`;
        const form = editor.querySelector('form');
        form.elements.time.addEventListener('change', () => {
            try { setEditorTime(editorTimeMs()); }
            catch (e) { editor.querySelector('.error').textContent = e.message; }
        });
        editor.addEventListener('cancel', e => { if (activeEditor?.busy) e.preventDefault(); });
        editor.addEventListener('keydown', e => {
            if (e.key === 'Escape' && editor.querySelector('.ts-pair-inline:not([hidden])')) {
                e.preventDefault(); closeInlinePair(); editor.querySelector('[name=body]').focus();
            } else if (e.key === 'Escape' && (editor.classList.contains('ts-inline') || editor.classList.contains('ts-docked')) && !activeEditor?.busy && !activeEditor?.panel.quickBusy && !pairDialog?.open) {
                e.preventDefault(); editor.close();
            }
        });
        editor.addEventListener('close', () => {
            if (editor.open) return;
            document.getElementById('player-shell')?.classList.remove('ts-creating');
            clearDockedLayout();
            closeInlinePair();
            editor.classList.remove('ts-keyboard-open');
            editor.style.removeProperty('--ts-inline-max-height'); editor.style.removeProperty('--ts-inline-bottom');
            if (!editor.open && activeEditor?.restoreDrawer && !activeEditor.panel.dead) activeEditor.panel.openDrawer?.();
        });
        editor.addEventListener('focusin', positionInlineEditor);
        window.visualViewport?.addEventListener('resize', positionInlineEditor);
        window.visualViewport?.addEventListener('scroll', positionInlineEditor);
        matchMedia('(max-width: 767px)').addEventListener('change', syncEditorPlacement);
        editor.querySelectorAll('.ts-close').forEach(close => { close.onclick = () => editor.close(); });
        editor.querySelector('.ts-pair-inline .ts-pair-back').onclick = () => { closeInlinePair(); editor.querySelector('[name=body]').focus(); };
        editor.querySelector('.ts-pair-save').onclick = () => {
            const choice = editor.querySelector('.ts-pair-inline select').value;
            const draft = activePair;
            closeInlinePair();
            saveEditor(draft.context, { ...draft.fields, paired_timestamp_id: choice ? Number(choice) : null });
        };
        editor.querySelector('.ts-pair-inline select').addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); editor.querySelector('.ts-pair-save').click(); }
        });
        editor.querySelector('.ts-open-advanced').onclick = () => setEditorView('advanced', true);
        editor.querySelector('.ts-back-simple').onclick = () => {
            try { setEditorTime(editorTimeMs()); setEditorView('simple', true); }
            catch (e) { editor.querySelector('.error').textContent = e.message; }
        };
        editor.querySelector('.ts-time-current').onclick = () => {
            const ms = activeEditor?.panel.adapter?.currentTimeMs();
            if (Number.isFinite(ms)) setEditorTime(ms);
        };
        editor.querySelectorAll('.ts-time-adjust').forEach(control => { control.onclick = () => {
            try { setEditorTime(editorTimeMs() + Number(control.dataset.delta)); }
            catch (e) { editor.querySelector('.error').textContent = e.message; }
        }; });
        editor.querySelectorAll('.ts-quick-note').forEach(control => {
            control.onclick = () => quickNote(activeEditor.panel, control.dataset.symbol, true);
        });
        editor.querySelector('.ts-rebase').onclick = async () => {
            const context = activeEditor;
            try {
                const latest = await request(context.panel.id); context.panel.list = latest;
                const current = context.row && latest.entries.find(t => t.id === context.row.id);
                const compare = editor.querySelector('.ts-current'); compare.hidden = false;
                compare.textContent = current ? 'Aktuální značka: ' + format(current.time_ms) + ' · ' + kinds[current.kind] + '\n' + current.body + '\nUpravil/a: ' + current.editor : context.row ? 'Značka byla mezitím odstraněna.' : 'Aktuální seznam byl načten. Rozepsaný text zůstává ve formuláři.';
                if (context.row && !current) return;
                if (!confirm('Aktuální značky jsou načtené. Použít jejich revizi pro další uložení vašeho rozepsaného textu?')) return;
                context.revision = latest.timestamps_revision; context.row = current || null;
                editor.querySelector('.error').textContent = 'Revize je aktuální. Zkontrolujte text a zvolte typ značky.';
                editor.querySelector('.ts-rebase').hidden = true;
            } catch (e) { editor.querySelector('.error').textContent = e.message; }
        };
        for (const [selector, kind] of [['.ts-new-take', 'take'], ['.ts-new-passage', 'passage']]) {
            editor.querySelector(selector).onclick = () => {
                try {
                    const draft = { time_ms: editorTimeMs(), body: form.elements.body.value }, panel = activeEditor.panel;
                    editor.close(); openIntervalEditor(panel, kind, null, false, draft);
                } catch(e) { editor.querySelector('.error').textContent = e.message; }
            };
        }
        form.addEventListener('submit', async e => {
            e.preventDefault(); const context = activeEditor;
            try {
                const ms = editorTimeMs();
                const fields = { action: context.row ? 'update' : 'create', timestamps_revision: context.revision,
                    kind: e.submitter?.value || context.row?.kind || 'note', time_ms: ms,
                    body: timestampBody(e.submitter?.value || context.row?.kind || 'note', form.elements.body.value) };
                if (fields.kind === 'song_end') openPairDialog(context, fields);
                else await saveEditor(context, fields);
            } catch (err) { editor.querySelector('.error').textContent = err.message; }
        });
        document.body.append(editor);
    }
    function setEditorView(view, remember = false) {
        const simple = view === 'simple' && !activeEditor.row;
        activeEditor.view = simple ? 'simple' : 'advanced';
        editor.querySelector('.ts-simple-time').hidden = !simple;
        editor.querySelector('.ts-time-row').hidden = simple;
        editor.querySelector('.ts-editor-options').hidden = simple;
        editor.querySelector('.ts-simple-actions').hidden = !simple;
        editor.querySelector('.ts-advanced-actions').hidden = simple;
        editor.querySelector('.ts-back-simple').hidden = simple || !!activeEditor.row;
        editor.querySelector('[name=kind][value=song_end]').hidden = activeEditor.row?.kind !== 'song_end';
        editor.querySelector('.ts-new-take').hidden = !!activeEditor.row;
        editor.querySelector('.ts-new-passage').hidden = !!activeEditor.row;
        editor.querySelectorAll('.ts-simple-actions button').forEach(control => { control.disabled = !simple; });
        editor.querySelectorAll('.ts-advanced-actions button').forEach(control => { control.disabled = simple || control.hidden; });
        if (remember) rememberAddView(activeEditor.view);
        const body = editor.querySelector('form').elements.body;
        body.placeholder = simple ? 'Poznámka' : 'Text';
        body.setAttribute('aria-label', simple ? 'Poznámka' : 'Text časové značky');
        if (editor.classList.contains('ts-docked')) editor.parentElement?.classList.toggle('ts-editor-advanced', !simple);
        positionInlineEditor();
    }
    function clearDockedLayout() {
        editor.parentElement?.classList.remove('ts-editor-open', 'ts-editor-advanced');
        document.getElementById('player-shell')?.classList.remove('ts-desktop-editing');
    }
    function dockEditor(panel) {
        if (panel.containerId === 'looper-timestamps' || panel.containerId === 'mixer-timestamps') {
            panel.shell.open = true;
            panel.container.append(editor);
            panel.container.classList.add('ts-editor-open');
            panel.container.classList.toggle('ts-editor-advanced', activeEditor.view === 'advanced');
            document.getElementById('player-shell')?.classList.add('ts-desktop-editing');
        } else panel.shell.before(editor);
    }
    function syncEditorPlacement() {
        if (!editor?.open || !activeEditor || activeEditor.panel.dead || !activeEditor.panel.shell) return;
        const mobile = matchMedia('(max-width: 767px)').matches;
        if (mobile && editor.classList.contains('ts-docked')) {
            const pairVisible = !editor.querySelector('.ts-pair-inline').hidden;
            const pairChoice = pairVisible ? editor.querySelector('.ts-pair-inline select').value : '';
            clearDockedLayout(); closeInlinePair();
            editor.classList.remove('ts-docked');
            document.body.append(editor);
            if (activeEditor.row) {
                editor.close(); editor.showModal(); editor.querySelector('[name=body]').focus();
            } else {
                editor.classList.add('ts-inline');
                editor.tabIndex = -1;
                document.getElementById('player-shell')?.classList.add('ts-creating');
                positionInlineEditor();
            }
            if (pairVisible) {
                openPairDialog(activePair.context, activePair.fields);
                pairDialog.querySelector('select').value = pairChoice;
            }
        } else if (!mobile && (editor.classList.contains('ts-inline') || editor.matches(':modal'))) {
            const pairVisible = !!pairDialog?.open;
            const pairChoice = pairVisible ? pairDialog.querySelector('select').value : '';
            if (pairVisible) pairDialog.close();
            if (editor.matches(':modal')) editor.close();
            document.getElementById('player-shell')?.classList.remove('ts-creating');
            editor.classList.remove('ts-inline', 'ts-keyboard-open');
            editor.style.removeProperty('--ts-inline-max-height'); editor.style.removeProperty('--ts-inline-bottom');
            editor.classList.add('ts-docked');
            editor.removeAttribute('autofocus');
            activeEditor.restoreDrawer = false;
            dockEditor(activeEditor.panel);
            if (!editor.open) editor.show();
            if (pairVisible) {
                openPairDialog(activePair.context, activePair.fields);
                editor.querySelector('.ts-pair-inline select').value = pairChoice;
            }
        }
    }
    function positionInlineEditor() {
        if (!editor?.open || !editor.classList.contains('ts-inline')) return;
        const panel = activeEditor.panel;
        const pinned = panel.pinnedOpen?.();
        const host = pinned ? panel.container : document.body;
        if (editor.parentElement !== host) {
            if (pinned) { host.prepend(editor); host.scrollTop = 0; }
            else host.append(editor);
        }
        const viewport = window.visualViewport;
        const visibleTop = viewport?.offsetTop || 0;
        const visibleBottom = visibleTop + (viewport?.height || innerHeight);
        const player = document.getElementById('player-shell');
        const mixerToggle = document.getElementById('mt-mixer-toggle');
        const fullscreenAnchor = player?.dataset.mode === 'mixer'
            ? (!mixerToggle?.hidden ? mixerToggle : document.querySelector('#mixer-panel .timeline'))
            : document.querySelector(pinned ? '#looper-panel .looper-timestamp-actions' : '#looper-panel .timeline');
        const playerBottom = player?.classList.contains('player-fullscreen')
            ? fullscreenAnchor?.getBoundingClientRect().bottom || 0
            : player?.getBoundingClientRect().bottom || 0;
        const covered = Math.max(0, innerHeight - visibleBottom);
        const typing = editor.contains(document.activeElement) && document.activeElement.matches('input[name=body],input[name=time]');
        editor.classList.toggle('ts-keyboard-open', covered > 120 || typing);
        editor.style.setProperty('--ts-inline-bottom', Math.max(8, covered + 8) + 'px');
        editor.style.setProperty('--ts-inline-max-height', Math.max(100, visibleBottom - Math.max(visibleTop + 8, playerBottom + 8) - 8) + 'px');
    }
    function openEditor(panel, row) {
        ensureEditor();
        const restoreDrawer = editor.open && activeEditor?.panel === panel && activeEditor.restoreDrawer;
        if (editor.open) {
            if (activeEditor?.busy || activeEditor?.panel.quickBusy || !confirm('Zahodit rozepsanou časovou značku?')) return false;
            document.getElementById('player-shell')?.classList.remove('ts-creating');
            clearDockedLayout(); closeInlinePair(); editor.close();
        }
        const mobile = matchMedia('(max-width: 767px)').matches;
        const inline = !row && mobile && panel.inlineHost;
        const docked = !mobile && !!panel.shell;
        if (inline && panel.containerId === 'mixer-timestamps') {
            const mixToggle = document.getElementById('mt-mixer-toggle');
            if (mixToggle?.getAttribute('aria-expanded') === 'true') mixToggle.click();
        }
        activeEditor = { panel, row, revision: panel.list.timestamps_revision,
            restoreDrawer: !!inline && (restoreDrawer || panel.drawerOpen?.()) };
        const f = editor.querySelector('form');
        setEditorTime(row ? row.time_ms : panel.adapter?.currentTimeMs() ?? 0);
        f.elements.body.value = row?.body || '';
        editor.classList.toggle('ts-inline', !!inline);
        editor.classList.toggle('ts-docked', docked);
        setEditorView(row ? 'advanced' : rememberedAddView());
        editor.classList.toggle('ts-edit-mode', !!row);
        editor.querySelector('.ts-mode').textContent = row ? 'Upravit značku' : 'Přidat značku';
        editor.querySelectorAll('.ts-advanced-actions button[name=kind]').forEach(control => {
            control.classList.toggle('ts-original-kind', !!row && control.value === row.kind);
        });
        editor.querySelector('.ts-quick-notes').hidden = !!row;
        const context = editor.querySelector('.ts-context');
        context.replaceChildren(el('span', panel.list.source_filename || panel.list.title));
        if (panel.list.title && panel.list.source_filename) {
            const caption = el('small', panel.list.title); caption.className = 'ts-context-caption'; context.append(caption);
        }
        editor.querySelector('.error').textContent = ''; editor.querySelector('.ts-current').hidden = true;
        editor.querySelector('.ts-rebase').hidden = true;
        editor.querySelector('.ts-time-current').hidden = !!row;
        editor.querySelector('.ts-time-current').disabled = !!row || !panel.adapter?.canPlay();
        f.elements.return_position.checked = false;
        f.elements.return_position.disabled = !panel.adapter?.canPlay();
        if (inline) {
            panel.closeDrawer?.();
            editor.tabIndex = -1;
            editor.setAttribute('autofocus', '');
            document.body.append(editor);
            document.getElementById('player-shell')?.classList.add('ts-creating');
            editor.show(); editor.focus({ preventScroll: true });
            positionInlineEditor();
        } else if (docked) {
            editor.removeAttribute('autofocus');
            dockEditor(panel);
            editor.show(); f.elements.body.focus();
        } else {
            editor.removeAttribute('autofocus');
            document.body.append(editor);
            editor.showModal(); f.elements.body.focus();
        }
        return true;
    }
    async function quickNote(panel, symbol, fromEditor = false) {
        if (panel.quickBusy || (activeEditor?.panel === panel && activeEditor.busy) || panel.dead || !panel.list?.can_create) return;
        panel.quickBusy = true;
        const controls = fromEditor ? [...editor.querySelectorAll('form button')] : panel.quickButtons;
        controls.forEach(control => control.disabled = true);
        try {
            const current = panel.adapter?.currentTimeMs();
            const time = Number.isFinite(current) ? Math.round(current) : 0;
            const result = await request(panel.id, { action: 'create', timestamps_revision: panel.list.timestamps_revision,
                kind: 'note', time_ms: time, body: symbol });
            publish(result);
            if (activeEditor?.panel === panel && editor?.open) activeEditor.revision = result.timestamps_revision;
            if (fromEditor) editor.querySelector('.error').textContent = '';
            panel.error('');
        } catch (err) {
            if (fromEditor) editor.querySelector('.error').textContent = err.message;
            else panel.error(err.message);
        }
        finally {
            panel.quickBusy = false;
            controls.forEach(control => control.disabled = fromEditor ? false : !panel.list?.can_create);
            if (fromEditor) {
                setEditorView(activeEditor.view);
                editor.querySelector('.ts-time-current').disabled = !panel.adapter?.canPlay();
                editor.querySelector('.ts-return input').disabled = !panel.adapter?.canPlay();
            }
        }
    }

    root.Vz2NoteEditor = {
        isOpen: () => !!editor?.open,
        openPanel: openEditor, quickNote,
        reposition(panel) { if (activeEditor?.panel === panel) positionInlineEditor(); },
        detach(panel) {
            if (activeEditor?.panel !== panel || !editor?.open) return;
            if (editor.classList.contains('ts-inline')) document.getElementById('player-shell')?.classList.remove('ts-creating');
            if (editor.classList.contains('ts-docked')) clearDockedLayout();
        },
        attach(panel) {
            if (!activeEditor?.panel?.dead || activeEditor.panel.id !== panel.id || !editor?.open) return;
            if (editor.classList.contains('ts-inline')) {
                activeEditor.panel = panel;
                document.getElementById('player-shell')?.classList.add('ts-creating');
                positionInlineEditor();
            } else if (editor.classList.contains('ts-docked')) {
                activeEditor.panel = panel;
                dockEditor(panel);
            }
        },
        async open(options) {
            return root.Vz2TimestampEditor.open({ ...options, kind: 'note' });
        }
    };
    Store.subscribe(value => { if (activeEditor && Number(activeEditor.panel.id) === Number(value.recording_id)) activeEditor.panel.list = value; });
    window.addEventListener('beforeunload', e => { if (editor?.open) { e.preventDefault(); e.returnValue = ''; } });
})(window);
