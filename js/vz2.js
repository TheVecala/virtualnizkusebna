(function () {
    'use strict';
    const cfg = window.VZ2;
    let qs = new URLSearchParams(location.search);
    let data, selected, kind = 'song', edit, move, logBefore, mixerId = null;
    let navigationSerial = 0, catalogSerial = 0, playerSerial = 0, mixerSeek = null;
    let renderedCollection, renderedData;
    const collectionMemory = { song: null, rehearsal: null };
    try { const saved = JSON.parse(localStorage.getItem(cfg.cachePrefix + 'workspaces:collections')); for (const k of Object.keys(collectionMemory)) if (saved?.[k] != null) collectionMemory[k] = String(saved[k]); } catch (_) { /* First visit / private storage. */ }
    const surfaceMemory = new Map(), catalogMemory = { song: { scroll: 0 }, rehearsal: { scroll: 0 } };
    const blobs = [];
    const offlineUrls = [];
    let offlineViewSerial = 0;
    const timestampPanels = [];
    // Disclosure state lives only in this document; a reload always starts collapsed.
    const expandedRecordings = new Set();
    const expandedRecordingTimestamps = new Set();
    const expandedLinkedRecordings = new Set();
    const expandedAttachments = new Set();
    let mixerNotes;
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
    function recordingIconButton(label, icon, fn, cls = '') {
        const b = button('', fn, 'recording-icon-button ' + cls);
        const symbol = window.Vz2Audio.icon(icon);
        b.append(symbol); b.setAttribute('aria-label', label); b.title = label;
        return b;
    }
    function message(text, error = false) { $('message').textContent = text; $('message').className = error ? 'error' : ''; }
    function recordingActionsDialog(recording) {
        const dialog = node('dialog', undefined, 'recording-actions-dialog');
        dialog.id = 'recording-actions-' + recording.id;
        const titleId = 'recording-actions-title-' + recording.id;
        dialog.setAttribute('aria-labelledby', titleId);
        const header = node('div', undefined, 'dialog-header');
        const heading = node('div');
        const title = node('h2', 'Akce nahrávky'); title.id = titleId;
        heading.append(title, node('p', recordingName(recording), 'recording-actions-context'));
        if (recording.title) heading.append(node('small', recording.title, 'vz2-attribution'));
        const close = button('×', () => dialog.close(), 'modal-close');
        close.setAttribute('aria-label', 'Zavřít akce nahrávky'); close.title = 'Zavřít';
        header.append(heading, close);
        const options = node('div', undefined, 'recording-action-options');
        const section = (cls, icon, name, description) => {
            const card = node('section', undefined, 'recording-action-card ' + cls);
            const cardHeading = node('div', undefined, 'recording-action-heading');
            const symbol = node('i', undefined, 'ti ti-' + icon); symbol.setAttribute('aria-hidden', 'true');
            const copy = node('div'); copy.append(node('h3', name), node('p', description));
            const actions = node('div', undefined, 'recording-action-buttons');
            cardHeading.append(symbol, copy); card.append(cardHeading, actions);
            return { card, actions };
        };
        const fileNames = recording.files.map(fileName).join(', ');
        const file = section('recording-action-files', 'file-download', 'Soubor', fileNames || 'Soubor není dostupný.');
        const danger = section('recording-action-danger', 'alert-triangle', 'Odstranění', 'Audio lze odstranit se zachováním zápisu, nebo smazat celou nahrávku.');
        const footer = node('div', undefined, 'recording-action-footer');
        footer.append(button('Zavřít', () => dialog.close()));
        dialog.append(header, options, footer);
        dialog.addEventListener('click', e => {
            if (e.target === dialog) {
                const box = dialog.getBoundingClientRect();
                if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) dialog.close();
            }
        });
        dialog.addEventListener('click', e => {
            if (!e.target.closest('.recording-action-buttons > button, .recording-action-buttons > a')) return;
            dialog.close();
            // Editors are separate modal dialogs. Once an editor is closed, return
            // to this recording's actions (using the freshly rendered dialog when
            // saving the edit refreshed the catalog).
            queueMicrotask(() => {
                const child = Array.from(document.querySelectorAll('dialog[open]')).find(candidate => candidate !== dialog);
                if (!child) return;
                const restore = () => {
                    // The conflict reload flow closes and immediately reopens the
                    // same editor, so wait for its final close in that case.
                    if (child.open) { child.addEventListener('close', restore, { once: true }); return; }
                    queueMicrotask(() => {
                        if (document.querySelector('dialog[open]')) return;
                        const current = $('recording-actions-' + recording.id);
                        if (!current?.isConnected || current.open) return;
                        current.showModal();
                        current.querySelector('.modal-close')?.focus();
                    });
                };
                child.addEventListener('close', restore, { once: true });
            });
        }, true);
        const toggle = recordingIconButton('Další', 'dots', () => { dialog.showModal(); close.focus(); }, 'recording-menu-toggle');
        toggle.setAttribute('aria-haspopup', 'dialog'); toggle.setAttribute('aria-controls', dialog.id);
        return {
            dialog, toggle, fileActions: file.actions, dangerActions: danger.actions,
            finish() {
                [file, danger].forEach(group => { if (group.actions.childElementCount) options.append(group.card); });
                document.body.append(dialog);
            }
        };
    }
    async function api(fields, action = 'catalog', signal) {
        const response = await fetch('php/ajax/vz2.php' + (fields ? '' : '?action=' + action), {
            method: fields ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
            signal,
            headers: fields ? { 'Content-Type': 'application/json', 'X-CSRF-Token': cfg.csrf } : {},
            body: fields ? JSON.stringify(fields) : undefined
        });
        let result;
        try { result = await response.json(); } catch (_) { throw new Error('Server nevrátil platnou odpověď. Obnovte přihlášení.'); }
        if (!response.ok || !result.ok) { const e = new Error(result.error || 'Požadavek selhal.'); e.status = response.status; throw e; }
        return result;
    }
    function key() { return Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''); }
    function time(ms) { return window.Vz2Timestamps.format(ms); }
    function fileName(file) {
        const name = file?.title || file?.display_name || file?.original_name || '';
        const extension = file?.format || /\.([^.]+)$/.exec(file?.original_name || file?.display_name || '')?.[1];
        return name && extension && !name.toLowerCase().endsWith('.' + extension.toLowerCase()) ? name + '.' + extension : name;
    }
    function recordingName(recording) {
        const names = recording.files.map(fileName).filter(Boolean);
        if (recording.kind === 'single') return names[0] || recording.title || 'Nahrávka';
        if (!names.length) return recording.title || 'Vícestopá nahrávka';
        return names.length === 1 ? names[0] : names[0] + ' +' + (names.length - 1);
    }
    function stopMixer() {
        window.Vz2Timestamps.stopLoop();
        window.MultitrackApp?.destroy();
        mixerNotes?.destroy(); mixerNotes = null;
        $('mixer-export').disabled = true;
        mixerId = null; mixerPanel.hidden = true;
        window.Vz2Player.hideMixer();
    }
    function setRoute(params, replace = false) {
        const url = new URL('index.php', location.href);
        url.search = new URLSearchParams({ v: '2', ...params });
        if (url.href !== location.href) history[replace ? 'replaceState' : 'pushState'](null, '', url);
        qs = url.searchParams;
    }
    function resolveRoute(params) {
        const target = data?.recordings.find(r => String(r.id) === String(params.recording_id));
        const requestedKind = params.workspace === 'rehearsals' || params.kind === 'rehearsal' ? 'rehearsal' : 'song';
        // Linked rehearsal audio can play while its song folder remains selected.
        const requestedId = (params.keep_collection === '1' && params.collection_id) || target?.collection_id || params.collection_id || collectionMemory[requestedKind];
        const collection = data?.collections.find(c => String(c.id) === String(requestedId) && c.lifecycle === 'active')
            || data?.collections.find(c => c.kind === requestedKind && c.lifecycle === 'active');
        const nextKind = collection?.kind || requestedKind;
        const workspace = ['history', 'ideas'].includes(params.workspace) ? params.workspace : nextKind === 'rehearsal' ? 'rehearsals' : 'songs';
        return { target, collection, kind: nextKind, workspace };
    }
    function rememberSurface() {
        if (!['songs', 'rehearsals'].includes(window.Vz2Layout.getWorkspace())) return;
        if (selected != null) surfaceMemory.set(String(selected), Object.fromEntries([...document.querySelectorAll('#content-area .panel-body')].map(host => [host.closest('.panel').dataset.panel, host.scrollTop])));
        catalogMemory[kind].scroll = $('collections').scrollTop;
    }
    async function canNavigate(params, force = false) {
        const next = resolveRoute(params), target = next.target;
        const nextMode = target?.kind === 'multitrack' ? 'mixer' : target?.kind === 'single' && params.view === 'looper' ? 'looper' : null;
        if (!force && nextMode && !window.Vz2Player.canLeave(target.id, nextMode)) return false;
        // Hiding the song workspace keeps its map mounted, including an unfinished edit.
        if (['history', 'ideas'].includes(next.workspace) || next.kind !== 'song') return true;
        return window.Vz2SongMap.canLeave(next.collection?.id);
    }
    async function navigate(params, force = false) {
        const serial = ++navigationSerial;
        if (!await canNavigate(params, force) || serial !== navigationSerial) return false;
        rememberSurface();
        setRoute(params); message('');
        if (data) await applyRoute(!!params.recording_id);
        return true;
    }
    async function applyRoute(openRecording = false) {
        const params = Object.fromEntries(qs), next = resolveRoute(params), target = next.target;
        // Non-collection workspaces preserve the mounted song/rehearsal surface.
        if (!['history', 'ideas'].includes(next.workspace) || renderedData === undefined) {
            selected = next.collection?.id; kind = next.kind;
            if (selected != null) collectionMemory[kind] = String(selected);
            try { localStorage.setItem(cfg.cachePrefix + 'workspaces:collections', JSON.stringify(collectionMemory)); } catch (_) { /* Keep memory. */ }
        }
        const route = { workspace: next.workspace, kind };
        if (params.listen === '1') route.listen = '1';
        if (selected != null) route.collection_id = String(selected);
        if (target && !['history', 'ideas'].includes(next.workspace)) {
            route.recording_id = String(target.id);
            if (params.time_ms !== undefined) route.time_ms = params.time_ms;
            if (params.view) route.view = params.view;
            if (params.keep_collection === '1') route.keep_collection = '1';
        }
        setRoute(route, true);
        const nextMixer = openRecording && target?.kind === 'multitrack' && target.lifecycle === 'active' ? String(target.id) : null;
        const nextCarAudio = openRecording && params.listen === '1' && matchMedia('(max-width: 767px)').matches
            && target?.kind === 'single' && target.lifecycle === 'active' && target.files.some(file => file.url) ? String(target.id) : null;
        const nextLooper = !nextCarAudio && openRecording && target?.kind === 'single' && target.lifecycle === 'active' && target.files[0]?.url && params.view === 'looper' ? String(target.id) : null;
        const loadSerial = nextMixer || nextLooper || nextCarAudio ? ++playerSerial : playerSerial;
        if (nextMixer || nextLooper || nextCarAudio) {
            if (mixerId && mixerId !== nextMixer) stopMixer();
            if (nextMixer) {
                mixerId = nextMixer; window.Vz2Player.showMixer(withSource(target));
                $('mixer-context').textContent = (next.kind === 'song' ? 'Skladba: ' : 'Zkouška: ') + (next.collection?.title || '');
                $('mt-playing-name').textContent = recordingName(target);
                mixerSeek = { id: nextMixer, seconds: Math.max(0, Number(params.time_ms || 0) / 1000) };
            }
        }
        const rebuild = renderedCollection !== selected || renderedData !== data || nextMixer;
        if (rebuild) render();
        window.Vz2Layout.showWorkspace(next.workspace);
        if (rebuild && ['songs', 'rehearsals'].includes(next.workspace)) {
            $('panel-recordings').querySelector('.panel-body').scrollTop = surfaceMemory.get(String(selected))?.recordings || 0;
            $('collections').scrollTop = catalogMemory[kind].scroll;
        }
        if (target && openRecording && !['history', 'ideas'].includes(next.workspace)) window.Vz2Layout.revealRecording();
        if (params.recording_id && !target) message('Odkazovaná nahrávka již neexistuje.', true);
        window.Vz2Boot?.ready();
        document.dispatchEvent(new Event('vz2:car-context'));
        if (next.workspace === 'ideas') window.Vz2Content.openDiscussion({ scope: 'ideas' });
        if (nextLooper) await window.Vz2Player.openLooper(withSource(target), target.files[0], Number(params.time_ms || 0) / 1000, true);
        if (nextMixer) {
            if (String(window.MultitrackApp?.getState()?.id) !== nextMixer) {
                try {
                    await window.MultitrackApp.refreshList();
                    if (loadSerial !== playerSerial) return;
                    if (!window.MultitrackApp.load(nextMixer)) throw new Error('Nahrávka není dostupná. Obnovte seznam.');
                } catch (e) { if (loadSerial === playerSerial) { window.Vz2Player.mixerFailed(); message(e.message, true); } }
            }
            seekMixerLink();
        }
    }
    function withSource(recording) {
        return { ...recording, collection_title: data.collections.find(c => String(c.id) === String(recording.collection_id))?.title || '' };
    }
    function closePlayer() {
        ++playerSerial; mixerSeek = null;
        if (mixerId) stopMixer();
        window.Vz2Player.closeLooper();
        const params = Object.fromEntries(qs);
        delete params.recording_id; delete params.view; delete params.time_ms; delete params.keep_collection;
        setRoute(params, true);
        if (data) { rememberSurface(); render(); }
    }
    async function refresh() {
        const serial = ++catalogSerial, initial = !data, latest = await api();
        if (serial !== catalogSerial) return;
        const routeRecording = latest.recordings.find(r => String(r.id) === qs.get('recording_id'));
        const routeCollectionId = (qs.get('keep_collection') === '1' && qs.get('collection_id')) || routeRecording?.collection_id || qs.get('collection_id');
        const routeCollection = latest.collections.find(c => String(c.id) === String(routeCollectionId))
            || latest.collections.find(c => c.kind === (qs.get('kind') === 'rehearsal' ? 'rehearsal' : 'song') && c.lifecycle === 'active');
        if (routeCollection?.kind === 'song' && !await window.Vz2SongMap.canLeave(routeCollection.id) || serial !== catalogSerial) return;
        if (data) rememberSurface();
        data = latest;
        const playing = window.MultitrackApp?.getState();
        const playingRecording = playing && data.recordings.find(r => String(r.id) === String(playing.id));
        if (playing && (!playingRecording || playingRecording.lifecycle !== 'active' || (playing.phase !== 'archived' && !playingRecording.files.some(f => f.state === 'available')))) stopMixer();
        const looper = window.Vz2Player.getState();
        if (looper?.mode === 'looper' && !data.recordings.some(r => String(r.id) === looper.id && r.lifecycle === 'active' && r.files.some(f => f.url))) window.Vz2Player.closeLooper();
        await applyRoute(initial);
    }
    async function mutate(fields) { await api(fields); message('Uloženo.'); await refresh(); }
    function reorderControls(parent, list, item, params, afterReorder) {
        if (!cfg.write || !cfg.canReorder) return;
        const index = list.indexOf(item);
        [-1, 1].forEach(delta => {
            const b = button(delta < 0 ? '↑' : '↓', async () => {
                const ids = list.map(x => Number(x.id));
                [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
                await mutate({ action: 'reorder', ids, ...params });
                if (afterReorder) await afterReorder(delta);
            });
            b.setAttribute('aria-label', delta < 0 ? 'Posunout výše' : 'Posunout níže');
            b.disabled = index + delta < 0 || index + delta >= list.length;
            parent.append(b);
        });
    }
    function openEdit(item, type, parent = null) {
        edit = { item, type, parent };
        const f = $('edit-form'); f.elements.title.value = type === 'track' ? fileName(item) : item.title || ''; f.elements.summary.value = item.summary || '';
        f.elements.title.required = type === 'collection' || type === 'track';
        f.elements.title.closest('label').firstChild.nodeValue = type === 'recording' || type === 'attachment' ? 'Krátký popisek (nepovinný)' : type === 'track' ? 'Název souboru' : 'Název';
        $('summary-label').hidden = type === 'collection' || type === 'track';
        f.querySelector('.edit-error').textContent = ''; $('edit-reload').hidden = true;
        $('editor').showModal();
    }
    async function remove(item, type, full = false) {
        const removeItem = full || type === 'attachment';
        const text = full && type === 'recording'
            ? 'Úplně smazat nahrávku včetně audia, popisku a časových značek? Tuto akci nelze vrátit.'
            : removeItem ? 'Úplně odstranit položku a všechny její informace?' : 'Odstranit soubory a zachovat informace?';
        const name = type === 'recording' ? recordingName(item) : fileName(item);
        const confirmation = type === 'recording'
            ? (window.confirm(text + '\n' + name) ? (item.title || item.files?.[0]?.original_name || name) : null)
            : prompt(text + '\n' + name + (item.title ? '\nPro potvrzení napište popisek:\n' + item.title : '\nPro potvrzení napište název souboru:\n' + (item.files?.[0]?.original_name || name)));
        if (confirmation === null) return;
        await api({ action: full ? 'delete_' + type : type === 'recording' ? 'remove_audio' : 'remove_attachment',
            id: Number(item.id), revision: Number(item.revision), confirm: confirmation, request_key: key() });
        window.MultitrackApp?.destroy();
        await refresh();
        await window.MultitrackApp?.refreshList();
        message(removeItem ? 'Položka byla odstraněna. Deník zůstává.' : 'Soubory byly odstraněny, informace zůstávají.');
    }
    function moveControl(parent, item, type) {
        if (!cfg.write || !item.can_move) return;
        parent.append(button('Přesunout', () => {
            move = { item, type };
            const form = $('move-form'), select = form.elements.collection_id;
            const links = type === 'recording' ? (data.recording_links || []).filter(link => String(link.source_recording_id) === String(item.id) || String(link.clip_recording_id) === String(item.id)) : [];
            const origin = data.collections.find(c => String(c.id) === String(item.collection_id));
            const info = $('move-links-info');
            info.hidden = !links.length;
            if (links.length) info.textContent = links.length === 1
                ? 'Nahrávka je propojená v matici. Přesun zároveň upraví její vazbu. Cílem může být jen jiná ' + (origin.kind === 'song' ? 'skladba.' : 'zkouška.')
                : 'Nahrávka má ' + links.length + ' vazeb v matici. Přesun je upraví společně. Cílem může být jen jiná zkouška.';
            select.replaceChildren();
            data.collections.filter(c => c.lifecycle === 'active' && (!links.length || c.kind === origin.kind)).forEach(c => {
                const option = node('option', c.title);
                option.value = c.id;
                option.selected = String(c.id) === String(item.collection_id);
                select.append(option);
            });
            $('move-item-title').textContent = type === 'recording' ? recordingName(item) : fileName(item);
            form.querySelector('.edit-error').textContent = '';
            $('move-dialog').showModal();
            select.focus();
        }));
    }
    function fileLink(file) {
        if (!file.url) return node('span', fileName(file) + ' · ' + (file.state === 'deleted' ? 'Soubor odstraněn' : state(file.state)));
        const a = node('a', 'Stáhnout'); a.href = file.url + '&download=1';
        a.setAttribute('aria-label', 'Stáhnout soubor ' + fileName(file)); return a;
    }
    function state(value) {
        return ({ available: 'Audio dostupné', deleted: 'Audio odstraněno', missing: 'Audio neočekávaně chybí', deleting: 'Probíhá odstranění', pending: 'Upload není dokončený', partial: 'Neúplná sada audia', uploading: 'Probíhá upload', failed: 'Operace vyžaduje dokončení' })[value] || value;
    }
    function singlePlayer(parent, file, recording, actions, menuActions) {
        if (!file?.url) return;
        const audio = node('audio'); audio.preload = 'none';
        const sourceStatus = node('small', 'Ověřuji místní kopii…', 'recording-audio-source vz2-attribution');
        parent.append(sourceStatus);
        const updateSource = () => { sourceStatus.textContent = audio.dataset.source === 'offline' ? 'Přehrávání ze zařízení' : 'Přehrávání ze sítě'; };
        const useLocal = blob => {
            blobs.push(window.Vz2Offline.useBlob(audio, blob, text => message(text, true)));
            updateSource();
        };
        const cacheKey = cfg.cachePrefix + 'audio:' + file.id + ':' + file.sha256;
        const cache = recordingIconButton('Uložit offline', 'wifi-off', async () => {
            await sourceReady;
            const current = await idbKeyval.get(cacheKey, store);
            if (current instanceof Blob) {
                if (!confirm('Odebrat offline kopii pouze z tohoto prohlížeče?')) return;
                await idbKeyval.del(cacheKey, store); setCacheLabel('Uložit offline');
            } else {
                setCacheLabel('Stahuji offline…');
                try {
                    const blob = await window.Vz2Offline.download(file.url, file.byte_size, percent => {
                        setCacheLabel(percent === null ? 'Stahuji offline…' : 'Stahuji offline ' + percent + ' %');
                    });
                    setCacheLabel('Ukládám offline…');
                    await idbKeyval.set(cacheKey, file.original_name ? new File([blob], file.original_name, { type: blob.type }) : blob, store);
                    if (audio.isConnected) useLocal(blob);
                    setCacheLabel('Odebrat offline kopii', true);
                } catch (error) { setCacheLabel('Uložit offline'); throw error; }
            }
        });
        const setCacheLabel = (label, saved = false) => {
            cache.setAttribute('aria-label', label); cache.title = label;
            cache.setAttribute('aria-pressed', String(saved));
            const percent = /(?:Stahuji offline )(\d+) %$/.exec(label);
            if (percent) cache.dataset.progress = percent[1] + '%';
            else if (label === 'Stahuji offline…' || label === 'Ukládám offline…') cache.dataset.progress = '…';
            else delete cache.dataset.progress;
            cache.replaceChildren(window.Vz2Audio.icon(saved ? 'device-floppy' : 'wifi-off'));
        };
        cache.setAttribute('aria-pressed', 'false');
        actions.append(cache);
        const sourceReady = idbKeyval.get(cacheKey, store).then(blob => {
            if (!audio.isConnected) return;
            if (blob instanceof Blob) { useLocal(blob); setCacheLabel('Odebrat offline kopii', true); }
            else { audio.src = file.url; audio.dataset.source = 'web'; updateSource(); }
        }).catch(() => {
            if (!audio.isConnected) return;
            audio.src = file.url; audio.dataset.source = 'web'; updateSource();
            setCacheLabel('Offline úložiště není dostupné'); cache.disabled = true;
        });
        const seek = () => {
            const seconds = Number(qs.get('time_ms') || 0) / 1000;
            if (String(recording.id) === qs.get('recording_id') && Number.isFinite(seconds)) audio.currentTime = Math.min(audio.duration || 0, Math.max(0, seconds));
        };
        audio.addEventListener('loadedmetadata', seek, { once: true });
        menuActions.append(button('Kopírovat odkaz na čas', () => window.Vz2CarMode.openShare(recording.id, '', Math.round(audio.currentTime * 1000))));
        return {
            audio,
            cache,
            isLoading: () => audio.dataset.sourceSwitching === 'true',
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
        const timestampsHost = node('div', undefined, 'recording-timestamps');
        timestampsHost.id = 'recording-timestamps-' + r.id; timestampsHost.hidden = true;
        let adapter, timestampPanel;
        const prepareAudio = () => {
            if (adapter?.audio?.preload === 'none') {
                adapter.audio.preload = 'metadata';
                adapter.audio.load();
            }
        };
        const prepareTimestamps = () => {
            prepareAudio();
            if (!timestampPanel) {
                timestampPanel = window.Vz2Timestamps.mount(timestampsHost, r.id, adapter || (r.kind === 'multitrack' ? mixerAdapter(r.id) : null));
                timestampPanels.push(timestampPanel);
            }
            timestampPanel.shell.open = true;
        };
        const primaryName = recordingName(r);
        const title = node('span', primaryName, 'recording-title');
        title.title = r.files.map(fileName).filter(Boolean).join(', ') || primaryName;
        const meta = node('small', r.duration_ms == null ? 'délka nezjištěna' : time(r.duration_ms), 'recording-duration');
        const toggle = node('button', undefined, 'recording-toggle'); toggle.type = 'button';
        toggle.append(title, meta); toggle.setAttribute('aria-controls', body.id);
        const id = String(r.id);
        function setExpanded(open) {
            body.hidden = !open; toggle.setAttribute('aria-expanded', String(open));
            if (open) expandedRecordings.add(id); else expandedRecordings.delete(id);
            if (open && body.isConnected) prepareAudio();
        }
        setExpanded(expandedRecordings.has(id));
        toggle.addEventListener('click', () => setExpanded(body.hidden));
        const heading = node('div', undefined, 'recording-heading');
        heading.append(toggle);
        card.append(heading);
        const caption = node('div', undefined, 'recording-caption');
        const canEditCaption = cfg.write && r.can_edit;
        if (r.title || canEditCaption) {
            caption.append(node('span', r.title || 'Přidat popisek', 'recording-caption-text' + (r.title ? '' : ' is-empty')));
            if (canEditCaption) {
                const editCaption = button('✎', () => openEdit(r, 'recording'), 'recording-caption-edit');
                editCaption.setAttribute('aria-label', r.title ? 'Upravit krátký popisek' : 'Přidat krátký popisek');
                editCaption.title = editCaption.getAttribute('aria-label');
                editCaption.setAttribute('aria-haspopup', 'dialog'); editCaption.setAttribute('aria-controls', 'editor');
                caption.append(editCaption);
            }
        }
        caption.append(node('small', 'Vložil ' + r.author, 'recording-author vz2-attribution'));
        const audioState = r.lifecycle === 'active' ? r.audio_state : r.lifecycle;
        const singleFile = r.kind === 'single' ? r.files[0] : null;
        const status = node('p', undefined, 'recording-status');
        if (singleFile && r.lifecycle === 'active') {
            if (audioState === 'deleted') status.append(node('span', state(audioState), 'recording-deleted'));
            else if (audioState !== 'available') status.append(node('span', state(audioState)));
        } else if (audioState !== 'available') status.append(node('span', state(audioState)));
        status.dataset.state = audioState;
        const description = node('div', undefined, 'recording-description');
        if (status.textContent) description.append(status);
        if (description.childElementCount) body.append(description);
        if (r.summary) body.append(node('p', r.summary, 'recording-summary'));
        if (r.summary_author) body.append(node('small', 'Souhrn: ' + r.summary_author + (r.summary_editor ? ' · upravil/a ' + r.summary_editor : ''), 'vz2-attribution'));
        const actions = node('div', undefined, 'action-list recording-actions');
        actions.setAttribute('role', 'toolbar'); actions.setAttribute('aria-label', 'Akce nahrávky ' + primaryName);
        const recordingMenu = recordingActionsDialog(r);
        const fileActions = recordingMenu.fileActions;
        const dangerActions = recordingMenu.dangerActions;
        if (!r.title && cfg.write && r.can_edit) fileActions.append(button('Přidat popisek', () => openEdit(r, 'recording')));
        if (r.lifecycle === 'active' && r.kind === 'single') adapter = singlePlayer(body, r.files[0], r, actions, fileActions);
        const mixed = mixerId === String(r.id);
        if (r.lifecycle === 'active' && r.kind === 'single' && r.files[0]?.url) actions.insertBefore(recordingIconButton('Otevřít v Looperu', 'wave-sine', async () => {
            const seconds = adapter.audio.currentTime || 0;
            await navigate({ collection_id: String(r.collection_id), recording_id: String(r.id), view: 'looper', time_ms: String(Math.round(seconds * 1000)) });
        }), adapter.cache);
        const inlinePlayer = adapter?.audio ? window.Vz2Audio.mount(adapter.audio, {
            actionRow: actions, knownDurationMs: r.duration_ms, label: primaryName, compactLooper: true
        }) : null;
        if (inlinePlayer) { actions.classList.add('has-inline-player'); actions.prepend(inlinePlayer.trigger); }
        if (r.lifecycle === 'active' && r.kind === 'multitrack' && !mixed) actions.append(recordingIconButton('Otevřít v Mixéru', 'adjustments-horizontal', async () => {
            await navigate({ collection_id: String(r.collection_id), recording_id: String(r.id), view: 'mixer' });
            if (mixerId === String(r.id)) mixerPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }));
        const timestampButton = recordingIconButton('Otevřít časové značky', 'timeline-event', () => {
            const open = timestampsHost.hidden;
            timestampsHost.hidden = !open; timestampButton.setAttribute('aria-expanded', String(open));
            timestampButton.setAttribute('aria-label', open ? 'Sbalit časové značky' : 'Otevřít časové značky');
            timestampButton.title = timestampButton.getAttribute('aria-label');
            if (open) { expandedRecordingTimestamps.add(id); prepareTimestamps(); }
            else expandedRecordingTimestamps.delete(id);
        });
        timestampButton.setAttribute('aria-controls', timestampsHost.id);
        timestampButton.setAttribute('aria-expanded', 'false');
        actions.append(timestampButton);
        if (r.lifecycle === 'active' && r.files.some(file => file.url)) {
            actions.append(recordingIconButton('Poslech v autě', 'car', () => window.Vz2CarMode.openRecording(r), 'recording-car-entry'));
        }
        if (mixed) {
            mixerPanel.querySelector('#mixer-context').textContent = (collection.kind === 'song' ? 'Skladba: ' : 'Zkouška: ') + collection.title;
            mixerPanel.querySelector('#mt-playing-name').textContent = primaryName;
        }
        const files = node('ul', undefined, 'files');
        r.files.forEach(f => {
            const li = node('li', fileName(f) + (f.url ? '' : ' · ' + state(f.state)));
            if (f.url) fileActions.append(fileLink(f));
            if (cfg.write && r.can_edit) fileActions.append(button(r.files.length > 1 ? 'Přejmenovat soubor: ' + fileName(f) : 'Přejmenovat soubor', () => openEdit(f, 'track', r)));
            if (r.kind !== 'single') {
                if (cfg.write && cfg.canReorder && r.can_edit && r.files.length > 1) {
                    li.classList.add('recording-track-row');
                    const label = node('span', li.textContent, 'recording-track-label');
                    li.replaceChildren(label);
                    const controls = node('div', undefined, 'recording-track-order');
                    reorderControls(controls, r.files, f, { scope: 'tracks', recording_id: Number(r.id), revision: Number(r.revision) });
                    li.append(controls);
                }
                files.append(li);
            }
        });
        if (files.childElementCount) body.append(files);
        moveControl(fileActions, r, 'recording');
        if (cfg.write && r.can_remove && r.audio_state !== 'deleted') dangerActions.append(button('Odstranit audio', () => remove(r, 'recording'), 'danger'));
        if (cfg.write && r.can_remove) dangerActions.append(button('Úplně smazat', () => remove(r, 'recording', true), 'danger'));
        if (cfg.write && cfg.canReorder) {
            const controls = node('div', undefined, 'recording-order-controls');
            reorderControls(controls, list, r, { scope: 'recordings', collection_id: Number(collection.id), revision: Number(collection.recordings_revision) });
            heading.append(controls);
        }
        if (fileActions.childElementCount || dangerActions.childElementCount) {
            recordingMenu.finish(); actions.append(recordingMenu.toggle);
        }
        if (actions.childElementCount) card.append(actions);
        if (inlinePlayer) card.append(inlinePlayer.root);
        card.append(timestampsHost);
        if (r.title || canEditCaption) card.append(caption);
        else body.prepend(node('small', 'Vložil ' + r.author, 'recording-author vz2-attribution'));
        if (!body.hidden) prepareAudio();
        if (expandedRecordingTimestamps.has(id)) {
            timestampsHost.hidden = false; timestampButton.setAttribute('aria-expanded', 'true');
            timestampButton.setAttribute('aria-label', 'Sbalit časové značky'); timestampButton.title = 'Sbalit časové značky';
        }
        card.append(body);
        if (!timestampsHost.hidden) prepareTimestamps();
        return card;
    }
    async function createUploadPeaks(recordingId, originals, report) {
        const catalog = await api();
        const recording = catalog.recordings.find(r => Number(r.id) === Number(recordingId));
        if (!recording || recording.files.length !== originals.length) throw new Error('Nelze dohledat stopy nahrávky.');
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) throw new Error('Tento prohlížeč neumí vytvořit křivku audia.');
        const context = new Context();
        const failures = [];
        try {
            for (let index = 0; index < originals.length; index++) {
                const file = recording.files[index], original = originals[index];
                const label = `Stopa ${index + 1}/${originals.length}: ${original.name}`;
                try {
                    report('Dekóduji audio… ' + label);
                    const buffer = await context.decodeAudioData(await original.arrayBuffer());
                    const count = Math.min(4096, buffer.length), peaks = new Float32Array(count);
                    let yielded = performance.now();
                    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
                        const samples = buffer.getChannelData(channel);
                        for (let i = 0; i < count; i++) {
                            const start = Math.floor(i * samples.length / count), end = Math.floor((i + 1) * samples.length / count);
                            for (let j = start; j < end; j++) {
                                const sample = Math.abs(samples[j]);
                                if (Number.isFinite(sample)) peaks[i] = Math.max(peaks[i], Math.min(1, sample));
                            }
                            if (performance.now() - yielded > 16 || i === count - 1) {
                                report('Vytvářím křivku… ' + label, (channel * count + i + 1) / (buffer.numberOfChannels * count) * 100);
                                await new Promise(resolve => setTimeout(resolve, 0));
                                yielded = performance.now();
                            }
                        }
                    }
                    report('Ukládám křivku do JSON… ' + label);
                    const response = await fetch('php/ajax/vz2_peaks.php', {
                        method: 'POST', credentials: 'same-origin',
                        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': cfg.csrf },
                        body: JSON.stringify({ file_id: file.id, sha256: file.sha256, peaks: Array.from(peaks) })
                    });
                    const result = await response.json();
                    if (!response.ok || !result.ok) throw new Error(result.error || 'Křivku nelze uložit.');
                } catch (error) { failures.push(original.name + ': ' + error.message); }
            }
        } finally { await context.close().catch(() => {}); }
        if (failures.length) throw new Error(failures.join('\n'));
    }
    function uploadForm(collection) {
        const form = node('form');
        form.innerHTML = '<div class="dialog-header"><h2 id="upload-title">Vložit nahrávku nebo přílohu</h2><button class="modal-close" type="button" aria-label="Zavřít vložení" title="Zavřít">×</button></div><label>Krátký popisek (nepovinný)<input name="title" maxlength="200"></label><fieldset class="upload-kind"><legend>Druh</legend><label><input type="radio" name="kind" value="single" checked><span>Běžná</span></label><label><input type="radio" name="kind" value="multitrack"><span>Vícestopá</span></label><label><input type="radio" name="kind" value="attachment"><span>Příloha</span></label></fieldset><label>Soubory<input name="files[]" type="file" multiple required></label><label class="upload-peaks-option"><input type="checkbox" name="create_peaks"><span>Po nahrání vytvořit křivku a uložit do JSON</span></label><p class="upload-status" role="status" aria-live="polite"></p><progress class="upload-progress" aria-label="Průběh nahrávání a tvorby křivky" max="100" value="0" hidden></progress><p class="upload-error" role="alert"></p><div class="toolbar"><button type="submit">Nahrát</button></div>';
        let busy = false, uploaded = false;
        const dialog = $('upload-dialog'), close = form.querySelector('.modal-close');
        close.addEventListener('click', () => dialog.close());
        dialog.oncancel = e => { if (busy) e.preventDefault(); };
        dialog.onclose = () => {
            if (uploaded && form.querySelector('.upload-error').textContent) refresh().catch(error => message(error.message, true));
        };
        const option = form.querySelector('.upload-peaks-option'), checkbox = option.querySelector('input');
        form.addEventListener('change', () => {
            const attachment = form.elements.kind.value === 'attachment';
            option.hidden = attachment; checkbox.disabled = attachment;
        });
        const requestKey = key();
        form.addEventListener('submit', async e => {
            e.preventDefault(); if (busy || uploaded) return;
            const submit = form.querySelector('button[type=submit]');
            const originals = Array.from(form.querySelector('[type=file]').files);
            const generate = checkbox.checked && form.elements.kind.value !== 'attachment';
            const fields = new FormData(form); fields.delete('create_peaks');
            fields.append('action', 'upload'); fields.append('collection_id', collection.id);
            fields.append('request_key', requestKey); fields.append('csrf', cfg.csrf); fields.append('file_count', originals.length);
            const progress = form.querySelector('progress'), status = form.querySelector('.upload-status');
            const report = (text, value) => {
                progress.hidden = false; status.textContent = text;
                if (value === undefined) progress.removeAttribute('value'); else progress.value = value;
            };
            busy = true; close.disabled = true;
            const controls = [...form.querySelectorAll('input, button')];
            const disabled = controls.map(control => control.disabled);
            controls.forEach(control => { control.disabled = true; });
            form.querySelector('.upload-error').textContent = '';
            report('Nahrávám soubory…', 0);
            try {
                const result = await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest(); xhr.open('POST', 'php/ajax/vz2.php'); xhr.setRequestHeader('X-CSRF-Token', cfg.csrf);
                    xhr.upload.onprogress = e => report('Nahrávám soubory…', e.lengthComputable ? e.loaded / e.total * 100 : undefined);
                    xhr.upload.onload = () => report('Dokončuji uložení nahrávky…');
                    xhr.onerror = () => reject(new Error('Spojení selhalo. Zkontrolujte nedokončené operace před dalším uploadem.'));
                    xhr.onload = () => { try { const r = JSON.parse(xhr.responseText); if (xhr.status < 200 || xhr.status >= 300 || !r.ok) throw new Error(r.error || 'Upload selhal.'); resolve(r); } catch (err) { reject(err); } };
                    xhr.send(fields);
                });
                uploaded = true;
                if (generate) {
                    report('Připravuji tvorbu křivky…');
                    await createUploadPeaks(result.id, originals, report);
                }
                report(generate ? 'Nahrávka i křivka jsou uložené.' : 'Nahrávka je uložená.', 100);
                dialog.close(); message(generate ? 'Nahrávka byla nahrána a křivka uložena do JSON.' : 'Upload byl dokončen.');
                await refresh(); await window.MultitrackApp.refreshList();
            } catch (err) {
                progress.hidden = true;
                const text = uploaded ? 'Nahrávka je uložená. Následující krok se nepodařilo dokončit: ' + err.message : err.message;
                status.textContent = uploaded ? 'Upload byl dokončen.' : '';
                form.querySelector('.upload-error').textContent = text; message(text, true);
                if (uploaded) submit.textContent = 'Nahrávka je uložená';
            } finally {
                busy = false;
                controls.forEach((control, index) => { control.disabled = disabled[index]; });
                close.disabled = false; submit.disabled = uploaded;
            }
        }); return form;
    }
    function linkedRecordingRows(collection) {
        const recordings = new Map(data.recordings.map(recording => [String(recording.id), recording]));
        const collections = new Map(data.collections.map(item => [String(item.id), item]));
        return (data.recording_links || []).flatMap(link => {
            if (collection.kind === 'song' && String(link.song_collection_id) !== String(collection.id)) return [];
            if (collection.kind === 'rehearsal' && String(link.rehearsal_collection_id) !== String(collection.id)) return [];
            const recording = recordings.get(String(collection.kind === 'song' ? link.source_recording_id : link.clip_recording_id));
            if (!recording || String(recording.collection_id) === String(collection.id)) return [];
            const owner = collections.get(String(recording.collection_id));
            if (!owner) return [];
            return [{ link, recording, owner }];
        });
    }
    function renderLinkedRecordings(host, collection, rows) {
        if (!rows.length) return;
        const section = node('section', undefined, 'linked-recordings');
        section.append(node('h3', collection.kind === 'song' ? 'Ze zkoušek' : 'Nahrávky přiřazených skladeb'));
        const list = node('ul');
        function linkedCard({ link, recording, owner }, groupedInterval = false) {
            const name = recordingName(recording);
            const hasRange = link.start_ms != null && link.end_ms != null && link.end_ms > link.start_ms;
            const context = (owner.kind === 'rehearsal' ? 'Zkouška: ' : 'Skladba: ') + owner.title;
            const item = node('li', undefined, 'recording-card linked-recording-card');
            const body = node('div', undefined, 'recording-body');
            const key = collection.id + ':' + link.id + ':' + recording.id;
            body.id = 'linked-recording-body-' + collection.id + '-' + link.id + '-' + recording.id;
            const toggle = node('button', undefined, 'recording-toggle'); toggle.type = 'button';
            if (groupedInterval) {
                const label = node('span', undefined, 'linked-interval-label');
                label.append(node('span', 'Výstřížek ' + time(link.start_ms) + '–' + time(link.end_ms), 'recording-title'));
                if (link.start_body?.trim()) label.append(node('small', link.start_body.trim(), 'linked-interval-note'));
                toggle.append(label);
            } else {
                toggle.append(node('span', name, 'recording-title'), node('small', hasRange ? time(link.end_ms - link.start_ms) : recording.duration_ms == null ? 'délka nezjištěna' : time(recording.duration_ms), 'recording-duration'));
            }
            toggle.setAttribute('aria-controls', body.id);
            let audio;
            const prepareAudio = () => {
                if (audio?.preload === 'none') { audio.preload = 'metadata'; audio.load(); }
            };
            const setExpanded = open => {
                body.hidden = !open; toggle.setAttribute('aria-expanded', String(open));
                if (open) expandedLinkedRecordings.add(key); else expandedLinkedRecordings.delete(key);
                if (open) prepareAudio();
            };
            setExpanded(expandedLinkedRecordings.has(key));
            toggle.addEventListener('click', () => setExpanded(body.hidden));
            item.append(toggle);
            if (!groupedInterval) {
                const caption = node('div', undefined, 'recording-caption');
                caption.append(node('span', recording.title || context, 'recording-caption-text'));
                caption.append(node('small', 'Vložil ' + recording.author, 'recording-author vz2-attribution'));
                item.append(caption);
                body.append(node('p', context + (hasRange ? ' · úsek ' + time(link.start_ms) + '–' + time(link.end_ms) : ''), 'linked-recording-context'));
                if (recording.summary) body.append(node('p', recording.summary, 'recording-summary'));
            }
            if (recording.audio_state !== 'available' || recording.lifecycle !== 'active') {
                body.append(node('p', recording.lifecycle === 'active' ? state(recording.audio_state) : state(recording.lifecycle), 'recording-status'));
            }
            const playable = recording.lifecycle === 'active' && recording.files.some(file => file.url);
            const file = recording.kind === 'single' ? recording.files[0] : null;
            if (playable && file?.url) {
                audio = node('audio'); audio.preload = 'none'; audio.src = file.url;
                audio.dataset.source = 'web';
                audio.setAttribute('aria-label', (hasRange ? 'Přehrát úsek ' : 'Přehrát nahrávku ') + name);
                if (hasRange) {
                    const start = link.start_ms / 1000, end = link.end_ms / 1000;
                    const endTime = () => Number.isFinite(audio.duration) ? Math.min(end, audio.duration) : end;
                    audio.addEventListener('loadedmetadata', () => { audio.currentTime = start; });
                    audio.addEventListener('seeking', () => {
                        if (audio.currentTime < start) audio.currentTime = start;
                        else if (audio.currentTime > endTime()) { audio.currentTime = endTime(); audio.pause(); }
                    });
                    audio.addEventListener('timeupdate', () => {
                        if (!audio.paused && audio.currentTime >= endTime()) { audio.pause(); audio.currentTime = endTime(); }
                    });
                    audio.addEventListener('play', () => {
                        if (audio.currentTime >= endTime() - 0.05 || audio.currentTime < start) audio.currentTime = start;
                    });
                }
                audio.addEventListener('play', () => {
                    document.querySelectorAll('#content audio').forEach(other => { if (other !== audio) other.pause(); });
                    document.getElementById('looper-audio')?.pause();
                    window.MultitrackApp?.pause();
                });
                body.append(window.Vz2Audio.mount(audio, {
                    start: hasRange ? link.start_ms / 1000 : 0,
                    end: hasRange ? link.end_ms / 1000 : undefined,
                    knownDurationMs: hasRange ? link.end_ms - link.start_ms : recording.duration_ms,
                    label: name, inlineControls: true
                }).root);
            } else if (playable && recording.kind === 'multitrack') {
                body.append(node('p', 'Přehrávání vícestopé nahrávky je v mixéru.', 'linked-recording-context'));
            }
            const actions = node('div', undefined, 'action-list linked-recording-actions');
            const open = button(hasRange ? 'Otevřít úsek' : 'Otevřít', async () => {
                await navigate({
                    workspace: collection.kind === 'rehearsal' ? 'rehearsals' : 'songs', kind: collection.kind,
                    collection_id: String(collection.id), keep_collection: '1',
                    recording_id: String(recording.id), view: recording.kind === 'multitrack' ? 'mixer' : 'looper',
                    time_ms: String(hasRange ? link.start_ms : 0)
                });
            });
            open.disabled = !playable;
            open.setAttribute('aria-label', (hasRange ? 'Otevřít úsek ' : 'Otevřít nahrávku ') + name + ' v ' + (recording.kind === 'multitrack' ? 'mixéru' : 'looperu'));
            const source = button(owner.kind === 'rehearsal' ? 'Otevřít ve zkoušce' : 'Otevřít ve skladbě', async () => {
                const changed = await navigate({ workspace: owner.kind === 'rehearsal' ? 'rehearsals' : 'songs', kind: owner.kind, collection_id: String(owner.id) });
                if (!changed) return;
                window.Vz2Layout.revealRecording();
                const sourceCard = $('recording-' + recording.id);
                const disclosure = sourceCard?.querySelector('.recording-toggle');
                if (disclosure?.getAttribute('aria-expanded') === 'false') disclosure.click();
                sourceCard?.scrollIntoView({ block: 'nearest' });
            });
            actions.append(open, source); body.append(actions);
            if (!body.hidden) prepareAudio();
            item.append(body); return item;
        }
        if (collection.kind === 'song') {
            const groups = new Map();
            rows.forEach(row => {
                const id = String(row.recording.id);
                if (!groups.has(id)) groups.set(id, []);
                groups.get(id).push(row);
            });
            groups.forEach(group => {
                const { recording, owner } = group[0];
                const item = node('li', undefined, 'linked-recording-group');
                const header = node('div', undefined, 'linked-recording-group-header');
                header.append(node('h4', recordingName(recording), 'linked-recording-group-title'));
                const caption = node('div', undefined, 'recording-caption');
                if (recording.title) caption.append(node('span', recording.title, 'recording-caption-text'));
                caption.append(node('small', 'Vložil ' + recording.author, 'recording-author vz2-attribution'));
                header.append(caption, node('small', 'Zkouška: ' + owner.title, 'linked-recording-group-source'));
                if (recording.summary) header.append(node('p', recording.summary, 'recording-summary'));
                item.append(header);
                const intervals = node('ul', undefined, 'linked-recording-intervals');
                group.sort((a, b) => a.link.start_ms - b.link.start_ms || a.link.end_ms - b.link.end_ms || a.link.id - b.link.id)
                    .forEach(row => intervals.append(linkedCard(row, true)));
                item.append(intervals); list.append(item);
            });
        } else rows.forEach(row => list.append(linkedCard(row)));
        section.append(list); host.append(section);
    }
    function render() {
        const liveIds = new Set(data.recordings.map(r => String(r.id)));
        for (const id of expandedRecordings) if (!liveIds.has(id)) expandedRecordings.delete(id);
        for (const id of expandedRecordingTimestamps) if (!liveIds.has(id)) expandedRecordingTimestamps.delete(id);
        const liveAttachmentIds = new Set(data.attachments.map(a => String(a.id)));
        for (const id of expandedAttachments) if (!liveAttachmentIds.has(id)) expandedAttachments.delete(id);
        timestampPanels.splice(0).forEach(p => p.destroy());
        document.querySelectorAll('.recording-actions-dialog').forEach(dialog => dialog.remove());
        document.querySelectorAll('#content audio').forEach(a => a.pause()); blobs.splice(0).forEach(URL.revokeObjectURL);
        const list = data.collections.filter(c => c.kind === kind && c.lifecycle === 'active'); $('collections').replaceChildren();
        list.forEach(c => {
            const row = node('div', undefined, 'collection');
            const select = button('', async () => { await navigate({ collection_id: String(c.id) }); window.Vz2Layout.closeCatalog(); });
            const icon = document.createElement('img'); icon.src = 'meat/ikona_kombo.png'; icon.alt = ''; icon.className = 'collection-icon';
            select.append(icon, node('span', c.title, 'collection-name'));
            select.title = c.title; select.setAttribute('aria-pressed', String(String(selected) === String(c.id))); row.append(select);
            const menu = node('details', undefined, 'collection-menu'), summary = node('summary', '⋮'); summary.setAttribute('aria-label', 'Možnosti: ' + c.title); menu.append(summary);
            menu.dataset.collectionId = c.id;
            const popover = node('div', undefined, 'collection-menu-popover');
            const order = node('div', undefined, 'collection-order');
            reorderControls(order, list, c, { scope: 'collections', kind, revision: Number(data.orders.find(o => o.kind === kind).revision) }, async delta => {
                const restored = $('collections').querySelector(`.collection-menu[data-collection-id="${c.id}"]`);
                if (!restored) return;
                restored.closest('.collection').scrollIntoView({ block: 'nearest' });
                // Let scrolling finish before opening: scrolling the catalogue normally closes menus.
                await new Promise(resolve => requestAnimationFrame(resolve));
                restored.open = true;
                restored.querySelectorAll('.collection-order button')[delta < 0 ? 0 : 1].focus({ preventScroll: true });
            });
            if (order.childElementCount) popover.append(order);
            if (cfg.write && c.can_edit) popover.append(button('Přejmenovat', () => openEdit(c, 'collection')));
            if (cfg.write && cfg.admin) popover.append(button('Smazat', () => remove(c, 'collection', true), 'danger'));
            menu.append(popover); row.append(menu);
            $('collections').append(row);
        });
        // Players live outside the catalogue; rebuilding cards cannot detach them.
        const content = $('content'); content.replaceChildren();
        const c = data.collections.find(c => String(c.id) === String(selected));
        const uploadOpen = $('upload-open'), uploadDialog = $('upload-dialog');
        if (uploadOpen) uploadOpen.hidden = !c || c.lifecycle !== 'active';
        if (uploadDialog) {
            if (uploadDialog.open) uploadDialog.close();
            uploadDialog.replaceChildren(...(c && c.lifecycle === 'active' ? [uploadForm(c)] : []));
        }
        $('collection-title-name').textContent = c?.title || 'Zatím tu nic není';
        $('collection-title').title = c?.title || '';
        if ($('create-collection-open')) $('create-collection-open').textContent = kind === 'rehearsal' ? '+ Nová zkouška' : '+ Nová skladba';
        window.Vz2Layout.setCollectionKind(c?.kind || kind);
        const savedScroll = surfaceMemory.get(String(selected)) || {};
        window.Vz2Content.mountPreviews(c, savedScroll);
        $('collections').scrollTop = catalogMemory[kind].scroll;
        if (!c) content.append(node('h1', 'Zatím tu nic není'), node('p', 'Vytvořte skladbu nebo zkoušku. Audio můžete přidat později.'));
        else {
            content.append(node('small', 'Vytvořil/a ' + c.author, 'collection-attribution vz2-attribution'));
            const recordings = data.recordings.filter(r => String(r.collection_id) === String(c.id));
            const linked = linkedRecordingRows(c);
            if (!recordings.length) content.append(node('p', linked.length ? 'V této složce nejsou vlastní nahrávky.' : 'Tento celek zatím nemá žádné nahrávky.'));
            recordings.forEach(r => content.append(recordingCard(r, recordings, c)));
            data.attachments.filter(a => String(a.collection_id) === String(c.id)).forEach(a => {
                const card = node('article', undefined, 'recording-card attachment-card');
                const body = node('div', undefined, 'recording-body'); body.id = 'attachment-body-' + a.id;
                const toggle = node('button', undefined, 'recording-toggle'); toggle.type = 'button';
                toggle.append(node('span', fileName(a), 'recording-title'), node('small', 'Příloha', 'recording-duration'));
                toggle.setAttribute('aria-controls', body.id);
                const id = String(a.id);
                let image = null;
                function setExpanded(open) {
                    body.hidden = !open; toggle.setAttribute('aria-expanded', String(open));
                    if (open && image && !image.hasAttribute('src')) image.src = a.url + '&preview=1';
                    if (open) expandedAttachments.add(id); else expandedAttachments.delete(id);
                }
                toggle.addEventListener('click', () => setExpanded(body.hidden));
                card.append(toggle);
                if (a.title) body.append(node('p', a.title, 'recording-status'));
                if (a.summary) body.append(node('p', a.summary, 'recording-summary'));
                if (a.url && ['image/jpeg', 'image/png', 'image/gif'].includes(a.mime_type)) {
                    const preview = node('a', undefined, 'attachment-preview');
                    preview.href = a.url + '&preview=1'; preview.target = '_blank'; preview.rel = 'noopener';
                    image = node('img'); image.alt = 'Náhled obrázku ' + fileName(a);
                    image.loading = 'lazy'; image.decoding = 'async';
                    preview.append(image, node('span', 'Zobrazit celý obrázek'));
                    body.append(preview);
                }
                if (!a.url) body.append(fileLink(a));
                body.append(node('small', 'Vložil/a ' + a.author, 'vz2-attribution'));
                const actions = node('div', undefined, 'action-list attachment-actions');
                if (a.url) actions.append(fileLink(a));
                if (cfg.write && a.can_edit) actions.append(button('Upravit', () => openEdit(a, 'attachment')));
                moveControl(actions, a, 'attachment');
                if (cfg.write && a.can_remove) actions.append(button(a.state === 'deleted' ? 'Smazat položku' : 'Odstranit přílohu', () => remove(a, 'attachment'), 'danger'));
                if (actions.childElementCount) body.append(actions);
                setExpanded(expandedAttachments.has(id));
                card.append(body); content.append(card);
            });
            renderLinkedRecordings(content, c, linked);
        }
        renderedCollection = selected; renderedData = data;
        $('panel-recordings').querySelector('.panel-body').scrollTop = savedScroll.recordings || 0;
        $('operations').hidden = !data.operations.length;
        const operations = $('operations').querySelector('div'); operations.replaceChildren();
        data.operations.forEach(op => { const row = node('p', '#' + op.id + ' · ' + op.target_title + ' · ' + op.state + ' '); if (cfg.write) row.append(button('Dokončit', async () => { await api({ action: 'retry', operation_id: Number(op.id) }); await refresh(); })); operations.append(row); });
    }
    document.addEventListener('vz2:workspace-request', e => {
        if (!data) return;
        const workspace = e.detail.workspace;
        const nextKind = workspace === 'rehearsals' ? 'rehearsal' : workspace === 'songs' ? 'song' : kind;
        const params = { workspace, kind: nextKind };
        if (collectionMemory[nextKind]) params.collection_id = collectionMemory[nextKind];
        navigate(params).catch(e => message(e.message, true));
    });
    document.addEventListener('vz2:player-source', () => {
        const current = window.Vz2Player.getState();
        const recording = data?.recordings.find(r => String(r.id) === current?.id);
        if (recording) navigate({ collection_id: String(recording.collection_id) }).then(changed => { if (changed) window.Vz2Layout.revealRecording(); }).catch(e => message(e.message, true));
    });
    if ($('upload-open')) $('upload-open').addEventListener('click', () => {
        const dialog = $('upload-dialog');
        if (!dialog.querySelector('form')) return;
        dialog.showModal(); dialog.querySelector('[name=title]').focus();
    });
    $('mixer-copy-link').addEventListener('click', () => {
        $('looper-options').open = false;
        try {
            const current = window.MultitrackApp?.getState();
            if (!current || String(current.id) !== mixerId) throw new Error('Nejdříve načtěte nahrávku.');
            window.Vz2CarMode.openShare(mixerId, 'mixer', Math.round(current.position * 1000));
        } catch (e) { message(e.message, true); }
    });
    $('mixer-export').addEventListener('click', () => {
        $('looper-options').open = false;
        mixerNotes?.export();
    });
    window.addEventListener('popstate', async () => {
        const serial = ++navigationSerial;
        const next = new URLSearchParams(location.search);
        if (!await canNavigate(Object.fromEntries(next), true)) { setRoute(Object.fromEntries(qs), true); return; }
        if (serial !== navigationSerial) return;
        rememberSurface(); qs = next;
        // In-page history restores browsing. Only an explicit Open action or a
        // newly loaded deep link may replace or seek the shared player.
        if (data) applyRoute().catch(e => message(e.message, true));
    });
    $('create-collection')?.addEventListener('submit', async e => {
        e.preventDefault(); const f = e.currentTarget, b = f.querySelector('button'); b.disabled = true;
        if (kind === 'song' && !await window.Vz2SongMap.canLeave()) { b.disabled = false; return; }
        try { const r = await api({ action: 'collection_create', kind, title: f.elements.title.value }); rememberSurface(); setRoute({ collection_id: String(r.id), kind }); f.reset(); $('create-collection-dialog').close(); window.Vz2Layout.closeCatalog(); await refresh(); }
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
        r.entries.forEach(e => { const row = node('div', undefined, 'log-entry'); row.append(node('strong', e.target_title + ' · ' + e.action), node('div', e.actor_name + ' · ' + new Date(e.occurred_at.replace(' ', 'T') + 'Z').toLocaleString('cs-CZ') + ' · ' + e.environment, 'vz2-attribution'), node('small', e.detail)); $('activity').querySelector('.log-entries').append(row); });
        logBefore = r.entries.at(-1)?.id; $('log-more').hidden = r.entries.length < 50;
    }
    $('show-log')?.addEventListener('click', () => loadLog(true).catch(e => message(e.message, true)));
    $('log-more').addEventListener('click', () => loadLog(false).catch(e => message(e.message, true)));
    async function showOffline() {
        const serial = ++offlineViewSerial;
        offlineUrls.splice(0).forEach(URL.revokeObjectURL);
        const panel = $('offline-files'), list = panel.querySelector('.offline-files-list');
        panel.hidden = false; list.replaceChildren(node('p', 'Načítám offline soubory…', 'offline-summary'));
        const keys = (await idbKeyval.keys(store)).filter(k => typeof k === 'string' && k.startsWith(cfg.cachePrefix));
        if (serial !== offlineViewSerial) return;
        let total = 0, count = 0;
        const summary = node('p', undefined, 'offline-summary'); list.append(summary);
        for (const k of keys) {
            if (!k.startsWith(cfg.cachePrefix + 'audio:')) continue;
            const blob = await idbKeyval.get(k, store); if (!(blob instanceof Blob)) continue;
            if (serial !== offlineViewSerial) return;
            total += blob.size; count++;
            summary.textContent = count + ' ' + (count === 1 ? 'soubor' : count < 5 ? 'soubory' : 'souborů') + ' · ' + (total / 1048576).toFixed(2) + ' MB';
            const [id, expectedHash] = k.slice((cfg.cachePrefix + 'audio:').length).split(':');
            const file = data?.recordings.flatMap(r => r.files).find(f => String(f.id) === id && f.sha256 === expectedHash);
            const extension = ({'audio/wav':'wav','audio/mpeg':'mp3','audio/flac':'flac','audio/ogg':'ogg','audio/aac':'aac'})[blob.type] || 'bin';
            const originalName = file?.original_name || (blob instanceof File ? blob.name : '');
            const fallbackName = 'audio-' + id + '.' + extension;
            const row = node('article', undefined, 'offline-file');
            const details = node('div', undefined, 'offline-file-details');
            details.append(node('strong', originalName || fileName(file) || 'Soubor #' + id),
                node('small', (blob.size / 1048576).toFixed(2) + ' MB', 'vz2-attribution'));
            const status = node('small', 'Ověřuji shodu souboru…', 'offline-file-status'); details.append(status);
            const actions = node('div', undefined, 'offline-file-actions');
            const link = node('a', 'Stáhnout'), url = URL.createObjectURL(blob); offlineUrls.push(url);
            link.setAttribute('aria-label', 'Stáhnout ' + (originalName || fileName(file) || 'soubor #' + id));
            link.href = url; link.download = fallbackName; link.setAttribute('aria-disabled', 'true');
            link.addEventListener('click', e => { if (link.getAttribute('aria-disabled') === 'true') e.preventDefault(); });
            const removeCopy = button('Odebrat', async () => {
                if (!confirm('Odebrat tuto kopii pouze z prohlížeče?')) return;
                window.MultitrackApp?.destroy();
                await idbKeyval.del(k, store); await showOffline(); if (data) render();
            }, 'danger');
            removeCopy.setAttribute('aria-label', 'Odebrat ' + (originalName || fileName(file) || 'soubor #' + id));
            actions.append(link, removeCopy);
            row.append(details, actions); list.append(row);
            try {
                if (!/^[a-f0-9]{64}$/i.test(expectedHash) || !crypto.subtle) throw new Error('Kontrolní součet není dostupný.');
                const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
                if (serial !== offlineViewSerial) return;
                const actualHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
                if (actualHash === expectedHash.toLowerCase()) {
                    link.download = originalName || fallbackName;
                    status.textContent = originalName ? 'Ověřeno · původní název' : 'Ověřeno · původní název není dostupný';
                } else {
                    status.textContent = 'Kopie se liší od původního souboru · náhradní název';
                    status.classList.add('error');
                }
            } catch (error) {
                if (serial !== offlineViewSerial) return;
                status.textContent = 'Shodu nelze ověřit · náhradní název';
                status.classList.add('error');
            }
            link.removeAttribute('aria-disabled');
        }
        if (!count) summary.textContent = 'Žádné uložené soubory.';
        $('offline-clear').disabled = !count;
    }
    $('show-offline').addEventListener('click', () => showOffline().catch(e => message(e.message, true)));
    $('offline-clear').addEventListener('click', async () => {
        if (!confirm('Odebrat všechny offline kopie tohoto prostředí z prohlížeče?')) return;
        try {
            window.MultitrackApp?.destroy();
            for (const k of await idbKeyval.keys(store)) if (typeof k === 'string' && k.startsWith(cfg.cachePrefix)) await idbKeyval.del(k, store);
            await showOffline(); if (data) render();
        } catch (e) { message(e.message, true); }
    });
    $('logout').addEventListener('click', () => {
        document.querySelector('.shell-menu').open = false;
        $('logout-error').hidden = true;
        $('logout-dialog').showModal();
    });
    $('logout-cancel').addEventListener('click', () => $('logout-dialog').close());
    $('logout-confirm').addEventListener('click', async () => {
        const confirmButton = $('logout-confirm');
        if (!await window.Vz2SongMap.canLeave()) return;
        confirmButton.disabled = true;
        try { await api({ action: 'logout' }); window.MultitrackApp?.destroy(); window.Vz2Player.closeLooper(); location.href = 'index.php?v=2'; }
        catch (e) { $('logout-error').textContent = e.message; $('logout-error').hidden = false; confirmButton.disabled = false; }
    });
    let connectionProbe;
    const connectionStatus = text => { $('connection-status').textContent = text; $('connection-status').hidden = !text; };
    window.addEventListener('offline', () => {
        connectionProbe?.abort(); connectionProbe = null;
        connectionStatus('Offline · uložené nahrávky můžete dál přehrávat.');
    });
    window.addEventListener('online', async () => {
        connectionProbe?.abort();
        const probe = new AbortController(); connectionProbe = probe;
        const timeout = setTimeout(() => probe.abort(), 8000);
        connectionStatus('Ověřuji připojení k serveru…');
        try {
            // Reconnecting must not rebuild the catalog or any mounted player.
            await api(undefined, 'catalog', probe.signal);
            if (connectionProbe === probe) connectionStatus('');
        } catch (e) {
            if (connectionProbe === probe) connectionStatus(e.status === 401 || e.status === 403
                ? 'Přihlášení je potřeba obnovit. Načtené nahrávky můžete dál přehrávat.'
                : 'Server není dostupný. Uložené nahrávky můžete dál přehrávat.');
        } finally { clearTimeout(timeout); if (connectionProbe === probe) connectionProbe = null; }
    });
    function seekMixerLink() {
        const current = window.MultitrackApp.getState();
        if (mixerSeek && current?.phase === 'ready' && String(current.id) === mixerSeek.id && Number.isFinite(mixerSeek.seconds)) {
            window.MultitrackApp.seek(mixerSeek.seconds); mixerSeek = null;
        }
    }
    document.addEventListener('multitrack:ready', seekMixerLink);
    document.addEventListener('vz2:player-close', closePlayer);
    document.addEventListener('multitrack:selected', e => {
        mixerNotes?.destroy(); window.Vz2Timestamps.stopLoop();
        mixerNotes = window.Vz2Timestamps.mount($('mixer-timestamps'), e.detail.id, mixerAdapter(e.detail.id));
        $('mixer-export').disabled = false;
    });
    document.addEventListener('vz2:timestamps-updated', event => {
        const list = event.detail, recording = data?.recordings.find(r => Number(r.id) === Number(list.recording_id));
        if (!recording || Number(recording.timestamps_revision || 0) > list.timestamps_revision) return;
        Object.assign(recording, { timestamps: list.entries, annotations: list.annotations, annotation_version: list.annotation_version,
            timestamps_revision: list.timestamps_revision, duration_ms: list.duration_ms });
    });
    window.Vz2App = {
        getCarContext() { return { collections: data?.collections || [], recordings: data?.recordings || [], selected, kind, player: window.Vz2Player.getState() }; },
        openCarRecording(recording) { return navigate({ collection_id: String(recording.collection_id), recording_id: String(recording.id), view: recording.kind === 'multitrack' ? 'mixer' : 'audio', time_ms: '0', listen: '1' }, true); },
        setCarRoute(enabled, player = null) {
            const params = Object.fromEntries(qs);
            if (enabled) {
                params.listen = '1';
                if (player?.id) { params.recording_id = String(player.id); params.view = player.mode === 'mixer' ? 'mixer' : 'audio'; params.time_ms = String(Math.round((player.position || 0) * 1000)); }
            } else {
                delete params.listen;
                if (player?.mode === 'audio') { params.view = 'audio'; params.time_ms = String(Math.round((player.position || 0) * 1000)); }
            }
            setRoute(params, true);
        }
    };
    const initialise = () => refresh().catch(e => { window.Vz2Boot?.fail(); stopMixer(); message(e.message, true); $('content').replaceChildren(node('p', 'Seznam se nepodařilo načíst.')); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true });
    else initialise();
}());
