 
<?php
 session_start();
 include "login/connect.php";
 
// vytvoření komentaře sloučením textu a odkazů z formuláře

   $komentar= '<pre style="overflow-x: auto" >'.$_POST["text"].'</pre>'.'<a href="'. $_POST["odkaz"] . '">'.  $_POST["odkaz"].' </a> '. $_POST["odkaz2"];
 
// uložení do databaze 

//  if(isset($_SESSION['diskuse']))
//	   {   $aktualni_diskuse =$_SESSION['diskuse'];
 //   } else { $aktualni_diskuse=  "diskuse_kapela1" ; } ; 
	
	
 $aktualni_diskuse = 'diskuse_'.$_SESSION['kapela'].'_'.$_SESSION['slozka_souboru_k_zobrazeni'];	
	
	
  $vysledek=mysql_query("insert into $aktualni_diskuse (cas, vzkaz, jmeno) values (".time().",'". $komentar."','".$_POST["name"]."')");
  
  require "navrat.php";
?>
 