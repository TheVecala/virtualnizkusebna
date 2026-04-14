	<!-- The Modal INFO-->
<div class="modal modal-centered " id="myModal">
  <div class="modal-dialog">
    <div class="modal-content  text-white" style="background-color:#<?php echo $_SESSION['barva1'] ?>">

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
		  <button type="button" class="btn btn-swcondary"  >INSTALACE NA VLASTNÍ DOMÉNĚ</button><br>
         
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
    <div class="modal-content  text-white" style="background-color:#<?php echo $_SESSION['barva1'] ?>">

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
<div class="modal " id="modal_vlozit_soubor">
  <div class="modal-dialog  ">
    <div class="modal-content  text-white" style="background-color:#<?php echo $_SESSION['barva1'] ?>">

      <!-- Modal Header -->
      <div class="modal-header">
        <p class="modal-title"> VLOŽENÍ SOUBORU </p>		
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->
      <div class="modal-body">
     
	   	   	<form action="/php/upload_uni.php" method="post" enctype="multipart/form-data"  style="display:inline">
			 
					<div class="form-group">
					   <label for="fileToUpload">Vybrat soubor:</label>
			    	   <input type="file" class="form-control" name="fileToUpload">
				    </div>				
					

				 
					  <div class="form-group"  style="display:none">
						<label for="navrat">navrat:</label>
						<input type="text" class="form-control" value="<?php echo $_SERVER['PHP_SELF'] ?>" name="navrat">
					  </div>
					
				 
					  <div class="form-group"  style="display:none">
						<label for="slozka_pro_vlozeni_souboru">navrat</label>
						<input type="text" class="form-control"  value="<?php echo $slozka_slozek.$slozka_souboru ?>" name="slozka_pro_vlozeni_souboru">
					  </div>					
					
					   
					    <div class="checkbox">
						  <label><input name="odeslat" type="checkbox" value="true">Odeslat info na mail</label>
						</div> 
					  
									 
					  <button  id= "nahrat" type="submit" class="btn btn-primary">VLOŽIT SOUBOR</button>
					
					
					
				</form>
				  <button type="button" class="btn btn-danger" data-dismiss="modal" style="display: inline">ZAVŘÍT</button>	   		
      </div>
      <!-- Modal footer -->
      <div class="modal-footer">
       
      </div>

    </div>
  </div>
</div> 
 
   
  <!-- The Modal nova_slozka -->
<div class="modal" id="modal_nova_slozka">
  <div class="modal-dialog  ">
    <div class="modal-content  text-white" style="background-color:#<?php echo $_SESSION['barva1'] ?>">

      <!-- Modal Header --><?php echo $_SESSION['barva1'] ?>
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
   <div class="modal-content  text-white" style="background-color:#<?php echo $_SESSION['barva1'] ?>">

      <!-- Modal Header -->
      <div class="modal-header">
        <p class="modal-title">VLOŽENÍ POZNÁMKY</p>		
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->
      <div class="modal-body">
     	 
	 <!--<h1>Vložení komentáře</h1>-->
	 <form id="form" name="form" method="post" action="php/vlozit_komentar.php">
 
 <div class="form-group">
    <label for="text">Text:</label>
    <textarea type="text" class="form-control" name="text"></textarea>
  </div>

  <div class="form-group">
    <label for="odkaz">Odkaz (pokud chceš):</label>
    <input type="text" class="form-control" name="odkaz">
  </div>
  
   <div class="form-group">
    <label for="odkaz2">youtube odkaz (pokud chceš):</label>
    <input type="text" class="form-control" name="odkaz2">
   </div>
  
  <div class="form-group">
    <label for="name">Jméno:</label>
    <input type="text" class="form-control" name="name">
  </div>
  
  <button  id= "odeslat" type="submit" class="btn btn-primary">ULOŽIT</button>
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
   <div class="modal-content  text-white" style="background-color:#<?php echo $_SESSION['barva1'] ?>">

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
  <div class="modal-dialog  ">
    <div class="modal-content  text-white" style="background-color:#<?php echo $_SESSION['barva1'] ?>">

      <!-- Modal Header -->
      <div class="modal-header">
            <p id="modal_delete_val_label" class="modal-title"> žádná skladba </p>       
		  <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->  
	  
      <div class="modal-body">	  
	  
	 	<form action="/php/smazat_val.php" method="post" enctype="multipart/form-data"  style="display:inline">
	     		         
					  <div class="form-group"  style="display:nonexxxx"> 
						<input id="modal_delete_val_deleter" type="text" class="form-control"  value="vál ke smazání_nevložen " name="val_ke_smazani">
					  </div>				
										 							 
					  <div class="form-group"  style="display:none"> 
						<input type="text" class="form-control" value="<?php echo $_SERVER['PHP_SELF'] ?>" name="navrat">
					  </div>		  		
				<button  id= "nahrat" type="submit" class="btn btn-danger">odstranit celou skladbu</button>
	            <p> Pozor! Smazat lze pouze prázdnou skladbu!   </p>
	    </form>
			 
	    <form action="/php/prejmenovat_val.php" method="post" enctype="multipart/form-data"  style="display:inline">
	
   			<div class="form-group"  style="display:nonexxxxxxxxxxxx"> 
			    <input id="modal_rename_val_renamer" type="text" class="form-control" value="<?php echo $slozka_slozek ?>" name="cesta_k_valu_k_prejmenovani">
		    </div>	
					  
   		    <div class="form-group"  style="display:nonexxxxxxxxxxxx"> 
				<input id="modal_rename_val_label" type="text" class="form-control" value="vál k prejmenovani_nevložen" 
				  name="puvodni_jmeno_valu_k_prejmenovani">
		    </div>					 
					 
  		    <div class="form-group"  style="display:nonexxxxxxxxxxxx"> 
				<input id="modal_rename_val_label_novy" type="text" class="form-control" value="vál k prejmenovani_nevložen"
     			  name="nove_jmeno_valu_k_prejmenovani">
		    </div>					 
					 
					  <div class="form-group"  style="display:none"> 
						<input type="text" class="form-control" value="<?php echo $_SERVER['PHP_SELF'] ?>" name="navrat">
					  </div>		  		
				<button  id= "nahrat" type="submit" class="btn btn-danger">přejmenovat</button> 
	    </form>
		 
			 
				

      </div>
		<!-- Modal footer -->
            <div class="modal-footer">	 

 				<button type="button" class="btn btn-primary" data-dismiss="modal" style="display: inline">ZAVŘÍT</button>	         
            </div>
	  
    </div>
  </div>
</div>
  
  
  <!-- The Modal presunout soubor-->
<div class="modal" id="modal_presunout">
  <div class="modal-dialog">
    <div class="modal-content text-white" style="background-color:#<?php echo $_SESSION['barva1'] ?>">

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
            <?php
            for($x = 0; $x < $delka_pole_slozek; $x++) {
                if ($pole_slozek[$x] == ".")  { continue; }
                if ($pole_slozek[$x] == "..")  { continue; }
                $soub = ($slozka_slozek.$pole_slozek[$x]);
                if(is_dir($soub)) {
                    $selected = ($pole_slozek[$x] == $slozka_souboru) ? ' selected' : '';
                    echo "<option".$selected.">".htmlspecialchars($pole_slozek[$x])."</option>";
                }
            }
            ?>
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
    <div class="modal-content  text-white" style="background-color:#<?php echo $_SESSION['barva1'] ?>">

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
    <div class="modal-content  text-white" style="background-color:#<?php echo $_SESSION['barva1'] ?>">

      <!-- Modal Header -->
      <div class="modal-header">
	  					     <?php     
						 $aktualni_text_s_cestou = $slozka_slozek.$slozka_souboru."/texty/".$aktualni_text;
                      	 $akordy = fopen($aktualni_text_s_cestou, "r") or die("SOUBOR S TEXTEM NEEXISTUJE!");
	                     echo "<p>UPRAVIT ".$aktualni_text. " ze složky ".$slozka_souboru."</p>";
						 ?>
           
		  <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->  
	     <form action="/php/vlozit_akordy.php" method="post" enctype="multipart/form-data"  style="display:inline">
             <div class="modal-body">
     	    	<div class="container text-center"> 
				
                     <span class="vzkaz" > 

					   <div class="form-group"  style="display:none">
						<label for="soubor_akordu">uložit do:</label>
						<input id="" type="text" class="form-control"  value="<?php echo $aktualni_text_s_cestou ; ?>" name="soubor_akordu">
					  </div>
					  
						 
					     <textarea id="editor" name="editor" style="overflow-x: auto; font-family: Courier, monospace; width:100%"  rows="20"  ><?php  // pozor na mezery
	    
						while(!feof($akordy)) {
						  echo fgets($akordy);
						};
						fclose($akordy);   // pozor na mezery
						 ?></textarea>
						 
				     </span>					 
				 
               </div>	


                      <div class="form-group"  style="display:none">
						<label for="navrat">navrat:</label>
						<input type="text" class="form-control" value="<?php echo $_SERVER['PHP_SELF'] ?>" name="navrat">
					  </div>			   
            </div>	  

      <!-- Modal footer -->
            <div class="modal-footer">	 
 			   <p  > Pozor! Přepíše původní text.</p>
				<button  id= "" type="submit" class="btn btn-danger">uložit změny</button>
 				<button type="button" class="btn btn-danger" data-dismiss="modal" style="display: inline">ZAVŘÍT</button>	        
            </div>
     </form>
	  
    </div>
  </div>
</div>  


