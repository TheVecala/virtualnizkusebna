(function() {
    'use strict';
    var button = document.getElementById('nav-multitrack');
    var modeButtons = document.querySelectorAll('[data-workspace-mode]');
    var mobileMode = document.getElementById('workspace-mode-mobile');
    var workspace = document.getElementById('mt-workspace');
    if (!button || !workspace) return;
    var area = document.getElementById('content-area'), main = document.getElementById('main');
    var store = document.getElementById('mt-panel-store'), slots = ['nahravky', 'text', 'tabelatura'];
    var ordinary = {}, multitrack = {}, states = {}, active = false, selected = null, discussionSerial = 0;
    var ordinaryMode = VZ.sekce === 'zkousky' ? 'zkousky' : 'skladby';
    var panelModes = {
        skladby: { text: 'text', tabelatura: 'tabelatura' },
        zkousky: { text: 'text', tabelatura: 'tabelatura' },
        multitrack: { text: 'obsah', tabelatura: 'popis' }
    };
    var labelElements = document.querySelectorAll('#nav-text, #nav-tabelatura, #bn-text, #bn-tabelatura, #bottom-nav-tab [data-panel="text"], #bottom-nav-tab [data-panel="tabelatura"]');
    var originalLabels = Array.from(labelElements, function(el) { return el.innerHTML; });
    slots.forEach(function(slot) {
        ordinary[slot] = document.getElementById('panel-' + slot);
        multitrack[slot] = document.getElementById('mt-panel-' + slot);
    });

    function snapshot() {
        return {
            panels: Array.from(area.children, function(el) { return { id: el.id, style: el.getAttribute('style'), mobile: el.classList.contains('mob-active') }; }),
            left: area.dataset.left, right: area.dataset.right, ideas: area.hasAttribute('data-napady-open'),
            mobile: VZ.aktivniMobPanel, tablet: Object.assign({}, VZ.tabPanels),
            nav: Array.from(document.querySelectorAll('.bnav, #nav-napady-tab'), function(el) { return el.classList.contains('active'); })
        };
    }
    function stateKey(mode) { return 'vz-workspace-panels-' + mode; }
    function saveState(mode) {
        states[mode] = snapshot();
        try { sessionStorage.setItem(stateKey(mode), JSON.stringify(states[mode])); } catch (error) { /* Volitelná UI paměť. */ }
    }
    function savedState(mode) {
        if (states[mode]) return states[mode];
        try { states[mode] = JSON.parse(sessionStorage.getItem(stateKey(mode))) || null; } catch (error) { states[mode] = null; }
        return states[mode];
    }
    function restore(state) {
        if (state) {
            state.panels.forEach(function(saved) {
                var el = document.getElementById(saved.id);
                if (!el) return;
                if (saved.style === null) el.removeAttribute('style'); else el.setAttribute('style', saved.style);
                el.classList.toggle('mob-active', saved.mobile);
            });
            area.dataset.left = state.left || 'nahravky';
            area.dataset.right = state.right || 'text';
            area.toggleAttribute('data-napady-open', state.ideas);
            VZ.aktivniMobPanel = state.mobile;
            VZ.tabPanels = state.tablet;
            document.querySelectorAll('.bnav, #nav-napady-tab').forEach(function(el, i) { el.classList.toggle('active', state.nav[i]); });
        } else {
            area.dataset.left = 'nahravky'; area.dataset.right = 'text';
            area.removeAttribute('data-napady-open');
            VZ.tabPanels = { left: 'nahravky', right: 'text' };
            VZ.aktivniMobPanel = 'nahravky';
            Array.from(area.children).forEach(function(el) { el.removeAttribute('style'); el.classList.toggle('mob-active', el.id === 'panel-nahravky'); });
            document.querySelectorAll('.bnav, #nav-napady-tab').forEach(function(el) {
                el.classList.toggle('active', el.id === 'bn-nahravky' ||
                    (el.closest('#tab-footer-left') && el.dataset.panel === 'nahravky') ||
                    (el.closest('#tab-footer-right') && el.dataset.panel === 'text'));
            });
        }
        // The viewport can change while this view is detached.
        if (window.innerWidth < 1200) {
            Array.from(area.children).forEach(function(el) {
                el.style.display = '';
                el.classList.toggle('mob-active', window.innerWidth < 768 && el.id === 'panel-' + VZ.aktivniMobPanel);
            });
        }
        syncDesktopNavigation();
    }
    function labels(mode) {
        var definitions = panelModes[mode];
        labelElements.forEach(function(el, index) {
            if (mode !== 'multitrack') { el.innerHTML = originalLabels[index]; return; }
            var contents = el.id === 'nav-text' || el.id === 'bn-text' || el.dataset.panel === 'text';
            Array.from(el.childNodes).filter(function(n) { return n.nodeType === Node.TEXT_NODE; }).forEach(function(n) { n.remove(); });
            var icon = el.querySelector('img');
            if (icon) { icon.src = contents ? 'meat/ikona_text.png' : 'meat/ikona_diskuse.png'; icon.alt = ''; }
            el.appendChild(document.createTextNode(contents ? definitions.text : definitions.tabelatura));
        });
        document.getElementById('topbar-val').textContent = mode === 'multitrack' ? (selected ? selected.name : 'Vybrat multitrack') : VZ.aktualniNazev;
        document.getElementById('diskuse-val-label').textContent = mode === 'multitrack' ? (selected ? selected.name : '') : VZ.aktualniNazev;
    }
    function syncModeNavigation(mode) {
        modeButtons.forEach(function(control) {
            var current = control.dataset.workspaceMode === mode;
            if (control.tagName === 'BUTTON') control.setAttribute('aria-pressed', String(current));
            if (current) control.setAttribute('aria-current', 'page'); else control.removeAttribute('aria-current');
        });
        if (mobileMode) mobileMode.value = mode;
        document.body.dataset.workspaceMode = mode;
    }
    function stopOrdinaryWorkspace() {
        document.querySelectorAll('audio').forEach(function(audio) { audio.pause(); });
        if (typeof wavesurfer !== 'undefined' && wavesurfer) wavesurfer.pause();
        if (typeof looperZavrit === 'function') looperZavrit();
        else {
            if (typeof cancelPendingLooperOpen === 'function') cancelPendingLooperOpen();
            if (typeof looperFullscreenToggle === 'function') looperFullscreenToggle(false);
        }
        document.getElementById('val-drawer').classList.remove('open');
    }
    function loadDiscussion(done) {
        var token = ++discussionSerial, body = document.getElementById('body-diskuse');
        body.textContent = selected ? 'Načítám diskusi…' : 'Vyberte multitrack ze seznamu.';
        if (!selected) { if (done) done(); else pbDone(); return; }
        $.get('php/ajax/ajax_diskuse.php', { multitrack_id: selected.id }, function(html) {
            if (active && token === discussionSerial) body.innerHTML = html;
        }).fail(function() {
            if (active && token === discussionSerial) body.textContent = 'Diskusi se nepodařilo načíst.';
        }).always(function() { if (done) done(); else pbDone(); });
    }
    function showMultitrack(open) {
        if (open === active) return;
        saveState(active ? 'multitrack' : ordinaryMode);
        active = open;
        discussionSerial++;
        if (open) {
            stopOrdinaryWorkspace();
            slots.forEach(function(slot) {
                ordinary[slot].replaceWith(multitrack[slot]);
                multitrack[slot].id = 'panel-' + slot;
            });
            document.getElementById('multitrack').appendChild(area);
            window.MultitrackApp.refreshList().catch(function() { /* Player displays its error. */ });
        } else {
            window.MultitrackApp.pause();
            slots.forEach(function(slot) {
                multitrack[slot].replaceWith(ordinary[slot]);
                multitrack[slot].id = 'mt-panel-' + slot;
                store.appendChild(multitrack[slot]);
            });
            main.appendChild(area);
        }
        document.body.classList.toggle('view-multitrack', open);
        workspace.hidden = !open;
        var mode = open ? 'multitrack' : ordinaryMode;
        syncModeNavigation(mode);
        labels(mode);
        restore(savedState(mode));
        nacistPanel('diskuse');
    }
    function showPanel(slot) {
        if (!active) return;
        if (window.innerWidth < 768) mobilePanel(slot, document.getElementById('bn-' + slot));
        else if (window.innerWidth < 1200) {
            if (area.hasAttribute('data-napady-open') || (area.dataset.left !== slot && area.dataset.right !== slot)) {
                tabletPick('right', slot, document.querySelector('#tab-footer-right [data-panel="' + slot + '"]'));
            }
        } else if (!$('#panel-' + slot).is(':visible')) toggleDesktopPanel(slot, document.getElementById('nav-' + slot));
    }
    window.VZWorkspace = {
        isMultitrack: function() { return active; }, loadDiscussion: loadDiscussion, showPanel: showPanel,
        ordinaryBody: function(slot) {
            return ordinary[slot] ? ordinary[slot].querySelector('#body-' + slot) : document.getElementById('body-' + slot);
        }
    };
    modeButtons.forEach(function(control) {
        control.addEventListener('click', function(event) {
            var target = control.dataset.workspaceMode;
            var current = active ? 'multitrack' : ordinaryMode;
            if (target === current) { event.preventDefault(); return; }
            if (target === 'multitrack') { event.preventDefault(); showMultitrack(true); return; }
            if (active && target === ordinaryMode) { event.preventDefault(); showMultitrack(false); return; }
            if (active) { window.MultitrackApp.pause(); saveState('multitrack'); }
            else { stopOrdinaryWorkspace(); saveState(ordinaryMode); }
        });
    });
    if (mobileMode) mobileMode.addEventListener('change', function() {
        var target = mobileMode.value;
        var current = active ? 'multitrack' : ordinaryMode;
        if (target === current) return;
        if (target === 'multitrack') showMultitrack(true);
        else if (active && target === ordinaryMode) showMultitrack(false);
        else {
            if (active) { window.MultitrackApp.pause(); saveState('multitrack'); }
            else { stopOrdinaryWorkspace(); saveState(ordinaryMode); }
            window.location.href = 'index.php?sekce=' + (target === 'zkousky' ? 'zkousky' : 'uploads');
        }
    });
    document.addEventListener('multitrack:selected', function() {
        var state = window.MultitrackApp.getState();
        selected = state ? { id: state.id, name: state.name } : null;
        if (selected) $.post('php/ajax/ulozit_pracovni_polozku.php', { id: selected.id });
        if (active) { labels('multitrack'); nacistPanel('diskuse'); }
    });
    syncModeNavigation(ordinaryMode);
    restore(savedState(ordinaryMode));
    if (new URL(window.location.href).searchParams.get('view') === 'multitrack') showMultitrack(true);
})();
