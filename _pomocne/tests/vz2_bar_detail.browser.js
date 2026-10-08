'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { template } = require('../../js/vz2-bar-detail');
module.exports = async ({ base, clients, good, request, db, check, temp }) => {
    const song = await good('admin', { action: 'collection_create', kind: 'song', title: 'Detail — acceptance' });
    const endpoint = 'php/ajax/vz2_content.php';
    const initial = { schema_version: 1, sections: [{ id: 'a'.repeat(32), name: 'Sloka', bars: [0,1].map(i => ({ id: String(i + 1).repeat(32), base: 'hihat', fill: 0, crash: false, special: null, detail: '' })) }] };
    const saved = (await request(clients.admin, endpoint, { action: 'document_save', kind: 'song_map', collection_id: song.id, document_id: null, current_revision: 0, body: JSON.stringify(initial) })).json();
    const getMap = async () => (await request(clients.admin, endpoint + '?' + new URLSearchParams({ action: 'document', kind: 'song_map', collection_id: song.id }))).json();
    const versions = () => db('SELECT COUNT(*) n FROM vz2_document_versions WHERE document_id=?', [saved.document.id])[0].n;
    const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath() });
    const errors = [];
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    const [name, value] = clients.admin.cookie.split('='); await context.addCookies([{ name, value, url: base }]);
    await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
    const dialog = name => page.getByRole('dialog', { name, exact: true });
    const detail = dialog('Detail taktu'), text = detail.locator('textarea'), meter = detail.getByLabel('Metrum pro předvyplnění', { exact: true });
    const bars = page.locator('#tablature-content .song-map-bar');
    const open = async (index = 0) => { await bars.nth(index).click(); await detail.waitFor(); };
    const close = async () => { await detail.getByRole('button', { name: 'Zrušit', exact: true }).click(); };
    const discard = async () => { await close(); await dialog('Neuložený detail').getByRole('button', { name: 'Zahodit změny', exact: true }).click(); await detail.waitFor({ state: 'hidden' }); };
    const save = async () => { await detail.getByRole('button', { name: 'Uložit detail', exact: true }).click(); await detail.waitFor({ state: 'hidden' }); };
    const selection = async (start, end = start) => { await text.focus(); await text.evaluate((el, [a,b]) => el.setSelectionRange(a,b), [start,end]); };
    const seed = async (value, start, end = start) => { await text.fill(value); await selection(start,end); };
    const paste = async value => { await page.evaluate(value => navigator.clipboard.writeText(value), value); await text.press('Control+v'); };
    try {
        await page.goto(base + 'index.php?v=2&collection_id=' + song.id); await bars.first().waitFor();
        await open(); assert.equal(await text.inputValue(), ''); assert.equal(await meter.inputValue(), '4/4'); assert.equal(versions(), 1);
        await close(); assert.equal(await detail.count(), 0); assert.equal(versions(), 1);
        await open(); await detail.getByRole('button', { name: 'Předvyplnit', exact: true }).click();
        assert.equal(await text.inputValue(), template('4/4')); assert.equal(await page.locator('#tablature-content .song-map-bar.has-detail').count(), 0); assert.equal(versions(), 1);
        await text.press('Control+z'); assert.equal(await text.inputValue(), ''); assert.equal(await detail.getByRole('status').textContent(), 'Uloženo');
        await text.press('Control+Shift+z'); assert.equal(await text.inputValue(), template('4/4'));
        await discard(); assert.equal(versions(), 1);
        await open(); await meter.selectOption('7/8'); await close(); await open(1); assert.equal(await meter.inputValue(), '7/8'); assert.equal(await text.inputValue(), ''); await close();
        await page.reload(); await bars.first().waitFor(); await open(); assert.equal(await meter.inputValue(), '7/8');
        await seed('moje poznámka', 4); await meter.selectOption('6/8'); assert.equal(await text.inputValue(), 'moje poznámka');
        await detail.getByRole('button', { name: 'Předvyplnit', exact: true }).click(); await dialog('Předvyplnit detail').getByRole('button', { name: 'Zrušit', exact: true }).click();
        assert.equal(await text.inputValue(), 'moje poznámka');
        await text.fill('   '); await detail.getByRole('button', { name: 'Předvyplnit', exact: true }).click(); await dialog('Předvyplnit detail').getByRole('button', { name: 'Nahradit', exact: true }).click();
        assert.equal(await text.inputValue(), template('6/8')); await text.press('Control+z'); assert.equal(await text.inputValue(), '   ');
        await text.press('Control+Shift+z'); await save(); assert.equal(versions(), 2); assert(await bars.first().evaluate(el => el.classList.contains('has-detail')));
        await open(); assert.equal(await text.inputValue(), template('6/8')); await meter.selectOption('3/4'); await close(); assert.equal(versions(), 2);
        check(true, 'detail: empty open, explicit templates, confirmation/undo, meter session preference and SQL save/reopen');

        await open();
        const cases = [
            ['----',1,'x','-x--',2], ['abcd',2,'Delete','ab d',2], ['abcd',2,'Backspace','a cd',1],
            ['ab\ncd',2,'Delete','ab\ncd',2], ['ab\ncd',3,'Backspace','ab\ncd',3],
            ['abcd',1,'X','aXd',2,3], ['abcd',1,'Delete','ad',1,3], ['abcd',2,'Enter','ab\ncd',3],
            ['😀e\u0301--',2,'x','😀x--',3], ['👨‍👩‍👧‍👦x',0,'Delete',' x',0]
        ];
        for (const [value,start,key,expected,cursor,end = start] of cases) {
            await seed(value,start,end); await text.press(key); assert.equal(await text.inputValue(), expected, key + ' ' + value);
            assert.equal(await text.evaluate(el => el.selectionStart),cursor);
            if (expected !== value) { await text.press('Control+z'); assert.equal(await text.inputValue(),value); await text.press('Control+Shift+z'); assert.equal(await text.inputValue(),expected); }
        }
        for (const [value,start,pasted,expected,end = start] of [
            ['abcd',1,'XY','aXYd'], ['ab\ncd',1,'XYZ','aXYZ\ncd'], ['abcd',2,'X\nY','abX\nYcd'], ['abcd',1,'X','aXd',3],
            ['ab\ncd',1,'TOM\n  ř <script>','aTOM\n  ř <script>d',4]
        ]) { await seed(value,start,end); await paste(pasted); assert.equal(await text.inputValue(), expected); await text.press('Control+z'); assert.equal(await text.inputValue(),value); }
        await seed('abcd',1,3); await text.press('Control+x'); assert.equal(await text.inputValue(),'ad'); await text.press('Control+z'); assert.equal(await text.inputValue(),'abcd');
        await text.press('Control+a'); await paste('new\n  text'); assert.equal(await text.inputValue(),'new\n  text');
        await seed('abcd',2); await text.press('ArrowLeft'); await text.press('Shift+ArrowRight'); assert.deepEqual(await text.evaluate(el => [el.selectionStart,el.selectionEnd]),[1,2]);
        await text.press('Tab'); assert.notEqual(await page.evaluate(() => document.activeElement.tagName),'TEXTAREA');
        // Chromium's actual composition path via CDP, plus a non-cancelable mobile input fallback.
        const cdp = await context.newCDPSession(page);
        await seed('----',1); await cdp.send('Input.imeSetComposition', { text: 'ř', selectionStart: 1, selectionEnd: 1 }); await cdp.send('Input.insertText', { text: 'ř' });
        await page.waitForTimeout(30); assert.equal(await text.inputValue(),'-ř--'); await text.press('Control+z'); assert.equal(await text.inputValue(),'----');
        await seed('----',1); await text.evaluate(el => {
            el.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: 'ž', bubbles: true, cancelable: false }));
            el.setRangeText('ž',1,1,'end'); el.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: 'ž', bubbles: true }));
        }); assert.equal(await text.inputValue(),'-ž--'); await text.press('Control+z'); assert.equal(await text.inputValue(),'----');
        await seed('abcd',2); await text.evaluate(el => {
            el.dispatchEvent(new InputEvent('beforeinput', { inputType: 'deleteContentBackward', bubbles: true, cancelable: false }));
            el.setRangeText('',1,2,'end'); el.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));
        }); assert.equal(await text.inputValue(),'a cd');
        await discard();
        check(true, 'detail: native Chromium typing, deletion, selection, real clipboard/cut, undo/redo, CDP composition and non-cancelable input fallback');

        await open(); await text.fill(''); assert(await bars.first().evaluate(el => el.classList.contains('has-detail')));
        const fail = route => route.request().method() === 'POST' ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'Test save failure' }) }) : route.continue();
        await page.route('**/php/ajax/vz2_content.php',fail);
        await close(); await dialog('Neuložený detail').getByRole('button', { name: 'Uložit', exact: true }).click();
        await detail.getByRole('alert').getByText('Test save failure', { exact: true }).waitFor();
        assert.equal(await text.inputValue(),''); assert(await bars.first().evaluate(el => el.classList.contains('has-detail'))); assert.equal(versions(),2);
        await page.unroute('**/php/ajax/vz2_content.php',fail); await save(); assert.equal(versions(),3); assert(!await bars.first().evaluate(el => el.classList.contains('has-detail')));
        await open(); await text.fill(' \n\t '); await save(); assert.equal(versions(),4); assert(!await bars.first().evaluate(el => el.classList.contains('has-detail')));
        const literal = '  ř  <script>alert(1)</script>\n\nTOM | --x--\n ';
        await open(); await text.fill(literal); await save(); await open(); assert.equal(await text.inputValue(),literal); assert.equal(await detail.locator('script').count(),0);
        assert.equal(JSON.parse((await getMap()).version.body).sections[0].bars[0].detail,literal);
        await selection(2,8); const before = await text.evaluate(el => [el.value,el.selectionStart,el.selectionEnd]);
        for (let i=0;i<6;i++) await detail.getByRole('button', { name: 'Zvětšit písmo', exact: true }).click();
        assert(await detail.getByRole('button', { name: 'Zvětšit písmo', exact: true }).isDisabled());
        assert.deepEqual(await text.evaluate(el => [el.value,el.selectionStart,el.selectionEnd]),before);
        for (let i=0;i<8;i++) await detail.getByRole('button', { name: 'Zmenšit písmo', exact: true }).click();
        assert(await detail.getByRole('button', { name: 'Zmenšit písmo', exact: true }).isDisabled());
        assert.deepEqual(await text.evaluate(el => [el.value,el.selectionStart,el.selectionEnd]),before); await close(); assert.equal(versions(),5);
        await open(); await text.fill('Navigation draft');
        const leave = page.evaluate(() => window.Vz2SongMap.canLeave(-1));
        await dialog('Neuložené změny').getByRole('button', { name: 'Zůstat', exact: true }).click(); assert.equal(await leave,false); assert.equal(await text.inputValue(),'Navigation draft');
        const leaveSave = page.evaluate(() => window.Vz2SongMap.canLeave(-1));
        await dialog('Neuložené změny').getByRole('button', { name: 'Uložit', exact: true }).click(); assert.equal(await leaveSave,true); assert.equal(versions(),6);
        check(true, 'detail: failed save keeps draft and indicator, successful empty/whitespace save clears indicator, exact safe text, font bounds/selection and navigation guard');

        await open(); await text.fill('Reload draft');
        const unload = page.waitForEvent('dialog');
        const reload = page.reload({ timeout: 5000 }).catch(() => null);
        const warning = await unload; assert.equal(warning.type(), 'beforeunload'); await warning.dismiss(); await reload;
        assert.equal(await text.inputValue(), 'Reload draft'); await discard();
        // Clean details close with navigation, so an old modal cannot cover another song.
        await open(); assert.equal(await page.evaluate(() => window.Vz2SongMap.canLeave(-1)), true); await detail.waitFor({state:'hidden'});

        // A competing SQL revision must never be silently overwritten by the detail save.
        await open(); await text.fill('local conflict');
        const latest = await getMap(); const rival = JSON.parse(latest.version.body); rival.sections[0].bars[0].detail = 'other writer';
        assert.equal((await request(clients.admin,endpoint,{ action: 'document_save', kind: 'song_map', collection_id: song.id, document_id: latest.document.id, current_revision: latest.document.current_revision, body: JSON.stringify(rival) })).status,200);
        await detail.getByRole('button', { name: 'Uložit detail', exact: true }).click(); await detail.getByRole('button', { name: 'Porovnat aktuální verzi', exact: true }).waitFor();
        assert.equal(await text.inputValue(),'local conflict'); assert.equal(JSON.parse((await getMap()).version.body).sections[0].bars[0].detail,'other writer'); await discard();
        await page.reload(); await bars.first().waitFor();
        await page.setViewportSize({width:390,height:844}); await page.locator('[data-mobile-panel=tablature]').click();
        await open(); await text.fill('HH | ' + '-'.repeat(160));
        assert(await text.evaluate(el => el.scrollWidth > el.clientWidth));
        await text.evaluate(el => { el.scrollLeft = el.scrollWidth; }); assert(await text.evaluate(el => el.scrollLeft > 0));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.screenshot({path:temp + '/bar-detail-mobile.png'}); await discard();
        const guestContext = await browser.newContext(); const guest = await guestContext.newPage();
        const [guestName,guestValue] = clients.guest.cookie.split('='); await guestContext.addCookies([{name:guestName,value:guestValue,url:base}]);
        await guest.route('https://cdn.jsdelivr.net/**',route=>route.abort()); await guest.goto(base+'index.php?v=2&collection_id='+song.id);
        await guest.locator('#tablature-content .song-map-bar').first().click(); const read = guest.getByRole('dialog',{name:'Detail taktu',exact:true});
        assert(await read.locator('textarea').evaluate(el=>el.readOnly)); assert.equal(await read.getByRole('button',{name:'Předvyplnit',exact:true}).count(),0); assert.equal(await read.getByRole('button',{name:'Uložit detail',exact:true}).count(),0);
        assert.equal((await request(clients.guest,endpoint,{action:'document_save',kind:'song_map',collection_id:song.id,document_id:latest.document.id,current_revision:latest.document.current_revision,body:JSON.stringify(rival)})).status,403);
        assert.deepEqual(errors,[]);
        check(true, 'detail: concurrent revision conflict, mobile viewport horizontal scroll, guest read-only UI and server denial');
        console.log('Detail screenshots: ' + temp + '/bar-detail-mobile.png');
    } finally { await browser.close(); }
};
