 
<?php
 session_start();
 include "login/connect.php";
 
// vytvoření komentaře sloučením textu a odkazů z formuláře

   $komentar= '<p>'.$_POST["text"].'</p>'.'<a href=" '. $_POST["odkaz"] . '">'.  $_POST["odkaz"].' </a> ' ;
 
// uložení do databaze 

  if(isset($_SESSION['diskuse']))
	   {   $aktualni_diskuse =$_SESSION['diskuse'];
    } else { $aktualni_diskuse=  "diskuse_kapela1" ; } ; 
	
  $vysledek=mysql_query("insert into $aktualni_diskuse (cas, vzkaz, jmeno) values (".time().",'". $komentar."','".$_POST["name"]."')");
  
header("Location:https://www.virtualnizkusebna.cz" .$adresa_pro_navrat  ); 
?>
 