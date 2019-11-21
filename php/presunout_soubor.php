<?php session_start(); ?>
<?php
 // $target_dir = ($_POST["soubor_ke_smazani"]);
 
  $soubor_k_presunuti =  "../" .($_POST["soubor_k_presunuti"]);
// $cil_souboru =  "../" .($_POST["cil_souboru"]);


 //$soubor_k_presunuti =  "../user/silentroom/338786519/uploads/jamming/jamming_refrenova_smycka_clear.mp3" ;
$cil_souboru =         "../user/silentroom/338786519/uploads/2_5_1/jamming_ra_clear_ren.mp3";


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
 
