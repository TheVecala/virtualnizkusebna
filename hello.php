 <?php session_start(); ?>

<?php
 $_SESSION['barva1'] ="a7ac38";
 $_SESSION['barva2'] ="yellow";
  if($_SESSION['login']!=""){  
?>

<?php
   
if(isset($_SESSION['prihlasen']))
	   {   $loged = $_SESSION['prihlasen'] ;  }
   else { $loged =  "loged nenastaveno" ; $_SESSION['prihlasen']= "loged false" ;};
      
	  
if(isset($_SESSION['login']))
	   {   $login =$_SESSION['login'] ;
    } else { $login=  "login nenastavena" ; } ;
	
 //zmenit na pole 
if(isset($_SESSION['kapela']))
	   {   $kapela =$_SESSION['kapela'] ;
    } else { $kapela=  "kapela nenastavena" ; } ;
	
//if(isset($_SESSION['sekce_k_zobrazeni']))
//	   {   $sekce = $_SESSION['sekce_k_zobrazeni'] ;
//    } else { $sekce=  "uploads" ; } ;
	 $sekce=  "uploads" ; 	
	 
if(isset($_SESSION['vysledek']))
	   {   $vysledek =$_SESSION['vysledek'];
    } else { $vysledek=  "zadny vysledek " ; } ;
		
if(isset($_SESSION['diskuse']))
	   {   $aktualni_diskuse =$_SESSION['diskuse'];
    } else { $aktualni_diskuse=  "diskuse_kapela1" ; } ; 
 		
if(isset($_SESSION['cely_nazev']))
	   {   $nazev =$_SESSION['cely_nazev'];
    } else { $nazev=  "celý název nebyl nastaven" ; } ; 
 
if(isset($_SESSION['playlist']))
	   {   $aktualni_playlist =$_SESSION['playlist'];
    } else { $aktualni_playlist=  "playlist_".$login ; } ; 

if(isset($_SESSION['befelemepesseveze']))
	   {   $befelemepesseveze =$_SESSION['befelemepesseveze'];
    } else { $befelemepesseveze=  "nenastaveno" ; } ; 	
	
 if(isset($_SESSION['skin']))
	   {   $skin =$_SESSION['skin'];
    } else { $skin=  "skin1" ; } ;
 	
 if(isset($_SESSION['aktualni_text']))
	   {   $aktualni_text = $_SESSION['aktualni_text'];
    } else { $aktualni_text=  "akordy.txt" ; } ; 	
	
 

	
 ?> 


<?php
 

 if($kapela!="kapela nenastavena"){  
	$slozka_slozek ="user/". $kapela."/".$befelemepesseveze."/".$sekce."/"; 	 	
	$pole_slozek = scandir($slozka_slozek);
	$delka_pole_slozek = count($pole_slozek);} 
else { $slozka_slozek ="složka kapely nenastavena"; 
	$pole_slozek = "empty";
	$delka_pole_slozek = 0;} ;
	



   // zmenit na   if is in pole složek zobrazit else nastavit prvni slozku
   
   
 if(isset($_SESSION['slozka_souboru_k_zobrazeni']))
  {   $slozka_souboru= $_SESSION['slozka_souboru_k_zobrazeni'];
  } else { $slozka_souboru=  $pole_slozek[2] ; } ; // první složku z vypisu, přeskakuje dvojtečku a tečku   
   
 if ( $_SESSION['slozka_souboru_k_zobrazeni']=="slozka_smazana"      )
  {  $slozka_souboru=  $pole_slozek[2] ;
      $_SESSION['slozka_souboru_k_zobrazeni'] = $pole_slozek[2] ;
  };   
   
   
   
   
   
   
   
   // cyklus for pro ověření složky
   $platna_slozka = true ; //prozatím, než bude ověřována z databáze
   for($x = 0; $x < $delka_pole_slozek; $x++) 
      {
	  if ($pole_slozek[$x] == $slozka_souboru)  {$platna_slozka = true;};
      } ;
   
 if ( $platna_slozka = true   )  {    
     $pole_souboru = scandir($slozka_slozek.$slozka_souboru);  //chybí podmínka pro existenci slozky slozek
     $delka_pole_souboru = count($pole_souboru);  } 
else {$pole_souboru = "empty" ;
	  $delka_pole_souboru = 0; }  ;
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
    <script src="https://unpkg.com/wavesurfer.js"></script>
    <script src="https://unpkg.com/wavesurfer.js/dist/plugin/wavesurfer.regions.min.js"></script>
      <!-- recording -->
	 <script src="https://webrtc.github.io/adapter/adapter-latest.js"></script> 
     <script src="https://unpkg.com/mic-recorder-to-mp3"></script>  
    <script src="js/index.js"></script>

    <style>
 
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
}

     </style>

  </head>
  <body style="background-color: #202428   ; line-height: 1 ; ">

    <header>
      <?php   require "meat/header.php";?>
    </header>
   <div id="vycpavka"   style="min-height:50px"> </div>      
  <div class="site-wrapper">

      <div class="site-wrapper-inner">

        <div class="cover-container">

           <div class="inner cover">
       
 
 
  <div class="card"  style="background-color: #1e2225 !important">
  
	<div class="card-body text-left">
      <img class="card-img-top" src="/data/singer.png" alt="" style= "width: 40%;   " > 	
	  <div class="card-img-overlay" style="text-align:right">
	       <div class="btn">
	    <h2 style="font-size:2rem; color:#ffc107 ; background-color:#343a40; font-weight: bold; text-shadow: 2px -2px 20px #ffc107;">  PLAYLIST </h2>
		   </div>  <br>
	       <div class="btn">
	    <h2 style="font-size:2rem; color:#ffc107 ; background-color:#343a40; font-weight: bold; text-shadow: 2px -2px 20px #ffc107;">  TEXT </h2>
		   </div>	<br>
		   <div class="btn">
	    <h2 style="font-size:2rem; color:#ffc107 ; background-color:#343a40; font-weight: bold; text-shadow: 2px -2px 20px #ffc107;">  NAHRÁVKY </h2>
		   </div>	<br>	   
		   <div class="btn">
	    <h2 style="font-size:2rem; color:#ffc107 ; background-color:#343a40; font-weight: bold; text-shadow: 2px -2px 20px #ffc107;">  NÁPADY </h2>
		   </div>		   
		   		   
	 
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
  
 