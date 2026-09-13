(function() {
    'use strict';
    var config = window.MULTITRACK_CONFIG || {};
    var byId = function(id) { return document.getElementById(id); };
    var status = byId('mt-notes-status');
    if (!status || !config.notesUrl) return;
    var selectedId = '', data = null, archived = false, serial = 0, busy = false, editingId = '';
    var summary = byId('mt-summary'), form = byId('mt-note-form'), outline = byId('mt-outline');
    var refresh = byId('mt-notes-refresh'), contentRefresh = byId('mt-content-refresh');
    var noteList = byId('mt-note-list');
    var contentBlocks = document.querySelectorAll('[data-mt-notes-content]');

    function message(text, error) {
        [status, byId('mt-content-status')].forEach(function(el) {
            el.textContent = text;
            el.classList.toggle('is-error', !!error);
        });
    }
    function timeLabel(seconds) {
        var total = Math.max(0, Math.floor(seconds));
        var hours = Math.floor(total / 3600);
        return (hours ? hours + ':' : '') + String(Math.floor(total / 60) % (hours ? 60 : Infinity)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
    }
    function parseTime(text) {
        var parts = text.trim().split(':');
        if (parts.length < 2 || parts.length > 3 || parts.some(function(p) { return !/^\d+$/.test(p); })) return null;
        var numbers = parts.map(Number);
        if (numbers[numbers.length - 1] >= 60 || (numbers.length === 3 && numbers[1] >= 60)) return null;
        return numbers.reduce(function(total, part) { return total * 60 + part; }, 0);
    }
    function node(tag, className, text) {
        var element = document.createElement(tag);
        element.className = className || '';
        if (text !== undefined) element.textContent = text;
        return element;
    }
    function action(label, callback, className) {
        var button = node('button', className || 'btn-vz', label);
        button.type = 'button';
        button.addEventListener('click', callback);
        return button;
    }
    function playbackReady() {
        var state = window.MultitrackApp.getState();
        return !archived && state && state.id === selectedId && state.phase === 'ready';
    }
    function updateTimeButtons() {
        document.querySelectorAll('#mt-outline .mt-note-time, #mt-note-list .mt-note-time').forEach(function(button) { button.disabled = !playbackReady(); });
    }
    function updateBusy(value) {
        busy = value;
        contentBlocks.forEach(function(block) {
            block.querySelectorAll('button, input, textarea, select').forEach(function(button) { button.disabled = value; });
        });
        var remove = byId('mt-remove-audio');
        if (remove) remove.disabled = value || !data;
        refresh.disabled = value || !selectedId;
        contentRefresh.disabled = value || !selectedId;
        updateTimeButtons();
    }
    function api(payload) {
        var url = new URL(config.notesUrl, window.location.href);
        var options = { credentials: 'same-origin', cache: 'no-store' };
        if (payload) {
            options.method = 'POST';
            options.headers = { 'Content-Type': 'application/json', 'X-CSRF-Token': config.csrfToken };
            options.body = JSON.stringify(Object.assign({ id: selectedId, revision: data.revision }, payload));
        } else url.searchParams.set('id', selectedId);
        return fetch(url.href, options).then(function(response) {
            return response.json().then(function(result) {
                if (!response.ok || !result.ok) throw new Error(result.error || 'Zápis se nepodařilo načíst.');
                return result;
            });
        });
    }
    function entryRow(entry) {
        var row = node('div', 'mt-outline-row');
        row.appendChild(action(timeLabel(entry.time), function() {
            if (playbackReady()) window.MultitrackApp.seek(entry.time);
        }, 'mt-note-time'));
        row.appendChild(node('span', 'mt-note-copy', entry.text));
        return row;
    }
    function entryControls(entry) {
        var controls = node('span', 'mt-entry-actions');
        if (config.canComment) {
            controls.appendChild(action('Upravit', function() { openEntry(entry); }));
            controls.appendChild(action('Smazat', function() {
                if (window.confirm(entry.kind === 'chapter' ? 'Smazat tuto položku obsahu? Poznámky zůstanou zachované.' : 'Smazat tuto poznámku?')) {
                    save({ action: 'delete', entryId: entry.id });
                }
            }));
        }
        return controls;
    }
    function render() {
        outline.textContent = '';
        noteList.textContent = '';
        var group = noteList, chapters = 0, notes = 0;
        data.entries.forEach(function(entry, index) {
            if (entry.kind === 'chapter') {
                chapters++;
                var chapter = node('div', 'mt-outline-chapter');
                chapter.appendChild(entryRow(entry));
                chapter.appendChild(entryControls(entry));
                var count = 0;
                for (var i = index + 1; i < data.entries.length && data.entries[i].kind !== 'chapter'; i++) count++;
                var target = node('section', 'mt-note-group');
                target.dataset.chapterId = entry.id;
                target.appendChild(entryRow(entry));
                group = node('div', 'mt-chapter-notes');
                target.appendChild(group);
                noteList.appendChild(target);
                chapter.appendChild(action(count + (count === 1 ? ' poznámka' : count > 1 && count < 5 ? ' poznámky' : ' poznámek'), function() {
                    if (window.VZWorkspace) VZWorkspace.showPanel('tabelatura');
                    target.scrollIntoView({ block: 'nearest' });
                }, 'btn-vz mt-chapter-link'));
                outline.appendChild(chapter);
            } else {
                notes++;
                var item = node('div', 'mt-outline-note');
                item.appendChild(entryRow(entry));
                item.appendChild(node('small', 'mt-note-author', entry.author));
                item.appendChild(entryControls(entry));
                group.appendChild(item);
            }
        });
        if (!chapters) outline.appendChild(node('p', 'mt-list-empty', 'Zatím bez obsahu. Označte začátek skladby nebo pokusu.'));
        if (!notes) noteList.appendChild(node('p', 'mt-list-empty', 'Zatím bez časových poznámek.'));
        var remove = byId('mt-remove-audio');
        if (remove) remove.hidden = archived;
        updateTimeButtons();
    }
    function load() {
        var token = ++serial;
        message('Načítám zápis…');
        contentBlocks.forEach(function(block) { block.hidden = true; });
        if (byId('mt-remove-audio')) byId('mt-remove-audio').hidden = true;
        if (form) form.hidden = true;
        refresh.disabled = true;
        contentRefresh.disabled = true;
        data = null;
        api().then(function(result) {
            if (token !== serial) return;
            data = result.notes;
            archived = result.audioDeleted;
            summary.value = data.summary;
            contentBlocks.forEach(function(block) { block.hidden = false; });
            render();
            message(archived ? 'Audio odstraněno · zápis zachován.' : '');
        }).catch(function(error) { if (token === serial) message(error.message, true); })
            .finally(function() { if (token === serial) updateBusy(false); });
    }
    function save(payload) {
        if (busy || !data) return Promise.resolve(false);
        var token = serial;
        updateBusy(true);
        message('Ukládám…');
        return api(payload).then(function(result) {
            if (token !== serial) return false;
            data = result.notes;
            archived = result.audioDeleted;
            render();
            message(archived ? 'Audio odstraněno · zápis zachován.' : 'Uloženo.');
            return true;
        }).catch(function(error) {
            if (token === serial) message(error.message, true);
            return false;
        }).finally(function() { if (token === serial) updateBusy(false); });
    }
    function openEntry(entry) {
        if (!form || busy || !data) return;
        var chapter = entry.kind === 'chapter';
        byId(chapter ? 'mt-chapter-editor' : 'mt-note-editor').appendChild(form);
        if (window.VZWorkspace) VZWorkspace.showPanel(chapter ? 'text' : 'tabelatura');
        editingId = entry.id || '';
        byId('mt-note-kind').value = entry.kind;
        byId('mt-note-time').value = timeLabel(entry.time);
        byId('mt-note-text').value = entry.text || '';
        form.hidden = false;
        byId('mt-note-text').focus();
    }
    function newEntry(kind) {
        var state = window.MultitrackApp.getState();
        openEntry({ kind: kind, time: state && state.id === selectedId ? state.position : 0 });
    }
    document.addEventListener('multitrack:beforeselect', function(event) {
        if (busy || (data && ((form && !form.hidden) || summary.value !== data.summary) &&
            !window.confirm('Změnit nahrávku a zahodit rozepsané změny zápisu?'))) event.preventDefault();
    });
    window.addEventListener('beforeunload', function(event) {
        if (busy || (data && ((form && !form.hidden) || summary.value !== data.summary))) {
            event.preventDefault();
            event.returnValue = '';
        }
    });
    document.addEventListener('multitrack:selected', function(event) {
        selectedId = event.detail.id;
        busy = false;
        load();
    });
    document.addEventListener('multitrack:ready', updateTimeButtons);
    [refresh, contentRefresh].forEach(function(button) {
        button.addEventListener('click', function() {
            if (!data || ((form === null || form.hidden) && summary.value === data.summary) || window.confirm('Obnovit zápis a zahodit rozepsané změny?')) load();
        });
    });
    byId('mt-summary-form').addEventListener('submit', function(event) {
        event.preventDefault();
        save({ action: 'summary', text: summary.value });
    });
    if (form) {
        byId('mt-add-chapter').addEventListener('click', function() { newEntry('chapter'); });
        byId('mt-add-note').addEventListener('click', function() { newEntry('note'); });
        byId('mt-note-cancel').addEventListener('click', function() { form.hidden = true; });
        form.addEventListener('submit', function(event) {
            event.preventDefault();
            var time = parseTime(byId('mt-note-time').value);
            if (time === null) return message('Zadejte čas například 12:35 nebo 1:12:35.', true);
            var token = serial;
            save({ action: 'entry', entryId: editingId, kind: byId('mt-note-kind').value, time: time, text: byId('mt-note-text').value })
                .then(function(ok) { if (ok && token === serial) form.hidden = true; });
        });
    }
    var remove = byId('mt-remove-audio');
    if (remove) remove.addEventListener('click', function() {
        if (!data || busy) return;
        if (!window.confirm('Odstranit všechny audio stopy nahrávky „' + data.name + '“ ze serveru? Obsah a poznámky zůstanou. Smazání audia nelze vrátit.')) return;
        var id = selectedId;
        window.MultitrackApp.pause();
        save({ action: 'removeAudio' }).then(function(ok) {
            if (!ok || selectedId !== id) return;
            window.MultitrackApp.destroy();
            window.MultitrackApp.refreshList().then(function() { window.MultitrackApp.load(id); });
        });
    });
})();
