(function () {
    'use strict';

    function clock(seconds) {
        if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
        const total = Math.floor(seconds);
        const minutes = Math.floor(total / 60);
        const parts = [Math.floor(total % 60).toString().padStart(2, '0')];
        if (minutes >= 60) parts.unshift((minutes % 60).toString().padStart(2, '0'), Math.floor(minutes / 60).toString());
        else parts.unshift(minutes.toString().padStart(2, '0'));
        return parts.join(':');
    }

    function mount(audio, options = {}) {
        audio.controls = false;
        audio.hidden = true;
        audio.playsInline = true;
        const start = Number(options.start) || 0;
        const end = Number(options.end);
        const actionRow = options.actionRow;
        const root = document.createElement('div'); root.className = 'vz2-inline-player'; root.hidden = !!options.actionRow;
        const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'vz2-audio-trigger';
        const icon = document.createElement('span'); icon.className = 'vz2-audio-icon'; icon.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span'); label.textContent = 'Přehrát';
        const hint = document.createElement('small'); hint.className = 'vz2-audio-hint';
        trigger.append(icon, label, hint);
        trigger.setAttribute('aria-label', options.label || 'Přehrát nahrávku');
        const transport = document.createElement('div'); transport.className = 'vz2-audio-transport'; transport.hidden = true;
        const playPause = document.createElement('button'); playPause.type = 'button'; playPause.className = 'vz2-audio-play-pause';
        const current = document.createElement('output'); current.textContent = '0:00';
        const seek = document.createElement('input'); seek.type = 'range'; seek.min = '0'; seek.max = '1'; seek.step = '0.1'; seek.value = '0';
        seek.setAttribute('aria-label', 'Posun přehrávání');
        const duration = document.createElement('output'); duration.textContent = '0:00';
        const mute = document.createElement('button'); mute.type = 'button'; mute.className = 'vz2-audio-mute';
        const collapse = document.createElement('button'); collapse.type = 'button'; collapse.className = 'vz2-audio-collapse';
        collapse.textContent = '⌃'; collapse.setAttribute('aria-label', 'Sbalit přehrávač'); collapse.title = 'Sbalit přehrávač';
        if (actionRow) transport.append(playPause);
        transport.append(current, seek, duration, mute);
        if (!actionRow) transport.append(collapse);
        root.append(audio, transport);
        if (actionRow) actionRow.append(trigger);
        else root.prepend(trigger);

        function setOpen(open) {
            root.hidden = !open && !!actionRow;
            transport.hidden = !open;
            actionRow?.classList.toggle('is-player-open', open);
            refresh();
        }

        function length() {
            const available = Number.isFinite(audio.duration) ? audio.duration :
                (Number.isFinite(end) && end > start ? end : Number(options.knownDurationMs) / 1000);
            const finish = Number.isFinite(end) && end > start ? Math.min(end, available || end) : available;
            return Number.isFinite(finish) ? Math.max(0, finish - start) : 0;
        }
        function refresh() {
            const total = length();
            const position = Math.max(0, Math.min(total, (audio.currentTime || start) - start));
            seek.max = String(total || 1);
            if (document.activeElement !== seek) seek.value = String(position);
            seek.disabled = !total;
            current.textContent = clock(position);
            duration.textContent = clock(total);
            hint.textContent = total ? clock(total) : '';
            const expanded = actionRow && !root.hidden;
            icon.textContent = expanded ? '×' : audio.paused ? '▶' : '❚❚';
            label.textContent = expanded ? 'Zavřít' : audio.paused ? 'Přehrát' : 'Pozastavit';
            trigger.setAttribute('aria-label', (expanded ? 'Zavřít přehrávač' : audio.paused ? 'Přehrát' : 'Pozastavit') + (options.label ? ' ' + options.label : ' nahrávku'));
            playPause.textContent = audio.paused ? '▶' : '❚❚';
            playPause.setAttribute('aria-label', audio.paused ? 'Přehrát' : 'Pozastavit');
            mute.textContent = audio.muted ? '🔇' : '🔊';
            mute.setAttribute('aria-label', audio.muted ? 'Zapnout zvuk' : 'Ztlumit');
        }
        async function startPlayback() {
            if (start && (audio.currentTime < start || audio.currentTime >= start + length() - 0.05)) audio.currentTime = start;
            try { await audio.play(); }
            catch (_) { if (audio.paused) setOpen(false); }
        }
        trigger.addEventListener('click', () => {
            if (actionRow && !root.hidden) { audio.pause(); setOpen(false); return; }
            setOpen(true);
            if (!audio.paused) { audio.pause(); return; }
            startPlayback();
        });
        playPause.addEventListener('click', () => { if (audio.paused) startPlayback(); else audio.pause(); });
        seek.addEventListener('input', () => { audio.currentTime = start + Number(seek.value); current.textContent = clock(Number(seek.value)); });
        mute.addEventListener('click', () => { audio.muted = !audio.muted; refresh(); });
        collapse.addEventListener('click', () => { setOpen(false); trigger.focus(); });
        audio.addEventListener('play', () => {
            document.querySelectorAll('audio').forEach(other => { if (other !== audio) other.pause(); });
            window.MultitrackApp?.pause();
            setOpen(true);
        });
        ['pause', 'ended', 'timeupdate', 'durationchange', 'loadedmetadata', 'volumechange', 'seeked'].forEach(event => audio.addEventListener(event, refresh));
        refresh();
        return { root, trigger };
    }

    window.Vz2Audio = { mount };
}());
