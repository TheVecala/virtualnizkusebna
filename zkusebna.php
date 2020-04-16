 <?php session_start(); ?>

<?php
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
  background-color:#27a243; 
}
.ovladac_vzkazu  { 
  background-color: #343a40; 
}
.formular_vzkazu  { 
  background-color: #27a243; 
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

.card-body {
  /* padding: 1.25rem; */
  padding: 0.3rem;
}
     </style>

  </head>
  <body style="background-color: #b4b4b4   ; line-height: 1 ; ">

   <header>
      <nav class="navbar navbar-expand-md navbar-dark fixed-top bg-dark">
        <a class="navbar-brand" href="#">VIRTUÁLNÍ ZKUŠEBNA</a>
        <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarCollapse" aria-controls="navbarCollapse" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarCollapse">
          <ul class="navbar-nav mr-auto">
            			
			 <li class="nav-item dropdown">
			  <a class="nav-link dropdown-toggle" href="#" id="navbardrop" data-toggle="dropdown">
				KAPELA
			  </a>
			  <div class="dropdown-menu">
				<a class="dropdown-item" href="#" data-toggle="popover" data-trigger="focus" data-content="Tahle funkce zatím nefachá">PROFIL</a> 
				<a class="dropdown-item" href="/php/login/logout.php">ODHLÁSIT SE</a>
			  </div>
             </li>
						
			 <li class="nav-item dropdown">
			  <a class="nav-link dropdown-toggle" href="#" id="navbardrop" data-toggle="dropdown">
				ZKUŠEBNA
			  </a>
			  <div class="dropdown-menu">
				<a class="dropdown-item" href="#" data-toggle="popover" data-trigger="focus" data-content="Tahle funkce zatím nefachá">ZMĚNIT</a> 
				<a class="dropdown-item" href="kalendar.php">ROZVRH</a>
			  </div>
             </li>
				          
    		 <li class="nav-item  ">
               <a class="nav-link"  href="#"  data-toggle="modal" data-target="#modal_skin">NASTAVENÍ</a>
             </li>			
             <li class="nav-item">
               <a class="nav-link" href="#" data-toggle="popover" data-trigger="focus"  data-content="Tahle funkce zatím nefachá">OFFLINE</a>
             </li>
             <li class="nav-item">
               <a class="nav-link  " href="#"  data-toggle="modal" data-target="#myModal"  >INFO</a>
             </li>
          </ul>
          <form class="form-inline mt-2 mt-md-0"> 
              <div  class="btn btn-success my-2 my-sm-0" type=""> přihlášen jako: <?php echo  $_SESSION['login'] ; ?></div>        
          </form>
        </div>
      </nav>
    </header>
     
	 
 <div class="container-fluid">
    <div id="vycpavka"   style="min-height:58px"> </div>               

    <div class="row">
	      <!--  prvni sloupec   -->
        <div id="adresare" class="col-md-4" style="margin-bottom: 5px ; display:none"> 		      				  
			<?php   require "meat/prvni.php";?>
		</div>  <!--  konec prvniho sloupce   -->  
        
		<!--   druhejstřetím sloupec   -->
	    <div class="col-md-8" >     
	 
         <!--   hlavicka druhyhostretim sloupce -->  
		 <div style="display: inlinexxxxxx; color:white; background-color: #343a40; padding:3px; ">
					   			   	
						 <div class="dropdown" style="text-align: left;"> 
							  <div  style="text-align:left; display: inline ;" >
									<h2 style="text-align:left;; color:black ; display: inline ;background-color: #dc3545;"> SONG </h2> 
							  </div>						 
                               	
							  <button style="display: inline; background-color: white;color:black; font-size:1.5rem " type="button" class=" btn  dropdown-toggle" data-toggle="dropdown">
							   <img src="/data/icons8-music-folder-50-2.png" alt="složka" style=" max-height: 40px;" > 
							   <?php echo $slozka_souboru 	?> 
							  </button>
							  <div class="dropdown-menu" style="background-color: rgb(52, 58, 64)">
							  						 

						<?php 
						for($x = 0; $x < $delka_pole_slozek; $x++) {
							  if ($pole_slozek[$x] == ".")  { continue; };
							  if ($pole_slozek[$x] == "..")  { continue; };
						   $soub = ($slozka_slozek.$pole_slozek[$x]);
						   $label_soub = " test";
						   $label_soub = ($pole_slozek[$x]);  
							if(is_dir($soub))
								
								  {    
								?>
								<div  class="dropdown-item-text">	<!-- tlačítko změny složky    --> 
	
									<form action="/php/zmenit_slozku.php" method="post" enctype="multipart/form-data"> 
									 <input id="navrat" type="text" value="<?php echo $_SERVER['PHP_SELF']; ?>" name="navrat" style="display:none" >
									 <input id="cilova_slozka" type="text" value="<?php echo $pole_slozek[$x] ?>" name="cilova_slozka" style="display:none" >
								
								    <?php 
 									   if ($pole_slozek[$x]==$slozka_souboru)  {   
  									   }									 
									   else
									   { ?>
								   
								         <div> 
		 
                                         </div>
									   
								         <button id=" " type="submit" style=" max-width: 333px ; display: inline" class="btn btn-sm btn-warning" value="  <?php echo $pole_slozek[$x] ;?> " name="submit">
                                           <img src="/data/glyphicons-441-folder-closed.png" alt="složka"  > 
										   <?php echo $pole_slozek[$x] ?>
									     </button>
										 										 
									  <?php 
									 	 }
									 ; ?>
	
									</form>							   
				   
								</div>	
								 
								<?php
								 }
						         }
						        ?>

							    </div>
						 </div> 
						 
		 </div>	 
	  
		 <div class="row">
		 
		 	   <!--  nulty sloupec   --> 
			   <div id="wave_jumbo"  style="display:nonexxxxx ;  margin-bottom: 5px; "  class="col-md-12"> 
					<?php 	  require "meat/nulty.php";	?>								
			   </div>   <!-- konec nulty sloupec   -->

			   <!--  druhy sloupec   -->
		       <div  id="k" class="col-md-6" style="margin-bottom: 5px"> 
				    <?php 	require "meat/druhy.php";	?>
		       </div  > <!-- konec druhý sloupec   -->
  
               <!-- třetí sloupec   --> 
			   <div class="col-md-6" style="margin-bottom: 5px" > 
					<?php   require "meat/treti.php";	?>						
			   </div> <!-- konec třetí sloupec   -->
			
      	  </div> <!-- konec row   -->
        </div> <!--   konec druhejstřetím sloupec   -->  
 
        <!-- čtvrtý sloupec   -->
		<div class="col-md-4" style="margin-bottom: 5px" >   
 			<?php   require "meat/ctvrty.php";	?>
	    </div> <!-- konec čtvrtý sloupec   --> 	 
	 	 
    </div> <!-- row -->
	
 </div>     <!-- container -->
 
 
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
  
 