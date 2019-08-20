<?php session_start();  ?>
<?php
 $_SESSION['slozka_souboru_k_zobrazeni'] = ($_POST["cilova_slozka"]);
$adresa_pro_navrat = ($_POST["navrat"]);  
$_SESSION['vysledek'] = "zmenena slozka"; 

 
  require "php/navrat.php";
  
  require "navrat.php";
?>
 