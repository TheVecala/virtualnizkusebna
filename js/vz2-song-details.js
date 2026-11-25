/* Shared collection descriptions and song metadata. */
(function (root) {
    'use strict';
    const make = (tag, text, cls) => { const el = document.createElement(tag); if (text != null) el.textContent = text; if (cls) el.className = cls; return el; };
    const temposText = values => (values || []).map(n => Number(n).toLocaleString('cs-CZ', { maximumFractionDigits: 2, useGrouping: false })).join('/');
    const musicalText = (tempos, meters) => [tempos?.length ? temposText(tempos) + ' BPM' : '', (meters || []).join(' + ')].filter(Boolean).join(' · ');
    let active = null, observer = null;
    function open(collection, options) {
        if (active) { active.focus(); return; }
        const isSong = collection.kind === 'song';
        const dialog = make('dialog', null, 'song-details-dialog');
        dialog.setAttribute('aria-labelledby', 'song-details-title');
        dialog.innerHTML = `<form novalidate>
            <div class="dialog-header"><h2 id="song-details-title">${isSong ? 'Popisek skladby' : 'Popisek zkoušky'}</h2><button type="button" class="modal-close" aria-label="Zavřít popisek">×</button></div>
            <p class="song-details-context"></p>
            ${isSong ? `<label>Tempo (BPM)<input name="tempos" maxlength="500" placeholder="120 / 132 / 120" aria-describedby="song-tempos-help"></label>
            <small id="song-tempos-help">Více temp oddělte lomítkem. Pořadí zůstane zachované.</small>
            <label>Takt<input name="meters" maxlength="500" placeholder="4/4 + 3/4" aria-describedby="song-meters-help"></label>
            <div class="song-meter-choice"></div><small id="song-meters-help">Více taktů oddělte +. Můžete je vybrat nebo napsat.</small>` : ''}
            <label>Popisek<textarea name="description" maxlength="10000" rows="5" placeholder="${isSong ? 'Domluvy, změny tempa, poznámky ke skladbě…' : 'Domluvy a poznámky ke zkoušce…'}"></textarea></label>
            <p class="error" role="alert"></p><div class="song-details-comparison" hidden></div>
            <button type="button" class="song-details-reload" hidden>Načíst aktuální verzi k porovnání</button>
            <button type="button" class="song-details-rebase" hidden>Použít aktuální revizi</button>
            <div class="toolbar"><button type="submit">Uložit</button></div>
        </form>`;
        document.body.append(dialog); active = dialog;
        const form = dialog.querySelector('form'), error = form.querySelector('.error');
        const { tempos, meters, description } = form.elements;
        form.querySelector('.song-details-context').textContent = collection.title;
        description.value = collection.song_description || '';
        let choice;
        if (isSong) {
            tempos.value = (collection.song_tempos || []).join(' / ');
            meters.value = (collection.song_meters || []).join(' + ');
            choice = root.Vz2TimestampControls.choice(form.querySelector('.song-meter-choice'), 'Přidat takt');
            choice.setOptions([{ value: '', label: 'Přidat takt…' }, ...['2/4','3/4','4/4','6/8','7/8','9/8','12/8'].map(value => ({ value, label: value })), { value: 'other', label: 'Jiný takt…' }]);
            choice.onChange(value => {
                if (value && value !== 'other') meters.value += (meters.value.trim() ? ' + ' : '') + value;
                choice.value = ''; meters.focus();
            });
        }
        let revision = collection.revision, busy = false, pending = null;
        const state = () => JSON.stringify([tempos?.value, meters?.value, description.value]);
        let baseline = state();
        const close = () => { if (!busy && (state() === baseline || confirm('Zahodit rozepsané změny popisku?'))) dialog.close(); };
        form.querySelector('.modal-close').onclick = close;
        dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
        const unload = e => { if (state() !== baseline) { e.preventDefault(); e.returnValue = ''; } };
        root.addEventListener('beforeunload', unload);
        dialog.addEventListener('close', () => { choice?.destroy(); root.removeEventListener('beforeunload', unload); dialog.remove(); active = null; });
        const reload = form.querySelector('.song-details-reload'), rebase = form.querySelector('.song-details-rebase');
        reload.onclick = async () => {
            reload.disabled = true;
            try {
                pending = await options.reload(collection.id);
                if (!pending?.can_edit_details || pending.lifecycle !== 'active') {
                    throw Error(isSong ? 'Skladba již není dostupná k úpravě.' : 'Zkouška již není dostupná k úpravě.');
                }
                const comparison = form.querySelector('.song-details-comparison'); comparison.replaceChildren(); comparison.hidden = false;
                comparison.append(make('strong', 'Aktuálně uložená verze'));
                const music = isSong ? musicalText(pending.song_tempos, pending.song_meters) : '';
                if (music) comparison.append(make('p', music));
                comparison.append(make('p', pending.song_description || 'Bez popisku.'));
                rebase.hidden = false;
            } catch (err) { pending = null; rebase.hidden = true; error.textContent = err.message; }
            finally { reload.disabled = false; }
        };
        rebase.onclick = () => {
            if (!pending) return;
            revision = pending.revision; pending = null; rebase.hidden = reload.hidden = true;
            error.textContent = 'Rozepsané údaje zůstaly zachované. Zkontrolujte je a znovu uložte.';
        };
        form.onsubmit = async e => {
            e.preventDefault(); if (busy) return; error.textContent = '';
            let fields = { action: 'rehearsal_description_update', description: description.value };
            if (isSong) {
                const tempoText = tempos.value.trim();
                const songTempos = tempoText ? tempoText.split(/\s*(?:\/|;|→|\+)\s*/).map(value => {
                    const text = value.trim().replace(',', '.');
                    return /^\d+(?:\.\d{1,2})?$/.test(text) ? Number(text) : NaN;
                }) : [];
                if (songTempos.some(value => !Number.isFinite(value) || value < 1 || value > 999) || songTempos.length > 32) {
                    error.textContent = 'Zadejte nejvýše 32 temp od 1 do 999 BPM, oddělených lomítkem (např. 120 / 132).'; tempos.focus(); return;
                }
                const songMeters = meters.value.trim() ? meters.value.split(/\s*(?:\+|;|→)\s*/).map(v => v.replace(/\s/g, '')) : [];
                if (songMeters.length > 32 || songMeters.some(v => !/^([1-9]|[12][0-9]|3[0-2])\/(1|2|4|8|16|32|64)$/.test(v))) {
                    error.textContent = 'Zadejte nejvýše 32 taktů, například 4/4 + 6/8.'; meters.focus(); return;
                }
                fields = { action: 'song_details_update', song_tempos: songTempos, song_meters: songMeters, song_description: description.value };
            }
            busy = true; dialog.dispatchEvent(new Event('annotation-close-choices'));
            const controls = [...form.querySelectorAll('button,input,textarea')]; controls.forEach(b => b.disabled = true);
            try {
                await options.save({ ...fields, id: Number(collection.id), revision: Number(revision) });
                baseline = state(); dialog.close(); options.onSaved();
            } catch (err) { error.textContent = err.message; reload.hidden = err.status !== 409; }
            finally { busy = false; controls.forEach(b => b.disabled = false); }
        };
        dialog.showModal(); (tempos || description).focus({ preventScroll: true });
    }
    function mount(host, collection, options) {
        observer?.disconnect(); observer = null; host.replaceChildren();
        host.hidden = !collection; if (host.hidden) return;
        const isSong = collection.kind === 'song';
        const music = isSong ? musicalText(collection.song_tempos, collection.song_meters) : '';
        const description = collection.song_description || '';
        const row = make('div', null, 'song-details-line');
        if (music) row.append(make('span', music, 'song-details-music'));
        if (options.canWrite && collection.can_edit_details && collection.lifecycle === 'active') {
            const hasDetails = Boolean(music || description), label = isSong ? 'popisek, tempo a takt' : 'popisek zkoušky';
            const edit = make('button', hasDetails ? '✎' : isSong ? '+ BPM, takt a info' : '+ Popisek zkoušky', 'song-details-edit'); edit.type = 'button';
            edit.setAttribute('aria-label', (hasDetails ? 'Upravit ' : 'Přidat ') + label);
            edit.title = edit.getAttribute('aria-label'); edit.onclick = () => open(collection, options); row.append(edit);
        }
        if (row.childElementCount || description) host.append(row);
        if (description) {
            const text = make('p', description, 'song-details-description'), more = make('button', 'Zobrazit více', 'song-details-more');
            more.type = 'button'; more.setAttribute('aria-expanded', 'false'); more.hidden = true;
            more.onclick = () => { const expanded = more.getAttribute('aria-expanded') !== 'true'; more.setAttribute('aria-expanded', String(expanded)); text.classList.toggle('is-expanded', expanded); more.textContent = expanded ? 'Sbalit' : 'Zobrazit více'; };
            if (music) host.append(text);
            else row.prepend(text);
            host.append(more);
            observer = new ResizeObserver(() => { if (!text.classList.contains('is-expanded')) more.hidden = text.scrollHeight <= text.clientHeight + 1; }); observer.observe(text);
        }
        host.hidden = !host.childElementCount;
    }
    root.Vz2SongDetails = { mount, open, temposText, musicalText };
})(window);
