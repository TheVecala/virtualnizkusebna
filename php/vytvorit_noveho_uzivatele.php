 
<?php
 session_start();
 include "login/connect.php";
 
   
   $new_login= $_POST["login"];
   $new_md5_heslo= $_POST["heslo"];
   $new_nazev_kapely= $_POST["nazev_kapely"];
   $new_email= $_POST["email"];
   $new_hashedkapela= $_POST["hashedkapela"];
   $new_adresa_diskuse= $_POST["adresa_diskuse"];
  
   
  // ověření neexistence stejného uživatele - viz vytvoření zkušebny 
	

  if(isset(  ))
	   {   $aktualni_kapela =$_SESSION['diskuse'];
    } else { $aktualni_kapela=  "diskuse_kapela1" ; } ; 
	
	
// vložení do databaze 	
// $vysledek=mysql_query("insert into $aktualni_diskuse (cas, vzkaz, jmeno) values (".time().",'". $komentar."','".$_POST["name"]."')");
 
   $vysledek=mysql_query("insert into $uzivatele_multi values ('','$new_login','$new_md5_heslo','$new_nazev_kapely','$new_email','$new_hashedkapela','$new_adresa_diskuse')");
    
  require "navrat.php";
?>
 