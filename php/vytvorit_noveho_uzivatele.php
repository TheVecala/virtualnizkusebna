 
<?php
 session_start();
 include "login/connect.php";
 
   $new_login= $_POST["login"];   
   $new_heslo= $_POST["heslo"];  
   $new_md5_heslo= md5($new_heslo);;  
   $new_nazev_kapely= "silentroom";
   $new_email= $_POST["email"];
   $new_hashedkapela= "338786519";
   $new_adresa_diskuse= "diskuse_silentroom_123456789";
  
   
  // ověření neexistence stejného uživatele - viz vytvoření zkušebny 
	
 
// vložení do databaze 	
 
   $vysledek=mysql_query("INSERT INTO uzivatele_multi VALUES ('','$new_login','$new_md5_heslo','$new_nazev_kapely','$new_email','$new_hashedkapela','$new_adresa_diskuse')");
   
// vytvoření tabulky INFO   
 
	$status= "admin";
	$style= "classic";
 
    mysql_query("CREATE TABLE $info_diskuse (
	cas INT(11) NOT NULL,
	vzkaz text NOT NULL,
	jmeno VARCHAR(50) NOT NULL
	)");
	
    $vysledek=mysql_query("insert into $adresa_diskuse (cas, vzkaz, jmeno) values ('$cas', '$vzkaz', '$jmeno')");

 
 // require "navrat.php";
?>
 