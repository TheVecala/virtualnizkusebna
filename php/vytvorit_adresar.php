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
	
	
			  if (   mkdir($cil_adresare.($ocesany_jmeno_adresare)."/texty") ) {
				   $vzor_akordu = ("../data/akordy.txt");
				   $cil_akordu = ($cil_adresare.($ocesany_jmeno_adresare)."/texty"."/akordy.txt");
				   echo copy($vzor_akordu,$cil_akordu);
				   
		
									    
					if (mkdir($cil_adresare.($ocesany_jmeno_adresare)."/data")) {
						$soubor = $cil_adresare.($ocesany_jmeno_adresare)."/data/nazev_valu.txt";
						$file = fopen($soubor, "w") or die("nasrat!"); 
						fwrite($file, $cely_jmeno_adresare); 
						fclose($file);
							
							  			   
			            // vytvořění diskuse pro vál
						include "login/connect.php"; 
							$cas= time();
							$jmeno= "admin";
							$vzkaz= "Sem je možno vkládat";
						    $adresa_diskuse_valu = 'diskuse_'.$kapela.'_'.$ocesany_jmeno_adresare.'';
							mysql_query("CREATE TABLE $adresa_diskuse_valu (
							cas INT(11) NOT NULL,
							vzkaz text NOT NULL,
							jmeno VARCHAR(50) NOT NULL
							)");
							  
							//vložení do tabulky diskuse válu
							$vysledek=mysql_query("insert into $adresa_diskuse_valu (cas, vzkaz, jmeno) values ('$cas', '$vzkaz', '$jmeno')");
							// přidat podmínku			
							$_SESSION['vysledek'] = "vytvoření diskuse pro vál bylo úspěšně dokončeno!"; 
												
							
					}
					else {
				       $_SESSION['vysledek'] = "chyba - slozka data not mejk"; 
			        }		
					
				   
			  } 
			  else {
				  $_SESSION['vysledek'] = "chyba - slozka texty not mejk"; 
			  }
				   
			   
          } 
		  else {
              $_SESSION['vysledek'] = "chyba - složku se napodařilo vytvořit"; 
          }
		    

		
 }
 else  { $_SESSION['vysledek'] = "chyba - chybí jméno složky";
 }
 
  require "navrat.php"; 
?>
 
