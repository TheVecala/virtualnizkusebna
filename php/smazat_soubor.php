<?php session_start(); ?>
<?php
 // $target_dir = ($_POST["soubor_ke_smazani"]);
$target_file =  ($_POST["soubor_ke_smazani"]);
$adresa_pro_navrat =    ($_POST["navrat"]);
  
if (file_exists($target_file)) {
    
	unlink($target_file);
}
 
   else {
    
        $_SESSION['vysledek'] = " chyba - soubor nebyl smazán ";
    };
  require "navrat.php";
?>
 
