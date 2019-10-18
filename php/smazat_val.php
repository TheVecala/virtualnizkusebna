<?php session_start(); ?>
<?php
 // $target_dir = ($_POST["soubor_ke_smazani"]);
$target_dir =  "../" .($_POST["val_ke_smazani"]);
$adresa_pro_navrat =    ($_POST["navrat"]);
  
if (is_dir($target_dir)) {
    
	// vyřesit soubory
	
	// smazat diskusi
	
	rmdir($target_dir);
}
 
   else {
    
        $_SESSION['vysledek'] = " chyba - vál nebyl smazán ";
    };
  require "navrat.php";
?>
 
