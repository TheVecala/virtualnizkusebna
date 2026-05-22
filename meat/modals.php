<style>
/* ── Jednotný styl všech modalů ── */
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
.modal-header h4,
.modal-header p.modal-title {
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
.modal-body  { padding: 14px 16px; background: #2e3338; }
.modal-footer {
  border-top: 1px solid #4a4e55;
  padding: 10px 16px;
  background: #383d43;
  border-radius: 0 0 8px 8px;
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

/* Panel historie */
#panel-historie { background: #252a2e; border-top: 1px solid #4a4e55; padding: 10px 16px; }
#panel-historie .btn-zaloha {
  background: #2a3a10; border: 1px solid var(--barva);
  color: var(--barva); border-radius: 4px;
  padding: 2px 8px; font-size: 11px; cursor: pointer;
}
#panel-historie .btn-zaloha:hover { background: #3a4a15; }
</style>

	<!-- The Modal INFO-->
<div class="modal modal-centered " id="myModal">
  <div class="modal-dialog">
    <div class="modal-content">

      <!-- Modal Header -->
      <div class="modal-header">
        <h4 class="modal-title">A B O U T</h4>
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->
      <div class="modal-body">
	      <p>
        DIY projekt ze Štatlu. <br><br>
		Plugin pro sdílení informací o rozpracovaných skladbách <br> hudební skupiny  mezi jejímy členy. <br>   <br>
		Tohle není prostor pro volné ukládání dat většího množství uživatelů. 
		Vhodná je instalace na vlastní doménu pro plnou kontrolu nad obsahem.
		<br> <br><br>
		Pro více info pište na adresu: <i>  the@vecala.cz  </i> 
	    
		</p>
		<p>
		Thanks to:<br>
		<a href="https://www.jakpsatweb.cz/">Jak psát web</a><br>
		wavesurfer.js<br>
	
		
          </p>
		  <button type="button" class="btn btn-secondary"  >INSTALACE NA VLASTNÍ DOMÉNĚ</button><br>
         
      </div>

      <!-- Modal footer -->
      <div class="modal-footer">
 
        <button type="button" class="btn btn-danger" data-dismiss="modal">ZAVŘÍT</button>
      </div>

    </div>
  </div>
</div>
	
	
  <!-- The Modal DELETE soubor-->
<div class="modal" id="modal_delete">
  <div class="modal-dialog  ">
    <div class="modal-content">

      <!-- Modal Header -->
      <div class="modal-header">
	      smazat soubor:
		
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->
	  
	 	<form action="/php/smazat_soubor.php" method="post" enctype="multipart/form-data"  style="display:inline">
	
             <div class="modal-body">
     		       
                     <p id="modal_delete_label" class="modal-title">  Soubor   </p>
					  <div class="form-group"  style="display:none">
						<label for="soubor_ke_smazani">smazat soubor:</label>
						<input id="modal_delete_deleter" type="text" class="form-control"  value="soubor ke smazání_nevložen " name="soubor_ke_smazani">
					  </div>				
										 							 
					  <div class="form-group"  style="display:none">
						<label for="navrat">navrat:</label>
						<input type="text" class="form-control" value="<?php echo $_SERVER['PHP_SELF'] ?>" name="navrat">
					  </div>
			  		
            </div>	  

      <!-- Modal footer -->
            <div class="modal-footer">
	  						 
				<button  id= "nahrat" type="submit" class="btn btn-danger">smazat</button>
 				<button type="button" class="btn btn-primary" data-dismiss="modal" style="display: inline">ZAVŘÍT</button>	 
	  
 
        
          </div>
	   </form>
    </div>
  </div>
</div>
 
 
 
   
  <!-- The Modal vlozit_soubor -->
<div class="modal" id="modal_vlozit_soubor">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <p class="modal-title">VLOŽENÍ SOUBORU</p>
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>
      <div class="modal-body">
        <p>Skladba: <strong><?php echo htmlspecialchars($slozka_souboru); ?></strong></p>
        <form id="form_upload">
          <div class="form-group">
            <label>Vybrat soubor:</label>
            <input type="file" class="form-control" id="upload_file"
              accept=".mp3,.wav,.ogg,.flac,.aac,.pdf,.txt,.jpg,.jpeg,.png,.gif">
          </div>
          <div class="checkbox" style="margin-bottom:10px">
            <label><input id="upload_odeslat" type="checkbox" value="true"> Odeslat info na mail</label>
          </div>

          <!-- Progress bar uploadu -->
          <div id="upload-progress-wrap" style="display:none; margin-bottom:10px;">
            <div style="background:#1e2226; border-radius:4px; height:6px; overflow:hidden;">
              <div id="upload-progress-bar" style="height:100%; width:0%; background:var(--barva); transition:width .1s;"></div>
            </div>
            <div id="upload-progress-text" style="font-size:11px; color:var(--muted); margin-top:4px; text-align:center;">0%</div>
          </div>
          <div id="upload-result" style="font-size:12px; margin-bottom:8px; display:none;"></div>

          <button type="submit" class="btn btn-primary" id="upload-btn">VLOŽIT SOUBOR</button>
          <button type="button" class="btn btn-secondary" data-dismiss="modal">ZAVŘÍT</button>
        </form>
      </div>
      <div class="modal-footer"></div>
    </div>
  </div>
</div>

 
 
   
  <!-- The Modal nova_slozka -->
<div class="modal" id="modal_nova_slozka">
  <div class="modal-dialog  ">
    <div class="modal-content">

      <!-- Modal Header -->
      <div class="modal-header">
        <p class="modal-title">VLOŽENÍ NOVÉ SLOŽKY</p>		
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->
      <div class="modal-body">
     
	   	      
								 
					  <form action="/php/vytvorit_adresar.php" method="post" enctype="multipart/form-data" style="display: inline">
					  
					    <div class="form-group">
                          <label for="jmeno_adresare">vytvořit novou složku:</label>
                          <input type="text" class="form-control" name="jmeno_adresare">  
                        </div>
                        <div class="form-group"  style="display:none">
                          <label for="sekce">sekce:</label>
                          <input type="text" class="form-control" name="sekce" value="<?php echo $sekce ; ?>" >  
                        </div>
                        <div class="form-group"  style="display:none">
                          <label for="navrat">navrat:</label>
                          <input type="text" class="form-control" name="navrat" value="<?php echo $_SERVER['PHP_SELF']; ?>" >  
                        </div>
						
						<button  id= "vytvorit_adresar" type="submit" class="btn btn-primary" >vytvořit</button>
					  </form>
					  <button type="button" class="btn btn-danger" data-dismiss="modal" style="display: inline">ZAVŘÍT</button>	   
			  
		
      </div>
      <!-- Modal footer -->
      <div class="modal-footer">
       
      </div>

    </div>
  </div>
</div> 
   
      
  <!-- The Modal vložit komentař -->
<div class="modal" id="modal_vlozit_komentar">
  <div class="modal-dialog  ">
   <div class="modal-content">

      <!-- Modal Header -->
      <div class="modal-header">
        <p class="modal-title">VLOŽENÍ POZNÁMKY</p>		
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->
      <div class="modal-body">
     	 
	 <!--<h1>Vložení komentáře</h1>-->
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

  <div id="komentar_chyba" style="color:red; display:none"></div>

  <button type="submit" class="btn btn-primary">ULOŽIT</button>
</form> 
	 
      </div>
      <!-- Modal footer -->
      <div class="modal-footer">       		
        <button type="button" class="btn btn-danger" data-dismiss="modal">ZAVŘÍT</button>
      </div>

    </div>
  </div>
</div> 
   
  
         
  <!-- The Modal  modal_skin -->
<div class="modal" id="modal_skin">
  <div class="modal-dialog  ">
   <div class="modal-content">

      <!-- Modal Header -->
      <div class="modal-header">
        <p class="modal-title">NASTAVENÍ</p>
		
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->
      <div class="modal-body">
      
	    <button  id="skin_default" type="button" class="btn btn-sm btn-secondary"  style=" display: inline"> rozbalit vše /desktop/</button>
	  	<button  id="skin_mini" type="button" class="btn btn-sm btn-secondary"  style=" display: inline"> sbalit vše /mobil/</button>

	<!--  <form id="form" name="form" method="post" action="php/zmenit_skin.php">
 
 <div class="form-check">
  <label class="form-check-label">
    <input type="radio" class="form-check-input" name="skin" value="skin1">DEFAULT
  </label>
</div>
<div class="form-check">
  <label class="form-check-label">
    <input type="radio" class="form-check-input "   name="skin" value="skin2">FUNKY
  </label>
</div>
<div class="form-check  ">
  <label class="form-check-label">
    <input type="radio" class="form-check-input "   name="skin" value="skin3">MINI
  </label>
</div> 

   <button  id= "odeslat" type="submit" class="btn btn-primary">NASTAVIT</button>
  
</form>  -->
	 
      </div>
      <!-- Modal footer -->
      <div class="modal-footer">   
	  
        <button type="button" class="btn btn-danger" data-dismiss="modal">ZAVŘÍT</button>
      </div>

    </div>
  </div>
</div> 
   
     
    <!-- The Modal DELETE vál -->
<div class="modal" id="modal_delete_val">
  <div class="modal-dialog">
    <div class="modal-content">

      <!-- Modal Header -->
      <div class="modal-header">
        <p id="modal_delete_val_label" class="modal-title">žádná skladba</p>
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->
      <div class="modal-body">

        <!-- Smazání válu -->
        <form action="/php/smazat_val.php" method="post" style="display:inline">
          <div class="form-group" style="display:none">
            <input id="modal_delete_val_deleter" type="text" class="form-control" value="" name="val_ke_smazani">
          </div>
          <div class="form-group" style="display:none">
            <input type="text" class="form-control" value="<?php echo $_SERVER['PHP_SELF'] ?>" name="navrat">
          </div>
          <button type="submit" class="btn btn-danger">odstranit celou skladbu</button>
          <p>Pozor! Smazat lze pouze prázdnou skladbu!</p>
        </form>

        <hr>

        <!-- Přejmenování válu -->
        <form action="/php/prejmenovat_val.php" method="post" style="display:inline">
          <div class="form-group" style="display:none">
            <input id="modal_rename_val_label" type="text" class="form-control" value=""
              name="puvodni_jmeno_valu_k_prejmenovani">
          </div>
          <div class="form-group">
            <label for="modal_rename_val_label_novy">nový název skladby:</label>
            <input id="modal_rename_val_label_novy" type="text" class="form-control" value=""
              name="nove_jmeno_valu_k_prejmenovani" placeholder="nový název">
          </div>
          <div class="form-group" style="display:none">
            <input type="text" class="form-control" value="<?php echo $_SERVER['PHP_SELF'] ?>" name="navrat">
          </div>
          <button type="submit" class="btn btn-warning">přejmenovat</button>
        </form>

      </div>

      <!-- Modal footer -->
      <div class="modal-footer">
        <button type="button" class="btn btn-primary" data-dismiss="modal">ZAVŘÍT</button>
      </div>

    </div>
  </div>
</div>
  
  
  <!-- The Modal presunout soubor-->
<div class="modal" id="modal_presunout">
  <div class="modal-dialog">
    <div class="modal-content">

      <!-- Modal Header -->
      <div class="modal-header">
        přesunout soubor
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->
      <form action="/php/presunout_soubor.php" method="post" enctype="multipart/form-data" style="display:inline">
        <div class="modal-body">

          <p id="modal_presunout_label" class="modal-title">Soubor</p>

          <div class="form-group" style="display:none">
            <input id="modal_presunout_co" type="text" class="form-control" value="" name="presunout_co">
          </div>

          <div class="form-group" style="display:none">
            <input id="modal_presunout_odkud" type="text" class="form-control" value="" name="presunout_odkud">
          </div>

          <div class="form-group">
            <label for="modal_presunout_kam">do složky:</label>
            <select class="form-control" id="modal_presunout_kam" name="presunout_kam">
              <option disabled>načítám...</option>
            </select>
          </div>

          <div class="form-group" style="display:none">
            <input type="text" class="form-control" value="<?php echo $_SERVER['PHP_SELF'] ?>" name="navrat">
          </div>

        </div>

        <!-- Modal footer -->
        <div class="modal-footer">
          <button type="submit" class="btn btn-primary">PŘESUNOUT</button>
          <button type="button" class="btn btn-danger" data-dismiss="modal">ZAVŘÍT</button>
        </div>
      </form>
    </div>
  </div>
</div>


    <!-- The Modal nahrat_zvuk -->
<div class="modal" id="modal_nahrat_zvuk">
  <div class="modal-dialog  ">
    <div class="modal-content">

      <!-- Modal Header -->
      <div class="modal-header">
            <p>RECORD</p>
		  <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->  
	  
             <div class="modal-body">
     	    	<div class="container text-center">
					 <p>Nahrávka se ukládá do dočasné paměti a je třeba ji manuálně uložit pomocí pravého tlačítka myši.</p>
					 <p>Je možno udělat více nahrávek, poté poslechnout a případně uložit.</p>
					 <p>Pozor! Znovunačtení stránky způsobí smazání neuložených nahrávek.</p>
					<button  id="record_button" class="btn btn-primary">ZAČÍT NAHRÁVAT</button> <!--  nahrávání   -->
					<ul id="playlist"></ul> <!--  cíl nahrávání   -->
               </div>		  		
            </div>	  

      <!-- Modal footer -->
            <div class="modal-footer">	 
 				<button type="button" class="btn btn-danger" data-dismiss="modal" style="display: inline">ZAVŘÍT</button>	         
            </div>
	  
    </div>
  </div>
</div>
  

    <!-- The Modal modal_zmenit_text -->
<div class="modal" id="modal_zmenit_text">
  <div class="modal-dialog  ">
    <div class="modal-content">

      <!-- Modal Header -->
      <div class="modal-header">
          <p id="modal_zmenit_text_label">UPRAVIT <?php echo htmlspecialchars($aktualni_text); ?></p>
          <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->
	     <form action="/php/vlozit_akordy.php" method="post" enctype="multipart/form-data" style="display:inline">
             <div class="modal-body">
     	    	<div class="container text-center">
                     <span class="vzkaz">
					   <div class="form-group" style="display:none">
						<input id="modal_soubor_akordu" type="text" class="form-control" value="<?php echo htmlspecialchars($aktualni_text); ?>" name="soubor_akordu">
					  </div>

					  <textarea id="editor" name="editor" style="overflow-x:auto; font-family:Courier,monospace; width:100%" rows="20"></textarea>

				     </span>
               </div>
                      <div class="form-group" style="display:none">
						<input type="text" class="form-control" value="<?php echo $_SERVER['PHP_SELF'] ?>" name="navrat">
					  </div>
            </div>

      <!-- Modal footer -->
            <div class="modal-footer">
 			   <p>Pozor! Přepíše původní text.</p>
				<button type="submit" class="btn btn-danger">uložit změny</button>
				<button type="button" class="btn btn-secondary" onclick="zobrazHistorii()">📋 historie</button>
 				<button type="button" class="btn btn-danger" data-dismiss="modal" style="display:inline">ZAVŘÍT</button>
            </div>
     </form>
     <!-- Panel historie -->
     <div id="panel-historie" style="display:none; padding:10px; border-top:1px solid #3a3e44; max-height:200px; overflow-y:auto;">
       <div style="font-size:11px;color:#888;margin-bottom:6px">Kliknutím na zálohu ji načteš do editoru. Uložením ji obnovíš.</div>
       <div id="seznam-zaloh"></div>
     </div>
	  
    </div>
  </div>
</div>  




<!-- ── ODHLÁŠENÍ ── -->
<div class="modal" id="modal_logout">
  <div class="modal-dialog modal-sm">
    <div class="modal-content" style="text-align:center">
      <div class="modal-header" style="justify-content:center; border-bottom:none; padding-bottom:0">
        <h5 class="modal-title">🎸</h5>
      </div>
      <div class="modal-body" style="padding: 10px 20px 20px">
        <p style="color:var(--text); font-size:14px; margin-bottom:16px">
          Opravdu chceš opustit zkušebnu?
        </p>
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
