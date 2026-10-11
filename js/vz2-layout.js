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
    let ideasOpen = false, activeWorkspace = 'songs', fullscreenPanel = null, collectionKind = 'song';
    let ideaSection = read('ideas:section', 'write', value => ['write', 'draw', 'speak'].includes(value));
    const isCollection = () => ['songs', 'rehearsals'].includes(activeWorkspace);
    const availableIds = () => collectionKind === 'rehearsal' ? ids.filter(id => id !== 'tablature') : ids;
    const panelName = id => id === 'lyrics' && collectionKind === 'rehearsal' ? 'Zápis ze zkoušky' : names[id];
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
        apply();
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
            header.append(control);
        }
        updateFullscreenButton(panel, false);
    }
    const states = {
        song: {
            desktop: read('song:desktop', read('desktop', ids.slice(0, 3), validSet), validSet),
            tablet: read('song:tablet', read('tablet', ['recordings', 'lyrics'], a => validSet(a) && a.length === 2), a => validSet(a) && a.length === 2),
            mobile: read('song:mobile', read('mobile', 'recordings', validId), validId)
        },
        rehearsal: {
            desktop: read('rehearsal:desktop', ['recordings', 'lyrics', 'discussion'], a => validSet(a) && !a.includes('tablature')),
            tablet: read('rehearsal:tablet', ['recordings', 'lyrics'], a => validSet(a) && a.length === 2 && !a.includes('tablature')),
            mobile: read('rehearsal:mobile', 'recordings', id => validId(id) && id !== 'tablature')
        }
    };
    let state = states.song;
    function save(mode) { try { localStorage.setItem(prefix + collectionKind + ':' + mode, JSON.stringify(state[mode])); } catch (_) { /* Keep the in-memory choice. */ } }
    function mode() { return desktop.matches ? 'desktop' : mobile.matches ? 'mobile' : 'tablet'; }
    let catalogOpenedOnDesktop = false;
    function closeCatalog() {
        catalogOpenedOnDesktop = false;
        if ($('catalog-dialog').open) $('catalog-dialog').close();
        $('catalog-picker').setAttribute('aria-expanded', 'false');
    }
    function placeCatalog() {
        if (!$('catalog-dialog').open) return;
        const anchor = $('catalog-picker').getBoundingClientRect();
        const viewportTop = window.visualViewport?.offsetTop || 0;
        const height = window.visualViewport?.height || innerHeight;
        const lower = viewportTop + height - (mobile.matches && height > 500 ? $('mobile-dock').offsetHeight + 8 : 8);
        const top = Math.max(viewportTop + 8, Math.min(anchor.bottom + 6, lower - 120));
        const available = Math.max(40, lower - top);
        $('catalog-dialog').style.setProperty('--catalog-top', top + 'px');
        $('catalog-dialog').style.setProperty('--catalog-height', available + 'px');
        $('catalog-dialog').style.setProperty('--catalog-left', Math.max(8, Math.min(anchor.left, innerWidth - 428)) + 'px');
    }
    function openCatalog() {
        if (!isCollection()) return;
        if ($('catalog-dialog').open) { closeCatalog(); return; }
        catalogOpenedOnDesktop = desktop.matches;
        $('catalog-dialog-slot').append($('sidebar'));
        $('catalog-dialog').showModal();
        $('catalog-picker').setAttribute('aria-expanded', 'true');
        placeCatalog(); $('catalog-search').focus();
    }
    function moveControls(id, slot) { const control = $(id), target = $(slot); if (control.parentElement !== target) target.append(control); }
    function apply() {
        if (desktop.matches && $('catalog-dialog').open && !catalogOpenedOnDesktop) closeCatalog();
        const current = mode(), shown = current === 'mobile' ? [state.mobile] : state[current], collection = isCollection();
        $('panel-lyrics').setAttribute('aria-label', panelName('lyrics'));
        $('panel-lyrics').querySelector('.panel-header h2').textContent = panelName('lyrics');
        updateFullscreenButton($('panel-lyrics'), fullscreenPanel === $('panel-lyrics'));
        document.querySelectorAll('[data-desktop-panel="lyrics"], [data-mobile-panel="lyrics"]').forEach(control => {
            control.textContent = collectionKind === 'rehearsal' ? 'Zápis' : 'Text';
            control.setAttribute('aria-label', panelName('lyrics'));
        });
        document.querySelectorAll('.panel-header select option').forEach(option => {
            option.textContent = panelName(option.value);
            option.hidden = option.disabled = !availableIds().includes(option.value);
        });
        if (fullscreenPanel && fullscreenPanel.id !== 'player-shell') {
            const surface = fullscreenPanel.closest('[data-workspace]')?.dataset.workspace;
            if ((surface === 'panels' ? !collection : surface !== activeWorkspace) ||
                (fullscreenPanel.dataset.panel && !shown.includes(fullscreenPanel.dataset.panel))) setPanelFullscreen(null);
        }
        document.body.dataset.layout = current;
        document.body.dataset.workspace = activeWorkspace;
        document.body.dataset.collectionKind = collectionKind;
        surfaces.forEach((panel, key) => panel.hidden = key === 'panels' ? !collection : key !== activeWorkspace);
        $('collection-header').hidden = !collection;
        $('sidebar-slot').hidden = !collection;
        $('song-workspace').setAttribute('aria-label', collectionKind === 'rehearsal' ? 'Pracovní plocha zkoušky' : 'Pracovní plocha skladby');
        document.querySelectorAll('[data-workspace-target]').forEach(control => control.setAttribute('aria-pressed', String(control.dataset.workspaceTarget === activeWorkspace)));
        const label = collectionKind === 'rehearsal' ? 'Zkoušky' : 'Skladby';
        $('catalog-heading').textContent = $('collection-kind-label').textContent = label;
        $('catalog-dialog').setAttribute('aria-label', label);
        $('catalog-picker').title = collectionKind === 'rehearsal' ? 'Vybrat zkoušku' : 'Vybrat skladbu';
        $('catalog-search').placeholder = collectionKind === 'rehearsal' ? 'Hledat zkoušku…' : 'Hledat skladbu…';
        $('mobile-panels').hidden = !collection;
        // Move the existing controls, preserving values and listeners at every breakpoint.
        moveControls('history-controls', mobile.matches && fullscreenPanel?.id !== 'history-workspace' ? 'mobile-context' : 'history-controls-slot');
        moveControls('ideas-controls', mobile.matches && fullscreenPanel?.id !== 'ideas-workspace' ? 'mobile-context' : 'ideas-controls-slot');
        $('history-controls').hidden = activeWorkspace !== 'history';
        $('ideas-controls').hidden = activeWorkspace !== 'ideas';
        document.querySelectorAll('[data-idea-section]').forEach(control => control.setAttribute('aria-pressed', String(control.dataset.ideaSection === ideaSection)));
        document.querySelectorAll('[data-idea-panel]').forEach(panel => panel.hidden = panel.dataset.ideaPanel !== ideaSection);
        ids.forEach(id => {
            const panel = $('panel-' + id), select = panel.querySelector('select');
            panel.hidden = !shown.includes(id) || !availableIds().includes(id);
            panel.style.order = String(current === 'tablet' ? shown.indexOf(id) : ids.indexOf(id));
            if (select) {
                select.value = id;
                select.setAttribute('aria-label', current === 'tablet' && shown.includes(id) ? (shown.indexOf(id) === 0 ? 'Levý panel' : 'Pravý panel') : 'Výběr panelu: ' + panelName(id));
            }
        });
        document.querySelectorAll('[data-desktop-panel]').forEach(b => {
            const selected = state.desktop.includes(b.dataset.desktopPanel);
            b.hidden = !availableIds().includes(b.dataset.desktopPanel);
            b.setAttribute('aria-pressed', String(selected));
            b.disabled = selected && state.desktop.length === 1;
        });
        document.querySelectorAll('[data-mobile-panel]').forEach(b => {
            b.hidden = !availableIds().includes(b.dataset.mobilePanel);
            b.setAttribute('aria-pressed', String(b.dataset.mobilePanel === state.mobile));
        });
        const slot = $(desktop.matches && !$('catalog-dialog').open ? 'sidebar-slot' : 'catalog-dialog-slot');
        if ($('sidebar').parentElement !== slot) { closeCatalog(); slot.append($('sidebar')); }
        placeCatalog();
    }
    ids.forEach(id => {
        addFullscreenButton($('panel-' + id));
        const select = document.createElement('select');
        for (const [value, label] of Object.entries(names)) { const o = document.createElement('option'); o.value = value; o.textContent = label; select.append(o); }
        select.addEventListener('change', async () => {
            const slot = state.tablet.indexOf(id), other = 1 - slot, next = select.value;
            if (slot < 0) return;
            if (state.tablet[other] === next) state.tablet[other] = id;
            state.tablet[slot] = next; save('tablet'); apply();
            $('panel-' + next).querySelector('select').focus({ preventScroll: true });
        });
        const header = $('panel-' + id).querySelector('.panel-header');
        header.insertBefore(select, header.querySelector('.panel-header-actions') || header.querySelector('.panel-fullscreen-button'));
    });
    document.querySelectorAll('[data-desktop-panel]').forEach(b => b.addEventListener('click', async () => {
        const id = b.dataset.desktopPanel;
        if (state.desktop.includes(id)) { if (state.desktop.length > 1) state.desktop = state.desktop.filter(x => x !== id); }
        else state.desktop.push(id);
        save('desktop'); apply();
    }));
    document.querySelectorAll('[data-mobile-panel]').forEach(b => b.addEventListener('click', async () => {
        state.mobile = b.dataset.mobilePanel; save('mobile'); apply();
    }));
    $('catalog-picker').addEventListener('click', openCatalog);
    $('catalog-close').addEventListener('click', closeCatalog);
    $('catalog-dialog').addEventListener('click', e => {
        if (e.target !== $('catalog-dialog')) return;
        const rect = e.target.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) closeCatalog();
    });
    $('catalog-dialog').addEventListener('close', () => { $('catalog-picker').setAttribute('aria-expanded', 'false'); apply(); });
    $('create-collection-open')?.addEventListener('click', () => {
        const rehearsal = collectionKind === 'rehearsal';
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
        if (key === 'panels') key = collectionKind === 'rehearsal' ? 'rehearsals' : 'songs';
        if (!['songs', 'rehearsals', 'history', 'ideas'].includes(key)) return;
        const changed = key !== activeWorkspace;
        activeWorkspace = key; ideasOpen = key === 'ideas';
        closeCatalog(); apply();
        if (changed) document.dispatchEvent(new CustomEvent('vz2:workspace-changed', { detail: { workspace: key } }));
    }
    function requestWorkspace(key) { document.dispatchEvent(new CustomEvent('vz2:workspace-request', { detail: { workspace: key } })); }
    function hideIdeas() { requestWorkspace(collectionKind === 'rehearsal' ? 'rehearsals' : 'songs'); }
    document.querySelectorAll('[data-workspace-target]').forEach(control => control.addEventListener('click', () => requestWorkspace(control.dataset.workspaceTarget)));
    document.querySelectorAll('[data-idea-section]').forEach(control => control.addEventListener('click', () => {
        ideaSection = control.dataset.ideaSection;
        try { localStorage.setItem(prefix + 'ideas:section', JSON.stringify(ideaSection)); } catch (_) { /* Keep the in-memory choice. */ }
        apply();
    }));
    window.addEventListener('resize', placeCatalog);
    window.visualViewport?.addEventListener('resize', placeCatalog);
    addFullscreenButton($('history-workspace'));
    addFullscreenButton($('ideas-workspace'));
    window.Vz2Layout = {
        closeCatalog, hideIdeas, showWorkspace,
        getWorkspace: () => activeWorkspace,
        setCollectionKind(kind) { collectionKind = kind === 'rehearsal' ? 'rehearsal' : 'song'; state = states[collectionKind]; apply(); },
        registerFullscreen(panel, handlers = {}) { fullscreenHandlers.set(panel, handlers); addFullscreenButton(panel); },
        exitFullscreen(panel) { if (fullscreenPanel === panel) setPanelFullscreen(null); },
        showIdeas() { showWorkspace('ideas'); },
        revealRecording() {
            showWorkspace(collectionKind === 'rehearsal' ? 'rehearsals' : 'songs');
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
