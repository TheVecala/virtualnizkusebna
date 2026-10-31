/* A transport adapter supplies canPlay/currentTimeMs/playRange/pause. */
(function (root) {
    'use strict';
    let active = null, serial = 0, busy = false;
    const notify = () => document.dispatchEvent(new Event('vz2:timestamp-playback'));
    const api = root.Vz2TimestampPlayback = {
        state: () => active,
        stop() { serial++; active = null; notify(); },
        async play(adapter, item, { repeat = false, owner = null, onError = () => {} } = {}) {
            if (repeat && item.end_ms === null) throw Error('Nejprve doplňte konec úseku.');
            api.stop(); const token = serial;
            root.Vz2TimestampStore.select({ recording_id: item.recording_id, item_id: item.id });
            await adapter.playRange(item.start_ms, item.end_ms);
            if (token !== serial || owner?.dead) return;
            active = { adapter, item, owner, repeat, onError }; notify();
        }
    };
    root.Vz2TimestampStore.subscribe(list => {
        if (!active || Number(list.recording_id) !== Number(active.item.recording_id)) return;
        const next = root.Vz2TimestampModel.items(list).find(i => i.id === active.item.id);
        if (!next || active.repeat && next.end_ms === null) api.stop();
        else active.item = next;
    });
    setInterval(async () => {
        const state = active;
        if (!state || busy || state.adapter.isLoading?.()) return;
        if (!state.adapter.canPlay()) { api.stop(); return; }
        if (state.item.end_ms === null || state.adapter.currentTimeMs() < state.item.end_ms) return;
        if (!state.repeat) { state.adapter.pause?.(); api.stop(); return; }
        busy = true;
        try { await state.adapter.playRange(state.item.start_ms, state.item.end_ms); }
        catch (e) { if (active === state) api.stop(); state.onError(e.message); }
        finally { busy = false; }
    }, 25);
})(window);
