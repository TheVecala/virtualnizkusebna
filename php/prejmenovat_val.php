<?php session_start(); ?>
<?php
 
$cesta_k_valu =  ($_POST["cesta_k_valu_k_prejmenovani"]);

$renamed_dir =  ($_POST["puvodni_jmeno_valu_k_prejmenovani"]);
$target_dir =  ($_POST["nove_jmeno_valu_k_prejmenovani"]);

$adresa_pro_navrat =    ($_POST["navrat"]);
  
$odkud = "./".$cesta_k_valu.$renamed_dir;
$kam = "./".$cesta_k_valu.$target_dir ;

if (is_dir($odkud)) {

    rename($odkud,$kam);
 
	//přepnout na jinej vál
	if ($_SESSION['slozka_souboru_k_zobrazeni'] = $renamed_dir) 	
	{      $_SESSION['slozka_souboru_k_zobrazeni'] = "slozka_smazana";
	};
 
	
}
 
   else {
    
        $_SESSION['vysledek'] = $odkud;
    };
  require "navrat.php";
?>
 
