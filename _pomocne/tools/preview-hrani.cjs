// Local UI preview with synthetic data. Does not execute PHP or connect to a database.
// Run: node _pomocne/tools/preview-hrani.cjs, then open http://127.0.0.1:8786/preview
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const songs = [
  { id: 'nocni-vlak', title: 'Noční vlak', hasText: true, hasTab: true, recordings: 2, documents: 0 },
  { id: 'druhy-breh', title: 'Druhý břeh', hasText: true, hasTab: false, recordings: 1, documents: 0 },
  { id: 'ticho-pred-bouri', title: 'Ticho před bouří', hasText: false, hasTab: true, recordings: 0, documents: 0 },
  { id: 'dlouhy-nazev', title: 'Skladba s opravdu dlouhým názvem, která prověří malou obrazovku', hasText: true, hasTab: false, recordings: 0, documents: 0 },
  { id: 'novy-napad', title: 'Nový nápad', hasText: false, hasTab: false, recordings: 0, documents: 0 },
  { id: 'specialni', title: '<Zkouška> & „název“', hasText: true, hasTab: false, recordings: 0, documents: 0 },
];
const rehearsals = [{ id: 101, title: 'Zkouška 21. 11.', recordings: 2 }, { id: 102, title: 'Zkouška 14. 11.', recordings: 0 }];
const text = 'INTRO\nAm       F        C        G\n\nSLOKA\nAm                   F\nPodél kolejí se vrací den,\nC                    G\nna druhý břeh nás veze sen.\n\nREFRÉN\nF          C         G        Am\nJeště chvíli hrát, ještě chvíli znít.\nF          C         G\nNež se noční vlak dá zase do pohybu.\n\nDOHRA\nAm  F  C  G  |  Am';
const tab = 'e|----------------------------------------|\nB|------1--------1--------1--------0-------|\nG|----2---2----2---2----0---0----0---0------|\nD|--2--------3--------2--------0-----------|\nA|0----------------3----------------------|\nE|---------1----------------3-------------|';
const wav = Buffer.alloc(44 + 16000);
wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(16000, 40);
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  response.setHeader('Cache-Control', 'no-store');
  if (url.pathname === '/preview') {
    const width = ['390', '768', '1280', '1920'].includes(url.searchParams.get('width')) ? url.searchParams.get('width') : '1280';
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(`<!doctype html><html lang="cs"><meta charset="utf-8"><title>Ukázka hráčského zobrazení</title><style>body{margin:0;background:#27343e;color:#fff;font:16px system-ui}nav{padding:12px;display:flex;gap:20px;flex-wrap:wrap}a{color:#a9e7ca}iframe{display:block;border:0;margin:auto;max-width:none;height:calc(100vh - 76px)}</style><nav>Ukázková data · vizuální kontrola <a href="?width=390">Mobil</a><a href="?width=768">Tablet</a><a href="?width=1280">Desktop</a><a href="?width=1920">Obrazovka na zdi</a></nav><iframe title="Hráčské zobrazení" src="/simple.php" width="${width}"></iframe></html>`);
    return;
  }
  if (url.pathname === '/sample.wav') {
    response.setHeader('Content-Type', 'audio/wav');
    response.end(wav);
    return;
  }
  if (url.pathname === '/' || ['/hrani.php', '/simple.php'].includes(url.pathname)) {
    if (url.searchParams.has('data') && url.searchParams.has('rehearsal')) {
      const rehearsal = rehearsals.find(row => String(row.id) === url.searchParams.get('rehearsal'));
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      if (!rehearsal) { response.statusCode = 404; response.end(JSON.stringify({ error: 'Zkouška není dostupná.' })); return; }
      const recordings = Array.from({ length: rehearsal.recordings }, (_, index) => ({ name: 'Nahrávka ' + (index + 1), url: '/sample.wav' }));
      response.end(JSON.stringify({ ...rehearsal, recordings }));
      return;
    }
    if (url.searchParams.has('data')) {
      const song = songs.find(item => item.id === url.searchParams.get('song'));
      response.setHeader('Content-Type', 'application/json; charset=utf-8');
      if (!song) { response.statusCode = 404; response.end(JSON.stringify({ error: 'Skladba není dostupná.' })); return; }
      if (url.searchParams.get('content') === 'info') {
        const entries = song.id === 'novy-napad' ? [] : [
          { type: 'song_details', label: 'Popisek, tempo a takt', tempos: [112], meters: ['4/4'], body: 'Po druhém refrénu krátká pauza.' },
          { type: 'document', label: 'Text a akordy', body: text },
          { type: 'marker', kind: 'take', recording_id: 1, recording_name: 'Zkouška – verze 1.wav',
            start_ms: 42000, end_ms: 68000, body: 'Druhý pokus', note_text: 'Zpomalit dohru.', end_body: 'Poslední akord' },
          { type: 'map', label: 'Mapa', body: '3 takty', sections: [{ name: 'Intro', first_bar: 1, bars: [
            { base: 'hihat', fill: 0 }, { base: 'ride', fill: 1, has_detail: true }, { special: 'stop' }
          ] }] },
          { type: 'map_detail', label: 'Intro · takt 2', bar_number: 2, body: '1 & 2 & 3 & 4 &\n  x   x   x   x' }
        ];
        response.end(JSON.stringify({ id: song.id, title: song.title, entries }));
        return;
      }
      response.end(JSON.stringify({ ...song, text: song.hasText ? text : '', tab: song.hasTab ? tab : '', files: Array.from({ length: song.recordings }, (_, index) => ({ name: `Zkouška – verze ${index + 1}.wav`, audio: true, url: '/sample.wav' })), notes: { available: true, items: song.id === 'novy-napad' ? [] : [{ text: 'Po druhém refrénu krátká pauza. Dohru hrajeme dvakrát, poslední akord nechat doznít.', author: 'Ukázková poznámka', date: '21. 11. 2026' }] } }));
      return;
    }
    let html = fs.readFileSync(path.join(root, 'simple.php'), 'utf8');
    html = html.slice(html.indexOf('<!doctype html>')).replace(
      /(id="(song|rehearsal)-data">)<\?php[\s\S]*?\?>/g,
      (_, start, kind) => start + JSON.stringify(kind === 'song' ? songs : rehearsals).replace(/</g, '\\u003c'));
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(html);
    return;
  }
  const files = { '/js/vz2-timestamp-model.js': 'text/javascript', '/js/vz2-song-map-model.js': 'text/javascript', '/css/hrani.css': 'text/css', '/css/vz2-overview-render.css': 'text/css', '/js/vz2-overview-render.js': 'text/javascript', '/js/hrani.js': 'text/javascript' };
  if (files[url.pathname]) {
    response.setHeader('Content-Type', files[url.pathname] + '; charset=utf-8');
    response.end(fs.readFileSync(path.join(root, url.pathname)));
    return;
  }
  response.statusCode = 404;
  response.end('Preview only');
});
server.listen(8786, '127.0.0.1', () => console.log('UI preview (synthetic data): http://127.0.0.1:8786/preview'));
