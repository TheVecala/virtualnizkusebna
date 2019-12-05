<?php session_start(); ?>
<?php
 // $target_dir = ($_POST["soubor_ke_smazani"]);
 
  $soubor_k_presunuti =  "../" .($_POST["soubor_k_presunuti"]);
  $presunout_odkud =  $_POST["presunout_odkud"];
  $presunout_co =  $_POST["presunout_co"];
  $presunout_kam =  $_POST["presunout_kam"]; 
  $cil_souboru =         "../user/silentroom/338786519/uploads/".$presunout_kam."/".$presunout_co ;


$adresa_pro_navrat =    ($_POST["navrat"]);
  
  	rename($soubor_k_presunuti,$cil_souboru);;
  
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
 
