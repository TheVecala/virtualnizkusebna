<meta charset="utf-8">
<?php
include "connect.php";/* připojení k databázi */
$login = mysql_real_escape_string($_POST["nick"]);/* nick zadaný ve formuláři pro přihlašování */
$heslo = mysql_real_escape_string($_POST["heslo"]);/* heslo zadané ve formuláři pro přihlašování */
$login = strtolower($login);
 
$md5heslo = md5($heslo);/* Pomocí funkce md5() heslo zahashujeme */
/* — SQL DOTAZ PRO OVĚŘENÍ PRAVOSTI PŘIHLAŠOVACÍH DAT V DATABÁZI A UŽIVATELEM ZADANÝCH — */
$dotaz = mysql_query("select * from uzivatele where login = '$login' and heslo = '$md5heslo'");
$overeni = mysql_num_rows($dotaz);
$row = mysql_fetch_array($dotaz);
// tady na tom makám  
$dostupna_zkusebna = mysql_query("select * from uzivatele where login = '$login' and heslo = '$md5heslo'");

if(isset($_POST["navrat"])) {
	   $adresa_pro_navrat = ($_POST["navrat"]); } 
else {
	   $adresa_pro_navrat = "/index.php"; 
};
	
if($overeni == 1) {
    session_start();
    $_SESSION['login'] = stripslashes($login); 
/* Zde se vytváří SESSION 'login', kterou se budeme prokazovat jako přihlášení */
    $_SESSION['id'] = $row["id"];
	$_SESSION['diskuse'] = $row["adresa_diskuse"];
	$_SESSION['nazev'] = $row["cely_nazev"];
	$_SESSION['vysledek'] = "přihlášen jako ".$_POST["nick"];
	
	
    $_SESSION['prihlasen'] = true ;
    $_SESSION['kapela'] =  stripslashes($login); 
	
	
	header("Location:https://www.virtualnizkusebna.cz" .$adresa_pro_navrat  );
    die();
} else {
	$_SESSION['chyba_prihlaseni'] = "wrong_heslo";
   header("Location:https://www.virtualnizkusebna.cz" .$adresa_pro_navrat  );
	
}
?>