'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

module.exports = async ({ base, clients, good, wav, db, check }) => {
    const collection = await good('admin', { action: 'collection_create', kind: 'song', title: 'Nepovinné popisky' });
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
    try {
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        const [name, value] = clients.admin.cookie.split('=');
        await context.addCookies([{ name, value, url: base }]);
        const page = await context.newPage(), errors = [];
        page.setDefaultTimeout(15000);
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://cdn.jsdelivr.net/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
        await page.goto(base + 'index.php?v=2&collection_id=' + collection.id);
        await page.waitForFunction(() => !document.documentElement.classList.contains('vz2-booting'));
        for (const kind of ['single', 'multitrack', 'attachment']) {
            await page.locator('#upload-open').click();
            const dialog = page.locator('#upload-dialog');
            await dialog.locator('label').filter({ has: page.locator('[name=kind][value=' + kind + ']') }).click();
            const file = kind === 'attachment'
                ? { name: 'attachment.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') }
                : { name: kind + '.wav', mimeType: 'audio/wav', buffer: wav(1) };
            await dialog.locator('[type=file]').setInputFiles(kind === 'multitrack' ? [file, { ...file, name: 'second.wav' }] : [file]);
            assert.equal(await dialog.locator('[name=title]').inputValue(), '');
            const response = page.waitForResponse(r => r.url().includes('php/ajax/vz2.php') && r.request().method() === 'POST');
            await dialog.getByRole('button', { name: 'Nahrát', exact: true }).click();
            const uploaded = await response;
            assert.equal(uploaded.status(), 201, await uploaded.text());
            await dialog.waitFor({ state: 'hidden' });
            const table = kind === 'attachment' ? 'vz2_attachments' : 'vz2_recordings';
            assert.equal(db('SELECT title FROM ' + table + ' WHERE collection_id=? ORDER BY id DESC LIMIT 1', [collection.id])[0].title, '');
        }
        check(true, 'restored behaviors: single, multitrack and attachment uploads accept empty captions through the browser');
        await page.reload();
        await page.waitForFunction(() => !document.documentElement.classList.contains('vz2-booting'));
        assert.deepEqual(errors, []);
        assert.equal(await page.locator('#message').textContent(), '');
        const recording = db("SELECT id FROM vz2_recordings WHERE collection_id=? AND kind='single'", [collection.id])[0];
        const card = page.locator('#recording-' + recording.id);
        await card.locator('.recording-toggle').click();
        await card.getByRole('button', { name: 'Další', exact: true }).click();
        await page.locator('#recording-actions-' + recording.id).getByRole('button', { name: 'Upravit', exact: true }).click();
        const editor = page.locator('#edit-form');
        await editor.locator('[name=summary]').fill('Souhrn bez krátkého popisku');
        await editor.getByRole('button', { name: 'Uložit', exact: true }).click();
        await page.locator('#editor').waitFor({ state: 'hidden' });
        assert.equal(db('SELECT summary FROM vz2_recordings WHERE id=?', [recording.id])[0].summary, 'Souhrn bez krátkého popisku');
        await page.reload();
        const attachment = page.locator('#content .attachment-card').filter({ hasText: 'attachment.pdf' });
        await attachment.locator('.recording-toggle').click();
        await attachment.getByRole('button', { name: 'Upravit', exact: true }).click();
        await editor.locator('[name=title]').fill('Dočasný popisek');
        await editor.getByRole('button', { name: 'Uložit', exact: true }).click();
        await page.locator('#editor').waitFor({ state: 'hidden' });
        await attachment.getByRole('button', { name: 'Upravit', exact: true }).click();
        await editor.locator('[name=title]').fill('');
        await editor.locator('[name=summary]').fill('Popis přílohy');
        await editor.getByRole('button', { name: 'Uložit', exact: true }).click();
        await page.locator('#editor').waitFor({ state: 'hidden' });
        assert.deepEqual(db('SELECT title,summary FROM vz2_attachments WHERE collection_id=?', [collection.id])[0], { title: '', summary: 'Popis přílohy' });
        const row = page.locator('#collections .collection').filter({ hasText: 'Nepovinné popisky' });
        await row.locator('summary').click();
        await row.getByRole('button', { name: 'Přejmenovat', exact: true }).click();
        await editor.locator('[name=title]').fill('');
        assert.equal(await editor.evaluate(f => f.checkValidity()), false, 'Collection names remain required after editing an optional caption');
        await page.locator('#edit-cancel').click();
        check(true, 'restored behaviors: recording summary saves without caption, attachment caption can be cleared, collection name remains required');
        const archived = db("SELECT id,title FROM vz2_collections WHERE lifecycle='archived' AND kind='song'")[0];
        assert(archived, 'History integration must provide an archived song');
        db("UPDATE vz2_collections SET sort_order=id+1 WHERE kind='song' AND lifecycle='active'");
        db('UPDATE vz2_collections SET sort_order=0 WHERE id=?', [archived.id]);
        await page.goto(base + 'index.php?v=2');
        await page.waitForFunction(() => !document.documentElement.classList.contains('vz2-booting'));
        assert.notEqual(new URL(page.url()).searchParams.get('collection_id'), String(archived.id), 'Default selection skips the archived first row');
        assert(!(await page.locator('#collections .collection-name').allTextContents()).includes(archived.title));
        const movedTitle = await page.locator('#collections .collection-name').first().textContent();
        await page.locator('#collections .collection').first().locator('summary').click();
        const movedRow = page.locator('#collections .collection').filter({ has: page.locator('.collection-name', { hasText: movedTitle }) });
        const menu = movedRow.locator('.collection-menu');
        const up = menu.getByRole('button', { name: 'Posunout výše', exact: true });
        const down = menu.getByRole('button', { name: 'Posunout níže', exact: true });
        assert.equal(await up.isDisabled(), true);
        const geometry = await menu.evaluate(m => {
            const popover = m.querySelector('.collection-menu-popover');
            const arrows = [...m.querySelectorAll('.collection-order button')].map(b => b.getBoundingClientRect());
            return { width: popover.getBoundingClientRect().width, vertical: arrows[0].bottom <= arrows[1].top,
                order: [...popover.children].map(c => c.className === 'collection-order' ? 'arrows' : c.textContent) };
        });
        assert(geometry.width < 220 && geometry.vertical);
        assert.deepEqual(geometry.order, ['arrows', 'Přejmenovat', 'Smazat']);
        for (const [direction, position] of [[down, 1], [down, 2], [up, 1], [up, 0]]) {
            const orderResponse = page.waitForResponse(r => r.url().includes('php/ajax/vz2.php') && r.request().method() === 'POST');
            await direction.click();
            assert.equal((await orderResponse).status(), 200, 'Repeated reorder accepts the latest active list and revision');
            await page.waitForFunction(({ title, position }) => {
                const rows = [...document.querySelectorAll('#collections .collection')];
                return rows[position]?.querySelector('.collection-name').textContent === title
                    && rows[position].querySelector('.collection-menu').open;
            }, { title: movedTitle, position });
            const persisted = db("SELECT title FROM vz2_collections WHERE lifecycle='active' AND kind='song' ORDER BY sort_order,id");
            assert.equal(persisted[position].title, movedTitle);
            assert.equal(await up.isDisabled(), position === 0);
        }
        await page.keyboard.press('Escape');
        assert.equal(await menu.evaluate(m => m.open), false, 'The persistent reorder menu still closes with Escape');
        assert.equal(Number(db('SELECT sort_order FROM vz2_collections WHERE id=?', [archived.id])[0].sort_order), 0);
        assert.deepEqual(errors, []);
        check(true, 'restored behaviors: archived songs stay out of catalog; compact collection menu stays open across repeated reorder');
    } finally { await browser.close(); }
};
