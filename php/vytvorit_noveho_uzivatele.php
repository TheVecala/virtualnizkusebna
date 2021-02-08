 
<?php
 session_start();
 include "login/connect.php";
 
   
   $new_login= $_POST["login"];
   $new_md5_heslo= $_POST["heslo"];
   $new_nazev_kapely= $_POST["nazev_kapely"];
   $new_email= $_POST["email"];
   $new_hashedkapela= $_POST["hashedkapela"];
   $new_adresa_diskuse= $_POST["adresa_diskuse"];
  
   $new_login= "test_login";
   $new_md5_heslo= "test_dfgdfgfdg";
   $new_nazev_kapely= "test_ddddd";
   $new_email= "test_dfgf";
   $new_hashedkapela= "testfffffff";
   $new_adresa_diskuse= "test_fgf";  
  
   
  // ověření neexistence stejného uživatele - viz vytvoření zkušebny 
	
 
// vložení do databaze 	
// $vysledek=mysql_query("insert into $aktualni_diskuse (cas, vzkaz, jmeno) values (".time().",'". $komentar."','".$_POST["name"]."')");
 
   $vysledek=mysql_query("INSERT INTO uzivatele_multi VALUES ('','$new_login','$new_md5_heslo','$new_nazev_kapely','$new_email','$new_hashedkapela','$new_adresa_diskuse')");
   
 // require "navrat.php";
?>
 