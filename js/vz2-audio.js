(function () {
    'use strict';
    const iconPaths = {
        play: '<path d="M7 4v16l13-8z" fill="currentColor" stroke="none"/>',
        pause: '<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/>',
        x: '<path d="M5 5l14 14M19 5L5 19"/>',
        'wave-sine': '<path d="M2 12c3 0 3-8 6-8s3 16 6 16 3-8 8-8"/>',
        download: '<path d="M12 3v12m-5-5 5 5 5-5M4 18v3h16v-3"/>',
        'device-floppy': '<path d="M4 3h13l3 3v15H4zM7 3v6h10V3M7 21v-8h10v8"/>',
        'timeline-event': '<path d="M4 3v18M4 6h14l3 4-3 4H4"/>',
        car: '<path d="M5 11 7 5h10l2 6M4 11h16v8H4zM7 19v2m10-2v2M7 15h2m6 0h2"/>',
        dots: '<circle cx="5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.7" fill="currentColor" stroke="none"/>',
        'adjustments-horizontal': '<path d="M3 6h5m4 0h9M3 18h9m4 0h5M3 12h12m4 0h2"/><circle cx="10" cy="6" r="2"/><circle cx="14" cy="18" r="2"/><circle cx="17" cy="12" r="2"/>',
        'player-track-prev': '<path d="M5 4v16M19 5 7 12l12 7z"/>',
        'player-skip-back': '<path d="M12 5 4 12l8 7V5Zm8 0-8 7 8 7V5Z"/>',
        'player-skip-forward': '<path d="m4 5 8 7-8 7V5Zm8 0 8 7-8 7V5Z"/>',
        repeat: '<path d="M4 8V6a2 2 0 0 1 2-2h12l-3-3m3 3-3 3M20 16v2a2 2 0 0 1-2 2H6l3 3m-3-3 3-3"/>',
        volume: '<path d="M4 9v6h4l5 4V5L8 9H4Zm12 0a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12"/>',
        'volume-off': '<path d="M4 9v6h4l5 4V5L8 9H4ZM17 9l5 6m0-6-5 6"/>'
    };
    function icon(name) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
        svg.classList.add('vz2-action-icon'); svg.innerHTML = iconPaths[name];
        return svg;
    }
    function changeIcon(svg, name) { svg.innerHTML = iconPaths[name]; }

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
        const inlineControls = !!options.inlineControls;
        const compactLooper = !!options.compactLooper;
        const root = document.createElement('div'); root.className = 'vz2-inline-player'; root.hidden = !!actionRow;
        if (inlineControls) root.classList.add('has-visible-controls');
        if (compactLooper) root.classList.add('is-compact-looper');
        const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'vz2-audio-trigger';
        const triggerIcon = compactLooper ? icon('play') : document.createElement('span');
        triggerIcon.classList.add('vz2-audio-icon'); triggerIcon.setAttribute('aria-hidden', 'true');
        const label = document.createElement('span'); label.textContent = 'Přehrát';
        const hint = document.createElement('small'); hint.className = 'vz2-audio-hint';
        trigger.append(triggerIcon, label, hint);
        trigger.setAttribute('aria-label', options.label || (actionRow ? 'Otevřít přehrávač' : 'Přehrát nahrávku'));
        const transport = document.createElement('div'); transport.className = 'vz2-audio-transport'; transport.hidden = !inlineControls;
        const playPause = document.createElement('button'); playPause.type = 'button'; playPause.className = 'vz2-audio-play-pause';
        const current = document.createElement('output'); current.textContent = '0:00';
        const seek = document.createElement('input'); seek.type = 'range'; seek.min = '0'; seek.max = '1'; seek.step = '0.1'; seek.value = '0';
        seek.setAttribute('aria-label', 'Posun přehrávání');
        const duration = document.createElement('output'); duration.textContent = '0:00';
        const mute = document.createElement('button'); mute.type = 'button'; mute.className = 'vz2-audio-mute';
        const transportButton = (className, iconName, label) => {
            const control = document.createElement('button'); control.type = 'button'; control.className = className;
            const symbol = icon(iconName);
            control.append(symbol); control.setAttribute('aria-label', label); control.title = label;
            return control;
        };
        const restart = compactLooper ? transportButton('vz2-audio-restart', 'player-track-prev', 'Na začátek') : null;
        const back = compactLooper ? transportButton('vz2-audio-back', 'player-skip-back', 'Zpět o 5 sekund') : null;
        const forward = compactLooper ? transportButton('vz2-audio-forward', 'player-skip-forward', 'Vpřed o 5 sekund') : null;
        const loop = compactLooper ? transportButton('vz2-audio-loop', 'repeat', 'Opakovat nahrávku') : null;
        const collapse = document.createElement('button'); collapse.type = 'button'; collapse.className = 'vz2-audio-collapse';
        collapse.textContent = '⌃'; collapse.setAttribute('aria-label', 'Sbalit přehrávač'); collapse.title = 'Sbalit přehrávač';
        if (compactLooper) {
            const progress = document.createElement('div'); progress.className = 'vz2-audio-progress';
            progress.append(current, seek, duration);
            const controls = document.createElement('div'); controls.className = 'vz2-audio-controls';
            controls.append(restart, back, playPause, forward, loop, mute);
            playPause.append(icon('play'));
            mute.append(icon('volume'));
            transport.append(progress, controls);
        } else {
            if (actionRow || inlineControls) transport.append(playPause);
            transport.append(current, seek, duration, mute);
            if (!actionRow && !inlineControls) transport.append(collapse);
        }
        root.append(audio, transport);
        if (actionRow) actionRow.append(trigger);
        else if (!inlineControls) root.prepend(trigger);

        function setOpen(open) {
            root.hidden = !open && !!actionRow;
            transport.hidden = !open && !inlineControls;
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
            if (compactLooper) changeIcon(triggerIcon, expanded ? 'x' : audio.paused ? 'play' : 'pause');
            else triggerIcon.textContent = expanded ? '×' : audio.paused ? '▶' : '❚❚';
            label.textContent = expanded ? 'Zavřít' : actionRow ? 'Otevřít' : audio.paused ? 'Přehrát' : 'Pozastavit';
            const triggerAction = actionRow ? (expanded ? 'Zavřít přehrávač' : 'Otevřít přehrávač') : audio.paused ? 'Přehrát' : 'Pozastavit';
            trigger.setAttribute('aria-label', triggerAction + (options.label ? ' ' + options.label : ' nahrávku'));
            trigger.title = trigger.getAttribute('aria-label');
            if (compactLooper) changeIcon(playPause.firstElementChild, audio.paused ? 'play' : 'pause');
            else playPause.textContent = audio.paused ? '▶' : '❚❚';
            playPause.setAttribute('aria-label', audio.paused ? 'Přehrát' : 'Pozastavit');
            playPause.title = playPause.getAttribute('aria-label');
            if (compactLooper) changeIcon(mute.firstElementChild, audio.muted ? 'volume-off' : 'volume');
            else mute.textContent = audio.muted ? '🔇' : '🔊';
            mute.setAttribute('aria-label', audio.muted ? 'Zapnout zvuk' : 'Ztlumit');
            mute.title = mute.getAttribute('aria-label');
            mute.setAttribute('aria-pressed', String(audio.muted));
            if (loop) loop.setAttribute('aria-pressed', String(audio.loop));
        }
        async function startPlayback() {
            if (start && (audio.currentTime < start || audio.currentTime >= start + length() - 0.05)) audio.currentTime = start;
            try { await audio.play(); }
            catch (_) { if (audio.paused) setOpen(false); }
        }
        trigger.addEventListener('click', () => {
            window.Vz2Timestamps?.stopLoop();
            if (actionRow) { const open = root.hidden; audio.pause(); setOpen(open); return; }
            setOpen(true);
            if (!audio.paused) { audio.pause(); return; }
            startPlayback();
        });
        playPause.addEventListener('click', () => { window.Vz2Timestamps?.stopLoop(); if (audio.paused) startPlayback(); else audio.pause(); });
        seek.addEventListener('input', () => { window.Vz2Timestamps?.stopLoop(); audio.currentTime = start + Number(seek.value); current.textContent = clock(Number(seek.value)); });
        if (compactLooper) {
            const jump = seconds => { window.Vz2Timestamps?.stopLoop(); audio.currentTime = start + Math.max(0, Math.min(length(), (audio.currentTime || start) - start + seconds)); };
            restart.addEventListener('click', () => { window.Vz2Timestamps?.stopLoop(); audio.currentTime = start; });
            back.addEventListener('click', () => jump(-5));
            forward.addEventListener('click', () => jump(5));
            loop.addEventListener('click', () => { window.Vz2Timestamps?.stopLoop(); audio.loop = !audio.loop; refresh(); });
        }
        mute.addEventListener('click', () => { audio.muted = !audio.muted; refresh(); });
        collapse.addEventListener('click', () => { window.Vz2Timestamps?.stopLoop(); setOpen(false); trigger.focus(); });
        audio.addEventListener('play', () => {
            document.querySelectorAll('audio').forEach(other => { if (other !== audio) other.pause(); });
            window.MultitrackApp?.pause();
            setOpen(true);
        });
        ['pause', 'ended', 'timeupdate', 'durationchange', 'loadedmetadata', 'volumechange', 'seeked'].forEach(event => audio.addEventListener(event, refresh));
        refresh();
        return { root, trigger };
    }

    window.Vz2Audio = { mount, icon };
}());
