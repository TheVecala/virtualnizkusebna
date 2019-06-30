<?php session_start();  ?>
<?php
//$kapela = "../test/";
 $kapela = $_SESSION['kapela'] ;
 $sekce = ($_POST["sekce"]); 
$cil_adresare = "../user/".$kapela."/".$sekce ."/";
$adresa_pro_navrat = ($_POST["navrat"]);  
 

if(isset($_POST["jmeno_adresare"])) { 
  
          if (mkdir($cil_adresare.($_POST["jmeno_adresare"]))) {
             	$_SESSION['vysledek'] = "vytvořeno"; 
               $_SESSION['slozka_souboru_k_zobrazeni'] = ($_POST["jmeno_adresare"]);
         } else {
              $_SESSION['vysledek'] = "chyba - složku se napodařilo vytvořit"; 
          }
 }
 else  { $_SESSION['vysledek'] = "chyba - chybí jméno složky";
 }
 
header("Location:https://www.virtualnizkusebna.cz" .$adresa_pro_navrat  ); 
?>
 
