(function (root) {
    'use strict';
    const Model = root.Vz2TimestampModel, Store = root.Vz2TimestampStore;
    const el = tag => document.createElement(tag);
    const request = id => Store.load(id);
    const format = ms => Model.format(ms);
    const parse = text => Model.parse(text);
    let intervalDialog;
    function openIntervalEditor(panel, kind, item = null, finish = false, draft = {}) {
        if (intervalDialog?.open) return;
        const dialog = el('dialog'); intervalDialog = dialog; dialog.className = 'vz2-interval-editor';
        const isTake = kind === 'take';
        dialog.innerHTML = `<form autocomplete="off">
            <div class="dialog-header"><h2></h2><button type="button" class="modal-close" aria-label="Zavřít úsek">×</button></div>
            <p class="interval-context"></p>
            <label class="interval-existing">Rozpracovaný úsek<select name="existing"><option value="">Nový úsek</option></select></label>
            <div class="interval-times">
                <label>Začátek<input name="start" required inputmode="decimal"><span><button type="button" data-edge="start" data-delta="-1000">−1 s</button><button type="button" data-edge="start" data-delta="1000">+1 s</button><button type="button" data-capture="start">Zachytit začátek</button></span></label>
                <label>Konec<input name="end" inputmode="decimal" placeholder="Doplnit později"><span><button type="button" data-edge="end" data-delta="-1000">−1 s</button><button type="button" data-edge="end" data-delta="1000">+1 s</button><button type="button" data-capture="end">Zachytit konec</button></span></label>
            </div>
            <p class="muted">Bez konce zůstane úsek rozpracovaný.</p>
            <div class="interval-song"><label>Hledat skladbu<input name="song_search" type="search"></label><label>Skladba<select name="song"><option value="">Zatím nepřiřazeno</option></select></label></div>
            <div class="interval-passage"><label>Typ pasáže<select name="passage_type"></select></label><label>Pokus<select name="parent"><option value="">Samostatná pasáž</option></select></label></div>
            <label>Název / popis<input name="label" maxlength="4000"></label>
            <label>Poznámka<textarea name="note_text" maxlength="4000" rows="2"></textarea></label>
            <p class="error" role="alert"></p><pre class="interval-current" hidden></pre>
            <button type="button" class="interval-reload" hidden>Načíst aktuální verzi k porovnání</button>
            <label class="interval-return"><input type="checkbox" name="return_position"> Vrátit na začátek</label>
            <div class="toolbar"><button type="button" class="interval-cancel">Zrušit</button><button type="submit">Uložit úsek</button></div>
        </form>`;
        const form = dialog.querySelector('form'), f = form.elements, error = dialog.querySelector('.error');
        let selected = item, revision = panel.list.timestamps_revision, busy = false, exact = {};
        const currentTime = () => Math.round(panel.adapter?.currentTimeMs() ?? 0);
        const setTime = (edge, ms) => { f[edge].value = ms === null ? '' : format(ms); exact[edge] = { text: f[edge].value, ms }; };
        const getTime = edge => f[edge].value === '' && edge === 'end' ? null : f[edge].value === exact[edge]?.text ? exact[edge].ms : parse(f[edge].value);
        const fillSongs = () => {
            const choice = f.song.value, search = f.song_search.value.toLocaleLowerCase('cs');
            f.song.replaceChildren(new Option('Zatím nepřiřazeno', ''));
            (panel.list.songs || []).filter(s => s.lifecycle !== 'archived' || String(s.id) === choice || Number(s.id) === selected?.song_id).forEach(s => {
                if (!search || s.title.toLocaleLowerCase('cs').includes(search) || String(s.id) === choice) f.song.add(new Option(s.title, String(s.id)));
            });
            f.song.value = choice;
        };
        const fillParents = () => {
            const choice = f.parent.value; f.parent.replaceChildren(new Option('Samostatná pasáž', ''));
            Model.items(panel.list).filter(i => i.kind === 'take').forEach(i => f.parent.add(new Option(format(i.start_ms) + ' · ' + (i.song_title || i.label) + (i.end_ms === null ? ' · chybí konec' : ''), String(i.timestamp_id))));
            f.parent.value = choice;
        };
        Object.entries(Model.passageTypes).forEach(([value, label]) => f.passage_type.add(new Option(label, value)));
        dialog.querySelector('.interval-song').hidden = !isTake;
        dialog.querySelector('.interval-passage').hidden = isTake;
        dialog.querySelector('.interval-context').textContent = panel.list.source_filename || panel.list.title;
        Model.items(panel.list).filter(i => i.kind === kind && i.status === 'open' && i.can_edit).forEach(i => f.existing.add(new Option(format(i.start_ms) + ' · ' + (i.song_title || i.label), String(i.timestamp_id))));
        dialog.querySelector('.interval-existing').hidden = !!item || f.existing.options.length === 1;
        function populate(value) {
            selected = value;
            dialog.querySelector('h2').textContent = (value ? 'Upravit ' : 'Nový úsek: ') + (isTake ? 'pokus' : 'pasáž');
            setTime('start', value?.start_ms ?? draft.time_ms ?? currentTime());
            const capturedEnd = finish && value && panel.adapter?.canPlay() && currentTime() > value.start_ms ? currentTime() : null;
            setTime('end', value?.end_ms ?? capturedEnd ?? draft.end_time_ms ?? null);
            f.label.value = value?.source.body?.replace(/^[↑↓]$/, '') || draft.body || '';
            f.note_text.value = value?.note_text || '';
            f.passage_type.value = value?.passage_type || 'custom';
            fillSongs(); f.song.value = String(value ? value.song_id ?? '' : panel.list.default_song_id ?? '');
            fillParents();
            const parents = Model.containingTakes(panel.list, getTime('start'), getTime('end'));
            f.parent.value = String(value ? value.source.parent_timestamp_id ?? '' : parents.length === 1 ? parents[0].timestamp_id : '');
        }
        populate(item);
        f.existing.onchange = () => populate(Model.items(panel.list).find(i => String(i.timestamp_id) === f.existing.value) || null);
        f.song_search.oninput = fillSongs;
        let suggestedLabel = '';
        const suggestLabel = () => {
            if (selected || (f.label.value && f.label.value !== suggestedLabel)) return;
            const type = f.passage_type.value, parent = f.parent.value;
            const count = Model.items(panel.list).filter(i => i.kind === 'passage' && i.passage_type === type && String(i.source.parent_timestamp_id ?? '') === parent).length;
            suggestedLabel = type === 'custom' ? '' : Model.passageTypes[type] + (count ? ' ' + (count + 1) : '');
            f.label.value = suggestedLabel;
        };
        f.passage_type.onchange = suggestLabel; f.parent.onchange = suggestLabel;
        dialog.querySelectorAll('[data-capture]').forEach(b => { b.disabled = !panel.adapter?.canPlay(); b.onclick = () => setTime(b.dataset.capture, currentTime()); });
        dialog.querySelectorAll('[data-edge]').forEach(b => { b.onclick = () => { try { const at = getTime(b.dataset.edge); if (at === null) throw new Error('Nejprve zadejte čas konce.'); setTime(b.dataset.edge, Math.max(0, at + Number(b.dataset.delta))); } catch(e) { error.textContent = e.message; } }; });
        f.return_position.disabled = !panel.adapter?.canPlay();
        const close = () => { if (!busy) dialog.close(); };
        dialog.querySelector('.modal-close').onclick = close; dialog.querySelector('.interval-cancel').onclick = close;
        dialog.addEventListener('cancel', e => { if (busy) e.preventDefault(); });
        dialog.addEventListener('close', () => { dialog.remove(); intervalDialog = null; });
        dialog.querySelector('.interval-reload').onclick = async () => {
            try {
                const latest = await request(panel.id); panel.list = latest;
                const now = selected ? Model.items(latest).find(i => i.id === selected.id) : null;
                const compare = dialog.querySelector('.interval-current'); compare.hidden = false;
                compare.textContent = now ? JSON.stringify({ název: now.label, začátek_ms: now.start_ms, konec_ms: now.end_ms, skladba: now.song_title, typ: now.passage_type, pokus: now.parent_id, poznámka: now.note_text }, null, 2) : selected ? 'Úsek byl odstraněn.' : 'Aktuální seznam načten. Rozepsané údaje zůstávají.';
                if (selected && !now) return;
                if (!confirm('Použít načtenou revizi pro uložení rozepsaných údajů?')) return;
                selected = now; revision = latest.timestamps_revision; fillParents(); fillSongs();
                error.textContent = 'Zkontrolujte rozepsané údaje a znovu uložte.';
                dialog.querySelector('.interval-reload').hidden = true;
            } catch(e) { error.textContent = e.message; }
        };
        form.onsubmit = async event => {
            event.preventDefault(); if (busy) return;
            try {
                const start = getTime('start'), end = getTime('end');
                if (end !== null && end <= start) throw new Error('Konec musí být po začátku.');
                const fields = { action: 'save_interval', timestamps_revision: revision, kind: isTake ? 'song_start' : 'passage', time_ms: start, end_time_ms: end,
                    body: f.label.value, note_text: f.note_text.value, song_collection_id: isTake && f.song.value ? Number(f.song.value) : null,
                    passage_type: isTake ? null : f.passage_type.value, parent_timestamp_id: !isTake && f.parent.value ? Number(f.parent.value) : null };
                if (selected) { fields.id = selected.timestamp_id; fields.revision = selected.source.revision; }
                busy = true; form.querySelector('[type=submit]').disabled = true;
                await Store.saveInterval(panel.id, fields);
                if (f.return_position.checked && panel.adapter?.canPlay()) panel.adapter.seek(start);
                busy = false; dialog.close();
            } catch(e) { error.textContent = e.message; dialog.querySelector('.interval-reload').hidden = e.status !== 409; }
            finally { busy = false; form.querySelector('[type=submit]').disabled = false; }
        };
        document.body.append(dialog); dialog.showModal(); (finish ? f.end : f.label).focus();
    }

    root.Vz2TimestampEditor = {
        isOpen: () => !!intervalDialog?.open || !!root.Vz2NoteEditor?.isOpen(),
        async open({ recording_id, kind, item_id = null, adapter = null, finish = false, draft = {}, list = null }) {
            list = list || await Store.load(recording_id);
            const item = item_id ? Model.items(list).find(i => i.id === item_id) : null;
            if (item_id && !item) throw Error('Úsek již neexistuje.');
            if (item ? !item.can_edit : !list.can_create) throw Error('K úpravě nemáte oprávnění.');
            if ((item?.kind || kind) === 'note') return root.Vz2NoteEditor.open({ recording_id, item_id, adapter, draft, list });
            if (!['take', 'passage'].includes(item?.kind || kind)) throw Error('Vyberte pokus nebo pasáž.');
            openIntervalEditor({ id: recording_id, list, adapter }, item?.kind || kind, item, finish, draft);
        }
    };
    window.addEventListener('beforeunload', e => { if (intervalDialog?.open) { e.preventDefault(); e.returnValue = ''; } });
})(window);
