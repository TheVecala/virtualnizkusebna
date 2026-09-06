(function() {
    'use strict';

    var DB_NAME = 'zkusebna-audio-cache';
    var STORE_NAME = 'audio-files';
    var CACHE_PREFIX = 'multitrack-v1:';
    var AUDIO_FORMATS = ['wav', 'flac', 'mp3'];
    var START_LEAD_SECONDS = 0.035;

    var config = window.MULTITRACK_CONFIG || {};
    var dom = {};
    var cacheStore = null;
    var audioContext = null;
    var masterGain = null;
    var items = new Map();
    var currentSet = null;
    var loadSerial = 0;
    var offlineSerial = 0;
    var activeDownloads = new Map();
    var loadAbortController = null;
    var animationFrame = null;
    var pendingSwitch = null;
    var pendingErrorContinue = null;
    var pendingOfflineAction = null;
    var uploadXhr = null;
    var uploadSerial = 0;
    var scrubbing = false;
    var resumeAfterScrub = false;

    function byId(id) {
        return document.getElementById(id);
    }

    function setHidden(element, hidden) {
        if (element) element.hidden = !!hidden;
    }

    function clamp(value, minimum, maximum) {
        return Math.max(minimum, Math.min(maximum, value));
    }

    function finiteNumber(value, fallback) {
        var number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    }

    function extensionOf(fileName) {
        var clean = String(fileName || '').split(/[?#]/, 1)[0];
        var dot = clean.lastIndexOf('.');
        return dot === -1 ? '' : clean.slice(dot + 1).toLowerCase();
    }

    function formatTime(seconds) {
        var total = Math.max(0, Math.floor(finiteNumber(seconds, 0)));
        var hours = Math.floor(total / 3600);
        var minutes = Math.floor((total % 3600) / 60);
        var secs = total % 60;
        if (hours > 0) {
            return String(hours).padStart(2, '0') + ':' +
                String(minutes).padStart(2, '0') + ':' +
                String(secs).padStart(2, '0');
        }
        return String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
    }

    function formatPreciseTime(seconds) {
        var totalMilliseconds = Math.max(0, Math.round(finiteNumber(seconds, 0) * 1000));
        var milliseconds = totalMilliseconds % 1000;
        var totalSeconds = Math.floor(totalMilliseconds / 1000);
        var hours = Math.floor(totalSeconds / 3600);
        var minutes = Math.floor((totalSeconds % 3600) / 60);
        var secs = totalSeconds % 60;
        var prefix = hours > 0 ? String(hours).padStart(2, '0') + ':' : '';
        return prefix + String(minutes).padStart(2, '0') + ':' +
            String(secs).padStart(2, '0') + '.' + String(milliseconds).padStart(3, '0');
    }

    function errorMessage(error) {
        if (!error) return 'Neznámá chyba.';
        return error.message || String(error);
    }

    function cancelledError() {
        var error = new Error('Operace byla zrušena.');
        error.name = 'AbortError';
        return error;
    }

    function isCancelled(error) {
        return error && error.name === 'AbortError';
    }

    function showNotice(message, level) {
        if (!dom.notice) return;
        dom.notice.textContent = message || '';
        dom.notice.dataset.level = level || 'info';
        dom.notice.classList.remove('is-warning', 'is-error', 'is-success');
        if (level === 'warning') dom.notice.classList.add('is-warning');
        if (level === 'error') dom.notice.classList.add('is-error');
        if (level === 'success') dom.notice.classList.add('is-success');
        dom.notice.hidden = !message;
    }

    function setLoadState(state) {
        var labels = {
            idle: 'Vyberte multitrack',
            loading: 'Načítám…',
            ready: 'Připraveno',
            warning: 'Čeká na potvrzení',
            error: 'Chyba'
        };
        document.querySelectorAll('[data-mt-load-state]').forEach(function(element) {
            element.setAttribute('data-mt-load-state', state);
            element.textContent = labels[state] || state;
            if (element.hasAttribute('aria-busy')) {
                element.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
            }
        });
        if (dom.loadingPanel) dom.loadingPanel.classList.toggle('is-complete', state === 'ready');
    }

    function showModal(selector) {
        if (window.jQuery && typeof window.jQuery.fn.modal === 'function') {
            window.jQuery(selector).modal('show');
            return true;
        }
        var modal = document.querySelector(selector);
        if (!modal) return false;
        modal.hidden = false;
        modal.classList.add('show');
        modal.style.display = 'block';
        return true;
    }

    function hideModal(selector) {
        if (window.jQuery && typeof window.jQuery.fn.modal === 'function') {
            window.jQuery(selector).modal('hide');
            return;
        }
        var modal = document.querySelector(selector);
        if (!modal) return;
        modal.classList.remove('show');
        modal.style.display = 'none';
        modal.hidden = true;
    }

    function getAudioContext() {
        if (audioContext) return audioContext;
        var AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) throw new Error('Tento prohlížeč nepodporuje Web Audio API.');
        audioContext = new AudioContextClass();
        masterGain = audioContext.createGain();
        masterGain.gain.value = 1;
        masterGain.connect(audioContext.destination);
        return audioContext;
    }

    function getCacheStore() {
        if (!cacheStore && window.idbKeyval) {
            cacheStore = window.idbKeyval.createStore(DB_NAME, STORE_NAME);
        }
        return cacheStore;
    }

    function cacheIdForItem(item, metadata, metadataUrl) {
        metadata = metadata || {};
        var source = item.id || item.slug || metadata.id || metadataUrl || metadata.name;
        return encodeURIComponent(String(source));
    }

    function cacheIdFor(set) {
        return cacheIdForItem(set.item, set.metadata, set.metadataUrl);
    }

    function manifestCacheKeyForId(cacheId) {
        return CACHE_PREFIX + cacheId + ':manifest';
    }

    function manifestCacheKey(set) {
        return manifestCacheKeyForId(set.cacheId);
    }

    function trackCacheKey(set, track) {
        return CACHE_PREFIX + set.cacheId + ':track:' + encodeURIComponent(track.url);
    }

    function readAscii(bytes, offset, length) {
        var result = '';
        for (var i = 0; i < length && offset + i < bytes.length; i += 1) {
            result += String.fromCharCode(bytes[offset + i]);
        }
        return result;
    }

    function detectWavSampleRate(arrayBuffer) {
        var bytes = new Uint8Array(arrayBuffer);
        if (bytes.length < 28) return null;
        var riff = readAscii(bytes, 0, 4);
        if ((riff !== 'RIFF' && riff !== 'RF64' && riff !== 'BW64') || readAscii(bytes, 8, 4) !== 'WAVE') return null;
        var view = new DataView(arrayBuffer);
        var offset = 12;
        while (offset + 8 <= bytes.length) {
            var chunkId = readAscii(bytes, offset, 4);
            var chunkLength = view.getUint32(offset + 4, true);
            var dataOffset = offset + 8;
            if (chunkId === 'fmt ' && chunkLength >= 16 && dataOffset + 8 <= bytes.length) {
                return view.getUint32(dataOffset + 4, true) || null;
            }
            if (chunkLength > bytes.length - dataOffset) break;
            offset = dataOffset + chunkLength + (chunkLength % 2);
        }
        return null;
    }

    function findSignature(bytes, signature, maximumOffset) {
        var limit = Math.min(bytes.length - signature.length, maximumOffset);
        outer: for (var i = 0; i <= limit; i += 1) {
            for (var j = 0; j < signature.length; j += 1) {
                if (bytes[i + j] !== signature.charCodeAt(j)) continue outer;
            }
            return i;
        }
        return -1;
    }

    function detectFlacSampleRate(arrayBuffer) {
        var bytes = new Uint8Array(arrayBuffer);
        var signatureOffset = findSignature(bytes, 'fLaC', Math.min(bytes.length, 1024 * 1024));
        if (signatureOffset < 0) return null;
        var offset = signatureOffset + 4;
        while (offset + 4 <= bytes.length) {
            var header = bytes[offset];
            var blockType = header & 0x7f;
            var blockLength = (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
            var dataOffset = offset + 4;
            if (dataOffset + blockLength > bytes.length) return null;
            if (blockType === 0 && blockLength >= 18) {
                return ((bytes[dataOffset + 10] << 12) |
                    (bytes[dataOffset + 11] << 4) |
                    (bytes[dataOffset + 12] >> 4)) || null;
            }
            if (header & 0x80) break;
            offset = dataOffset + blockLength;
        }
        return null;
    }

    function id3PayloadLength(bytes) {
        if (bytes.length < 10 || readAscii(bytes, 0, 3) !== 'ID3') return 0;
        var size = ((bytes[6] & 0x7f) << 21) |
            ((bytes[7] & 0x7f) << 14) |
            ((bytes[8] & 0x7f) << 7) |
            (bytes[9] & 0x7f);
        return 10 + size + ((bytes[5] & 0x10) ? 10 : 0);
    }

    function detectMp3SampleRate(arrayBuffer) {
        var bytes = new Uint8Array(arrayBuffer);
        var start = id3PayloadLength(bytes);
        var maximum = Math.min(bytes.length - 4, start + 2 * 1024 * 1024);
        var baseRates = [44100, 48000, 32000];

        for (var i = start; i <= maximum; i += 1) {
            if (bytes[i] !== 0xff || (bytes[i + 1] & 0xe0) !== 0xe0) continue;
            var versionBits = (bytes[i + 1] >> 3) & 0x03;
            var layerBits = (bytes[i + 1] >> 1) & 0x03;
            var bitrateIndex = (bytes[i + 2] >> 4) & 0x0f;
            var sampleRateIndex = (bytes[i + 2] >> 2) & 0x03;
            if (versionBits === 1 || layerBits === 0 || bitrateIndex === 15 || sampleRateIndex === 3) continue;
            var sampleRate = baseRates[sampleRateIndex];
            if (versionBits === 2) sampleRate /= 2;
            if (versionBits === 0) sampleRate /= 4;
            return sampleRate;
        }
        return null;
    }

    function detectSourceSampleRate(arrayBuffer, fileName) {
        var extension = extensionOf(fileName);
        if (extension === 'wav') return detectWavSampleRate(arrayBuffer);
        if (extension === 'flac') return detectFlacSampleRate(arrayBuffer);
        if (extension === 'mp3') return detectMp3SampleRate(arrayBuffer);
        return null;
    }

    function decodeAudioData(context, arrayBuffer) {
        return new Promise(function(resolve, reject) {
            var settled = false;
            function done(buffer) {
                if (settled) return;
                settled = true;
                resolve(buffer);
            }
            function failed(error) {
                if (settled) return;
                settled = true;
                reject(error || new Error('Audio se nepodařilo dekódovat.'));
            }
            try {
                var result = context.decodeAudioData(arrayBuffer, done, failed);
                if (result && typeof result.then === 'function') result.then(done, failed);
            } catch (error) {
                failed(error);
            }
        });
    }

    function abortDownloads() {
        activeDownloads.forEach(function(entry) {
            try { entry.xhr.abort(); } catch (error) { /* už dokončeno */ }
        });
        activeDownloads.clear();
    }

    function downloadBlob(url, onProgress) {
        var existing = activeDownloads.get(url);
        if (existing) {
            if (typeof onProgress === 'function') existing.listeners.add(onProgress);
            return existing.promise;
        }

        var listeners = new Set();
        if (typeof onProgress === 'function') listeners.add(onProgress);
        var xhr = new XMLHttpRequest();
        var entry = { xhr: xhr, listeners: listeners, promise: null };
        var promise = new Promise(function(resolve, reject) {
            xhr.open('GET', url, true);
            xhr.responseType = 'blob';
            xhr.onprogress = function(event) {
                var percent = event.lengthComputable && event.total > 0
                    ? clamp(Math.round(event.loaded / event.total * 100), 0, 99)
                    : null;
                listeners.forEach(function(listener) { listener(percent); });
            };
            xhr.onload = function() {
                if (xhr.status >= 200 && xhr.status < 300 && xhr.response instanceof Blob) {
                    listeners.forEach(function(listener) { listener(100); });
                    resolve(xhr.response);
                } else {
                    reject(new Error('Stažení selhalo (HTTP ' + xhr.status + ').'));
                }
            };
            xhr.onerror = function() { reject(new Error('Chyba spojení při stahování.')); };
            xhr.onabort = function() { reject(cancelledError()); };
            xhr.send();
        });
        entry.promise = promise.finally(function() {
            if (activeDownloads.get(url) === entry) activeDownloads.delete(url);
        });
        activeDownloads.set(url, entry);
        return entry.promise;
    }

    function requestJson(url, signal) {
        return fetch(url, {
            credentials: 'same-origin',
            cache: 'no-store',
            headers: { 'Accept': 'application/json' },
            signal: signal
        }).then(function(response) {
            if (!response.ok) throw new Error('Server vrátil HTTP ' + response.status + '.');
            return response.json();
        }).then(function(payload) {
            if (payload && payload.ok === false) throw new Error(payload.error || payload.chyba || 'Požadavek se nezdařil.');
            return payload;
        });
    }

    function unwrapList(payload) {
        if (Array.isArray(payload)) return payload;
        if (!payload || typeof payload !== 'object') return [];
        if (Array.isArray(payload.multitracks)) return payload.multitracks;
        if (Array.isArray(payload.items)) return payload.items;
        if (Array.isArray(payload.data)) return payload.data;
        return [];
    }

    function normalizeListItem(raw, index) {
        raw = raw || {};
        var inlineMetadata = raw.metadata && typeof raw.metadata === 'object' ? raw.metadata :
            (Array.isArray(raw.tracks) ? raw : null);
        var id = raw.id || raw.slug || raw.key || raw.directory || raw.folder || raw.name || String(index);
        return {
            id: String(id),
            slug: raw.slug ? String(raw.slug) : '',
            name: String(raw.name || raw.title || id),
            metadata: inlineMetadata,
            metadataUrl: raw.metadataUrl || raw.metadata_url || raw.manifestUrl || raw.manifest_url || raw.url || '',
            baseUrl: raw.baseUrl || raw.base_url || raw.audioBaseUrl || raw.audio_base_url || '',
            raw: raw
        };
    }

    function renderSelector(selectedId) {
        if (!dom.selector) return;
        dom.selector.textContent = '';
        var placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = items.size ? 'Vyber multitrack…' : 'Žádné multitracky';
        dom.selector.appendChild(placeholder);
        items.forEach(function(item) {
            var option = document.createElement('option');
            option.value = item.id;
            option.textContent = item.name;
            dom.selector.appendChild(option);
        });
        dom.selector.value = selectedId && items.has(String(selectedId)) ? String(selectedId) : '';
        dom.selector.disabled = items.size === 0;
    }

    function refreshList(preferredId) {
        if (!config.listUrl) {
            showNotice('Chybí adresa serverového seznamu multitracků.', 'error');
            return Promise.reject(new Error('MULTITRACK_CONFIG.listUrl není nastavené.'));
        }
        if (dom.selector) dom.selector.disabled = true;
        return requestJson(config.listUrl).then(function(payload) {
            var normalized = unwrapList(payload).map(normalizeListItem);
            items = new Map(normalized.map(function(item) { return [item.id, item]; }));
            var selected = preferredId || (currentSet && currentSet.item.id) || config.initialId || '';
            renderSelector(selected);
            if (!normalized.length) showNotice('Na serveru zatím není žádný multitrack.', 'info');
            return normalized;
        }).catch(function(error) {
            if (dom.selector) dom.selector.disabled = true;
            showNotice('Seznam multitracků se nepodařilo načíst: ' + errorMessage(error), 'error');
            throw error;
        });
    }

    function metadataRequestUrl(item) {
        if (item.metadataUrl) return new URL(item.metadataUrl, window.location.href).href;
        if (config.detailUrl) {
            if (typeof config.detailUrl === 'function') return config.detailUrl(item.id);
            return String(config.detailUrl).replace('{id}', encodeURIComponent(item.id));
        }
        var url = new URL(config.listUrl, window.location.href);
        url.searchParams.set('id', item.id);
        return url.href;
    }

    function loadMetadata(item, signal) {
        if (item.metadata) {
            return Promise.resolve({ payload: item.metadata, url: item.metadataUrl ? metadataRequestUrl(item) : '', offline: false });
        }
        var url = metadataRequestUrl(item);
        return requestJson(url, signal).then(function(payload) {
            var metadata = payload && payload.multitrack ? payload.multitrack :
                (payload && payload.metadata ? payload.metadata : payload);
            return { payload: metadata, url: url, offline: false };
        }).catch(function(networkError) {
            if (isCancelled(networkError)) throw networkError;
            return cachedMetadataForItem(item).then(function(cachedMetadata) {
                if (!cachedMetadata) throw networkError;
                return { payload: cachedMetadata, url: '', offline: true };
            });
        });
    }

    function cachedMetadataForItem(item) {
        var store = getCacheStore();
        if (!store) return Promise.resolve(null);
        var cacheId = cacheIdForItem(item, item.metadata || {}, item.metadataUrl || '');
        return window.idbKeyval.get(manifestCacheKeyForId(cacheId), store).then(function(manifest) {
            if (
                !manifest || manifest.version !== 1 || manifest.setId !== cacheId ||
                !String(manifest.name || '').trim() || !String(manifest.created || '').trim() ||
                !Array.isArray(manifest.tracks) || !manifest.tracks.length
            ) {
                return null;
            }
            return {
                version: 1,
                id: manifest.id || item.id,
                name: manifest.name,
                created: manifest.created,
                baseUrl: manifest.baseUrl || '',
                tracks: manifest.tracks.map(function(track, index) {
                    return {
                        file: track.file,
                        name: track.name,
                        order: Number.isInteger(track.order) ? track.order : index + 1,
                        url: track.url
                    };
                })
            };
        }).catch(function() {
            return null;
        });
    }

    function normalizeMetadata(item, rawMetadata, metadataUrl) {
        if (!rawMetadata || typeof rawMetadata !== 'object') {
            throw new Error('Metadata multitracku nejsou platný JSON objekt.');
        }
        var version = Number(rawMetadata.version);
        if (version !== 1) {
            throw new Error('Tato verze metadat multitracku není podporovaná.');
        }
        if (!String(rawMetadata.name || '').trim()) {
            throw new Error('Metadata nemají název multitracku.');
        }
        if (!String(rawMetadata.created || '').trim()) {
            throw new Error('Metadata nemají datum vytvoření.');
        }
        if (!Array.isArray(rawMetadata.tracks) || rawMetadata.tracks.length === 0) {
            throw new Error('Metadata neobsahují žádné stopy.');
        }

        var baseUrl = rawMetadata.baseUrl || rawMetadata.base_url ||
            rawMetadata.audioBaseUrl || rawMetadata.audio_base_url || item.baseUrl || '';
        if (baseUrl) {
            baseUrl = new URL(baseUrl, metadataUrl || window.location.href).href;
        } else if (metadataUrl) {
            baseUrl = new URL('.', metadataUrl).href;
        } else {
            baseUrl = new URL('.', window.location.href).href;
        }

        var seenFiles = new Set();
        var seenOrders = new Set();
        var tracks = rawMetadata.tracks.map(function(rawTrack, index) {
            rawTrack = rawTrack || {};
            var file = String(rawTrack.file || '').trim();
            var name = String(rawTrack.name || '').trim();
            var order = Number(rawTrack.order);
            if (!file || file !== file.split(/[\\/]/).pop() || file.indexOf('..') !== -1) {
                throw new Error('Stopa č. ' + (index + 1) + ' má neplatné pole „file“.');
            }
            if (!name) throw new Error('Stopa „' + file + '“ nemá zobrazovaný název.');
            if (!Number.isFinite(order)) throw new Error('Stopa „' + file + '“ nemá platné pořadí.');
            var normalizedFile = file.toLocaleLowerCase('cs-CZ');
            if (seenFiles.has(normalizedFile)) throw new Error('Soubor „' + file + '“ je v metadatech vícekrát.');
            seenFiles.add(normalizedFile);
            if (seenOrders.has(order)) {
                console.warn('[Multitrack] Duplicitní hodnota order:', order);
            }
            seenOrders.add(order);

            var url = rawTrack.url
                ? new URL(rawTrack.url, baseUrl).href
                : new URL(encodeURIComponent(file), baseUrl).href;
            return {
                file: file,
                name: name,
                order: order,
                url: url,
                format: extensionOf(file),
                status: 'waiting',
                progress: null,
                statusDetail: '',
                sourceSampleRate: null,
                buffer: null,
                blob: null,
                gainNode: null,
                sourceNode: null,
                volume: 1,
                muted: false,
                solo: false,
                row: null,
                channel: null
            };
        }).sort(function(a, b) {
            return a.order - b.order || a.file.localeCompare(b.file, 'cs-CZ', { sensitivity: 'base' });
        });

        var formats = Array.from(new Set(tracks.map(function(track) { return track.format; })));
        if (formats.length !== 1 || AUDIO_FORMATS.indexOf(formats[0]) === -1) {
            if (formats.length > 1) {
                throw new Error('Jedna sada nesmí míchat formáty (' + formats.join(', ').toUpperCase() + ').');
            }
            throw new Error('Formát .' + (formats[0] || '?') + ' není podporovaný. Použij WAV, FLAC nebo MP3.');
        }

        return {
            version: version,
            name: String(rawMetadata.name).trim(),
            created: String(rawMetadata.created).trim(),
            baseUrl: baseUrl,
            id: rawMetadata.id || rawMetadata.slug || '',
            tracks: tracks,
            raw: rawMetadata
        };
    }

    var STATUS_LABELS = {
        waiting: 'čeká',
        downloading: 'stahování',
        downloaded: 'staženo',
        decoding: 'dekódování…',
        ready: 'připraveno',
        error: 'chyba'
    };

    function renderTrackStatuses(set) {
        if (!dom.trackStatuses) return;
        dom.trackStatuses.textContent = '';
        set.tracks.forEach(function(track) {
            var row = document.createElement('div');
            row.className = 'mt-status-row mt-track-status-row is-' + track.status;
            row.dataset.trackFile = track.file;

            var name = document.createElement('span');
            name.className = 'mt-status-name mt-track-status-name';
            name.textContent = track.file;
            name.title = track.name;

            var state = document.createElement('span');
            state.className = 'mt-status-value mt-track-status-state';
            state.setAttribute('role', 'status');

            var progress = document.createElement('progress');
            progress.className = 'mt-track-progress';
            progress.max = 100;
            progress.value = 0;
            progress.hidden = true;

            row.appendChild(name);
            row.appendChild(state);
            row.appendChild(progress);
            dom.trackStatuses.appendChild(row);
            track.row = { root: row, state: state, progress: progress };
            updateTrackStatus(track, track.status, track.progress, track.statusDetail);
        });
    }

    function updateTrackStatus(track, status, progress, detail) {
        track.status = status;
        track.progress = progress;
        track.statusDetail = detail || '';
        if (!track.row) return;
        track.row.root.className = 'mt-status-row mt-track-status-row is-' + status;
        var label = STATUS_LABELS[status] || status;
        if (status === 'downloading' && progress !== null && progress !== undefined) {
            label += ' ' + Math.round(progress) + ' %';
        }
        if (detail) label += status === 'error' ? ': ' + detail : ' · ' + detail;
        track.row.state.textContent = label;
        var showProgress = status === 'downloading' && progress !== null && progress !== undefined;
        track.row.progress.hidden = !showProgress;
        if (showProgress) track.row.progress.value = progress;
        updateLoadSummary(currentSet);
    }

    function updateLoadSummary(set, override) {
        if (!dom.loadSummary || !set || set !== currentSet) return;
        if (override) {
            dom.loadSummary.textContent = override;
            return;
        }
        var ready = set.tracks.filter(function(track) { return track.status === 'ready'; }).length;
        var errors = set.tracks.filter(function(track) { return track.status === 'error'; }).length;
        var text = 'Připraveno ' + ready + ' / ' + set.tracks.length + ' stop';
        if (errors) text += ' · chyby ' + errors;
        dom.loadSummary.textContent = text;
    }

    function setTransportEnabled(enabled) {
        [dom.restart, dom.backward, dom.play, dom.forward, dom.seek].forEach(function(element) {
            if (element) element.disabled = !enabled;
        });
    }

    function setOfflineUi(isCached, status, disabled) {
        if (!dom.offline) return;
        var available = !!currentSet && !!getCacheStore();
        dom.offline.disabled = !!disabled || !available;
        dom.offline.setAttribute('aria-pressed', String(!!isCached));
        if (dom.offlineIcon) dom.offlineIcon.className = isCached ? 'ti ti-trash' : 'ti ti-download';
        if (dom.offlineLabel) dom.offlineLabel.textContent = isCached ? 'Odebrat offline kopii' : 'Uložit pro offline poslech';
        if (dom.offlineStatus) dom.offlineStatus.textContent = status || (isCached ? 'uloženo offline' : '');
    }

    function clearMixer() {
        if (dom.tracks) dom.tracks.textContent = '';
        if (dom.mixer) dom.mixer.hidden = true;
    }

    function stopAllSources(set) {
        if (!set) return;
        set.tracks.forEach(function(track) {
            if (!track.sourceNode) return;
            track.sourceNode.onended = null;
            try { track.sourceNode.stop(); } catch (error) { /* již zastavený source */ }
            try { track.sourceNode.disconnect(); } catch (error) { /* již odpojený source */ }
            track.sourceNode = null;
        });
    }

    function cleanupCurrentSet() {
        loadSerial += 1;
        offlineSerial += 1;
        if (loadAbortController) {
            loadAbortController.abort();
            loadAbortController = null;
        }
        abortDownloads();
        stopAnimation();
        stopAllSources(currentSet);
        if (currentSet) {
            currentSet.playing = false;
            currentSet.tracks.forEach(function(track) {
                if (track.gainNode) {
                    try { track.gainNode.disconnect(); } catch (error) { /* již odpojeno */ }
                }
                track.sourceNode = null;
                track.gainNode = null;
                track.buffer = null;
                track.blob = null;
                track.row = null;
                track.channel = null;
            });
            currentSet.activeTracks = [];
        }
        currentSet = null;
        scrubbing = false;
        resumeAfterScrub = false;
        setTransportEnabled(false);
        updatePlaybackUi(false);
        clearMixer();
        if (dom.trackStatuses) dom.trackStatuses.textContent = '';
        if (dom.loadSummary) dom.loadSummary.textContent = '';
        if (dom.seek) {
            dom.seek.value = '0';
            dom.seek.max = '0';
        }
        if (dom.currentTime) dom.currentTime.textContent = '00:00';
        if (dom.totalTime) dom.totalTime.textContent = '00:00';
        setOfflineUi(false, '', true);
        setLoadState('idle');
        setHidden(dom.loadingPanel, true);
        setHidden(dom.empty, false);
    }

    function decodeTrack(set, track, blob, token) {
        updateTrackStatus(track, 'downloaded', 100, '');
        return blob.arrayBuffer().then(function(arrayBuffer) {
            if (token !== loadSerial || set !== currentSet) throw cancelledError();
            track.sourceSampleRate = detectSourceSampleRate(arrayBuffer, track.file);
            if (!(track.sourceSampleRate > 0)) {
                throw new Error('Nelze určit sample rate zdrojového ' + track.format.toUpperCase() + ' souboru.');
            }
            updateTrackStatus(track, 'decoding', null, '');
            return decodeAudioData(getAudioContext(), arrayBuffer);
        }).then(function(buffer) {
            if (token !== loadSerial || set !== currentSet) {
                track.buffer = null;
                throw cancelledError();
            }
            track.buffer = buffer;
            track.blob = null;
            updateTrackStatus(track, 'ready', null, '');
            return track;
        }).catch(function(error) {
            track.blob = null;
            track.buffer = null;
            if (!isCancelled(error) && token === loadSerial && set === currentSet) {
                updateTrackStatus(track, 'error', null, errorMessage(error));
            }
            return null;
        });
    }

    function cachedTrackBlob(track) {
        var store = getCacheStore();
        if (!store) return Promise.resolve(null);
        return window.idbKeyval.get(track.cacheKey, store).then(function(value) {
            return value instanceof Blob ? value : null;
        }).catch(function() { return null; });
    }

    function loadTracksSequentially(set, token) {
        var decodeJobs = [];
        var sequence = Promise.resolve();
        set.tracks.forEach(function(track) {
            sequence = sequence.then(function() {
                if (token !== loadSerial || set !== currentSet) throw cancelledError();
                return cachedTrackBlob(track).then(function(cachedBlob) {
                    if (token !== loadSerial || set !== currentSet) throw cancelledError();
                    if (cachedBlob) return cachedBlob;
                    updateTrackStatus(track, 'downloading', 0, '');
                    return downloadBlob(track.url, function(percent) {
                        if (token === loadSerial && set === currentSet) {
                            updateTrackStatus(track, 'downloading', percent, '');
                        }
                    });
                }).then(function(blob) {
                    if (token !== loadSerial || set !== currentSet) throw cancelledError();
                    track.blob = blob;
                    // Dekódování se spustí hned; další síťové stahování už na něj nečeká.
                    decodeJobs.push(decodeTrack(set, track, blob, token));
                }).catch(function(error) {
                    if (isCancelled(error)) throw error;
                    if (token === loadSerial && set === currentSet) {
                        updateTrackStatus(track, 'error', null, errorMessage(error));
                    }
                });
            });
        });
        return sequence.then(function() {
            return Promise.all(decodeJobs);
        });
    }

    function sampleRateValidationError(readyTracks) {
        var rates = new Map();
        readyTracks.forEach(function(track) {
            if (!rates.has(track.sourceSampleRate)) rates.set(track.sourceSampleRate, []);
            rates.get(track.sourceSampleRate).push(track.file);
        });
        if (rates.size <= 1) return '';
        var details = [];
        rates.forEach(function(files, rate) {
            details.push(rate + ' Hz: ' + files.join(', '));
        });
        return 'Stopy mají rozdílný sample rate. Přehrávání je zablokováno. ' + details.join(' · ');
    }

    function lengthWarning(readyTracks) {
        if (readyTracks.length < 2) return '';
        var referenceLength = readyTracks[0].buffer.length;
        var sameLength = readyTracks.every(function(track) {
            return track.buffer.length === referenceLength;
        });
        if (sameLength) return '';
        var durations = readyTracks.map(function(track) { return track.buffer.duration; });
        var minimum = Math.min.apply(Math, durations);
        var maximum = Math.max.apply(Math, durations);
        return 'Upozornění: délky stop nejsou stejné (' +
            formatPreciseTime(minimum) + '–' + formatPreciseTime(maximum) + ').';
    }

    function createElement(tag, className, text) {
        var element = document.createElement(tag);
        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;
        return element;
    }

    function applyTrackGains(set) {
        if (!set || !audioContext) return;
        var anySolo = set.activeTracks.some(function(track) { return track.solo; });
        set.activeTracks.forEach(function(track) {
            var audible = !track.muted && (!anySolo || track.solo);
            var target = audible ? track.volume : 0;
            if (track.gainNode) {
                var gain = track.gainNode.gain;
                gain.cancelScheduledValues(audioContext.currentTime);
                gain.setTargetAtTime(target, audioContext.currentTime, 0.008);
            }
            if (track.channel) {
                track.channel.root.classList.toggle('is-muted', track.muted);
                track.channel.root.classList.toggle('is-solo', track.solo);
                track.channel.root.classList.toggle('is-solo-muted', anySolo && !track.solo);
                track.channel.root.classList.toggle('is-solo-excluded', anySolo && !track.solo);
                track.channel.mute.setAttribute('aria-pressed', String(track.muted));
                track.channel.solo.setAttribute('aria-pressed', String(track.solo));
            }
        });
    }

    function renderMixer(set) {
        if (!dom.tracks) return;
        dom.tracks.textContent = '';
        set.activeTracks.forEach(function(track, index) {
            var channel = createElement('section', 'mt-channel');
            channel.dataset.trackIndex = String(index);
            channel.dataset.trackFile = track.file;

            var title = createElement('div', 'mt-channel-name', track.name);
            title.title = track.name + ' · ' + track.file;
            var actions = createElement('div', 'mt-channel-buttons mt-channel-actions');
            var solo = createElement('button', 'mt-channel-button mt-solo', 'S');
            solo.type = 'button';
            solo.setAttribute('aria-label', 'Solo: ' + track.name);
            solo.setAttribute('aria-pressed', 'false');
            solo.title = 'Solo';
            var mute = createElement('button', 'mt-channel-button mt-mute', 'M');
            mute.type = 'button';
            mute.setAttribute('aria-label', 'Mute: ' + track.name);
            mute.setAttribute('aria-pressed', 'false');
            mute.title = 'Mute';
            actions.appendChild(solo);
            actions.appendChild(mute);

            var faderWrap = createElement('label', 'mt-fader-wrap');
            var fader = createElement('input', 'mt-fader mt-volume');
            fader.type = 'range';
            fader.min = '0';
            fader.max = '100';
            fader.step = '1';
            fader.value = '100';
            fader.setAttribute('orient', 'vertical');
            fader.setAttribute('aria-label', 'Hlasitost stopy ' + track.name);
            var value = createElement('output', 'mt-volume-value', '100 %');
            faderWrap.appendChild(fader);

            channel.appendChild(title);
            channel.appendChild(actions);
            channel.appendChild(faderWrap);
            channel.appendChild(value);
            dom.tracks.appendChild(channel);
            track.channel = { root: channel, solo: solo, mute: mute, fader: fader, value: value };
        });
        setHidden(dom.mixer, false);
        applyTrackGains(set);
    }

    function updateMasterVolume(value) {
        var volume = clamp(finiteNumber(value, 100), 0, 100) / 100;
        if (masterGain && audioContext) {
            masterGain.gain.cancelScheduledValues(audioContext.currentTime);
            masterGain.gain.setTargetAtTime(volume, audioContext.currentTime, 0.008);
        }
        if (dom.masterVolume) dom.masterVolume.value = String(Math.round(volume * 100));
        if (dom.masterValue) dom.masterValue.textContent = Math.round(volume * 100) + ' %';
    }

    function activateSet(set, partial) {
        if (set !== currentSet) return;
        var context;
        try {
            context = getAudioContext();
        } catch (error) {
            failSet(set, errorMessage(error));
            return;
        }
        set.activeTracks = set.tracks.filter(function(track) { return track.status === 'ready' && track.buffer; });
        set.activeTracks.forEach(function(track) {
            track.gainNode = context.createGain();
            track.gainNode.gain.value = 1;
            track.gainNode.connect(masterGain);
        });
        set.duration = Math.max.apply(Math, set.activeTracks.map(function(track) { return track.buffer.duration; }));
        set.offset = 0;
        set.startedAt = 0;
        set.playing = false;
        set.phase = 'ready';

        renderMixer(set);
        updateMasterVolume(100);
        if (dom.seek) {
            dom.seek.min = '0';
            dom.seek.max = String(set.duration);
            dom.seek.step = '0.01';
            dom.seek.value = '0';
        }
        if (dom.totalTime) dom.totalTime.textContent = formatTime(set.duration);
        if (dom.currentTime) dom.currentTime.textContent = '00:00';
        setTransportEnabled(true);
        setHidden(dom.empty, true);
        setHidden(dom.loadingPanel, false);
        setLoadState('ready');
        updateLoadSummary(set, partial
            ? 'Připraveno ' + set.activeTracks.length + ' / ' + set.tracks.length + ' stop · částečná sada'
            : 'Připraveno ' + set.activeTracks.length + ' / ' + set.tracks.length + ' stop');

        var warning = lengthWarning(set.activeTracks);
        var offlinePrefix = set.metadataFromCache ? 'Použita offline kopie. ' : '';
        if (partial && warning) {
            showNotice(offlinePrefix + 'Přehrávají se jen úspěšně načtené stopy. ' + warning, 'warning');
        } else if (partial) {
            showNotice(offlinePrefix + 'Přehrávají se jen úspěšně načtené stopy.', 'warning');
        } else if (warning) {
            showNotice(offlinePrefix + warning, 'warning');
        } else if (set.metadataFromCache) {
            showNotice('Multitrack byl načtený z kompletní offline kopie.', 'success');
        } else {
            showNotice('', 'info');
        }
        refreshOfflineState(set);
    }

    function showErrors(errors, canContinue, continuation) {
        pendingErrorContinue = canContinue && typeof continuation === 'function' ? continuation : null;
        if (dom.errorTitle) dom.errorTitle.textContent = canContinue ? 'NĚKTERÉ STOPY SELHALY' : 'MULTITRACK NELZE SPUSTIT';
        if (dom.errorIntro) {
            dom.errorIntro.textContent = canContinue
                ? 'Tyto stopy se nepodařilo stáhnout nebo dekódovat:'
                : 'Multitrack nelze spustit:';
        }
        if (dom.errorQuestion) dom.errorQuestion.hidden = !canContinue;
        if (dom.errorClose) dom.errorClose.textContent = canContinue ? 'NEPOKRAČOVAT' : 'ZAVŘÍT';
        if (dom.errorList) {
            dom.errorList.textContent = '';
            errors.forEach(function(item) {
                var row = createElement('li', 'mt-error-item');
                var name = createElement('strong', 'mt-error-track', item.name || 'Multitrack');
                var detail = createElement('span', 'mt-error-message', item.message || 'Neznámá chyba.');
                row.appendChild(name);
                row.appendChild(document.createTextNode(' — '));
                row.appendChild(detail);
                dom.errorList.appendChild(row);
            });
        }
        if (dom.continueReady) {
            dom.continueReady.hidden = !pendingErrorContinue;
            dom.continueReady.disabled = !pendingErrorContinue;
        }
        if (!showModal('#modal_multitrack_errors')) {
            if (pendingErrorContinue && window.confirm('Některé stopy selhaly. Pokračovat se zbývajícími?')) {
                var callback = pendingErrorContinue;
                pendingErrorContinue = null;
                callback();
            }
        }
    }

    function failSet(set, message) {
        if (set !== currentSet) return;
        set.phase = 'error';
        stopAllSources(set);
        setTransportEnabled(false);
        setLoadState('error');
        updateLoadSummary(set, 'Multitrack nelze spustit');
        showNotice(message, 'error');
        showErrors([{ name: set.metadata ? set.metadata.name : set.item.name, message: message }], false, null);
        refreshOfflineState(set);
    }

    function finishTrackLoading(set, token) {
        if (token !== loadSerial || set !== currentSet) return;
        var readyTracks = set.tracks.filter(function(track) { return track.status === 'ready' && track.buffer; });
        var failedTracks = set.tracks.filter(function(track) { return track.status === 'error'; });
        var rateError = sampleRateValidationError(readyTracks);
        if (rateError) {
            failSet(set, rateError);
            return;
        }
        if (!readyTracks.length) {
            failSet(set, 'Nepodařilo se připravit ani jednu stopu.');
            return;
        }
        if (failedTracks.length) {
            set.phase = 'awaiting-confirmation';
            setLoadState('warning');
            updateLoadSummary(set, 'Připraveno ' + readyTracks.length + ' / ' + set.tracks.length + ' stop · čeká na potvrzení');
            showNotice('Některé stopy se nepodařilo načíst. Zvol, zda pokračovat.', 'warning');
            showErrors(failedTracks.map(function(track) {
                return { name: track.file, message: track.statusDetail || 'Načtení nebo dekódování selhalo.' };
            }), true, function() {
                activateSet(set, true);
            });
            return;
        }
        activateSet(set, false);
    }

    function beginLoad(item) {
        cleanupCurrentSet();
        var token = ++loadSerial;
        loadAbortController = typeof AbortController === 'function' ? new AbortController() : null;
        var set = {
            item: item,
            metadata: null,
            metadataUrl: '',
            tracks: [],
            activeTracks: [],
            cacheId: '',
            duration: 0,
            offset: 0,
            startedAt: 0,
            playing: false,
            phase: 'metadata',
            metadataFromCache: false
        };
        currentSet = set;
        if (dom.selector) dom.selector.value = item.id;
        setHidden(dom.empty, true);
        setHidden(dom.loadingPanel, false);
        setLoadState('loading');
        setTransportEnabled(false);
        setOfflineUi(false, 'kontroluji offline kopii…', true);
        showNotice('', 'info');
        if (dom.loadSummary) dom.loadSummary.textContent = 'Načítám metadata…';

        loadMetadata(item, loadAbortController ? loadAbortController.signal : undefined).then(function(result) {
            if (token !== loadSerial || set !== currentSet) throw cancelledError();
            set.metadataUrl = result.url;
            set.metadataFromCache = !!result.offline;
            set.metadata = normalizeMetadata(item, result.payload, result.url);
            set.tracks = set.metadata.tracks;
            set.cacheId = cacheIdFor(set);
            set.tracks.forEach(function(track) { track.cacheKey = trackCacheKey(set, track); });
            set.phase = 'loading';
            renderTrackStatuses(set);
            updateLoadSummary(set);
            setOfflineUi(false, 'kontroluji offline kopii…', !getCacheStore());
            refreshOfflineState(set);
            return loadTracksSequentially(set, token);
        }).then(function() {
            finishTrackLoading(set, token);
        }).catch(function(error) {
            if (isCancelled(error) || token !== loadSerial || set !== currentSet) return;
            failSet(set, errorMessage(error));
        });
    }

    function currentPosition(set) {
        if (!set) return 0;
        if (!set.playing || !audioContext) return clamp(set.offset, 0, set.duration || 0);
        var elapsed = Math.max(0, audioContext.currentTime - set.startedAt);
        return clamp(set.offset + elapsed, 0, set.duration || 0);
    }

    function updatePlaybackUi(playing) {
        if (!dom.play) return;
        var label = playing ? 'Pozastavit' : 'Přehrát';
        dom.play.classList.toggle('on', !!playing);
        dom.play.setAttribute('aria-pressed', String(!!playing));
        dom.play.setAttribute('aria-label', label);
        dom.play.title = label;
        if (dom.playIcon) {
            dom.playIcon.className = playing ? 'ti ti-player-pause-filled' : 'ti ti-player-play-filled';
        }
    }

    function renderClock(set, position) {
        if (!set || set !== currentSet) return;
        var safePosition = clamp(position, 0, set.duration || 0);
        if (dom.currentTime) dom.currentTime.textContent = formatTime(safePosition);
        if (dom.totalTime) dom.totalTime.textContent = formatTime(set.duration);
        if (dom.seek && !scrubbing) dom.seek.value = String(safePosition);
    }

    function stopAnimation() {
        if (animationFrame !== null) {
            window.cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
    }

    function animateClock() {
        stopAnimation();
        function tick() {
            var set = currentSet;
            if (!set || !set.playing) {
                animationFrame = null;
                return;
            }
            var position = currentPosition(set);
            renderClock(set, position);
            if (position >= set.duration) {
                stopAllSources(set);
                set.offset = set.duration;
                set.playing = false;
                updatePlaybackUi(false);
                animationFrame = null;
                return;
            }
            animationFrame = window.requestAnimationFrame(tick);
        }
        animationFrame = window.requestAnimationFrame(tick);
    }

    function createAndScheduleSources(set, offset) {
        var scheduledSources = [];
        set.activeTracks.forEach(function(track) {
            track.sourceNode = null;
            if (!track.buffer || offset >= track.buffer.duration) return;
            var source = audioContext.createBufferSource();
            source.buffer = track.buffer;
            source.connect(track.gainNode);
            source.onended = function() {
                if (track.sourceNode === source) {
                    try { source.disconnect(); } catch (error) { /* již odpojeno */ }
                    track.sourceNode = null;
                }
            };
            track.sourceNode = source;
            scheduledSources.push(source);
        });
        // Clock se odečte až po vytvoření všech nodes. Ani větší mixer tak
        // nespotřebuje plánovací předstih během konstrukce grafu.
        var when = audioContext.currentTime + START_LEAD_SECONDS +
            Math.min(0.25, scheduledSources.length * 0.0005);
        scheduledSources.forEach(function(source) {
            source.start(when, offset);
        });
        return when;
    }

    function playTransport() {
        var set = currentSet;
        if (!set || set.phase !== 'ready' || set.playing || !set.activeTracks.length) return Promise.resolve();
        var context;
        try {
            context = getAudioContext();
        } catch (error) {
            showNotice(errorMessage(error), 'error');
            return Promise.reject(error);
        }
        if (set.offset >= set.duration) set.offset = 0;
        var intendedSet = set;
        return context.resume().then(function() {
            if (intendedSet !== currentSet || intendedSet.phase !== 'ready' || intendedSet.playing) return;
            stopAllSources(intendedSet);
            var when;
            try {
                when = createAndScheduleSources(intendedSet, intendedSet.offset);
            } catch (error) {
                stopAllSources(intendedSet);
                showNotice('Přehrávání se nepodařilo spustit: ' + errorMessage(error), 'error');
                return;
            }
            // Jeden společný okamžik je autorita času pro všechny source nodes.
            intendedSet.startedAt = when;
            intendedSet.playing = true;
            updatePlaybackUi(true);
            renderClock(intendedSet, intendedSet.offset);
            animateClock();
        }).catch(function(error) {
            showNotice('AudioContext se nepodařilo aktivovat: ' + errorMessage(error), 'error');
        });
    }

    function pauseTransport() {
        var set = currentSet;
        if (!set || !set.playing) return;
        set.offset = currentPosition(set);
        set.playing = false;
        stopAllSources(set);
        stopAnimation();
        updatePlaybackUi(false);
        renderClock(set, set.offset);
    }

    function seekTo(seconds, resumeIfPlaying) {
        var set = currentSet;
        if (!set || set.phase !== 'ready') return;
        var wasPlaying = set.playing;
        var target = clamp(finiteNumber(seconds, 0), 0, set.duration);
        if (wasPlaying) {
            set.playing = false;
            stopAllSources(set);
            stopAnimation();
        }
        set.offset = target;
        updatePlaybackUi(false);
        renderClock(set, target);
        if (wasPlaying && resumeIfPlaying !== false && target < set.duration) playTransport();
    }

    function seekBy(seconds) {
        var set = currentSet;
        if (!set || set.phase !== 'ready') return;
        seekTo(currentPosition(set) + seconds, true);
    }

    function restartTransport() {
        var set = currentSet;
        if (!set || set.phase !== 'ready') return;
        if (set.playing) {
            seekTo(0, true);
        } else {
            set.offset = 0;
            renderClock(set, 0);
            playTransport();
        }
    }

    function togglePlayback() {
        if (!currentSet || currentSet.phase !== 'ready') return;
        if (currentSet.playing) pauseTransport();
        else playTransport();
    }

    function manifestMatchesSet(manifest, set) {
        if (!manifest || manifest.version !== 1 || manifest.setId !== set.cacheId || !Array.isArray(manifest.tracks)) {
            return false;
        }
        if (manifest.tracks.length !== set.tracks.length) return false;
        return set.tracks.every(function(track, index) {
            var saved = manifest.tracks[index];
            return saved && saved.url === track.url && saved.key === track.cacheKey;
        });
    }

    function inspectOfflineState(set) {
        var store = getCacheStore();
        if (!store || !set || !set.cacheId) return Promise.resolve(false);
        return window.idbKeyval.get(manifestCacheKey(set), store).then(function(manifest) {
            if (!manifestMatchesSet(manifest, set)) return false;
            return Promise.all(set.tracks.map(function(track) {
                return window.idbKeyval.get(track.cacheKey, store).then(function(value) {
                    return value instanceof Blob;
                });
            })).then(function(results) {
                return results.every(Boolean);
            });
        }).catch(function() { return false; });
    }

    function refreshOfflineState(set) {
        if (!set || set !== currentSet || !set.cacheId) return Promise.resolve(false);
        if (!getCacheStore()) {
            setOfflineUi(false, 'offline úložiště není dostupné', true);
            return Promise.resolve(false);
        }
        setOfflineUi(false, 'kontroluji offline kopii…', true);
        return inspectOfflineState(set).then(function(complete) {
            if (set !== currentSet) return complete;
            set.offlineComplete = complete;
            setOfflineUi(complete, complete ? 'uloženo offline · kompletní sada' : '', false);
            return complete;
        });
    }

    function removeStoredKeys(store, keys) {
        return Promise.all(keys.map(function(key) {
            return window.idbKeyval.del(key, store);
        }));
    }

    function removeStoredKeysBestEffort(store, keys) {
        return Promise.all(keys.map(function(key) {
            return window.idbKeyval.del(key, store).catch(function() { return null; });
        }));
    }

    function saveSetOffline(set) {
        var store = getCacheStore();
        if (!store || !set || set !== currentSet) return Promise.resolve(false);
        var token = ++offlineSerial;
        var total = set.tracks.length;
        var completed = 0;
        var storedKeys = [];
        var failures = [];
        setOfflineUi(false, 'ukládání 0 / ' + total + ' stop', true);

        // Manifest je commit marker. Dokud nejsou všechny Bloby bezpečně uložené,
        // nesmí sada v UI vypadat jako kompletní.
        return window.idbKeyval.del(manifestCacheKey(set), store).then(function() {
            var sequence = Promise.resolve();
            set.tracks.forEach(function(track) {
                sequence = sequence.then(function() {
                    if (token !== offlineSerial || set !== currentSet) throw cancelledError();
                    setOfflineUi(false, 'ukládání ' + completed + ' / ' + total + ' stop · ' + track.file, true);
                    return window.idbKeyval.get(track.cacheKey, store).then(function(existing) {
                        if (existing instanceof Blob) return existing;
                        return downloadBlob(track.url, function(percent) {
                            if (token !== offlineSerial || set !== currentSet) return;
                            var progress = percent === null ? '' : ' · ' + percent + ' %';
                            setOfflineUi(false, 'ukládání ' + completed + ' / ' + total + ' stop · ' + track.file + progress, true);
                        });
                    }).then(function(blob) {
                        if (token !== offlineSerial || set !== currentSet) throw cancelledError();
                        return window.idbKeyval.set(track.cacheKey, blob, store).then(function() {
                            storedKeys.push(track.cacheKey);
                        });
                    }).catch(function(error) {
                        if (isCancelled(error)) throw error;
                        failures.push({ track: track, error: error });
                    }).then(function() {
                        completed += 1;
                        if (token === offlineSerial && set === currentSet) {
                            var suffix = failures.length ? ' · chyba: ' + failures[failures.length - 1].track.file : '';
                            setOfflineUi(false, 'ukládání ' + completed + ' / ' + total + ' stop' + suffix, true);
                        }
                    });
                });
            });
            return sequence;
        }).then(function() {
            if (token !== offlineSerial || set !== currentSet) throw cancelledError();
            if (failures.length) {
                return removeStoredKeysBestEffort(store, storedKeys.concat([manifestCacheKey(set)])).then(function() {
                    var failedNames = failures.map(function(failure) { return failure.track.file; }).join(', ');
                    set.offlineComplete = false;
                    setOfflineUi(false, 'chyba při ukládání: ' + failedNames, false);
                    showNotice('Offline sada není kompletní. Nepodařilo se uložit: ' + failedNames + '.', 'error');
                    return false;
                });
            }
            var manifest = {
                version: 1,
                setId: set.cacheId,
                id: set.item.id,
                name: set.metadata.name,
                created: set.metadata.created,
                baseUrl: set.metadata.baseUrl,
                savedAt: new Date().toISOString(),
                tracks: set.tracks.map(function(track) {
                    return {
                        file: track.file,
                        name: track.name,
                        order: track.order,
                        url: track.url,
                        key: track.cacheKey
                    };
                })
            };
            return window.idbKeyval.set(manifestCacheKey(set), manifest, store).then(function() {
                if (token !== offlineSerial || set !== currentSet) throw cancelledError();
                set.offlineComplete = true;
                setOfflineUi(true, 'uloženo offline · kompletní sada', false);
                showNotice('Multitrack je kompletně uložený pro offline poslech.', 'success');
                return true;
            });
        }).catch(function(error) {
            return removeStoredKeysBestEffort(store, storedKeys.concat([manifestCacheKey(set)])).then(function() {
                if (!isCancelled(error) && token === offlineSerial && set === currentSet) {
                    set.offlineComplete = false;
                    setOfflineUi(false, 'offline uložení se nezdařilo', false);
                    showNotice('Offline uložení se nezdařilo: ' + errorMessage(error), 'error');
                }
                return false;
            });
        });
    }

    function removeSetOffline(set) {
        var store = getCacheStore();
        if (!store || !set || set !== currentSet) return Promise.resolve(false);
        var token = ++offlineSerial;
        var keys = set.tracks.map(function(track) { return track.cacheKey; });
        keys.push(manifestCacheKey(set));
        setOfflineUi(true, 'mažu offline kopii…', true);
        return removeStoredKeys(store, keys).then(function() {
            if (token !== offlineSerial || set !== currentSet) return false;
            set.offlineComplete = false;
            setOfflineUi(false, '', false);
            showNotice('Offline kopie multitracku byla odstraněna.', 'success');
            return true;
        }).catch(function(error) {
            return inspectOfflineState(set).then(function(complete) {
                if (token === offlineSerial && set === currentSet) {
                    set.offlineComplete = complete;
                    setOfflineUi(complete, 'offline kopii se nepodařilo úplně odstranit', false);
                    showNotice('Offline kopii se nepodařilo úplně odstranit: ' + errorMessage(error), 'error');
                }
                return false;
            });
        });
    }

    function requestOfflineChange() {
        var set = currentSet;
        if (!set || !getCacheStore() || dom.offline.disabled) return;
        var remove = dom.offline.getAttribute('aria-pressed') === 'true';
        pendingOfflineAction = { set: set, remove: remove };
        if (dom.offlineConfirmTitle) {
            dom.offlineConfirmTitle.textContent = remove ? 'ODEBRAT OFFLINE KOPII?' : 'ULOŽIT PRO OFFLINE POSLECH?';
        }
        if (dom.offlineConfirmMessage) {
            dom.offlineConfirmMessage.textContent = remove
                ? 'Odstranit kompletní offline kopii „' + set.metadata.name + '“ z tohoto prohlížeče? Soubory na serveru zůstanou beze změny.'
                : 'Uložit všech ' + set.tracks.length + ' zdrojových stop multitracku „' + set.metadata.name + '“ do tohoto prohlížeče?';
        }
        if (dom.offlineConfirmSubmit) {
            dom.offlineConfirmSubmit.textContent = remove ? 'ODEBRAT' : 'ULOŽIT';
            dom.offlineConfirmSubmit.classList.toggle('btn-danger', remove);
            dom.offlineConfirmSubmit.classList.toggle('btn-primary', !remove);
        }
        if (!showModal('#modal_multitrack_offline')) {
            var confirmed = window.confirm(dom.offlineConfirmMessage ? dom.offlineConfirmMessage.textContent : 'Potvrdit offline operaci?');
            if (confirmed) executeOfflineChange();
            else pendingOfflineAction = null;
        }
    }

    function executeOfflineChange() {
        var pending = pendingOfflineAction;
        pendingOfflineAction = null;
        if (!pending || pending.set !== currentSet) return;
        hideModal('#modal_multitrack_offline');
        if (pending.remove) removeSetOffline(pending.set);
        else saveSetOffline(pending.set);
    }

    function selectedUploadFiles() {
        return dom.uploadFiles ? Array.from(dom.uploadFiles.files || []) : [];
    }

    function sortFiles(files) {
        return files.slice().sort(function(a, b) {
            return a.name.localeCompare(b.name, 'cs-CZ', { sensitivity: 'base', numeric: true });
        });
    }

    function validateUploadBasics(name, files) {
        if (!String(name || '').trim()) throw new Error('Zadejte název multitracku.');
        if (files.length < 2) throw new Error('Vyberte alespoň dvě audio stopy.');
        var seen = new Set();
        var formats = new Set();
        files.forEach(function(file) {
            var extension = extensionOf(file.name);
            if (AUDIO_FORMATS.indexOf(extension) === -1) {
                throw new Error('Soubor „' + file.name + '“ není WAV, FLAC ani MP3.');
            }
            formats.add(extension);
            var normalizedName = file.name.toLocaleLowerCase('cs-CZ');
            if (seen.has(normalizedName)) throw new Error('Soubor „' + file.name + '“ je vybraný vícekrát.');
            seen.add(normalizedName);
        });
        if (formats.size !== 1) throw new Error('Všechny stopy jedné sady musí mít stejný formát.');
    }

    function readUploadSampleRate(file) {
        var prefixSize = Math.min(file.size, 2 * 1024 * 1024);
        return file.slice(0, prefixSize).arrayBuffer().then(function(prefix) {
            var rate = detectSourceSampleRate(prefix, file.name);
            if (rate || extensionOf(file.name) !== 'mp3') return rate;

            // Velký ID3 tag (typicky obal alba) může ležet před prvním MPEG framem.
            // Pro kontrolu není nutné držet v paměti celý zdrojový soubor.
            var bytes = new Uint8Array(prefix);
            var audioOffset = id3PayloadLength(bytes);
            if (audioOffset < prefix.byteLength || audioOffset >= file.size) return null;
            return file.slice(audioOffset, Math.min(file.size, audioOffset + 2 * 1024 * 1024))
                .arrayBuffer()
                .then(function(audioPrefix) {
                    return detectMp3SampleRate(audioPrefix);
                });
        });
    }

    function validateUploadSampleRates(files) {
        var rates = [];
        var sequence = Promise.resolve();
        files.forEach(function(file, index) {
            sequence = sequence.then(function() {
                if (dom.uploadProgressText) {
                    dom.uploadProgressText.textContent = 'Kontroluji stopu ' + (index + 1) + ' / ' + files.length + '…';
                }
                return readUploadSampleRate(file).then(function(rate) {
                    if (!(rate > 0)) throw new Error('U souboru „' + file.name + '“ nelze určit sample rate.');
                    rates.push({ file: file.name, rate: rate });
                });
            });
        });
        return sequence.then(function() {
            var uniqueRates = Array.from(new Set(rates.map(function(item) { return item.rate; })));
            if (uniqueRates.length > 1) {
                throw new Error('Stopy mají rozdílný sample rate: ' + rates.map(function(item) {
                    return item.file + ' (' + item.rate + ' Hz)';
                }).join(', ') + '.');
            }
            return uniqueRates[0];
        });
    }

    function renderUploadSelection() {
        if (!dom.uploadSelection) return;
        var files = sortFiles(selectedUploadFiles());
        dom.uploadSelection.textContent = '';
        if (!files.length) return;
        var summary = createElement('div', 'mt-upload-selection-summary', files.length + ' ' +
            (files.length === 1 ? 'stopa' : (files.length < 5 ? 'stopy' : 'stop')) + ':');
        var list = createElement('ul', 'mt-upload-file-list');
        files.forEach(function(file) {
            list.appendChild(createElement('li', '', file.name));
        });
        dom.uploadSelection.appendChild(summary);
        dom.uploadSelection.appendChild(list);
    }

    function setUploadResult(message, error) {
        if (!dom.uploadResult) return;
        dom.uploadResult.textContent = message || '';
        dom.uploadResult.hidden = !message;
        dom.uploadResult.classList.toggle('is-error', !!error);
        dom.uploadResult.classList.toggle('is-success', !!message && !error);
    }

    function setUploadBusy(busy) {
        if (dom.uploadSubmit) dom.uploadSubmit.disabled = !!busy;
        if (dom.uploadName) dom.uploadName.disabled = !!busy;
        if (dom.uploadFiles) dom.uploadFiles.disabled = !!busy;
        setHidden(dom.uploadProgressWrap, !busy);
    }

    function sendUpload(name, files) {
        if (!config.uploadUrl) return Promise.reject(new Error('Chybí adresa upload endpointu.'));
        var formData = new FormData();
        formData.append('name', name);
        formData.append('track_count', String(files.length));
        if (config.csrfToken) {
            formData.append('csrf', config.csrfToken);
            // Kompatibilita s případným starším endpointem.
            formData.append('csrf_token', config.csrfToken);
        }
        files.forEach(function(file) { formData.append('tracks[]', file, file.name); });

        return new Promise(function(resolve, reject) {
            var xhr = new XMLHttpRequest();
            uploadXhr = xhr;
            xhr.open('POST', config.uploadUrl, true);
            xhr.responseType = 'json';
            xhr.setRequestHeader('Accept', 'application/json');
            if (config.csrfToken) xhr.setRequestHeader('X-CSRF-Token', config.csrfToken);
            xhr.upload.onprogress = function(event) {
                if (!event.lengthComputable || !(event.total > 0)) {
                    if (dom.uploadProgressText) dom.uploadProgressText.textContent = 'Nahrávám…';
                    return;
                }
                var percent = clamp(Math.round(event.loaded / event.total * 100), 0, 100);
                if (dom.uploadProgressBar) dom.uploadProgressBar.style.width = percent + '%';
                if (dom.uploadProgressText) dom.uploadProgressText.textContent = percent + ' %';
            };
            xhr.onload = function() {
                uploadXhr = null;
                var payload = xhr.response;
                if (!payload && xhr.responseText) {
                    try { payload = JSON.parse(xhr.responseText); } catch (error) { payload = null; }
                }
                if (xhr.status >= 200 && xhr.status < 300 && payload && payload.ok !== false) {
                    resolve(payload);
                    return;
                }
                reject(new Error((payload && (payload.error || payload.chyba)) || 'Upload selhal (HTTP ' + xhr.status + ').'));
            };
            xhr.onerror = function() {
                uploadXhr = null;
                reject(new Error('Chyba spojení při uploadu.'));
            };
            xhr.onabort = function() {
                uploadXhr = null;
                reject(cancelledError());
            };
            xhr.send(formData);
        });
    }

    function submitUpload(event) {
        event.preventDefault();
        if (!config.canUpload) {
            setUploadResult('Pro upload nemáte oprávnění.', true);
            return;
        }
        var name = dom.uploadName ? dom.uploadName.value.trim() : '';
        var files = sortFiles(selectedUploadFiles());
        var token = ++uploadSerial;
        setUploadResult('', false);
        if (dom.uploadProgressBar) dom.uploadProgressBar.style.width = '0';
        try {
            validateUploadBasics(name, files);
        } catch (error) {
            setUploadResult(errorMessage(error), true);
            return;
        }
        setUploadBusy(true);
        if (dom.uploadProgressText) dom.uploadProgressText.textContent = 'Kontroluji soubory…';
        validateUploadSampleRates(files).then(function() {
            if (token !== uploadSerial) throw cancelledError();
            if (dom.uploadProgressText) dom.uploadProgressText.textContent = 'Nahrávám…';
            return sendUpload(name, files);
        }).then(function(payload) {
            if (token !== uploadSerial) throw cancelledError();
            if (dom.uploadProgressBar) dom.uploadProgressBar.style.width = '100%';
            if (dom.uploadProgressText) dom.uploadProgressText.textContent = '100 %';
            setUploadResult('Multitrack byl úspěšně vložen.', false);
            var created = payload.multitrack || payload.item || {};
            var selected = currentSet ? currentSet.item.id : '';
            return refreshList(selected).then(function() {
                showNotice('Nový multitrack „' + (created.name || name) + '“ je v seznamu.', 'success');
                if (dom.uploadForm) dom.uploadForm.reset();
                renderUploadSelection();
                hideModal('#modal_multitrack_upload');
            }, function(error) {
                showNotice(
                    'Multitrack byl uložen, ale seznam se nepodařilo obnovit: ' + errorMessage(error),
                    'warning'
                );
            });
        }).catch(function(error) {
            if (!isCancelled(error) && token === uploadSerial) setUploadResult(errorMessage(error), true);
        }).finally(function() {
            if (token === uploadSerial) setUploadBusy(false);
        });
    }

    function requestSetSelection(item) {
        if (!item) return;
        if (!currentSet) {
            beginLoad(item);
            return;
        }
        if (currentSet.item.id === item.id) {
            if (dom.selector) dom.selector.value = item.id;
            return;
        }
        pendingSwitch = item;
        if (dom.selector) dom.selector.value = currentSet.item.id;
        if (dom.switchName) dom.switchName.textContent = item.name;
        if (!showModal('#modal_multitrack_switch')) {
            if (window.confirm('Načíst „' + item.name + '“ a uvolnit současný multitrack?')) {
                confirmSetSwitch();
            } else {
                pendingSwitch = null;
            }
        }
    }

    function confirmSetSwitch() {
        var item = pendingSwitch;
        pendingSwitch = null;
        if (!item) return;
        hideModal('#modal_multitrack_switch');
        // Teprve potvrzením se zastaví transport a uvolní staré AudioBuffery.
        beginLoad(item);
    }

    function continueWithReadyTracks() {
        var callback = pendingErrorContinue;
        pendingErrorContinue = null;
        if (!callback) return;
        hideModal('#modal_multitrack_errors');
        callback();
    }

    function trackForControl(control) {
        var channel = control && control.closest('.mt-channel');
        if (!channel || !currentSet) return null;
        var index = Number(channel.dataset.trackIndex);
        return currentSet.activeTracks[index] || null;
    }

    function handleMixerClick(event) {
        var button = event.target.closest('.mt-mute, .mt-solo');
        if (!button || !dom.tracks || !dom.tracks.contains(button)) return;
        var track = trackForControl(button);
        if (!track) return;
        if (button.classList.contains('mt-mute')) track.muted = !track.muted;
        if (button.classList.contains('mt-solo')) track.solo = !track.solo;
        applyTrackGains(currentSet);
    }

    function handleMixerVolume(event) {
        var fader = event.target.closest('.mt-volume');
        if (!fader || !dom.tracks || !dom.tracks.contains(fader)) return;
        var track = trackForControl(fader);
        if (!track) return;
        track.volume = clamp(finiteNumber(fader.value, 100), 0, 100) / 100;
        if (track.channel) track.channel.value.textContent = Math.round(track.volume * 100) + ' %';
        applyTrackGains(currentSet);
    }

    function beginScrub() {
        if (scrubbing || !currentSet || currentSet.phase !== 'ready') return;
        resumeAfterScrub = currentSet.playing;
        if (currentSet.playing) pauseTransport();
        scrubbing = true;
    }

    function updateScrub() {
        if (!currentSet || currentSet.phase !== 'ready' || !dom.seek) return;
        beginScrub();
        currentSet.offset = clamp(finiteNumber(dom.seek.value, 0), 0, currentSet.duration);
        if (dom.currentTime) dom.currentTime.textContent = formatTime(currentSet.offset);
    }

    function endScrub() {
        if (!scrubbing || !currentSet || !dom.seek) return;
        var shouldResume = resumeAfterScrub;
        var target = clamp(finiteNumber(dom.seek.value, 0), 0, currentSet.duration);
        scrubbing = false;
        resumeAfterScrub = false;
        seekTo(target, false);
        if (shouldResume && target < currentSet.duration) playTransport();
    }

    function cacheDom() {
        dom.selector = byId('mt-selector');
        dom.notice = byId('mt-notice');
        dom.loadingPanel = byId('mt-loading-panel');
        dom.loadSummary = byId('mt-load-summary');
        dom.trackStatuses = byId('mt-track-statuses');
        dom.restart = byId('mt-restart');
        dom.backward = byId('mt-backward');
        dom.play = byId('mt-play');
        dom.playIcon = byId('mt-play-icon');
        dom.forward = byId('mt-forward');
        dom.seek = byId('mt-seek');
        dom.currentTime = byId('mt-current-time');
        dom.totalTime = byId('mt-total-time');
        dom.offline = byId('mt-offline');
        dom.offlineIcon = byId('mt-offline-icon');
        dom.offlineLabel = byId('mt-offline-label');
        dom.offlineStatus = byId('mt-offline-status');
        dom.mixer = byId('mt-mixer');
        dom.tracks = byId('mt-tracks');
        dom.masterVolume = byId('mt-master-volume');
        dom.masterValue = byId('mt-master-value');
        dom.empty = byId('mt-empty');
        dom.switchName = byId('mt-switch-name');
        dom.switchConfirm = byId('mt-switch-confirm');
        dom.errorTitle = byId('mt-errors-title');
        dom.errorIntro = byId('mt-error-intro');
        dom.errorList = byId('mt-error-list');
        dom.errorQuestion = byId('mt-error-question');
        dom.errorClose = byId('mt-error-close');
        dom.continueReady = byId('mt-continue-ready');
        dom.offlineConfirmTitle = byId('mt-offline-confirm-title');
        dom.offlineConfirmMessage = byId('mt-offline-confirm-message');
        dom.offlineConfirmSubmit = byId('mt-offline-confirm-submit');
        dom.uploadForm = byId('mt-upload-form');
        dom.uploadName = byId('mt-upload-name');
        dom.uploadFiles = byId('mt-upload-files');
        dom.uploadSelection = byId('mt-upload-selection');
        dom.uploadProgressWrap = byId('mt-upload-progress-wrap');
        dom.uploadProgressBar = byId('mt-upload-progress-bar');
        dom.uploadProgressText = byId('mt-upload-progress-text');
        dom.uploadResult = byId('mt-upload-result');
        dom.uploadSubmit = byId('mt-upload-submit');
    }

    function bindEvents() {
        if (dom.selector) {
            dom.selector.addEventListener('change', function() {
                var item = items.get(dom.selector.value);
                if (item) requestSetSelection(item);
            });
        }
        if (dom.restart) dom.restart.addEventListener('click', restartTransport);
        if (dom.backward) dom.backward.addEventListener('click', function() { seekBy(-5); });
        if (dom.play) dom.play.addEventListener('click', togglePlayback);
        if (dom.forward) dom.forward.addEventListener('click', function() { seekBy(5); });
        if (dom.seek) {
            dom.seek.addEventListener('pointerdown', beginScrub);
            dom.seek.addEventListener('input', updateScrub);
            dom.seek.addEventListener('change', endScrub);
            dom.seek.addEventListener('blur', endScrub);
        }
        if (dom.tracks) {
            dom.tracks.addEventListener('click', handleMixerClick);
            dom.tracks.addEventListener('input', handleMixerVolume);
        }
        if (dom.masterVolume) {
            dom.masterVolume.addEventListener('input', function() { updateMasterVolume(dom.masterVolume.value); });
        }
        if (dom.offline) dom.offline.addEventListener('click', requestOfflineChange);
        if (dom.offlineConfirmSubmit) dom.offlineConfirmSubmit.addEventListener('click', executeOfflineChange);
        if (dom.switchConfirm) dom.switchConfirm.addEventListener('click', confirmSetSwitch);
        if (dom.continueReady) dom.continueReady.addEventListener('click', continueWithReadyTracks);
        if (dom.uploadFiles) dom.uploadFiles.addEventListener('change', renderUploadSelection);
        if (dom.uploadForm) dom.uploadForm.addEventListener('submit', submitUpload);

        if (window.jQuery) {
            window.jQuery('#modal_multitrack_switch').on('hidden.bs.modal', function() {
                pendingSwitch = null;
                if (dom.selector && currentSet) dom.selector.value = currentSet.item.id;
            });
            window.jQuery('#modal_multitrack_errors').on('hidden.bs.modal', function() {
                pendingErrorContinue = null;
            });
            window.jQuery('#modal_multitrack_offline').on('hidden.bs.modal', function() {
                pendingOfflineAction = null;
            });
            window.jQuery('#modal_multitrack_upload').on('hidden.bs.modal', function() {
                uploadSerial += 1;
                if (uploadXhr) uploadXhr.abort();
                setUploadBusy(false);
            });
        }
        window.addEventListener('pagehide', cleanupCurrentSet);
    }

    function initialise() {
        cacheDom();
        if (!dom.selector) return;
        bindEvents();
        setTransportEnabled(false);
        setOfflineUi(false, getCacheStore() ? '' : 'offline úložiště není dostupné', true);
        setLoadState('loading');
        if (dom.uploadForm && !config.canUpload) {
            Array.from(dom.uploadForm.elements).forEach(function(element) { element.disabled = true; });
        }
        refreshList().then(function(list) {
            if (!currentSet) setLoadState('idle');
            if (config.initialId && items.has(String(config.initialId))) {
                requestSetSelection(items.get(String(config.initialId)));
            } else if (!list.length) {
                setLoadState('idle');
            }
        }).catch(function() {
            setLoadState('error');
        });
    }

    window.MultitrackApp = {
        refreshList: refreshList,
        load: function(id) {
            var item = items.get(String(id));
            if (!item) return false;
            requestSetSelection(item);
            return true;
        },
        pause: pauseTransport,
        play: playTransport,
        seek: function(seconds) { seekTo(seconds, true); },
        destroy: cleanupCurrentSet,
        detectSourceSampleRate: detectSourceSampleRate,
        getState: function() {
            if (!currentSet) return null;
            return {
                id: currentSet.item.id,
                name: currentSet.metadata ? currentSet.metadata.name : currentSet.item.name,
                phase: currentSet.phase,
                playing: currentSet.playing,
                position: currentPosition(currentSet),
                duration: currentSet.duration,
                tracks: currentSet.tracks.map(function(track) {
                    return {
                        file: track.file,
                        status: track.status,
                        sampleRate: track.sourceSampleRate,
                        duration: track.buffer ? track.buffer.duration : null,
                        muted: track.muted,
                        solo: track.solo,
                        volume: track.volume
                    };
                })
            };
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialise, { once: true });
    } else {
        initialise();
    }
})();
