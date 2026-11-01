(function (root) {
    'use strict';
    const Model = typeof module !== 'undefined' && module.exports ? require('./vz2-timestamp-model.js') : root.Vz2TimestampModel;
    const kinds = { song_start: '♪ Pokusy', song_end: '■ Nespárované konce', passage: '↔ Pasáže', note: '● Poznámky' };
    function format(ms) {
        return compactFormat(ms);
    }
    const parse = Model.parse;
    const compactFormat = Model.format;
    function adjust(text, delta) {
        return format(parse(text) + Number(delta));
    }
    function timestampBody(kind, body) {
        body = body.trim();
        if (body) return body;
        if (kind === 'song_start') return '↑';
        if (kind === 'song_end') return '↓';
        throw new Error('U pasáže a poznámky vyplňte text.');
    }
    function songIntervalFor(entry, entries) {
        const items = Model.normalize({ id: 0, entries });
        const item = items.find(i => i.timestamp_id === Number(entry.id));
        const own = item?.kind === 'take' ? item : items.find(i => i.id === item?.parent_id && i.kind === 'take');
        const candidates = own ? [own] : entry.kind === 'note' ? items.filter(i => i.kind === 'take' && i.end_ms !== null && i.start_ms <= entry.time_ms && entry.time_ms < i.end_ms) : [];
        const take = candidates.length === 1 ? candidates[0] : null;
        const end = take && entries.find(e => Number(e.id) === take.end_timestamp_id);
        return end ? { start: take.source, end } : null;
    }
    function endOf(entry, entries, duration) { return Model.endOf(entry, entries, duration); }
    function tabular(entries, selected, duration = null) {
        const clean = value => String(value ?? '').replace(/[\t\r\n]+/g, ' ');
        return Model.normalize({ id: 0, entries, duration_ms: duration }).filter(i => selected.includes(i.source.kind)).map(i => [format(i.start_ms), i.end_ms === null ? '' : format(i.end_ms),
            i.kind === 'take' ? 'Pokus' : i.kind === 'passage' ? Model.passageTypes[i.passage_type] : i.kind === 'note' ? 'Poznámka' : 'Konec bez začátku',
            i.label, i.song_title, [i.note_text, i.end_source?.body?.replace(/^[↑↓]$/, '')].filter(Boolean).join(' · '), i.status === 'open' ? 'Doplnit konec' : ''].map(clean).join('\t')).join('\n');
    }
    function filenameBase(filename) {
        const name = String(filename || '').split(/[\\/]/).pop() || 'nahravka';
        return name.replace(/\.[^.]*$/, '') || 'nahravka';
    }
    function safeClipName(name) {
        return String(name || '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
    }
    function mp3spltLabels(entries, sourceFilename, duration = null) {
        const items = Model.normalize({ id: 0, entries, duration_ms: duration });
        const incomplete = items.filter(i => i.kind === 'boundary' || i.kind === 'take' && i.status === 'open').length;
        const clips = items.filter(i => i.kind === 'take' && i.status === 'complete').map(item => {
            const seconds = Math.floor(item.start_ms / 1000);
            const fallback = filenameBase(sourceFilename) + '_' + [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join('-');
            return { start: item.start_ms, end: item.end_ms, name: safeClipName(item.song_title || item.source.body?.replace(/^[↑↓]$/, '')) || safeClipName(fallback) };
        });
        return {
            filename: filenameBase(sourceFilename) + '.txt', incomplete,
            text: clips.map(clip => (clip.start / 1000).toFixed(3) + '\t' + (clip.end / 1000).toFixed(3) + '\t' + clip.name).join('\n')
        };
    }
    const api = { format, compactFormat, parse, adjust, timestampBody, songIntervalFor, endOf, tabular, filenameBase, safeClipName, mp3spltLabels };
    api.model = Model;
    if (typeof module !== 'undefined') module.exports = api;
    if (!root.document) return;
    root.Vz2Timestamps = api;
    const panels = new Set();
    document.addEventListener('vz2:timestamp-selected', e => panels.forEach(p => {
        p.container?.querySelectorAll('[data-annotation-id]').forEach(row => row.classList.toggle('ts-selected',
            Number(p.id) === e.detail?.recording_id && row.dataset.annotationId === e.detail?.item_id));
    }));
    let exportDialog, activeExportPanel;
    const Notes = root.Vz2NoteEditor;
    const openEditor = (panel, row) => Notes.openPanel(panel, row);
    const quickNote = (panel, symbol) => Notes.quickNote(panel, symbol);
    const el = (tag, text) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; return n; };
    const boundaryIcon = kind => {
        const label = kind === 'song_start' ? 'Začátek skladby' : 'Konec skladby';
        const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        icon.classList.add('ts-boundary-icon');
        icon.setAttribute('viewBox', '0 0 24 24');
        icon.setAttribute('role', 'img');
        icon.setAttribute('aria-label', label);
        const title = document.createElementNS(icon.namespaceURI, 'title');
        title.textContent = label;
        const path = document.createElementNS(icon.namespaceURI, 'path');
        path.setAttribute('d', kind === 'song_start'
            ? 'M4 4H20 M12 4V20 M6 14L12 20L18 14'
            : 'M4 20H20 M12 20V4 M6 10L12 4L18 10');
        icon.append(title, path);
        return icon;
    };
    const button = (text, fn) => { const b = el('button', text); b.type = 'button'; b.addEventListener('click', fn); return b; };
    const iconButton = (label, icon, fn) => {
        const b = button('', fn), i = el('i');
        b.className = 'ts-action'; b.title = label; b.setAttribute('aria-label', label);
        i.className = 'ti ti-' + icon; i.setAttribute('aria-hidden', 'true'); b.append(i);
        return b;
    };
    const Store = root.Vz2TimestampStore;
    const request = (id, fields) => fields ? Store.save(id, fields) : Store.load(id);
    const publish = value => Store.accept(value);
    Store.subscribe(value => panels.forEach(p => { if (Number(p.id) === Number(value.recording_id)) p.update(value); }));
    api.getList = Store.load;
    api.reload = Store.reload;
    api.save = Store.save;
    api.getItems = async id => Model.items(await Store.load(id));
    api.addQuickNote = Store.addQuickNote;
    const Playback = root.Vz2TimestampPlayback;
    api.stopLoop = Playback.stop;
    document.addEventListener('vz2:timestamp-playback', () => panels.forEach(p => p.playback()));
    function ensureExportDialog() {
        if (exportDialog) return;
        exportDialog = el('dialog'); exportDialog.className = 'vz2-timestamp-export';
        exportDialog.setAttribute('aria-labelledby', 'vz2-timestamp-export-title');
        exportDialog.innerHTML = '<div class="dialog-header"><h2 id="vz2-timestamp-export-title">Export časových značek</h2><button type="button" class="ts-export-close modal-close" aria-label="Zavřít export" title="Zavřít">×</button></div><div class="ts-export-options"><section class="ts-export-card ts-export-table"><div class="ts-export-heading"><i class="ti ti-table" aria-hidden="true"></i><div><h3>Export do tabulky</h3><p>Vyberte typy časových značek, které chcete zkopírovat.</p></div></div><fieldset class="ts-filters"><legend class="visually-hidden">Typy časových značek pro tabulku</legend></fieldset><button type="button" class="ts-export-copy"><i class="ti ti-copy" aria-hidden="true"></i> Kopírovat do schránky</button></section><section class="ts-export-card ts-export-text"><div class="ts-export-heading"><i class="ti ti-file-text" aria-hidden="true"></i><div><h3>Stažení TXT</h3><p>Stáhne všechny časové značky včetně souhrnu nahrávky.</p></div></div><a class="ts-export-download" href=""><i class="ti ti-download" aria-hidden="true"></i> Stáhnout TXT</a></section><section class="ts-export-card ts-export-mp3splt"><div class="ts-export-heading"><i class="ti ti-cut" aria-hidden="true"></i><div><h3>Export pro mp3splt</h3><p>Stáhne kompletní dvojice začátek–konec jako Audacity Labels.</p></div></div><button type="button" class="ts-export-mp3splt-download"><i class="ti ti-download" aria-hidden="true"></i> Stáhnout pro mp3splt</button></section></div><p class="ts-export-status error" role="alert"></p><div class="ts-export-footer"><button type="button" class="ts-export-close">Zavřít</button></div>';
        const filters = exportDialog.querySelector('.ts-filters');
        Object.entries(kinds).forEach(([value, text]) => {
            const label = el('label'), input = el('input');
            input.type = 'checkbox'; input.value = value;
            label.append(input, document.createTextNode(text)); filters.append(label);
        });
        const copy = exportDialog.querySelector('.ts-export-copy');
        filters.addEventListener('change', () => { copy.disabled = !filters.querySelector('input:checked'); });
        copy.addEventListener('click', async () => {
            const status = exportDialog.querySelector('.ts-export-status');
            try {
                await navigator.clipboard.writeText(tabular(activeExportPanel.list.entries, [...filters.querySelectorAll('input:checked')].map(i => i.value), activeExportPanel.list.duration_ms));
                exportDialog.close(); activeExportPanel.error('Tabulka zkopírována.');
            } catch (e) { status.textContent = 'Kopírování se nezdařilo. Použijte export TXT.'; }
        });
        exportDialog.querySelectorAll('.ts-export-close').forEach(close => close.addEventListener('click', () => exportDialog.close()));
        exportDialog.querySelector('.ts-export-download').addEventListener('click', () => exportDialog.close());
        exportDialog.querySelector('.ts-export-mp3splt-download').addEventListener('click', () => {
            const status = exportDialog.querySelector('.ts-export-status');
            const result = mp3spltLabels(activeExportPanel.list.entries, activeExportPanel.list.source_filename, activeExportPanel.list.duration_ms);
            if (!result.text) { status.textContent = 'Nejsou žádné kompletní výstřižky k exportu.'; return; }
            const url = URL.createObjectURL(new Blob([result.text], { type: 'text/plain;charset=utf-8' }));
            const download = el('a'); download.href = url; download.download = result.filename;
            document.body.append(download); download.click(); download.remove(); setTimeout(() => URL.revokeObjectURL(url), 0);
            if (result.incomplete) status.textContent = 'Některé výstřižky nebylo možné exportovat, protože nemají kompletní začátek a konec.';
            else exportDialog.close();
        });
        exportDialog.addEventListener('click', e => {
            const box = exportDialog.getBoundingClientRect();
            if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) exportDialog.close();
        });
        document.body.append(exportDialog);
    }
    function openExport(panel) {
        ensureExportDialog(); activeExportPanel = panel;
        exportDialog.querySelectorAll('.ts-filters input').forEach(input => { input.checked = input.value !== 'note'; });
        exportDialog.querySelector('.ts-export-copy').disabled = false;
        exportDialog.querySelector('.ts-export-status').textContent = '';
        exportDialog.querySelector('.ts-export-download').href = 'php/ajax/vz2_timestamps.php?action=export&recording_id=' + encodeURIComponent(panel.id);
        exportDialog.showModal(); exportDialog.querySelector('.ts-export-copy').focus();
    }
    function openIntervalEditor(panel, kind, item = null, finish = false, draft = {}) {
        return root.Vz2TimestampEditor.open({ recording_id: panel.id, kind, item_id: item?.id,
            adapter: panel.adapter, finish, draft, list: panel.list }).catch(e => panel.error(e.message));
    }
    api.openIntervalEditor = openIntervalEditor;
    api.edit = options => root.Vz2TimestampEditor.open(options);
    api.mount = function (container, id, adapter) {
        const shell = el('details'); shell.className = 'vz2-timestamps';
        const summary = el('summary'), heading = el('span', 'Časové značky'), chevron = el('i');
        summary.className = 'ts-summary'; heading.className = 'ts-heading';
        chevron.className = 'ti ti-chevron-right'; chevron.setAttribute('aria-hidden', 'true');
        summary.append(heading, chevron);
        const content = el('div'), status = el('p'), toolbar = el('div'), list = el('ol');
        content.className = 'ts-content'; toolbar.className = 'toolbar';
        status.setAttribute('role', 'status'); status.className = 'error';
        const add = button('Přidat značku', () => openEditor(panel, null)); add.disabled = true;
        const quickUp = button('👍', () => quickNote(panel, '👍'));
        const quickDown = button('👎', () => quickNote(panel, '👎'));
        for (const [control, label] of [[quickUp, 'Přidat poznámku: palec nahoru'], [quickDown, 'Přidat poznámku: palec dolů']]) {
            control.className = 'ts-quick-note'; control.title = label; control.setAttribute('aria-label', label); control.disabled = true;
        }
        const reload = iconButton('Obnovit značky', 'refresh', () => panel.load());
        const stop = button('Vypnout smyčku', api.stopLoop); stop.hidden = true;
        const exportButton = button('Export', () => openExport(panel)); exportButton.disabled = true;
        toolbar.append(add, quickUp, quickDown, reload, stop, exportButton); content.append(status, toolbar, list); shell.append(summary, content); container.append(shell);
        let mobileActions, mobileAdd, mobileQuickUp, mobileQuickDown, mobileExport, mobileToggle, resizeObserver, playerObserver, mobileMedia;
        const mixerPanel = container.id === 'mixer-timestamps';
        const pinnedOpen = () => container.id === 'looper-timestamps' && mobileMedia?.matches
            && document.getElementById('player-shell').classList.contains('player-fullscreen');
        const positionDrawer = () => {
            if (pinnedOpen()) {
                shell.open = true;
                if (reload.parentElement !== mobileActions) mobileAdd.after(reload);
            } else if (reload.parentElement !== toolbar) quickDown.after(reload);
            if (mobileActions && mobileMedia.matches) container.style.setProperty('--ts-drawer-top', mobileActions.getBoundingClientRect().bottom + 8 + 'px');
            Notes.reposition(panel);
        };
        const toggleDrawer = open => {
            if (pinnedOpen()) return;
            if (open && container.id === 'mixer-timestamps') {
                const mixToggle = document.getElementById('mt-mixer-toggle');
                if (mixToggle?.getAttribute('aria-expanded') === 'true') mixToggle.click();
            }
            container.classList.toggle('ts-drawer-open', open);
            mobileToggle.textContent = mixerPanel ? 'Časové značky' : (open ? 'Zavřít' : 'Otevřít') + ' časové značky';
            if (mixerPanel) mobileToggle.setAttribute('aria-label', (open ? 'Zavřít' : 'Otevřít') + ' časové značky');
            mobileToggle.setAttribute('aria-expanded', String(open));
            if (open) { shell.open = true; positionDrawer(); }
        };
        const onDrawerKey = e => {
            if (e.key === 'Escape' && !pinnedOpen() && container.classList.contains('ts-drawer-open') && !Notes.isOpen() && !exportDialog?.open) {
                toggleDrawer(false); mobileToggle.focus();
            }
        };
        const onMobileChange = () => { toggleDrawer(false); positionDrawer(); };
        if (container.id === 'looper-timestamps' || container.id === 'mixer-timestamps') {
            mobileMedia = matchMedia('(max-width: 767px)');
            mobileActions = el('div'); mobileActions.className = 'looper-timestamp-actions';
            mobileToggle = button(mixerPanel ? 'Časové značky' : 'Otevřít časové značky', () => toggleDrawer(!container.classList.contains('ts-drawer-open')));
            if (mixerPanel) mobileToggle.setAttribute('aria-label', 'Otevřít časové značky');
            mobileToggle.setAttribute('aria-expanded', 'false'); mobileToggle.setAttribute('aria-controls', container.id);
            mobileAdd = button('Přidat značku', () => openEditor(panel, null)); mobileAdd.disabled = true;
            mobileQuickUp = button('👍', () => quickNote(panel, '👍'));
            mobileQuickDown = button('👎', () => quickNote(panel, '👎'));
            for (const [control, label] of [[mobileQuickUp, 'Přidat poznámku: palec nahoru'], [mobileQuickDown, 'Přidat poznámku: palec dolů']]) {
                control.className = 'ts-quick-note'; control.title = label; control.setAttribute('aria-label', label); control.disabled = true;
            }
            if (!mixerPanel) { mobileExport = button('Export', () => openExport(panel)); mobileExport.disabled = true; }
            add.classList.add('ts-desktop-action'); quickUp.classList.add('ts-desktop-action'); quickDown.classList.add('ts-desktop-action'); exportButton.classList.add('ts-desktop-action');
            mobileActions.append(mobileToggle, mobileAdd, mobileQuickUp, mobileQuickDown);
            if (mobileExport) mobileActions.append(mobileExport);
            if (mixerPanel) document.getElementById('mixer-action-row').append(mobileActions);
            else container.before(mobileActions);
            document.dispatchEvent(new Event('vz2:timestamp-actions-changed'));
            resizeObserver = new ResizeObserver(positionDrawer);
            resizeObserver.observe(document.getElementById('player-shell')); resizeObserver.observe(mobileActions);
            playerObserver = new MutationObserver(positionDrawer);
            playerObserver.observe(document.getElementById('player-shell'), { attributes: true, attributeFilter: ['class'] });
            mobileMedia.addEventListener('change', onMobileChange);
            window.addEventListener('resize', positionDrawer); document.addEventListener('keydown', onDrawerKey);
        }
        const panel = { id, adapter, container, shell, containerId: container.id, inlineHost: mobileActions || shell, pinnedOpen,
            export: () => openExport(panel),
            drawerOpen: mobileActions ? () => container.classList.contains('ts-drawer-open') : null,
            closeDrawer: mobileActions ? () => toggleDrawer(false) : null,
            openDrawer: mobileActions ? () => toggleDrawer(true) : null,
            list: null, dead: false, quickBusy: false, quickButtons: [quickUp, quickDown, mobileQuickUp, mobileQuickDown].filter(Boolean), error: text => { status.textContent = text; },
            update(value) {
                if (this.list && value.timestamps_revision < this.list.timestamps_revision) return;
                this.list = value; list.replaceChildren(); add.hidden = !value.can_create; add.disabled = !value.can_create; exportButton.disabled = false;
                for (const control of [quickUp, quickDown]) { control.hidden = !value.can_create; control.disabled = !value.can_create || this.quickBusy; }
                if (mobileActions) {
                    mobileAdd.hidden = !value.can_create; mobileAdd.disabled = !value.can_create;
                    if (mobileExport) mobileExport.disabled = false;
                    for (const control of [mobileQuickUp, mobileQuickDown]) { control.hidden = !value.can_create; control.disabled = !value.can_create || this.quickBusy; }
                }
                if (!value.entries.length) list.append(el('li', 'Zatím žádné časové značky.'));
                Model.items(value).forEach(annotation => {
                    const row = annotation.source;
                    const item = el('li'); item.className = 'ts-' + row.kind; item.dataset.annotationId = annotation.id;
                    item.classList.toggle('ts-selected', Store.selection()?.recording_id === Number(id) && Store.selection()?.item_id === annotation.id);
                    item.addEventListener('click', () => Store.select({ recording_id: id, item_id: annotation.id }));
                    const songInterval = songIntervalFor(row, value.entries);
                    if (songInterval) {
                        item.classList.add('ts-song-linked'); item.dataset.songStartId = songInterval.start.id;
                        if (Number(row.id) === Number(songInterval.start.id)) item.classList.add('ts-song-linked-start');
                        else if (Number(row.id) === Number(songInterval.end.id)) item.classList.add('ts-song-linked-end');
                        else item.classList.add('ts-song-linked-inside');
                    }
                    const seek = button(compactFormat(row.time_ms), async () => {
                        try { api.stopLoop(); await this.adapter.playRange(row.time_ms); }
                        catch (e) { status.textContent = e.message; }
                    }); seek.className = 'ts-time'; seek.title = 'Přehrát od ' + format(row.time_ms); seek.dataset.playback = 'seek'; seek.dataset.endMs = row.time_ms;
                    const text = el('p', annotation.label), authors = el('small', row.author + (row.updated_by !== row.created_by || row.revision > 1 ? ' · upravil/a ' + row.editor : ''));
                    const boundary = row.kind === 'song_start' || row.kind === 'song_end' ? boundaryIcon(row.kind) : null;
                    // Older empty boundaries store an arrow as their body; show the type icon once.
                    if (annotation.song_title) text.append(' · ' + annotation.song_title);
                    if (annotation.passage_type) text.append(' ', el('small', Model.passageTypes[annotation.passage_type]));
                    if (annotation.note_text) text.append(el('br'), document.createTextNode(annotation.note_text));
                    const endText = annotation.end_source?.body?.replace(/^[↑↓]$/, '');
                    if (endText && endText !== annotation.label) text.append(el('br'), document.createTextNode('Konec: ' + endText));
                    if (annotation.end_source && annotation.end_source.created_by !== row.created_by) authors.append(' · konec: ' + annotation.end_source.author);
                    authors.className = 'ts-author vz2-attribution';
                    authors.title = 'Vytvořeno: ' + new Date(row.created_at.replace(' ', 'T') + 'Z').toLocaleString('cs-CZ') + ' · upraveno: ' + new Date(row.updated_at.replace(' ', 'T') + 'Z').toLocaleString('cs-CZ');
                    const actions = el('div'); actions.className = 'toolbar';
                    const end = annotation.end_ms;
                    if (end !== null) seek.textContent += ' – ' + compactFormat(end);
                    if (row.kind !== 'note' && row.kind !== 'song_end') {
                        const repeat = iconButton('Smyčka', 'repeat', async () => {
                            try { await Playback.play(this.adapter, annotation, { repeat: true, owner: this, onError: this.error }); }
                            catch (e) { status.textContent = e.message; }
                        }); repeat.dataset.playback = end == null ? 'unknown' : 'loop';
                        if (end != null) repeat.dataset.endMs = end;
                        repeat.title = end == null ? 'Konec úseku není známý.' : format(row.time_ms) + ' – ' + format(end); actions.append(repeat);
                    }
                    const interval = ['take', 'passage'].includes(annotation.kind);
                    if (annotation.can_edit) {
                        actions.append(iconButton('Upravit', 'pencil', () => interval ? openIntervalEditor(this, annotation.kind, annotation) : openEditor(this, row)));
                        if (interval && end === null) actions.append(iconButton(annotation.kind === 'take' ? 'Ukončit pokus' : 'Ukončit pasáž', 'flag-check', () => openIntervalEditor(this, annotation.kind, annotation, true)));
                    }
                    if (annotation.can_delete) actions.append(iconButton('Smazat', 'trash', async () => {
                        if (!confirm('Smazat tuto časovou značku?\n' + row.body)) return;
                        try { const result = await Store.remove(id, annotation, value.timestamps_revision); publish(result); status.textContent = 'Značka odstraněna.'; }
                        catch (e) { status.textContent = e.message; }
                    }));
                    if (interval && end === null) text.append(' ', el('small', '— Doplnit konec'));
                    if (row.kind === 'song_end' && !row.paired_timestamp_id) text.append(' ', el('small', '— konec bez začátku'));
                    const rowMain = el('div'); rowMain.className = 'ts-row-main';
                    rowMain.append(seek);
                    if (boundary) rowMain.append(boundary);
                    rowMain.append(text, authors, actions); item.append(rowMain); list.append(item);
                }); this.playback();
                if (typeof this.adapter?.timestampsChanged === 'function') this.adapter.timestampsChanged(value.entries);
            },
            playback() {
                const duration = this.adapter?.durationMs();
                shell.querySelectorAll('[data-playback]').forEach(b => b.disabled = b.dataset.playback === 'unknown' || !this.adapter?.canPlay()
                    || (duration != null && Number(b.dataset.endMs) > duration));
                stop.hidden = Playback.state()?.owner !== this;
            },
            async load() { reload.disabled = true; try { const value = await request(id); if (!this.dead) { publish(value); status.textContent = ''; } } catch (e) { status.textContent = e.message; } finally { reload.disabled = false; } },
            destroy() {
                this.dead = true; panels.delete(this); if (Playback.state()?.owner === this) api.stopLoop(); shell.remove();
                Notes.detach(this);
                resizeObserver?.disconnect(); playerObserver?.disconnect(); mobileMedia?.removeEventListener('change', onMobileChange);
                window.removeEventListener('resize', positionDrawer); document.removeEventListener('keydown', onDrawerKey);
                mobileActions?.remove(); container.classList.remove('ts-drawer-open'); container.style.removeProperty('--ts-drawer-top');
                document.dispatchEvent(new Event('vz2:timestamp-actions-changed'));
            }
        };
        Notes.attach(panel);
        positionDrawer();
        panel.container = container; panels.add(panel); panel.load(); return panel;
    };
    setInterval(() => panels.forEach(p => p.playback()), 500);
}(typeof window !== 'undefined' ? window : globalThis));
