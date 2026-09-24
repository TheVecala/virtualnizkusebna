(function () {
    'use strict';
    const cfg = window.VZ2;
    let qs = new URLSearchParams(location.search);
    let data, selected, kind = 'song', edit, move, logBefore, mixerId = null;
    let navigationSerial = 0, catalogSerial = 0;
    const blobs = [];
    const offlineUrls = [];
    const timestampPanels = [];
    // UI state lives only in this document; a reload always starts collapsed.
    const expandedRecordings = new Set();
    let mixerNotes;
    let deepLinkSeeked = false;
    const store = window.idbKeyval.createStore('zkusebna-vz2-cache', 'audio');
    const $ = id => document.getElementById(id);
    const mixerPanel = $('mixer-panel');
    function node(tag, text, cls) {
        const n = document.createElement(tag);
        if (text !== undefined) n.textContent = text;
        if (cls) n.className = cls;
        return n;
    }
    function button(text, fn, cls) {
        const b = node('button', text, cls); b.type = 'button';
        b.addEventListener('click', async () => { b.disabled = true; try { await fn(); } catch (e) { message(e.message, true); } finally { b.disabled = false; } });
        return b;
    }
    function message(text, error = false) { $('message').textContent = text; $('message').className = error ? 'error' : ''; }
    function actionMenu(label) {
        const menu = node('details', undefined, 'actions-menu');
        const toggle = node('summary', '⋮'); toggle.setAttribute('aria-label', label); toggle.title = label;
        const actions = node('div', undefined, 'action-list'); menu.append(toggle, actions);
        return { menu, actions };
    }
    async function api(fields, action = 'catalog') {
        const response = await fetch('php/ajax/vz2.php' + (fields ? '' : '?action=' + action), {
            method: fields ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
            headers: fields ? { 'Content-Type': 'application/json', 'X-CSRF-Token': cfg.csrf } : {},
            body: fields ? JSON.stringify(fields) : undefined
        });
        let result;
        try { result = await response.json(); } catch (_) { throw new Error('Server nevrátil platnou odpověď. Obnovte přihlášení.'); }
        if (!response.ok || !result.ok) { const e = new Error(result.error || 'Požadavek selhal.'); e.status = response.status; throw e; }
        return result;
    }
    function key() { return Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''); }
    function time(ms) { const s = Math.floor(Number(ms) / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
    function stopMixer() {
        window.Vz2Timestamps.stopLoop();
        window.MultitrackApp?.destroy();
        mixerNotes?.destroy(); mixerNotes = null;
        mixerId = null; mixerPanel.hidden = true;
        window.Vz2Player.hideMixer();
    }
    function setRoute(params, replace = false) {
        const url = new URL('index.php', location.href);
        url.search = new URLSearchParams({ v: '2', ...params });
        if (url.href !== location.href) history[replace ? 'replaceState' : 'pushState'](null, '', url);
        qs = url.searchParams;
    }
    function canNavigate(params) {
        const target = data?.recordings.find(r => String(r.id) === String(params.recording_id));
        const nextMode = target?.kind === 'multitrack' ? 'mixer' : target?.kind === 'single' && params.view === 'looper' ? 'looper' : 'empty';
        return window.Vz2Player.canLeave(target?.id, nextMode);
    }
    async function navigate(params, force = false) {
        if (!force && !canNavigate(params)) return;
        window.Vz2Layout.hideIdeas(false);
        setRoute(params); deepLinkSeeked = false;
        message('');
        if (data) await applyRoute();
    }
    async function applyRoute() {
        const serial = ++navigationSerial;
        const target = data.recordings.find(r => String(r.id) === qs.get('recording_id'));
        kind = qs.get('kind') === 'rehearsal' ? 'rehearsal' : 'song';
        selected = target?.collection_id || qs.get('collection_id');
        let collection = data.collections.find(c => String(c.id) === String(selected));
        if (!collection) collection = data.collections.find(c => c.kind === kind);
        selected = collection?.id; kind = collection?.kind || kind;
        const nextMixer = target?.kind === 'multitrack' && target.lifecycle === 'active' ? String(target.id) : null;
        const nextLooper = target?.kind === 'single' && target.lifecycle === 'active' && target.files[0]?.url && qs.get('view') === 'looper' ? String(target.id) : null;
        if (mixerId !== nextMixer) { stopMixer(); deepLinkSeeked = false; }
        const player = window.Vz2Player.getState();
        if (player?.mode === 'looper' && player.id !== nextLooper) window.Vz2Player.closeLooper();
        mixerId = nextMixer;
        if (nextMixer) window.Vz2Player.showMixer(target);
        // Recording identity determines its parent, including after a server-side move.
        const params = { kind };
        if (selected) params.collection_id = String(selected);
        if (target) {
            params.recording_id = String(target.id);
            if (qs.has('time_ms')) params.time_ms = qs.get('time_ms');
            if (nextMixer) params.view = 'mixer';
            if (nextLooper) params.view = 'looper';
        }
        const missing = qs.has('recording_id') && !target;
        setRoute(params, true);
        render();
        if (target) window.Vz2Layout.revealRecording();
        seekMixerLink();
        if (missing) message('Odkazovaná nahrávka již neexistuje.', true);
        if (nextLooper) {
            await window.Vz2Player.openLooper(target, target.files[0], Number(qs.get('time_ms') || 0) / 1000, !deepLinkSeeked);
            if (serial !== navigationSerial) return;
            deepLinkSeeked = true;
        }
        if (nextMixer && String(window.MultitrackApp?.getState()?.id) !== nextMixer) {
            try {
                await window.MultitrackApp.refreshList();
                if (serial !== navigationSerial) return;
                if (!window.MultitrackApp.load(nextMixer)) throw new Error('Nahrávka není dostupná. Obnovte seznam.');
            } catch (e) { if (serial === navigationSerial) { window.Vz2Player.mixerFailed(); message(e.message, true); } }
        }
    }
    async function refresh() {
        const serial = ++catalogSerial, latest = await api();
        if (serial !== catalogSerial) return;
        data = latest;
        const playing = window.MultitrackApp?.getState();
        const playingRecording = playing && data.recordings.find(r => String(r.id) === String(playing.id));
        if (playing && (!playingRecording || playingRecording.lifecycle !== 'active' || (playing.phase !== 'archived' && !playingRecording.files.some(f => f.state === 'available')))) stopMixer();
        await applyRoute();
    }
    async function mutate(fields) { await api(fields); message('Uloženo.'); await refresh(); }
    function reorderControls(parent, list, item, params) {
        if (!cfg.write || !cfg.canReorder) return;
        const index = list.indexOf(item);
        [-1, 1].forEach(delta => {
            const b = button(delta < 0 ? '↑' : '↓', async () => {
                const ids = list.map(x => Number(x.id));
                [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
                await mutate({ action: 'reorder', ids, ...params });
            });
            b.setAttribute('aria-label', delta < 0 ? 'Posunout výše' : 'Posunout níže');
            b.disabled = index + delta < 0 || index + delta >= list.length;
            parent.append(b);
        });
    }
    function openEdit(item, type, parent = null) {
        edit = { item, type, parent };
        const f = $('edit-form'); f.elements.title.value = item.title; f.elements.summary.value = item.summary || '';
        $('summary-label').hidden = type === 'collection' || type === 'track';
        f.querySelector('.edit-error').textContent = ''; $('edit-reload').hidden = true;
        $('editor').showModal();
    }
    async function remove(item, type, full = false) {
        const text = full ? 'Úplně odstranit položku a všechny její informace?' : 'Odstranit soubory a zachovat informace?';
        const confirmation = prompt(text + '\nPro potvrzení napište název:\n' + item.title);
        if (confirmation === null) return;
        await api({ action: full ? 'delete_' + type : type === 'recording' ? 'remove_audio' : 'remove_attachment',
            id: Number(item.id), revision: Number(item.revision), confirm: confirmation, request_key: key() });
        window.MultitrackApp?.destroy();
        await refresh();
        await window.MultitrackApp?.refreshList();
        message(full ? 'Položka byla odstraněna. Deník zůstává.' : 'Soubory byly odstraněny, informace zůstávají.');
    }
    function moveControl(parent, item, type) {
        if (!cfg.write || !item.can_move) return;
        parent.append(button('Přesunout', () => {
            move = { item, type };
            const form = $('move-form'), select = form.elements.collection_id;
            select.replaceChildren();
            data.collections.filter(c => c.lifecycle === 'active').forEach(c => {
                const option = node('option', c.title);
                option.value = c.id;
                option.selected = String(c.id) === String(item.collection_id);
                select.append(option);
            });
            $('move-item-title').textContent = item.title;
            form.querySelector('.edit-error').textContent = '';
            $('move-dialog').showModal();
            select.focus();
        }));
    }
    function fileLink(file) {
        if (!file.url) return node('span', file.title + ' · ' + state(file.state));
        const a = node('a', 'Stáhnout: ' + file.title); a.href = file.url + '&download=1'; return a;
    }
    function state(value) {
        return ({ available: 'Audio dostupné', deleted: 'Audio odstraněno', missing: 'Audio neočekávaně chybí', deleting: 'Probíhá odstranění', pending: 'Upload není dokončený', partial: 'Neúplná sada audia', uploading: 'Probíhá upload', failed: 'Operace vyžaduje dokončení' })[value] || value;
    }
    function singlePlayer(parent, file, recording, actions) {
        if (!file?.url) return;
        const audio = node('audio'); audio.controls = true; audio.preload = 'metadata'; audio.src = file.url; parent.append(audio);
        const cacheKey = cfg.cachePrefix + 'audio:' + file.id + ':' + file.sha256;
        const cache = button('Uložit offline', async () => {
            const current = await idbKeyval.get(cacheKey, store);
            if (current instanceof Blob) {
                if (!confirm('Odebrat offline kopii pouze z tohoto prohlížeče?')) return;
                await idbKeyval.del(cacheKey, store); cache.textContent = 'Uložit offline';
            } else {
                const r = await fetch(file.url, { cache: 'no-store' });
                if (!r.ok) throw new Error('Audio už není dostupné. Obnovte seznam.');
                const blob = await r.blob();
                if (blob.size !== file.byte_size) throw new Error('Audio se nestáhlo celé.');
                await idbKeyval.set(cacheKey, blob, store); cache.textContent = 'Odebrat offline kopii';
            }
        });
        actions.append(cache);
        idbKeyval.get(cacheKey, store).then(blob => {
            if (blob instanceof Blob && audio.isConnected) { const url = URL.createObjectURL(blob); blobs.push(url); audio.src = url; cache.textContent = 'Odebrat offline kopii'; }
        }).catch(() => { cache.textContent = 'Offline úložiště není dostupné'; cache.disabled = true; });
        const seek = () => {
            const seconds = Number(qs.get('time_ms') || 0) / 1000;
            if (String(recording.id) === qs.get('recording_id') && Number.isFinite(seconds)) audio.currentTime = Math.min(audio.duration || 0, Math.max(0, seconds));
        };
        audio.addEventListener('loadedmetadata', seek, { once: true });
        actions.append(button('Kopírovat odkaz na čas', async () => {
            const url = new URL('index.php', location.href); url.search = new URLSearchParams({ v: '2', recording_id: recording.id, time_ms: Math.round(audio.currentTime * 1000) });
            await navigator.clipboard.writeText(url.href); message('Odkaz zkopírován.');
        }));
        return {
            canPlay: () => audio.isConnected && audio.readyState >= 1 && !audio.error,
            currentTimeMs: () => Math.round(audio.currentTime * 1000),
            durationMs: () => Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : null,
            seek: ms => { audio.currentTime = ms / 1000; },
            playRange: async (start, end) => {
                if (!audio.isConnected) throw new Error('Přehrávač již není otevřený.');
                window.MultitrackApp?.pause();
                document.querySelectorAll('#content audio').forEach(a => { if (a !== audio) a.pause(); });
                audio.currentTime = start / 1000; await audio.play();
            }
        };
    }
    function mixerAdapter(id) {
        const current = () => { const s = window.MultitrackApp?.getState(); return String(s?.id) === String(id) ? s : null; };
        return {
            canPlay: () => current()?.phase === 'ready',
            currentTimeMs: () => Math.round((current()?.position || 0) * 1000),
            durationMs: () => current()?.duration == null ? null : Math.round(current().duration * 1000),
            seek: ms => { if (current()?.phase === 'ready') window.MultitrackApp.seek(ms / 1000); },
            playRange: async (start, end) => {
                if (current()?.phase !== 'ready' || end > Math.round(current().duration * 1000)) throw new Error('Tento úsek není v načteném audiu dostupný.');
                document.querySelectorAll('#content audio').forEach(a => a.pause());
                window.MultitrackApp.pause(); window.MultitrackApp.seek(start / 1000); await window.MultitrackApp.play();
            }
        };
    }
    function recordingCard(r, list, collection) {
        const card = node('article', undefined, 'recording-card'); card.id = 'recording-' + r.id;
        const body = node('div', undefined, 'recording-body'); body.id = 'recording-body-' + r.id;
        const title = node('span', r.title, 'recording-title'); title.title = r.title;
        const meta = node('small', (r.kind === 'single' ? 'Audio' : 'Vícestopá') + ' · ' + r.author + ' · ' + (r.duration_ms == null ? 'délka nezjištěna' : time(r.duration_ms)));
        const toggle = node('button', undefined, 'recording-toggle'); toggle.type = 'button';
        toggle.append(title, meta); toggle.setAttribute('aria-controls', body.id);
        const id = String(r.id);
        function setExpanded(open) {
            body.hidden = !open; toggle.setAttribute('aria-expanded', String(open));
            if (open) expandedRecordings.add(id); else expandedRecordings.delete(id);
        }
        setExpanded(expandedRecordings.has(id));
        toggle.addEventListener('click', () => setExpanded(body.hidden));
        card.append(toggle);
        const status = node('p', state(r.lifecycle === 'active' ? r.audio_state : r.lifecycle), 'recording-status');
        status.dataset.state = r.lifecycle === 'active' ? r.audio_state : r.lifecycle;
        card.append(status);
        if (r.summary) body.append(node('p', r.summary, 'recording-summary'));
        if (r.summary_author) body.append(node('small', 'Souhrn: ' + r.summary_author + (r.summary_editor ? ' · naposledy upravil/a ' + r.summary_editor : '')));
        const actions = node('div', undefined, 'action-list recording-actions');
        let adapter;
        if (r.lifecycle === 'active' && r.kind === 'single') adapter = singlePlayer(body, r.files[0], r, actions);
        const mixed = mixerId === String(r.id);
        if (r.lifecycle === 'active' && r.kind === 'single' && r.files[0]?.url) actions.insertBefore(button('Otevřít', async () => {
            const seconds = body.querySelector('audio')?.currentTime || 0;
            await navigate({ collection_id: String(r.collection_id), recording_id: String(r.id), view: 'looper', time_ms: String(Math.round(seconds * 1000)) });
        }), actions.children[1] || null);
        if (r.lifecycle === 'active' && r.kind === 'multitrack' && !mixed) actions.append(button('Otevřít Mixér', async () => {
            await navigate({ collection_id: String(r.collection_id), recording_id: String(r.id), view: 'mixer' });
            if (mixerId === String(r.id)) mixerPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }));
        if (mixed) {
            mixerPanel.querySelector('#mixer-context').textContent = (collection.kind === 'song' ? 'Skladba: ' : 'Zkouška: ') + collection.title;
            mixerPanel.querySelector('#mt-playing-name').textContent = r.title;
        }
        const files = node('ul', undefined, 'files');
        r.files.forEach(f => {
            const li = node('li'); li.append(fileLink(f));
            const track = actionMenu('Možnosti souboru: ' + f.title);
            const fileActions = r.kind === 'single' ? actions : track.actions;
            if (cfg.write && r.can_edit) fileActions.append(button('Název stopy', () => openEdit(f, 'track', r)));
            if (r.can_edit && r.files.length > 1) reorderControls(fileActions, r.files, f, { scope: 'tracks', recording_id: Number(r.id), revision: Number(r.revision) });
            if (track.actions.childElementCount) li.append(track.menu);
            files.append(li);
        }); body.append(files);
        if (cfg.write && r.can_edit) actions.append(button('Upravit', () => openEdit(r, 'recording')));
        moveControl(actions, r, 'recording');
        if (cfg.write && r.can_remove && r.audio_state !== 'deleted') actions.append(button('Odstranit audio', () => remove(r, 'recording'), 'danger'));
        if (cfg.write && cfg.admin) actions.append(button('Úplně smazat', () => remove(r, 'recording', true), 'danger'));
        reorderControls(actions, list, r, { scope: 'recordings', collection_id: Number(collection.id), revision: Number(collection.recordings_revision) });
        if (actions.childElementCount) body.append(actions);
        timestampPanels.push(window.Vz2Timestamps.mount(body, r.id, adapter || (r.kind === 'multitrack' ? mixerAdapter(r.id) : null)));
        card.append(body); return card;
    }
    function uploadForm(collection) {
        const form = node('form');
        form.innerHTML = '<h2>Vložit nahrávku nebo přílohu</h2><label>Název<input name="title" maxlength="200" required></label><label>Druh<select name="kind"><option value="single">Běžná nahrávka</option><option value="multitrack">Vícestopá nahrávka</option><option value="attachment">Příloha (PDF, TXT, obrázek)</option></select></label><label>Soubory<input name="files[]" type="file" multiple required></label><progress class="upload-progress" max="100" value="0" hidden></progress><p class="upload-error" role="alert"></p><button>Nahrát</button>';
        const requestKey = key();
        form.addEventListener('submit', async e => {
            e.preventDefault(); const submit = form.querySelector('button'); submit.disabled = true;
            const progress = form.querySelector('progress'); progress.hidden = false;
            const fields = new FormData(form); fields.append('action', 'upload'); fields.append('collection_id', collection.id);
            fields.append('request_key', requestKey); fields.append('csrf', cfg.csrf); fields.append('file_count', form.querySelector('[type=file]').files.length);
            try {
                await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest(); xhr.open('POST', 'php/ajax/vz2.php'); xhr.setRequestHeader('X-CSRF-Token', cfg.csrf);
                    xhr.upload.onprogress = e => { if (e.lengthComputable) progress.value = e.loaded / e.total * 100; };
                    xhr.onerror = () => reject(new Error('Spojení selhalo. Zkontrolujte nedokončené operace před dalším uploadem.'));
                    xhr.onload = () => { try { const r = JSON.parse(xhr.responseText); if (xhr.status < 200 || xhr.status >= 300 || !r.ok) throw new Error(r.error || 'Upload selhal.'); resolve(r); } catch (err) { reject(err); } };
                    xhr.send(fields);
                });
                message('Upload byl dokončen.'); await refresh(); await window.MultitrackApp.refreshList();
            } catch (err) { form.querySelector('.upload-error').textContent = err.message; message(err.message, true); }
            finally { submit.disabled = false; }
        }); return form;
    }
    function render() {
        const liveIds = new Set(data.recordings.map(r => String(r.id)));
        for (const id of expandedRecordings) if (!liveIds.has(id)) expandedRecordings.delete(id);
        timestampPanels.splice(0).forEach(p => p.destroy());
        document.querySelectorAll('#content audio').forEach(a => a.pause()); blobs.splice(0).forEach(URL.revokeObjectURL);
        document.querySelectorAll('[data-kind]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kind === kind)));
        const list = data.collections.filter(c => c.kind === kind); $('collections').replaceChildren();
        list.forEach(c => {
            const row = node('div', undefined, 'collection');
            const select = button('', async () => { await navigate({ collection_id: String(c.id) }); window.Vz2Layout.closeCatalog(); });
            const icon = document.createElement('img'); icon.src = 'meat/ikona_kombo.png'; icon.alt = ''; icon.className = 'collection-icon';
            select.append(icon, node('span', c.title, 'collection-name'));
            select.title = c.title; select.setAttribute('aria-pressed', String(String(selected) === String(c.id))); row.append(select);
            const menu = node('details', undefined, 'collection-menu'), summary = node('summary', '⋮'); summary.setAttribute('aria-label', 'Možnosti: ' + c.title); menu.append(summary);
            const popover = node('div', undefined, 'collection-menu-popover');
            if (cfg.write && c.can_edit) popover.append(button('Přejmenovat', () => openEdit(c, 'collection')));
            const reload = button('', refresh, 'vz2-icon-button');
            reload.title = 'Obnovit'; reload.setAttribute('aria-label', 'Obnovit');
            const reloadIcon = node('i', undefined, 'ti ti-refresh'); reloadIcon.setAttribute('aria-hidden', 'true');
            reload.append(reloadIcon); popover.append(reload);
            const order = node('div', undefined, 'collection-order');
            reorderControls(order, list, c, { scope: 'collections', kind, revision: Number(data.orders.find(o => o.kind === kind).revision) });
            if (order.childElementCount) popover.append(order);
            if (cfg.write && cfg.admin) popover.append(button('Úplně smazat celek', () => remove(c, 'collection', true), 'danger'));
            menu.append(popover); row.append(menu);
            $('collections').append(row);
        });
        // Players live outside the catalogue; rebuilding cards cannot detach them.
        const content = $('content'); content.replaceChildren();
        const c = data.collections.find(c => String(c.id) === String(selected));
        $('collection-title-name').textContent = c?.title || 'Zatím tu nic není';
        $('collection-title').title = c?.title || '';
        $('bn-skladby').lastChild.textContent = kind === 'rehearsal' ? 'zkoušky' : 'skladby';
        if ($('create-collection-open')) $('create-collection-open').textContent = kind === 'rehearsal' ? '+ Nová zkouška' : '+ Nová skladba';
        window.Vz2Content.mountPreviews(c);
        if (!c) content.append(node('h1', 'Zatím tu nic není'), node('p', 'Vytvořte skladbu nebo zkoušku. Audio můžete přidat později.'));
        else {
            content.append(node('small', 'Vytvořil/a ' + c.author));
            const recordings = data.recordings.filter(r => String(r.collection_id) === String(c.id));
            if (!recordings.length) content.append(node('p', 'Tento celek zatím nemá žádné nahrávky.'));
            recordings.forEach(r => content.append(recordingCard(r, recordings, c)));
            data.attachments.filter(a => String(a.collection_id) === String(c.id)).forEach(a => {
                const card = node('article'); card.append(node('h3', a.title), node('small', 'Příloha · ' + a.author), node('p', a.summary || ''), fileLink(a));
                const { menu, actions } = actionMenu('Možnosti přílohy: ' + a.title);
                if (cfg.write && a.can_edit) actions.append(button('Upravit', () => openEdit(a, 'attachment')));
                moveControl(actions, a, 'attachment');
                if (cfg.write && a.can_remove && a.state !== 'deleted') actions.append(button('Odstranit soubor', () => remove(a, 'attachment'), 'danger'));
                if (actions.childElementCount) card.append(menu); content.append(card);
            });
            if (cfg.canUpload && c.lifecycle === 'active') {
                const upload = node('details', undefined, 'upload-section');
                upload.append(node('summary', '+ Přidat nahrávku / přílohu'), uploadForm(c)); content.append(upload);
            }
        }
        $('operations').hidden = !data.operations.length;
        const operations = $('operations').querySelector('div'); operations.replaceChildren();
        data.operations.forEach(op => { const row = node('p', '#' + op.id + ' · ' + op.target_title + ' · ' + op.state + ' '); if (cfg.write) row.append(button('Dokončit', async () => { await api({ action: 'retry', operation_id: Number(op.id) }); await refresh(); })); operations.append(row); });
    }
    document.querySelectorAll('[data-kind]').forEach(b => b.addEventListener('click', () => {
        navigate({ kind: b.dataset.kind }).catch(e => message(e.message, true));
    }));
    $('mixer-close').addEventListener('click', async () => {
        const previous = mixerId;
        await navigate({ collection_id: String(selected) }, true);
        const card = $('recording-' + previous);
        card?.scrollIntoView({ block: 'nearest' }); card?.querySelector('button')?.focus({ preventScroll: true });
    });
    $('mixer-copy-link').addEventListener('click', async () => {
        try {
            const current = window.MultitrackApp?.getState();
            if (!current || String(current.id) !== mixerId) throw new Error('Nejdříve načtěte nahrávku.');
            const url = new URL('index.php', location.href);
            url.search = new URLSearchParams({ v: '2', recording_id: mixerId, time_ms: Math.round(current.position * 1000), view: 'mixer' });
            await navigator.clipboard.writeText(url.href); message('Odkaz zkopírován.');
        } catch (e) { message(e.message, true); }
    });
    window.addEventListener('popstate', () => {
        const next = new URLSearchParams(location.search);
        if (!canNavigate(Object.fromEntries(next))) { setRoute(Object.fromEntries(qs), true); return; }
        window.Vz2Layout.hideIdeas(false);
        qs = next; deepLinkSeeked = false;
        if (data) applyRoute().catch(e => message(e.message, true));
    });
    $('create-collection')?.addEventListener('submit', async e => {
        e.preventDefault(); const f = e.currentTarget, b = f.querySelector('button'); b.disabled = true;
        try { const r = await api({ action: 'collection_create', kind, title: f.elements.title.value }); window.Vz2Layout.hideIdeas(false); setRoute({ collection_id: String(r.id) }); f.reset(); $('create-collection-dialog').close(); window.Vz2Layout.closeCatalog(); await refresh(); }
        catch (err) { f.querySelector('.edit-error').textContent = err.message; } finally { b.disabled = false; }
    });
    $('edit-cancel').addEventListener('click', () => $('editor').close());
    $('move-cancel').addEventListener('click', () => $('move-dialog').close());
    $('move-dialog').addEventListener('close', () => { move = null; });
    $('move-form').addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.currentTarget, submit = form.querySelector('button[type=submit]');
        const current = move;
        if (!current) return;
        submit.disabled = true;
        try {
            await mutate({ action: current.type + '_move', id: Number(current.item.id), revision: Number(current.item.revision), collection_id: Number(form.elements.collection_id.value) });
            $('move-dialog').close();
        } catch (err) { form.querySelector('.edit-error').textContent = err.message; }
        finally { submit.disabled = false; }
    });
    $('edit-form').addEventListener('submit', async e => {
        e.preventDefault(); const f = e.currentTarget, b = f.querySelector('button'); b.disabled = true;
        const { item, type, parent } = edit;
        const fields = { action: type === 'collection' ? 'collection_rename' : type + '_update', id: Number(parent?.id || item.id), revision: Number(parent?.revision || item.revision), title: f.elements.title.value, summary: f.elements.summary.value };
        if (type === 'track') fields.file_id = Number(item.id);
        try { await mutate(fields); $('editor').close(); }
        catch (err) { f.querySelector('.edit-error').textContent = err.message; $('edit-reload').hidden = err.status !== 409; }
        finally { b.disabled = false; }
    });
    $('edit-reload').addEventListener('click', async () => {
        if (!confirm('Zahodit rozepsanou úpravu a načíst aktuální verzi?')) return;
        try { const previous = edit; await refresh(); const rows = previous.type === 'collection' ? data.collections : previous.type === 'attachment' ? data.attachments : data.recordings;
            if (previous.type === 'track') { const parent = rows.find(r => String(r.id) === String(previous.parent.id)); const file = parent?.files.find(f => String(f.id) === String(previous.item.id)); if (!file) throw new Error('Stopa již neexistuje.'); $('editor').close(); openEdit(file, 'track', parent); }
            else { const item = rows.find(r => String(r.id) === String(previous.item.id)); if (!item) throw new Error('Položka již neexistuje.'); $('editor').close(); openEdit(item, previous.type); }
        } catch (e) { message(e.message, true); }
    });
    async function loadLog(reset) {
        if (reset) { logBefore = null; $('activity').querySelector('.log-entries').replaceChildren(); }
        const r = await api(null, 'log' + (logBefore ? '&before=' + encodeURIComponent(logBefore) : ''));
        $('activity').hidden = false;
        r.entries.forEach(e => { const row = node('div', undefined, 'log-entry'); row.append(node('strong', e.target_title + ' · ' + e.action), node('div', e.actor_name + ' · ' + new Date(e.occurred_at.replace(' ', 'T') + 'Z').toLocaleString('cs-CZ') + ' · ' + e.environment), node('small', e.detail)); $('activity').querySelector('.log-entries').append(row); });
        logBefore = r.entries.at(-1)?.id; $('log-more').hidden = r.entries.length < 50;
    }
    $('show-log')?.addEventListener('click', () => loadLog(true).catch(e => message(e.message, true)));
    $('log-more').addEventListener('click', () => loadLog(false).catch(e => message(e.message, true)));
    async function showOffline() {
        offlineUrls.splice(0).forEach(URL.revokeObjectURL);
        const panel = $('offline-files'), list = panel.querySelector('.offline-files-list');
        panel.hidden = false; list.replaceChildren();
        const keys = (await idbKeyval.keys(store)).filter(k => typeof k === 'string' && k.startsWith(cfg.cachePrefix));
        let total = 0, count = 0;
        for (const k of keys) {
            if (!k.startsWith(cfg.cachePrefix + 'audio:')) continue;
            const blob = await idbKeyval.get(k, store); if (!(blob instanceof Blob)) continue;
            total += blob.size; count++;
            const id = k.slice((cfg.cachePrefix + 'audio:').length).split(':')[0];
            const file = data?.recordings.flatMap(r => r.files).find(f => String(f.id) === id);
            const extension = ({'audio/wav':'wav','audio/mpeg':'mp3','audio/flac':'flac','audio/ogg':'ogg','audio/aac':'aac'})[blob.type] || 'bin';
            const name = file?.original_name || ('audio-' + id + '.' + extension);
            const row = node('p', (file?.title || 'Soubor #' + id) + ' · ' + (blob.size / 1048576).toFixed(2) + ' MB ', 'toolbar');
            const link = node('a', 'Stáhnout kopii'), url = URL.createObjectURL(blob); offlineUrls.push(url);
            link.href = url; link.download = name; row.append(link, button('Odebrat kopii', async () => {
                if (!confirm('Odebrat tuto kopii pouze z prohlížeče?')) return;
                window.MultitrackApp?.destroy();
                await idbKeyval.del(k, store); await showOffline(); if (data) render();
            })); list.append(row);
        }
        list.prepend(node('p', count + ' souborů · ' + (total / 1048576).toFixed(2) + ' MB'));
    }
    $('show-offline').addEventListener('click', () => showOffline().catch(e => message(e.message, true)));
    $('show-ideas').addEventListener('click', () => window.Vz2Content.openDiscussion({ scope: 'ideas' }));
    $('mixer-discussion').addEventListener('click', () => {
        const id = window.MultitrackApp?.getState()?.id;
        const recording = data?.recordings.find(r => String(r.id) === String(id));
        if (recording) window.Vz2Content.openDiscussion({ collection_id: recording.collection_id });
        else message('Nejdříve vyberte vícestopou nahrávku.', true);
    });
    $('offline-clear').addEventListener('click', async () => {
        if (!confirm('Odebrat všechny offline kopie tohoto prostředí z prohlížeče?')) return;
        try {
            window.MultitrackApp?.destroy();
            for (const k of await idbKeyval.keys(store)) if (typeof k === 'string' && k.startsWith(cfg.cachePrefix)) await idbKeyval.del(k, store);
            await showOffline(); if (data) render();
        } catch (e) { message(e.message, true); }
    });
    $('logout').addEventListener('click', async () => {
        try { await api({ action: 'logout' }); window.MultitrackApp?.destroy(); window.Vz2Player.closeLooper(); location.href = 'index.php?v=2'; }
        catch (e) { message(e.message, true); }
    });
    window.addEventListener('online', async () => {
        window.MultitrackApp?.destroy();
        window.Vz2Player.closeLooper();
        document.querySelectorAll('#content audio').forEach(a => { a.pause(); a.removeAttribute('src'); a.load(); });
        try { await refresh(); await window.MultitrackApp?.refreshList(); }
        catch (e) { $('content').replaceChildren(node('p', 'Před přehráním obnovte přihlášení a seznam.')); message(e.message, true); }
    });
    function seekMixerLink() {
        const current = window.MultitrackApp.getState(), seconds = Number(qs.get('time_ms')) / 1000;
        if (!deepLinkSeeked && current?.phase === 'ready' && String(current.id) === qs.get('recording_id') && Number.isFinite(seconds)) {
            window.MultitrackApp.seek(Math.max(0, seconds)); deepLinkSeeked = true;
        }
    }
    document.addEventListener('multitrack:ready', seekMixerLink);
    document.addEventListener('vz2:player-close', () => { navigate({ collection_id: String(selected) }, true).catch(e => message(e.message, true)); });
    document.addEventListener('multitrack:selected', e => {
        mixerNotes?.destroy(); window.Vz2Timestamps.stopLoop();
        mixerNotes = window.Vz2Timestamps.mount($('mixer-timestamps'), e.detail.id, mixerAdapter(e.detail.id));
    });
    const initialise = () => refresh().catch(e => { stopMixer(); message(e.message, true); $('content').replaceChildren(node('p', 'Seznam se nepodařilo načíst.')); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true });
    else initialise();
}());
