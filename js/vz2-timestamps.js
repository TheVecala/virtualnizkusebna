(function (root) {
    'use strict';
    const kinds = { song_start: '♪ Začátek skladby', passage: '↔ Pasáž', note: '● Poznámka' };
    function format(ms) {
        ms = Math.max(0, Math.round(Number(ms) || 0));
        return [Math.floor(ms / 3600000), Math.floor(ms / 60000) % 60, Math.floor(ms / 1000) % 60]
            .map(n => String(n).padStart(2, '0')).join(':') + '.' + String(ms % 1000).padStart(3, '0');
    }
    function parse(text) {
        const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?$/.exec(text.trim());
        if (!m || Number(m[2]) > 59 || Number(m[3]) > 59) throw new Error('Čas zadejte jako hh:mm:ss.mmm nebo mm:ss.mmm.');
        const ms = ((Number(m[1] || 0) * 60 + Number(m[2])) * 60 + Number(m[3])) * 1000 + Number((m[4] || '').padEnd(3, '0'));
        if (!Number.isSafeInteger(ms) || ms > 604800000) throw new Error('Nejvyšší čas je 7 dní.');
        return ms;
    }
    function compactFormat(ms) {
        const seconds = Math.floor(Math.max(0, Number(ms) || 0) / 1000);
        return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
    }
    function endOf(entry, entries, duration) {
        if (entry.kind === 'note') return null;
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
    const api = { format, compactFormat, parse, endOf, tabular };
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
        if (!r.ok || !result.ok) { const e = new Error(result.error || 'Zápisy nelze načíst.'); e.status = r.status; throw e; }
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
        editor.innerHTML = '<form><div class="dialog-header"><h2>Časový zápis</h2><button type="button" class="ts-close modal-close" aria-label="Zavřít časový zápis" title="Zavřít">×</button></div><p class="ts-context"></p><label>Typ<select name="kind"></select></label><label>Čas (hh:mm:ss.mmm)<input name="time" required></label><label>Text<textarea name="body" rows="5" required></textarea></label><label class="ts-keep"><input type="checkbox" name="keep"> Nechat otevřené pro další zápis</label><p role="alert" class="error"></p><pre class="ts-current" hidden></pre><div class="toolbar"><button type="submit">Uložit</button><button type="submit" name="return" value="yes">Uložit a vrátit na čas</button><button type="button" class="ts-rebase" hidden>Načíst aktuální verzi k porovnání</button></div></form>';
        const form = editor.querySelector('form');
        editor.addEventListener('cancel', e => { if (activeEditor?.busy) e.preventDefault(); });
        Object.entries(kinds).forEach(([value, text]) => { const o = el('option', text); o.value = value; form.elements.kind.append(o); });
        editor.querySelector('.ts-close').onclick = () => editor.close();
        editor.querySelector('.ts-rebase').onclick = async () => {
            const context = activeEditor;
            try {
                const latest = await request(context.panel.id); publish(latest);
                const current = context.row && latest.entries.find(t => t.id === context.row.id);
                const compare = editor.querySelector('.ts-current'); compare.hidden = false;
                compare.textContent = current ? 'Aktuální zápis: ' + format(current.time_ms) + ' · ' + kinds[current.kind] + '\n' + current.body + '\nUpravil/a: ' + current.editor : context.row ? 'Zápis byl mezitím odstraněn.' : 'Aktuální seznam byl načten. Rozepsaný text zůstává ve formuláři.';
                if (context.row && !current) return;
                if (!confirm('Aktuální zápisy jsou načtené. Použít jejich revizi pro další uložení vašeho rozepsaného textu?')) return;
                context.revision = latest.timestamps_revision; context.row = current || null;
                editor.querySelector('.error').textContent = 'Revize je aktuální. Zkontrolujte text a stiskněte Uložit.';
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
                    kind: form.elements.kind.value, time_ms: ms, body: form.elements.body.value };
                if (context.row) { fields.id = context.row.id; fields.revision = context.row.revision; }
                const result = await request(context.panel.id, fields); publish(result);
                if (!context.row) {
                    preferences = { kind: fields.kind, keep: form.elements.keep.checked };
                    try { localStorage.setItem(root.VZ2.cachePrefix + 'timestamp-preferences', JSON.stringify(preferences)); } catch (_) { /* optional preference */ }
                }
                context.revision = result.timestamps_revision;
                // Only rewind after successful commit, and only the original recording.
                if (e.submitter?.name === 'return' && context.panel.adapter?.canPlay()) context.panel.adapter.seek(ms);
                editor.querySelector('.error').textContent = '';
                if (form.elements.keep.checked && !context.row) {
                    form.elements.body.value = ''; form.elements.time.value = format(context.panel.adapter?.currentTimeMs() ?? ms); form.elements.body.focus();
                } else editor.close();
            } catch (err) { editor.querySelector('.error').textContent = err.message; editor.querySelector('.ts-rebase').hidden = err.status !== 409; }
            finally { context.busy = false; controls.forEach(b => b.disabled = false); form.elements.return.disabled = !context.panel.adapter?.canPlay(); }
        });
        document.body.append(editor);
    }
    function openEditor(panel, row) {
        ensureEditor();
        activeEditor = { panel, row, revision: panel.list.timestamps_revision };
        const f = editor.querySelector('form');
        f.elements.kind.value = row?.kind || preferences.kind; f.elements.time.value = format(row?.time_ms ?? panel.adapter?.currentTimeMs() ?? 0);
        f.elements.body.value = row?.body || ''; f.elements.keep.checked = !row && preferences.keep;
        editor.querySelector('.ts-keep').hidden = !!row;
        editor.querySelector('.ts-context').textContent = panel.list.title;
        editor.querySelector('.error').textContent = ''; editor.querySelector('.ts-current').hidden = true;
        editor.querySelector('.ts-rebase').hidden = true;
        f.elements.return.disabled = !panel.adapter?.canPlay();
        editor.showModal(); f.elements.body.focus();
    }
    function ensureExportDialog() {
        if (exportDialog) return;
        exportDialog = el('dialog'); exportDialog.className = 'vz2-timestamp-export';
        exportDialog.setAttribute('aria-labelledby', 'vz2-timestamp-export-title');
        exportDialog.innerHTML = '<div class="dialog-header"><h2 id="vz2-timestamp-export-title">Export timestampů</h2><button type="button" class="ts-export-close modal-close" aria-label="Zavřít export" title="Zavřít">×</button></div><div class="ts-export-options"><section class="ts-export-card ts-export-table"><div class="ts-export-heading"><i class="ti ti-table" aria-hidden="true"></i><div><h3>Export do tabulky</h3><p>Vyberte typy timestampů, které chcete zkopírovat.</p></div></div><fieldset class="ts-filters"><legend class="visually-hidden">Typy timestampů pro tabulku</legend></fieldset><button type="button" class="ts-export-copy"><i class="ti ti-copy" aria-hidden="true"></i> Kopírovat do schránky</button></section><section class="ts-export-card ts-export-text"><div class="ts-export-heading"><i class="ti ti-file-text" aria-hidden="true"></i><div><h3>Stažení textového souboru</h3><p>Stáhne všechny timestampy jako soubor TXT.</p></div></div><a class="ts-export-download" href=""><i class="ti ti-download" aria-hidden="true"></i> Stáhnout TXT</a></section></div><p class="ts-export-status error" role="alert"></p><div class="ts-export-footer"><button type="button" class="ts-export-close">Zavřít</button></div>';
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
        const summary = el('summary'), heading = el('span', 'Časové zápisy'), chevron = el('i');
        summary.className = 'ts-summary'; heading.className = 'ts-heading';
        chevron.className = 'ti ti-chevron-right'; chevron.setAttribute('aria-hidden', 'true');
        summary.append(heading, chevron);
        const content = el('div'), status = el('p'), toolbar = el('div'), list = el('ol');
        content.className = 'ts-content'; toolbar.className = 'toolbar';
        status.setAttribute('role', 'status'); status.className = 'error';
        const add = button('Přidat zápis', () => openEditor(panel, null)); add.disabled = true;
        const reload = iconButton('Obnovit zápisy', 'refresh', () => panel.load());
        const stop = button('Vypnout smyčku', api.stopLoop); stop.hidden = true;
        const exportButton = button('Export', () => openExport(panel)); exportButton.disabled = true;
        toolbar.append(add, reload, stop, exportButton); content.append(toolbar, status, list); shell.append(summary, content); container.append(shell);
        const panel = { id, adapter, list: null, dead: false, error: text => { status.textContent = text; },
            update(value) {
                if (this.list && value.timestamps_revision < this.list.timestamps_revision) return;
                this.list = value; list.replaceChildren(); add.hidden = !value.can_create; add.disabled = false; exportButton.disabled = false;
                if (loop?.panel === this) api.stopLoop();
                if (!value.entries.length) list.append(el('li', 'Zatím žádné časové zápisy.'));
                value.entries.forEach(row => {
                    const item = el('li'); item.className = 'ts-' + row.kind;
                    const seek = button(compactFormat(row.time_ms), () => { api.stopLoop(); this.adapter.seek(row.time_ms); }); seek.className = 'ts-time'; seek.title = 'Přejít na ' + format(row.time_ms); seek.dataset.playback = 'seek'; seek.dataset.endMs = row.time_ms;
                    const text = el('p', row.body), authors = el('small', row.author + (row.updated_by !== row.created_by || row.revision > 1 ? ' · upravil/a ' + row.editor : ''));
                    authors.className = 'ts-author';
                    authors.title = 'Vytvořeno: ' + new Date(row.created_at.replace(' ', 'T') + 'Z').toLocaleString('cs-CZ') + ' · upraveno: ' + new Date(row.updated_at.replace(' ', 'T') + 'Z').toLocaleString('cs-CZ');
                    const actions = el('div'); actions.className = 'toolbar';
                    const end = endOf(row, value.entries, value.duration_ms);
                    if (row.kind !== 'note') {
                        const repeat = iconButton('Smyčka', 'repeat', async () => {
                            try { api.stopLoop(); const token = loopSerial; await this.adapter.playRange(row.time_ms, end); if (token !== loopSerial || this.dead) return; loop = { panel: this, adapter: this.adapter, start: row.time_ms, end }; this.playback(); }
                            catch (e) { status.textContent = e.message; }
                        }); repeat.dataset.playback = end == null ? 'unknown' : 'loop';
                        if (end != null) repeat.dataset.endMs = end;
                        repeat.title = end == null ? 'Konec úseku není známý.' : format(row.time_ms) + ' – ' + format(end); actions.append(repeat);
                    }
                    if (row.can_edit) actions.append(iconButton('Upravit', 'pencil', () => openEditor(this, row)));
                    if (row.can_delete) actions.append(iconButton('Smazat', 'trash', async () => {
                        if (!confirm('Smazat tento časový zápis?\n' + row.body)) return;
                        try { const result = await request(id, { action: 'delete', id: row.id, revision: row.revision, timestamps_revision: value.timestamps_revision }); publish(result); status.textContent = 'Zápis odstraněn.'; }
                        catch (e) { status.textContent = e.message; }
                    }));
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
            destroy() { this.dead = true; panels.delete(this); if (loop?.panel === this) api.stopLoop(); shell.remove(); }
        };
        panels.add(panel); panel.load(); return panel;
    };
    setInterval(() => panels.forEach(p => p.playback()), 500);
}(typeof window !== 'undefined' ? window : globalThis));
