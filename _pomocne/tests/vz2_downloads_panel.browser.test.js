'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
(async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath() });
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
        const read = file => fs.readFileSync(path.join(root, file), 'utf8');
        await page.setContent(`<meta name="viewport" content="width=device-width, initial-scale=1"><style>${read('css/vz2.css')}\n${read('css/vz2-workspaces.css')}\n${read('css/vz2-select.css')}</style><section id="offline-files"><div class="offline-files-list"></div><div class="offline-footer"><button id="offline-clear">Odebrat vše</button></div></section><script>
            window.Vz2Downloads = { inventory: async () => [{ key:'1', name:'soubor-01.wav', size:1000 }], plan: async () => ({ total:0, stored:0, missing:[], missingBytes:0, unknown:0 }), snapshot: () => [], subscribe: () => {}, key: f => String(f.id) };
            window.fixture = { collections: [{id:1,title:'Skladba'}], recordings: [{id:1,collection_id:1,lifecycle:'active',title:'Jiný popisek',files:[{id:1,url:'file',original_name:'soubor-01.wav'}]}] };
            </script><script>${read('js/vz2-select.js')}</script><script>${read('js/vz2-downloads-panel.js')}</script><script>document.addEventListener('DOMContentLoaded', () => window.Vz2DownloadsPanel.mount(document.querySelector('.offline-files-list'), () => window.fixture).open());</script>`);
        const sections = page.locator('.download-section');
        await sections.first().getByText('soubor-01.wav', { exact: false }).waitFor();
        assert.deepEqual(await sections.locator('h3').allTextContents(), ['Soubory v zařízení', 'Uložit do zařízení', 'Fronta stahování']);
        assert.equal(await sections.first().locator('#offline-clear').count(), 1);
        assert.equal(await sections.first().getByText('Jiný popisek', { exact: false }).count(), 0);
        assert(!(await sections.first().innerText()).includes('odhad volného'));
        const label = sections.nth(1).locator('.download-choices label');
        assert((await label.innerText()).includes('soubor-01.wav')); assert(!(await label.innerText()).includes('Jiný popisek'));
        const geometry = await label.evaluate(el => { const label = el.getBoundingClientRect(), box = el.querySelector('input').getBoundingClientRect(); return { left: box.left - label.left, width: box.width }; });
        assert(geometry.left < 10 && geometry.width <= 20);
        await label.locator('input').check(); assert(await label.locator('input').isChecked());
        await sections.nth(1).locator('.vz2-select-button').click(); await page.getByRole('option', { name:'Skladba', exact:true }).click();
        assert.equal(await sections.nth(1).locator('select').inputValue(), '1');
        console.log('PASS offline panel: sections, file names, compact choices and own filter menu');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
