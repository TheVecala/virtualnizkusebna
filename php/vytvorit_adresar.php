<?php session_start();  ?>
<?php
//$kapela = "../test/";
 $kapela = $_SESSION['kapela'] ;
 $sekce = ($_POST["sekce"]); 
 if(isset($_SESSION['befelemepesseveze']))
	   {   $befelemepesseveze =$_SESSION['befelemepesseveze'];
    } else { $befelemepesseveze=  "befelemepesseveze" ; } ; 
 
// $cil_adresare = "../user/".$kapela."/befelemepesseveze/".$sekce ."/";
   $cil_adresare = "../user/".$kapela."/".$befelemepesseveze."/".$sekce ."/";
$adresa_pro_navrat = ($_POST["navrat"]);  
 

if(isset($_POST["jmeno_adresare"])) { 
  
          if (mkdir($cil_adresare.($_POST["jmeno_adresare"]))) {
             	$_SESSION['vysledek'] = "adresar_vytvoren"; 
               $_SESSION['slozka_souboru_k_zobrazeni'] = ($_POST["jmeno_adresare"]);
			   mkdir($cil_adresare.($_POST["jmeno_adresare"])."/texty");
          } 
		  else {
              $_SESSION['vysledek'] = "chyba - složku se napodařilo vytvořit"; 
          }
		    
		  			   
			   // vytvořění diskuse pro vál
			   
 








		
 }
 else  { $_SESSION['vysledek'] = "chyba - chybí jméno složky";
 }
 
  require "navrat.php"; 
?>
 
