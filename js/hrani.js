(() => {
  'use strict';
  const songs = JSON.parse(document.getElementById('song-data').textContent);
  const rehearsals = JSON.parse(document.getElementById('rehearsal-data').textContent);
  const byId = new Map(songs.map(song => [song.id, song]));
  const $ = id => document.getElementById(id);
  // New layouts only need a registry entry, a button, and scoped CSS.
  const layouts = ['compact', 'overview', 'large'];
  const distances = ['normal', 'wall'];
  const desktop = window.matchMedia('(min-width: 1101px)');
  let currentId = null;
  let request = null;
  let listScroll = 0;
  let lastOpened = null;
  let songView = 'default';
  let songLoad = null;
  const mapVisibility = { bars: true, details: true };

  function remember(key, value) {
    try { localStorage.setItem(`hrani.${key}`, value); } catch (_) { /* Private browsing can disable storage. */ }
  }
  function preference(key, allowed, fallback) {
    try { const value = localStorage.getItem(`hrani.${key}`); return allowed.includes(value) ? value : fallback; }
    catch (_) { return fallback; }
  }
  function setView(key, value) {
    document.body.dataset[key] = key === 'distance' && !desktop.matches ? 'normal' : value;
    document.querySelectorAll(`button[data-${key}]`).forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset[key] === value));
    });
    remember(key, value);
  }
  ['layout', 'distance'].forEach(key => {
    const allowed = key === 'layout' ? layouts : distances;
    setView(key, preference(key, allowed, key === 'layout' ? 'overview' : 'normal'));
    document.querySelectorAll(`button[data-${key}]`).forEach(button => {
      button.addEventListener('click', () => setView(key, button.dataset[key]));
    });
  });

  desktop.addEventListener('change', () => {
    setView('distance', preference('distance', distances, 'normal'));
  });

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function renderList() {
    const visible = songs;
    $('song-list').replaceChildren();
    visible.forEach(song => {
      const link = element('a', `song-row${song.id === lastOpened ? ' last-opened' : ''}`);
      link.href = `#song=${encodeURIComponent(song.id)}`;
      link.dataset.song = song.id;
      const name = element('span', 'song-name');
      name.append(element('span', 'song-number', String(songs.indexOf(song) + 1).padStart(2, '0')), element('strong', '', song.title));
      const assets = [];
      if (song.tempos?.length) assets.push(`${song.tempos.join(' / ')} BPM`);
      if (song.meters?.length) assets.push(song.meters.join(' / '));
      if (song.description) assets.push(song.description);
      const recordingCount = element('span', 'song-recordings');
      recordingCount.setAttribute('aria-label', `Nahrávky: ${song.recordings}`);
      recordingCount.append(element('span', 'recordings-label', 'Audio: '), document.createTextNode(String(song.recordings)));
      link.append(name, element('span', 'song-assets', assets.join(' · ') || '—'), recordingCount);
      link.addEventListener('click', () => { listScroll = window.scrollY; });
      $('song-list').append(link);
    });
    $('song-count').textContent = String(songs.length);
    $('list-empty').hidden = visible.length > 0;
    $('list-empty').textContent = 'Zatím tu nejsou žádné skladby. Přidejte je ve správě zkušebny.';
  }
  document.querySelector('.skip-link').addEventListener('click', event => {
    event.preventDefault();
    $('main').focus();
  });

  function stopAudio() {
    document.querySelectorAll('audio').forEach(audio => { audio.pause(); audio.removeAttribute('src'); audio.load(); });
  }
  function renderRecordings(files) {
    const recordings = files.filter(file => file.audio);
    $('recordings').replaceChildren();
    $('recording-count').textContent = String(recordings.length);
    if (!recordings.length) $('recordings').append(element('p', 'empty-state', 'Zatím žádné nahrávky.'));
    recordings.forEach(file => {
      const row = element('div', 'recording');
      if (file.openUrl || !file.url) {
        row.append(element('p', 'recording-name', file.name));
        if (file.openUrl) {
          const link = element('a', 'file-link', 'Otevřít vícestopou nahrávku ve zkušebně');
          link.href = file.openUrl;
          row.append(link);
        } else {
          row.append(element('p', 'empty-state', file.state === 'deleted' ? 'Zvukový soubor byl odstraněn.' : 'Zvukový soubor není dostupný.'));
        }
        $('recordings').append(row);
        return;
      }
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.preload = 'none';
      audio.src = file.url;
      audio.setAttribute('aria-label', file.name);
      const play = element('button', 'recording-play', 'Přehrát');
      play.type = 'button';
      play.setAttribute('aria-label', `Přehrát ${file.name}`);
      const fallback = element('a', 'audio-fallback', 'Otevřít zvukový soubor');
      fallback.href = file.url;
      fallback.target = '_blank';
      fallback.rel = 'noopener';
      fallback.hidden = true;
      play.addEventListener('click', async () => {
        if (!audio.paused) { audio.pause(); return; }
        try { await audio.play(); } catch (_) { fallback.hidden = false; }
      });
      audio.addEventListener('play', () => {
        document.querySelectorAll('audio').forEach(other => { if (other !== audio) other.pause(); });
        play.textContent = 'Pozastavit';
        play.setAttribute('aria-label', `Pozastavit ${file.name}`);
      });
      audio.addEventListener('pause', () => { play.textContent = 'Přehrát'; play.setAttribute('aria-label', `Přehrát ${file.name}`); });
      audio.addEventListener('error', () => { fallback.hidden = false; });
      row.append(element('p', 'recording-name', file.name), play, audio, fallback);
      $('recordings').append(row);
    });
  }
  function renderDetail(song) {
    $('song-text').textContent = song.text;
    $('song-tab').textContent = song.tab;
    $('text-panel').hidden = !song.text.trim();
    $('tab-panel').hidden = !song.tab.trim();
    $('no-score').hidden = Boolean(song.text.trim() || song.tab.trim());
    renderRecordings(song.files);
    const documents = song.files.filter(file => !file.audio);
    $('documents-panel').hidden = !documents.length;
    $('documents').replaceChildren();
    documents.forEach(file => {
      if (!file.url) {
        $('documents').append(element('p', 'empty-state', `${file.name} — soubor není dostupný.`));
        return;
      }
      const link = element('a', 'file-link', file.name);
      link.href = file.url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.setAttribute('aria-label', `${file.name} – otevřít v nové kartě`);
      $('documents').append(link);
    });
    $('song-notes').replaceChildren();
    if (!song.notes.available) {
      $('song-notes').append(element('p', 'empty-state', 'Poznámky se nepodařilo načíst. Ostatní podklady jsou dostupné.'));
    } else if (!song.notes.items.length) {
      $('song-notes').append(element('p', 'empty-state', 'Zatím žádné poznámky.'));
    }
    song.notes.items.forEach(note => {
      const item = element('article', 'note');
      item.append(element('p', '', note.text));
      $('song-notes').append(item);
    });
  }
  function setNeighbours(id) {
    const index = songs.findIndex(song => song.id === id);
    $('song-position').textContent = index < 0 ? '' : `Skladba ${index + 1} / ${songs.length}`;
    [['previous-song', songs[index - 1]], ['next-song', index < 0 ? null : songs[index + 1]]].forEach(([buttonId, song]) => {
      const button = $(buttonId);
      button.disabled = !song;
      button.querySelector('span').textContent = song ? song.title : '';
      button.onclick = () => { if (song) window.location.hash = `song=${encodeURIComponent(song.id)}`; };
    });
  }
  function detailStatus(message, retry = false) {
    $('detail-status').textContent = message;
    $('detail-status').hidden = !message;
    $('retry').hidden = !retry;
  }

  function renderSongInfo(snapshot) {
    return window.Vz2OverviewRender.renderCollection(snapshot, 'song', {}, undefined, { showHeading: false });
  }

  function renderSongMap(snapshot) {
    const map = snapshot.entries.find(entry => entry.type === 'map');
    if (!map) return element('p', 'empty-state', 'Skladba zatím nemá mapu.');
    const details = new Map(snapshot.entries.filter(entry => entry.type === 'map_detail').map(entry => [entry.bar_number, entry]));
    const host = element('div', 'simple-map');
    const controls = element('div', 'simple-map-options');
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', 'Zobrazení mapy skladby');
    for (const [key, text] of [['bars', 'Zobrazit takty'], ['details', 'Zobrazit detaily taktů']]) {
      const label = element('label');
      const input = element('input');
      input.type = 'checkbox';
      input.checked = mapVisibility[key];
      input.addEventListener('change', () => {
        mapVisibility[key] = input.checked;
        host.querySelectorAll(`[data-map-part="${key}"]`).forEach(part => { part.hidden = !input.checked; });
      });
      label.append(input, document.createTextNode(text));
      controls.append(label);
    }
    host.append(controls);
    const model = window.Vz2SongMapModel;
    for (const section of map.sections) {
      const group = element('section', 'panel');
      group.append(element('h2', '', section.name));
      const grid = element('div', 'simple-bars');
      grid.dataset.mapPart = 'bars';
      grid.hidden = !mapVisibility.bars;
      const annotations = element('div', 'simple-bar-details');
      annotations.dataset.mapPart = 'details';
      annotations.hidden = !mapVisibility.details;
      section.bars.forEach((bar, index) => {
        const number = section.first_bar + index;
        const detail = details.get(number);
        const name = 'Takt ' + number + ' · ' + model.label(bar);
        const cell = element('div', detail ? 'simple-bar has-detail' : 'simple-bar');
        cell.dataset.base = bar.base || '';
        cell.setAttribute('aria-label', name);
        cell.setAttribute('role', 'img');
        cell.title = name;
        cell.append(element('span', 'simple-bar-number', String(number)), element('strong', '', model.symbol(bar)));
        grid.append(cell);
        if (detail) {
          const annotation = element('div', 'simple-bar-detail');
          annotation.append(element('h3', '', 'Takt ' + number), element('pre', 'score', detail.body));
          annotations.append(annotation);
        }
      });
      group.append(grid);
      if (annotations.childElementCount) group.append(annotations);
      host.append(group);
    }
    return host;
  }

  async function readSongView(id, signal, info = false) {
    const params = new URLSearchParams({ data: '1', song: id });
    if (info) params.set('content', 'info');
    const response = await fetch('simple.php?' + params, { signal, headers: { Accept: 'application/json' } });
    const detail = await response.json();
    if (!response.ok) throw new Error(detail.error || 'Podklady se nepodařilo načíst.');
    return detail;
  }

  async function updateSongView() {
    const load = songLoad;
    if (!load) return;
    const view = songView;
    $('song-content').hidden = true;
    $('song-extra').hidden = true;
    detailStatus('Načítání podkladů…');
    try {
      if (view === 'default') {
        load.default ??= readSongView(load.id, load.signal);
        const detail = await load.default;
        if (load !== songLoad || view !== songView) return;
        if (!load.rendered) { renderDetail(detail); load.rendered = true; }
        $('song-content').hidden = false;
      } else {
        load.info ??= readSongView(load.id, load.signal, true);
        const snapshot = await load.info;
        if (load !== songLoad || view !== songView) return;
        $('song-extra').replaceChildren(view === 'map' ? renderSongMap(snapshot) : renderSongInfo(snapshot));
        $('song-extra').hidden = false;
      }
      detailStatus('');
    } catch (error) {
      if (load !== songLoad || view !== songView || error.name === 'AbortError') return;
      detailStatus(error instanceof TypeError || error instanceof SyntaxError
        ? 'Podklady se nepodařilo načíst. Zkontrolujte připojení a zkuste to znovu.' : error.message, true);
    }
  }

  document.querySelectorAll('[data-song-view]').forEach(button => {
    button.addEventListener('click', () => {
      if (button.dataset.songView === songView) return;
      songView = button.dataset.songView;
      document.querySelectorAll('[data-song-view]').forEach(control => control.setAttribute('aria-pressed', String(control === button)));
      $('recordings').querySelectorAll('audio').forEach(audio => audio.pause());
      updateSongView();
    });
  });

  async function openSong(id) {
    if (request) request.abort();
    request = new AbortController();
    songLoad = null;
    stopAudio();
    currentId = id;
    document.body.dataset.screen = 'detail';
    lastOpened = id;
    $('list-view').hidden = true;
    $('detail-view').hidden = false;
    $('song-content').hidden = true;
    $('song-extra').hidden = true;
    $('detail-status').hidden = false;
    $('detail-status').textContent = 'Načítání podkladů…';
    $('retry').hidden = true;
    const song = byId.get(id);
    $('song-title').textContent = song ? song.title : 'Skladba není dostupná';
    document.title = `${song ? song.title : 'Skladba'} · Simple`;
    setNeighbours(id);
    window.scrollTo(0, 0);
    $('song-title').focus({ preventScroll: true });
    if (!song) { $('detail-status').textContent = 'Tuto skladbu v seznamu nemáme. Vraťte se do seznamu skladeb.'; return; }
    songLoad = { id, signal: request.signal };
    await updateSongView();
  }
  const rehearsalAudio = $('rehearsal-audio');
  const recordingPicker = $('rehearsal-recording');
  const rehearsalSeek = $('rehearsal-seek');
  const rehearsalPlay = $('rehearsal-play');
  const rehearsalStatus = $('rehearsal-player-status');
  const audioStatus = $('rehearsal-audio-status');
  let rehearsalRecordings = [];
  let openedRehearsal = null;
  let lastRehearsal = null;
  let rehearsalScroll = 0;

  function audioMessage(message = '') {
    audioStatus.textContent = message;
    audioStatus.hidden = !message;
  }

  function timeLabel(value) {
    const seconds = Math.floor(value || 0);
    return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
  }

  function updateTransport() {
    const duration = Number.isFinite(rehearsalAudio.duration) && rehearsalAudio.duration > 0
      ? rehearsalAudio.duration : 0;
    rehearsalSeek.max = String(duration);
    rehearsalSeek.value = String(rehearsalAudio.currentTime);
    $('rehearsal-elapsed').textContent = timeLabel(rehearsalAudio.currentTime);
    $('rehearsal-duration').textContent = timeLabel(duration);
    rehearsalSeek.disabled = $('rehearsal-backward').disabled = $('rehearsal-forward').disabled = !duration;
    rehearsalPlay.textContent = rehearsalAudio.paused ? 'Přehrát' : 'Pozastavit';
  }

  function selectRehearsalRecording() {
    rehearsalAudio.pause();
    rehearsalAudio.src = rehearsalRecordings[Number(recordingPicker.value)].url;
    rehearsalAudio.load();
    rehearsalSeek.value = '0';
    audioMessage();
    updateTransport();
  }

  function seekRehearsal(seconds) {
    if (!Number.isFinite(rehearsalAudio.duration)) return;
    rehearsalAudio.currentTime = Math.min(rehearsalAudio.duration, Math.max(0, seconds));
    rehearsalSeek.value = String(rehearsalAudio.currentTime);
    updateTransport();
  }

  recordingPicker.addEventListener('change', selectRehearsalRecording);
  rehearsalSeek.addEventListener('input', () => seekRehearsal(Number(rehearsalSeek.value)));
  $('rehearsal-backward').addEventListener('click', () => seekRehearsal(rehearsalAudio.currentTime - 10));
  $('rehearsal-forward').addEventListener('click', () => seekRehearsal(rehearsalAudio.currentTime + 10));
  rehearsalPlay.addEventListener('click', async () => {
    if (!rehearsalAudio.paused) { rehearsalAudio.pause(); return; }
    const source = rehearsalAudio.getAttribute('src');
    if (!source) return;
    audioMessage();
    if (rehearsalAudio.error) rehearsalAudio.load();
    try {
      await rehearsalAudio.play();
    } catch (error) {
      if (error.name !== 'AbortError' && rehearsalAudio.getAttribute('src') === source) {
        audioMessage('Nahrávku se nepodařilo přehrát. Zkus to znovu.');
      }
    }
  });
  for (const event of ['loadedmetadata', 'timeupdate', 'play', 'pause', 'ended', 'emptied']) {
    rehearsalAudio.addEventListener(event, updateTransport);
  }
  rehearsalAudio.addEventListener('error', () => {
    if (rehearsalAudio.hasAttribute('src')) audioMessage('Nahrávku se nepodařilo načíst.');
    updateTransport();
  });

  async function openRehearsal(id) {
    if (request) request.abort();
    const activeRequest = new AbortController();
    request = activeRequest;
    stopAudio();
    currentId = null;
    openedRehearsal = lastRehearsal = id;
    document.body.dataset.screen = 'detail';
    $('list-view').hidden = true;
    $('rehearsal-view').hidden = true;
    $('detail-view').hidden = true;
    $('rehearsal-player').hidden = false;
    $('rehearsal-transport').hidden = true;
    $('retry-rehearsal').hidden = true;
    const title = $('rehearsal-player-title');
    title.textContent = rehearsals.find(row => String(row.id) === id)?.title || 'Zkouška';
    document.title = title.textContent + ' · Simple';
    rehearsalStatus.hidden = false;
    rehearsalStatus.textContent = 'Načítání nahrávek…';
    window.scrollTo(0, 0);
    title.focus({ preventScroll: true });
    try {
      const response = await fetch('simple.php?' + new URLSearchParams({ data: '1', rehearsal: id }), {
        signal: activeRequest.signal, headers: { Accept: 'application/json' }
      });
      const detail = await response.json();
      if (!response.ok) throw new Error(detail.error || 'Nahrávky se nepodařilo načíst.');
      if (activeRequest !== request) return;
      title.textContent = detail.title;
      document.title = detail.title + ' · Simple';
      rehearsalRecordings = detail.recordings;
      if (!rehearsalRecordings.length) {
        rehearsalStatus.textContent = 'Zkouška zatím nemá žádnou dostupnou nahrávku.';
        return;
      }
      recordingPicker.replaceChildren(...rehearsalRecordings.map((recording, index) => {
        const option = element('option', '', recording.name);
        option.value = String(index);
        return option;
      }));
      recordingPicker.selectedIndex = 0;
      selectRehearsalRecording();
      rehearsalStatus.hidden = true;
      $('rehearsal-transport').hidden = false;
    } catch (error) {
      if (activeRequest !== request || error.name === 'AbortError') return;
      rehearsalStatus.textContent = error instanceof TypeError || error instanceof SyntaxError
        ? 'Nahrávky se nepodařilo načíst. Zkontroluj připojení.' : error.message;
      $('retry-rehearsal').hidden = false;
    }
  }

  $('retry-rehearsal').addEventListener('click', () => {
    if (openedRehearsal) openRehearsal(openedRehearsal);
  });

  function renderRehearsals() {
    const rows = rehearsals.map(rehearsal => {
      const link = element('a', 'song-row');
      link.href = '#rehearsal=' + encodeURIComponent(rehearsal.id);
      link.dataset.rehearsal = rehearsal.id;
      link.addEventListener('click', () => { rehearsalScroll = window.scrollY; });
      const name = element('span', 'song-name');
      name.append(element('strong', '', rehearsal.title));
      const count = element('span', 'song-recordings');
      count.setAttribute('aria-label', 'Nahrávky: ' + rehearsal.recordings);
      count.append(element('span', 'recordings-label', 'Audio: '), document.createTextNode(String(rehearsal.recordings)));
      link.append(name, count);
      return link;
    });
    $('rehearsal-list').replaceChildren(...rows);
    $('rehearsal-count').textContent = String(rehearsals.length);
    $('rehearsal-empty').hidden = rehearsals.length > 0;
  }
  function route() {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const id = params.get('song');
    const rehearsalId = params.get('rehearsal');
    songLoad = null;
    $('playing-lists').hidden = Boolean(id || rehearsalId);
    if (rehearsalId) { openRehearsal(rehearsalId); return; }
    const wasRehearsal = openedRehearsal !== null;
    openedRehearsal = null;
    $('rehearsal-player').hidden = true;
    if (id) {
      $('rehearsal-view').hidden = true;
      openSong(id);
      return;
    }
    const showRehearsals = window.location.hash === '#rehearsals';
    $(showRehearsals ? 'show-songs' : 'show-rehearsals').removeAttribute('aria-current');
    $(showRehearsals ? 'show-rehearsals' : 'show-songs').setAttribute('aria-current', 'page');
    if (request) request.abort();
    request = null;
    const wasDetail = currentId !== null;
    currentId = null;
    document.body.dataset.screen = 'list';
    stopAudio();
    $('detail-view').hidden = true;
    $('list-view').hidden = showRehearsals;
    $('rehearsal-view').hidden = !showRehearsals;
    document.title = showRehearsals ? 'Zkoušky · Simple' : 'Simple · Virtuální zkušebna';
    if (showRehearsals) renderRehearsals();
    else renderList();
    if (wasRehearsal && showRehearsals) {
      const selected = Array.from($('rehearsal-list').children).find(row => row.dataset.rehearsal === lastRehearsal);
      if (selected) selected.focus({ preventScroll: true });
      window.scrollTo(0, rehearsalScroll);
    }
    if (wasDetail) {
      const selected = Array.from(document.querySelectorAll('.song-row')).find(row => row.dataset.song === lastOpened);
      if (selected) selected.focus({ preventScroll: true });
      window.scrollTo(0, listScroll);
    }
  }
  $('retry').addEventListener('click', () => { if (currentId) openSong(currentId); });
  window.addEventListener('hashchange', route);
  window.addEventListener('pagehide', () => document.querySelectorAll('audio').forEach(audio => audio.pause()));
  if (document.fullscreenEnabled) {
    $('fullscreen').hidden = false;
    $('fullscreen').addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
      } catch (_) { $('fullscreen').textContent = 'Celá obrazovka není dostupná'; }
    });
    document.addEventListener('fullscreenchange', () => { $('fullscreen').textContent = document.fullscreenElement ? 'Ukončit celou obrazovku' : 'Celá obrazovka'; });
  }
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  route();
})();
