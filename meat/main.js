/* ── main.js — Virtuální zkušebna ── */

// ── Načtení panelů při startu ──
$(function() {
  nacistPanel('text');
  nacistPanel('nahravky');
  nacistPanel('diskuse');
  nacistPanel('napady');
});

// ── AJAX načtení panelu ──
function nacistPanel(panel) {
  $.get('/php/ajax/ajax_' + panel + '.php', { val: VZ.aktualniVal }, function(html) {
    $('#body-' + panel).html(html);
  }).fail(function() {
    $('#body-' + panel).html('<div style="color:#888;padding:12px;font-size:12px">Chyba načítání</div>');
  });
}

function nacistVsechnyPanely() {
  ['text','nahravky','diskuse','napady'].forEach(nacistPanel);
}

// ── Přepnutí válu ──
function switchVal(val, nazev, el) {
  if (val === VZ.aktualniVal) {
    document.getElementById('val-drawer').classList.remove('open');
    return;
  }

  VZ.aktualniVal   = val;
  VZ.aktualniNazev = nazev;

  document.getElementById('topbar-val').textContent        = nazev;
  document.getElementById('diskuse-val-label').textContent = nazev;

  document.querySelectorAll('#sidebar-playlist .val-item').forEach(function(v) {
    v.classList.toggle('active', v.dataset.val === val);
  });
  document.querySelectorAll('#val-drawer .dval').forEach(function(v) {
    v.classList.remove('active');
  });
  if (el) el.classList.add('active');

  document.getElementById('val-drawer').classList.remove('open');

  $.post('/php/zmenit_slozku_ajax.php', { cilova_slozka: val }, function() {
    $('.panel-body').css('opacity', '0.3');
    setTimeout(function() { $('.panel-body').css('opacity', '1'); }, 200);
    nacistVsechnyPanely();
    looperZavrit();
  });
}

// ── Desktop view ──
function desktopView(view, el) {
  document.querySelectorAll('.topnav a').forEach(function(a) { a.classList.remove('active'); });
  if (el) el.classList.add('active');

  if (view === 'napady') {
    $('#panel-text, #panel-nahravky, #panel-diskuse').css('display', 'none');
    $('#panel-napady').css('display', 'flex');
  } else {
    $('#panel-napady').css('display', 'none');
    if (window.innerWidth > 768) {
      $('#panel-text, #panel-nahravky, #panel-diskuse').css('display', 'flex');
    }
  }
}

// ── Mobil: přepínání panelů ──
function mobilePanel(panel, el) {
  document.getElementById('val-drawer').classList.remove('open');
  document.querySelectorAll('.bnav').forEach(function(b) { b.classList.remove('active'); });
  if (el) el.classList.add('active');
  VZ.aktivniMobPanel = panel;

  document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('mob-active'); });
  document.getElementById('panel-' + panel).classList.add('mob-active');
}

// ── Val drawer ──
function toggleValDrawer() {
  var d = document.getElementById('val-drawer');
  d.classList.toggle('open');
  document.querySelectorAll('.bnav').forEach(function(b) { b.classList.remove('active'); });
  if (d.classList.contains('open')) {
    document.getElementById('bn-skladby').classList.add('active');
  } else {
    var prev = document.getElementById('bn-' + VZ.aktivniMobPanel);
    if (prev) prev.classList.add('active');
  }
}

document.addEventListener('click', function(e) {
  var drawer = document.getElementById('val-drawer');
  var btn    = document.getElementById('bn-skladby');
  if (!drawer || !btn) return;
  if (!drawer.contains(e.target) && !btn.contains(e.target) && drawer.classList.contains('open')) {
    drawer.classList.remove('open');
    document.querySelectorAll('.bnav').forEach(function(b) { b.classList.remove('active'); });
    var prev = document.getElementById('bn-' + VZ.aktivniMobPanel);
    if (prev) prev.classList.add('active');
  }
});

// ── Looper ──
function looperOtevrit(soubor, label) {
  document.getElementById('looper-bar').classList.remove('hidden');
  document.getElementById('lname').textContent = label || soubor;
  document.getElementById('wf-placeholder').textContent = soubor;
  // wavesurfer.load(soubor) — až bude knihovna aktivní
}

function looperZavrit() {
  document.getElementById('looper-bar').classList.add('hidden');
  // wavesurfer.stop(); wavesurfer.empty();
}

function looperPlay()    { /* wavesurfer.play() */ }
function looperPause()   { /* wavesurfer.pause() */ }
function looperRestart() { /* wavesurfer.play(0) */ }
function looperLoop() {
  document.getElementById('btn-loop').classList.toggle('on');
  // wavesurfer addRegion / clearRegions
}

// ── Edit text modal ──
function otevritEditText() {
  $.get('/php/ajax/ajax_text_raw.php', function(data) {
    if (data.obsah !== undefined) {
      var textarea = document.getElementById('editor');
      var input    = document.getElementById('modal_soubor_akordu');
      var label    = document.getElementById('modal_zmenit_text_label');
      if (textarea) textarea.value = data.obsah;
      if (input)    input.value    = data.nazev_souboru || 'akordy.txt';
      if (label)    label.textContent = 'UPRAVIT ' + (data.nazev_souboru || 'akordy.txt') + ' — ' + (data.slozka || '');
    }
    $('#modal_zmenit_text').modal('show');
  }, 'json').fail(function(xhr) {
    console.error('ajax_text_raw chyba:', xhr.status, xhr.responseText);
    $('#modal_zmenit_text').modal('show');
  });
}

// ── Přejmenování / smazání válu ──
function otevritPrejmenovani(val, nazev) {
  document.getElementById('modal_rename_val_label').value      = val;
  document.getElementById('modal_rename_val_label_novy').value = '';
  document.getElementById('modal_delete_val_label').textContent = nazev;
  $('#modal_delete_val').modal('show');
}

function otevritSmazani(val) {
  document.getElementById('modal_delete_val_deleter').value    = val;
  document.getElementById('modal_delete_val_label').textContent = val;
  $('#modal_delete_val').modal('show');
}

// ── Diskuse — komentář ──
$(document).on('submit', '#form_komentar', function(e) {
  e.preventDefault();
  var chyba = document.getElementById('komentar_chyba');
  if (chyba) chyba.style.display = 'none';

  $.post('/php/vlozit_komentar.php', {
    text:   $('#komentar_text').val(),
    odkaz:  $('#komentar_odkaz').val()  || '',
    odkaz2: $('#komentar_odkaz2').val() || '',
    name:   $('#komentar_jmeno').val(),
  }, function(data) {
    if (data.ok) {
      nacistPanel('diskuse');
      $('#komentar_text').val('');
      $('#komentar_jmeno').val('');
    } else {
      if (chyba) { chyba.innerHTML = data.chyba || 'Chyba'; chyba.style.display = 'block'; }
    }
  }, 'json').fail(function() {
    if (chyba) { chyba.innerHTML = 'Chyba spojení'; chyba.style.display = 'block'; }
  });
});

// ── Nahrávky ──
function pauseOthers(aktualni) {
  document.querySelectorAll('audio').forEach(function(a) {
    if (a !== aktualni) { a.pause(); }
  });
  document.querySelectorAll('.toggle-player.otevreno').forEach(function(b) {
    var wrap = document.getElementById(b.dataset.player);
    if (wrap) {
      var audio = wrap.querySelector('audio');
      if (audio && audio !== aktualni) {
        b.textContent = '▶';
        b.classList.remove('otevreno');
        wrap.classList.remove('open');
      }
    }
  });
}

$(document).on('click', '.toggle-player', function() {
  var wrap = document.getElementById($(this).data('player'));
  if (!wrap) return;
  if (wrap.classList.contains('open')) {
    var audio = wrap.querySelector('audio');
    if (audio) { audio.pause(); audio.currentTime = 0; }
    wrap.classList.remove('open');
    this.textContent = '▶';
    this.classList.remove('otevreno');
  } else {
    wrap.classList.add('open');
    this.textContent = '■';
    this.classList.add('otevreno');
  }
});

$(document).on('click', '.looper-btn', function() {
  looperOtevrit($(this).data('cesta'), $(this).data('nazev'));
});

$(document).on('click', '.presunout-btn', function() {
  var val = $(this).data('soubor'), label = $(this).data('nazev');
  var odkud = document.getElementById('modal_presunout_odkud');
  var lbl   = document.getElementById('modal_presunout_label');
  var co    = document.getElementById('modal_presunout_co');
  if (odkud) odkud.value    = val;
  if (lbl)   lbl.innerHTML  = label;
  if (co)    co.value       = label;
});

$(document).on('click', '.smazat-btn', function() {
  var val = $(this).data('soubor'), label = $(this).data('nazev');
  var lbl = document.getElementById('modal_delete_label');
  var del = document.getElementById('modal_delete_deleter');
  if (lbl) lbl.innerHTML = label;
  if (del) del.value     = val;
});

// ── Historie textu ──
function zobrazHistorii() {
  var panel  = document.getElementById('panel-historie');
  var seznam = document.getElementById('seznam-zaloh');
  if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }

  seznam.innerHTML    = '<div style="color:#888;font-size:12px">načítám...</div>';
  panel.style.display = 'block';

  $.get('/php/ajax/ajax_history.php', { akce: 'seznam' }, function(data) {
    if (!data.ok || data.zalohy.length === 0) {
      seznam.innerHTML = '<div style="color:#888;font-size:12px">Žádné zálohy.</div>';
      return;
    }
    var html = '';
    data.zalohy.forEach(function(z) {
      html += '<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid #3a3e44;">';
      html += '<span style="font-size:12px;color:#e0e0e0;flex:1">' + z.datum + '</span>';
      html += '<span style="font-size:10px;color:#888">' + Math.round(z.velikost / 1024 * 10) / 10 + ' kB</span>';
      html += '<button class="btn-zaloha" data-soubor="' + z.soubor + '" style="background:#2a3a10;border:1px solid #a7ac38;color:#a7ac38;border-radius:4px;padding:2px 7px;font-size:11px;cursor:pointer">načíst</button>';
      html += '</div>';
    });
    seznam.innerHTML = html;
  }, 'json').fail(function() {
    seznam.innerHTML = '<div style="color:#888;font-size:12px">Chyba načítání.</div>';
  });
}

function nacistZalohu(soubor) {
  $.get('/php/ajax/ajax_history.php', { akce: 'nacist', soubor: soubor }, function(data) {
    if (data.ok) {
      document.getElementById('editor').value = data.obsah;
      document.getElementById('panel-historie').style.display = 'none';
    }
  }, 'json');
}

$(document).on('click', '.btn-zaloha', function() {
  nacistZalohu($(this).data('soubor'));
});

// ── Nápady ──
function napodyToggle() {
  var fields = document.getElementById('napady-fields');
  var btn    = document.getElementById('napady-toggle-btn');
  if (fields.classList.contains('open')) {
    fields.classList.remove('open');
    btn.textContent = '+ nápad';
  } else {
    fields.classList.add('open');
    btn.textContent = '▲ zavřít';
    document.getElementById('napady_text').focus();
  }
}

$(document).on('submit', '#form_napady', function(e) {
  e.preventDefault();
  var chyba = document.getElementById('napady_chyba');
  chyba.style.display = 'none';

  $.post('/php/vlozit_komentar.php', {
    text:                 $('#napady_text').val(),
    name:                 $('#napady_jmeno').val(),
    odkaz:                '',
    odkaz2:               '',
    pouzit_hlavni_diskusi: '1'
  }, function(data) {
    if (data.ok) {
      nacistPanel('napady');
      $('#napady_text').val('');
      var fields = document.getElementById('napady-fields');
      var btn    = document.getElementById('napady-toggle-btn');
      if (fields && btn && window.innerWidth <= 768) {
        fields.classList.remove('open');
        btn.textContent = '+ nápad';
      }
    } else {
      chyba.innerHTML    = data.chyba || 'Chyba';
      chyba.style.display = 'block';
    }
  }, 'json').fail(function() {
    chyba.innerHTML    = 'Chyba spojení';
    chyba.style.display = 'block';
  });
});
