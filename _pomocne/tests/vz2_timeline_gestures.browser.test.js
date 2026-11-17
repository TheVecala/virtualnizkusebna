'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 800, height: 600 }, hasTouch: true });
        await page.setContent('<style>#timeline{margin:50px;width:600px}.plot{height:160px;touch-action:none;background:#333;color:white}.plot button{height:80px;width:100%}</style><div id="timeline"><div class="content"><div class="plot"><button>Úsek</button></div></div></div><button id="outside">Mimo osu</button>');
        await page.addScriptTag({ path: path.resolve(__dirname, '../../js/vz2-timeline.js') });
        await page.evaluate(() => {
            window.range = { start: 0, end: 1 }; window.clicks = 0; window.changes = 0;
            const host = document.getElementById('timeline');
            host.addEventListener('click', e => { if (e.target.closest('.plot')) clicks++; });
            window.timeline = Vz2Timeline.mount(host, {
                accepts: target => !!target.closest('.plot'),
                getRect: () => host.querySelector('.plot').getBoundingClientRect(),
                getRange: () => range,
                setRange: next => { range = next; changes++; host.querySelector('.content').innerHTML = '<div class="plot"><button>Úsek</button></div>'; }
            });
            host.append(Vz2Timeline.controls(timeline));
        });
        const range = () => page.evaluate(() => window.range);
        const box = await page.locator('.plot').boundingBox(), x = box.x, y = box.y + 35, w = box.width;
        await page.touchscreen.tap(x + w * .45, y); assert.equal(await page.evaluate(() => clicks), 1);
        await page.getByRole('button', { name: 'Přiblížit', exact: true }).click();
        await page.waitForFunction(() => range.start === .25 && range.end === .75);
        await page.mouse.move(x + w * .5, y); await page.mouse.down(); await page.mouse.move(x + w * .7, y, { steps: 6 }); await page.mouse.up();
        let current = await range(); assert(Math.abs(current.start - .15) < .005); assert.equal(await page.evaluate(() => clicks), 1, 'drag over a segment does not click it after redraw');
        const anchor = current.start + .75 * (current.end - current.start);
        await page.mouse.move(x + .75 * w, y); await page.keyboard.down('Control'); await page.mouse.wheel(0, -100); await page.keyboard.up('Control');
        await page.waitForFunction(() => range.end - range.start < .4);
        current = await range(); assert(Math.abs(current.start + .75 * (current.end - current.start) - anchor) < .001, 'wheel zoom keeps the time under the cursor');
        await page.mouse.wheel(0, 50); assert.deepEqual(await range(), current, 'plain wheel does not zoom');
        const outsideDefault = await page.locator('#outside').evaluate(el => el.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true, deltaY: -100, bubbles: true, cancelable: true })));
        assert(outsideDefault, 'browser zoom remains available outside the timeline');
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
        const touches = (a, b) => [a, b].filter(v => v != null).map((fraction, i) => ({ x: x + fraction * w, y, id: i + 1 }));
        await page.getByRole('button', { name: 'Celá nahrávka', exact: true }).click(); await page.waitForFunction(() => range.start === 0 && range.end === 1);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches(.35, .65) });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touches(.2, .8) });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        current = await range(); assert(Math.abs(current.start - .25) < .01 && Math.abs(current.end - .75) < .01, 'native two-finger pinch zooms around the midpoint');
        assert.equal(await page.evaluate(() => clicks), 1, 'pinch does not seek');
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches(.4) });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touches(.6) });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        current = await range(); assert(Math.abs(current.start - .15) < .01, 'one finger pans the zoomed timeline');
        assert.equal(await page.evaluate(() => clicks), 1);
        await page.locator('.plot button').click();
        assert.equal(await page.evaluate(() => clicks), 2, 'a fresh click after dragging still seeks');
        await page.getByRole('button', { name: 'Celá nahrávka', exact: true }).click(); await page.waitForFunction(() => range.start === 0 && range.end === 1);
        await page.evaluate(() => { timeline.zoomBy(1000000); }); await page.waitForFunction(() => range.end - range.start < .01);
        current = await range(); assert(current.start >= 0 && current.end <= 1 && current.end > current.start);
        await page.evaluate(() => timeline.destroy());
        const beforeDestroy = await page.evaluate(() => changes);
        await page.mouse.move(x + w / 2, y); await page.keyboard.down('Control'); await page.mouse.wheel(0, 100); await page.keyboard.up('Control');
        assert.equal(await page.evaluate(() => changes), beforeDestroy, 'destroy removes gesture listeners');
        console.log('PASS native timeline gestures: buttons, cursor-anchored Ctrl-wheel, mouse drag, pinch, touch pan/tap, click suppression, limits and cleanup');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
