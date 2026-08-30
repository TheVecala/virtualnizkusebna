/* ── main.js — Virtuální zkušebna ── */
const NOTE_SONG   = 0;
const NOTE_NORMAL = 1;
let noteAction = "";
let noteId = 0;
let noteFile = "";
let noteTime = 0;
let noteType = NOTE_NORMAL;
let notePlaybackContext = "";
let noteAudio = null;

function formatTime(ms)
{
    let sec = Math.floor(ms / 1000);

    let min = Math.floor(sec / 60);

    sec = sec % 60;

    return String(min).padStart(2, "0") +
           ":" +
           String(sec).padStart(2, "0");
}

function getNotePlaybackTime()
{
    if (notePlaybackContext === "looper")
    {
        return wavesurfer ? Math.round(wavesurfer.getCurrentTime() * 1000) : null;
    }

    return noteAudio ? Math.round(noteAudio.currentTime * 1000) : null;
}

function setNotePlaybackTime(ms)
{
    let sec = Math.max(0, ms) / 1000;

    if (notePlaybackContext === "looper")
    {
        if (wavesurfer) wavesurfer.setTime(sec);
        return;
    }

    if (noteAudio) noteAudio.currentTime = sec;
}

function zobrazPripravenyCas()
{
    $("#modal_poznamka_info").html(
        "Čas: <strong>" + formatTime(noteTime) + "</strong>"
    );
}
// ── Progress bar ──
var pbTimer = null;
function pbStart() {
  clearTimeout(pbTimer);
  var pb = document.getElementById('progress-bar');
  if (!pb) return;
  // Pokud je otevřený modal, má vlastní zpětnou vazbu (modalSuccess/alert) a horní
  // progress bar by přes něj jen vizuálně přejížděl (vyšší z-index) — v tom případě
  // ho vynecháme.
  if (document.querySelector('.modal.show')) return;
  pb.className = 'loading';
}
function pbDone() {
  var pb = document.getElementById('progress-bar');
  if (!pb) return;
  pb.className = 'done';
  pbTimer = setTimeout(function() { pb.className = ''; }, 700);
}

// ── Success overlay v modalu ──
function modalSuccess(modalId, zprava) {
  var $modal   = $('#' + modalId);
  var $content = $modal.find('.modal-content');
  var $overlay = $(
    '<div class="modal-success-overlay">' +
      '<div class="modal-success-icon">✓</div>' +
      '<div class="modal-success-text">' + (zprava || 'Hotovo') + '</div>' +
    '</div>'
  );
  $content.append($overlay);
  setTimeout(function() {
    // .one() musí být registrován PŘED modal('hide'), jinak může event proletět dřív
    $modal.one('hidden.bs.modal', function() { $overlay.remove(); });
    $modal.modal('hide');
  }, 1000);
}

// ── Načtení panelů při startu (Nyní včetně tabelatury) ──
$(function() {
  pbStart();
  var pending = 5; // 🌟 Zvýšeno na 5 panelů
  function panelDone() { if (--pending === 0) pbDone(); }
  ['nahravky', 'text', 'tabelatura', 'diskuse', 'napady'].forEach(function(p) {
    nacistPanel(p, panelDone);
  });
});

// ── AJAX načtení panelu ──
function nacistPanel(panel, callback) {
  pbStart();
  $.get('/php/ajax/ajax_' + panel + '.php', function(html) {
    if (panel === 'nahravky') releaseNativeAudioObjectUrls();
    $('#body-' + panel).html(html);
    if (panel === 'nahravky') {
      refreshNativeAudioCacheControls();
      processDeepLink();
    }
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
  ['nahravky', 'text', 'tabelatura', 'diskuse', 'napady'].forEach(function(p) { nacistPanel(p, done); });
}

// ── Znovu vykreslit seznam válů (sidebar + drawer) z dat ajax_slozky.php ──
// Nahrazuje potřebu reloadu stránky po vytvoření/přejmenování/smazání válu.
function renderSeznamValu(data) {
  var sidebar = document.getElementById('sidebar-playlist');
  var drawer  = document.getElementById('val-drawer');

  function vytvoritAkce(s) {
    var actions = document.createElement('div');
    actions.className = 'val-actions';

    var btnRename = document.createElement('button');
    btnRename.title = 'přejmenovat';
    btnRename.textContent = '✏';
    btnRename.className = VZ.pravo.rename_val ? '' : 'btn-locked';
    btnRename.onclick = function(e) { e.stopPropagation(); otevritPrejmenovani(s.slozka, s.nazev); };
    actions.appendChild(btnRename);

    var btnDelete = document.createElement('button');
    btnDelete.title = 'smazat';
    btnDelete.textContent = '🗑';
    btnDelete.className = VZ.pravo.delete_val ? '' : 'btn-locked';
    btnDelete.onclick = function(e) { e.stopPropagation(); otevritSmazani(s.slozka); };
    actions.appendChild(btnDelete);

    return actions;
  }

  function radek(s, trida, jeProSidebar) {
    var div = document.createElement('div');
    div.className = trida + (s.aktivni ? ' active' : '');
    div.dataset.id  = s.slozka;
    if (jeProSidebar) div.dataset.val = s.slozka;
    // switchVal dostává element jen u sidebaru (potřebuje ho pro .active třídu),
    // u drawer verze se aktivní stav řeší jinak (viz switchVal)
    div.onclick = function() { switchVal(s.slozka, s.nazev, jeProSidebar ? div : null); };

    var img = document.createElement('img');
    img.src = 'meat/ikona_kombo.png';
    img.alt = '';
    img.style.cssText = 'width:20px;height:20px;object-fit:contain;flex-shrink:0;';
    div.appendChild(img);

    var span = document.createElement('span');
    span.className = 'val-nazev';
    span.textContent = s.nazev;
    div.appendChild(span);

    div.appendChild(vytvoritAkce(s));
    return div;
  }

  if (sidebar) {
    sidebar.innerHTML = '';
    data.forEach(function(s) { sidebar.appendChild(radek(s, 'val-item', true)); });
  }

  if (drawer) {
    // Zachovat drawer-header, smazat jen staré položky .dval
    drawer.querySelectorAll('.dval').forEach(function(el) { el.remove(); });
    data.forEach(function(s) { drawer.appendChild(radek(s, 'dval', false)); });
  }
}

function nastavitTopbarNazev(nazev) {
  var topbarVal    = document.getElementById('topbar-val');
  var diskuseLabel = document.getElementById('diskuse-val-label');
  if (topbarVal)    topbarVal.textContent    = nazev;
  if (diskuseLabel) diskuseLabel.textContent = nazev;
}

// Načte aktuální seznam válů ze serveru, přenačte sidebar+drawer a synchronizuje VZ stav.
// Sama pozná, jestli se "aktivní" vál oproti předchozímu stavu změnil (přejmenování aktivního
// válu, nebo zmizení aktivního válu po smazání) a podle toho přenačte i panely — volající to
// tedy nemusí řešit ručně.
function obnovitSeznamValu(callback) {
  var predchoziVal = VZ.aktualniVal;

  $.get('/php/ajax/ajax_slozky.php', function(data) {
    renderSeznamValu(data);

    var aktivni = data.find(function(s) { return s.aktivni; });

    if (aktivni) {
      // Server zná aktivní vál a ten v datech skutečně existuje
      var zmenilSe = (aktivni.slozka !== predchoziVal);
      VZ.aktualniVal   = aktivni.slozka;
      VZ.aktualniNazev = aktivni.nazev;
      nastavitTopbarNazev(aktivni.nazev);
      if (zmenilSe) {
        nacistVsechnyPanely();
        looperZavrit();
      }
      if (typeof callback === 'function') callback();

    } else if (data.length > 0) {
      // Vál, na který ukazuje SESSION, už neexistuje (typicky: právě jsme smazali aktivní vál)
      // → přepnout na první dostupný, stejně jako běžný klik na položku v seznamu
      var prvni = data[0];
      var sidebarEl = null;
      document.querySelectorAll('#sidebar-playlist .val-item').forEach(function(v) {
        if (v.dataset.val === prvni.slozka) sidebarEl = v;
      });
      document.querySelectorAll('#val-drawer .dval').forEach(function(v) {
        v.classList.toggle('active', v.dataset.id === prvni.slozka);
      });
      switchVal(prvni.slozka, prvni.nazev, sidebarEl);
      if (typeof callback === 'function') callback();

    } else {
      // Nezbyl žádný vál
      VZ.aktualniVal   = '';
      VZ.aktualniNazev = '';
      nastavitTopbarNazev('—');
      nacistVsechnyPanely();
      looperZavrit();
      if (typeof callback === 'function') callback();
    }
  }, 'json').fail(function() {
    if (typeof callback === 'function') callback();
  });
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

  $.post('/php/ajax/zmenit_slozku_ajax.php', { cilova_slozka: val }, function() {
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
var TABLET_DEFAULT = { left: 'nahravky', right: 'text' };

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
  // document.getElementById('lname').textContent = label || 'Nahrávka';
  
  // BEZPEČNOSTNÍ ÚPRAVA: Už nevypisujeme celou FTP cestu k souboru na disku
  var placeholder = document.getElementById('wf-placeholder');
  
  if (placeholder) { placeholder.textContent = 'načítám main...';}
}


// ── 🌟 DYNAMICKÝ EDIT TEXT / TABELATURA MODAL ──
function otevritEditText(typ) {
  typ = typ || 'text';
  VZ.editTyp = typ;

  pbStart();
  $.get('/php/ajax/ajax_' + typ + '_raw.php', function(data) {
    pbDone();
    if (data.obsah !== undefined) {
      var textarea = document.getElementById('editor');
      var input    = document.getElementById('modal_soubor_akordu');
      var label    = document.getElementById('modal_zmenit_text_label');
      var form     = document.querySelector('#modal_zmenit_text form');

      if (textarea) {
        textarea.value = data.obsah;
        // Bug 1 fix: číst zpět z textarey — browser normalizuje \r\n → \n,
        // takže porovnání při dirty-check bude konzistentní
        VZ.editorPuvodniObsah = textarea.value;
      }

      var vychoziNazev = (typ === 'tabelatura') ? 'tabelatura.txt' : 'akordy.txt';
      var nazev = data.nazev_souboru || vychoziNazev;
      if (input) input.value = nazev;

      if (label) label.textContent = 'UPRAVIT ' + nazev + ' — ' + (data.slozka || '');

      var ctxAction = document.getElementById('modal_editor_ctx_action');
      var ctxSoubor = document.getElementById('modal_editor_ctx_soubor');
      var ctxSlozka = document.getElementById('modal_editor_ctx_slozka');
      if (ctxAction) ctxAction.textContent = (typ === 'tabelatura') ? 'Editace tabelatury' : 'Editace textu / akordů';
      if (ctxSoubor) ctxSoubor.textContent = nazev;
      if (ctxSlozka) ctxSlozka.textContent = data.slozka || VZ.aktualniNazev || '';

      if (form) {
        form.action = (typ === 'tabelatura') ? '/php/actions/vlozit_tabelaturu.php' : '/php/actions/vlozit_akordy.php';
      }
    }
    document.getElementById('panel-historie').style.display = 'none';
    document.getElementById('seznam-zaloh').innerHTML = '';
    // Bug 2 fix: smazat overlay z případného předchozího uložení (pojistka)
    $('#modal_zmenit_text .modal-success-overlay').remove();
    $('#modal_zmenit_text').modal('show');
  }, 'json').fail(function(xhr) {
    pbDone();
    console.error('ajax_' + typ + '_raw chyba:', xhr.status, xhr.responseText);

    var label = document.getElementById('modal_zmenit_text_label');
    var form  = document.querySelector('#modal_zmenit_text form');
    var vychoziNazev = (typ === 'tabelatura') ? 'tabelatura.txt' : 'akordy.txt';

    if (label) label.textContent = 'VYTVOŘIT ' + vychoziNazev;
    if (form) form.action = (typ === 'tabelatura') ? '/php/actions/vlozit_tabelaturu.php' : '/php/actions/vlozit_akordy.php';

    var ctxAction = document.getElementById('modal_editor_ctx_action');
    var ctxSoubor = document.getElementById('modal_editor_ctx_soubor');
    var ctxSlozka = document.getElementById('modal_editor_ctx_slozka');
    if (ctxAction) ctxAction.textContent = (typ === 'tabelatura') ? 'Nová tabelatura' : 'Nový text / akordy';
    if (ctxSoubor) ctxSoubor.textContent = vychoziNazev;
    if (ctxSlozka) ctxSlozka.textContent = VZ.aktualniNazev || '';

    VZ.editorPuvodniObsah = '';

    document.getElementById('panel-historie').style.display = 'none';
    document.getElementById('seznam-zaloh').innerHTML = '';
    $('#modal_zmenit_text .modal-success-overlay').remove();
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
      // Vyčistit dirty flag — obsah je teď uložen
      VZ.editorPuvodniObsah = document.getElementById('editor').value;
      nacistPanel(VZ.editTyp || 'text');
      modalSuccess('modal_zmenit_text', 'Text uložen');
    } else {
      var $info = $form.find('.editor-chyba');
      if (!$info.length) {
        $info = $('<div class="editor-chyba" style="color:#ff8888;font-size:12px;margin-top:6px;text-align:left"></div>');
        $form.find('.modal-footer').prepend($info);
      }
      $info.text(resp.vysledek || 'Chyba uložení');
    }
  }, 'json').fail(function() {
    pbDone();
    $btn.prop('disabled', false).text(puvodniTxt);
    var $info = $form.find('.editor-chyba');
    if (!$info.length) {
      $info = $('<div class="editor-chyba" style="color:#ff8888;font-size:12px;margin-top:6px;text-align:left"></div>');
      $form.find('.modal-footer').prepend($info);
    }
    $info.text('Chyba spojení se serverem');
  });
});

// ── Dirty-state warning v editoru ──
$(document).on('hide.bs.modal', '#modal_zmenit_text', function(e) {
  var ta = document.getElementById('editor');
  if (!ta || VZ.editorPuvodniObsah === undefined) return;
  if (ta.value !== VZ.editorPuvodniObsah) {
    if (!confirm('Máš neuložené změny. Opravdu chceš zavřít editor?')) {
      e.preventDefault();
    }
  }
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

  $.post('/php/ajax/vlozit_komentar.php', {
    text:   $('#komentar_text').val(),
    odkaz:  $('#komentar_odkaz').val()  || '',
    odkaz2: $('#komentar_odkaz2').val() || '',
    name:   $('#komentar_jmeno').val(),
  }, function(data) {
    pbDone();
    if (data.ok) {
      nacistPanel('diskuse');
      $('#komentar_text, #komentar_odkaz, #komentar_odkaz2').val('');
      modalSuccess('modal_vlozit_komentar', 'Komentář přidán');
    } else {
      if (chyba) { chyba.innerHTML = data.chyba || 'Chyba'; chyba.style.display = 'block'; }
    }
  }, 'json').fail(function() {
    pbDone();
    if (chyba) { chyba.innerHTML = 'Chyba spojení'; chyba.style.display = 'block'; }
  });
});

// ── Nahrávky ──

// ── Popisek nahrávky (inline editace, stejný vzor jako editace komentářů) ──
$(document).on('click', '.popisek-edit-btn', function(e) {
  e.stopPropagation();
  var $wrap = $(this).closest('.nahravka-popisek');

  // Zavřít případnou jinou rozeditovanou popisku
  $('.popisek-edit-wrap').remove();
  $('.nahravka-popisek').show();

  var puvodniText = $wrap.find('.popisek-text').text().trim();
  if (puvodniText === 'bez popisku') puvodniText = '';

  $wrap.hide();

  var $input = $('<input type="text" class="popisek-edit-input" maxlength="255" placeholder="popisek nahrávky...">').val(puvodniText);
  var $editRow = $('<div class="popisek-edit-wrap"></div>').append($input).append(
    $('<button class="popisek-save-btn">✓</button>'),
    $('<button class="popisek-cancel-btn">✗</button>')
  );

  $wrap.after($editRow);
  $input.focus();
});

$(document).on('click', '.popisek-cancel-btn', function(e) {
  e.stopPropagation();
  var $editRow = $(this).closest('.popisek-edit-wrap');
  $editRow.prev('.nahravka-popisek').show();
  $editRow.remove();
});

$(document).on('click', '.popisek-save-btn', function(e) {
  e.stopPropagation();
  var $btn     = $(this);
  var $editRow = $btn.closest('.popisek-edit-wrap');
  var $wrap    = $editRow.prev('.nahravka-popisek');
  var cesta    = $wrap.data('cesta');
  var text     = $editRow.find('.popisek-edit-input').val().trim();

  $btn.prop('disabled', true);
  pbStart();

  $.post('/php/ajax/ajax_nahravka_poznamky.php', {
    akce: 'popisek_set',
    file_path: cesta,
    popisek: text
  }, function(resp) {
    pbDone();
    if (resp === 'OK') {
      var $text = $wrap.find('.popisek-text');
      if (text === '') {
        $text.text('bez popisku').addClass('popisek-prazdny');
      } else {
        $text.text(text).removeClass('popisek-prazdny');
      }
      $wrap.show();
      $editRow.remove();
    } else {
      alert(resp || 'Chyba při ukládání popisku');
      $btn.prop('disabled', false);
    }
  }).fail(function() {
    pbDone();
    alert('Chyba spojení se serverem');
    $btn.prop('disabled', false);
  });
});

$(document).on('keydown', '.popisek-edit-input', function(e) {
  if (e.key === 'Enter') { e.preventDefault(); $(this).closest('.popisek-edit-wrap').find('.popisek-save-btn').click(); }
  if (e.key === 'Escape') { $(this).closest('.popisek-edit-wrap').find('.popisek-cancel-btn').click(); }
});

// ── Smazat soubor (AJAX, bez reloadu stránky — panel Nahrávky zůstává otevřený) ──
$(document).on('submit', '#form_smazat_soubor', function(e) {
  e.preventDefault();
  pbStart();
  var $form = $(this);

  $.post('/php/actions/smazat_soubor.php', $form.serialize(), function(data) {
    pbDone();
    if (data.ok) {
      nacistPanel('nahravky');
      modalSuccess('modal_delete', data.vysledek || 'Smazáno');
    } else {
      alert(data.vysledek || 'Chyba při mazání souboru');
    }
  }, 'json').fail(function() {
    pbDone();
    alert('Chyba spojení se serverem');
  });
});

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
  pbStart();

  $.get('/php/ajax/ajax_history.php', { akce: 'seznam', typ: VZ.editTyp || 'akordy' }, function(data) {
    pbDone();
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
    pbDone();
    seznam.innerHTML = '<div style="color:#888;font-size:12px">Chyba načítání.</div>';
  });
}

function nacistZalohu(soubor) {
  pbStart();
  $.get('/php/ajax/ajax_history.php', { akce: 'nacist', soubor: soubor, typ: VZ.editTyp || 'akordy' }, function(data) {
    pbDone();
    if (data.ok) {
      document.getElementById('editor').value = data.obsah;
      document.getElementById('panel-historie').style.display = 'none';
    }
  }, 'json').fail(function() { pbDone(); });
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

  $.post('/php/ajax/vlozit_komentar.php', {
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
    var el = document.getElementById('panel-' + (VZ.aktivniMobPanel || 'nahravky'));
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
  pbStart();

  $.get('/php/ajax/ajax_slozky.php', function(data) {
    pbDone();
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
    pbDone();
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

// ── Přesunout soubor (AJAX, bez reloadu stránky — panel Nahrávky zůstává otevřený) ──
$(document).on('submit', '#form_presunout', function(e) {
  e.preventDefault();
  pbStart();
  var $form = $(this);

  $.post('/php/actions/presunout_soubor.php', $form.serialize(), function(data) {
    pbDone();
    if (data.ok) {
      nacistPanel('nahravky');
      $('#presunout_confirm_panel').hide();
      $('#modal_presunout_kam').val('');
      modalSuccess('modal_presunout', data.vysledek || 'Přesunuto');
    } else {
      alert(data.vysledek || 'Chyba při přesunu souboru');
    }
  }, 'json').fail(function() {
    pbDone();
    alert('Chyba spojení se serverem');
  });
});

// ── Vytvořit novou skladbu/vál (AJAX, bez reloadu) ──
$(document).on('submit', '#form_nova_slozka', function(e) {
  e.preventDefault();
  pbStart();
  var $form = $(this);

  $.post('/php/actions/vytvorit_adresar.php', $form.serialize(), function(data) {
    if (data.ok) {
      obnovitSeznamValu(function() {
        pbDone();
        $form.find('input[name="jmeno_adresare"]').val('');
        modalSuccess('modal_nova_slozka', data.vysledek || 'Vytvořeno');
      });
    } else {
      pbDone();
      alert(data.vysledek || 'Chyba při vytváření skladby');
    }
  }, 'json').fail(function() {
    pbDone();
    alert('Chyba spojení se serverem');
  });
});

// ── Přejmenovat skladbu/vál (AJAX, bez reloadu) ──
$(document).on('submit', '#form_rename_val', function(e) {
  e.preventDefault();
  pbStart();
  var $form = $(this);

  $.post('/php/actions/prejmenovat_val.php', $form.serialize(), function(data) {
    if (data.ok) {
      obnovitSeznamValu(function() {
        pbDone();
        modalSuccess('modal_rename_val', data.vysledek || 'Přejmenováno');
      });
    } else {
      pbDone();
      alert(data.vysledek || 'Chyba při přejmenování skladby');
    }
  }, 'json').fail(function() {
    pbDone();
    alert('Chyba spojení se serverem');
  });
});

// ── Smazat skladbu/vál (AJAX, bez reloadu) ──
$(document).on('submit', '#form_delete_val', function(e) {
  e.preventDefault();
  pbStart();
  var $form = $(this);

  $.post('/php/actions/smazat_val.php', $form.serialize(), function(data) {
    if (data.ok) {
      obnovitSeznamValu(function() {
        pbDone();
        modalSuccess('modal_delete_val', data.vysledek || 'Smazáno');
      });
    } else {
      pbDone();
      alert(data.vysledek || 'Chyba při mazání skladby');
    }
  }, 'json').fail(function() {
    pbDone();
    alert('Chyba spojení se serverem');
  });
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

    var resp = null;
    try { resp = JSON.parse(xhr.responseText); } catch (e) { /* není JSON */ }

    if (xhr.status === 200 && resp && resp.ok) {
      res.style.color = '#a7ac38';
      res.textContent = resp.vysledek || 'Soubor nahrán.';
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
      res.textContent = (resp && resp.vysledek) || ('Chyba nahrávání (status ' + xhr.status + ').');
    }
  };

  xhr.onerror = function() {
    btn.disabled = false;
    btn.textContent = 'VLOŽIT SOUBOR';
    res.style.display = 'block';
    res.style.color = '#ff8888';
    res.textContent = 'Chyba spojení.';
  };

  xhr.open('POST', '/php/actions/upload_uni.php');
  xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest'); // nutné, aby navrat.php vrátil JSON místo redirectu
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
{   panel.find('.poznamky-seznam').html(
    '<div class="poznamky-loading">⏳<span class="spinner-border spinner-border-sm"></span> Načítám poznámky…</div>'
    );
    $.post(
    "php/ajax/ajax_nahravka_poznamky.php",
    {
        akce: "list",
        file_path: panel.data("cesta"),
        looper: panel.closest("#looper-bar").length ? 1 : 0
    },
    function(html)
    {
        panel.find(".poznamky-seznam").html(html);
    }
)
.fail(function()
{
    panel.find(".poznamky-seznam").html(
        '<div class="poznamky-loading">⚠ Nepodařilo se načíst poznámky.</div>'
    );
});
}

$(document).on('click', '.pridat-poznamku-btn', function() {

    let typ = $(this).data('typ');

	if (typeof typ === 'undefined')
	{
		typ = NOTE_NORMAL;
	}

    // Tlačítko žije buď v běžném řádku nahrávky (.poznamky-panel s data-cesta),
    // nebo v looperu (#looper-notes, který žádný takový obal nemá — soubor tam
    // víme z looperCurrentFile). Tyhle dva kontexty se musí řešit odděleně,
    // jinak dochází ke kolizi (viz komentář u loadLooperNotes/loadRecordingNotes).
    let jeLooper = $(this).closest('#looper-notes').length > 0;

    let cilovyFile;
    let cas = 0;

    notePlaybackContext = jeLooper ? "looper" : "audio";
    noteAudio = null;

    if (jeLooper)
    {
        cilovyFile = looperCurrentFile;

        if (typeof wavesurfer !== 'undefined' && wavesurfer)
        {
            cas = Math.round(wavesurfer.getCurrentTime() * 1000);
        }
    }
    else
    {
        let panel = $(this).closest('.poznamky-panel');
        let audio = $(this).closest('.nahravka-vysuvna').find('audio')[0];

        noteAudio = audio || null;

        cilovyFile = panel.data('cesta');

        if (audio)
        {
            cas = Math.round(audio.currentTime * 1000);
        }
    }

noteAction = "add";

noteFile = cilovyFile;
noteTime = cas;
noteType = typ;

$("#modal_poznamka_title").text(
    typ == NOTE_SONG ? "Začátek skladby" : "Nová poznámka"
);

zobrazPripravenyCas();

$("#modal_poznamka_text").val("");

$("#modal_poznamka_text").show();
$("#modal_poznamka_confirm").hide();

$("#modal_poznamka_ok")
    .removeClass("btn-danger")
    .addClass("btn-primary")
    .text("Přidat");

$("#modal_poznamka_cas_controls, #modal_poznamka_pridat_a_vratit").show();

$("#modal_poznamka").modal("show");

return;


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

$(document).on('click', '.note-edit', function(e)
{
    e.stopPropagation();

    let row = $(this).closest('.note-row');

    let id = row.data('id');

    let textEl = row.find('.note-text');

    let puvodniText = textEl.text().trim();

	noteAction = "edit";

	noteId = id;

	$("#modal_poznamka_title").text("Upravit poznámku");

	$("#modal_poznamka_info").html(
		"Čas: <strong>" + row.find(".note-time").text().trim() + "</strong>"
	);

	$("#modal_poznamka_text").val(puvodniText);

	$("#modal_poznamka_text").show();

	$("#modal_poznamka_confirm").hide();

	$("#modal_poznamka_ok")
		.removeClass("btn-danger")
		.addClass("btn-primary")
		.text("Uložit");

	$("#modal_poznamka_cas_controls, #modal_poznamka_pridat_a_vratit").hide();

	$("#modal_poznamka").modal("show");

	return;

  
});

$(document).on('click', '.note-delete', function(e)
{
    e.stopPropagation();

    let row = $(this).closest('.note-row');

    let id = row.data('id');

   noteAction = "delete";

	noteId = id;

	$("#modal_poznamka_title").text("Smazat poznámku");

	$("#modal_poznamka_info").html(
		"Čas: <strong>" + row.find(".note-time").text().trim() + "</strong>"
	);

	$("#modal_poznamka_confirm").html(
		"Opravdu chcete smazat tuto poznámku?<br><br><strong>" +
		row.find(".note-text").text() +
		"</strong>"
	);

	$("#modal_poznamka_text").hide();

	$("#modal_poznamka_confirm").show();

	$("#modal_poznamka_ok")
		.removeClass("btn-primary")
		.addClass("btn-danger")
		.text("Smazat");

	$("#modal_poznamka_cas_controls, #modal_poznamka_pridat_a_vratit").hide();

	$("#modal_poznamka").modal("show");

	return;

    $.post(
        "php/ajax/ajax_nahravka_poznamky.php",
        {
            akce: "delete",
            id: id
        },
        function(response)
        {
            if (response.trim() == "OK")
            {
                row.slideUp(150, function()
                {
                    $(this).remove();
                });
            }
            else
            {
                alert("Mazání se nezdařilo.");
            }
        }
    );
});

$(document).on('click', '.export-timestampy-btn', function ()
{
    window.location =
        'php/ajax/export_timestampy.php?file_path=' +
        encodeURIComponent($(this).data('file'));
});

$(document).on("click", "#modal_poznamka_aktualizovat", function ()
{
    let aktualniCas = getNotePlaybackTime();

    if (aktualniCas === null) return;

    noteTime = aktualniCas;
    zobrazPripravenyCas();
});

$(document).on("click", "#modal_poznamka_zpet", function ()
{
    let aktualniCas = getNotePlaybackTime();

    if (aktualniCas === null) return;

    setNotePlaybackTime(aktualniCas - 5000);
});

function ulozitNovouPoznamku(vratitNaTimestamp)
{
    let novyText = $("#modal_poznamka_text").val().trim();

    if (novyText == "")
    {
        alert("Poznámka nesmí být prázdná.");
        return;
    }

    // Uložit lokální kopii: přehrávání může během AJAX požadavku pokračovat,
    // ale volba "Přidat a vrátit" se musí vrátit na skutečně uložený timestamp.
    let ulozenyCas = noteTime;

    $.post(
        "php/ajax/ajax_nahravka_poznamky.php",
        {
            akce: "add",
            file_path: noteFile,
            cas: ulozenyCas,
            typ: noteType,
            poznamka: novyText
        },
        function ()
        {
            if (vratitNaTimestamp) setNotePlaybackTime(ulozenyCas);

            $("#modal_poznamka").modal("hide");

            // Looper otevřený přesně na tomhle souboru → přenačíst jeho vlastní
            // seznam přes loadLooperNotes (jediná funkce, co ví, jak #looper-notes
            // správně naplnit — nemá vnořený .poznamky-seznam jako běžný řádek).
            if (typeof looperCurrentFile !== 'undefined' && looperCurrentFile === noteFile)
            {
                loadLooperNotes(noteFile);
            }

            // Řádek v běžném seznamu nahrávek pro tenhle soubor, pokud je zrovna
            // rozbalený (může nastat současně s looperem otevřeným na stejném souboru).
            let panel = $(".poznamky-panel[data-cesta='" + noteFile + "']");

            if (panel.length)
            {
                loadRecordingNotes(panel);
            }
        }
    );
}

$(document).on("click", "#modal_poznamka_pridat_a_vratit", function ()
{
    if (noteAction === "add") ulozitNovouPoznamku(true);
});

$(document).on("click", "#modal_poznamka_ok", function ()
{
let novyText = $("#modal_poznamka_text").val().trim();

if (noteAction != "delete" && novyText == "")
{
    alert("Poznámka nesmí být prázdná.");
    return;
}
	
if (noteAction == "edit")
{
       $.post(
        "php/ajax/ajax_nahravka_poznamky.php",
        {
            akce: "update",
            id: noteId,
            text: novyText
        },
        function ()
        {
            $(".note-row[data-id='" + noteId + "']")
                .find(".note-text")
                .text(novyText);

            $("#modal_poznamka").modal("hide");
        }
    );
    return;
}

if (noteAction == "delete")
{
    $.post(
        "php/ajax/ajax_nahravka_poznamky.php",
        {
            akce: "delete",
            id: noteId
        },
        function ()
        {
            $(".note-row[data-id='" + noteId + "']").remove();

            $("#modal_poznamka").modal("hide");
        }
    );

    return;
}

if (noteAction == "add")
{
    ulozitNovouPoznamku(false);

    return;
}

});

$(document).on("click", ".nahravka-hlavni", function(e)
{
    if ($(e.target).closest(".btn-nastaveni").length)
    {
        return;
    }

    // Klik na tužku popisku nebo do rozeditovaného pole/tlačítek uložit/zrušit
    // nesmí otevřít/zavřít roletku s přehrávačem.
    if ($(e.target).closest(".popisek-edit-btn, .popisek-edit-wrap").length)
    {
        return;
    }

    $(this).find(".btn-nastaveni").trigger("click");
});

/* ═══════════════════════════════════════════════════════════
   Následující bloky byly přesunuty z inline <script> v index.php
   při restrukturalizaci projektu (viz VZ.md).
   ═══════════════════════════════════════════════════════════ */

// ── Delegovaný handler pro spodní navigaci (nastavuje data-active-panel) ──
$(document).on('click', '.bnav', function() {
    var id = $(this).attr('id');
    if (!id || id === 'bn-skladby') return;
    var panelId = id.replace('bn-', '');
    $('#content-area').attr('data-active-panel', panelId);
});

// ── Poznámky k looper nahrávce ──
function loadLooperNotes(filePath)
{
    $.post(
        'php/ajax/ajax_nahravka_poznamky.php',
        {
            akce: 'list',
            file_path: filePath,
            looper: 1
        },
        function(html)
        {
            $('#looper-notes')
                .html(html)
                .show();
        }
    );
}

// ── Skok na konkrétní timestamp v poznámce ──
 function jumpToTimestamp(ms, filePath)
{
    $('.poznamky-panel').each(function() {

        if ($(this).data('cesta') !== filePath)
        {
            return;
        }

        let audio = $(this)
            .closest('.nahravka-vysuvna')
            .find('audio')[0];

        if (audio)
        {
            audio.currentTime = ms / 1000;
        }
    });
}

// ── Inicializace SortableJS (drag&drop pořadí skladeb) ──
// Inicializace SortableJS po načtení stránky
document.addEventListener('DOMContentLoaded', function() {
    
    function aktivovatSortable(idKontejneru, tridaPolozky) {
        var el = document.getElementById(idKontejneru);
        if (el) {
            var sortable = Sortable.create(el, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                delay: 150, // Zpoždění pro myš i mobil
                delayOnTouchOnly: true, // delay se aplikuje jen na dotyk, ne na myš
                // Povolíme tahání POUZE pro prvky s touto třídou (hlavička zůstane přibitá)
                draggable: '.' + tridaPolozky,
                filter: '.nodrag, button',
                preventOnFilter: true,
                onEnd: function (evt) {
                    var novePoradi = sortable.toArray();
                    
                    $.ajax({
                        url: '/php/ajax/uloz_poradi.php',
                        method: 'POST',
                        data: { poradi: novePoradi },
                        success: function(response) {
                            console.log('Nové pořadí bylo uloženo z panelu: ' + idKontejneru);
                        },
                        error: function() {
                            alert('Chyba při ukládání pořadí. Zkuste to znovu.');
                        }
                    });
                }
            });
        }
    }

    // Aktivujeme přetahování a předáme třídy písniček
    aktivovatSortable('val-drawer', 'dval');           // Mobilní menu
    aktivovatSortable('sidebar-playlist', 'val-item'); // Desktopový panel
});

// ── WaveSurfer / Looper (s peaks cachováním) ──
var wavesurfer = null;
var isLooping = false;
var looperCurrentFile = null;
var looperCurrentName = null;
var looperCurrentPeaks = null;
var looperCurrentSourceUrl = null;
var looperCurrentObjectUrl = null;
var audioCacheStore = null;
var audioCacheRequests = {};
var looperFullscreenWasCollapsed = false;
var looperOpenOptions = { autoplay: true, timeMs: 0 };
var deepLinkProcessed = false;

function getLooperWaveHeight() {
    var looperBar = document.getElementById('looper-bar');
    if (looperBar && looperBar.classList.contains('looper-fullscreen')) {
        return Math.max(160, Math.min(360, Math.round(window.innerHeight * 0.32)));
    }
    return 98;
}

function refreshLooperWaveformSize() {
    if (wavesurfer && typeof wavesurfer.setOptions === 'function') {
        wavesurfer.setOptions({ height: getLooperWaveHeight() });
    }
}

function getAudioCacheStore() {
    if (!audioCacheStore && window.idbKeyval) {
        // Vlastní store zajistí, že clear() nesmaže případná jiná IndexedDB data webu.
        audioCacheStore = idbKeyval.createStore('zkusebna-audio-cache', 'audio-files');
    }
    return audioCacheStore;
}

function getAudioCacheKey(cesta) {
    return 'audio-v1:' + new URL(cesta, window.location.href).href;
}

function setAudioCacheUi(isCached, status, disabled) {
    var $control = $('#audio-cache-control');
    var $toggle = $('#audio-cache-toggle');

    $control.prop('hidden', !looperCurrentFile);
    $('#looper-link-control').prop('hidden', !looperCurrentFile);
    $toggle
        .prop('disabled', !!disabled)
        .attr('aria-pressed', !!isCached)
        .text(isCached ? 'zahodit z paměti' : 'podržet v paměti');
    $('#audio-cache-status').text(status || '');
}

function nativeAudioElements(cesta) {
    return $('audio[data-audio-cache-url]').filter(function() {
        return $(this).data('audio-cache-url') === cesta;
    });
}

function setNativeAudioCacheUi(cesta, isCached, disabled, status) {
    $('.native-audio-cache-toggle').filter(function() {
        return $(this).data('cesta') === cesta;
    }).each(function() {
        var $toggle = $(this);
        $toggle
            .prop('disabled', !!disabled)
            .attr('aria-pressed', !!isCached)
            .attr('title', isCached ? 'Odebrat offline kopii' : 'Uložit pro offline přehrávání')
            .attr('aria-label', isCached ? 'Odebrat offline kopii' : 'Uložit pro offline přehrávání');
        $toggle.find('span').text(disabled ? 'čekám…' : (isCached ? 'Offline' : 'Offline'));
        $toggle.find('i').attr('class', isCached ? 'ti ti-device-floppy' : 'ti ti-download');
        if (status) $toggle.attr('data-status', status); else $toggle.removeAttr('data-status');
    });
}

function setNativeAudioSource(cesta, blob) {
    nativeAudioElements(cesta).each(function() {
        var audio = this;
        if (audio._audioCacheObjectUrl) URL.revokeObjectURL(audio._audioCacheObjectUrl);
        audio._audioCacheObjectUrl = blob ? URL.createObjectURL(blob) : null;
        audio.src = blob ? audio._audioCacheObjectUrl : audio.dataset.networkSrc;
        audio.load();
    });
}

function releaseNativeAudioObjectUrls() {
    $('audio[data-audio-cache-url]').each(function() {
        if (this._audioCacheObjectUrl) URL.revokeObjectURL(this._audioCacheObjectUrl);
    });
}

function syncAudioCacheUi(cesta, isCached, status, disabled) {
    setNativeAudioCacheUi(cesta, isCached, disabled, status);
    if (looperCurrentFile === cesta) setAudioCacheUi(isCached, status, disabled);
}

// Jedna sdílená Promise zabraňuje dvojímu fetchi, pokud uživatel klikne na Offline
// v nativním přehrávači a v looperu téměř zároveň.
function getOrDownloadAudioBlob(cesta) {
    var cacheStore = getAudioCacheStore();
    if (!cacheStore) return Promise.reject(new Error('Offline úložiště není dostupné.'));
    if (audioCacheRequests[cesta]) return audioCacheRequests[cesta];

    audioCacheRequests[cesta] = idbKeyval.get(getAudioCacheKey(cesta), cacheStore)
        .then(function(blob) {
            if (blob instanceof Blob) return blob;
            return fetch(cesta).then(function(response) {
                if (!response.ok) throw new Error('HTTP ' + response.status);
                return response.blob();
            }).then(function(downloadedBlob) {
                return idbKeyval.set(getAudioCacheKey(cesta), downloadedBlob, cacheStore)
                    .then(function() { return downloadedBlob; });
            });
        });

    return audioCacheRequests[cesta].then(function(blob) {
        delete audioCacheRequests[cesta];
        return blob;
    }, function(error) {
        delete audioCacheRequests[cesta];
        throw error;
    });
}

function refreshNativeAudioCacheControls() {
    var cacheStore = getAudioCacheStore();
    if (!cacheStore) {
        $('.native-audio-cache-toggle').prop('disabled', true);
        return;
    }
    var checked = {};
    $('.native-audio-cache-toggle').each(function() {
        var cesta = $(this).data('cesta');
        if (!cesta || checked[cesta]) return;
        checked[cesta] = true;
        idbKeyval.get(getAudioCacheKey(cesta), cacheStore).then(function(blob) {
            var isCached = blob instanceof Blob;
            setNativeAudioCacheUi(cesta, isCached, false);
            if (isCached) setNativeAudioSource(cesta, blob);
        }).catch(function() {
            setNativeAudioCacheUi(cesta, false, false);
        });
    });
}

function releaseLooperObjectUrl() {
    if (looperCurrentObjectUrl) {
        URL.revokeObjectURL(looperCurrentObjectUrl);
        looperCurrentObjectUrl = null;
    }
}

function destroyLooperWaveSurfer() {
    if (wavesurfer) {
        wavesurfer.destroy();
        wavesurfer = null;
    }
    releaseLooperObjectUrl();
}

/**
 * Vytvoří a inicializuje WaveSurfer instanci.
 *
 * @param {string} cesta     - relativní URL audio souboru
 * @param {string} sourceUrl - síťová URL nebo dočasná blob URL
 * @param {object|null} peaksData - { peaks: [[...]], duration: X } nebo null
 */
function initWaveSurfer(cesta, sourceUrl, peaksData) {
    var barvaKapely = getComputedStyle(document.documentElement)
                        .getPropertyValue('--barva').trim() || '#a7ac38';

    var wsConfig = {
        container:     '#waveform',
        waveColor:     '#b8b8b8',
        progressColor: barvaKapely,
        cursorColor:   '#ffffff',
        cursorWidth:   2,
        barWidth:      2,
        barGap:        1,
        barRadius:     1,
        height:        getLooperWaveHeight(),
        // MediaElement přehrává proudově a nedekóduje celou stopu do RAM.
        backend:       'MediaElement',
        url:           sourceUrl
    };

    // Pokud máme uložené peaks, předáme je WaveSurferu →
    // audio se NEKÓDUJE znovu, vykreslení je okamžité
    var maPeaks = peaksData &&
                  Array.isArray(peaksData.peaks) &&
                  peaksData.peaks.length > 0 &&
                  peaksData.duration > 0;

    if (maPeaks) {
        wsConfig.peaks    = peaksData.peaks;
        wsConfig.duration = peaksData.duration;
    }

    wavesurfer = WaveSurfer.create(wsConfig);

    wavesurfer.on('ready', function() {
        $('#wf-placeholder').hide();
		$('#looper-time').show();
        var delka = wavesurfer.getDuration();

        var pozice = Math.min(delka, Math.max(0, looperOpenOptions.timeMs / 1000));
        wavesurfer.setTime(pozice);
        if (looperOpenOptions.autoplay) wavesurfer.play();
        else wavesurfer.pause();

		$('#looper-time').text(
			formatLooperTime(0) + ' / ' + formatLooperTime(delka)
		);
        // Peaks ještě nebyly uloženy → exportujeme a pošleme na server
        if (!maPeaks) {
            var peaks    = wavesurfer.exportPeaks();
            var duration = wavesurfer.getDuration();

            if (Array.isArray(peaks) && peaks.length > 0 && duration > 0) {
                $.ajax({
                    url:         'php/ajax/ulozit_peaks.php',
                    method:      'POST',
                    contentType: 'application/json',
                    data:        JSON.stringify({ cesta: cesta, peaks: peaks, duration: duration }),
                    error: function() {
                        console.warn('[Looper] Peaks se nepodařilo uložit.');
                    }
                });
            }
        }
    });

    wavesurfer.on('play', function() {
        $('#btn-play').addClass('on');
        $('#btn-pause').removeClass('on');
    });

    wavesurfer.on('pause', function() {
        $('#btn-play').removeClass('on');
        $('#btn-pause').addClass('on');
    });

    wavesurfer.on('finish', function() {
        if (isLooping) {
            wavesurfer.play();
        } else {
            $('#btn-play').removeClass('on');
            $('#btn-pause').addClass('on');
        }
    });
	
	wavesurfer.on('timeupdate', function(sec){

    $('#looper-time').text(

        formatLooperTime(sec)

        +

        ' / '

        +

        formatLooperTime(
            wavesurfer.getDuration()
        )

    );

});
}

// Odpojení jakýchkoliv starých click eventů na looper-btn a připojení nových
function openRecordingInLooper(cesta, nazev, options) {
    looperOpenOptions = Object.assign({ autoplay: true, timeMs: 0 }, options || {});

    looperCurrentFile = cesta;
    looperCurrentName = nazev;
    loadLooperNotes(cesta);

    // Zobrazíme looper bar a resetujeme stav
    $('#looper-bar').removeClass('hidden');
    $('#looper-content').removeClass('hidden');
    $('#btn-collapse').html('▭');
    $('#looper-file-name').text(nazev).attr('title', nazev).show();
    $('#wf-placeholder').text('načítám index...').show();

    isLooping = false;
    $('#btn-loop').removeClass('on');

    destroyLooperWaveSurfer();

    // Nejdříve načteme peaks a až poté vybereme zdroj zvuku z IndexedDB nebo ze sítě.
    $.getJSON('php/ajax/nacist_peaks.php', { cesta: cesta })
        .done(function(peaksData) {
            openLooperAudio(cesta, peaksData);
        })
        .fail(function() {
            openLooperAudio(cesta, null);
        });
}

$(document).off('click', '.looper-btn').on('click', '.looper-btn', function() {
    openRecordingInLooper($(this).data('cesta'), $(this).data('nazev'));
});

function removeDeepLinkParams() {
    var url = new URL(window.location.href);
    ['val', 'nahravka', 'time'].forEach(function(param) { url.searchParams.delete(param); });
    window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
}

function processDeepLink() {
    if (deepLinkProcessed || !VZ.deepLink) return;
    deepLinkProcessed = true;
    if (VZ.deepLink.valid) {
        var $button = $('.looper-btn').filter(function() {
            return $(this).data('nazev') === VZ.deepLink.file;
        }).first();
        if ($button.length) {
            // Stejná data a stejná otevírací funkce jako při běžném kliknutí na Looper.
            openRecordingInLooper($button.data('cesta'), $button.data('nazev'), {
                autoplay: false,
                timeMs: VZ.deepLink.time
            });
        } else {
            $('#modal_deep_link_error').modal('show');
        }
    } else {
        $('#modal_deep_link_error').modal('show');
    }
    removeDeepLinkParams();
}

function copyTextFallback(text) {
    var input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', '');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    var copied = document.execCommand('copy');
    input.remove();
    return copied ? Promise.resolve() : Promise.reject(new Error('copy failed'));
}

function looperCreateLink() {
    if (!wavesurfer || !looperCurrentFile || !looperCurrentName) return;
    var url = new URL('index.php', window.location.href);
    url.search = '';
    url.searchParams.set('val', VZ.aktualniVal);
    url.searchParams.set('nahravka', looperCurrentName);
    url.searchParams.set('time', String(Math.round(wavesurfer.getCurrentTime() * 1000)));
    var copy = navigator.clipboard && window.isSecureContext
        ? navigator.clipboard.writeText(url.href)
        : copyTextFallback(url.href);
    copy.then(function() {
        $('#looper-link-status').text('Odkaz zkopírován');
        setTimeout(function() { $('#looper-link-status').text(''); }, 2200);
    }).catch(function() {
        $('#looper-link-status').text('Odkaz se nepodařilo zkopírovat');
    });
}

function openLooperAudio(cesta, peaksData) {
    var cacheStore = getAudioCacheStore();
    looperCurrentPeaks = peaksData;
    looperCurrentSourceUrl = cesta;
    setAudioCacheUi(false, cacheStore ? 'kontroluji offline kopii…' : 'offline úložiště není dostupné', !cacheStore);

    if (!cacheStore) {
        initWaveSurfer(cesta, cesta, peaksData);
        return;
    }

    idbKeyval.get(getAudioCacheKey(cesta), cacheStore)
        .then(function(blob) {
            // Mezitím mohl uživatel otevřít jinou stopu.
            if (looperCurrentFile !== cesta) return;

            if (blob instanceof Blob) {
                looperCurrentObjectUrl = URL.createObjectURL(blob);
                looperCurrentSourceUrl = looperCurrentObjectUrl;
                setAudioCacheUi(true, 'uloženo pro offline poslech', false);
            } else {
                setAudioCacheUi(false, 'přehrávám ze sítě', false);
            }
            initWaveSurfer(cesta, looperCurrentSourceUrl, peaksData);
        })
        .catch(function(error) {
            console.warn('[Looper] Offline kopii se nepodařilo načíst.', error);
            if (looperCurrentFile !== cesta) return;
            setAudioCacheUi(false, 'přehrávám ze sítě', false);
            initWaveSurfer(cesta, cesta, peaksData);
        });
}

$(document).on('click', '#audio-cache-toggle', function() {
    var cesta = looperCurrentFile;
    var cacheStore = getAudioCacheStore();
    if (!cesta || !cacheStore) return;

    if (this.getAttribute('aria-pressed') !== 'true') {
        cacheAudioForOffline(cesta);
    } else {
        removeAudioFromOfflineCache(cesta);
    }
});

function useCachedBlobInLooper(cesta, blob) {
    if (looperCurrentFile !== cesta) return;
    destroyLooperWaveSurfer();
    looperCurrentObjectUrl = URL.createObjectURL(blob);
    looperCurrentSourceUrl = looperCurrentObjectUrl;
    initWaveSurfer(cesta, looperCurrentSourceUrl, looperCurrentPeaks);
}

function cacheAudioForOffline(cesta) {
    syncAudioCacheUi(cesta, true, 'stahuji pro offline poslech…', true);
    getOrDownloadAudioBlob(cesta).then(function(blob) {
        setNativeAudioSource(cesta, blob);
        useCachedBlobInLooper(cesta, blob);
        syncAudioCacheUi(cesta, true, 'uloženo pro offline poslech', false);
    }).catch(function(error) {
        console.warn('[Offline audio] Zvuk se nepodařilo uložit.', error);
        syncAudioCacheUi(cesta, false, 'offline uložení se nezdařilo', false);
    });
}

function removeAudioFromOfflineCache(cesta) {
    var cacheStore = getAudioCacheStore();
    if (!cacheStore) return;
    syncAudioCacheUi(cesta, false, 'mažu offline kopii…', true);
    idbKeyval.del(getAudioCacheKey(cesta), cacheStore).then(function() {
        setNativeAudioSource(cesta, null);
        if (looperCurrentFile === cesta) {
            destroyLooperWaveSurfer();
            looperCurrentSourceUrl = cesta;
            initWaveSurfer(cesta, cesta, looperCurrentPeaks);
        }
        syncAudioCacheUi(cesta, false, 'přehrávám ze sítě', false);
    }).catch(function(error) {
        console.warn('[Offline audio] Offline kopii se nepodařilo smazat.', error);
        syncAudioCacheUi(cesta, true, 'offline kopii se nepodařilo smazat', false);
    });
}

function formatOfflineFileSize(size) {
    var megabytes = size / (1024 * 1024);
    return new Intl.NumberFormat('cs-CZ', {
        maximumFractionDigits: megabytes < 10 ? 1 : 0
    }).format(megabytes) + ' MB';
}

function formatOfflineFilesSummary(count, totalSize) {
    var soubory = count === 1 ? 'soubor' : (count >= 2 && count <= 4 ? 'soubory' : 'souborů');
    return count + ' ' + soubory + ' · ' + formatOfflineFileSize(totalSize);
}

function offlineFileDetails(key) {
    var url = new URL(key.replace(/^audio-v1:/, ''), window.location.href);
    var pathParts = url.pathname.split('/').filter(Boolean).map(function(part) {
        try { return decodeURIComponent(part); } catch (error) { return part; }
    });
    return {
        name: pathParts.pop() || url.href,
        context: pathParts.join(' / ')
    };
}

function refreshOfflineFilesModal() {
    var cacheStore = getAudioCacheStore();
    var $list = $('#offline-files-list').empty();
    var $empty = $('#offline-files-empty').prop('hidden', true);
    var $error = $('#offline-files-error').prop('hidden', true);
    var $summary = $('#offline-files-summary').text('načítám…');
    var $clearAll = $('#offline-files-clear-all').prop('disabled', true);

    if (!cacheStore) {
        $summary.text('0 souborů · 0 MB');
        $error.text('Offline úložiště není dostupné.').prop('hidden', false);
        return;
    }

    idbKeyval.keys(cacheStore).then(function(keys) {
        return Promise.all(keys.filter(function(key) {
            return typeof key === 'string' && key.indexOf('audio-v1:') === 0;
        }).map(function(key) {
            return idbKeyval.get(key, cacheStore).then(function(blob) {
                return blob instanceof Blob ? { key: key, blob: blob } : null;
            });
        }));
    }).then(function(entries) {
        entries = entries.filter(Boolean);
        var totalSize = entries.reduce(function(total, entry) { return total + entry.blob.size; }, 0);
        $summary.text(formatOfflineFilesSummary(entries.length, totalSize));
        $clearAll.prop('disabled', entries.length === 0);
        $empty.prop('hidden', entries.length !== 0);

        entries.forEach(function(entry) {
            var details = offlineFileDetails(entry.key);
            var $item = $('<div>', { 'class': 'offline-file-item' });
            var $info = $('<div>');
            $('<div>', { 'class': 'offline-file-name', text: details.name, title: details.name }).appendTo($info);
            if (details.context) $('<div>', { 'class': 'offline-file-context', text: details.context, title: details.context }).appendTo($info);
            $info.appendTo($item);
            $('<div>', { 'class': 'offline-file-size', text: formatOfflineFileSize(entry.blob.size) }).appendTo($item);
            $('<button>', { type: 'button', 'class': 'btn btn-danger btn-sm offline-file-delete', text: 'SMAZAT' })
                .data('cache-key', entry.key).appendTo($item);
            $item.appendTo($list);
        });
    }).catch(function(error) {
        console.warn('[Offline audio] Seznam offline souborů se nepodařilo načíst.', error);
        $summary.text('0 souborů · 0 MB');
        $error.text('Offline soubory se nepodařilo načíst.').prop('hidden', false);
    });
}

function resetOfflineCacheUiForKey(key, status) {
    $('audio[data-audio-cache-url]').each(function() {
        var cesta = $(this).data('audio-cache-url');
        if (cesta && getAudioCacheKey(cesta) === key) {
            setNativeAudioSource(cesta, null);
            setNativeAudioCacheUi(cesta, false, false);
        }
    });
    if (looperCurrentFile && getAudioCacheKey(looperCurrentFile) === key) {
        destroyLooperWaveSurfer();
        looperCurrentSourceUrl = looperCurrentFile;
        setAudioCacheUi(false, status, false);
        initWaveSurfer(looperCurrentFile, looperCurrentSourceUrl, looperCurrentPeaks);
    }
}

$(document).on('click', '.native-audio-cache-toggle', function(event) {
    event.preventDefault();
    event.stopPropagation();
    var cesta = $(this).data('cesta');
    if (!cesta || this.disabled) return;
    if (this.getAttribute('aria-pressed') === 'true') {
        removeAudioFromOfflineCache(cesta);
    } else {
        cacheAudioForOffline(cesta);
    }
});

$(document).on('click', '#audio-cache-clear', function(event) {
    event.preventDefault();
    $('#modal_offline_files').modal('show');
});

$(document).on('click', '.audio-cache-clear-mobile', function(event) {
    event.preventDefault();
    $('#audio-cache-clear').trigger('click');
});

$('#modal_offline_files').on('shown.bs.modal', refreshOfflineFilesModal);

$(document).on('click', '.offline-file-delete', function() {
    var key = $(this).data('cache-key');
    var cacheStore = getAudioCacheStore();
    if (!key || !cacheStore) return;

    $(this).prop('disabled', true);
    idbKeyval.del(key, cacheStore).then(function() {
        resetOfflineCacheUiForKey(key, 'přehrávám ze sítě');
        refreshOfflineFilesModal();
    }).catch(function(error) {
        console.warn('[Offline audio] Offline soubor se nepodařilo smazat.', error);
        refreshOfflineFilesModal();
    });
});

$(document).on('click', '#offline-files-clear-all', function() {
    var cacheStore = getAudioCacheStore();
    if (!cacheStore || !window.confirm('Smazat všechny nahrávky uložené pro offline poslech?')) return;

    $(this).prop('disabled', true);
    setAudioCacheUi(false, 'mažu offline soubory…', true);
    idbKeyval.clear(cacheStore).then(function() {
        $('audio[data-audio-cache-url]').each(function() {
            var cesta = $(this).data('audio-cache-url');
            setNativeAudioSource(cesta, null);
            setNativeAudioCacheUi(cesta, false, false);
        });
        if (looperCurrentFile) {
            destroyLooperWaveSurfer();
            looperCurrentSourceUrl = looperCurrentFile;
            setAudioCacheUi(false, 'offline soubory byly smazány', false);
            initWaveSurfer(looperCurrentFile, looperCurrentSourceUrl, looperCurrentPeaks);
        }
        refreshOfflineFilesModal();
    }).catch(function(error) {
        console.warn('[Looper] Offline soubory se nepodařilo smazat.', error);
        if (looperCurrentFile) setAudioCacheUi(true, 'offline soubory se nepodařilo smazat', false);
        refreshOfflineFilesModal();
    });
});

/* --- Globální funkce pro tlačítka v looper-baru --- */
function formatLooperTime(sec)
{
    sec = Math.floor(sec);

    let m = Math.floor(sec / 60);
    let s = sec % 60;

    return (
        (m < 10 ? '0' : '') + m +
        ':' +
        (s < 10 ? '0' : '') + s
    );
}

function looperPlay() {
    if (wavesurfer) wavesurfer.play();
}

function looperPause() {
    if (wavesurfer) wavesurfer.pause();
}

function looperRestart() {
    if (wavesurfer) {
        wavesurfer.setTime(0);
        wavesurfer.play();
    }
}

function looperLoop() {
    isLooping = !isLooping;
    if (isLooping) {
        $('#btn-loop').addClass('on');
    } else {
        $('#btn-loop').removeClass('on');
    }
}

function looperToggle()
{
    $('#looper-content').toggleClass('hidden');

    if ($('#looper-content').hasClass('hidden'))
    {
        $('#btn-collapse-icon').text('▼');
        $('#btn-collapse-label').text('Obnovit');
    }
    else
    {
        $('#btn-collapse-icon').text('▲');
        $('#btn-collapse-label').text('Minimalizovat');
    }
}

function looperFullscreenToggle(forceFullscreen)
{
    var looperBar = document.getElementById('looper-bar');
    var content = document.getElementById('looper-content');
    var button = document.getElementById('btn-looper-fullscreen');
    if (!looperBar || !content || !button) return;

    var otevrit = typeof forceFullscreen === 'boolean'
        ? forceFullscreen
        : !looperBar.classList.contains('looper-fullscreen');

    if (otevrit) {
        looperFullscreenWasCollapsed = content.classList.contains('hidden');
        looperBar.classList.add('looper-fullscreen');
        content.classList.remove('hidden');
        $('#btn-collapse-icon').text('▲');
        $('#btn-collapse-label').text('Minimalizovat');
    } else {
        looperBar.classList.remove('looper-fullscreen');
        if (looperFullscreenWasCollapsed) {
            content.classList.add('hidden');
            $('#btn-collapse-icon').text('▼');
            $('#btn-collapse-label').text('Obnovit');
        }
        looperFullscreenWasCollapsed = false;
    }

    button.setAttribute('aria-pressed', String(otevrit));
    button.setAttribute('aria-label', otevrit ? 'Obnovit velikost looperu' : 'Maximalizovat looper');
    $('#btn-looper-fullscreen-label').text(otevrit ? 'Obnovit velikost' : 'Maximalizovat');

    window.requestAnimationFrame(refreshLooperWaveformSize);
}

function setLooperMenuOpen(open) {
    var menu = document.getElementById('looper-menu');
    var button = document.getElementById('btn-looper-menu');
    if (!menu || !button) return;
    menu.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Zavřít menu Looperu' : 'Otevřít menu Looperu');
}

function closeLooperMenu() {
    var menu = document.getElementById('looper-menu');
    if (!menu || menu.hidden) return false;
    setLooperMenuOpen(false);
    return true;
}

document.addEventListener('click', function(event) {
    var menuWrap = document.querySelector('.looper-menu-wrap');
    if (!menuWrap) return;

    if (event.target.closest('#btn-looper-menu')) {
        setLooperMenuOpen(document.getElementById('looper-menu').hidden);
    } else if (!menuWrap.contains(event.target)) {
        closeLooperMenu();
    } else if (event.target.closest('[data-looper-menu-close]')) {
        closeLooperMenu();
    }
});

document.addEventListener('keydown', function(event) {
    if (event.key !== 'Escape') return;
    if (closeLooperMenu()) return;
    if ($('#looper-bar').hasClass('looper-fullscreen')) looperFullscreenToggle(false);
});

function looperZavrit() {
    looperFullscreenToggle(false);
    if (wavesurfer) {
        wavesurfer.pause();
    }
    destroyLooperWaveSurfer();
	$('#wf-placeholder').show();
    looperCurrentFile = null;
    looperCurrentName = null;
    looperCurrentPeaks = null;
    looperCurrentSourceUrl = null;
    setAudioCacheUi(false, '', true);
    $('#looper-file-name').text('').attr('title', '').hide();
    $('#looper-notes').hide().empty();
  	//$('#looper-content').removeClass('hidden');
    $('#btn-collapse-icon').text('▼');
    $('#btn-collapse-label').text('Obnovit');
    $('#looper-time').text('00:00 / 00:00').hide();
    $('#looper-content').addClass('hidden');
    isLooping = false;
    $('#btn-loop').removeClass('on');
	

}

if ($('#looper-content').hasClass('hidden'))
{
    $('#btn-collapse-icon').text('▼');
    $('#btn-collapse-label').text('Obnovit');
}
else
{
    $('#btn-collapse-icon').text('▲');
    $('#btn-collapse-label').text('Minimalizovat');
}


// ── Nastavení počátečního stavu tlačítka collapse loop panelu ──
if ($('#looper-content').hasClass('hidden')) {
    $('#btn-collapse').html('▼');
} else {
    $('#btn-collapse').html('▲');
}
