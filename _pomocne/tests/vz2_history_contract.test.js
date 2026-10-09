'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = file => fs.readFileSync(require('node:path').join(__dirname, '../..', file), 'utf8');
const sql = read('_pomocne/migrations/005_vz2_rehearsal_history.sql');
const php = read('php/inc/vz2_history.php');
const ui = read('js/vz2-history.js');
const page = read('vz2.php');
const auth = read('php/auth.php');
for (const fk of ['fk_vz2_play_rehearsal','fk_vz2_play_song','fk_vz2_play_source','fk_vz2_play_start','fk_vz2_play_end','fk_vz2_play_clip']) {
    assert.match(sql, new RegExp('CONSTRAINT '+fk+'[\\s\\S]*?ON DELETE RESTRICT'));
}
assert.match(sql, /UNIQUE KEY uq_vz2_play_interval/);
assert.match(sql, /UNIQUE KEY uq_vz2_play_clip/);
assert.match(sql, /ENUM\('song_start','song_end','passage','note'\)/);
assert.doesNotMatch(sql, /ADD CONSTRAINT IF NOT EXISTS/);
assert.match(sql, /information_schema\.TABLE_CONSTRAINTS/);
assert.match(sql, /PREPARE vz2_stmt[\s\S]*EXECUTE vz2_stmt[\s\S]*DEALLOCATE PREPARE vz2_stmt/);
assert.match(php, /start_timestamp_id/);
assert.match(php, /end_timestamp_id/);
assert.match(php, /kind'\]!==\s*'song_start'/);
assert.match(php, /kind'\]!==\s*'song_end'/);
assert.match(php, /t\['time_ms'\] >= \$p\['start_ms'\] && \$t\['time_ms'\] < \$p\['end_ms'\]/);
assert.match(ui, /history-audio-filter/);
assert.match(ui, /history-orientation/);
assert.match(ui, /if\(!confirm\('Odebrat pouze historický pokus\?/);
for (const id of ['show-history', 'history-workspace', 'history-matrix', 'history-list', 'history-add', 'history-detail']) {
    assert.match(page, new RegExp('id="' + id + '"'), 'history UI must be present: ' + id);
}
assert.match(page, /<script\b[^>]*\bsrc="js\/vz2-history\.js(?:\?|"|')/, 'history controller must actually load');
assert.doesNotMatch(page, /data-desktop-panel="history"/);
assert.match(auth, /php\/ajax\/vz2_history\.php/, 'VZ2_ONLY must allow the history endpoint');
console.log('PASS rehearsal history schema, interval semantics and workspace and compact matrix contract');
