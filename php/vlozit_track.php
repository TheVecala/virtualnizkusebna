<?php session_start();  ?>
<?php
 
 require "login/connect.php";
 
 $target_dir = ($_POST["jmeno_adresare"]);
$nahoda = "befelemepesseveze";
$adresa_pro_navrat = ($_POST["navrat"]); 
$adresa_playlistu=  "playlist_kapela1" ;

$cas= time();
$poradi= 1;
$nazev_valu= ($_POST["nazev_tracku"]); 
$bpm=  ($_POST["bpm"]);
$klic=  "E" ;
$adresa_diskuse=  "adresa" ;
$data1=  "---" ;
$data2=  "---" ;
$data3=  "---" ;
 
 
  // vytvoření tabulky playlistu  
   // mysql_query("CREATE TABLE $adresa_playlistu (
// cas INT(11) NOT NULL,
// poradi VARCHAR(50) NOT NULL,
// nazev_valu text NOT NULL,
// bpm VARCHAR(50) NOT NULL,
// klic VARCHAR(50) NOT NULL,
// adresa_diskuse VARCHAR(50) NOT NULL,
// data1 VARCHAR(50) NOT NULL,
// data2 VARCHAR(50) NOT NULL,
// data3 VARCHAR(50) NOT NULL
// )");
  
 //vložení do tabulky válů funguje
 
if  (  
  $vysledek=mysql_query("insert into $adresa_playlistu (cas, poradi, nazev_valu, bpm, klic, adresa_diskuse, data1, data2, data3) 
                                              values ('$cas', '$poradi', '$nazev_valu', '$bpm', '$klic', '$adresa_diskuse', '$data1', '$data2', '$data3')")
 )      
                    { 
 	
		$_SESSION['vysledek'] = "vložení válu bylo úspěšně dokončeno!"; 
	 
	
  } else  
	    { $_SESSION['vysledek'] = "chyba - nebyl vložen vál"; 
		 
									   };
     
header("Location:https://virtualnizkusebna.cz" .$adresa_pro_navrat  ); 
 
?> 
 