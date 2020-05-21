<?php session_start(); ?>
<?php

$soubor =  "../".($_POST["soubor_akordu"]); 
$akordy =  ($_POST["editor"]);
$adresa_pro_navrat =    ($_POST["navrat"]);
  
if (true) {
    
$myfile = fopen($soubor, "w") or die("nasrat!"); 
fwrite($myfile, $akordy); 
fclose($myfile);
 
	
}
 
   else {
    
        $_SESSION['vysledek'] = " chyba - akordy nebyly vloženy ";
    };
  require "navrat.php";
?>
 
