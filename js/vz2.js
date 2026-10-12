(function () {
    'use strict';
    const cfg = window.VZ2;
    let qs = new URLSearchParams(location.search);
    let data, selected, kind = 'song', edit, move, logBefore, mixerId = null;
    let navigationSerial = 0, catalogSerial = 0, playerSerial = 0, mixerSeek = null;
    let renderedCollection, renderedData;
    const collectionMemory = { song: null, rehearsal: null };
    try { const saved = JSON.parse(localStorage.getItem(cfg.cachePrefix + 'workspaces:collections')); for (const k of Object.keys(collectionMemory)) if (saved?.[k] != null) collectionMemory[k] = String(saved[k]); } catch (_) { /* First visit / private storage. */ }
    const surfaceMemory = new Map(), catalogMemory = { song: { search: '', scroll: 0 }, rehearsal: { search: '', scroll: 0 } };
    const blobs = [];
    const offlineUrls = [];
    let offlineViewSerial = 0;
    const timestampPanels = [];
    // Disclosure state lives only in this document; a reload always starts collapsed.
    const expandedRecordings = new Set();
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
        const edit = section('recording-action-edit', 'edit', 'Úpravy', 'Změna údajů, umístění a pořadí.');
        const danger = section('recording-action-danger', 'alert-triangle', 'Odstranění', 'Nevratné nebo destruktivní operace.');
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
        const toggle = button('Další', () => { dialog.showModal(); close.focus(); });
        toggle.setAttribute('aria-haspopup', 'dialog'); toggle.setAttribute('aria-controls', dialog.id);
        return {
            dialog, toggle, fileActions: file.actions, editActions: edit.actions, dangerActions: danger.actions,
            finish() {
                [file, edit, danger].forEach(group => { if (group.actions.childElementCount) options.append(group.card); });
                document.body.append(dialog);
            }
        };
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
    function time(ms) { return window.Vz2Timestamps.format(ms); }
    function fileName(file) { return file?.original_name || file?.display_name || file?.title || ''; }
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
        const requestedId = target?.collection_id || params.collection_id || collectionMemory[requestedKind];
        const collection = data?.collections.find(c => String(c.id) === String(requestedId) && c.lifecycle === 'active')
            || data?.collections.find(c => c.kind === requestedKind && c.lifecycle === 'active');
        const nextKind = collection?.kind || requestedKind;
        const workspace = ['history', 'ideas'].includes(params.workspace) ? params.workspace : nextKind === 'rehearsal' ? 'rehearsals' : 'songs';
        return { target, collection, kind: nextKind, workspace };
    }
    function rememberSurface() {
        if (!['songs', 'rehearsals'].includes(window.Vz2Layout.getWorkspace())) return;
        if (selected != null) surfaceMemory.set(String(selected), Object.fromEntries([...document.querySelectorAll('#content-area .panel-body')].map(host => [host.closest('.panel').dataset.panel, host.scrollTop])));
        catalogMemory[kind] = { search: $('catalog-search').value, scroll: $('collections').scrollTop };
    }
    function filterCatalog() {
        const query = $('catalog-search').value.toLocaleLowerCase('cs');
        $('collections').querySelectorAll('.collection').forEach(row => row.hidden = !row.querySelector('.collection-name').textContent.toLocaleLowerCase('cs').includes(query));
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
        if (selected != null) route.collection_id = String(selected);
        if (target && !['history', 'ideas'].includes(next.workspace)) {
            route.recording_id = String(target.id);
            if (params.time_ms !== undefined) route.time_ms = params.time_ms;
            if (params.view) route.view = params.view;
        }
        setRoute(route, true);
        const nextMixer = openRecording && target?.kind === 'multitrack' && target.lifecycle === 'active' ? String(target.id) : null;
        const nextLooper = openRecording && target?.kind === 'single' && target.lifecycle === 'active' && target.files[0]?.url && params.view === 'looper' ? String(target.id) : null;
        const loadSerial = nextMixer || nextLooper ? ++playerSerial : playerSerial;
        if (nextMixer || nextLooper) {
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
        delete params.recording_id; delete params.view; delete params.time_ms;
        setRoute(params, true);
        if (data) { rememberSurface(); render(); }
    }
    async function refresh() {
        const serial = ++catalogSerial, initial = !data, latest = await api();
        if (serial !== catalogSerial) return;
        const routeRecording = latest.recordings.find(r => String(r.id) === qs.get('recording_id'));
        const routeCollectionId = routeRecording?.collection_id || qs.get('collection_id');
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
        const f = $('edit-form'); f.elements.title.value = item.title; f.elements.summary.value = item.summary || '';
        f.elements.title.required = type === 'collection' || type === 'track';
        f.elements.title.closest('label').firstChild.nodeValue = type === 'recording' || type === 'attachment' ? 'Krátký popisek (nepovinný)' : 'Název';
        $('summary-label').hidden = type === 'collection' || type === 'track';
        f.querySelector('.edit-error').textContent = ''; $('edit-reload').hidden = true;
        $('editor').showModal();
    }
    async function remove(item, type, full = false) {
        const text = full ? 'Úplně odstranit položku a všechny její informace?' : 'Odstranit soubory a zachovat informace?';
        const name = type === 'recording' ? recordingName(item) : fileName(item);
        const confirmation = prompt(text + '\n' + name + (item.title ? '\nPro potvrzení napište popisek:\n' + item.title : '\nPro potvrzení napište název souboru:\n' + (item.files?.[0]?.original_name || name)));
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
        if (!file.url) return node('span', fileName(file) + ' · ' + state(file.state));
        const a = node('a', 'Stáhnout'); a.href = file.url + '&download=1';
        a.setAttribute('aria-label', 'Stáhnout soubor ' + fileName(file)); return a;
    }
    function state(value) {
        return ({ available: 'Audio dostupné', deleted: 'Audio odstraněno', missing: 'Audio neočekávaně chybí', deleting: 'Probíhá odstranění', pending: 'Upload není dokončený', partial: 'Neúplná sada audia', uploading: 'Probíhá upload', failed: 'Operace vyžaduje dokončení' })[value] || value;
    }
    function singlePlayer(parent, file, recording, actions, menuActions) {
        if (!file?.url) return;
        const audio = node('audio'); audio.controls = true; audio.preload = 'metadata'; audio.src = file.url;
        audio.dataset.source = 'web';
        const cacheKey = cfg.cachePrefix + 'audio:' + file.id + ':' + file.sha256;
        const cache = button('Uložit offline', async () => {
            const current = await idbKeyval.get(cacheKey, store);
            if (current instanceof Blob) {
                if (!confirm('Odebrat offline kopii pouze z tohoto prohlížeče?')) return;
                await idbKeyval.del(cacheKey, store); cache.textContent = 'Uložit offline';
            } else {
                cache.textContent = 'Stahuji offline…';
                try {
                    const blob = await window.Vz2Offline.download(file.url, file.byte_size, percent => {
                        cache.textContent = percent === null ? 'Stahuji offline…' : 'Stahuji offline ' + percent + ' %';
                    });
                    cache.textContent = 'Ukládám offline…';
                    await idbKeyval.set(cacheKey, file.original_name ? new File([blob], file.original_name, { type: blob.type }) : blob, store);
                    cache.textContent = 'Odebrat offline kopii';
                } catch (error) { cache.textContent = 'Uložit offline'; throw error; }
            }
        });
        actions.append(cache);
        idbKeyval.get(cacheKey, store).then(blob => {
            if (blob instanceof Blob && audio.isConnected && !cache.disabled) { const url = URL.createObjectURL(blob); blobs.push(url); audio.src = url; audio.dataset.source = 'offline'; cache.textContent = 'Odebrat offline kopii'; }
        }).catch(() => { cache.textContent = 'Offline úložiště není dostupné'; cache.disabled = true; });
        const seek = () => {
            const seconds = Number(qs.get('time_ms') || 0) / 1000;
            if (String(recording.id) === qs.get('recording_id') && Number.isFinite(seconds)) audio.currentTime = Math.min(audio.duration || 0, Math.max(0, seconds));
        };
        audio.addEventListener('loadedmetadata', seek, { once: true });
        menuActions.append(button('Kopírovat odkaz na čas', async () => {
            const url = new URL('index.php', location.href); url.search = new URLSearchParams({ v: '2', recording_id: recording.id, time_ms: Math.round(audio.currentTime * 1000) });
            await navigator.clipboard.writeText(url.href); message('Odkaz zkopírován.');
        }));
        return {
            audio,
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
        }
        setExpanded(expandedRecordings.has(id));
        toggle.addEventListener('click', () => setExpanded(body.hidden));
        card.append(toggle);
        const audioState = r.lifecycle === 'active' ? r.audio_state : r.lifecycle;
        const singleFile = r.kind === 'single' ? r.files[0] : null;
        const status = node('p', undefined, 'recording-status');
        if (r.title) status.append(node('span', r.title));
        if (singleFile && r.lifecycle === 'active') {
            if (audioState === 'deleted') status.append(node('span', ' - odstraněno', 'recording-deleted'));
            else if (audioState !== 'available') status.append(node('span', ' · ' + state(audioState)));
        } else if (audioState !== 'available') status.append(node('span', (r.title ? ' · ' : '') + state(audioState)));
        status.dataset.state = audioState;
        const description = node('div', undefined, 'recording-description');
        if (status.textContent) description.append(status);
        description.append(node('small', 'Vložil ' + r.author, 'vz2-attribution'));
        body.append(description);
        if (r.summary) body.append(node('p', r.summary, 'recording-summary'));
        if (r.summary_author) body.append(node('small', 'Souhrn: ' + r.summary_author + (r.summary_editor ? ' · upravil/a ' + r.summary_editor : ''), 'vz2-attribution'));
        const actions = node('div', undefined, 'action-list recording-actions');
        const recordingMenu = recordingActionsDialog(r);
        const fileActions = recordingMenu.fileActions;
        const editActions = recordingMenu.editActions;
        const dangerActions = recordingMenu.dangerActions;
        let adapter;
        if (r.lifecycle === 'active' && r.kind === 'single') adapter = singlePlayer(body, r.files[0], r, actions, fileActions);
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
            mixerPanel.querySelector('#mt-playing-name').textContent = primaryName;
        }
        const files = node('ul', undefined, 'files');
        r.files.forEach(f => {
            const li = node('li', fileName(f) + (f.url ? '' : ' · ' + state(f.state)));
            if (f.title) li.append(node('small', ' · ' + f.title, 'vz2-attribution'));
            if (f.url) fileActions.append(fileLink(f));
            if (cfg.write && r.can_edit) fileActions.append(button('Upravit popisek souboru', () => openEdit(f, 'track', r)));
            if (r.can_edit && r.files.length > 1) reorderControls(editActions, r.files, f, { scope: 'tracks', recording_id: Number(r.id), revision: Number(r.revision) });
            if (r.kind !== 'single') files.append(li);
        });
        if (files.childElementCount) body.append(files);
        if (cfg.write && r.can_edit) editActions.append(button('Upravit', () => openEdit(r, 'recording')));
        moveControl(editActions, r, 'recording');
        if (cfg.write && r.can_remove && r.audio_state !== 'deleted') dangerActions.append(button('Odstranit audio', () => remove(r, 'recording'), 'danger'));
        if (cfg.write && cfg.admin) dangerActions.append(button('Úplně smazat', () => remove(r, 'recording', true), 'danger'));
        reorderControls(editActions, list, r, { scope: 'recordings', collection_id: Number(collection.id), revision: Number(collection.recordings_revision) });
        if (fileActions.childElementCount || editActions.childElementCount || dangerActions.childElementCount) {
            recordingMenu.finish(); actions.append(recordingMenu.toggle);
        }
        if (actions.childElementCount) body.append(actions);
        if (adapter?.audio) body.append(adapter.audio);
        timestampPanels.push(window.Vz2Timestamps.mount(body, r.id, adapter || (r.kind === 'multitrack' ? mixerAdapter(r.id) : null)));
        card.append(body); return card;
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
            const song = collections.get(String(link.song_collection_id));
            return [{ link, recording, owner, song }];
        });
    }
    function renderLinkedRecordings(host, collection, rows) {
        if (!rows.length) return;
        const section = node('section', undefined, 'linked-recordings');
        section.append(node('h3', collection.kind === 'song' ? 'Ze zkoušek' : 'Nahrávky přiřazených skladeb'));
        const list = node('ul');
        rows.forEach(({ link, recording, owner, song }) => {
            const item = node('li'), description = node('div', undefined, 'linked-recording-description');
            description.append(node('strong', recordingName(recording)));
            const context = collection.kind === 'song' ? 'Zkouška: ' + owner.title : 'Skladba: ' + (song?.title || owner.title);
            const range = link.start_ms != null && link.end_ms != null ? ' · ' + time(link.start_ms) + '–' + time(link.end_ms) : '';
            description.append(node('small', context + range + (recording.audio_state === 'available' ? '' : ' · Audio není dostupné')));
            const open = button(range ? 'Otevřít úsek' : 'Otevřít nahrávku', async () => {
                const playable = recording.lifecycle === 'active' && recording.files.some(file => file.url);
                await navigate({ collection_id: String(owner.id), ...(playable ? { recording_id: String(recording.id), view: recording.kind === 'multitrack' ? 'mixer' : 'looper', time_ms: String(link.start_ms || 0) } : {}) });
            });
            open.setAttribute('aria-label', (range ? 'Otevřít úsek ' : 'Otevřít nahrávku ') + recordingName(recording) + ' u ' + owner.title);
            item.append(description, open); list.append(item);
        });
        section.append(list); host.append(section);
    }
    function render() {
        const liveIds = new Set(data.recordings.map(r => String(r.id)));
        for (const id of expandedRecordings) if (!liveIds.has(id)) expandedRecordings.delete(id);
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
        $('catalog-search').value = catalogMemory[kind].search; filterCatalog();
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
                function setExpanded(open) {
                    body.hidden = !open; toggle.setAttribute('aria-expanded', String(open));
                    if (open) expandedAttachments.add(id); else expandedAttachments.delete(id);
                }
                setExpanded(expandedAttachments.has(id));
                toggle.addEventListener('click', () => setExpanded(body.hidden));
                card.append(toggle);
                if (a.title) body.append(node('p', a.title, 'recording-status'));
                if (a.summary) body.append(node('p', a.summary, 'recording-summary'));
                if (!a.url) body.append(fileLink(a));
                body.append(node('small', 'Vložil/a ' + a.author, 'vz2-attribution'));
                const actions = node('div', undefined, 'action-list attachment-actions');
                if (a.url) actions.append(fileLink(a));
                if (cfg.write && a.can_edit) actions.append(button('Upravit', () => openEdit(a, 'attachment')));
                moveControl(actions, a, 'attachment');
                if (cfg.write && a.can_remove && a.state !== 'deleted') actions.append(button('Odstranit soubor', () => remove(a, 'attachment'), 'danger'));
                if (actions.childElementCount) body.append(actions);
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
    $('catalog-search').addEventListener('input', filterCatalog);
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
    $('mixer-close').addEventListener('click', async () => {
        const previous = mixerId;
        closePlayer();
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
    window.addEventListener('online', async () => {
        window.MultitrackApp?.destroy();
        window.Vz2Player.closeLooper();
        document.querySelectorAll('#content audio').forEach(a => { a.pause(); a.removeAttribute('src'); a.load(); });
        try { await refresh(); await window.MultitrackApp?.refreshList(); }
        catch (e) { $('content').replaceChildren(node('p', 'Před přehráním obnovte přihlášení a seznam.')); message(e.message, true); }
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
    });
    const initialise = () => refresh().catch(e => { window.Vz2Boot?.fail(); stopMixer(); message(e.message, true); $('content').replaceChildren(node('p', 'Seznam se nepodařilo načíst.')); });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise, { once: true });
    else initialise();
}());
