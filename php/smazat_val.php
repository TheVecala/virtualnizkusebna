<?php session_start(); ?>
<?php
 
$target_dir =  "../" .($_POST["val_ke_smazani"]);
$adresa_pro_navrat =    ($_POST["navrat"]);
  
if (is_dir($target_dir)) {
    
	// vyřesit soubory
	unlink($target_dir."/texty/akordy.txt");
	rmdir($target_dir."/texty");
	unlink($target_dir."/data/nazev_valu.txt");
	rmdir($target_dir."/data");
	
	// smazat diskusi
	
	
	rmdir($target_dir);
	//přepnout na jinej vál
	if ($_SESSION['slozka_souboru_k_zobrazeni'] = $_POST["val_ke_smazani"]) 	
	{      $_SESSION['slozka_souboru_k_zobrazeni'] = "slozka_smazana";
	};
 
	
}
 
   else {
    
        $_SESSION['vysledek'] = " chyba - vál nebyl smazán ";
    };
  require "navrat.php";
?>
 
