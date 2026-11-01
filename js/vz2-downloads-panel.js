(function (root) {
    'use strict';
    const D = root.Vz2Downloads;
    const el = (tag, text) => { const n = document.createElement(tag); if (text != null) n.textContent = text; return n; };
    const size = n => (n / 1048576).toLocaleString('cs', { maximumFractionDigits: 1 }) + ' MB';
    const button = (label, fn) => { const b = el('button', label); b.type = 'button'; b.onclick = () => Promise.resolve().then(fn).catch(e => alert(e.message)); return b; };
    root.Vz2DownloadsPanel = {
        mount(host, getCatalog) {
            const status = el('p'), filter = el('select'), choices = el('div'), estimate = el('p'), queue = el('div'), stored = el('div'), usage = el('p');
            const selected = new Set(); let revision = 0, renderSerial = 0, lastInventory = '';
            host.replaceChildren(); host.classList.add('download-manager'); status.setAttribute('role', 'status');
            filter.setAttribute('aria-label', 'Zkouška nebo skladba ke stažení');
            const heading = el('h3', 'Uložit do zařízení');
            const add = button('Zařadit vybrané do fronty', async () => {
                const records = getCatalog()?.recordings.filter(r => selected.has(String(r.id))) || [];
                const plan = await D.plan(records);
                if (!plan.missing.length) { status.textContent = 'Vybrané soubory už jsou v zařízení.'; return; }
                if (!confirm('Stáhnout ' + plan.missing.length + ' souborů · ' + size(plan.missingBytes) + (plan.unknown ? ' + soubory s neznámou velikostí' : '') + '?')) return;
                plan.missing.forEach(f => { void D.enqueue(f); });
                status.textContent = 'Zařazeno do fronty. Zavření přehrávače stahování nezruší. Při opuštění stránky se přeruší.';
            });
            const all = button('Vybrat zobrazené', () => { records().forEach(r => selected.add(String(r.id))); showChoices(); });
            const none = button('Zrušit výběr', () => { selected.clear(); showChoices(); });
            host.append(heading, filter, all, none, choices, estimate, add, status, el('h3', 'Fronta stahování'), queue, el('h3', 'Soubory v zařízení'), usage, stored);
            function records() { return (getCatalog()?.recordings || []).filter(r => r.lifecycle === 'active' && (!filter.value || String(r.collection_id) === filter.value) && r.files?.some(f => f.url)); }
            async function showEstimate() {
                const serial = ++revision;
                try {
                    const plan = await D.plan((getCatalog()?.recordings || []).filter(r => selected.has(String(r.id))));
                    if (serial !== revision) return;
                    estimate.textContent = plan.total + ' souborů · ' + plan.stored + ' v zařízení · ke stažení ' + size(plan.missingBytes) + (plan.unknown ? ' + neznámá velikost' : '');
                    add.disabled = !plan.missing.length;
                } catch (e) { status.textContent = e.message; }
            }
            function showChoices() {
                choices.replaceChildren();
                for (const r of records()) {
                    const label = el('label'), box = el('input'); box.type = 'checkbox'; box.checked = selected.has(String(r.id));
                    box.onchange = () => { if (box.checked) selected.add(String(r.id)); else selected.delete(String(r.id)); void showEstimate(); };
                    const files = (r.files || []).filter(f => f.url);
                    label.append(box, document.createTextNode((r.title || r.files?.[0]?.original_name || 'Nahrávka ' + r.id) + ' · ' + files.length + ' souborů'));
                    choices.append(label);
                }
                void showEstimate();
            }
            function showQueue() {
                queue.replaceChildren();
                const labels = { queued: 'Čeká', checking: 'Ověřuji místní kopii', downloading: 'Stahuji', saving: 'Ukládám', complete: 'Uloženo', failed: 'Chyba', cancelled: 'Zrušeno', interrupted: 'Přerušeno' };
                for (const t of D.snapshot()) {
                    const row = el('div'); row.className = 'download-task';
                    row.append(el('span', (t.file.original_name || 'Audio ' + t.file.id) + ' · ' + labels[t.state] + (t.state === 'downloading' && t.progress != null ? ' ' + t.progress + ' %' : '') + (t.error ? ' · ' + t.error : '')));
                    if (['queued', 'checking', 'downloading', 'saving'].includes(t.state)) row.append(button('Zrušit', () => D.cancel(t.key)));
                    if (['failed', 'cancelled', 'interrupted'].includes(t.state)) row.append(button('Opakovat', () => { void D.enqueue(t.file); }));
                    queue.append(row);
                }
                if (!queue.childElementCount) queue.append(el('p', 'Fronta je prázdná.'));
                const fingerprint = D.snapshot().filter(t => ['complete', 'failed', 'cancelled'].includes(t.state)).map(t => t.key + t.state).join('|');
                if (fingerprint !== lastInventory) { lastInventory = fingerprint; void showStored(); void showEstimate(); }
            }
            async function showStored() {
                const serial = ++renderSerial;
                try {
                    const rows = await D.inventory(), space = await navigator.storage?.estimate?.();
                    if (serial !== renderSerial) return;
                    stored.replaceChildren();
                    const byKey = new Map(rows.map(r => [r.key, r]));
                    let text = rows.length + ' souborů · audio ' + size(rows.reduce((n, r) => n + r.size, 0));
                    if (space?.quota != null) text += ' · odhad volného prostoru webu ' + size(Math.max(0, space.quota - space.usage));
                    usage.textContent = text;
                    for (const r of getCatalog()?.recordings || []) {
                        const files = r.files || [], present = files.filter(f => byKey.has(D.key(f)));
                        if (present.length) stored.append(el('p', (r.title || 'Nahrávka ' + r.id) + ' · v zařízení ' + present.length + '/' + files.length + (present.length === files.length ? ' · kompletní' : ' · neúplná')));
                    }
                    for (const r of rows) {
                        const row = el('div'); row.className = 'download-task';
                        row.append(el('span', r.name + ' · ' + size(r.size)), button('Odebrat místní kopii', async () => {
                            if (!confirm('Odebrat pouze místní kopii „' + r.name + '“?')) return;
                            await D.removeKey(r.key); await showStored(); await showEstimate();
                        }), button('Uložit soubor do počítače', async () => {
                            const db = root.idbKeyval.createStore('zkusebna-vz2-cache', 'audio'), blob = await root.idbKeyval.get(r.key, db);
                            if (!(blob instanceof Blob)) throw Error('Místní kopie již není dostupná.');
                            const url = URL.createObjectURL(blob), a = el('a'); a.href = url; a.download = r.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
                        }));
                        stored.append(row);
                    }
                } catch (e) { status.textContent = 'Místní úložiště nelze načíst: ' + e.message; }
            }
            filter.onchange = () => { selected.clear(); showChoices(); };
            D.subscribe(showQueue);
            return { open() {
                filter.replaceChildren(new Option('Všechny zkoušky a skladby', ''));
                (getCatalog()?.collections || []).forEach(c => filter.add(new Option(c.title, String(c.id))));
                selected.clear(); showChoices(); showQueue(); void showStored();
            } };
        }
    };
})(window);
