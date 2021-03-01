<?php session_start();  ?>
<?php
$koren = "../user/";
$target_dir = ($_POST["jmeno_adresare"]);
// $nahoda = "befelemepesseveze";
$nahoda = mt_rand();
$adresa_pro_navrat = ($_POST["navrat"]);   
$databaze = true;
 
if   ( $databaze )      // vytvoření složek kapely
    { 
	 if(isset($_POST["kapela"])) 
		{if (mkdir($koren.($_POST["kapela"])))									
			{if (mkdir($koren.($_POST["kapela"])."/".$nahoda  )) 
                {if (mkdir($koren.($_POST["kapela"])."/".$nahoda."/uploads/" ))
					{if (mkdir($koren.($_POST["kapela"])."/".$nahoda."/uploads/".$target_dir))
						{if (mkdir($koren.($_POST["kapela"])."/".$nahoda."/uploads/".$target_dir."/data"))
                            {if (mkdir($koren.($_POST["kapela"])."/".$nahoda."/uploads/".$target_dir."/texty"))
                                {
									
									 $vzor_akordu = ("../data/akordy.txt");
				                     $cil_akordu = ($koren.($_POST["kapela"])."/".$nahoda."/uploads/".$target_dir."/texty"."/akordy.txt");
		                        	 echo copy($vzor_akordu,$cil_akordu);
									
									// vložení nazvu
												if (true) {
												$soubor = $koren.($_POST["kapela"])."/".$nahoda."/uploads/".$target_dir."/data/nazev_valu.txt";
												$file = fopen($soubor, "w") or die("nasrat!"); 
												fwrite($file, $target_dir); 
												fclose($file);
													
												}
												
								        $_SESSION['vysledek'] = "vytvořeno"; 
										$_SESSION['slozka_souboru_k_zobrazeni'] = ($_POST["jmeno_adresare"]);
										$_SESSION['kapela'] = ($_POST["kapela"]);
										$_SESSION['login'] = ($_POST["nick"]);
										
								} else  
							    { $_SESSION['vysledek'] = "chyba - složka texty nebyla vytvořena"; 
							      $_SESSION['slozka_souboru_k_zobrazeni'] =  "./";
							    }		
							} else  
							{ $_SESSION['vysledek'] = "chyba - složka data nebyla vytvořena"; 
							  $_SESSION['slozka_souboru_k_zobrazeni'] =  "./";
							}

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
    $kapela = mysql_real_escape_string($_POST['kapela']);
    $heslo = mysql_real_escape_string($_POST['heslo']);
    $over_heslo = mysql_real_escape_string($_POST['over_heslo']);
    $md5_heslo = md5($heslo);
    $email = mysql_real_escape_string($_POST['email']);
    $adresa_diskuse = 'diskuse_'. mysql_real_escape_string($_POST['kapela']).'_123456789'; 
    $adresa_info = 'info_'. mysql_real_escape_string($_POST['nick']); 
   
	
    $user_check = mysql_query("SELECT login FROM uzivatele_multi WHERE login='".$nick."'");
    if($nick==""){echo"Nebyl vyplněn nick!";}
       else if(mysql_num_rows($user_check)){echo"Tento nick používá již jiný uživatel.";}
		   else if($heslo==""){echo"Nebylo vyplněno heslo";}
		      else if($over_heslo==""){echo"Nebylo vyplněno ověřovací heslo";}
		         else if($heslo!=$over_heslo){echo"Vyplněná hesla se neshodují";}
		            else if($email==""){echo"Nebyl vyplněn email";}
                       else{
							$sql= mysql_query("INSERT INTO uzivatele_multi VALUES ('','$nick','$md5_heslo','$kapela','$email','$nahoda','$adresa_diskuse','$adresa_info')") or die(mysql_error());
	 									
							
													
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
	$vzkaz= "Sem je možno vkládat nápady, odkazy, názory a jiný věci";
 
    mysql_query("CREATE TABLE $adresa_diskuse (
	cas INT(11) NOT NULL,
	vzkaz text NOT NULL,
	jmeno VARCHAR(50) NOT NULL
	)");
	  
	//vložení do tabulky diskuse kapely
    $vysledek_dotazu=mysql_query("insert into $adresa_diskuse (cas, vzkaz, jmeno) values ('$cas', '$vzkaz', '$jmeno')");
	// přidat podmínku			
	$_SESSION['vysledek'] = "vytvoření tabulek bylo úspěšně dokončeno!"; 
	$_SESSION['diskuse'] = $adresa_diskuse ;
		
	// vytvoření tabulky INFO   
 
	$nazev_tabulky= $adresa_info;
	$status= "admin";
	$style= "classic";
	$rezerva= "nic";
 
    mysql_query("CREATE TABLE $nazev_tabulky (
	vlastnost VARCHAR(50) NOT NULL,
	hodnota VARCHAR(50) NOT NULL 
	)");
	
    $vysledek_dotazu=mysql_query("INSERT INTO $nazev_tabulky  VALUES ('status','$status')");
	$vysledek_dotazu=mysql_query("INSERT INTO $nazev_tabulky  VALUES ('style','$style')");
   	
	
		
    } else  
    {
	$_SESSION['vysledek'] = "chyba - vytvoření tabulek nebyla vytvořena"; 
    $_SESSION['slozka_souboru_k_zobrazeni'] =  "./";
	};
 


  
  // if vytvoření učtu and vytvoření adresáře and vytvoření tabulek then návrat 
  // if chyba then smazat vytvořené a návrat 
 $_SESSION['befelemepesseveze'] = $nahoda ;
  
    
  require "navrat.php";
 
?>