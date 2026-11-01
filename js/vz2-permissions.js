(function () {
    'use strict';
    const originals = new WeakMap();
    const reason = 'K této akci nemáte oprávnění.';
    window.Vz2Permissions = {
        set(control, allowed) {
            if (!control) return control;
            const locked = !allowed;
            if (locked && !originals.has(control)) originals.set(control, { title: control.getAttribute('title'), label: control.getAttribute('aria-label') });
            control.classList.toggle('permission-locked', locked);
            control.disabled = locked;
            if (locked) {
                const original = originals.get(control);
                const label = original.label || control.textContent.trim();
                control.title = reason;
                control.setAttribute('aria-label', label + ' — ' + reason);
                control.setAttribute('aria-disabled', 'true');
                if (!control.querySelector('.permission-lock')) {
                    const icon = document.createElement('i');
                    icon.className = 'ti ti-lock permission-lock'; icon.setAttribute('aria-hidden', 'true'); control.append(icon);
                }
            } else if (originals.has(control)) {
                const original = originals.get(control);
                for (const [name, value] of [['title', original.title], ['aria-label', original.label]]) {
                    if (value === null) control.removeAttribute(name); else control.setAttribute(name, value);
                }
                control.removeAttribute('aria-disabled'); control.querySelector('.permission-lock')?.remove(); originals.delete(control);
            }
            return control;
        }
    };
    // Also block synthetic clicks if a busy-state reset temporarily enables a control.
    document.addEventListener('click', event => {
        if (event.target.closest?.('.permission-locked')) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    document.addEventListener('submit', event => {
        if (event.submitter?.classList.contains('permission-locked')) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
})();
