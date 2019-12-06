<?php session_start(); ?>
<?php
 // $target_dir = ($_POST["soubor_ke_smazani"]);
 
  $start_souboru =  "../" .($_POST["presunout_odkud"]);
 // $presunout_odkud =  $_POST["presunout_odkud"];
  $presunout_cesta =  $_POST["presunout_cesta"];
  $presunout_co =  $_POST["presunout_co"];
  $presunout_kam =  $_POST["presunout_kam"]; 
  $cil_souboru = $presunout_cesta.$presunout_kam."/".$presunout_co ;


$adresa_pro_navrat =    ($_POST["navrat"]);
  
  	rename($start_souboru,$cil_souboru);;
  
if (file_exists($soubor_k_presunuti)) {
    
	
	
	// unlink($target_file);
	// rename odkud kam
	// rename($soubor_k_presunuti,$cil_souboru);
	
}
 
   else {
    
        $_SESSION['vysledek'] = " chyba - soubor nebyl přesunut ";
    };
  require "navrat.php";
?>
 
