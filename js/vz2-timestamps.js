(function (root) {
    'use strict';
    const kinds = { song_start: '♪ Začátek skladby', song_end: '■ Konec skladby', passage: '↔ Pasáž', note: '● Poznámka' };
    function format(ms) {
        return compactFormat(ms);
    }
    function parse(text) {
        const m = /^(?:(\d+):)?(\d+):(\d{2})(?:[.,](\d{1,3}))?$/.exec(text.trim());
        const hasHours = !!m?.[1];
        if (!m || Number(m[3]) > 59 || (hasHours && Number(m[2]) > 59)) throw new Error('Čas zadejte jako mm:ss.');
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
        if (kind === 'song_start') return '↑';
        if (kind === 'song_end') return '↓';
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
    let editor, pairDialog, exportDialog, activeEditor, activePair, activeExportPanel, loop, loopBusy = false, loopSerial = 0;
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
    async function saveEditor(context, fields) {
        if (context.busy || context.panel.quickBusy) return;
        const form = editor.querySelector('form');
        context.busy = true;
        const controls = [...form.querySelectorAll('button')]; controls.forEach(b => b.disabled = true);
        try {
            if (context.row) { fields.id = context.row.id; fields.revision = context.row.revision; }
            const result = await request(context.panel.id, fields); publish(result);
            context.revision = result.timestamps_revision;
            if (form.elements.return_position.checked && context.panel.adapter?.canPlay()) context.panel.adapter.seek(fields.time_ms);
            editor.querySelector('.error').textContent = '';
            if (editor.classList.contains('ts-inline') && !context.row) {
                form.elements.body.value = '';
                setEditorTime(context.panel.adapter?.currentTimeMs() ?? fields.time_ms);
            } else editor.close();
        } catch (err) { editor.querySelector('.error').textContent = err.message; editor.querySelector('.ts-rebase').hidden = err.status !== 409; }
        finally { context.busy = false; controls.forEach(b => b.disabled = false); form.elements.return_position.disabled = !context.panel.adapter?.canPlay(); }
    }
    // Keep the exact position separately from the editable mm:ss display.
    function setEditorTime(ms) {
        activeEditor.timeMs = Math.max(0, Math.round(Number(ms) || 0));
        activeEditor.timeText = format(activeEditor.timeMs);
        editor.querySelector('form').elements.time.value = activeEditor.timeText;
    }
    function editorTimeMs() {
        const text = editor.querySelector('form').elements.time.value;
        return text === activeEditor.timeText ? activeEditor.timeMs : parse(text);
    }
    function openPairDialog(context, fields) {
        if (!pairDialog) {
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
        const select = pairDialog.querySelector('select'); select.replaceChildren(new Option('Bez propojení', ''));
        const used = new Set(context.panel.list.entries.filter(t => t.kind === 'song_end' && t.id !== context.row?.id && t.paired_timestamp_id).map(t => Number(t.paired_timestamp_id)));
        const starts = context.panel.list.entries.filter(t => t.kind === 'song_start' && Number(t.time_ms) < fields.time_ms && !used.has(Number(t.id)));
        starts.forEach(t => select.add(new Option(format(t.time_ms) + ' · ' + t.body, String(t.id))));
        select.value = context.row?.paired_timestamp_id ? String(context.row.paired_timestamp_id) : starts.length === 1 ? String(starts[0].id) : '';
        pairDialog.showModal(); select.focus();
    }
    function ensureEditor() {
        if (editor) return;
        editor = el('dialog'); editor.className = 'vz2-timestamp-editor';
        editor.innerHTML = '<form autocomplete="off"><div class="ts-editor-top"><p class="ts-mode"></p><p class="ts-context"></p><button type="button" class="ts-close modal-close" aria-label="Zavřít časovou značku" title="Zavřít">×</button></div><div class="ts-editor-body"><label class="ts-body"><span class="visually-hidden">Text</span><input type="text" name="body" aria-label="Text časové značky" placeholder="Text" autocomplete="off" autocapitalize="sentences" spellcheck="true"></label><div class="ts-time-row"><input type="text" name="time" required inputmode="numeric" aria-label="Čas ve formátu minuty a sekundy" autocomplete="off" spellcheck="false"><button type="button" class="ts-time-adjust" data-delta="-1000" aria-label="Odečíst jednu sekundu">−</button><button type="button" class="ts-time-adjust" data-delta="1000" aria-label="Přičíst jednu sekundu">+</button><button type="button" class="ts-time-current" title="Převzít čas z přehrávače">Zachytit čas</button></div><div class="ts-editor-options"><label class="ts-return"><input type="checkbox" name="return_position"> Vrátit na čas</label><div class="ts-quick-notes"><button type="button" class="ts-quick-note" data-symbol="👍" aria-label="Přidat poznámku: palec nahoru" title="Přidat poznámku: palec nahoru">👍</button><button type="button" class="ts-quick-note" data-symbol="👎" aria-label="Přidat poznámku: palec dolů" title="Přidat poznámku: palec dolů">👎</button></div></div><p role="alert" class="error"></p><pre class="ts-current" hidden></pre></div><div class="ts-editor-footer"><button type="submit" name="kind" value="song_start">Začátek</button><button type="submit" name="kind" value="song_end">Konec</button><button type="submit" name="kind" value="passage">Pasáž</button><button type="submit" name="kind" value="note">Poznámka</button><button type="button" class="ts-rebase" hidden>Načíst aktuální verzi k porovnání</button></div></form>';
        const form = editor.querySelector('form');
        form.elements.time.addEventListener('change', () => {
            try { setEditorTime(editorTimeMs()); }
            catch (e) { editor.querySelector('.error').textContent = e.message; }
        });
        editor.addEventListener('cancel', e => { if (activeEditor?.busy) e.preventDefault(); });
        editor.addEventListener('keydown', e => {
            if (e.key === 'Escape' && editor.classList.contains('ts-inline') && !activeEditor?.busy && !activeEditor?.panel.quickBusy && !pairDialog?.open) {
                e.preventDefault(); editor.close();
            }
        });
        editor.addEventListener('close', () => {
            editor.closest('#player-shell')?.classList.remove('ts-creating');
            editor.classList.remove('ts-keyboard-open');
            editor.style.removeProperty('--ts-inline-height');
            if (!editor.open && activeEditor?.restoreDrawer && !activeEditor.panel.dead) activeEditor.panel.openDrawer?.();
        });
        editor.addEventListener('focusin', positionInlineEditor);
        window.visualViewport?.addEventListener('resize', positionInlineEditor);
        window.visualViewport?.addEventListener('scroll', positionInlineEditor);
        editor.querySelectorAll('.ts-close').forEach(close => { close.onclick = () => editor.close(); });
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
            try {
                const ms = editorTimeMs();
                const fields = { action: context.row ? 'update' : 'create', timestamps_revision: context.revision,
                    kind: e.submitter.value, time_ms: ms,
                    body: timestampBody(e.submitter.value, form.elements.body.value) };
                if (fields.kind === 'song_end') openPairDialog(context, fields);
                else await saveEditor(context, fields);
            } catch (err) { editor.querySelector('.error').textContent = err.message; }
        });
        document.body.append(editor);
    }
    function positionInlineEditor() {
        if (!editor?.open || !editor.classList.contains('ts-inline')) return;
        const viewport = window.visualViewport;
        const visibleBottom = (viewport?.offsetTop || 0) + (viewport?.height || innerHeight);
        const covered = Math.max(0, innerHeight - visibleBottom);
        const typing = editor.contains(document.activeElement) && document.activeElement.matches('input[name=body],input[name=time]');
        editor.classList.toggle('ts-keyboard-open', covered > 120 || typing);
        editor.style.setProperty('--ts-inline-height', Math.max(100, visibleBottom - editor.getBoundingClientRect().top - 8) + 'px');
    }
    function openEditor(panel, row) {
        ensureEditor();
        const restoreDrawer = editor.open && activeEditor?.panel === panel && activeEditor.restoreDrawer;
        if (editor.open) {
            if (activeEditor?.busy || activeEditor?.panel.quickBusy || !confirm('Zahodit rozepsanou časovou značku?')) return;
            editor.closest('#player-shell')?.classList.remove('ts-creating');
            editor.close();
        }
        const inline = !row && matchMedia('(max-width: 767px)').matches && panel.inlineHost;
        activeEditor = { panel, row, revision: panel.list.timestamps_revision,
            restoreDrawer: !!inline && (restoreDrawer || panel.drawerOpen?.()) };
        const f = editor.querySelector('form');
        setEditorTime(row ? row.time_ms : panel.adapter?.currentTimeMs() ?? 0);
        f.elements.body.value = row?.body || '';
        editor.classList.toggle('ts-edit-mode', !!row);
        editor.querySelector('.ts-mode').textContent = row ? 'Upravit značku' : 'Přidat značku';
        editor.querySelectorAll('.ts-editor-footer button[name=kind]').forEach(control => {
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
        editor.classList.toggle('ts-inline', !!inline);
        if (inline) {
            panel.closeDrawer?.();
            editor.tabIndex = -1;
            editor.setAttribute('autofocus', '');
            panel.inlineHost.after(editor);
            editor.closest('#player-shell')?.classList.add('ts-creating');
            editor.show(); editor.focus({ preventScroll: true });
            positionInlineEditor();
        } else {
            editor.removeAttribute('autofocus');
            document.body.append(editor);
            editor.showModal(); f.elements.body.focus();
        }
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
                editor.querySelector('.ts-time-current').disabled = !panel.adapter?.canPlay();
                editor.querySelector('.ts-return input').disabled = !panel.adapter?.canPlay();
            }
        }
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
        const quickUp = button('👍', () => quickNote(panel, '👍'));
        const quickDown = button('👎', () => quickNote(panel, '👎'));
        for (const [control, label] of [[quickUp, 'Přidat poznámku: palec nahoru'], [quickDown, 'Přidat poznámku: palec dolů']]) {
            control.className = 'ts-quick-note'; control.title = label; control.setAttribute('aria-label', label); control.disabled = true;
        }
        const reload = iconButton('Obnovit značky', 'refresh', () => panel.load());
        const stop = button('Vypnout smyčku', api.stopLoop); stop.hidden = true;
        const exportButton = button('Export', () => openExport(panel)); exportButton.disabled = true;
        toolbar.append(add, quickUp, quickDown, reload, stop, exportButton); content.append(status, list, toolbar); shell.append(summary, content); container.append(shell);
        let mobileActions, mobileAdd, mobileQuickUp, mobileQuickDown, mobileExport, mobileToggle, resizeObserver, mobileMedia;
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
            mobileQuickUp = button('👍', () => quickNote(panel, '👍'));
            mobileQuickDown = button('👎', () => quickNote(panel, '👎'));
            for (const [control, label] of [[mobileQuickUp, 'Přidat poznámku: palec nahoru'], [mobileQuickDown, 'Přidat poznámku: palec dolů']]) {
                control.className = 'ts-quick-note'; control.title = label; control.setAttribute('aria-label', label); control.disabled = true;
            }
            mobileExport = button('Export', () => openExport(panel)); mobileExport.disabled = true;
            add.classList.add('ts-desktop-action'); quickUp.classList.add('ts-desktop-action'); quickDown.classList.add('ts-desktop-action'); exportButton.classList.add('ts-desktop-action');
            mobileActions.append(mobileToggle, mobileAdd, mobileQuickUp, mobileQuickDown, mobileExport); container.before(mobileActions);
            resizeObserver = new ResizeObserver(positionDrawer);
            resizeObserver.observe(document.getElementById('player-shell')); resizeObserver.observe(mobileActions);
            mobileMedia.addEventListener('change', onMobileChange);
            window.addEventListener('resize', positionDrawer); document.addEventListener('keydown', onDrawerKey);
        }
        const panel = { id, adapter, inlineHost: mobileActions || shell,
            drawerOpen: mobileActions ? () => container.classList.contains('ts-drawer-open') : null,
            closeDrawer: mobileActions ? () => toggleDrawer(false) : null,
            openDrawer: mobileActions ? () => toggleDrawer(true) : null,
            list: null, dead: false, quickBusy: false, quickButtons: [quickUp, quickDown, mobileQuickUp, mobileQuickDown].filter(Boolean), error: text => { status.textContent = text; },
            update(value) {
                if (this.list && value.timestamps_revision < this.list.timestamps_revision) return;
                this.list = value; list.replaceChildren(); add.hidden = !value.can_create; add.disabled = !value.can_create; exportButton.disabled = false;
                for (const control of [quickUp, quickDown]) { control.hidden = !value.can_create; control.disabled = !value.can_create || this.quickBusy; }
                if (mobileActions) {
                    mobileAdd.hidden = !value.can_create; mobileAdd.disabled = !value.can_create; mobileExport.disabled = false;
                    for (const control of [mobileQuickUp, mobileQuickDown]) { control.hidden = !value.can_create; control.disabled = !value.can_create || this.quickBusy; }
                }
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
                    const boundary = row.kind === 'song_start' || row.kind === 'song_end' ? boundaryIcon(row.kind) : null;
                    // Older empty boundaries store an arrow as their body; show the type icon once.
                    if (boundary && row.body.trim() === (row.kind === 'song_start' ? '↑' : '↓')) text.textContent = '';
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
                    item.append(seek);
                    if (boundary) item.append(boundary);
                    item.append(text, authors, actions); list.append(item);
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
                if (activeEditor?.panel === this && editor?.open && editor.classList.contains('ts-inline')) {
                    editor.closest('#player-shell')?.classList.remove('ts-creating');
                    document.body.append(editor);
                }
                resizeObserver?.disconnect(); mobileMedia?.removeEventListener('change', onMobileChange);
                window.removeEventListener('resize', positionDrawer); document.removeEventListener('keydown', onDrawerKey);
                mobileActions?.remove(); container.classList.remove('ts-drawer-open'); container.style.removeProperty('--ts-drawer-top');
            }
        };
        if (activeEditor?.panel?.dead && activeEditor.panel.id === id && editor?.open && editor.classList.contains('ts-inline')) {
            activeEditor.panel = panel;
            panel.inlineHost.after(editor);
            editor.closest('#player-shell')?.classList.add('ts-creating');
            positionInlineEditor();
        }
        panels.add(panel); panel.load(); return panel;
    };
    setInterval(() => panels.forEach(p => p.playback()), 500);
}(typeof window !== 'undefined' ? window : globalThis));
