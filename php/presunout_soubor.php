<?php session_start(); ?>
<?php
 // $target_dir = ($_POST["soubor_ke_smazani"]);
$soubor_k_presunuti =  "../" .($_POST["soubor_k_presunuti"]);
$cil_souboru =  "../" .($_POST["cil_souboru"]);

$adresa_pro_navrat =    ($_POST["navrat"]);
  
if (file_exists($soubor_k_presunuti)) {
    
	
	
	// unlink($target_file);
	// rename odkud kam
	rename($soubor_k_presunuti,$cil_souboru);
	
}
 
   else {
    
        $_SESSION['vysledek'] = " chyba - soubor nebyl přesunut ";
    };
  require "navrat.php";
?>
 
