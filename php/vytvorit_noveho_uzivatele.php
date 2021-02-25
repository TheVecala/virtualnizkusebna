 
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
   $new_adresa_info= "info_$new_login";
  
   
  // ověření neexistence stejného uživatele - viz vytvoření zkušebny 
	
 
// vložení do databaze 	
 
   $vysledek=mysql_query("INSERT INTO uzivatele_multi VALUES ('','$new_login','$new_md5_heslo','$new_nazev_kapely','$new_email','$new_hashedkapela','$new_adresa_diskuse','$new_adresa_info')");
   
   
// vytvoření tabulky INFO   
 
	$nazev_tabulky= $new_adresa_info;
	$status= "user";
	$style= "classic";
	$rezerva= "nic";
 
    mysql_query("CREATE TABLE $nazev_tabulky (
	vlastnost VARCHAR(50) NOT NULL,
	hodnota VARCHAR(50) NOT NULL 
	)");
	
    $vysledek=mysql_query("INSERT INTO $nazev_tabulky  VALUES ('status','$status')");
	$vysledek=mysql_query("INSERT INTO $nazev_tabulky  VALUES ('style','$style')");
   
   
  require "navrat.php";
?>
 