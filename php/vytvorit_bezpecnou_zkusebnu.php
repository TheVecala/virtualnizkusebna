<?php session_start();  ?>
<?php
$koren = "../user/";
$target_dir = ($_POST["jmeno_adresare"]);
$nahoda = "/befelemepesseveze";
// $nahoda = "/" +  mt_rand();
$adresa_pro_navrat = ($_POST["navrat"]);   
$databaze = true;
 
if   ( $databaze )      // vytvoření složek kapely
     { 
		if(isset($_POST["jmeno_zkusebny"])) 
			{   if (mkdir($koren.($_POST["jmeno_zkusebny"])))									
					{ 
			    	
					    if (mkdir($koren.($_POST["jmeno_zkusebny"]).$nahoda  )) 
                           {   
							if (mkdir($koren.($_POST["jmeno_zkusebny"]).$nahoda."/uploads/" ))
									{   if (mkdir($koren.($_POST["jmeno_zkusebny"]).$nahoda."/uploads/".$target_dir))
										 {	$_SESSION['vysledek'] = "vytvořeno"; 
											$_SESSION['slozka_souboru_k_zobrazeni'] = ($_POST["jmeno_adresare"]);
											$_SESSION['kapela'] = ($_POST["jmeno_zkusebny"]);
											$_SESSION['login'] = ($_POST["jmeno_zkusebny"]);
											
										  // copy("../test/index.php","../".$adresa_pro_navrat."/index.php");
							 
										 } else  
										 { $_SESSION['vysledek'] = "chyba - složka nebyla vytvořena"; 
											 $_SESSION['slozka_souboru_k_zobrazeni'] =  "./";
										 }
									
									} else  
									{	 
									} 
							 
					    	} else  
					        { $_SESSION['vysledek'] = "chyba - nahodna složka   nebyla vytvořena"; 
					   	      $_SESSION['slozka_souboru_k_zobrazeni'] =  "./";
					         session_destroy(); 
					        }	 
							 
					 
			        } else  
				    { $_SESSION['vysledek'] = "chyba - složka uploads nebyla vytvořena"; 
					 	 $_SESSION['slozka_souboru_k_zobrazeni'] =  "./";
						 session_destroy(); 
				    }
		    } else  
		    { $_SESSION['vysledek'] = "chyba - složka zkušebny nebyla vytvořena x"; 
			 	  $_SESSION['slozka_souboru_k_zobrazeni'] =  "./";
		    }
	  
      } else  
	  { $_SESSION['vysledek'] = "chyba - registrace kapely nebyla vytvořena"; 
		  $_SESSION['slozka_souboru_k_zobrazeni'] =  "./";
	  };
	 
  // sem vložit vytvoření hesla
  ?>
 
  <?php
include "login/connect.php"; // přidat ověření nebo require
if( $_SESSION['vysledek'] == "vytvořeno"  ) //vložení nové kapely do databáze
    {
    $nick = mysql_real_escape_string($_POST['nick']);
    $heslo = mysql_real_escape_string($_POST['heslo']);
    $over_heslo = mysql_real_escape_string($_POST['over_heslo']);
    $md5_heslo = md5($heslo);
    $email = mysql_real_escape_string($_POST['email']);
    $adresa_diskuse = 'diskuse_'. mysql_real_escape_string($_POST['nick']).'_123456789';
  
    $user_check = mysql_query("SELECT login FROM uzivatele WHERE login='".$nick."'");
    if($nick==""){echo"Nebyl vyplněn nick!";}
       else if(mysql_num_rows($user_check)){echo"Tento nick používá již jiný uživatel.";}
		   else if($heslo==""){echo"Nebylo vyplněno heslo";}
		      else if($over_heslo==""){echo"Nebylo vyplněno ověřovací heslo";}
		         else if($heslo!=$over_heslo){echo"Vyplněná hesla se neshodují";}
		            else if($email==""){echo"Nebyl vyplněn email";}
                       else{
							$sql= mysql_query("INSERT INTO uzivatele VALUES ('','$nick','$md5_heslo','','$email','','$adresa_diskuse')") or die(mysql_error());
							echo"Registrace byla úspěšně dokončena!";
							$_SESSION['vysledek'] = "Registrace učtu byla úspěšně dokončena!"; 
						   }
    }
	else
	{
	$_SESSION['vysledek'] = "Registrace učtu nebyla dokončena!"; 	
	};
 
if( $_SESSION['vysledek'] == "Registrace učtu byla úspěšně dokončena!"  ) 
    {	
    // vytvoření tabulky diskuse kapely
	$cas= time();
	$jmeno= "admin";
	$vzkaz= "Sem je možno vkládat odkazy na vály, názory a jiný věci";
 
    mysql_query("CREATE TABLE $adresa_diskuse (
	cas INT(11) NOT NULL,
	vzkaz text NOT NULL,
	jmeno VARCHAR(50) NOT NULL
	)");
	  
	//vložení do tabulky diskuse kapely
    $vysledek=mysql_query("insert into $adresa_diskuse (cas, vzkaz, jmeno) values ('$cas', '$vzkaz', '$jmeno')");
	// přidat podmínku			
	$_SESSION['vysledek'] = "vytvoření tabulek bylo úspěšně dokončeno!"; 
	$_SESSION['diskuse'] = $adresa_diskuse ;
		
    } else  
    {
	$_SESSION['vysledek'] = "chyba - vytvoření tabulek nebyla vytvořena"; 
    $_SESSION['slozka_souboru_k_zobrazeni'] =  "./";
	};
 

  //vytvoření tabulky playlistu
// $adresa_playlistu=  "playlist_kapela1" ;
 $adresa_playlistu=  "playlist_".($_POST["jmeno_zkusebny"]);
 
   mysql_query("CREATE TABLE $adresa_playlistu (
cas INT(11) NOT NULL,
poradi VARCHAR(50) NOT NULL,
nazev_valu text NOT NULL,
bpm VARCHAR(50) NOT NULL,
klic VARCHAR(50) NOT NULL,
adresa_diskuse VARCHAR(50) NOT NULL,
data1 VARCHAR(50) NOT NULL,
data2 VARCHAR(50) NOT NULL,
data3 VARCHAR(50) NOT NULL
)");
   
  // if vytvoření učtu and vytvoření adresáře and vytvoření tabulek then návrat 
  // if chyba then smazat vytvořené a návrat 
 
  
    
header("Location:https://virtualnizkusebna.cz" .$adresa_pro_navrat  ); 
 
?>