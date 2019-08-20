<?php session_start();  ?>
<?php
 $_SESSION['sekce_k_zobrazeni'] = ($_POST["cilova_sekce"]);
$adresa_pro_navrat = ($_POST["navrat"]);  
$_SESSION['vysledek'] = "zmenena sekce"; 

  
  require "navrat.php";
?>
 