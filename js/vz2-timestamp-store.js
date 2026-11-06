/* View-independent timestamp state. The server remains authoritative. */
(function (root) {
    'use strict';
    const lists = new Map(), pending = new Map(), listeners = new Set();
    let selection = null;
    function accept(value) {
        const id = Number(value.recording_id), old = lists.get(id);
        if (old && Number(old.timestamps_revision) > Number(value.timestamps_revision)) return old;
        if (old === value) return old;
        lists.set(id, value);
        if (selection?.recording_id === id && !root.Vz2TimestampModel.items(value).some(i => i.id === selection.item_id)) select(null);
        listeners.forEach(fn => fn(value));
        root.document.dispatchEvent(new CustomEvent('vz2:timestamps-updated', { detail: value }));
        return value;
    }
    async function request(id, fields) {
        const r = await fetch('php/ajax/vz2_timestamps.php' + (fields ? '' : '?recording_id=' + encodeURIComponent(id)), {
            method: fields ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
            headers: fields ? { 'Content-Type': 'application/json', 'X-CSRF-Token': root.VZ2.csrf } : {},
            body: fields ? JSON.stringify({ ...fields, recording_id: Number(id) }) : undefined
        });
        let value;
        try { value = await r.json(); } catch (_) { throw Error('Odpověď nelze načíst. Ověřte připojení a přihlášení.'); }
        if (!r.ok || !value.ok) { const e = Error(value.error || 'Značky nelze načíst.'); e.status = r.status; e.reason = value.reason; throw e; }
        return accept(value);
    }
    function load(id) {
        id = Number(id);
        if (!pending.has(id)) pending.set(id, request(id).finally(() => pending.delete(id)));
        return pending.get(id);
    }
    function select(value) {
        selection = value ? { recording_id: Number(value.recording_id), item_id: String(value.item_id) } : null;
        root.document.dispatchEvent(new CustomEvent('vz2:timestamp-selected', { detail: selection }));
    }
    const api = root.Vz2TimestampStore = {
        peek: id => lists.get(Number(id)), load, reload: load, accept,
        save: (id, fields) => request(id, fields),
        subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
        select, selection: () => selection,
        items: id => lists.has(Number(id)) ? root.Vz2TimestampModel.items(lists.get(Number(id))) : [],
        remove(id, item, revision, removeHistoryLinks = false) {
            return request(id, { action: ['take', 'passage'].includes(item.kind) ? 'delete_interval' : 'delete',
                id: item.timestamp_id, revision: item.source.revision, timestamps_revision: revision,
                ...(removeHistoryLinks ? { remove_history_links: true } : {}) });
        },
        async removeWithHistory(id, item, revision) {
            try { return await api.remove(id, item, revision); }
            catch (error) {
                if (error.reason !== 'timestamp_history_linked') throw error;
                if (!root.confirm('Časové značky jsou propojené se skladbou v matici. Odebrat tuto vazbu a smazat značky začátku a konce? Nahrávka se nesmaže. Případný výstřižek zůstane v matici samostatně.')) return null;
                return api.remove(id, item, revision, true);
            }
        },
        async addQuickNote(id, symbol, timeMs) {
            if (!['👍', '👎'].includes(symbol)) throw Error('Neplatné hodnocení.');
            const list = await load(id);
            if (!list.can_create) throw Error('K této nahrávce nelze přidat poznámku.');
            return api.saveNote(id, { timestamps_revision: list.timestamps_revision, time_ms: Math.max(0, Math.round(timeMs)), body: symbol });
        },
        saveInterval(id, fields) { return request(id, { ...fields, action: 'save_interval' }); },
        saveNote(id, fields) { return request(id, { ...fields, kind: 'note', action: fields.id ? 'update' : 'create' }); }
    };
})(window);
