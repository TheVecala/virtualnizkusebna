  <?php session_start(); ?>
<meta charset="utf-8">
<?php
include "connect.php";
$login = mysql_real_escape_string($_POST["nick"]); 
$heslo = mysql_real_escape_string($_POST["heslo"]); 
$login = strtolower($login);
$md5heslo = md5($heslo); 
 
$dotaz = mysql_query("select * from uzivatele_multi where login = '$login' and heslo = '$md5heslo'");
$overeni = mysql_num_rows($dotaz);
$radek_databaze = mysql_fetch_array($dotaz);
$dostupna_zkusebna = mysql_query("select * from uzivatele_multi where login = '$login' and heslo = '$md5heslo'");

if(isset($_POST["navrat"])) {
	   $adresa_pro_navrat = ($_POST["navrat"]); } 
else {
	   $adresa_pro_navrat = "/index.php"; 
};
	
if($overeni == 1) {
  // zústává 
    $_SESSION['login'] = stripslashes($login);  
    $_SESSION['id'] = $radek_databaze["id"];
	$_SESSION['prihlasen'] = true ;
    $_SESSION['vysledek'] = "přihlášen jako ".$_POST["nick"];	

	$adresa_info =  $radek_databaze["adresa_info"]; 

	$dotaz_style = mysql_query("select * from $adresa_info where vlastnost = 'style'  ");
	$style = mysql_fetch_array($dotaz_style);
	$_SESSION['style'] = $style["hodnota"];

  // změna na vlastnost2
	$dotaz_status = mysql_query("select * from $adresa_info where vlastnost = 'status'");
	$status = mysql_fetch_array($dotaz_status);
	$_SESSION['status'] = $status["hodnota"];
	
	// nový
	// $_SESSION['adresa_seznam_kapel'] = $radek_databaze["adresa_seznam_kapel"]; 
	
	// výpis a výběr kapely z tabulky adresa_seznam_kapel
	 // dočasně  $vybrana_kapela= "silentroom";
 //	  $dotaz = mysql_query("select * from kapely_multi2 where slozka = '$vybrana_kapela' ");
 //   $overeni = mysql_num_rows($dotaz);
 //   $radek_databaze_kapel = mysql_fetch_array($dotaz);
	
	
	// odsun
    $_SESSION['kapela'] =  $radek_databaze["nazev_kapely"]; 
	$_SESSION['befelemepesseveze'] = $radek_databaze["hashedkapela"];
	$_SESSION['diskuse'] = $radek_databaze["adresa_diskuse"]; 
	
    $_SESSION['adresa_info'] =  $radek_databaze["adresa_info"]; //nikde se nepoužívá, zrušit
	
  


	
	 require "../navrat.php";
	  
    die();
} else {
	$_SESSION['chyba_prihlaseni'] = "wrong_heslo";
   // header("Location:https://www.virtualnizkusebna.cz" .$adresa_pro_navrat  );
	  require "../navrat.php";
}
?>