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
			   
          } 
		  else {
              $_SESSION['vysledek'] = "chyba - složku se napodařilo vytvořit"; 
          }
		    
		  			   
			   // vytvořění diskuse pro vál
			   
		
if( $_SESSION['vysledek'] == "adresar_vytvoren"  ) 
    
	{	
    // vytvoření tabulky diskuse válu
	$adresa_diskuse = 'diskuse_'.$kapela.'_'.$_POST["jmeno_adresare"].'_123456789';
	$cas= time();
	$jmeno= "admin";
	$vzkaz= "vlož text";
 
    mysql_query("CREATE TABLE $adresa_diskuse (
	cas INT(11) NOT NULL,
	vzkaz text NOT NULL,
	jmeno VARCHAR(50) NOT NULL
	)");
	  
	//vložení do tabulky diskuse válu
    $vysledek=mysql_query("insert into $adresa_diskuse (cas, vzkaz, jmeno) values ('$cas', '$vzkaz', '$jmeno')");
	// přidat podmínku			
	$_SESSION['vysledek'] = " diskuse válu vytvořena"; 
	$_SESSION['diskuse'] = $adresa_diskuse ;
	
    // vložení adresy diskuse do tabulky
	// ------------------------
	// ------------------------
	
    } else  
    {
	 
    
	};
 








		
 }
 else  { $_SESSION['vysledek'] = "chyba - chybí jméno složky";
 }
 
  require "navrat.php"; 
?>
 
