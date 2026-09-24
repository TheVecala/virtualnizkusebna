(function () {
    'use strict';
    const $ = id => document.getElementById(id);
    const names = { recordings: 'Nahrávky', lyrics: 'Text a akordy', tablature: 'Tabulatura', discussion: 'Diskuse' };
    const ids = Object.keys(names), prefix = window.VZ2.cachePrefix + 'layout:';
    const desktop = matchMedia('(min-width: 1200px)'), mobile = matchMedia('(max-width: 767px)');
    function read(key, fallback, valid) {
        try { const value = JSON.parse(localStorage.getItem(prefix + key)); return valid(value) ? value : fallback; }
        catch (_) { return fallback; }
    }
    const validId = id => ids.includes(id);
    const validSet = a => Array.isArray(a) && a.length > 0 && a.length <= 4 && a.every(validId) && new Set(a).size === a.length;
    let ideasOpen = false;
    const state = {
        desktop: read('desktop', ids.slice(0, 3), validSet),
        tablet: read('tablet', ['recordings', 'lyrics'], a => validSet(a) && a.length === 2),
        mobile: read('mobile', 'recordings', validId)
    };
    function save(mode) { try { localStorage.setItem(prefix + mode, JSON.stringify(state[mode])); } catch (_) { /* Private mode / full storage: keep the in-memory choice. */ } }
    function mode() { return desktop.matches ? 'desktop' : mobile.matches ? 'mobile' : 'tablet'; }
    function closeCatalog() { if ($('catalog-dialog').open) $('catalog-dialog').close(); }
    function openCatalog() { if (!desktop.matches && !$('catalog-dialog').open) $('catalog-dialog').showModal(); }
    function apply() {
        const current = mode(), shown = current === 'mobile' ? [state.mobile] : state[current];
        document.body.dataset.layout = current;
        document.body.dataset.workspace = ideasOpen ? 'ideas' : 'panels';
        $('content-area').hidden = ideasOpen;
        $('ideas-workspace').hidden = !ideasOpen;
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
            b.disabled = !ideasOpen && selected && state.desktop.length === 1;
        });
        document.querySelectorAll('[data-mobile-panel]').forEach(b => b.setAttribute('aria-pressed', String(!ideasOpen && b.dataset.mobilePanel === state.mobile)));
        const slot = $(desktop.matches ? 'sidebar-slot' : 'catalog-dialog-slot');
        if ($('sidebar').parentElement !== slot) {
            closeCatalog(); slot.append($('sidebar'));
        }
    }
    ids.forEach(id => {
        const select = document.createElement('select');
        for (const [value, label] of Object.entries(names)) { const o = document.createElement('option'); o.value = value; o.textContent = label; select.append(o); }
        select.addEventListener('change', () => {
            const slot = state.tablet.indexOf(id), other = 1 - slot, next = select.value;
            if (slot < 0) return;
            if (state.tablet[other] === next) state.tablet[other] = id;
            state.tablet[slot] = next; save('tablet'); apply();
            $('panel-' + next).querySelector('select').focus({ preventScroll: true });
        });
        $('panel-' + id).querySelector('.panel-header').append(select);
    });
    document.querySelectorAll('[data-desktop-panel]').forEach(b => b.addEventListener('click', () => {
        if (ideasOpen) { hideIdeas(); return; }
        const id = b.dataset.desktopPanel;
        if (state.desktop.includes(id)) { if (state.desktop.length > 1) state.desktop = state.desktop.filter(x => x !== id); }
        else state.desktop.push(id);
        save('desktop'); apply();
    }));
    document.querySelectorAll('[data-mobile-panel]').forEach(b => b.addEventListener('click', () => {
        hideIdeas(false);
        state.mobile = b.dataset.mobilePanel; save('mobile'); apply();
    }));
    $('catalog-picker').addEventListener('click', openCatalog);
    $('bn-skladby').addEventListener('click', openCatalog);
    $('catalog-close').addEventListener('click', closeCatalog);
    $('catalog-dialog').addEventListener('cancel', e => e.preventDefault());
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
    const menuSelector = '.actions-menu, .collection-menu';
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
        const menu = document.querySelector('.actions-menu[open], .collection-menu[open]');
        if (menu) { menu.open = false; menu.querySelector('summary').focus(); e.preventDefault(); }
    });
    desktop.addEventListener('change', apply); mobile.addEventListener('change', apply);
    function hideIdeas(focus = true) {
        if (!ideasOpen) return;
        ideasOpen = false; window.Vz2Player?.setIdeasMode(false); apply();
        if (focus) $(mobile.matches ? 'bn-napady' : 'show-ideas').focus({ preventScroll: true });
    }
    window.Vz2Layout = {
        closeCatalog, hideIdeas,
        showIdeas() {
            if (ideasOpen) return;
            ideasOpen = true; closeCatalog(); window.Vz2Player?.setIdeasMode(true); apply();
            $('ideas-back').focus({ preventScroll: true });
        },
        revealRecording() {
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
