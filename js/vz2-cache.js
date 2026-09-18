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
}());
