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
    } else { $befelemepesseveze=  "befelemepesseveze" ; } ; 	
	
 		 
 ?> 


<?php
 

 if($kapela!="kapela nenastavena"){  
	$slozka_slozek ="user/". $kapela."/befelemepesseveze/".$sekce."/"; 	 	
	$pole_slozek = scandir($slozka_slozek);
	$delka_pole_slozek = count($pole_slozek);} 
else { $slozka_slozek ="složka kapely nenastavena"; 
	$pole_slozek = "empty";
	$delka_pole_slozek = 0;} ;
	



   // zmenit na   if is in pole složek zobrazit else nastavit prvni slozku
 if(isset($_SESSION['slozka_souboru_k_zobrazeni']))
	   {   $slozka_souboru= $_SESSION['slozka_souboru_k_zobrazeni'];
   } else { $slozka_souboru=  $pole_slozek[2] ; } ; // první složku z vypisu, přeskakuje dvojtečku a tečku   
   
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
       <!-- Optional JavaScript --> 
      <script src="/js/jquery-3.3.1.min.js" type="text/javascript"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js" integrity="sha384-ApNbgh9B+Y1QKtv3Rn7W3mgPxhU9K/ScQsAP7hUibX39j7fakFPskvXusvfa0b4Q" crossorigin="anonymous"></script>
    <script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js" integrity="sha384-JZR6Spejh4U02d8jOt6vLEHfe/JQGiRRSQQxSfFWpi1MquVdAyjUar5+76PVCmYl" crossorigin="anonymous"></script>
     <!-- Bootstrap CSS -->
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
    <link href="/css/sticky-footer-navbar.css" rel="stylesheet">
 
	   <!-- vecalovo -->
	 
<script src="https://unpkg.com/wavesurfer.js"></script>
<script src="https://unpkg.com/wavesurfer.js/dist/plugin/wavesurfer.regions.min.js"></script>

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
     </style>

  </head>
  <body style="background-color: #b4b4b4   ; line-height: 1 ; ">

   <header>
      <!-- Fixed navbar -->
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
        <a class="dropdown-item" href="#" data-toggle="popover" data-trigger="focus" data-content="Tahle funkce zatím nefachá">NASTAVENÍ</a> 
        <a class="dropdown-item" href="/php/login/logout.php">ODHLÁSIT SE</a>
      </div>
    </li>
			
			
            <li class="nav-item active">
              <a class="nav-link" href="#" data-toggle="popover" data-trigger="focus"  data-content="">PLAYLIST</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="#" data-toggle="popover" data-trigger="focus"  data-content="Tahle funkce zatím nefachá">ARCHÍV ZKOUŠEK</a>
            </li>
            <li class="nav-item">
                  <a class="nav-link disabled" href="#"  data-toggle="modal" data-target="#myModal"  >INFO</a>
            </li>
          </ul>
          <form class="form-inline mt-2 mt-md-0">
             
            
                <div  class="btn btn-success my-2 my-sm-0" type=""> přihlášen jako: <?php echo  $_SESSION['login'] ; ?></div>
          
          </form>
        </div>
      </nav>
    </header>
     
	 
<div class="container-fluid">
     <div id="vycpavka" id="k" style="min-height:58px"> </div>               

	
    <div class="row">
	
        <div id="wave_jumbo"  style="display:nonexxxxx"  class="col-md-12">  <!--  nulty sloupec   -->
		      

			<div class="card bg-dark text-white"  style="margin-top: 1px;"> <!--hlavička nultého sloupce     -->
               <div class="card-body"> 
			   
			   
			            <div  style="text-align:right; ;" >
					    	<h2 style="text-align:right; color:red ; display: inline ">  	LOOPER </h2> 
						   <button id=" " class="btn btn-secondary" data-action=" " style="display: inline ; max-height:30px ; padding:0px ; border-width: 0px; ">
						   <img style="max-height:30px" src="/data/ikony_novy/icons8-minimize-window-64.png" alt="minimize"> </button> 
					       
						   <button id="schovat_wave_jumbo" class="btn btn-secondary" data-action=" " style="display: inline; max-height:30px ; padding:0px ; border-width: 0px;" ><img style="max-height:30px" src="/data/ikony_novy/icons8-multiply-50.png" alt="zavřít"></button>
						</div>
						
						<div style="text-align:right ">
							<button id="wave_play" class="btn btn-sm btn-warning" data-action="play"> <img style="max-height:30px" src="/data/ikony_novy/icons8-play-50-2.png" alt="play"></button>
							<button id="wave_pause" class="btn btn-sm btn-warning" data-action=" "><img style="max-height:30px" src="/data/ikony_novy/icons8-pause-50-2.png" alt="pause"></button>
							<button id="wave_od_zacatku" class="btn btn-sm btn-warning" data-action=" "><img style="max-height:30px" src="/data/ikony_novy/icons8-rewind-50.png" alt="od začátku"></button>
							<button id="loop" class="btn btn-sm btn-warning" data-action=" "> <img style="max-height:30px" src="/data/ikony_novy/icons8-repeat-50.png" alt="loop"></button>
							<button id="wave_clear_regions" class="btn btn-sm btn-warning" data-action=" "> LOOP off</button>
							 
						
						
					       
					    </div>
						
	             <span class="card-title"> vál: </span>  <h2 id="label_wave_jumbo" style="display: inline"> soubor nenačten </h2>  
				       <div id="test_delky"></div>	
				 
					
	           </div>
		 
            </div> <!--     -->
	      
	
	
			<div class="jumbotron bg-success" style="padding: 0rem 1rem">				
							 
							<div id="hlaska_nacitani" class="bg-danger" style="display:none">načítám soubor...</div>
							<div id="waveform" style="display:none">  
						
							</div>
			
							
			
			</div>
   	
        </div>   

	
	
	
	
        <div id="adresare" class="col-md-4" style="margin-bottom: 5px">  <!--  prvni sloupec   -->
		      

			<div class="card bg-dark text-white"  style="margin-top: 1px;"> <!--hlavička prvního sloupce     -->
               <div class="card-body"> 
	              <h2 style="text-align:right; color:red ">  PLAYLIST </h2> 
				 <span class="card-title"> PROJEKT: </span>  <h2 style="display: inline"> <?php echo $_SESSION['kapela'] ; ?> </h2>
				
				     <div style="text-align:right" >
		               <button  type="button" class="btn btn-sm btn-success"  style=" display: inline" data-toggle="modal" data-target="#modal_playlist_edit">		
			         	UPRAVIT PLAYLIST
			           </button> 	 
				   </div>			  	
	           </div>			  
            </div> <!--     -->
	      
		  
            <div> <!--  playlist   -->
			
			
			
			<!--  sem vypis playlistu z databáze   -->
			
			
			
			    
<?php
define ("ROWS", 10);
 require "php/login/connect.php";
 
  if (!isset($_GET["celkem"]))  
  {
    $vysledek=mysql_query("select count(*) as pocet from $aktualni_playlist ");
    $zaznam=mysql_fetch_array($vysledek);
    $celkem=$zaznam["pocet"];
  }
  else
  {
    $celkem=$_GET["celkem"];
  }
?> 
  
<?php   
    $vysledek=mysql_query("select * from $aktualni_playlist order by cas desc") ; 
?> 
  
 <div id=""  style="overflow: auto ">
 
<ul class="list-group sloupec" >
   
 
  </ul>
  </div>   
							
								
			  <table class="table table-bordered table-hover table-dark" style="color: #000; background-color: #27a243">
                <thead>
				  <tr>
					<th>vál</th>
					<th>bpm</th>
					<th>KEY</th>
				  </tr>
                </thead>
                <tbody>
				
<?php
  while ($zaznam=MySQL_Fetch_Array($vysledek))   
  {
?>				
				
				
				  <tr>
					<td><?php echo $zaznam["nazev_valu"] ?> </td>
					<td> <?php echo strip_tags($zaznam["bpm"])?> </td>
					<td> <?php echo strip_tags($zaznam["klic"])?> </td>
					<!--<td> <?php echo date("j.n.Y G:i:s", ($zaznam["cas"]))?></td>  -->
				  </tr> 
				 
<?php 
 }
?> 			

			
				  
                </tbody>
              </table>

			
            </div> <!-- konec playlistu    -->
 
	
		</div>  <!--  konec prvniho sloupce   -->  

		<div  id="k" class="col-md-4" style="margin-bottom: 5px"> <!--  druhy sloupec   -->
		
	      <div  class=" ">   <!-- hlavička sekce složek   -->
			  
               <div class="card bg-dark text-white" style="margin-top: 1px;"> <!--      -->
                   <div class="card-body"> 
		             	<h2 style="text-align:right; color:red ">  SOUBORY </h2>
   


			<ul class="dropdown" style="display: inline;padding-left: 4px;">  <!--  vypis složek   -->
		
			  <button type="button" class="btn btn-sm btn-succces dropdown-toggle" data-toggle="dropdown">
			   <img src="/data/glyphicons-441-folder-closed.png" alt="složka"  >
			   <?php echo $slozka_souboru 	?> 
			  </button>		
		
			  <div class="dropdown-menu"> <!-- zmšna složky    -->
			
		  
						<?php 
						for($x = 0; $x < $delka_pole_slozek; $x++) {
							  if ($pole_slozek[$x] == ".")  { continue; };
							  if ($pole_slozek[$x] == "..")  { continue; };
						   $soub = ($slozka_slozek.$pole_slozek[$x]);
						   
							if(is_dir($soub))
								
								  {    
								?>
								<div  class="dropdown-item ">	<!-- tlačítko změny složky    -->  
																
									<form action="/php/zmenit_slozku.php" method="post" enctype="multipart/form-data">
									 <img src="/data/glyphicons-441-folder-closed.png" alt="složka"  > 			   
									 <input id="navrat" type="text" value="<?php echo $_SERVER['PHP_SELF']; ?>" name="navrat" style="display:none" >
									 <input id="cilova_slozka" type="text" value="<?php echo $pole_slozek[$x] ?>" name="cilova_slozka" style="display:none" >
									 <input id=" " type="submit" value="<?php echo $pole_slozek[$x] ?>" name="submit">
									</form>
								 
								</div>	
								 
								<?php
								}
						}
						?>

				  </div>
								
			</ul>
 
						
	               </div>	
				   
				   
				   <div class="card-footer" style="text-align:right">	<!--  tlačítka souboru  -->   	       
				      <button  id="vlozit_soubor"   type="button" class="btn btn-sm  btn-secondary"  style=" display: inline" data-toggle="modal" data-target="#modal_vlozit_soubor" >VLOŽIT SOUBOR</button>   
					  <button  id="nova_slozka"   type="button" class="btn btn-sm btn-secondary"  style=" display: inline" data-toggle="modal" data-target="#modal_nova_slozka"> NOVÁ SLOŽKA </button> 
			       </div>
				   
				
               </div>  
 			

			
				<div  class="card bg-success text-white">   <!--  formular_vytvoreni_slozky  -->
				 
				</div>
				
				
 

          </div>   <!-- konec hlavičky sekce složek   -->
		


			   
            <!--  odstranenej konec div   -->
 
 
 
			<div class="card bg-success text-white">
			   
			   <div id="formular_vlozeni_souboru" class="card-body" style="display:none">  
							 
			
			   </div>
			 
			</div>
			 
			   <div>  <!--  vypis souboru   -->          
								 
	 				   
					<?php 

					for($x = 0; $x < $delka_pole_souboru; $x++) {

					   $soub = ($slozka_slozek.$slozka_souboru."/".$pole_souboru[$x]);
					   $label_soub = ($pole_souboru[$x]);  
					   if(is_file($soub))
						{    
						?>
						  
							   <div class="card bg-success text-white"  > 
							   
							     <div id=" " class="card-body   stitek_valu " style="   " > 
							   
							  
							   
							        <div class="card-header" style= "  "> 
							      	<div style="color:black  ; background-color:white ;  display: inline" >	
										<img src="/data/glyphicons-18-music.png" alt="vál"  > 			
									   <?php echo $pole_souboru[$x]; ?>
									</div> 
								 
							        </div> 
									
							 
									
									
									
									
								 
								
								 <?php
								 $FileType = strtolower(pathinfo($soub,PATHINFO_EXTENSION));
								 if ($FileType == "mp3" or $FileType == "wav" )
								 {    
						         ?>
 							 
								  <audio controls preload="metadata" style=" width:130px; height: 30px;  display: inline" >
	                                  <source src="<?php echo $soub; ?>" type="audio/mpeg">
	                                   Your browser does not support the audio element.
                                  </audio>
								  
								 <?php
								  }  
						         ?> 
								 
								  <?php
								 $FileType = strtolower(pathinfo($soub,PATHINFO_EXTENSION));
								 if ($FileType == "mp3" or $FileType == "wav")
								 {    
						         ?>  
									<button    value="<?php echo $soub; ?>" name="<?php echo $label_soub; ?> " type="button" class="btn btn-sm btn-warning btn-VZ wave_loader"  style=" max-width: 120px ; display: inline" >										 			
									   OTEVŘÍT V LOOPERU
								  <?php
								  }  
						         ?> 
                                  
								  
								 <a href="<?php echo $soub; ?>" download style="  display: inline"> 
									<button   type="button" class="btn btn-sm btn-secondary btn-VZ"  >  STÁHNOUT </button> 
								 </a>
								 
								  
									<button    value="<?php echo $soub; ?>" name="<?php echo $label_soub; ?> " type="button" class="btn btn-sm btn-danger btn-VZ  deleter"  style=" max-width: 120px ; display: inline" data-toggle="modal" data-target="#modal_delete">		
									  SMAZAT
									</button> 
								  


								 </div> <!--card body  -->
							   </div> <!-- card   -->
						   							
						<?php
						}
					}
					?>
 		 			
			</div> <!--  konec vypis souboru   --> 
			  		   		   
       </div  > <!-- konec druhý sloupec   -->
  
        <div class="col-md-4" style="margin-bottom: 5px" > <!-- třetí sloupec   -->
       
      
<?php
define ("ROWS", 10);
 require "php/login/connect.php";
 
  if (!isset($_GET["celkem"]))  
  {
    $vysledek=mysql_query("select count(*) as pocet from $aktualni_diskuse ");
    $zaznam=mysql_fetch_array($vysledek);
    $celkem=$zaznam["pocet"];
  }
  else
  {
      $celkem=$_GET["celkem"];
  }
?> 
  
<?php  
  if ($celkem>ROWS)
  {
    if (!isset($_GET["od"])) $od=1; else $od=$_GET["od"];
    $vysledek=mysql_query("select cas, vzkaz, jmeno from $aktualni_diskuse order by cas desc"." limit ".($od-1).", ".ROWS);
  }
  else
  {
    $vysledek=mysql_query("select * from $aktualni_diskuse order by cas desc") ;
  }
?> 
  
 <div>   <!-- hlavička třetího sloupce  -->
      <div id="diskuse" style="font-size:1.5em">
                <div class="card bg-dark text-white"  style="margin-top: 1px;"> <!--      -->
                   <div class="card-body"> 
		               <h2 style="text-align:right; color:red ">  POZNÁMKY </h2>  	
					   <div  id="od_do" class="bg-dark text-white" style="font-size:0.8em">
						   <?php	   
						   echo ' '.$od.'-';
						   echo (($od+ROWS-1)<=$celkem)?($od+ROWS-1):$celkem;
						   echo ' z '. $celkem.'  ';
						   ?> 				   
					   </div>
					   <div style="text-align:right;">
                        <button id="vybalit_formular"   class="btn btn-sm btn-success"  style=" display: inline" data-toggle="modal" data-target="#modal_vlozit_komentar" >NAPSAT  </button>  
           			   </div>  					   
	               </div>					   
               </div> <!--     -->			   
      </div> 
 
    
   
 </div> <!-- konec hlavička třetího sloupce  -->  
 <div id="prispevek"  style="overflow: auto ">
 <div>   <!-- ovládání třetího sloupce  -->
   
  
	 <div id="navigace" > 
<?php				
       if ($od<>1) echo  ' <a href=" '.$_SERVER["PHP_SELF"].'?celkem='.$celkem.'&amp;od=1">  <div id= "exit_tlac" class="btn btn-dark btn-sm" style="font-size:0.6em"  >NEJNOVĚJŠÍ</div></a>   '. "\n";

  
       if ($od>ROWS) echo ' <a href="'.$_SERVER["PHP_SELF"].'?celkem='.$celkem.'&amp;od='.($od-ROWS).'"> <div id= "exit_tlac"  class="btn btn-dark btn-sm" style="font-size:0.6em">NOVĚJŠÍ</div></a>  '. "\n";
 
 
       if ($od+ROWS<$celkem) echo  '<a href="  '.$_SERVER["PHP_SELF"].'?celkem='.$celkem.'&amp;od='.($od+ROWS).'  ">  <div id= "exit_tlac" class="btn btn-dark btn-sm" style="font-size:0.6em">STARŠÍ</div></a> '. "\n";
 
 
       if ($od<$celkem-ROWS) echo  '<a href="'.$_SERVER["PHP_SELF"].'?celkem='.$celkem.'&amp;od='.($celkem-$celkem%ROWS+1).' "> <div id= "exit_tlac"  class="btn btn-dark btn-sm" style="font-size:0.6em">NEJSTARŠÍ</div></a> '. "\n";
  ?> 
       
	   </div>  
 
   
      
   
   
 </div> <!-- konec ovládání třetího sloupce  --> 
<ul class="list-group sloupec" >
   
<?php
  while ($zaznam=MySQL_Fetch_Array($vysledek))   
  {
?>
    
     
	  <li class="list-group-item vzkaz_karta ">
	   <span class="vzkaz" > <?php echo $zaznam["vzkaz"] ?> </span><br>  
	   <div style="text-align:right; ">
	     <span class="jmeno"  style="font-size:0.6em; "> VLOŽIL:&nbsp </span> 
	     <span class="jmeno"  style="font-size:0.9em; ">  <?php echo strip_tags($zaznam["jmeno"])?> &nbsp </span> 
         <span class="datum"  style="font-size:0.6em; ">  <?php echo date("j.n.Y G:i:s", ($zaznam["cas"]))?> </span> 
       </div>
	   
      </li>
	

	<?php 
 }
?> 
  </ul>
  </div>   

      </div> <!-- konec třetí sloupec   -->
      	
      
      
    </div> <!-- row -->

	
 </div>     <!-- container -->
 
 
	<!-- The Modal INFO-->
<div class="modal modal-centered " id="myModal">
  <div class="modal-dialog">
    <div class="modal-content bg-success text-white">

      <!-- Modal Header -->
      <div class="modal-header">
        <h4 class="modal-title">I N F O </h4>
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->
      <div class="modal-body">
	      <p>
        DIY a Open source projekt ze Štatlu. <br>
		Plugin pro sdílení nahrávek hudebních skupin mezi jejímy členy. <br>   
		Tohle není prostor pro volné ukládání dat většího množství uživatelů. 
		Vhodná je instalace na vlastní doménu.  <br> <br>
		Pro více info pište na adresu: <i>  the@vecala.cz  </i> 
	
         </p>
      </div>

      <!-- Modal footer -->
      <div class="modal-footer">
        <button type="button" class="btn btn-danger" data-dismiss="modal">ZAVŘÍT</button>
      </div>

    </div>
  </div>
</div>
	
	
  <!-- The Modal DELETE -->
<div class="modal" id="modal_delete">
  <div class="modal-dialog  ">
    <div class="modal-content bg-success text-white">

      <!-- Modal Header -->
      <div class="modal-header">
        <p id="modal_delete_label" class="modal-title">  Soubor   </p>
		
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->
      <div class="modal-body">
         <p >    Nemáš oprávnění smazat soubor...  </p>
        
      </div>

      <!-- Modal footer -->
      <div class="modal-footer">
          <button type="button" class="btn btn-warning" data-dismiss="modal">Chápu</button>
		  <button id="modal_delete_deleter" value="soubor_nevlozen" type="button" class="btn btn-danger" >Nechápu</button>
        
      </div>

    </div>
  </div>
</div>
 
 
  <!-- The Modal playlist edit -->
<div class="modal" id="modal_playlist_edit">
  <div class="modal-dialog  ">
    <div class="modal-content bg-success text-white">

      <!-- Modal Header -->
      <div class="modal-header">
        <p class="modal-title"> EDITOVAT PLAYLIST </p>
		
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->
      <div class="modal-body">
     
	   	        <form action="php/vlozit_track.php" method="post" enctype="multipart/form-data">
				
					<h3>   VYTVOŘENÍ NOVÉ POLOŽKY PLAYLISTU </h3>    <br>
					
					NÁZEV: 
					<input id="" type="text" name="nazev_tracku" > <br>
					BPM: 
					<input id="" type="text" name="bpm" > <br>
					KLÍČ:
					<input id="" type="password" name="klic" > <br>
					INFO1:
					<input id="" type="password" name="over_heslo" > <br>
					EMAIL:
			     	<input id="" type="text" name="email" > <br>
					
					<input id="jmeno_adresare_xxxxx" type="text" value="první" name="jmeno_adresare" style="display:none" >	 <br>
					<input id="navrat_xxxxxxx" type="text" value="<?php echo $_SERVER['PHP_SELF']; ?>" name="navrat" style="display:nonexxxxxx" > <br>
					<input id="" type="text" value="<?php echo $kapela; ?>" name="kapela" style="display:nonexxxxxxxx" > <br>
					<input id="vlozit_track" type="submit" value="vložit" name="submit">
								
				</form>
				
      </div>
      <!-- Modal footer -->
      <div class="modal-footer">
        <button type="button" class="btn btn-danger" data-dismiss="modal">ZPĚT</button>
      </div>

    </div>
  </div>
</div> 
 
 
   
  <!-- The Modal vlozit_soubor -->
<div class="modal " id="modal_vlozit_soubor">
  <div class="modal-dialog  ">
    <div class="modal-content bg-success text-white">

      <!-- Modal Header -->
      <div class="modal-header">
        <p class="modal-title"> VLOŽENÍ SOUBORU </p>		
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->
      <div class="modal-body">
     
	   	   	<form action="/php/upload_uni.php" method="post" enctype="multipart/form-data">
					<h5>Vložit soubor:</h5>
					<input id="fileToUpload" type="file" value="vybrat soubor" name="fileToUpload"  >
					<input id="nahrat" type="submit" value="nahrát soubor" name="submit">
					<input id="navrat" type="text" value="<?php echo $_SERVER['PHP_SELF']; ?>" name="navrat" style="display:none" >
					<input id="" type="text" value="<?php echo $slozka_slozek.$slozka_souboru ?>" name="slozka_pro_vlozeni_souboru" style="display:none" >
				</form>
					   		
      </div>
      <!-- Modal footer -->
      <div class="modal-footer">
         <button type="button" class="btn btn-danger" data-dismiss="modal">ZPĚT</button>
      </div>

    </div>
  </div>
</div> 
 
   
  <!-- The Modal nova_slozka -->
<div class="modal" id="modal_nova_slozka">
  <div class="modal-dialog  ">
    <div class="modal-content  bg-success text-white">

      <!-- Modal Header -->
      <div class="modal-header">
        <p class="modal-title">VLOŽENÍ NOVÉ SLOŽKY</p>		
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->
      <div class="modal-body">
     
	   	      <div id="formular_vytvoreni_slozky"  >  
								 
					  <form action="/php/vytvorit_adresar.php" method="post" enctype="multipart/form-data">
						vytvořit novou složku:
						<input id="jmeno_adresare" type="text" name="jmeno_adresare" autofocus >
						<input id=" " type="text" value="<?php echo $sekce ; ?>" name="sekce" style="display:none" >
						<input id="navrat" type="text" value="<?php echo $_SERVER['PHP_SELF']; ?>" name="navrat" style="display:none" >
						<input id="vytvorit_adresar" type="submit" value="vytvořit" name="submit">
					  </form>
						   
			  </div>
		
      </div>
      <!-- Modal footer -->
      <div class="modal-footer">
        <button type="button" class="btn btn-danger" data-dismiss="modal">ZPĚT</button>
      </div>

    </div>
  </div>
</div> 
   
      
  <!-- The Modal vložit komentař -->
<div class="modal" id="modal_vlozit_komentar">
  <div class="modal-dialog  ">
    <div class="modal-content  bg-success text-white">

      <!-- Modal Header -->
      <div class="modal-header">
        <p class="modal-title">VLOŽENÍ POZNÁMKY</p>
		
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->
      <div class="modal-body">
     
	 
	 
	 <!--<h1>Vložení komentáře</h1>-->
	 <form id="form" name="form" method="post" action="#">
 

 <div class="form-group">
    <label for="text">Text:</label>
    <textarea type="text" class="form-control" id="text">  </textarea>
  </div>


  <div class="form-group">
    <label for="odkaz">Odkaz (pokud chceš):</label>
    <input type="text" class="form-control" id="odkaz">
  </div>
  <div class="form-group">
    <label for="name">Jméno:</label>
    <input type="text" class="form-control" id="name">
  </div>
  
  <button  id= "odeslat" type="submit" class="btn btn-primary">ULOŽIT</button>
</form> 
	 
	 
	 
 
	  
	
      </div>
      <!-- Modal footer -->
      <div class="modal-footer">       		
        <button type="button" class="btn btn-danger" data-dismiss="modal">ZPĚT</button>
      </div>

    </div>
  </div>
</div> 
   
  
<?php  
  require "php/console.php";
?>
  

  
  <script>   /*  ------------ vecalovo   */
$(document).ready(function(){
    $('[data-toggle="popover"]').popover();
	
	
	$('.zmenit_adresar').click(function() { 
	
 $(this).removeClass("btn-sm");
  
   var $slozka_souboru = "ztr/"
 
	});	
	
	$('#nova_slozka').click(function() { 
	
        // $("#formular_vytvoreni_slozky").toggle(700); 
	});		
	
	$('#vlozit_soubor').click(function() { 
	
        // $("#formular_vlozeni_souboru").toggle(700); 
	});		
	
	$("iframe").css({"height": "150px", "width": "100%"});
	 
});

$(document).ready(function(){
	$('#odeslat').click(function() {
		$.post("php/comment.php",
			{	 
				vzkaz: $('#text').val(),
				odkaz: $('#odkaz').val(),
				jmeno: $('#name').val(),
			
			}, function(data){
				var html = '    ';
				html += '<br><span class="datum" style="color:green; font-size:0.9em"> Tvoje čerstvá věc právě teď:</span><br>';
				html += '<span class="vzkaz">'+ $('#text').val() +' </span><br>';
				html += '<span class="vzkaz">'+ $('#odkaz').val() +' </span><br>';
				html += '<span class="jmeno"> '+ $('#name').val() +' </span> ';
				html += '';

				$('#prispevek').prepend($(html));   $('#text').val(""); $('#name').val(""); 
				              
			}
		);

		return false;
	});
	
//	$('#vybalit_formular').click(function() { $("#form_style").show(500);     $("#sbalit_formular").show(300);  $("#vybalit_formular").hide(900);  });
	
//	$('#sbalit_formular').click(function() { $("#form_style").hide(500);   $("#vybalit_formular").show(300);   $("#sbalit_formular").hide(900); });
	

 
 $(".modal_open").click(function(){
	 var detaily_name = this.value;
	 
    $("#modal_detail").modal();
  });	
	
	
var wavesurfer = WaveSurfer.create({
    container: '#waveform',
	waveColor: 'black',
	plugins: [
        WaveSurfer.regions.create({
			 regions: [
                {
                
                }
            ],
			dragSelection: {
                slop: 5
            }
		})
    ]
});
	
 
	 
				
		 
				
				
 //  WaveSurfer.getDuration()
	
wavesurfer.on('ready', function () {
 // vložit funkce aktivování controlerů
  document.getElementById("hlaska_nacitani").style.display ="none";
     // var delka_multi = WaveSurfer.getDuration();
	 var delka_multi = 3;
});




  
  $(".wave_loader").click(function(){ 
    var flek = document.getElementById("vycpavka");
      flek.scrollIntoView(); 
    document.getElementById("waveform").style.display ="block";
    document.getElementById("hlaska_nacitani").style.display ="inline";
	var val = this.getAttribute("value");
	var label_val = this.getAttribute("name");
    wavesurfer.load(val);
	
    document.getElementById("label_wave_jumbo").innerHTML = label_val;
	
  }); 

 $("#wave_play").click(function(){ 
     wavesurfer.play();
  });
  
  $("#wave_pause").click(function(){ 
     wavesurfer.pause();
  });
  
  $("#wave_od_zacatku").click(function(){ 
      wavesurfer.play(0);
  }); 
   $("#loop").click(function(){ 
   // wavesurfer.playLoop();
     var neco =  wavesurfer.getDuration();
	 
     		 wavesurfer.addRegion( {
                    start: 0,
                    end: neco-0.1,
                    color: 'hsla(400, 100%, 30%, 0.5)',
					id: 2,
					loop: true
                });
				
	 
		document.getElementById("test_delky").innerHTML = "délka smyčky: " + neco +" sekund";		
				 
  }); 
  
    $("#wave_clear_regions").click(function(){ 
     wavesurfer.clearRegions();
  });
   
  
   $("#schovat_wave_jumbo").click(function(){ 
    document.getElementById("waveform").style.display ="none";
	 //  wavesurfer.empty();
	
  });
 
   $("#empty").click(function(){ 
    document.getElementById("hlaska_nacitani").style.display ="initial";
  });

    $(".deleter").click(function(){ 
    
	var val = this.getAttribute("value");
	var label_val = this.getAttribute("name");

    document.getElementById("modal_delete_label").innerHTML = label_val;
	 document.getElementById("modal_delete_deleter").setAttribute("value", val);
	
  }); 
  
    $("#modal_delete_deleter").click(function(){ 
     var val_ke_smazani = this.getAttribute("value");
    //   
  });
  
});

 
 

</script>

 </body>
</html>

   <?php  
   ; }
  else { 
    require "php/loginbox4.php";
    
  }
?>
  
 