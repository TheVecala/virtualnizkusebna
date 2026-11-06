/* Own choice menus keep the underlying select for forms and existing change handlers. */
(function () {
    'use strict';
    let active = null, serial = 0;
    const selectValue = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value');
    function close(restore = false) {
        if (!active) return;
        const old = active; active = null;
        old.popup.remove(); old.button.setAttribute('aria-expanded', 'false');
        if (restore && old.button.isConnected) old.button.focus({ preventScroll: true });
    }
    function position() {
        if (!active) return;
        if (!active.button.isConnected || !active.button.getClientRects().length) { close(); return; }
        const box = active.button.getBoundingClientRect(), viewport = window.visualViewport;
        const top = viewport?.offsetTop || 0, bottom = top + (viewport?.height || innerHeight);
        const left = viewport?.offsetLeft || 0, right = left + (viewport?.width || innerWidth);
        const above = box.top - top - 8, below = bottom - box.bottom - 8;
        const up = below < 180 && above > below, available = Math.max(60, Math.min(280, up ? above : below));
        const width = Math.min(Math.max(180, box.width), right - left - 16);
        const p = active.popup; p.style.width = width + 'px'; p.style.maxHeight = available + 'px';
        p.style.left = Math.max(left + 8, Math.min(box.left, right - width - 8)) + 'px';
        p.style.top = (up ? Math.max(top + 8, box.top - Math.min(available, p.scrollHeight) - 4) : box.bottom + 4) + 'px';
    }
    function enhance(select) {
        if (select.dataset.vz2Select || select.multiple || select.size > 1 || !select.parentNode) return;
        select.dataset.vz2Select = 'true';
        const wrapper = document.createElement('span'); wrapper.className = 'vz2-select';
        select.before(wrapper); wrapper.append(select);
        select.classList.add('vz2-select-native'); select.tabIndex = -1; select.setAttribute('aria-hidden', 'true');
        const button = document.createElement('button'); button.type = 'button'; button.className = 'vz2-select-button';
        button.setAttribute('aria-haspopup', 'listbox'); button.setAttribute('aria-expanded', 'false');
        wrapper.append(button);
        function sync() {
            const option = select.selectedOptions[0];
            button.textContent = option?.textContent?.trim() || 'Vybrat…';
            const associated = select.labels?.[0]?.cloneNode(true);
            associated?.querySelectorAll('select, .vz2-select').forEach(element => element.remove());
            const label = select.getAttribute('aria-label') || associated?.textContent?.trim() || select.name || 'Výběr';
            button.setAttribute('aria-label', label + ': ' + button.textContent);
            button.disabled = select.matches(':disabled');
        }
        Object.defineProperty(select, 'value', { configurable: true, get() { return selectValue.get.call(this); }, set(value) { selectValue.set.call(this, value); sync(); } });
        select.addEventListener('change', sync);
        select.form?.addEventListener('reset', () => setTimeout(sync, 0));
        select.addEventListener('focus', () => button.focus({ preventScroll: true }));
        new MutationObserver(sync).observe(select, { subtree: true, childList: true, characterData: true, attributes: true });
        button.addEventListener('click', () => {
            if (active?.select === select) { close(); return; }
            close(); sync(); if (button.disabled) return;
            const popup = document.createElement('div'); popup.className = 'vz2-select-popup'; popup.id = 'vz2-select-list-' + (++serial);
            popup.setAttribute('role', 'listbox'); popup.setAttribute('aria-label', select.getAttribute('aria-label') || 'Výběr');
            for (const option of select.options) {
                if (option.hidden || option.closest('optgroup[hidden]')) continue;
                const row = document.createElement('button'); row.type = 'button'; row.className = 'vz2-select-option'; row.setAttribute('role', 'option');
                row.textContent = option.textContent; row.disabled = option.disabled || !!option.closest('optgroup:disabled');
                row.setAttribute('aria-selected', String(option.selected)); row.tabIndex = -1;
                row.addEventListener('click', () => {
                    if (select.value !== option.value) { select.value = option.value; select.dispatchEvent(new Event('input', { bubbles: true })); select.dispatchEvent(new Event('change', { bubbles: true })); }
                    close(popup.contains(document.activeElement));
                });
                popup.append(row);
            }
            (button.closest('dialog[open]') || document.body).append(popup);
            active = { popup, button, select }; button.setAttribute('aria-controls', popup.id); button.setAttribute('aria-expanded', 'true'); position();
            (popup.querySelector('[aria-selected=true]:not(:disabled)') || popup.querySelector('button:not(:disabled)'))?.focus({ preventScroll: true });
        });
        sync();
    }
    function scan(node) {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches('select')) enhance(node);
        node.querySelectorAll('select').forEach(enhance);
    }
    document.addEventListener('pointerdown', event => { if (active && !active.popup.contains(event.target) && !active.button.contains(event.target)) close(); }, true);
    document.addEventListener('keydown', event => {
        if (!active) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        const rows = [...active.popup.querySelectorAll('button:not(:disabled)')]; if (!rows.length) return;
        event.preventDefault(); const current = rows.indexOf(document.activeElement);
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)));
        rows[index].focus();
    }, true);
    window.addEventListener('resize', position); window.visualViewport?.addEventListener('resize', position);
    document.addEventListener('scroll', event => { if (active && !active.popup.contains(event.target)) position(); }, true);
    document.addEventListener('DOMContentLoaded', () => {
        scan(document.documentElement);
        new MutationObserver(records => {
            records.forEach(record => record.addedNodes.forEach(scan));
            if (active && !active.button.isConnected) close();
        }).observe(document.body, { childList: true, subtree: true });
    });
})();
