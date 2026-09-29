(function (root) {
    'use strict';
    const clone = value => JSON.parse(JSON.stringify(value));
    const id = () => Array.from(root.crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    const types = [
        ['HH+CRASH', 'hihat', 0, true, null], ['HI-HAT', 'hihat', 0, false, null],
        ['HH+F1', 'hihat', 1, false, null], ['HH+F2', 'hihat', 2, false, null], ['HH+F3', 'hihat', 3, false, null],
        ['RD+CRASH', 'ride', 0, true, null], ['RIDE', 'ride', 0, false, null],
        ['RD+F1', 'ride', 1, false, null], ['RD+F2', 'ride', 2, false, null], ['RD+F3', 'ride', 3, false, null],
        ['F4', null, 4, false, null], ['?', null, 0, false, 'unknown'],
        ['Pauza', null, 0, false, 'pause'], ['Stop', null, 0, false, 'stop']
    ].map(([name, base, fill, crash, special]) => ({ name, base, fill, crash, special }));
    const semantic = type => ({ base: type.base, fill: type.fill, crash: type.crash, special: type.special });
    class Draft {
        constructor(map = null) { this.reset(map); }
        reset(map) {
            this.map = map === null ? null : clone(map); this.saved = JSON.stringify(this.map);
            this.history = []; this.selected = null; this.pending = null;
        }
        get dirty() { return JSON.stringify(this.map) !== this.saved; }
        get sections() { return this.map?.sections || []; }
        find(barId = this.selected) {
            for (const section of this.sections) {
                const index = section.bars.findIndex(bar => bar.id === barId);
                if (index >= 0) return { section, bar: section.bars[index], index };
            }
            return null;
        }
        change(fn) {
            const snapshot = { map: clone(this.map), selected: this.selected, pending: this.pending };
            fn();
            if (JSON.stringify(snapshot.map) !== JSON.stringify(this.map)) {
                this.history.push(snapshot); if (this.history.length > 100) this.history.shift();
            }
        }
        create() { this.change(() => { this.map = { schema_version: 1, sections: [] }; }); }
        nextName(name) {
            const base = name.trim().replace(/\s+\d+$/, '');
            const matches = this.sections.filter(s => s.name.replace(/\s+\d+$/, '') === base);
            if (!matches.length) return ['Sloka', 'Refrén'].includes(base) ? base + ' 1' : base;
            const last = Math.max(...matches.map(s => Number(s.name.match(/\s+(\d+)$/)?.[1] || 1)));
            return base + ' ' + (last + 1);
        }
        queue(name) { this.pending = this.nextName(name); }
        append(type) {
            if (!this.map) return false;
            // Undo the first bar of a pending section returns to the previous section.
            const pending = this.pending; this.pending = null;
            this.change(() => {
                let section = this.sections[this.sections.length - 1];
                if (pending) { section = { id: id(), name: pending, bars: [] }; this.sections.push(section); }
                else if (!section) { section = { id: id(), name: 'Bez sekce', bars: [] }; this.sections.push(section); }
                const bar = { id: id(), ...semantic(type), detail: '' }; section.bars.push(bar); this.selected = bar.id;
            });
            return true;
        }
        setType(type, barId = this.selected) {
            const found = this.find(barId); if (found) this.change(() => Object.assign(found.bar, semantic(type)));
        }
        insert(after) {
            const found = this.find(); if (!found) return;
            this.change(() => {
                const bar = { id: id(), ...semantic(types.find(t => t.special === 'unknown')), detail: '' };
                found.section.bars.splice(found.index + (after ? 1 : 0), 0, bar); this.selected = bar.id;
            });
        }
        removeBar() {
            const found = this.find(); if (!found) return;
            this.change(() => {
                found.section.bars.splice(found.index, 1);
                this.selected = found.section.bars[Math.min(found.index, found.section.bars.length - 1)]?.id || null;
                if (!found.section.bars.length) this.map.sections.splice(this.sections.indexOf(found.section), 1);
            });
        }
        moveBar(delta) {
            const found = this.find(); if (!found) return;
            const target = found.index + delta; if (target < 0 || target >= found.section.bars.length) return;
            this.change(() => { const [bar] = found.section.bars.splice(found.index, 1); found.section.bars.splice(target, 0, bar); });
        }
        moveSection(sectionId, delta) {
            const index = this.sections.findIndex(s => s.id === sectionId), target = index + delta;
            if (index < 0 || target < 0 || target >= this.sections.length) return;
            this.change(() => { const [section] = this.sections.splice(index, 1); this.sections.splice(target, 0, section); });
        }
        rename(sectionId, name) {
            const section = this.sections.find(s => s.id === sectionId); if (section) this.change(() => { section.name = name; });
        }
        duplicate(sectionId) {
            const index = this.sections.findIndex(s => s.id === sectionId); if (index < 0) return;
            this.change(() => {
                const copy = clone(this.sections[index]); copy.id = id(); copy.name = this.nextName(copy.name);
                copy.bars.forEach(bar => { bar.id = id(); }); this.sections.splice(index + 1, 0, copy);
            });
        }
        removeSection(sectionId) {
            this.change(() => { this.map.sections = this.sections.filter(s => s.id !== sectionId); if (!this.find()) this.selected = null; });
        }
        setDetail(barId, text) { const found = this.find(barId); if (found) this.change(() => { found.bar.detail = text; }); }
        copyDetail(sourceId, targets) {
            const source = this.find(sourceId); if (!source) return;
            const text = source.bar.detail;
            this.change(() => targets.forEach(target => { const found = this.find(target); if (found) found.bar.detail = text; }));
        }
        undo() {
            const snapshot = this.history.pop(); if (!snapshot) return;
            this.map = snapshot.map; this.selected = snapshot.selected; this.pending = snapshot.pending;
        }
    }
    const exported = { Draft, types };
    if (typeof module !== 'undefined' && module.exports) module.exports = exported;
    else root.Vz2SongMapModel = exported;
}(typeof window === 'undefined' ? globalThis : window));
