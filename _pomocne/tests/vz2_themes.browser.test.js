'use strict';
// Computed colors and compact picker layout with the real application styles.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../..');
const css = ['themes.css', 'vz2.css', 'vz2-workspaces.css', 'multitrack.css']
    .map(name => fs.readFileSync(path.join(root, 'css', name), 'utf8')).join('\n');
const expect = {
    dark: { background: 'rgb(27, 32, 29)', song: 'rgb(226, 196, 119)', rehearsal: 'rgb(159, 196, 163)',
        recording: 'rgb(213, 220, 194)', dialog: 'rgb(41, 47, 43)', mixer: 'rgb(48, 56, 49)' },
    light: { background: 'rgb(243, 242, 233)', song: 'rgb(135, 96, 24)', rehearsal: 'rgb(66, 117, 80)',
        recording: 'rgb(52, 62, 50)', dialog: 'rgb(255, 255, 255)', mixer: 'rgb(248, 249, 244)' }
};

(async () => {
    const browser = await chromium.launch({ headless: true,
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || chromium.executablePath() });
    try {
        for (const theme of ['dark', 'light']) {
            for (const width of [390, 900, 1440]) {
                const page = await browser.newPage({ viewport: { width, height: 850 } });
                try {
                    await page.setContent(`<!doctype html><html data-theme="${theme}"><head><style>${css}</style></head>
                        <body data-collection-kind="song">
                        <div class="workspace-heading"><span id="collection-kind-label">Skladby</span><h1 id="collection-title">
                          <button id="catalog-picker"><span id="collection-kind-inline">Skladba:</span>
                            <span id="collection-title-name">Poslední vlak</span><span class="catalog-chevron">⌄</span></button></h1></div>
                        <div class="recording-card"><span class="recording-title">Nahrávka.wav</span>
                          <div class="recording-caption">Popis nahrávky</div></div>
                        <div id="player-shell" data-mode="looper"><div id="looper-wave-track">Zvuková vlna</div></div>
                        <div class="mt-channel">Stopa Mixéru</div>
                        <dialog open><p>Modální okno</p><button>Potvrdit</button></dialog></body></html>`);
                    const colors = await page.evaluate(() => {
                        const style = selector => getComputedStyle(document.querySelector(selector));
                        return {
                            scheme: style('html').colorScheme, background: style('html').backgroundColor,
                            title: style('#collection-title-name').color,
                            titleWeight: Number(style('#collection-title-name').fontWeight),
                            label: style('#collection-kind-inline').color,
                            chevron: style('.catalog-chevron').color,
                            recording: style('.recording-title').color,
                            caption: style('.recording-caption').color,
                            dialog: style('dialog').backgroundColor,
                            mixer: style('.mt-channel').backgroundColor,
                            pickerHeight: document.querySelector('#catalog-picker').getBoundingClientRect().height
                        };
                    });
                    const expected = expect[theme];
                    assert.equal(colors.scheme, theme);
                    assert.equal(colors.background, expected.background);
                    assert.equal(colors.title, expected.song);
                    assert(colors.titleWeight >= 600);
                    assert.notEqual(colors.label, colors.title);
                    assert.notEqual(colors.chevron, colors.title);
                    assert.equal(colors.recording, expected.recording);
                    assert.notEqual(colors.caption, colors.recording);
                    assert.equal(colors.dialog, expected.dialog);
                    assert.equal(colors.mixer, expected.mixer);
                    if (width === 390) assert(colors.pickerHeight <= 40, `Picker grew to ${colors.pickerHeight}px`);
                    await page.evaluate(() => { document.body.dataset.collectionKind = 'rehearsal'; });
                    assert.equal(await page.locator('#collection-title-name').evaluate(node => getComputedStyle(node).color), expected.rehearsal);
                    if (process.env.VZ2_THEME_SCREENSHOT_DIR) {
                        await page.screenshot({ path: path.join(process.env.VZ2_THEME_SCREENSHOT_DIR, `${theme}-${width}.png`) });
                    }
                    console.log(`${theme} ${width}px: PASS`);
                } finally { await page.close(); }
            }
        }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
