'use strict';
// Real application HTML/CSS/JS with isolated HTTP fixtures; no site config or database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../..');
const php = fs.readFileSync(path.join(root, 'vz2.php'), 'utf8');
const config = { csrf: 'test', write: false, admin: false, canCreate: false, canUpload: false, canReorder: false, cachePrefix: 'boot-test:' };
const html = php.slice(php.indexOf('<!doctype html>'))
    .replace(/<\?=json_encode\(\$config,[\s\S]*?\?>/, JSON.stringify(config))
    .replace(/<\?[\s\S]*?\?>/g, '');
const catalog = { ok: true, collections: [{ id: 1, title: 'Zkušební skladba', kind: 'song', lifecycle: 'active', author: 'Tester' }], recordings: [], attachments: [], operations: [], orders: [{ kind: 'song', revision: 1 }] };
function gate() { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; }
(async () => {
    const executablePath = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, chromium.executablePath(),
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && fs.existsSync(p));
    const browser = await chromium.launch({ headless: true, executablePath });
    async function fixture(options = {}) {
        const context = await browser.newContext({ viewport: { width: options.width || 390, height: 844 },
            reducedMotion: options.reduced ? 'reduce' : 'no-preference', javaScriptEnabled: options.noJS !== true });
        const page = await context.newPage(), errors = [], requests = [];
        const styles = gate(), scripts = gate(), data = gate(), sound = gate(), icons = gate();
        if (!options.holdStyles) styles.release();
        if (!options.holdScripts) scripts.release();
        if (!options.holdData) data.release();
        if (!options.holdSound) sound.release();
        if (!options.holdIcons) icons.release();
        let catalogFailure = !!options.catalogFailure, documents = 0, audioRequests = 0;
        page.on('pageerror', e => errors.push(e.message));
        await context.route('https://cdn.jsdelivr.net/**', async route => {
            await icons.promise;
            if (options.holdIcons) return route.fulfill({ contentType: 'text/css', body: '.boot-test-icon { color: red; }' });
            await route.abort(); // Optional icon CDN must never hold the splash open.
        });
        await context.route('http://vz2-boot.test/**', async route => {
            const url = new URL(route.request().url()); requests.push(url.pathname);
            if (url.pathname === '/index.php' || url.pathname === '/') {
                documents++;
                return route.fulfill({ contentType: 'text/html', body: html });
            }
            if (url.pathname.startsWith('/css/')) {
                await styles.promise;
                if (options.styleFailure) return route.abort();
                return route.fulfill({ contentType: 'text/css', body: fs.readFileSync(path.join(root, url.pathname), 'utf8') });
            }
            if (url.pathname.startsWith('/js/')) {
                await scripts.promise;
                if (options.scriptFailure && url.pathname === '/js/vz2-layout.js') return route.abort();
                return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(root, url.pathname), 'utf8') });
            }
            if (url.pathname === '/php/ajax/vz2.php') {
                await data.promise;
                return route.fulfill({ status: catalogFailure ? 503 : 200, json: catalogFailure ? { ok: false, error: 'Testovací výpadek' } : options.catalog || catalog });
            }
            if (url.pathname === '/php/ajax/vz2_content.php') return route.fulfill({ json: { ok: true, map: null, document: null, posts: [], can_edit: false, next_before: null } });
            if (url.pathname === '/php/ajax/vz2_timestamps.php') return route.fulfill({ json: { ok: true, entries: [], duration_ms: 1000, timestamps_revision: 1 } });
            if (url.pathname === '/php/ajax/vz2_peaks.php') return route.fulfill({ json: { ok: true, peaks: [], duration_ms: 1000 } });
            if (url.pathname === '/audio.wav') { audioRequests++; await sound.promise; return route.abort(); }
            return route.fulfill({ status: 204, body: '' });
        });
        return { page, styles, scripts, data, sound, icons, errors, requests,
            recover() { catalogFailure = false; }, documents: () => documents, audioRequests: () => audioRequests,
            async close() { styles.release(); scripts.release(); data.release(); sound.release(); icons.release(); await context.close(); } };
    }
    async function open(f, query = '') { await f.page.goto('http://vz2-boot.test/index.php?v=2' + query, { waitUntil: 'commit' }); }
    async function ready(f) { await f.page.waitForFunction(() => !document.documentElement.classList.contains('vz2-booting')); await f.page.locator('#vz2-boot').waitFor({ state: 'detached' }); }
    try {
        // Hold every application asset, then allow JS/data while CSS is still unavailable.
        const first = await fixture({ holdStyles: true, holdScripts: true, holdData: true });
        try {
            await open(first);
            await first.page.locator('#vz2-boot-title').waitFor();
            assert.equal(await first.page.locator('#vz2-boot-subtitle').textContent(), 'Už to najíždí.....');
            assert.equal(await first.page.locator('#topbar').isVisible(), false);
            await first.page.waitForFunction(() => performance.getEntriesByName('first-contentful-paint').length > 0);
            for (const width of [320, 390, 768, 1440]) {
                await first.page.setViewportSize({ width, height: 844 });
                const bounds = await first.page.locator('#vz2-boot-title').boundingBox();
                assert(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= 0 && bounds.y + bounds.height <= 844);
                assert.equal(await first.page.locator('#vz2-boot').evaluate(n => n.scrollWidth <= n.clientWidth), true);
                if (process.env.BOOT_SCREENSHOT_DIR) await first.page.screenshot({ path: path.join(process.env.BOOT_SCREENSHOT_DIR, `boot-${width}.png`) });
            }
            first.scripts.release(); first.data.release();
            await first.page.waitForFunction(() => document.getElementById('collection-title-name').textContent === 'Zkušební skladba');
            assert(await first.page.locator('#vz2-boot').isVisible(), 'Never reveal an unstyled workspace');
            first.styles.release(); await ready(first);
            assert(await first.page.locator('#topbar').isVisible());
            assert.equal(await first.page.locator('#app-shell').getAttribute('aria-busy'), null);
            assert.equal(await first.page.locator('#content-area > .panel:visible').count(), 3);
            await first.page.setViewportSize({ width: 390, height: 844 });
            await first.page.waitForFunction(() => document.body.dataset.layout === 'mobile');
            assert.equal(await first.page.locator('#content-area > .panel:visible').count(), 1);
            await first.page.locator('[data-mobile-panel="lyrics"]').click();
            assert(await first.page.locator('#panel-lyrics').isVisible());
            assert.equal(await first.page.locator('#vz2-boot').count(), 0);
            assert.deepEqual(first.errors, []);
            console.log('PASS: splash paints with all CSS/JS blocked; 320–1440px; reveals only after CSS and catalogue');
        } finally { await first.close(); }

        // Fast assets with a genuinely pending catalogue, long-wait messaging and recovery.
        const slow = await fixture({ holdData: true, holdIcons: true, reduced: true });
        try {
            await slow.page.clock.install(); await open(slow);
            await slow.page.locator('#vz2-boot-title').waitFor();
            assert.equal(await slow.page.locator('#vz2-boot-wave span').first().evaluate(n => getComputedStyle(n).animationName), 'none');
            await slow.page.clock.fastForward(8100);
            assert.match(await slow.page.locator('#vz2-boot-status').textContent(), /Chvíli to trvá/);
            await slow.page.clock.fastForward(22000);
            assert(await slow.page.locator('#vz2-boot-retry').isVisible());
            slow.data.release(); await ready(slow);
            slow.icons.release();
            await slow.page.waitForFunction(() => document.querySelector('link[data-vz2-icons]').media === 'all');
            assert.deepEqual(slow.errors, []);
            console.log('PASS: long wait, retry offer, reduced motion, automatic late recovery and optional late icon CSS');
        } finally { await slow.close(); }

        const failure = await fixture({ catalogFailure: true });
        try {
            await open(failure); await failure.page.locator('#vz2-boot-retry').waitFor();
            assert.match(await failure.page.locator('#vz2-boot-status').textContent(), /nepodařilo/);
            failure.recover(); await failure.page.locator('#vz2-boot-retry').click(); await ready(failure);
            assert.equal(failure.documents(), 2); assert.deepEqual(failure.errors, []);
            console.log('PASS: catalogue error stays covered; retry reloads and recovers');
        } finally { await failure.close(); }

        for (const option of ['styleFailure', 'scriptFailure']) {
            const broken = await fixture({ [option]: true });
            try {
                await open(broken); await broken.page.locator('#vz2-boot-retry').waitFor();
                assert(await broken.page.locator('#vz2-boot').isVisible());
                assert.equal(await broken.page.locator('#topbar').isVisible(), false);
                console.log('PASS: recoverable ' + option);
            } finally { await broken.close(); }
        }
        const file = { id: 1, url: 'audio.wav', state: 'available', title: 'Take', original_name: 'audio.wav', mime: 'audio/wav', revision: 1 };
        const recording = { id: 1, collection_id: 1, kind: 'single', lifecycle: 'active', title: 'Take', revision: 1, author: 'Tester', files: [file] };
        const audio = await fixture({ holdSound: true, catalog: { ...catalog, recordings: [recording] } });
        try {
            await open(audio, '&recording_id=1&view=looper'); await ready(audio);
            await audio.page.waitForFunction(() => window.Vz2Player.getState()?.mode === 'looper');
            assert(await audio.page.locator('#player-shell').isVisible());
            assert(audio.audioRequests() > 0, 'Audio request must actually be held');
            assert.deepEqual(audio.errors, []);
            console.log('PASS: direct recording link reveals workspace while audio is still downloading');
        } finally { await audio.close(); }

        const noJS = await fixture({ noJS: true });
        try {
            await open(noJS); await noJS.page.locator('#vz2-boot-noscript').waitFor();
            assert.equal(await noJS.page.locator('#topbar').isVisible(), false);
            console.log('PASS: JavaScript-disabled explanation');
        } finally { await noJS.close(); }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
