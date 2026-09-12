(function() {
    'use strict';
    var button = document.getElementById('nav-multitrack');
    var workspace = document.getElementById('mt-workspace');
    if (!button || !workspace) return;

    function showMultitrack(open) {
        if (open) {
            document.querySelectorAll('audio').forEach(function(audio) { audio.pause(); });
            if (typeof wavesurfer !== 'undefined' && wavesurfer) wavesurfer.pause();
            if (typeof cancelPendingLooperOpen === 'function') cancelPendingLooperOpen();
            if (typeof looperFullscreenToggle === 'function') looperFullscreenToggle(false);
            document.getElementById('val-drawer').classList.remove('open');
            if (window.MultitrackApp) window.MultitrackApp.refreshList().catch(function() { /* Player displays the request error. */ });
        } else if (window.MultitrackApp) {
            window.MultitrackApp.pause();
        }
        document.body.classList.toggle('view-multitrack', open);
        workspace.hidden = !open;
        button.setAttribute('aria-pressed', String(open));
        button.textContent = open ? 'Zpět do zkušebny' : 'Multitracky';
    }
    button.addEventListener('click', function() { showMultitrack(workspace.hidden); });
    // Opening a normal panel from the topbar returns to the existing directory view.
    document.querySelectorAll('.topnav a[id^="nav-"]').forEach(function(link) {
        link.addEventListener('click', function() { showMultitrack(false); }, true);
    });
    if (new URL(window.location.href).searchParams.get('view') === 'multitrack') showMultitrack(true);
})();
