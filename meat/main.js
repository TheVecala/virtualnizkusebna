/* ── main.js — Virtuální zkušebna ── */

// ── Progress bar ──
var pbTimer = null;
function pbStart() {
  clearTimeout(pbTimer);
  var pb = document.getElementById('progress-bar');
  if (!pb) return;
  pb.className = 'loading';
}
function pbDone() {
  var pb = document.getElementById('progress-bar');
  if (!pb) return;
  pb.className = 'done';
  pbTimer = setTimeout(function() { pb.className = ''; }, 700);
}

// ── Načtení panelů při startu (Nyní včetně tabelatury) ──
$(function() {
  pbStart();
  var pending = 5; // 🌟 Zvýšeno na 5 panelů
  function panelDone() { if (--pending === 0) pbDone(); }
  ['text', 'tabelatura', 'nahravky', 'diskuse', 'napady'].forEach(function(p) {
    nacistPanel(p, panelDone);
  });
});

// ── AJAX načtení panelu ──
function nacistPanel(panel, callback) {
  pbStart();
  $.get('/php/ajax/ajax_' + panel + '.php', function(html) {
    $('#body-' + panel).html(html);
    if (callback) callback(); else pbDone();
  }).fail(function() {
    $('#body-' + panel).html('<div style="color:#888;padding:12px;font-size:12px">Chyba načítání</div>');
    if (callback) callback(); else pbDone();
  });
}

function nacistVsechnyPanely() {
  pbStart();
  var pending = 5;
  function done() { if (--pending === 0) pbDone(); }
  ['text', 'tabelatura', 'nahravky', 'diskuse', 'napady'].forEach(function(p) { nacistPanel(p, done); });
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

// ── Desktop view (Přidána podpora panelu tabelatury) ──
function toggleDesktopPanel(panelId, btn) {
  var $panel = $('#panel-' + panelId);
  var $btn   = $(btn);
  if ($panel.is(':visible')) {
    $panel.hide();
    $btn.removeClass('active');
  } else {
    $panel.css('display', 'flex');
    $btn.addClass('active');
  }
}

// ── Mobil: přepínání panelů ──
function mobilePanel(panel, el) {
  document.getElementById('val-drawer').classList.remove('open');
  document.querySelectorAll('.bnav:not(#bn-skladby)').forEach(function(b) { b.classList.remove('active'); });
  if (el) el.classList.add('active');
  VZ.aktivniMobPanel = panel;

  // Odstranit všechny inline display styly (pozůstatky desktopView)
  document.querySelectorAll('.panel').forEach(function(p) {
    p.style.display = '';
    p.classList.remove('mob-active');
  });

  document.getElementById('panel-' + panel).classList.add('mob-active');
}

// ── Val drawer (otevírá se klikem na #topbar-val nebo #bn-skladby) ──
function toggleValDrawer() {
  document.getElementById('val-drawer').classList.toggle('open');
}

document.addEventListener('click', function(e) {
  var drawer   = document.getElementById('val-drawer');
  var trigger1 = document.getElementById('topbar-val');
  var trigger2 = document.getElementById('bn-skladby');
  if (!drawer) return;
  var naSpoustec = (trigger1 && trigger1.contains(e.target)) ||
                   (trigger2 && trigger2.contains(e.target));
  if (!drawer.contains(e.target) && !naSpoustec && drawer.classList.contains('open')) {
    drawer.classList.remove('open');
  }
});

// ── Tablet: levý a pravý panel, každý se svými 4 tlačítky ──
var TABLET_DEFAULT = { left: 'text', right: 'tabelatura' };

function tabletPick(strana, panelId, btn) {
  var druha = strana === 'left' ? 'right' : 'left';
  VZ.tabPanels = VZ.tabPanels || {};
  var aktualni = Object.assign({}, TABLET_DEFAULT, VZ.tabPanels);

  // Stejný obsah už běží na druhé straně -> prohodit, aby nezmizel
  if (aktualni[druha] === panelId) {
    aktualni[druha] = aktualni[strana];
    var druhyFooter = document.getElementById('tab-footer-' + druha);
    if (druhyFooter) {
      druhyFooter.querySelectorAll('.bnav').forEach(function(b) { b.classList.remove('active'); });
      var noveTl = druhyFooter.querySelector('.bnav[data-panel="' + aktualni[druha] + '"]');
      if (noveTl) noveTl.classList.add('active');
    }
  }
  aktualni[strana] = panelId;
  VZ.tabPanels = aktualni;

  var ca = document.getElementById('content-area');
  ca.removeAttribute('data-napady-open');
  ca.setAttribute('data-left', aktualni.left);
  ca.setAttribute('data-right', aktualni.right);

  var napadyLink = document.getElementById('nav-napady-tab');
  if (napadyLink) napadyLink.classList.remove('active');

  if (btn) {
    var tentoFooter = document.getElementById('tab-footer-' + strana);
    if (tentoFooter) tentoFooter.querySelectorAll('.bnav').forEach(function(b) { b.classList.remove('active'); });
    btn.classList.add('active');
  }
}

function tabletNapady(link) {
  var jeOtevreno = link.classList.contains('active');
  var ca = document.getElementById('content-area');

  if (jeOtevreno) {
    link.classList.remove('active');
    ca.removeAttribute('data-napady-open');
  } else {
    link.classList.add('active');
    ca.setAttribute('data-napady-open', '1');
  }
}

$(function() {
  var ca = document.getElementById('content-area');
  if (ca && !ca.hasAttribute('data-left')) {
    ca.setAttribute('data-left', TABLET_DEFAULT.left);
    ca.setAttribute('data-right', TABLET_DEFAULT.right);
  }
});

// ── Looper ──
function looperOtevrit(soubor, label) {
  document.getElementById('looper-bar').classList.remove('hidden');
  document.getElementById('lname').textContent = label || 'Nahrávka';
  
  // BEZPEČNOSTNÍ ÚPRAVA: Už nevypisujeme celou FTP cestu k souboru na disku
  var placeholder = document.getElementById('wf-placeholder');
  if (placeholder) {
    placeholder.textContent = 'načítám nahrávku...';
  }
}

function looperZavrit() {
  document.getElementById('looper-bar').classList.add('hidden');
}


// ── 🌟 DYNAMICKÝ EDIT TEXT / TABELATURA MODAL ──
function otevritEditText(typ) {
  typ = typ || 'text'; // Fallback pro jistotu, pokud by nebyl zadaný
  VZ.editTyp = typ;    // Zapamatovat pro historii (zobrazHistorii + nacistZalohu)

  // Zažádáme příslušný PHP wrapper o data (předpoklad: máte ajax_text_raw.php a ajax_tabelatura_raw.php)
  $.get('/php/ajax/ajax_' + typ + '_raw.php', function(data) {
    if (data.obsah !== undefined) {
      var textarea = document.getElementById('editor');
      var input    = document.getElementById('modal_soubor_akordu');
      var label    = document.getElementById('modal_zmenit_text_label');
      // Propojíme akci formuláře podle typu souboru, abychom zapsali do správného cíle
      var form     = document.querySelector('#modal_zmenit_text form');

      if (textarea) textarea.value = data.obsah;
      
      // Dosadí se specifický název souboru
      var vychoziNazev = (typ === 'tabelatura') ? 'tabelatura.txt' : 'akordy.txt';
      if (input) input.value = data.nazev_souboru || vychoziNazev;
      
      if (label) label.textContent = 'UPRAVIT ' + (data.nazev_souboru || vychoziNazev) + ' — ' + (data.slozka || '');
      
      // DYNAMICKÁ ZMĚNA CÍLE FORMULÁŘE (Action)
      if (form) {
        form.action = (typ === 'tabelatura') ? '/php/vlozit_tabelaturu.php' : '/php/vlozit_akordy.php';
      }
    }
    // Reset panelu historie — nesmí přetékat z předchozího otevření
    document.getElementById('panel-historie').style.display = 'none';
    document.getElementById('seznam-zaloh').innerHTML = '';
    $('#modal_zmenit_text').modal('show');
  }, 'json').fail(function(xhr) {
    console.error('ajax_' + typ + '_raw chyba:', xhr.status, xhr.responseText);
    
    // Pokud selhalo (např. soubor ještě neexistuje), otevřeme s prázdným textem ale připravené
    var label = document.getElementById('modal_zmenit_text_label');
    var form  = document.querySelector('#modal_zmenit_text form');
    var vychoziNazev = (typ === 'tabelatura') ? 'tabelatura.txt' : 'akordy.txt';
    
    if (label) label.textContent = 'VYTVOŘIT ' + vychoziNazev;
    if (form) form.action = (typ === 'tabelatura') ? '/php/vlozit_tabelaturu.php' : '/php/vlozit_akordy.php';
    
    // Reset panelu historie — nesmí přetékat z předchozího otevření
    document.getElementById('panel-historie').style.display = 'none';
    document.getElementById('seznam-zaloh').innerHTML = '';
    $('#modal_zmenit_text').modal('show');
  });
}

// ── Uložení textu/tabelatury přes AJAX (bez page reload = žádný back button dialog) ──
$(document).on('submit', '#modal_zmenit_text form', function(e) {
  e.preventDefault();
  var $form      = $(this);
  var url        = $form.attr('action');
  var $btn       = $form.find('[type="submit"]');
  var puvodniTxt = $btn.text();

  $btn.prop('disabled', true).text('ukládám...');
  pbStart();

  $.post(url, $form.serialize(), function(resp) {
    pbDone();
    $btn.prop('disabled', false).text(puvodniTxt);
    if (resp.ok) {
      $('#modal_zmenit_text').modal('hide');
      nacistPanel(VZ.editTyp || 'text');
    } else {
      var $info = $form.find('.editor-chyba');
      if (!$info.length) {
        $info = $('<div class="editor-chyba" style="color:#ff8888;font-size:12px;margin-top:6px;text-align:left"></div>');
        $form.find('.modal-footer p').after($info);
      }
      $info.text(resp.vysledek || 'Chyba uložení');
    }
  }, 'json').fail(function() {
    pbDone();
    $btn.prop('disabled', false).text(puvodniTxt);
    var $info = $form.find('.editor-chyba');
    if (!$info.length) {
      $info = $('<div class="editor-chyba" style="color:#ff8888;font-size:12px;margin-top:6px;text-align:left"></div>');
      $form.find('.modal-footer p').after($info);
    }
    $info.text('Chyba spojení se serverem');
  });
});



// ── Přejmenování / smazání válu ──
function otevritPrejmenovani(val, nazev) {
  document.getElementById('modal_rename_val_label').value       = val;
  document.getElementById('modal_rename_val_label_novy').value  = '';
  document.getElementById('modal_rename_val_title').textContent = 'PŘEJMENOVAT SKLADBU';
  document.getElementById('modal_rename_val_ctx').textContent   = nazev;
  $('#modal_rename_val').modal('show');
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
  pbStart();

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
      pbDone();
    } else {
      if (chyba) { chyba.innerHTML = data.chyba || 'Chyba'; chyba.style.display = 'block'; }
      pbDone();
    }
  }, 'json').fail(function() {
    if (chyba) { chyba.innerHTML = 'Chyba spojení'; chyba.style.display = 'block'; }
    pbDone();
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
  var val   = $(this).data('soubor');
  var label = $(this).data('nazev');

  $('#modal_presunout_odkud').val(val);
  $('#modal_presunout_label').text(label);
  $('#modal_presunout_co').val(label);
  $('#modal_presunout_from_label').text(VZ.aktualniNazev || val);

  // Reset potvrzovacího panelu pro případ znovuotevření
  $('#presunout_confirm_panel').hide();
  $('#modal_presunout_kam').val('');
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

  $.get('/php/ajax/ajax_history.php', { akce: 'seznam', typ: VZ.editTyp || 'akordy' }, function(data) {
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
  $.get('/php/ajax/ajax_history.php', { akce: 'nacist', soubor: soubor, typ: VZ.editTyp || 'akordy' }, function(data) {
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
  pbStart();

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
      pbDone();
    } else {
      chyba.innerHTML    = data.chyba || 'Chyba';
      chyba.style.display = 'block';
      pbDone();
    }
  }, 'json').fail(function() {
    chyba.innerHTML    = 'Chyba spojení';
    chyba.style.display = 'block';
    pbDone();
  });
});

// ── Resize / otočení — reset layoutu ──
window.addEventListener('resize', function() {
  var isMobile = window.innerWidth <= 768;

  if (isMobile) {
    // Odstranit inline display styly z desktopView
    document.querySelectorAll('.panel').forEach(function(p) { p.style.display = ''; });
    // Aktivovat správný panel
    document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('mob-active'); });
    var el = document.getElementById('panel-' + (VZ.aktivniMobPanel || 'text'));
    if (el) el.classList.add('mob-active');
  } else {
    // Odstranit mob-active, nastavit desktop layout včetně panelu tabelatura
    document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('mob-active'); p.style.display = ''; });
    var napadyAktivni = document.getElementById('nav-napady') &&
                        document.getElementById('nav-napady').classList.contains('active');
    if (napadyAktivni) {
      $('#panel-text, #panel-tabelatura, #panel-nahravky, #panel-diskuse').css('display', 'none');
      $('#panel-napady').css('display', 'flex');
    } else {
      $('#panel-napady').css('display', 'none');
      $('#panel-text, #panel-tabelatura, #panel-nahravky, #panel-diskuse').css('display', 'flex');
    }
  }
});

 // ── Modal přesunout — dynamické naplnění seznamu tlačítek ──
$(document).on('show.bs.modal', '#modal_presunout', function() {
  var kontejner = document.getElementById('seznam_slozek_pro_presun');
  if (!kontejner) return;
  
  kontejner.innerHTML = '<div style="color:var(--muted); font-size:12px; padding:10px;">načítám...</div>';

  $.get('/php/ajax/ajax_slozky.php', function(data) {
    kontejner.innerHTML = '';
    
    data.forEach(function(s) {
      // Skryje složku, ve které právě jsme
      if (s.aktivni) return;

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'list-group-item list-group-item-action presun-slozka-btn';
      btn.dataset.slozka = s.slozka;
      
      btn.style.cssText = 'background: #1e2226; color: #e0e0e0; border: 1px solid #3a3e44; margin-bottom: 5px; border-radius: 5px; padding: 10px 12px; font-size: 13px; cursor: pointer; text-align: left; display: flex; align-items: center; gap: 10px; transition: 0.2s;';

      btn.onmouseover = function() { this.style.borderColor = 'var(--barva)'; this.style.color = 'var(--barva)'; };
      btn.onmouseout  = function() { this.style.borderColor = '#3a3e44'; this.style.color = '#e0e0e0'; };

      btn.innerHTML = '<span style="font-size:16px;">📁</span> ' + s.nazev;
      kontejner.appendChild(btn);
    });
    
    if (kontejner.innerHTML === '') {
      kontejner.innerHTML = '<div style="color:var(--muted); font-size:12px; padding:10px; text-align:center;">Nemáte vytvořené žádné další skladby.</div>';
    }
  }, 'json').fail(function() {
    kontejner.innerHTML = '<div style="color:#ff8888; font-size:12px; padding:10px;">Chyba načítání skladeb.</div>';
  });
});

// ── Přesunout: potvrzovací panel ──
function presunoutVybratSlozku(nazevSlozky) {
  var soubor = $('#modal_presunout_co').val();
  $('#presunout_confirm_soubor').text(soubor);
  $('#presunout_confirm_cil').text(nazevSlozky);
  $('#modal_presunout_kam').val(nazevSlozky);
  $('#presunout_confirm_panel').slideDown(160);
  // Scrollnout na potvrzovací panel
  var $body = $('#modal_presunout').find('.modal-body');
  $body.animate({ scrollTop: $body[0].scrollHeight }, 200);
}

$(document).on('click', '.presun-slozka-btn', function() {
  presunoutVybratSlozku($(this).data('slozka'));
});

$(document).on('click', '#presunout_confirm_zrusit', function() {
  $('#presunout_confirm_panel').slideUp(150);
  $('#modal_presunout_kam').val('');
});

$(document).on('hidden.bs.modal', '#modal_presunout', function() {
  $('#presunout_confirm_panel').hide();
  $('#modal_presunout_kam').val('');
});

// ── Upload souboru s progress barem ──
$(document).on('submit', '#form_upload', function(e) {
  e.preventDefault();

  var fileInput = document.getElementById('upload_file');
  if (!fileInput.files.length) {
    var res = document.getElementById('upload-result');
    res.style.display = 'block';
    res.style.color = '#ff8888';
    res.textContent = 'Vyberte soubor.';
    return;
  }

  var formData = new FormData();
  formData.append('fileToUpload', fileInput.files[0]);
  formData.append('odeslat', document.getElementById('upload_odeslat').checked ? 'true' : '');
  formData.append('navrat', window.location.pathname);

  var wrap = document.getElementById('upload-progress-wrap');
  var bar  = document.getElementById('upload-progress-bar');
  var txt  = document.getElementById('upload-progress-text');
  var res  = document.getElementById('upload-result');
  var btn  = document.getElementById('upload-btn');

  wrap.style.display = 'block';
  res.style.display  = 'none';
  btn.disabled = true;
  btn.textContent = 'nahrávám...';

  var xhr = new XMLHttpRequest();

  xhr.upload.onprogress = function(e) {
    if (e.lengthComputable) {
      var pct = Math.round(e.loaded / e.total * 100);
      bar.style.width  = pct + '%';
      txt.textContent  = pct + '%';
    }
  };

  xhr.onload = function() {
    btn.disabled = false;
    btn.textContent = 'VLOŽIT SOUBOR';
    bar.style.width = '100%';
    txt.textContent = '100%';

    res.style.display = 'block';
    if (xhr.status === 200) {
      res.style.color = '#a7ac38';
      res.textContent = 'Soubor nahrán.';
      // Reset formuláře
      fileInput.value = '';
      bar.style.width = '0%';
      txt.textContent = '0%';
      setTimeout(function() { wrap.style.display = 'none'; }, 1500);
      // Přenačíst panel nahrávek
      nacistPanel('nahravky');
      // Zavřít modal po 1.5s
      setTimeout(function() {
        $('#modal_vlozit_soubor').modal('hide');
        res.style.display = 'none';
      }, 1500);
    } else {
      res.style.color = '#ff8888';
      res.textContent = 'Chyba nahrávání (status ' + xhr.status + ').';
    }
  };

  xhr.onerror = function() {
    btn.disabled = false;
    btn.textContent = 'VLOŽIT SOUBOR';
    res.style.display = 'block';
    res.style.color = '#ff8888';
    res.textContent = 'Chyba spojení.';
  };

  xhr.open('POST', '/php/upload_uni.php');
  xhr.send(formData);
});

// Reset progress baru při zavření modalu
$(document).on('hidden.bs.modal', '#modal_vlozit_soubor', function() {
  document.getElementById('upload-progress-bar').style.width = '0%';
  document.getElementById('upload-progress-text').textContent = '0%';
  document.getElementById('upload-progress-wrap').style.display = 'none';
  document.getElementById('upload-result').style.display = 'none';
  var btn = document.getElementById('upload-btn');
  if (btn) { btn.disabled = false; btn.textContent = 'VLOŽIT SOUBOR'; }
});


// ── Editace a mazání komentářů (diskuse + nápady) ──

// Otevřít inline edit
$(document).on('click', '.vzk-btn-edit', function() {
  var $card = $(this).closest('[data-cas]');

  // Zrušit případný probíhající delete confirm
  $card.find('.vzk-confirm-wrap').remove();
  // Zavřít případný otevřený edit jiného komentáře
  $card.find('.vzk-edit-wrap').remove();

  // Schovat text a tlačítka akcí
  $card.find('.dk-text, .ctext').hide();
  $card.find('.vzk-actions').css('display', 'none');

  // Vytvořit inline edit UI
  var $ta = $('<textarea class="vzk-edit-ta" rows="3"></textarea>').val($card.attr('data-text'));
  var $btns = $(
    '<div class="vzk-edit-btns">' +
      '<button class="vzk-save-btn">✓ uložit</button>' +
      '<button class="vzk-cancel-btn">✗ zrušit</button>' +
      '<span class="vzk-edit-chyba"></span>' +
    '</div>'
  );
  var $wrap = $('<div class="vzk-edit-wrap"></div>').append($ta).append($btns);

  // Vložit těsně před .dk-meta / .cmeta
  $card.find('.dk-meta, .cmeta').before($wrap);
  $ta.focus();
});

// Zrušit editaci
$(document).on('click', '.vzk-cancel-btn', function() {
  var $card = $(this).closest('[data-cas]');
  $card.find('.vzk-edit-wrap').remove();
  $card.find('.dk-text, .ctext').show();
  $card.find('.vzk-actions').css('display', 'flex');
});

// Uložit editaci
$(document).on('click', '.vzk-save-btn', function() {
  var $btn  = $(this);
  var $card = $btn.closest('[data-cas]');
  var text  = $card.find('.vzk-edit-ta').val().trim();
  if (!text) return;

  $btn.prop('disabled', true).text('ukládám...');
  $card.find('.vzk-edit-chyba').hide();
  pbStart();

  $.post('/php/ajax/upravit_komentar.php', {
    cas:  $card.data('cas'),
    typ:  $card.data('typ'),
    text: text
  }, function(data) {
    pbDone();
    if (data.ok) {
      $card.attr('data-text', text);
      $card.find('.dk-text, .ctext').html(data.vzkaz_html).show();
      $card.find('.vzk-actions').css('display', 'flex');
      $card.find('.vzk-edit-wrap').remove();
    } else {
      $card.find('.vzk-edit-chyba').text(data.chyba || 'Chyba').show();
      $btn.prop('disabled', false).text('✓ uložit');
    }
  }, 'json').fail(function() {
    pbDone();
    $card.find('.vzk-edit-chyba').text('Chyba spojení').show();
    $btn.prop('disabled', false).text('✓ uložit');
  });
});

// Otevřít / zavřít delete confirm
$(document).on('click', '.vzk-btn-del', function() {
  var $card = $(this).closest('[data-cas]');

  // Zrušit případný probíhající edit
  if ($card.find('.vzk-edit-wrap').length) {
    $card.find('.vzk-edit-wrap').remove();
    $card.find('.dk-text, .ctext').show();
    $card.find('.vzk-actions').css('display', 'flex');
  }

  // Toggle: druhý klik zavře confirm
  if ($card.find('.vzk-confirm-wrap').length) {
    $card.find('.vzk-confirm-wrap').remove();
    return;
  }

  $card.append(
    '<div class="vzk-confirm-wrap">' +
      'Smazat tento komentář?&nbsp;' +
      '<button class="vzk-del-yes-btn">ano, smazat</button>' +
      '<button class="vzk-del-no-btn">ne</button>' +
    '</div>'
  );
});

// Zrušit mazání
$(document).on('click', '.vzk-del-no-btn', function() {
  $(this).closest('.vzk-confirm-wrap').remove();
});

// Potvrdit mazání
$(document).on('click', '.vzk-del-yes-btn', function() {
  var $btn  = $(this);
  var $card = $btn.closest('[data-cas]');

  $btn.prop('disabled', true).text('mažu...');
  $card.find('.vzk-del-no-btn').prop('disabled', true);
  pbStart();

  $.post('/php/ajax/smazat_komentar.php', {
    cas: $card.data('cas'),
    typ: $card.data('typ')
  }, function(data) {
    pbDone();
    if (data.ok) {
      $card.fadeOut(250, function() { $(this).remove(); });
    } else {
      $card.find('.vzk-confirm-wrap').html(
        '<span style="color:#ff8888">' + (data.chyba || 'Chyba') + '</span>'
      );
    }
  }, 'json').fail(function() {
    pbDone();
    $card.find('.vzk-confirm-wrap').html('<span style="color:#ff8888">Chyba spojení</span>');
  });
});

//  -------------------

$(document).on('click', '.poznamky-btn', function() {

    let panel = $(this)
        .closest('.nahravka-vysuvna')
        .find('.poznamky-panel');

    panel.toggle();

    if(panel.is(':visible'))
    {
        loadRecordingNotes(panel);
    }
});

function loadRecordingNotes(panel)
{
    $.post(
        'php/ajax/ajax_nahravka_poznamky.php',
        {
            akce: 'list',
            file_path: panel.data('cesta')
        },
        function(html)
        {
            panel.find('.poznamky-seznam').html(html);
        }
    );
}

$(document).on('click', '.pridat-poznamku-btn', function() {

    let panel = $(this).closest('.poznamky-panel');

    let audio = $(this)
        .closest('.nahravka-vysuvna')
        .find('audio')[0];

let cas = 0;

if (
    typeof wavesurfer !== 'undefined' &&
    wavesurfer &&
    typeof looperCurrentFile !== 'undefined' &&
    looperCurrentFile === panel.data('cesta')
)
{
    cas = Math.round(
        wavesurfer.getCurrentTime() * 1000
    );
}
else if (audio)
{
    cas = Math.round(
        audio.currentTime * 1000
    );
}

    let text = prompt('Poznámka');

    if(!text)
    {
        return;
    }

    $.post(
        'php/ajax/ajax_nahravka_poznamky.php',
        {
            akce: 'add',
            file_path: panel.data('cesta'),
            cas: cas,
            poznamka: text
        },
        function()
        {
            loadRecordingNotes(panel);
        }
    );
});

$(document).on('click', '.note-row', function() {
    var ms   = parseInt($(this).data('ms'));
    var file = $(this).data('file');

    if ($(this).data('looper')) {
        if (!wavesurfer) return;
        wavesurfer.setTime(ms / 1000);
    } else {
        jumpToTimestamp(ms, file);
    }
});