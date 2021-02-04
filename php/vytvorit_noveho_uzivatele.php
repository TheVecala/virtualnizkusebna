 
<?php
 session_start();
 include "login/connect.php";
 
   
   $novy_uzivatel= $_POST["login"];
   $novy_uzivatel= $_POST["heslo"];
   $novy_uzivatel= $_POST["nazev_kapely"];
   $novy_uzivatel= $_POST["email"];
   $novy_uzivatel= $_POST["hashedkapela"];
   $novy_uzivatel= $_POST["adresa_diskuse"];
  
   
  // ověření neexistence stejného uživatele - viz vytvoření zkušebny 
	
// vložení do databaze 

  if(isset(  ))
	   {   $aktualni_kapela =$_SESSION['diskuse'];
    } else { $aktualni_kapela=  "diskuse_kapela1" ; } ; 
	
// $vysledek=mysql_query("insert into $aktualni_diskuse (cas, vzkaz, jmeno) values (".time().",'". $komentar."','".$_POST["name"]."')");
 
   $vysledek=mysql_query("insert into $aktualni_kapela (user, admin, jmeno) values (".$_POST["user"].",'". $komentar."','".$_POST["name"]."')");
    
  require "navrat.php";
?>
 