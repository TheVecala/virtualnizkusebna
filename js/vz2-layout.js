(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const names = { recordings: 'Nahrávky', lyrics: 'Text a akordy', tablature: 'Mapa skladby', discussion: 'Diskuse' };
    const ids = Object.keys(names), prefix = window.VZ2.cachePrefix + 'layout:';
    const desktop = matchMedia('(min-width: 1200px)'), mobile = matchMedia('(max-width: 767px)');
    function read(key, fallback, valid) {
        try { const value = JSON.parse(localStorage.getItem(prefix + key)); return valid(value) ? value : fallback; }
        catch (_) { return fallback; }
    }
    const validId = id => ids.includes(id);
    const validSet = a => Array.isArray(a) && a.length > 0 && a.length <= 4 && a.every(validId) && new Set(a).size === a.length;
    let ideasOpen = false, activeWorkspace = 'panels', fullscreenPanel = null;
    const surfaces = new Map([...document.querySelectorAll('[data-workspace]')].map(panel => [panel.dataset.workspace, panel]));
    const fullscreenHandlers = new WeakMap();
    function setPanelFullscreen(panel) {
        if (fullscreenPanel === panel) panel = null;
        if (fullscreenPanel) {
            fullscreenPanel.classList.remove('panel-fullscreen');
            updateFullscreenButton(fullscreenPanel, false);
            fullscreenHandlers.get(fullscreenPanel)?.exit?.();
        }
        fullscreenPanel = panel;
        if (panel) {
            document.querySelectorAll('#player-options[open], #looper-options[open], #history-options[open], .shell-menu[open], .actions-menu[open], .collection-menu[open]').forEach(menu => menu.open = false);
            panel.classList.add('panel-fullscreen');
            updateFullscreenButton(panel, true);
            fullscreenHandlers.get(panel)?.enter?.();
        }
    }
    function updateFullscreenButton(panel, active) {
        const control = panel.querySelector('.panel-fullscreen-button');
        if (!control) return;
        const label = active ? 'Ukončit celou obrazovku' : 'Celá obrazovka';
        control.setAttribute('aria-label', label + ': ' + panel.getAttribute('aria-label'));
        control.setAttribute('aria-pressed', String(active));
        control.title = label;
        control.firstElementChild.className = active ? 'ti ti-minimize' : 'ti ti-maximize';
    }
    function addFullscreenButton(panel) {
        const header = panel.querySelector(':scope > .panel-header, :scope > .player-header');
        if (!header) return;
        const existing = header.querySelector('.panel-fullscreen-button');
        if (existing?.dataset.fullscreenBound) return;
        const control = existing || document.createElement('button');
        control.type = 'button'; control.className = 'panel-fullscreen-button';
        const icon = document.createElement('i'); icon.className = 'ti ti-maximize'; icon.setAttribute('aria-hidden', 'true');
        if (!existing) control.append(icon);
        control.dataset.fullscreenBound = 'true';
        control.addEventListener('click', () => setPanelFullscreen(panel));
        if (!existing) {
            if (panel.id === 'ideas-workspace') header.insertBefore(control, $('ideas-back'));
            else if (panel.id === 'history-workspace') header.insertBefore(control, $('history-close'));
            else header.append(control);
        }
        updateFullscreenButton(panel, false);
    }
    const state = {
        desktop: read('desktop', ids.slice(0, 3), validSet),
        tablet: read('tablet', ['recordings', 'lyrics'], a => validSet(a) && a.length === 2),
        mobile: read('mobile', 'recordings', validId)
    };
    function save(mode) { try { localStorage.setItem(prefix + mode, JSON.stringify(state[mode])); } catch (_) { /* Private mode / full storage: keep the in-memory choice. */ } }
    function mode() { return desktop.matches ? 'desktop' : mobile.matches ? 'mobile' : 'tablet'; }
    let catalogOpenedOnDesktop = false;
    function closeCatalog() { catalogOpenedOnDesktop = false; if ($('catalog-dialog').open) $('catalog-dialog').close(); }
    function openCatalog() {
        if ($('catalog-dialog').open) return;
        catalogOpenedOnDesktop = desktop.matches;
        if (desktop.matches) $('catalog-dialog-slot').append($('sidebar'));
        $('catalog-dialog').showModal();
    }
    function apply() {
        if (desktop.matches && $('catalog-dialog').open && !catalogOpenedOnDesktop) closeCatalog();
        const current = mode(), shown = current === 'mobile' ? [state.mobile] : state[current];
        if (fullscreenPanel && fullscreenPanel.id !== 'player-shell' &&
            (fullscreenPanel.closest('[data-workspace]')?.dataset.workspace !== activeWorkspace ||
            (fullscreenPanel.dataset.panel && !shown.includes(fullscreenPanel.dataset.panel)))) setPanelFullscreen(fullscreenPanel);
        document.body.dataset.layout = current;
        document.body.dataset.workspace = activeWorkspace;
        surfaces.forEach((panel, key) => panel.hidden = key !== activeWorkspace);
        document.querySelectorAll('[data-workspace-target]').forEach(control => control.setAttribute('aria-pressed', String(control.dataset.workspaceTarget === activeWorkspace)));
        $('show-history').setAttribute('aria-pressed', String(activeWorkspace === 'history'));
        $('desktop-panels').hidden = activeWorkspace === 'history';
        $('show-ideas').setAttribute('aria-pressed', String(ideasOpen));
        $('bn-napady').setAttribute('aria-pressed', String(ideasOpen));
        ids.forEach(id => {
            const panel = $('panel-' + id), select = panel.querySelector('select');
            panel.hidden = !shown.includes(id);
            panel.style.order = String(current === 'tablet' ? shown.indexOf(id) : ids.indexOf(id));
            select.value = id;
            select.setAttribute('aria-label', current === 'tablet' && shown.includes(id) ? (shown.indexOf(id) === 0 ? 'Levý panel' : 'Pravý panel') : 'Výběr panelu: ' + names[id]);
        });
        document.querySelectorAll('[data-desktop-panel]').forEach(b => {
            const selected = state.desktop.includes(b.dataset.desktopPanel);
            b.setAttribute('aria-pressed', String(selected));
            b.disabled = activeWorkspace === 'panels' && selected && state.desktop.length === 1;
        });
        document.querySelectorAll('[data-mobile-panel]').forEach(b => b.setAttribute('aria-pressed', String(activeWorkspace === 'panels' && b.dataset.mobilePanel === state.mobile)));
        const slot = $(desktop.matches && !$('catalog-dialog').open ? 'sidebar-slot' : 'catalog-dialog-slot');
        if ($('sidebar').parentElement !== slot) {
            closeCatalog(); slot.append($('sidebar'));
        }
    }
    ids.forEach(id => {
        addFullscreenButton($('panel-' + id));
        const select = document.createElement('select');
        for (const [value, label] of Object.entries(names)) { const o = document.createElement('option'); o.value = value; o.textContent = label; select.append(o); }
        select.addEventListener('change', async () => {
            const slot = state.tablet.indexOf(id), other = 1 - slot, next = select.value;
            if (slot < 0) return;
            if (id === 'tablature' && next !== id && state.tablet[other] !== next && !await window.Vz2SongMap.canLeave()) { select.value = id; return; }
            if (state.tablet[other] === next) state.tablet[other] = id;
            state.tablet[slot] = next; save('tablet'); apply();
            $('panel-' + next).querySelector('select').focus({ preventScroll: true });
        });
        const header = $('panel-' + id).querySelector('.panel-header');
        header.insertBefore(select, header.querySelector('.panel-header-actions') || header.querySelector('.panel-fullscreen-button'));
    });
    document.querySelectorAll('[data-desktop-panel]').forEach(b => b.addEventListener('click', async () => {
        if (activeWorkspace !== 'panels') { showWorkspace('panels'); return; }
        const id = b.dataset.desktopPanel;
        if (id === 'tablature' && state.desktop.includes(id) && state.desktop.length > 1 && !await window.Vz2SongMap.canLeave()) return;
        if (state.desktop.includes(id)) { if (state.desktop.length > 1) state.desktop = state.desktop.filter(x => x !== id); }
        else state.desktop.push(id);
        save('desktop'); apply();
    }));
    document.querySelectorAll('[data-mobile-panel]').forEach(b => b.addEventListener('click', async () => {
        if (state.mobile === 'tablature' && b.dataset.mobilePanel !== 'tablature' && !await window.Vz2SongMap.canLeave()) return;
        showWorkspace('panels');
        state.mobile = b.dataset.mobilePanel; save('mobile'); apply();
    }));
    $('catalog-picker').addEventListener('click', openCatalog);
    $('bn-skladby').addEventListener('click', openCatalog);
    $('catalog-close').addEventListener('click', closeCatalog);
    $('catalog-dialog').addEventListener('cancel', e => e.preventDefault());
    $('catalog-dialog').addEventListener('close', apply);
    $('bn-napady').addEventListener('click', () => $('show-ideas').click());
    $('create-collection-open')?.addEventListener('click', () => {
        const rehearsal = document.querySelector('[data-kind="rehearsal"]').getAttribute('aria-pressed') === 'true';
        $('create-collection-title').textContent = rehearsal ? 'Nová zkouška' : 'Nová skladba';
        $('create-collection').querySelector('.edit-error').textContent = '';
        $('create-collection-dialog').showModal();
    });
    $('create-collection-cancel')?.addEventListener('click', () => $('create-collection-dialog').close());
    document.querySelectorAll('[data-close-utility]').forEach(b => b.addEventListener('click', () => {
        $(b.dataset.closeUtility).hidden = true;
        $(b.dataset.closeUtility === 'activity' ? 'show-log' : 'show-offline')?.focus();
    }));
    document.querySelector('.shell-menu').addEventListener('click', e => {
        if (e.target.closest('button,a')) document.querySelector('.shell-menu').open = false;
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelector('.shell-menu').open = false; });
    document.addEventListener('click', e => { if (!e.target.closest('.shell-menu')) document.querySelector('.shell-menu').open = false; });
    const menuSelector = '.actions-menu, .collection-menu, #history-options';
    function placeCollectionMenu(menu) {
        const popover = menu.querySelector('.collection-menu-popover');
        if (!popover || !menu.open) return;
        const anchor = menu.querySelector('summary').getBoundingClientRect();
        const width = popover.getBoundingClientRect().width;
        const viewportTop = window.visualViewport?.offsetTop || 0;
        const viewportBottom = viewportTop + (window.visualViewport?.height || innerHeight);
        const panel = menu.closest('dialog')?.getBoundingClientRect();
        const upper = Math.max(viewportTop + 8, panel ? panel.top + 8 : viewportTop + 8);
        const lower = Math.min(viewportBottom - 8, panel ? panel.bottom - 8 : viewportBottom - 8);
        popover.style.maxHeight = Math.max(80, lower - upper) + 'px';
        const height = popover.getBoundingClientRect().height;
        const left = Math.max(8, Math.min(anchor.right - width, innerWidth - width - 8));
        const below = anchor.bottom + 6;
        const above = anchor.top - height - 6;
        let top = Math.max(upper, Math.min(anchor.top, lower - height));
        if (below + height <= lower) top = below;
        else if (above >= upper) top = above;
        popover.style.left = left + 'px';
        popover.style.top = top + 'px';
    }
    document.addEventListener('toggle', e => {
        if (!e.target.matches(menuSelector) || !e.target.open) return;
        document.querySelectorAll(menuSelector).forEach(menu => { if (menu !== e.target) menu.open = false; });
        if (e.target.matches('.collection-menu')) placeCollectionMenu(e.target);
    }, true);
    $('collections').addEventListener('scroll', () => {
        document.querySelectorAll('.collection-menu[open]').forEach(menu => menu.open = false);
    });
    window.addEventListener('resize', () => {
        document.querySelectorAll('.collection-menu[open]').forEach(placeCollectionMenu);
    });
    window.visualViewport?.addEventListener('resize', () => {
        document.querySelectorAll('.collection-menu[open]').forEach(placeCollectionMenu);
    });
    $('catalog-dialog').addEventListener('animationend', () => {
        document.querySelectorAll('.collection-menu[open]').forEach(placeCollectionMenu);
    });
    document.addEventListener('click', e => {
        document.querySelectorAll(menuSelector).forEach(menu => { if (!menu.contains(e.target)) menu.open = false; });
    });
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape' || document.querySelector('dialog[open]') || document.querySelector('.player-fullscreen')) return;
        const menu = document.querySelector('.actions-menu[open], .collection-menu[open], #history-options[open]');
        if (menu) { menu.open = false; menu.querySelector('summary').focus(); e.preventDefault(); }
    });
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape' || e.defaultPrevented || !fullscreenPanel || document.querySelector('dialog[open]')) return;
        const menu = fullscreenPanel.querySelector('details[open]');
        if (menu) { menu.open = false; menu.querySelector('summary').focus(); e.preventDefault(); return; }
        const control = fullscreenPanel.querySelector('.panel-fullscreen-button');
        setPanelFullscreen(fullscreenPanel); control.focus({ preventScroll: true }); e.preventDefault();
    });
    document.addEventListener('keydown', e => {
        if (e.key !== 'Tab' || !fullscreenPanel || document.querySelector('dialog[open]')) return;
        const controls = [...fullscreenPanel.querySelectorAll('button, input, select, textarea, a[href], summary, [tabindex]')]
            .filter(control => !control.disabled && control.tabIndex >= 0 && control.getClientRects().length);
        const first = controls[0], last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) { last?.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === last) { first?.focus(); e.preventDefault(); }
    });
    desktop.addEventListener('change', apply); mobile.addEventListener('change', apply);
    function showWorkspace(key) {
        if (!surfaces.has(key) || key === activeWorkspace) return;
        const wasIdeas = ideasOpen;
        activeWorkspace = key; ideasOpen = key === 'ideas';
        if (wasIdeas !== ideasOpen) window.Vz2Player?.setIdeasMode(ideasOpen);
        closeCatalog(); apply();
        document.dispatchEvent(new CustomEvent('vz2:workspace-changed', { detail: { workspace: key } }));
    }
    function hideIdeas(focus = true) {
        if (!ideasOpen) return;
        showWorkspace('panels');
        if (focus) $(mobile.matches ? 'bn-napady' : 'show-ideas').focus({ preventScroll: true });
    }
    document.querySelectorAll('[data-workspace-target]').forEach(control => control.addEventListener('click', () => {
        if (control.dataset.workspaceTarget === 'history') $('show-history').click();
        else showWorkspace(control.dataset.workspaceTarget);
    }));
    addFullscreenButton($('history-workspace'));
    window.Vz2Layout = {
        closeCatalog, hideIdeas, showWorkspace,
        registerFullscreen(panel, handlers = {}) { fullscreenHandlers.set(panel, handlers); addFullscreenButton(panel); },
        exitFullscreen(panel) { if (fullscreenPanel === panel) setPanelFullscreen(panel); },
        showIdeas() {
            if (ideasOpen) return;
            addFullscreenButton($('ideas-workspace')); showWorkspace('ideas');
            $('ideas-back').focus({ preventScroll: true });
        },
        revealRecording() {
            showWorkspace('panels');
            const current = mode();
            if (current === 'mobile') state.mobile = 'recordings';
            else if (!state[current].includes('recordings')) {
                if (current === 'tablet') state.tablet[0] = 'recordings'; else state.desktop.push('recordings');
            }
            save(current); apply();
        }
    };
    apply();
}());
