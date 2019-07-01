<!doctype html>
<html lang="cz">
  <head> 
    <meta charset="utf-8">
    
	 
  </head>
   <body>
<?php
 session_start();
mysql_connect("localhost", "hanakdusan", "serepes6");
mysql_select_db("18810_virtualni_zkusebna");
mysql_set_charset("utf8"); 

// vytvoření komentaře sloučením textu a odkazů z formuláře

 //   $komentar= '<p>'.$_POST["vzkaz"].'</p>'.'<a href=" '. $_POST["odkaz"] . '">'.  $_POST["odkaz"].' </a> ' ;
 
   $komentar= '<p>žlutý kůň </p>  ' ;


// uložení do databaze 

  if(isset($_SESSION['diskuse']))
	   {   $aktualni_diskuse =$_SESSION['diskuse'];
    } else { $aktualni_diskuse=  "diskuse_kapela1" ; } ; 
	
  $vysledek=mysql_query("insert into $aktualni_diskuse (cas, vzkaz, jmeno) values (".time().",'". $komentar."','".$_POST["jmeno"]."')");
  
//  odeslani na maily 
  // $maily=mysql_query("select mail from maily_carvadele /*order by cas desc*/") ;
 
  // while ($adresa=MySQL_Fetch_Array($maily))
  // {
   
   // $textmailu="".$_POST["jmeno"]." napsal do diskuse:  
   // ".$_POST["vzkaz"]."
   // /bohuzel se prozatim v techto automatickych mailech zobrazuje spatne diakritika/
   // /spravne zneni primo na diskuzi - www.carvadele.cz/zkusebna";
   
   
// mail($adresa["mail"], "novy prispevek v diskuzi Carvadele",$textmailu,"From:automat_z_diskuse@carvadele.cz");

  // }

?>

 </body>
</html>