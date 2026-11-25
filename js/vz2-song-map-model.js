(function (root) {
    'use strict';
    const clone = value => JSON.parse(JSON.stringify(value));
    const id = () => Array.from(root.crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    const meters = {
        '2/4': [1, 1], '3/4': [1, 1, 1], '4/4': [1, 1, 1, 1],
        '5/4': [1, 1, 1, 1, 1], '6/4': [1, 1, 1, 1, 1, 1],
        '6/8': [3, 3], '7/8': [2, 2, 3], '9/8': [3, 3, 3]
    };
    function meterFor(key) {
        const [numerator, denominator] = key.split('/').map(Number);
        return { numerator, denominator, groups: [...meters[key]] };
    }
    function fromLegacy(bar) {
        if (bar.kind) return bar;
        return {
            id: bar.id, kind: bar.special || 'rhythm', base: bar.base,
            meter: null, marks: bar.crash ? [{ unit: 1, state: null, crash: true }] : [],
            unresolved_fill: bar.fill || null, detail: bar.detail
        };
    }
    function label(bar) {
        const { kind, base, meter, marks, unresolved_fill } = fromLegacy(bar);
        if (kind !== 'rhythm') return { unknown: 'Neurčený takt', pause: 'Pauza', stop: 'Stop' }[kind];
        return [
            base === 'ride' ? 'Ride' : base === 'hihat' ? 'Hi-hat' : 'Přechod',
            meter && meter.numerator + '/' + meter.denominator,
            unresolved_fill && 'F' + unresolved_fill,
            ...marks.map(({ unit, state, crash }) => unit + '. pozice: ' +
                [state === 'fill' ? 'přechod' : state === 'pause' ? 'pauza' : '', crash ? 'crash' : ''].filter(Boolean).join(' + '))
        ].filter(Boolean).join(', ');
    }
    function collectDetails(sections) {
        const details = new Map();
        let number = 0;
        for (const section of sections) {
            for (const bar of section.bars) {
                number++;
                if (!bar.detail.trim()) continue;
                if (!details.has(bar.detail)) details.set(bar.detail, []);
                details.get(bar.detail).push({ id: bar.id, number, section: section.name });
            }
        }
        return details;
    }
    class Draft {
        constructor(map = null) { this.reset(map); }
        reset(map) {
            this.map = map === null ? null : clone(map);
            if (this.map?.schema_version === 1) {
                this.map.schema_version = 2;
                this.map.sections.forEach(section => { section.bars = section.bars.map(fromLegacy); });
            }
            this.saved = JSON.stringify(this.map);
            this.history = []; this.selected = null;
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
            const snapshot = { map: clone(this.map), selected: this.selected };
            fn();
            if (JSON.stringify(snapshot.map) !== JSON.stringify(this.map)) {
                this.history.push(snapshot); if (this.history.length > 100) this.history.shift();
            }
        }
        create() { this.change(() => { this.map = { schema_version: 2, sections: [] }; }); }
        nextName(name) {
            const base = name.trim().replace(/\s+\d+$/, '');
            const matches = this.sections.filter(s => s.name.replace(/\s+\d+$/, '') === base);
            if (!matches.length) return ['Sloka', 'Refrén'].includes(base) ? base + ' 1' : base;
            const last = Math.max(...matches.map(s => Number(s.name.match(/\s+(\d+)$/)?.[1] || 1)));
            return base + ' ' + (last + 1);
        }
        recordBar(base, sectionName) {
            if (!this.map) return false;
            this.change(() => {
                let section = this.sections.at(-1);
                if (sectionName || !section) {
                    section = { id: id(), name: sectionName ? this.nextName(sectionName) : 'Bez sekce', bars: [] };
                    this.sections.push(section);
                }
                const bar = {
                    id: id(), kind: 'rhythm', base, meter: null, marks: [],
                    unresolved_fill: null, detail: ''
                };
                section.bars.push(bar);
                this.selected = bar.id;
            });
            return true;
        }
        addSection(name) {
            const section = { id: id(), name: this.nextName(name), bars: [] };
            this.change(() => this.sections.push(section));
            return section.id;
        }
        insertBar(sectionId, index, value) {
            const section = this.sections.find(item => item.id === sectionId);
            if (!section || index < 0 || index > section.bars.length) return;
            const bar = { ...clone(value), id: id() };
            this.change(() => {
                section.bars.splice(index, 0, bar);
                this.selected = bar.id;
            });
            return bar.id;
        }
        replaceBar(barId, value) {
            const found = this.find(barId);
            if (found) this.change(() => { found.section.bars[found.index] = { ...clone(value), id: barId }; });
        }
        copyBar(sourceId, sectionId, index, count = 1) {
            const source = this.find(sourceId);
            const section = this.sections.find(item => item.id === sectionId);
            if (!source || !section || index < 0 || index > section.bars.length || !Number.isInteger(count) || count < 1) return;
            const total = this.sections.reduce((sum, item) => sum + item.bars.length, 0);
            if (total + count > 8192) return;
            const copies = Array.from({ length: count }, () => ({ ...clone(source.bar), id: id() }));
            this.change(() => {
                section.bars.splice(index, 0, ...copies);
                this.selected = copies[copies.length - 1].id;
            });
            return this.selected;
        }
        removeBar() {
            const found = this.find(); if (!found) return;
            this.change(() => {
                found.section.bars.splice(found.index, 1);
                this.selected = found.section.bars[Math.min(found.index, found.section.bars.length - 1)]?.id || null;
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
            this.map = snapshot.map; this.selected = snapshot.selected;
        }
    }
    const exported = { Draft, meters, meterFor, fromLegacy, label, collectDetails };
    if (typeof module !== 'undefined' && module.exports) module.exports = exported;
    else root.Vz2SongMapModel = exported;
}(typeof window === 'undefined' ? globalThis : window));
