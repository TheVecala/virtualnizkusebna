<style>
/* ── Jednotný styl všech modalů ── */
/* Maximalizovaný Looper je nad běžným rozhraním (z-index 1100), proto musí
   Bootstrap modal i jeho backdrop zůstat nad ním. */
.modal { z-index: 1200; }
.modal-backdrop { z-index: 1190; }
.modal-content {
  background: #2e3338 !important;
  border: 1px solid #a7ac38;
  border-radius: 8px;
  color: var(--text) !important;
  box-shadow: 0 8px 40px rgba(0,0,0,.7);
}
.modal-header {
  background: #383d43;
  border-bottom: 1px solid #4a4e55;
  padding: 10px 16px;
  border-radius: 8px 8px 0 0;
}
.modal-header .modal-title,
.modal-header h5.modal-title {
  color: var(--accent);
  font-size: 12px;
  font-weight: bold;
  letter-spacing: 1px;
  margin: 0;
  text-shadow: 1px -1px 5px var(--accent);
}
.modal-header .close {
  color: var(--muted);
  opacity: 1;
  text-shadow: none;
}
.modal-header .close:hover { color: var(--text); }
.modal-body { padding: 14px 16px; background: #2e3338; }
.modal-footer {
  border-top: 1px solid #4a4e55;
  padding: 10px 16px;
  background: #383d43;
  border-radius: 0 0 8px 8px;
  justify-content: flex-end;
  gap: 6px;
}

/* Formulářové prvky */
.modal-content .form-control {
  background: #1e2226 !important;
  border: 1px solid #4a4e55;
  color: var(--text) !important;
  border-radius: 5px;
  font-size: 13px;
}
.modal-content .form-control:focus {
  border-color: var(--barva);
  box-shadow: 0 0 0 2px rgba(167,172,56,.2);
  background: #1e2226 !important;
  color: var(--text) !important;
}
.modal-content label { color: #aaa; font-size: 12px; margin-bottom: 4px; }
.modal-content select option { background: #1e2226; color: var(--text); }
.modal-content textarea.form-control { resize: vertical; font-family: inherit; }
.modal-content p { color: #aaa; font-size: 12px; margin-bottom: 6px; }
.modal-content hr { border-color: #4a4e55; margin: 12px 0; }
.modal-content strong { color: var(--text); }

/* Checkbox */
.modal-content .form-check-label { color: var(--text); font-size: 13px; }

/* Tlačítka */
.modal-content .btn { font-size: 12px; border-radius: 5px; padding: 5px 12px; }
.modal-content .btn-primary   { background: var(--barva); border-color: var(--barva); color: #000; }
.modal-content .btn-primary:hover { filter: brightness(1.1); }
.modal-content .btn-danger    { background: #7a2020; border-color: #a03030; color: #ffbbbb; }
.modal-content .btn-danger:hover { background: #922525; }
.modal-content .btn-warning   { background: #4a3a00; border-color: var(--accent); color: var(--accent); }
.modal-content .btn-secondary { background: #3a3f45; border-color: #555; color: var(--text); }
.modal-content .btn-secondary:hover { border-color: var(--barva); color: var(--barva); }
.modal-content .btn-dark      { background: #3a3f45; border-color: #555; color: var(--text); }

/* Kontextový blok — co a kde se děje */
.modal-ctx {
  background: #252a2e;
  border-left: 3px solid var(--barva);
  border-radius: 0 5px 5px 0;
  padding: 8px 12px;
  margin-bottom: 12px;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.8;
}
.modal-ctx strong { color: var(--text) !important; }
.modal-ctx .ctx-action {
  color: var(--accent);
  font-size: 10px;
  letter-spacing: .8px;
  text-transform: uppercase;
  font-weight: bold;
  margin-bottom: 2px;
}

/* Dark code editor (akordový text / tablatura) */
#editor, #editor_tab {
  background: #0d1117 !important;
  color: #c9d1d9 !important;
  border: 1px solid #30363d !important;
  border-radius: 5px;
  font-family: 'Courier New', Courier, monospace !important;
  font-size: 13px;
  line-height: 1.6;
  width: 100%;
  resize: vertical;
  padding: 10px;
  box-sizing: border-box;
}
#editor:focus, #editor_tab:focus {
  border-color: var(--barva) !important;
  box-shadow: 0 0 0 2px rgba(167,172,56,.15) !important;
  outline: none;
}

/* Potvrzovací panel přesunu */
#presunout_confirm_panel {
  display: none;
  margin-top: 12px;
  background: #1a2010;
  border: 1px solid var(--barva);
  border-radius: 6px;
  padding: 12px 14px;
  font-size: 12px;
}
#presunout_confirm_panel .confirm-label {
  font-size: 10px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: .5px;
  margin-bottom: 8px;
}
#presunout_confirm_panel .confirm-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
  font-size: 13px;
}
#presunout_confirm_panel .confirm-file { color: var(--text); font-weight: bold; }
#presunout_confirm_panel .confirm-arrow { color: #555; }
#presunout_confirm_panel .confirm-to { color: var(--accent); font-weight: bold; }
#presunout_confirm_panel .confirm-btns { display: flex; gap: 6px; }

/* Panel historie */
#panel-historie { background: #252a2e; border-top: 1px solid #4a4e55; padding: 10px 16px; }
#panel-historie .btn-zaloha {
  background: #2a3a10; border: 1px solid var(--barva);
  color: var(--barva); border-radius: 4px;
  padding: 2px 8px; font-size: 11px; cursor: pointer;
}
#panel-historie .btn-zaloha:hover { background: #3a4a15; }

/* Nápis "varování" v footeru editoru */
.modal-footer-hint {
  font-size: 11px;
  color: var(--muted);
  margin-right: auto;
  align-self: center;
}

/* ── Success overlay ── */
.modal-content { position: relative; }
.modal-success-overlay {
  position: absolute;
  inset: 0;
  background: #2e3338;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 10;
  gap: 10px;
  animation: fadeInOverlay .15s ease;
}
@keyframes fadeInOverlay {
  from { opacity: 0; transform: scale(.97); }
  to   { opacity: 1; transform: scale(1); }
}
.modal-success-icon { font-size: 40px; color: var(--barva); line-height: 1; }
.modal-success-text { font-size: 13px; color: var(--text); }
</style>


<!-- ───────────────────────── O APLIKACI ───────────────────────── -->
<div class="modal modal-centered" id="myModal">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">O APLIKACI</h5>
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>
      <div class="modal-body">
        <p>DIY projekt ze Štatlu.</p>
        <p>Plugin pro sdílení informací o rozpracovaných skladbách hudební skupiny mezi jejímy členy.</p>
        <p>Tohle není prostor pro volné ukládání dat většího množství uživatelů. Vhodná je instalace na vlastní doménu pro plnou kontrolu nad obsahem.</p>
        <p>Pro více info pište na adresu: <i>the@vecala.cz</i></p>
        <p>Thanks to:<br><a href="https://www.jakpsatweb.cz/">Jak psát web</a><br>wavesurfer.js</p>
        <button type="button" class="btn btn-secondary">INSTALACE NA VLASTNÍ DOMÉNĚ</button>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-dismiss="modal">ZAVŘÍT</button>
      </div>
    </div>
  </div>
</div>


<!-- ───────────────────────── SMAZAT SOUBOR ───────────────────────── -->
<div class="modal" id="modal_delete">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">SMAZAT SOUBOR</h5>
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>
      <form id="form_smazat_soubor" action="/php/actions/smazat_soubor.php" method="post" enctype="multipart/form-data">
        <div class="modal-body">
          <div class="modal-ctx">
            <div class="ctx-action">⚠ Nevratná akce</div>
            <div>Soubor: <strong id="modal_delete_label">—</strong></div>
          </div>
          <p>Soubor bude trvale odstraněn a nelze jej obnovit.</p>
          <div style="display:none">
            <input id="modal_delete_deleter" type="text" class="form-control" value="" name="soubor_ke_smazani">
          </div>
          <div style="display:none">
            <input type="text" class="form-control" value="<?php echo $_SERVER['PHP_SELF'] ?>" name="navrat">
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-dismiss="modal">ZRUŠIT</button>
          <button type="submit" class="btn btn-danger<?= ma_pravo('delete_file') ? '' : ' btn-locked' ?>">SMAZAT</button>
        </div>
      </form>
    </div>
  </div>
</div>


<!-- ───────────────────────── VLOŽIT SOUBOR ───────────────────────── -->
<div class="modal" id="modal_vlozit_soubor">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">VLOŽENÍ SOUBORU</h5>
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="modal-ctx">
          <div class="ctx-action">Nahrávám do</div>
          <div>Skladba: <strong><?php echo htmlspecialchars($slozka_souboru); ?></strong></div>
        </div>
        <form id="form_upload">
          <div class="form-group">
            <label>Vybrat soubor:</label>
            <input type="file" class="form-control" id="upload_file"
              accept=".mp3,.wav,.ogg,.flac,.aac,.pdf,.txt,.jpg,.jpeg,.png,.gif">
          </div>
          <div class="form-check" style="margin-bottom:10px">
            <label class="form-check-label">
              <input id="upload_odeslat" type="checkbox" value="true"> Odeslat info na mail
            </label>
          </div>
          <!-- Progress bar uploadu -->
          <div id="upload-progress-wrap" style="display:none; margin-bottom:10px;">
            <div style="background:#1e2226; border-radius:4px; height:6px; overflow:hidden;">
              <div id="upload-progress-bar" style="height:100%; width:0%; background:var(--barva); transition:width .1s;"></div>
            </div>
            <div id="upload-progress-text" style="font-size:11px; color:var(--muted); margin-top:4px; text-align:center;">0%</div>
          </div>
          <div id="upload-result" style="font-size:12px; margin-bottom:8px; display:none;"></div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-dismiss="modal">ZAVŘÍT</button>
        <button type="submit" form="form_upload" class="btn btn-primary<?= ma_pravo('upload') ? '' : ' btn-locked' ?>" id="upload-btn">VLOŽIT SOUBOR</button>
      </div>
    </div>
  </div>
</div>


<!-- ───────────────────────── NOVÁ SKLADBA ───────────────────────── -->
<div class="modal" id="modal_nova_slozka">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">NOVÁ SKLADBA</h5>
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>
      <form id="form_nova_slozka" action="/php/actions/vytvorit_adresar.php" method="post" enctype="multipart/form-data">
        <div class="modal-body">
          <div class="form-group">
            <label for="jmeno_adresare">Název nové skladby:</label>
            <input type="text" class="form-control" name="jmeno_adresare" autofocus>
          </div>
          <div style="display:none">
            <input type="text" class="form-control" name="sekce" value="<?php echo $sekce; ?>">
          </div>
          <div style="display:none">
            <input type="text" class="form-control" name="navrat" value="<?php echo $_SERVER['PHP_SELF']; ?>">
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-dismiss="modal">ZRUŠIT</button>
          <button id="vytvorit_adresar" type="submit" class="btn btn-primary<?= ma_pravo('create_val') ? '' : ' btn-locked' ?>">VYTVOŘIT</button>
        </div>
      </form>
    </div>
  </div>
</div>


<!-- ───────────────────────── VLOŽIT KOMENTÁŘ ───────────────────────── -->
<div class="modal" id="modal_vlozit_komentar">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">VLOŽENÍ POZNÁMKY</h5>
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>
      <div class="modal-body">
        <form id="form_komentar">
          <div class="form-group">
            <label>Text:</label>
            <textarea class="form-control" id="komentar_text" name="text" rows="5"></textarea>
          </div>
          <div class="form-group">
            <label>Odkaz (pokud chceš):</label>
            <input type="text" class="form-control" id="komentar_odkaz" name="odkaz">
          </div>
          <div class="form-group">
            <label>YouTube odkaz (pokud chceš):</label>
            <input type="text" class="form-control" id="komentar_odkaz2" name="odkaz2">
          </div>
          <div class="form-group">
            <label>Jméno:</label>
            <input type="text" class="form-control" id="komentar_jmeno" name="name">
          </div>
          <div id="komentar_chyba" style="color:#ff7b7b; display:none; font-size:12px;"></div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-dismiss="modal">ZAVŘÍT</button>
        <button type="submit" form="form_komentar" class="btn btn-primary<?= ma_pravo('comment') ? '' : ' btn-locked' ?>">ULOŽIT</button>
      </div>
    </div>
  </div>
</div>


<!-- ───────────────────────── NASTAVENÍ ───────────────────────── -->
<div class="modal" id="modal_skin">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">NASTAVENÍ ZOBRAZENÍ</h5>
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>
      <div class="modal-body">
        <p>Způsob zobrazení skladeb:</p>
        <button id="skin_default" type="button" class="btn btn-secondary">
          rozbalit vše <span style="color:var(--muted); font-size:11px;">/desktop/</span>
        </button>
        <button id="skin_mini" type="button" class="btn btn-secondary">
          sbalit vše <span style="color:var(--muted); font-size:11px;">/mobil/</span>
        </button>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-dismiss="modal">ZAVŘÍT</button>
      </div>
    </div>
  </div>
</div>


<!-- ───────────────────────── PŘEJMENOVAT SKLADBU ───────────────────────── -->
<div class="modal" id="modal_rename_val">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 id="modal_rename_val_title" class="modal-title">PŘEJMENOVAT SKLADBU</h5>
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>
      <form id="form_rename_val" action="/php/actions/prejmenovat_val.php" method="post">
        <div class="modal-body">
          <div class="modal-ctx">
            <div class="ctx-action">Přejmenuji</div>
            <div>Skladba: <strong id="modal_rename_val_ctx">—</strong></div>
          </div>
          <div style="display:none">
            <input id="modal_rename_val_label" type="text" class="form-control" value="" name="puvodni_jmeno_valu_k_prejmenovani">
          </div>
          <div class="form-group">
            <label for="modal_rename_val_label_novy">Nový název:</label>
            <input id="modal_rename_val_label_novy" type="text" class="form-control" value=""
              name="nove_jmeno_valu_k_prejmenovani" placeholder="nový název" autofocus>
          </div>
          <div style="display:none">
            <input type="text" class="form-control" value="<?php echo $_SERVER['PHP_SELF'] ?>" name="navrat">
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-dismiss="modal">ZRUŠIT</button>
          <button type="submit" class="btn btn-warning<?= ma_pravo('rename_val') ? '' : ' btn-locked' ?>">PŘEJMENOVAT</button>
        </div>
      </form>
    </div>
  </div>
</div>


<!-- ───────────────────────── SMAZAT SKLADBU ───────────────────────── -->
<div class="modal" id="modal_delete_val">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">SMAZAT SKLADBU</h5>
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>
      <form id="form_delete_val" action="/php/actions/smazat_val.php" method="post">
        <div class="modal-body">
          <div class="modal-ctx">
            <div class="ctx-action">⚠ Nevratná akce</div>
            <div>Skladba: <strong id="modal_delete_val_label">—</strong></div>
          </div>
          <p>Pozor! Smazat lze pouze <strong>prázdnou</strong> skladbu. Pokud složka obsahuje soubory, akce selže.</p>
          <div style="display:none">
            <input id="modal_delete_val_deleter" type="text" class="form-control" value="" name="val_ke_smazani">
          </div>
          <div style="display:none">
            <input type="text" class="form-control" value="<?php echo $_SERVER['PHP_SELF'] ?>" name="navrat">
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-dismiss="modal">ZRUŠIT</button>
          <button type="submit" class="btn btn-danger<?= ma_pravo('delete_val') ? '' : ' btn-locked' ?>">SMAZAT SKLADBU</button>
        </div>
      </form>
    </div>
  </div>
</div>


<!-- ───────────────────────── PŘESUNOUT SOUBOR ───────────────────────── -->
<!--
  POZOR – main.js musí být upraven:
  Klik na položku složky v #seznam_slozek_pro_presun NESMÍ rovnou submitovat form.
  Místo toho zavolej: presunoutVybratSlozku(nazevSlozky, nazevSouboru)
  Tlačítka složek musí mít: data-slozka="nazevSlozky" a class="presun-slozka-btn"
  Při otevření modalu nastav také: $('#modal_presunout_from_label').text(aktualni_slozka)
-->
<div class="modal fade" id="modal_presunout">
  <div class="modal-dialog modal-dialog-scrollable">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">PŘESUNOUT SOUBOR</h5>
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>
      <form id="form_presunout" action="/php/actions/presunout_soubor.php" method="post" enctype="multipart/form-data">
        <div class="modal-body">
          <div class="modal-ctx">
            <div class="ctx-action">Přesouvám</div>
            <div>Soubor: <strong id="modal_presunout_label">—</strong></div>
            <div>Ze složky: <strong id="modal_presunout_from_label" style="color:var(--muted)">—</strong></div>
          </div>
          <div style="display:none">
            <input id="modal_presunout_co"    type="text" class="form-control" value="" name="presunout_co">
            <input id="modal_presunout_odkud" type="text" class="form-control" value="" name="presunout_odkud">
            <input id="modal_presunout_kam"   type="text" class="form-control" value="" name="presunout_kam">
            <input type="text" class="form-control" value="<?php echo $_SERVER['PHP_SELF'] ?>" name="navrat">
          </div>
          <p style="font-size:12px; color:var(--muted); margin-bottom:8px;">Vyberte cílovou složku:</p>
          <div id="seznam_slozek_pro_presun" class="list-group" style="max-height:240px; overflow-y:auto; padding-right:4px;">
            <div style="color:var(--muted); font-size:12px; padding:10px;">načítám...</div>
          </div>

          <!-- Potvrzovací panel — zobrazí se po výběru složky -->
          <div id="presunout_confirm_panel">
            <div class="confirm-label">Potvrdit přesun</div>
            <div class="confirm-row">
              <span class="confirm-file" id="presunout_confirm_soubor">—</span>
              <span class="confirm-arrow">→</span>
              <span class="confirm-to" id="presunout_confirm_cil">—</span>
            </div>
            <div class="confirm-btns">
              <button type="submit" form="form_presunout" class="btn btn-primary btn-sm">✓ Přesunout</button>
              <button type="button" class="btn btn-secondary btn-sm" id="presunout_confirm_zrusit">✗ Zrušit výběr</button>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-dismiss="modal">ZAVŘÍT</button>
        </div>
      </form>
    </div>
  </div>
</div>


<!-- ───────────────────────── NAHRÁVÁNÍ ───────────────────────── -->
<div class="modal" id="modal_nahrat_zvuk">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">NAHRÁVÁNÍ</h5>
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>
      <div class="modal-body">
        <div class="container text-center">
          <p>Nahrávka se ukládá do dočasné paměti a je třeba ji manuálně uložit pomocí pravého tlačítka myši.</p>
          <p>Je možno udělat více nahrávek, poté poslechnout a případně uložit.</p>
          <p style="color:#cc8844;">⚠ Znovunačtení stránky způsobí smazání neuložených nahrávek.</p>
          <button id="record_button" class="btn btn-primary">ZAČÍT NAHRÁVAT</button>
          <ul id="playlist"></ul>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-dismiss="modal">ZAVŘÍT</button>
      </div>
    </div>
  </div>
</div>


<!-- ───────────────────────── UPRAVIT TEXT / AKORDY ───────────────────────── -->
<div class="modal" id="modal_zmenit_text">
  <div class="modal-dialog modal-dialog-scrollable modal-lg">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="modal_zmenit_text_label">UPRAVIT TEXT / AKORDY</h5>
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>
      <form action="/php/actions/vlozit_akordy.php" method="post" enctype="multipart/form-data">
        <div class="modal-body">
          <div class="modal-ctx">
            <div class="ctx-action" id="modal_editor_ctx_action">—</div>
            <div>Soubor: <strong id="modal_editor_ctx_soubor">—</strong></div>
            <div>Skladba: <strong id="modal_editor_ctx_slozka">—</strong></div>
          </div>
          <div style="display:none">
            <input id="modal_soubor_akordu" type="text" class="form-control"
              value="" name="soubor_akordu">
            <input type="text" class="form-control" value="<?php echo $_SERVER['PHP_SELF'] ?>" name="navrat">
          </div>
          <textarea id="editor" name="editor" rows="22"></textarea>
        </div>
        <div class="modal-footer">
          <span class="modal-footer-hint">Záloha se uchovává v historii.</span>
          <button type="button" class="btn btn-secondary btn-sm" onclick="zobrazHistorii()">📋 Historie</button>
          <button type="button" class="btn btn-secondary" data-dismiss="modal">ZAVŘÍT</button>
          <button type="submit" class="btn btn-warning<?= ma_pravo('edit_text') ? '' : ' btn-locked' ?>">ULOŽIT ZMĚNY</button>
        </div>
      </form>
      <!-- Panel historie -->
      <div id="panel-historie" style="display:none; max-height:200px; overflow-y:auto;">
        <div style="font-size:11px; color:#888; margin-bottom:6px;">Kliknutím na zálohu ji načteš do editoru. Uložením ji obnovíš.</div>
        <div id="seznam-zaloh"></div>
      </div>
    </div>
  </div>
</div>


<!-- ───────────────────────── OFFLINE SOUBORY ───────────────────────── -->
<div class="modal fade" id="modal_offline_confirm" tabindex="-1" role="dialog"
     aria-labelledby="modal_offline_confirm_title" aria-describedby="offline-cache-confirm-message" aria-hidden="true">
  <div class="modal-dialog modal-sm modal-dialog-centered" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="modal_offline_confirm_title">OFFLINE KOPIE</h5>
        <button type="button" class="close" data-dismiss="modal" aria-label="Zavřít"><span aria-hidden="true">&times;</span></button>
      </div>
      <div class="modal-body">
        <div class="modal-ctx">
          <div class="ctx-action" id="offline-cache-confirm-action">OFFLINE KOPIE</div>
          <strong id="offline-cache-confirm-name"></strong>
        </div>
        <p id="offline-cache-confirm-message"></p>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-dismiss="modal">ZRUŠIT</button>
        <button type="button" id="offline-cache-confirm-submit" class="btn btn-primary">ULOŽIT</button>
      </div>
    </div>
  </div>
</div>

<div class="modal fade" id="modal_offline_files" tabindex="-1" role="dialog" aria-labelledby="modal_offline_files_title" aria-hidden="true">
  <div class="modal-dialog modal-dialog-scrollable" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="modal_offline_files_title">OFFLINE SOUBORY</h5>
        <button type="button" class="close" data-dismiss="modal" aria-label="Zavřít"><span aria-hidden="true">&times;</span></button>
      </div>
      <div class="modal-body">
        <div id="offline-files-list" class="offline-files-list" aria-live="polite"></div>
        <p id="offline-files-empty" class="offline-files-empty" hidden>Žádné offline soubory.</p>
        <p id="offline-files-error" class="offline-files-error" hidden>Offline soubory se nepodařilo načíst.</p>
      </div>
      <div class="modal-footer offline-files-footer">
        <span id="offline-files-summary" class="offline-files-summary">0 souborů · 0 MB</span>
        <button type="button" id="offline-files-clear-all" class="btn btn-danger" disabled>SMAZAT VŠE</button>
        <button type="button" class="btn btn-secondary" data-dismiss="modal">ZAVŘÍT</button>
      </div>
    </div>
  </div>
</div>

<div class="modal" id="modal_logout">
  <div class="modal-dialog modal-sm">
    <div class="modal-content" style="text-align:center">
      <div class="modal-header" style="justify-content:center; border-bottom:none; padding-bottom:0">
        <h5 class="modal-title">🎸</h5>
      </div>
      <div class="modal-body" style="padding:10px 20px 20px">
        <p style="color:var(--text); font-size:14px; margin-bottom:16px">Opravdu chceš opustit zkušebnu?</p>
        <a href="/php/login/logout.php" class="btn btn-danger" style="display:block; margin-bottom:8px">
          zpět do reálného světa
        </a>
        <button type="button" class="btn btn-primary" data-dismiss="modal" style="display:block; width:100%">
          zůstat ve zkušebně
        </button>
      </div>
    </div>
  </div>
</div>

<div class="modal" id="modal_deep_link_error" tabindex="-1" role="dialog" aria-hidden="true">
  <div class="modal-dialog modal-sm modal-dialog-centered" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">CHYBA</h5>
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>
      <div class="modal-body"><p style="color:var(--text);margin:0">Nahrávka nebyla nalezena</p></div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-dismiss="modal">ZAVŘÍT</button>
      </div>
    </div>
  </div>
</div>

<!-- ───────────────────────── VYTVOŘENÍ PRŮBĚHU PRO LOOPER ───────────────────────── -->
<div class="modal fade" id="modal_looper_peaks" tabindex="-1" role="dialog" aria-labelledby="modal_looper_peaks_title" aria-hidden="true" data-backdrop="static" data-keyboard="false">
  <div class="modal-dialog modal-dialog-centered" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="modal_looper_peaks_title">VYTVOŘIT PRŮBĚH NAHRÁVKY</h5>
        <button type="button" class="close looper-peaks-back" aria-label="Zpět"><span aria-hidden="true">&times;</span></button>
      </div>
      <div class="modal-body">
        <p>Pro tuto nahrávku ještě není vytvořený průběh. Looper ji otevře až po jeho vytvoření.</p>
        <div class="modal-ctx mb-3">
          <div class="ctx-action">Nahrávka</div>
          <div><strong id="looper-peaks-file-name">—</strong></div>
        </div>
        <p class="small text-muted">Vytvoření jednorázově stáhne celou nahrávku. Během zpracování okno nezavírejte.</p>
        <div id="looper-peaks-progress-wrap" hidden>
          <div class="looper-peaks-progress-track">
            <div id="looper-peaks-progress-bar"></div>
          </div>
          <div id="looper-peaks-progress-text" class="audio-cache-status text-center mt-1" aria-live="polite">0 %</div>
        </div>
        <div id="looper-peaks-result" class="small mt-2" role="status" aria-live="polite"></div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary looper-peaks-back">ZPĚT</button>
        <button type="button" class="btn btn-primary" id="looper-peaks-create">VYTVOŘIT</button>
      </div>
    </div>
  </div>
</div>

<div class="modal fade" id="modal_looper_link" tabindex="-1" role="dialog" aria-labelledby="modal_looper_link_title" aria-hidden="true">
  <div class="modal-dialog modal-dialog-centered" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="modal_looper_link_title">ODKAZ NA NAHRÁVKU</h5>
        <button type="button" class="close" data-dismiss="modal" aria-label="Zavřít"><span aria-hidden="true">&times;</span></button>
      </div>
      <div class="modal-body">
        <label for="looper-link-url">Odkaz včetně aktuální pozice:</label>
        <input type="text" id="looper-link-url" class="form-control" readonly>
        <span id="looper-link-copy-status" class="audio-cache-status d-block mt-2" aria-live="polite"></span>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-dismiss="modal">Zavřít</button>
        <button type="button" class="btn btn-primary" id="looper-link-copy">Kopírovat odkaz</button>
      </div>
    </div>
  </div>
</div>

<!-- ───────────────────────── editace timestampu ───────────────────────── -->

<div class="modal fade" id="modal_export_timestampy" tabindex="-1" role="dialog" aria-labelledby="modal_export_timestampy_title" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="modal_export_timestampy_title">EXPORT TIMESTAMPŮ</h5>
                <button type="button" class="close" data-dismiss="modal" aria-label="Zavřít">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body timestamp-export-body">
                <section class="timestamp-export-section timestamp-export-section-table" aria-labelledby="timestamp_export_table_title">
                    <div class="timestamp-export-section-header">
                        <span class="timestamp-export-section-icon" aria-hidden="true">
                            <i class="ti ti-table"></i>
                        </span>
                        <div>
                            <h6 id="timestamp_export_table_title">Export do tabulky</h6>
                            <p>Vyberte typy timestampů, které chcete zkopírovat.</p>
                        </div>
                    </div>

                    <div class="timestamp-export-checks" role="group" aria-label="Typy timestampů pro tabulku">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="copy_timestamp_song" checked>
                            <label class="form-check-label" for="copy_timestamp_song">Začátky skladeb</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="copy_timestamp_passage" checked>
                            <label class="form-check-label" for="copy_timestamp_passage">Pasáže</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="copy_timestamp_note">
                            <label class="form-check-label" for="copy_timestamp_note">Poznámky</label>
                        </div>
                    </div>

                    <button type="button" class="btn btn-primary timestamp-export-action" id="copy_timestampy_table_confirm">
                        <i class="ti ti-copy" aria-hidden="true"></i>
                        Kopírovat do schránky
                    </button>
                </section>

                <section class="timestamp-export-section timestamp-export-section-text" aria-labelledby="timestamp_export_text_title">
                    <div class="timestamp-export-section-header">
                        <span class="timestamp-export-section-icon" aria-hidden="true">
                            <i class="ti ti-file-text"></i>
                        </span>
                        <div>
                            <h6 id="timestamp_export_text_title">Stažení textového souboru</h6>
                            <p>Stáhne všechny timestampy jako soubor TXT.</p>
                        </div>
                    </div>

                    <button type="button" class="btn btn-secondary timestamp-export-action" id="export_timestampy_txt">
                        <i class="ti ti-download" aria-hidden="true"></i>
                        Stáhnout TXT
                    </button>
                </section>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-dismiss="modal">Zavřít</button>
            </div>
        </div>
    </div>
</div>

<div class="modal fade" id="modal_poznamka" tabindex="-1" role="dialog" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered" role="document">

        <div class="modal-content">

            <div class="modal-header">
                <h5 class="modal-title" id="modal_poznamka_title">
                    Poznámka
                </h5>

                <button type="button"
                        class="close"
                        data-dismiss="modal"
                        aria-label="Zavřít">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>

            <div class="modal-body">

                <div class="modal-ctx mb-3" id="modal_poznamka_info">
                    Čas:
                </div>

                <div id="modal_poznamka_cas_controls" class="mb-3">
                    <button type="button"
                            class="btn btn-secondary btn-sm"
                            id="modal_poznamka_aktualizovat">
                        Aktualizovat
                    </button>

                    <button type="button"
                            class="btn btn-secondary btn-sm"
                            id="modal_poznamka_zpet">
                        Zpět o 5 sekund
                    </button>
                </div>

                <textarea
                    id="modal_poznamka_text"
                    class="form-control"
                    rows="5"></textarea>

                <div id="modal_poznamka_confirm"
                     class="mt-3"
                     style="display:none;">
                    Opravdu chcete tuto poznámku smazat?
                </div>

            </div>

            <div class="modal-footer">

                <button type="button"
                        class="btn btn-secondary"
                        data-dismiss="modal">
                    Zrušit
                </button>

                <button type="button"
                        class="btn btn-primary"
                        id="modal_poznamka_ok">
                    Uložit
                </button>

                <button type="button"
                        class="btn btn-primary"
                        id="modal_poznamka_pridat_a_vratit"
                        style="display:none;">
                    Přidat a vrátit
                </button>

            </div>

        </div>

    </div>
</div>
