(function (root) {
    'use strict';
    const kinds = { song_start: '♪ Začátek skladby', song_end: '■ Konec skladby', passage: '↔ Pasáž', note: '● Poznámka' };
    function format(ms) {
        ms = Math.max(0, Math.round(Number(ms) || 0));
        return [Math.floor(ms / 3600000), Math.floor(ms / 60000) % 60, Math.floor(ms / 1000) % 60]
            .map(n => String(n).padStart(2, '0')).join(':') + '.' + String(ms % 1000).padStart(3, '0');
    }
    function parse(text) {
        const m = /^(?:(\d+):)?(\d+):(\d{2})(?:[.,](\d{1,3}))?$/.exec(text.trim());
        const hasHours = !!m?.[1];
        if (!m || Number(m[3]) > 59 || (hasHours && Number(m[2]) > 59)) throw new Error('Čas zadejte jako mm:ss nebo hh:mm:ss.');
        const minutes = Number(m[2]) + (hasHours ? Number(m[1]) * 60 : 0);
        const ms = (minutes * 60 + Number(m[3])) * 1000 + Number((m[4] || '').padEnd(3, '0'));
        if (!Number.isSafeInteger(ms) || ms > 604800000) throw new Error('Nejvyšší čas je 7 dní.');
        return ms;
    }
    function compactFormat(ms) {
        const seconds = Math.floor(Math.max(0, Number(ms) || 0) / 1000);
        return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
    }
    function adjust(text, delta) {
        return format(parse(text) + Number(delta));
    }
    function timestampBody(kind, body) {
        body = body.trim();
        if (body) return body;
        if (kind === 'song_start') return 'začátek';
        if (kind === 'song_end') return 'konec';
        throw new Error('U pasáže a poznámky vyplňte text.');
    }
    function songIntervalFor(entry, entries) {
        const time = Number(entry.time_ms);
        return entries.filter(end => end.kind === 'song_end' && end.paired_timestamp_id).map(end => {
            const start = entries.find(candidate => candidate.kind === 'song_start' && Number(candidate.id) === Number(end.paired_timestamp_id));
            return start && Number(end.time_ms) >= Number(start.time_ms) ? { start, end } : null;
        }).filter(interval => interval && time >= Number(interval.start.time_ms) && time <= Number(interval.end.time_ms))
            .sort((a, b) => (Number(a.end.time_ms) - Number(a.start.time_ms)) - (Number(b.end.time_ms) - Number(b.start.time_ms)))[0] || null;
    }
    function endOf(entry, entries, duration) {
        if (entry.kind === 'note') return null;
        if (entry.kind === 'song_start') {
            const paired = entries.find(t => t.kind === 'song_end' && Number(t.paired_timestamp_id) === Number(entry.id));
            return paired && Number(paired.time_ms) > Number(entry.time_ms) ? Number(paired.time_ms) : null;
        }
        if (entry.kind === 'song_end') return null;
        const next = entries.filter(t => Number(t.time_ms) > Number(entry.time_ms)
            && (t.kind === 'song_start' || (entry.kind === 'passage' && t.kind === 'passage')))
            .sort((a, b) => Number(a.time_ms) - Number(b.time_ms) || Number(a.id) - Number(b.id))[0];
        const end = next ? Number(next.time_ms) : duration == null ? null : Number(duration);
        return end > Number(entry.time_ms) ? end : null;
    }
    function tabular(entries, selected) {
        return entries.filter(t => selected.includes(t.kind)).map(t => format(t.time_ms) + '\t'
            + t.body.replace(/[\t\r\n]+/g, ' ')).join('\n');
    }
    function filenameBase(filename) {
        const name = String(filename || '').split(/[\\/]/).pop() || 'nahravka';
        return name.replace(/\.[^.]*$/, '') || 'nahravka';
    }
    function safeClipName(name) {
        return String(name || '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
    }
    function mp3spltLabels(entries, sourceFilename) {
        const byId = new Map(entries.map(entry => [Number(entry.id), entry]));
        const pairedStarts = new Set();
        let incomplete = 0;
        const clips = [];
        entries.forEach(end => {
            if (end.kind !== 'song_end') return;
            const start = end.paired_timestamp_id == null ? null : byId.get(Number(end.paired_timestamp_id));
            if (!start || start.kind !== 'song_start' || Number(end.time_ms) <= Number(start.time_ms)) { incomplete++; return; }
            pairedStarts.add(Number(start.id));
            const seconds = Math.floor(Math.max(0, Number(start.time_ms) || 0) / 1000);
            const fallback = filenameBase(sourceFilename) + '_' + [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
                .map(value => String(value).padStart(2, '0')).join('-');
            clips.push({ start: Number(start.time_ms), end: Number(end.time_ms), name: safeClipName(start.body) || safeClipName(fallback) });
        });
        entries.forEach(start => { if (start.kind === 'song_start' && !pairedStarts.has(Number(start.id))) incomplete++; });
        clips.sort((a, b) => a.start - b.start);
        return {
            filename: filenameBase(sourceFilename) + '.txt', incomplete,
            text: clips.map(clip => (clip.start / 1000).toFixed(3) + '\t' + (clip.end / 1000).toFixed(3) + '\t' + clip.name).join('\n')
        };
    }
    const api = { format, compactFormat, parse, adjust, timestampBody, songIntervalFor, endOf, tabular, filenameBase, safeClipName, mp3spltLabels };
    if (typeof module !== 'undefined') module.exports = api;
    if (!root.document) return;
    root.Vz2Timestamps = api;
    const panels = new Set();
    let preferences = { kind: 'note', keep: false };
    try { const saved = JSON.parse(localStorage.getItem(root.VZ2.cachePrefix + 'timestamp-preferences')); if (saved && kinds[saved.kind]) preferences = { kind: saved.kind, keep: saved.keep === true }; } catch (_) { /* optional preference */ }
    let editor, exportDialog, activeEditor, activeExportPanel, loop, loopBusy = false, loopSerial = 0;
    const el = (tag, text) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; return n; };
    const button = (text, fn) => { const b = el('button', text); b.type = 'button'; b.addEventListener('click', fn); return b; };
    const iconButton = (label, icon, fn) => {
        const b = button('', fn), i = el('i');
        b.className = 'ts-action'; b.title = label; b.setAttribute('aria-label', label);
        i.className = 'ti ti-' + icon; i.setAttribute('aria-hidden', 'true'); b.append(i);
        return b;
    };
    async function request(id, fields) {
        const r = await fetch('php/ajax/vz2_timestamps.php' + (fields ? '' : '?recording_id=' + encodeURIComponent(id)), {
            method: fields ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
            headers: fields ? { 'Content-Type': 'application/json', 'X-CSRF-Token': root.VZ2.csrf } : {},
            body: fields ? JSON.stringify({ ...fields, recording_id: Number(id) }) : undefined
        });
        let result;
        try { result = await r.json(); } catch (_) { throw new Error('Odpověď nelze načíst. Ověřte připojení a přihlášení.'); }
        if (!r.ok || !result.ok) { const e = new Error(result.error || 'Značky nelze načíst.'); e.status = r.status; throw e; }
        return result;
    }
    function publish(list) { panels.forEach(p => { if (Number(p.id) === list.recording_id) p.update(list); }); }
    api.stopLoop = function () { ++loopSerial; loop = null; panels.forEach(p => p.playback()); };
    // Same interval semantics for HTML media and WebAudio; no second timestamp store.
    setInterval(async () => {
        if (!loop || loopBusy) return;
        const current = loop;
        if (!current.adapter.canPlay()) { api.stopLoop(); return; }
        if (current.adapter.currentTimeMs() >= current.end) {
            loopBusy = true;
            try { await current.adapter.playRange(current.start, current.end); }
            catch (e) { if (loop === current) api.stopLoop(); current.panel.error(e.message); }
            finally { loopBusy = false; }
        }
    }, 25);
    function ensureEditor() {
        if (editor) return;
        editor = el('dialog'); editor.className = 'vz2-timestamp-editor';
        editor.innerHTML = '<form><div class="ts-editor-top"><p class="ts-context"></p><button type="button" class="ts-close modal-close" aria-label="Zavřít časovou značku" title="Zavřít">×</button></div><div class="ts-editor-body"><div class="ts-time-row"><input name="time" required inputmode="numeric" aria-label="Čas ve formátu minuty a sekundy"><button type="button" class="ts-time-current">Aktualizovat</button><button type="button" class="ts-time-adjust" data-delta="-1000" aria-label="Odečíst jednu sekundu">−</button><button type="button" class="ts-time-adjust" data-delta="1000" aria-label="Přičíst jednu sekundu">+</button></div><label class="ts-body"><span class="visually-hidden">Text</span><input name="body" aria-label="Text časové značky" placeholder="Text"></label><label class="ts-pair">Propojený začátek pro konec skladby<select name="paired_timestamp_id"><option value="">Bez propojení</option></select></label><div class="ts-editor-options"><label class="ts-keep"><input type="checkbox" name="keep"> Ponechat otevřené</label><label class="ts-return"><input type="checkbox" name="return_position"> Vrátit na čas</label></div><p role="alert" class="error"></p><pre class="ts-current" hidden></pre></div><div class="ts-editor-footer"><button type="submit" name="kind" value="song_start">Začátek</button><button type="submit" name="kind" value="song_end">Konec</button><button type="submit" name="kind" value="passage">Pasáž</button><button type="submit" name="kind" value="note">Poznámka</button><button type="button" class="ts-rebase" hidden>Načíst aktuální verzi k porovnání</button></div></form>';
        const form = editor.querySelector('form');
        editor.addEventListener('cancel', e => { if (activeEditor?.busy) e.preventDefault(); });
        editor.querySelectorAll('.ts-close').forEach(close => { close.onclick = () => editor.close(); });
        editor.querySelector('.ts-time-current').onclick = () => {
            const ms = activeEditor?.panel.adapter?.currentTimeMs();
            if (Number.isFinite(ms)) form.elements.time.value = compactFormat(ms);
        };
        editor.querySelectorAll('.ts-time-adjust').forEach(control => { control.onclick = () => {
            try { form.elements.time.value = compactFormat(parse(form.elements.time.value) + Number(control.dataset.delta)); }
            catch (e) { editor.querySelector('.error').textContent = e.message; }
        }; });
        editor.querySelector('.ts-rebase').onclick = async () => {
            const context = activeEditor;
            try {
                const latest = await request(context.panel.id); publish(latest);
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
        form.addEventListener('submit', async e => {
            e.preventDefault(); const context = activeEditor;
            context.busy = true;
            const controls = [...form.querySelectorAll('button')]; controls.forEach(b => b.disabled = true);
            try {
                const ms = parse(form.elements.time.value);
                const fields = { action: context.row ? 'update' : 'create', timestamps_revision: context.revision,
                    kind: e.submitter.value, time_ms: ms,
                    body: timestampBody(e.submitter.value, form.elements.body.value) };
                if (fields.kind === 'song_end') fields.paired_timestamp_id = form.elements.paired_timestamp_id.value ? Number(form.elements.paired_timestamp_id.value) : null;
                if (context.row) { fields.id = context.row.id; fields.revision = context.row.revision; }
                const result = await request(context.panel.id, fields); publish(result);
                if (!context.row) {
                    preferences = { kind: fields.kind, keep: form.elements.keep.checked };
                    try { localStorage.setItem(root.VZ2.cachePrefix + 'timestamp-preferences', JSON.stringify(preferences)); } catch (_) { /* optional preference */ }
                }
                context.revision = result.timestamps_revision;
                // Only rewind after successful commit, and only the original recording.
                if (form.elements.return_position.checked && context.panel.adapter?.canPlay()) context.panel.adapter.seek(ms);
                editor.querySelector('.error').textContent = '';
                if (form.elements.keep.checked && !context.row) {
                    form.elements.body.value = ''; form.elements.time.value = compactFormat(context.panel.adapter?.currentTimeMs() ?? ms); form.elements.body.focus();
                } else editor.close();
            } catch (err) { editor.querySelector('.error').textContent = err.message; editor.querySelector('.ts-rebase').hidden = err.status !== 409; }
            finally { context.busy = false; controls.forEach(b => b.disabled = false); form.elements.return_position.disabled = !context.panel.adapter?.canPlay(); }
        });
        document.body.append(editor);
    }
    function openEditor(panel, row) {
        ensureEditor();
        activeEditor = { panel, row, revision: panel.list.timestamps_revision };
        const f = editor.querySelector('form');
        f.elements.time.value = compactFormat(row?.time_ms ?? panel.adapter?.currentTimeMs() ?? 0);
        f.elements.body.value = row?.body || ''; f.elements.keep.checked = !row && preferences.keep;
        const pair = f.elements.paired_timestamp_id; pair.replaceChildren(new Option('Bez propojení', ''));
        const used = new Set(panel.list.entries.filter(t => t.kind === 'song_end' && t.id !== row?.id && t.paired_timestamp_id).map(t => Number(t.paired_timestamp_id)));
        panel.list.entries.filter(t => t.kind === 'song_start' && !used.has(Number(t.id))).forEach(t => pair.add(new Option(format(t.time_ms) + ' · ' + t.body, String(t.id))));
        pair.value = row?.paired_timestamp_id ? String(row.paired_timestamp_id) : '';
        editor.querySelector('.ts-keep').hidden = !!row;
        editor.querySelector('.ts-context').textContent = panel.list.title;
        editor.querySelector('.error').textContent = ''; editor.querySelector('.ts-current').hidden = true;
        editor.querySelector('.ts-rebase').hidden = true;
        editor.querySelector('.ts-time-current').disabled = !panel.adapter?.canPlay();
        f.elements.return_position.checked = false;
        f.elements.return_position.disabled = !panel.adapter?.canPlay();
        editor.showModal(); f.elements.body.focus();
    }
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
                await navigator.clipboard.writeText(tabular(activeExportPanel.list.entries, [...filters.querySelectorAll('input:checked')].map(i => i.value)));
                exportDialog.close(); activeExportPanel.error('Tabulka zkopírována.');
            } catch (e) { status.textContent = 'Kopírování se nezdařilo. Použijte export TXT.'; }
        });
        exportDialog.querySelectorAll('.ts-export-close').forEach(close => close.addEventListener('click', () => exportDialog.close()));
        exportDialog.querySelector('.ts-export-download').addEventListener('click', () => exportDialog.close());
        exportDialog.querySelector('.ts-export-mp3splt-download').addEventListener('click', () => {
            const status = exportDialog.querySelector('.ts-export-status');
            const result = mp3spltLabels(activeExportPanel.list.entries, activeExportPanel.list.source_filename);
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
    window.addEventListener('beforeunload', e => { if (editor?.open) { e.preventDefault(); e.returnValue = ''; } });
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
        const reload = iconButton('Obnovit značky', 'refresh', () => panel.load());
        const stop = button('Vypnout smyčku', api.stopLoop); stop.hidden = true;
        const exportButton = button('Export', () => openExport(panel)); exportButton.disabled = true;
        toolbar.append(add, reload, stop, exportButton); content.append(status, list, toolbar); shell.append(summary, content); container.append(shell);
        let mobileActions, mobileAdd, mobileExport, mobileToggle, resizeObserver, mobileMedia;
        const positionDrawer = () => {
            if (mobileActions && mobileMedia.matches) container.style.setProperty('--ts-drawer-top', mobileActions.getBoundingClientRect().bottom + 8 + 'px');
        };
        const toggleDrawer = open => {
            container.classList.toggle('ts-drawer-open', open);
            mobileToggle.textContent = (open ? 'Zavřít' : 'Otevřít') + ' časové značky';
            mobileToggle.setAttribute('aria-expanded', String(open));
            if (open) { shell.open = true; positionDrawer(); }
        };
        const onDrawerKey = e => {
            if (e.key === 'Escape' && container.classList.contains('ts-drawer-open') && !editor?.open && !exportDialog?.open) {
                toggleDrawer(false); mobileToggle.focus();
            }
        };
        const onMobileChange = () => { toggleDrawer(false); positionDrawer(); };
        if (container.id === 'looper-timestamps') {
            mobileMedia = matchMedia('(max-width: 767px)');
            mobileActions = el('div'); mobileActions.className = 'looper-timestamp-actions';
            mobileToggle = button('Otevřít časové značky', () => toggleDrawer(!container.classList.contains('ts-drawer-open')));
            mobileToggle.setAttribute('aria-expanded', 'false'); mobileToggle.setAttribute('aria-controls', container.id);
            mobileAdd = button('Přidat značku', () => openEditor(panel, null)); mobileAdd.disabled = true;
            mobileExport = button('Export', () => openExport(panel)); mobileExport.disabled = true;
            add.classList.add('ts-desktop-action'); exportButton.classList.add('ts-desktop-action');
            mobileActions.append(mobileToggle, mobileAdd, mobileExport); container.before(mobileActions);
            resizeObserver = new ResizeObserver(positionDrawer);
            resizeObserver.observe(document.getElementById('player-shell')); resizeObserver.observe(mobileActions);
            mobileMedia.addEventListener('change', onMobileChange);
            window.addEventListener('resize', positionDrawer); document.addEventListener('keydown', onDrawerKey);
        }
        const panel = { id, adapter, list: null, dead: false, error: text => { status.textContent = text; },
            update(value) {
                if (this.list && value.timestamps_revision < this.list.timestamps_revision) return;
                this.list = value; list.replaceChildren(); add.hidden = !value.can_create; add.disabled = false; exportButton.disabled = false;
                if (mobileActions) { mobileAdd.hidden = !value.can_create; mobileAdd.disabled = false; mobileExport.disabled = false; }
                if (loop?.panel === this) api.stopLoop();
                if (!value.entries.length) list.append(el('li', 'Zatím žádné časové značky.'));
                value.entries.forEach(row => {
                    const item = el('li'); item.className = 'ts-' + row.kind;
                    const songInterval = songIntervalFor(row, value.entries);
                    if (songInterval) {
                        item.classList.add('ts-song-linked'); item.dataset.songStartId = songInterval.start.id;
                        if (Number(row.id) === Number(songInterval.start.id)) item.classList.add('ts-song-linked-start');
                        else if (Number(row.id) === Number(songInterval.end.id)) item.classList.add('ts-song-linked-end');
                        else item.classList.add('ts-song-linked-inside');
                    }
                    const seek = button(compactFormat(row.time_ms), () => { api.stopLoop(); this.adapter.seek(row.time_ms); }); seek.className = 'ts-time'; seek.title = 'Přejít na ' + format(row.time_ms); seek.dataset.playback = 'seek'; seek.dataset.endMs = row.time_ms;
                    const text = el('p', row.body), authors = el('small', row.author + (row.updated_by !== row.created_by || row.revision > 1 ? ' · upravil/a ' + row.editor : ''));
                    authors.className = 'ts-author vz2-attribution';
                    authors.title = 'Vytvořeno: ' + new Date(row.created_at.replace(' ', 'T') + 'Z').toLocaleString('cs-CZ') + ' · upraveno: ' + new Date(row.updated_at.replace(' ', 'T') + 'Z').toLocaleString('cs-CZ');
                    const actions = el('div'); actions.className = 'toolbar';
                    const end = endOf(row, value.entries, value.duration_ms);
                    if (row.kind !== 'note' && row.kind !== 'song_end') {
                        const repeat = iconButton('Smyčka', 'repeat', async () => {
                            try { api.stopLoop(); const token = loopSerial; await this.adapter.playRange(row.time_ms, end); if (token !== loopSerial || this.dead) return; loop = { panel: this, adapter: this.adapter, start: row.time_ms, end }; this.playback(); }
                            catch (e) { status.textContent = e.message; }
                        }); repeat.dataset.playback = end == null ? 'unknown' : 'loop';
                        if (end != null) repeat.dataset.endMs = end;
                        repeat.title = end == null ? 'Konec úseku není známý.' : format(row.time_ms) + ' – ' + format(end); actions.append(repeat);
                    }
                    if (row.can_edit) actions.append(iconButton('Upravit', 'pencil', () => openEditor(this, row)));
                    if (row.can_delete) actions.append(iconButton('Smazat', 'trash', async () => {
                        if (!confirm('Smazat tuto časovou značku?\n' + row.body)) return;
                        try { const result = await request(id, { action: 'delete', id: row.id, revision: row.revision, timestamps_revision: value.timestamps_revision }); publish(result); status.textContent = 'Značka odstraněna.'; }
                        catch (e) { status.textContent = e.message; }
                    }));
                    if (row.kind === 'song_start' && end == null) text.append(' ', el('small', '— neúplný úsek'));
                    if (row.kind === 'song_end' && !row.paired_timestamp_id) text.append(' ', el('small', '— konec bez začátku'));
                    item.append(seek, text, authors, actions); list.append(item);
                }); this.playback();
                if (typeof this.adapter?.timestampsChanged === 'function') this.adapter.timestampsChanged(value.entries);
            },
            playback() {
                const duration = this.adapter?.durationMs();
                shell.querySelectorAll('[data-playback]').forEach(b => b.disabled = b.dataset.playback === 'unknown' || !this.adapter?.canPlay()
                    || (duration != null && Number(b.dataset.endMs) > duration));
                stop.hidden = loop?.panel !== this;
            },
            async load() { reload.disabled = true; try { const value = await request(id); if (!this.dead) { publish(value); status.textContent = ''; } } catch (e) { status.textContent = e.message; } finally { reload.disabled = false; } },
            destroy() {
                this.dead = true; panels.delete(this); if (loop?.panel === this) api.stopLoop(); shell.remove();
                resizeObserver?.disconnect(); mobileMedia?.removeEventListener('change', onMobileChange);
                window.removeEventListener('resize', positionDrawer); document.removeEventListener('keydown', onDrawerKey);
                mobileActions?.remove(); container.classList.remove('ts-drawer-open'); container.style.removeProperty('--ts-drawer-top');
            }
        };
        panels.add(panel); panel.load(); return panel;
    };
    setInterval(() => panels.forEach(p => p.playback()), 500);
}(typeof window !== 'undefined' ? window : globalThis));
