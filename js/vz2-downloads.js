/* One queue per page, shared by all views; compatible with existing audio keys. */
(function (root) {
    'use strict';
    const db = root.idbKeyval.createStore('zkusebna-vz2-cache', 'audio'), tasks = new Map(), listeners = new Set();
    const prefix = () => root.VZ2.cachePrefix;
    const key = f => prefix() + 'audio:' + f.id + ':' + f.sha256;
    const valid = (blob, f) => blob instanceof Blob && (f.byte_size == null || blob.size === Number(f.byte_size));
    const checkAbort = signal => { if (signal?.aborted) throw new DOMException('Načítání audia bylo zrušeno.', 'AbortError'); };
    let running = false;
    const notify = () => {
        try { sessionStorage.setItem(prefix() + 'downloads:pending', JSON.stringify(snapshot().filter(t => !['complete', 'cancelled'].includes(t.state)).map(t => t.file))); } catch (_) { /* Queue can still run when session storage is full. */ }
        listeners.forEach(fn => fn()); document.dispatchEvent(new Event('vz2:downloads-updated'));
    };
    async function local(file) { const blob = await root.idbKeyval.get(key(file), db); return valid(blob, file) ? blob : null; }
    // Playback never saves implicitly. Only decoders request a full download;
    // media elements can stream the URL when no complete local copy exists.
    async function read(file, { download = false, signal, onProgress = () => {} } = {}) {
        checkAbort(signal);
        let blob = null, storageError = false;
        try { blob = await local(file); } catch (_) { storageError = true; }
        checkAbort(signal);
        const saved = !!blob;
        if (!blob && download) {
            onProgress(0);
            blob = await root.Vz2Offline.download(file.url, file.byte_size, onProgress, signal);
            checkAbort(signal);
        }
        return { blob, local: saved, storageError };
    }
    function snapshot() { return [...tasks.values()].map(t => ({ key: t.key, file: t.file, state: t.state, progress: t.progress, error: t.error })); }
    async function pump() {
        if (running) return;
        running = true;
        try {
            for (const task of tasks.values()) {
                if (task.state !== 'queued') continue;
                task.state = 'checking'; notify();
                try {
                    let blob = await local(task.file);
                    if (task.cancelled) throw new DOMException('Stažení zrušeno.', 'AbortError');
                    if (!blob) {
                        task.state = 'downloading'; notify();
                        blob = task.blob || await root.Vz2Offline.download(task.file.url, task.file.byte_size, value => {
                            task.progress = value; notify();
                        }, task.controller.signal);
                        if (!valid(blob, task.file)) throw Error('Audio se nestáhlo celé.');
                        if (task.cancelled) throw new DOMException('Stažení zrušeno.', 'AbortError');
                        task.state = 'saving'; notify();
                        const name = task.file.original_name;
                        await root.idbKeyval.set(task.key, name ? new File([blob], name, { type: blob.type }) : blob, db);
                        // Cancellation during the IndexedDB transaction must not leave a new copy behind.
                        if (task.cancelled) { await root.idbKeyval.del(task.key, db); throw new DOMException('Stažení zrušeno.', 'AbortError'); }
                    }
                    task.state = 'complete'; task.progress = 100; task.resolve(blob);
                } catch (e) {
                    task.state = task.cancelled ? 'cancelled' : 'failed';
                    task.error = e.name === 'QuotaExceededError' ? 'V zařízení není dost místa. Odeberte nepotřebné místní kopie.' : e.message;
                    task.reject(e);
                } finally { task.blob = null; task.promise = null; task.resolve = null; task.reject = null; notify(); }
            }
        } finally { running = false; if ([...tasks.values()].some(t => t.state === 'queued')) void pump(); }
    }
    function enqueue(file, options = {}) {
        if (!file?.id || !file.sha256 || !file.url) return Promise.reject(Error('Soubor není dostupný.'));
        const id = key(file), old = tasks.get(id);
        if (old && ['queued', 'checking', 'downloading', 'saving'].includes(old.state)) return old.promise;
        const task = { key: id, file: { ...file }, state: 'queued', progress: 0, controller: new AbortController(), blob: options.blob, cancelled: false };
        task.promise = new Promise((resolve, reject) => { task.resolve = resolve; task.reject = reject; });
        task.promise.catch(() => {}); // UI callers may only observe the queue.
        tasks.set(id, task); notify(); void pump(); return task.promise;
    }
    async function cancel(id) {
        const task = tasks.get(id);
        if (!task || !['queued', 'checking', 'downloading', 'saving'].includes(task.state)) return;
        task.cancelled = true; task.controller.abort();
        if (task.state === 'queued') { task.state = 'cancelled'; task.reject(new DOMException('Stažení zrušeno.', 'AbortError')); notify(); }
        await task.promise.catch(() => {});
    }
    async function removeKey(id) {
        if (!id.startsWith(prefix())) throw Error('Neplatný místní soubor.');
        await cancel(id); await root.idbKeyval.del(id, db); tasks.delete(id); notify();
    }
    async function inventory() {
        const rows = [];
        for (const id of await root.idbKeyval.keys(db)) {
            if (typeof id !== 'string' || !id.startsWith(prefix() + 'audio:')) continue;
            const blob = await root.idbKeyval.get(id, db);
            if (blob instanceof Blob) rows.push({ key: id, name: blob.name || 'Audio ' + id.slice((prefix() + 'audio:').length).split(':')[0], size: blob.size });
        }
        return rows;
    }
    const api = root.Vz2Downloads = {
        key, local, read, enqueue, cancel, removeKey, snapshot, inventory,
        subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
        watch(file, element, fn) {
            let previous = null, serial = 0;
            const listener = () => {
                if (!element.isConnected) { listeners.delete(listener); return; }
                const state = tasks.get(key(file))?.state || 'absent';
                if (state === previous) return;
                previous = state;
                if (['queued', 'checking', 'downloading', 'saving'].includes(state)) return;
                const token = ++serial;
                local(file).then(blob => { if (token === serial && element.isConnected) fn(!!blob); }).catch(() => {});
            };
            listeners.add(listener); return () => listeners.delete(listener);
        },
        async source(file, options) {
            const result = await read(file, options);
            checkAbort(options?.signal);
            const url = result.blob ? URL.createObjectURL(result.blob) : file.url;
            let released = false;
            return { ...result, url, release() { if (!released && result.blob) URL.revokeObjectURL(url); released = true; } };
        },
        async clear() {
            await Promise.all([...tasks.keys()].map(cancel));
            for (const id of await root.idbKeyval.keys(db)) if (typeof id === 'string' && id.startsWith(prefix())) await root.idbKeyval.del(id, db);
            tasks.clear(); notify();
        },
        async plan(recordings) {
            const files = new Map(), saved = new Map((await inventory()).map(r => [r.key, r]));
            for (const r of recordings) for (const f of r.files || []) if (f.url && f.sha256) files.set(key(f), { ...f, recording_title: r.title });
            let stored = 0, missingBytes = 0, unknown = 0;
            const missing = [];
            for (const [id, f] of files) {
                const row = saved.get(id);
                if (row && (f.byte_size == null || row.size === Number(f.byte_size))) stored++;
                else { missing.push(f); if (f.byte_size == null) unknown++; else missingBytes += Number(f.byte_size); }
            }
            return { total: files.size, stored, missing, missingBytes, unknown };
        },
        async enqueueRecordings(recordings) { const plan = await api.plan(recordings); return Promise.allSettled(plan.missing.map(f => enqueue(f))); }
    };
    // Restored tasks require an explicit retry; reopening a page never downloads audio by itself.
    try {
        const saved = JSON.parse(sessionStorage.getItem(prefix() + 'downloads:pending') || '[]');
        for (const file of Array.isArray(saved) ? saved : []) if (file?.id && file.sha256 && file.url) {
            tasks.set(key(file), { key: key(file), file, state: 'interrupted', error: 'Stránka byla zavřena. Stažení lze spustit znovu.', progress: 0 });
        }
    } catch (_) { /* No pending queue. */ }
    window.addEventListener('beforeunload', e => {
        if (snapshot().some(t => ['queued', 'checking', 'downloading', 'saving'].includes(t.state))) { e.preventDefault(); e.returnValue = ''; }
    });
})(window);
