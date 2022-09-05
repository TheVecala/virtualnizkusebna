<?php session_start();  ?>
<?php
 $_SESSION['slozka_souboru_k_zobrazeni'] = ($_POST["cilova_slozka"]);
 
 
// $adresa_pro_navrat = ($_POST["navrat"]);  
   $adresa_pro_navrat = "/simple_text.php";  


$_SESSION['vysledek'] = "zmenena slozka"; 

 
 
  
  require "navrat.php";
?>
 