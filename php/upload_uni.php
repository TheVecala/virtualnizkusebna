<?php session_start(); ?>
<?php
$target_dir = ($_POST["slozka_pro_vlozeni_souboru"]);
$target_file = "../".$target_dir ."/". basename($_FILES["fileToUpload"]["name"]); //bug s lomítkem
$jmeno_do_mailu = basename($_FILES["fileToUpload"]["name"]); 

$adresa_pro_navrat =    ($_POST["navrat"]);
$uploadOk = 1;
$imageFileType = strtolower(pathinfo($target_file,PATHINFO_EXTENSION));
 
if (file_exists($target_file)) {
    $_SESSION['vysledek'] = "Soubor stejného jména už ve složce je.";
    $uploadOk = 0;
}
 
else {
		if (move_uploaded_file($_FILES["fileToUpload"]["tmp_name"], $target_file)) {
		        $_SESSION['vysledek'] = "file ". basename( $_FILES["fileToUpload"]["name"]). " se nahrál.";	 
				//  odeslaní mailů 
				if ( $_POST["odeslat"] == "true") {
				  include "login/connect.php";
                  $seznam_mailu = "maily_".$_SESSION['kapela'];
				  
				  $maily=mysql_query("select mail from $seznam_mailu /*order by cas desc*/") ;
				  $textmailu="Do složky __ ".$_SESSION['slozka_souboru_k_zobrazeni']." __ byl vložen soubor __ ".$jmeno_do_mailu.".";  
				   
				  while ($adresa=MySQL_Fetch_Array($maily))
				  {  mail($adresa["mail"], "nový soubor v playlistu",$textmailu,"From:automat@virtualnizkusebna.cz");
			        
			      };
				  
				 }; 
				//  konec odeslaní mailů 		  
				  
		} else {
		    	$_SESSION['vysledek'] = " error uploading  file: ". $target_file;
		};
  }
  require "navrat.php";
?>
 
