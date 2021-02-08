 
<?php
 session_start();
 include "login/connect.php";
 
   
      $new_login= $_POST["login"];
      $new_md5_heslo= $_POST["heslo"];
   $new_nazev_kapely= "silentroom";
      $new_email= $_POST["email"];
   $new_hashedkapela= "338786519";
   $new_adresa_diskuse= "diskuse_silentroom_123456789";
  
  
  
   
     
  
   
  // ověření neexistence stejného uživatele - viz vytvoření zkušebny 
	
 
// vložení do databaze 	
// $vysledek=mysql_query("insert into $aktualni_diskuse (cas, vzkaz, jmeno) values (".time().",'". $komentar."','".$_POST["name"]."')");
 
   $vysledek=mysql_query("INSERT INTO uzivatele_multi VALUES ('','$new_login','$new_md5_heslo','$new_nazev_kapely','$new_email','$new_hashedkapela','$new_adresa_diskuse')");
   
 // require "navrat.php";
?>
 