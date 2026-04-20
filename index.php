 <?php session_start(); ?>
<?php

if (isset($_SESSION['login']))
    {   }
else { $_SESSION['login'] = ""; };

if ($_SESSION['login'] != "") {

?>
<?php

if (isset($_SESSION['prihlasen']))
    { $loged = $_SESSION['prihlasen']; }
else { $loged = "loged nenastaveno"; $_SESSION['prihlasen'] = "loged false"; };

if (isset($_SESSION['login']))
    { $login = $_SESSION['login']; }
else { $login = "login nenastavena"; };

if (isset($_SESSION['kapela']))
    { $kapela = $_SESSION['kapela']; }
else { $kapela = "kapela nenastavena"; };

$sekce = "uploads";

if (isset($_SESSION['vysledek']))
    { $vysledek = $_SESSION['vysledek']; }
else { $vysledek = "zadny vysledek"; };

if (isset($_SESSION['diskuse']))
    { $aktualni_diskuse = $_SESSION['diskuse']; }
else { $aktualni_diskuse = "diskuse_kapela1"; };

if (isset($_SESSION['cely_nazev']))
    { $nazev = $_SESSION['cely_nazev']; }
else { $nazev = "celý název nebyl nastaven"; };

if (isset($_SESSION['playlist']))
    { $aktualni_playlist = $_SESSION['playlist']; }
else { $aktualni_playlist = "playlist_" . $login; };

if (isset($_SESSION['befelemepesseveze']))
    { $befelemepesseveze = $_SESSION['befelemepesseveze']; }
else { $befelemepesseveze = "nenastaveno"; };

if (isset($_SESSION['skin']))
    { $skin = $_SESSION['skin']; }
else { $skin = "skin1"; };

if (isset($_SESSION['aktualni_text']))
    { $aktualni_text = $_SESSION['aktualni_text']; }
else { $aktualni_text = "akordy.txt"; };

?>
<?php

if ($kapela != "kapela nenastavena") {
    $slozka_slozek    = "user/" . $kapela . "/" . $befelemepesseveze . "/" . $sekce . "/";
    $pole_slozek      = scandir($slozka_slozek);
    $delka_pole_slozek = count($pole_slozek);
} else {
    $slozka_slozek    = "složka kapely nenastavena";
    $pole_slozek      = [];
    $delka_pole_slozek = 0;
};

// Nastavení aktuální složky
if (isset($_SESSION['slozka_souboru_k_zobrazeni']))
    { $slozka_souboru = $_SESSION['slozka_souboru_k_zobrazeni']; }
else { $slozka_souboru = $pole_slozek[2] ?? ""; };

// Pokud byla složka smazána, přepnout na první dostupnou
if (isset( $_SESSION['slozka_souboru_k_zobrazeni']) && $_SESSION['slozka_souboru_k_zobrazeni'] == "slozka_smazana"){
    $slozka_souboru = $pole_slozek[2] ?? "";
    $_SESSION['slozka_souboru_k_zobrazeni'] = $slozka_souboru;
};

// =====================================================================
// OPRAVA 1: $platna_slozka - ověření že složka existuje v seznamu
// Původní chyba: if ($platna_slozka = true)  <- přiřazení, vždy true!
// =====================================================================
$platna_slozka = false; // začínáme jako false, ne true

for ($x = 0; $x < $delka_pole_slozek; $x++) {
    if ($pole_slozek[$x] == $slozka_souboru) {
        $platna_slozka = true;
        break; // stačí najít jednou
    }
};

// =====================================================================
// OPRAVA 2: == místo = v podmínce
// Původní chyba: if ($platna_slozka = true)  <- přiřazení!
// Správně:       if ($platna_slozka == true)
// =====================================================================
if ($platna_slozka == true) {
    // OPRAVA 3: ověřit že složka existuje před scandir()
    $cesta_slozky = $slozka_slozek . $slozka_souboru;
    if (is_dir($cesta_slozky)) {
        $pole_souboru      = scandir($cesta_slozky);
        $delka_pole_souboru = count($pole_souboru);
    } else {
        $pole_souboru      = [];
        $delka_pole_souboru = 0;
    }
} else {
    $pole_souboru      = [];
    $delka_pole_souboru = 0;
};

?>


<!doctype html>
<html lang="cz">
  <head> 
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
      <title>Virtuální zkušebna</title>
       <!-- bootstrap JavaScript --> 
      <script src="/js/jquery-3.3.1.min.js" type="text/javascript"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js" integrity="sha384-ApNbgh9B+Y1QKtv3Rn7W3mgPxhU9K/ScQsAP7hUibX39j7fakFPskvXusvfa0b4Q" crossorigin="anonymous"></script>
    <script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js" integrity="sha384-JZR6Spejh4U02d8jOt6vLEHfe/JQGiRRSQQxSfFWpi1MquVdAyjUar5+76PVCmYl" crossorigin="anonymous"></script>
     <!-- Bootstrap CSS -->
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
    <link href="/css/sticky-footer-navbar.css" rel="stylesheet"> 
	<link href="/css/cover.css" rel="stylesheet">
	   <!-- wavesurfer -->	 
    <!--  <script src="https://unpkg.com/wavesurfer.js"></script> -->	
    <!--  <script src="https://unpkg.com/wavesurfer.js/dist/plugin/wavesurfer.regions.min.js"></script>  -->	
      <!-- recording -->
	 <script src="https://webrtc.github.io/adapter/adapter-latest.js"></script> 
     <script src="https://unpkg.com/mic-recorder-to-mp3"></script>  
    <script src="js/index.js"></script>

    <style>
	
 body {	
  background-color: #<?php echo $_SESSION['barva_pozadi'] ?>;
}

.btn-VZ {
 
  font-size: 0.6rem;
}
 
.stitek_valu { 
  padding: 0.5rem; 
}
.vzkaz_karta  { 
  margin:10px; 
}
.sloupec  { 
  background-color:#<?php echo $_SESSION['barva1'] ?>; 
}
.ovladac_vzkazu  { 
  background-color: #343a40; 
}
.formular_vzkazu  { 
  background-color: #<?php echo $_SESSION['barva1'] ?>; 
}

h4 {
  font-family: "Times New Roman", Times, serif;
  font-size:1rem;
  padding: 10px;
}

.table {
 border-left-width: 10px;
 border-left-style: solid;
 border-right-width: 10px;
 border-right-style: solid;
 border-top-width: 10px;
 border-top-style: solid;
 border-bottom-width: 7px;
 border-bottom-style: solid;
}
td  {
 border-bottom-width: 10px;
 border-bottom-style: solid;
 
 
}

.card {
  
  background-color: #<?php echo $_SESSION['barva1'] ?>;;
}


.card-body {
  /* padding: 1.25rem; */
  padding: 0.3rem;
}

.h2, h2 {
 font-size:1.2rem;
 border-radius: 1rem;
 padding: 5px;
 margin: 5px;
}

a:hover {
  background-color: green;
}

}

     </style>

  </head>
  <body style=" line-height: 1 ; ">

    <header>
      <?php   require "meat/header.php";?>
    </header>
   <div id="vycpavka"   style="min-height:50px"> </div>      
  <div class="site-wrapper">

      <div class="site-wrapper-inner">

        <div class="cover-container">

           <div class="inner cover">
       
 
  <div class="card-columns">
  
  
  
 
  
 
<div class="card" style="width:auto; padding:10px; background-color:transparent; border-color: transparent;">
  <img class="card-img-top" src="/data/kytarista.png" alt="Card image" style="max-width:100px; margin:auto">
  <div class="card-body">
 
    <a href=" simple_playlist.php" class="btn btn-primary tlacitko " style="font-size:1.5rem; color:#ffc107 ; background-color:#343a40; font-weight: bold; text-shadow: 2px -2px 20px #ffc107; border-color: #ffc107;">  JDU HRÁT... </a>
  </div>
</div>

 
  
  
     
 
  
  <div class="card" style="width:auto; padding:10px; background-color:transparent; border-color: transparent;">
  <img class="card-img-top" src="/data/singer.png" alt="Card image" style="max-width:100px; margin:auto">
  <div class="card-body">
 
    <a href="simple_napady.php" class="btn btn-primary" style="font-size:1.5rem; color:#ffc107 ; background-color:#343a40; font-weight: bold; text-shadow: 2px -2px 20px #ffc107; border-color: #ffc107;">  JDU S NÁPADEM </a>
  </div>
</div>
  
  
  
  
  
  
  </div>
 
 		 </div>
	   </div>
	  </div>
	</div>
 
 <div>  <!--  MODALS --> 
   	<?php  require "meat/modals.php"; ?>				
 </div>  <!-- KONEC MODALS -->
  
  
  
<?php  
  require "php/console.php";
?>
  

  <script src="meat/vecalovo.js"></script> 

 </body>
</html>

   <?php  
   ; }
  else { 
    require "php/loginbox4.php";
    
  }
?>
  
 