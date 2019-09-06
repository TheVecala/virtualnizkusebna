<?php session_start();  ?>


<?php



 $_SESSION['skin'] = ($_POST["skin"]);
 

 
$adresa_pro_navrat = ($_POST['navrat']);  
$_SESSION['vysledek'] = "změněn skin"; 



  require "navrat.php";
?>
 