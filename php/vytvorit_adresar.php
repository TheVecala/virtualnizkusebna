<?php session_start();  ?>
<?php require "remove_accents.php";	?>
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

          $cely_jmeno_adresare = $_POST["jmeno_adresare"];
          $ocesany_jmeno_adresare = remove_accents( $_POST["jmeno_adresare"]);
		  
          if (mkdir($cil_adresare.($ocesany_jmeno_adresare))) {
             	$_SESSION['vysledek'] = "adresar_vytvoren"; 
               $_SESSION['slozka_souboru_k_zobrazeni'] = ($ocesany_jmeno_adresare);
			   
			   mkdir($cil_adresare.($ocesany_jmeno_adresare)."/texty");
			   $vzor_akordu = ("../data/akordy.txt");
				$cil_akordu = ($cil_adresare.($ocesany_jmeno_adresare)."/texty"."/akordy.txt");
			   echo copy($vzor_akordu,$cil_akordu);
			   
			   mkdir($cil_adresare.($ocesany_jmeno_adresare)."/data");	

			    
				if (true) {
				$soubor = $cil_adresare.($ocesany_jmeno_adresare)."/data/nazev_valu.txt";
				$file = fopen($soubor, "w") or die("nasrat!"); 
				fwrite($file, $cely_jmeno_adresare); 
				fclose($file);
				 	
				}
			   
			   
			   
			   
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
 
