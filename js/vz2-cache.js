/* The small IndexedDB interface used by the existing mixer and VZ2 audio. */
(function () {
    'use strict';
    function createStore(database, name) {
        const opened = new Promise((resolve, reject) => {
            const request = indexedDB.open(database, 1);
            request.onupgradeneeded = () => request.result.createObjectStore(name);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        return { opened, name };
    }
    async function run(store, mode, fn) {
        const db = await store.opened;
        return new Promise((resolve, reject) => {
            const tx = db.transaction(store.name, mode);
            let result;
            const request = fn(tx.objectStore(store.name));
            request.onsuccess = () => { result = request.result; };
            tx.oncomplete = () => resolve(result);
            tx.onerror = tx.onabort = () => reject(tx.error || request.error);
        });
    }
    window.idbKeyval = {
        createStore,
        get: (key, s) => run(s, 'readonly', o => o.get(key)),
        set: (key, value, s) => run(s, 'readwrite', o => o.put(value, key)),
        del: (key, s) => run(s, 'readwrite', o => o.delete(key)),
        keys: s => run(s, 'readonly', o => o.getAllKeys()),
        clear: s => run(s, 'readwrite', o => o.clear())
    };
    window.Vz2Offline = {
        download(url, expectedSize, onProgress, signal) {
            return new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                const abort = () => xhr.abort();
                const cleanup = () => signal?.removeEventListener('abort', abort);
                xhr.open('GET', url);
                xhr.responseType = 'blob';
                xhr.onprogress = event => {
                    const total = Number(expectedSize) > 0 ? Number(expectedSize) : (event.lengthComputable ? event.total : 0);
                    onProgress(total > 0 ? Math.min(99, Math.round(event.loaded / total * 100)) : null);
                };
                xhr.onload = () => {
                    cleanup();
                    if (xhr.status < 200 || xhr.status >= 300) return reject(new Error('Audio už není dostupné. Obnovte seznam.'));
                    if (!(xhr.response instanceof Blob) || xhr.response.size !== Number(expectedSize)) return reject(new Error('Audio se nestáhlo celé.'));
                    resolve(xhr.response);
                };
                xhr.onerror = () => { cleanup(); reject(new Error('Stažení audia selhalo.')); };
                xhr.onabort = () => { cleanup(); reject(new DOMException('Stažení bylo přerušeno.', 'AbortError')); };
                signal?.addEventListener('abort', abort, { once: true });
                if (signal?.aborted) { cleanup(); reject(new DOMException('Stažení bylo přerušeno.', 'AbortError')); }
                else xhr.send();
            });
        }
    };
}());
