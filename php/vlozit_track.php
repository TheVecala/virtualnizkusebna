<?php session_start();  ?>
<?php
 
 require "login/connect.php";
 
// $target_dir = ($_POST["jmeno_adresare"]);
// $nahoda = "befelemepesseveze";
$adresa_pro_navrat = ($_POST["navrat"]); 
 //$adresa_playlistu=  "playlist_test_123" ;
$adresa_playlistu=  "playlist_".($_POST["kapela"]); ;

$cas= time();
$poradi= 1;
$nazev_valu= ($_POST["nazev_tracku"]); 
$bpm=  ($_POST["bpm"]);
$klic=  "E" ;
$adresa_diskuse=  "adresa" ;
$data1=  "---" ;
$data2=  "---" ;
$data3=  "---" ;
 

 //vložení do tabulky válů 
 
if  (  
  $vysledek=mysql_query("insert into $adresa_playlistu (cas, poradi, nazev_valu, bpm, klic, adresa_diskuse, data1, data2, data3) 
                                              values ('$cas', '$poradi', '$nazev_valu', '$bpm', '$klic', '$adresa_diskuse', '$data1', '$data2', '$data3')")
 )      
                    { 
 	
		$_SESSION['vysledek'] = "vložení válu bylo úspěšně dokončeno!"; 
	 
	
  } else  
	    { $_SESSION['vysledek'] = "chyba - nebyl vložen vál"; 
		 
									   };
     
  require "navrat.php";
 
?> 
 