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
				<a class="dropdown-item" href="#" data-toggle="popover" data-trigger="focus" data-content="Tahle funkce zatím nefachá">PROFIL</a> 
				<a class="dropdown-item" href="/php/login/logout.php">ODHLÁSIT SE</a>
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
     <div id="vycpavka" id="kxxxx" style="min-height:58px"> </div>               

  


    <div class="row">
	


        <div id="adresare" class="col-md-4" style="margin-bottom: 5px">  <!--  prvni sloupec   -->
		      

			<div class="card bg-dark text-white"  style="margin-top: 1px;"> <!--hlavička prvního sloupce     -->
               <div class="card-body"> 
	              <h2 style="text-align:left; color:red ; display: inline ">  PLAYLIST </h2> 
				  
				         <div  style="display: none">
						   <span class="card-title"> PROJEKT: </span> 
						   <h2 style="display: inline"> <?php echo $_SESSION['kapela'] ; ?> </h2>
				        </div>
				     
					 <div style="text-align:right; display: inline"   >		                
					   	  <button  id="nova_slozka"   type="button" class="btn btn-sm btn-secondary"  style=" display: inline" data-toggle="modal" data-target="#modal_nova_slozka"> NOVÁ SKLADBA </button>
				     </div>			  	
	           </div>			  
            </div> <!--     -->
	      
		  
            <div> <!--  playlist   -->
			
	


		 
		
			  
			  <div class=" "> <!-- zmšna složky    -->
			
		  
		  
					  <table class="table table-bordered  table-dark tabulka" style="color: #343a40; background-color: #27a243;  border-width: 10px;  border-style: solid;    " >
						<thead>
						  
						</thead>
						<tbody>
				  
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
								<div  class=" ">	<!-- tlačítko změny složky    -->  
																									
								  <tr style="  border-width: 10px;  border-style: solid;    "  >
                                   <td style="padding: 0.2rem; max-width: 339px; "> 
								  
									<form action="/php/zmenit_slozku.php" method="post" enctype="multipart/form-data"> 
									 <input id="navrat" type="text" value="<?php echo $_SERVER['PHP_SELF']; ?>" name="navrat" style="display:none" >
									 <input id="cilova_slozka" type="text" value="<?php echo $pole_slozek[$x] ?>" name="cilova_slozka" style="display:none" >
									
                                       <div style=" font-family: Times, serif;  <?php  if ($pole_slozek[$x]==$slozka_souboru)  { echo"  font-size:1.5em;;   color:white " ; } ; ?>  ">
									   
									<?php  if ($pole_slozek[$x]==$slozka_souboru)  {  ?>   
								   							   								   	
									 <img src="/data/glyphicons-145-folder-open.png" alt="složka"  > 	
																		
									 <?php  
  									 }
									 
									 else
									  { ?>
								       <img src="/data/glyphicons-441-folder-closed.png" alt="složka"  >   
									  <?php 
									 	 }
									 ; ?>
									 									 
									 <?php echo $pole_slozek[$x] ?>
                                       </div>
                                																		
								   </td> 
 
							       <td>
								   
								    <?php  if ($pole_slozek[$x]==$slozka_souboru)  {  ?>   
								   							   								
									 <?php  
  									 }
									 
									 else
									  { ?>
								         <button id=" " type="submit" style=" max-width: 120px ; display: inline" class="btn btn-sm btn-warning btn-VZ" value="  <?php echo $pole_slozek[$x] ;?> " name="submit">
                                          OTEVŘÍT
									     </button>
									  <?php 
									 	 }
									 ; ?>
									 									 
									</form>							   
								   	<button    value="<?php echo $soub; ?>" name="<?php echo $label_soub; ?> " type="button" class="btn btn-sm btn-danger btn-VZ  deleter_val"  style=" max-width: 120px ; display: inline" data-toggle="modal" data-target="#modal_delete_val"> 		
									  SMAZAT
									</button> 
								   								   
								   </td> 
								   
								  </tr> 
								</div>	
								 
								<?php
								}
						}
						?>
		  
						</tbody>
						</table>
 
				  </div>
								
		 


			
            </div> <!-- konec playlistu    -->
 
	
		</div>  <!--  konec prvniho sloupce   -->  

	 <div class="col-md-8" > <!--   druhejstřetím sloupec   -->    
		 <div class="row">
		 
		 
	        <div id="wave_jumbo"  style="display:nonexxxxx"  class="col-md-12">  <!--  nulty sloupec   -->
		      

			<div class="card bg-dark text-white"  style="margin-top: 1px;"> <!--hlavička nultého sloupce     -->
               <div class="card-body"> 
			   
			   
			            <div  style="text-align:left; display: inline ;" >
					    	<h2 style="text-align:left;; color:red ; display: inline "> LOOPER </h2> 
						 
						</div>
						
						<div style="text-align:right ; display: inline  ">
							<button id="wave_play" class="btn btn-sm btn-warning" data-action="play"> <img style="max-height:30px" src="/data/icons8-play-50-2.png" alt="play"></button>
							<button id="wave_pause" class="btn btn-sm btn-warning" data-action=" "><img style="max-height:30px" src="/data/icons8-pause-50-2.png" alt="pause"></button>
							<button id="wave_od_zacatku" class="btn btn-sm btn-warning" data-action=" "><img style="max-height:30px" src="/data/icons8-rewind-50.png" alt="od začátku"></button>
							<button id="loop" class="btn btn-sm btn-warning" data-action=" "> <img style="max-height:30px" src="/data/icons8-repeat-50.png" alt="loop"></button>
							<button id="wave_clear_regions" class="btn btn-sm btn-warning" data-action=" "> LOOP off</button>
							 
						  <button id=" " class="btn btn-secondary" data-action=" " style="display: inline ; max-height:30px ; padding:0px ; border-width: 0px; ">
						   <img style="max-height:30px" src="/data/icons8-minimize-window-64.png" alt="minimize"> </button> 
					       
						   <button id="schovat_wave_jumbo" class="btn btn-secondary" data-action=" " style="display: inline; max-height:30px ; padding:0px ; border-width: 0px;" ><img style="max-height:30px" src="/data/icons8-multiply-50.png" alt="zavřít"></button>
						
					       
					    </div>
						<div style="  ">
							   <img src="/data/icons8-sound-wave-50.png" alt="složka"  >    
							 <h4 id="label_wave_jumbo" style="font-family: Times New Roman ; display: inline;  color:black; background-color: white"> soubor nenačten 
							 </h4> 

				        </div>
				        <div id="test_delky">
						</div>	
				 
					
	           </div>
		 
            </div> <!--     -->
	      
	
	
			<div class="jumbotron bg-success" style="padding: 0rem 1rem; margin-bottom: 2px;">				
							 
							<div id="hlaska_nacitani" class="bg-danger" style="display:none">načítám soubor...</div>
							<div id="waveform" style="display:none">  
						
							</div>
			
							
			
			</div>
   	
        </div>   

		 
		 
		 
		 
		 
		<div  id="k" class="col-md-6" style="margin-bottom: 5px"> <!--  druhy sloupec   -->
		
	      <div  class=" ">   <!-- hlavička sekce složek   -->
			  
               <div class="card bg-dark text-white" style="margin-top: 1px;"> <!--      -->
                   <div class="card-body"> 
				   				 		
			  	       <div style="display: inlinexxxxxx; color:white; background-color: #27a243; padding:3px; ">
					   			   	
						 <img src="/data/glyphicons-145-folder-open.png" alt="složka"  > 	
					      <h3 style="display: inline; color:white;  "> <?php echo $slozka_souboru 	?>  </h3> 
					   </div>
			  	    				   
		               <h2 style="text-align:left; color:red;display: inline ">  SOUBORY </h2>
					   
  				       <div  style="text-align:right; display: inline">	<!--  tlačítka souboru  -->   	       
				          <button  id="vlozit_soubor"   type="button" class="btn btn-sm  btn-secondary"  style=" display: inline" data-toggle="modal" data-target="#modal_vlozit_soubor" >VLOŽIT</button>  
						  
                          <button  id="nahrat_zvuk"   type="button" class="btn btn-sm  btn-danger"  style=" display: inline" data-toggle="modal" data-target="#modal_nahrat_zvuk" >NAHRÁT</button> 
		 
					  
			           </div>
	
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
						  
							   <div class="card bg-success text-white" style="margin-bottom: 3px;" > 
							   
							    <div class="card-header" style= "  "> 
							      <div style="color:black  ; background-color:white ;  display: inline" >	
										 <!--<img src="/data/icons8-sound-wave-50.png" alt="-"  > 	 -->  	 	
									   <?php echo $pole_souboru[$x]; ?>
							      </div> 
								 
							    </div> 
 								    							   
							   
							     <div id=" " class="card-body   stitek_valu " style="   " > 
							   
								 <?php
								 $FileType = strtolower(pathinfo($soub,PATHINFO_EXTENSION));
								 if ($FileType == "mp3" or $FileType == "wav" )
								 {    
						         ?>
 							 
								  <audio controls preload="metadata" style=" width:130px___xxxxxxxxxx; height: 30px;  display: inline" >
	                                  <source src="<?php echo $soub; ?>" type="audio/mpeg">
	                                   Tak tohle neumí tvůj prohlížeč přehrát.
                                  </audio>
								  
								 <?php
								  }  
						         ?> 
								 
								  <?php
								 $FileType = strtolower(pathinfo($soub,PATHINFO_EXTENSION));
								 if ($FileType == "mp3" or $FileType == "wav")
								 {    
						          ?>  
									<button    value="<?php echo $soub; ?>" name="<?php echo $label_soub; ?>" type="button" class="btn btn-sm btn-warning btn-VZ wave_loader"  style=" max-width: 120px ; display: inline" >										 			
									   OTEVŘÍT V LOOPERU
									</button>    
								  <?php
								  }  
						          ?> 
                                  								  
								    <a href="<?php echo $soub; ?>" download style="  display: inline"> 
										<button   type="button" class="btn btn-sm btn-secondary btn-VZ"  >  STÁHNOUT </button> 
								    </a>
									  
									<button    value="<?php echo $soub;?>" name="<?php echo $label_soub;?>" type="button" class="btn btn-sm btn-info btn-VZ  presunout"  style=" max-width: 120px ; display: inline" data-toggle="modal" data-target="#modal_presunout">		
									  PŘESUNOUT
									</button> 
								  							 								  
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
  
  
        <div class="col-md-6" style="margin-bottom: 5px" > <!-- třetí sloupec   -->
       
      
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
				    
		               <h2 style="text-align:left; color:red;  display: inline ">  TEXTY </h2> 
					   
					   <div style="text-align:right;  display: inline">
                        <button id="vybalit_formular"   class="btn btn-sm  btn-secondary"  style=" display: inline" data-toggle="modal" data-target="#modal_vlozit_komentar" >NAPSAT  </button>  
           			   </div>  	
					   
					   <div  id="od_do" class="bg-dark text-white" style="font-size:0.8em">
						   <?php	   
						   echo ' '.$od.'-';
						   echo (($od+ROWS-1)<=$celkem)?($od+ROWS-1):$celkem;
						   echo ' z '. $celkem.'  ';
						   ?> 				   
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
      	 </div>
      </div> <!--   konec druhejstřetím sloupec   -->  
     <!--   <img src="/data/singer.png" alt="složka"  >       --> 
    </div> <!-- row -->
	
	 

 </div>     <!-- container -->
 
 
<div>  <!--  MODALS --> 
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
        DIY a Open source projekt ze Štatlu. <br><br>
		Plugin pro sdílení nahrávek hudebních skupin mezi jejímy členy. <br>   <br>
		Tohle není prostor pro volné ukládání dat většího množství uživatelů. 
		Vhodná je instalace na vlastní doménu.  <br> <br><br>
		Pro více info pište na adresu: <i>  the@vecala.cz  </i> 
	    
		</p>
		<p>
		Thanks to:<br>
		wavesurfer.js<br>
		jahů
		
          </p>
		  <button type="button" class="btn btn-swcondary"  >INSTALACE NA VLASTNÍ DOMÉNĚ</button><br>
          <button type="button" class="btn btn-dark"  >ÚČET NA VIRTUALNIZKUSEBNA.CZ</button>
      </div>

      <!-- Modal footer -->
      <div class="modal-footer">
 
        <button type="button" class="btn btn-danger" data-dismiss="modal">ZAVŘÍT</button>
      </div>

    </div>
  </div>
</div>
	
	
  <!-- The Modal DELETE soubor-->
<div class="modal" id="modal_delete">
  <div class="modal-dialog  ">
    <div class="modal-content bg-success text-white">

      <!-- Modal Header -->
      <div class="modal-header">
	      smazat soubor:
		
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->
	  
	 	<form action="/php/smazat_soubor.php" method="post" enctype="multipart/form-data"  style="display:inline">
	
             <div class="modal-body">
     		       
                     <p id="modal_delete_label" class="modal-title">  Soubor   </p>
					  <div class="form-group"  style="display:none">
						<label for="soubor_ke_smazani">smazat soubor:</label>
						<input id="modal_delete_deleter" type="text" class="form-control"  value="soubor ke smazání_nevložen " name="soubor_ke_smazani">
					  </div>				
										 							 
					  <div class="form-group"  style="display:none">
						<label for="navrat">navrat:</label>
						<input type="text" class="form-control" value="<?php echo $_SERVER['PHP_SELF'] ?>" name="navrat">
					  </div>
			  		
            </div>	  

      <!-- Modal footer -->
            <div class="modal-footer">
	  						 
				<button  id= "nahrat" type="submit" class="btn btn-danger">smazat</button>
 				<button type="button" class="btn btn-primary" data-dismiss="modal" style="display: inline">ZPĚT</button>	 
	  
 
        
          </div>
	   </form>
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
     
	   	   	<form action="/php/upload_uni.php" method="post" enctype="multipart/form-data"  style="display:inline">
			 
					<div class="form-group">
					   <label for="fileToUpload">Vybrat soubor:</label>
			    	   <input type="file" class="form-control" name="fileToUpload">
				    </div>				
					
					 
					 <button  id= "nahrat" type="submit" class="btn btn-primary">VLOŽIT SOUBOR</button>
					
				 
					  <div class="form-group"  style="display:none">
						<label for="navrat">navrat:</label>
						<input type="text" class="form-control" value="<?php echo $_SERVER['PHP_SELF'] ?>" name="navrat">
					  </div>
					
				 
					  <div class="form-group"  style="display:none">
						<label for="slozka_pro_vlozeni_souboru">navrat</label>
						<input type="text" class="form-control"  value="<?php echo $slozka_slozek.$slozka_souboru ?>" name="slozka_pro_vlozeni_souboru">
					  </div>					
					
				</form>
				  <button type="button" class="btn btn-danger" data-dismiss="modal" style="display: inline">ZPĚT</button>	   		
      </div>
      <!-- Modal footer -->
      <div class="modal-footer">
       
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
     
	   	      
								 
					  <form action="/php/vytvorit_adresar.php" method="post" enctype="multipart/form-data" style="display: inline">
					  
					    <div class="form-group">
                          <label for="jmeno_adresare">vytvořit novou složku:</label>
                          <input type="text" class="form-control" name="jmeno_adresare">  
                        </div>
                        <div class="form-group"  style="display:none">
                          <label for="sekce">sekce:</label>
                          <input type="text" class="form-control" name="sekce" value="<?php echo $sekce ; ?>" >  
                        </div>
                        <div class="form-group"  style="display:none">
                          <label for="navrat">navrat:</label>
                          <input type="text" class="form-control" name="navrat" value="<?php echo $_SERVER['PHP_SELF']; ?>" >  
                        </div>
						
						<button  id= "vytvorit_adresar" type="submit" class="btn btn-primary" >vytvořit</button>
					  </form>
					  <button type="button" class="btn btn-danger" data-dismiss="modal" style="display: inline">ZPĚT</button>	   
			  
		
      </div>
      <!-- Modal footer -->
      <div class="modal-footer">
       
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
	 <form id="form" name="form" method="post" action="php/vlozit_komentar.php">
 
 <div class="form-group">
    <label for="text">Text:</label>
    <textarea type="text" class="form-control" name="text">  </textarea>
  </div>

  <div class="form-group">
    <label for="odkaz">Odkaz (pokud chceš):</label>
    <input type="text" class="form-control" name="odkaz">
  </div>
  <div class="form-group">
    <label for="name">Jméno:</label>
    <input type="text" class="form-control" name="name">
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
   
  
         
  <!-- The Modal  modal_skin -->
<div class="modal" id="modal_skin">
  <div class="modal-dialog  ">
    <div class="modal-content  bg-success text-white">

      <!-- Modal Header -->
      <div class="modal-header">
        <p class="modal-title">ZMĚNIT ROZVRŽENÍ STRÁNKY</p>
		
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->
      <div class="modal-body">
     
	 
	 
	 
	 <form id="form" name="form" method="post" action="php/zmenit_skin.php">
 


 <div class="form-check">
  <label class="form-check-label">
    <input type="radio" class="form-check-input" name="skin" value="skin1">DEFAULT
  </label>
</div>
<div class="form-check">
  <label class="form-check-label">
    <input type="radio" class="form-check-input " disabled name="skin" value="skin2">FUNKY
  </label>
</div>
<div class="form-check  ">
  <label class="form-check-label">
    <input type="radio" class="form-check-input " disabled name="skin" value="skin3">MINI
  </label>
</div> 


   <button  id= "odeslat" type="submit" class="btn btn-primary">NASTAVIT</button>
  

</form> 
	 
	 	  
	
      </div>
      <!-- Modal footer -->
      <div class="modal-footer">   
	  
        <button type="button" class="btn btn-danger" data-dismiss="modal">ZPĚT</button>
      </div>

    </div>
  </div>
</div> 
   
     
    <!-- The Modal DELETE vál -->
<div class="modal" id="modal_delete_val">
  <div class="modal-dialog  ">
    <div class="modal-content bg-success text-white">

      <!-- Modal Header -->
      <div class="modal-header">
          smazat celou skladbu:     
		  <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->  
	 	<form action="/php/smazat_val.php" method="post" enctype="multipart/form-data"  style="display:inline">
	
             <div class="modal-body">
     		          <p id="modal_delete_val_label" class="modal-title">  skladba   </p>
					  <div class="form-group"  style="display:none">
						<label for="val_ke_smazani">smazat skladbu:</label>
						<input id="modal_delete_val_deleter" type="text" class="form-control"  value="vál ke smazání_nevložen " name="val_ke_smazani">
					  </div>				
										 							 
					  <div class="form-group"  style="display:none">
						<label for="navrat">navrat:</label>
						<input type="text" class="form-control" value="<?php echo $_SERVER['PHP_SELF'] ?>" name="navrat">
					  </div>
			  		
            </div>	  

      <!-- Modal footer -->
            <div class="modal-footer">	 
			 <p  > Pozor! Smazat lze pouze prázdnou skladbu!   </p>
				<button  id= "nahrat" type="submit" class="btn btn-danger">odstranit celou skladbu</button>
 				<button type="button" class="btn btn-primary" data-dismiss="modal" style="display: inline">ZPĚT</button>	         
            </div>
	   </form>
    </div>
  </div>
</div>
  
  
  <!-- The Modal presunout soubor-->
<div class="modal" id="modal_presunout">
  <div class="modal-dialog  ">
    <div class="modal-content bg-success text-white">

      <!-- Modal Header -->
      <div class="modal-header">
	      přesunout soubor
		
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->
	  
	 	<form action="/php/presunout_soubor.php" method="post" enctype="multipart/form-data"  style="display:inline">
	
             <div class="modal-body">
     		       
                      <p id="modal_presunout_label" class="modal-title"  style="display:none">  Soubor   </p>     
					 
		              <div class="form-group"  style="display:none_xxxxxxxxxxxx">
						<label for="presunout_co">přesunout:</label>
						<input id="modal_presunout_co" type="text" class="form-control"  value="" name="presunout_co">
				      </div> 
					 
                      <div class="form-group"  style="display:none">
						<label for="presunout_odkud">presunout_odkud:</label>
						<input id="modal_presunout_odkud" type="text" class="form-control"  value="soubor k přesunu nevložen" name="presunout_odkud">	
					  </div> 
					  
					  <div class="form-group"  style="display:none_xxxxxxxxxxxx">
						<label for="presunout_odkud_label">ze složky:</label>
						<input id="modal_presunout_odkud_label" type="text" class="form-control"  value="<?php echo $slozka_souboru;?>" name="presunout_odkud_label">	
					  </div>				
						
					  <div class="form-group">
						  <label for="modal_presunout_kam">do složky:</label>
						  <select class="form-control" id="modal_presunout_kam" name="presunout_kam">
						  
						  
		  		<?php 
						for($x = 0; $x < $delka_pole_slozek; $x++) {
						
							  if ($pole_slozek[$x] == ".")  { continue; };
							  if ($pole_slozek[$x] == "..")  { continue; };
						      $soub = ($slozka_slozek.$pole_slozek[$x]);
						      $label_soub = "test";
						      $label_soub = ($pole_slozek[$x]);  
							  
						      if(is_dir($soub))
								
								{    echo   	"<option>".$pole_slozek[$x]."</option>" ; }
						}
				?>
							
						  </select>
					  </div> 
	
					  <div class="form-group"  style="display:none">
						<label for="presunout_cesta">přesunout cesta:</label>
						<input id="modal_presunout_odkud_label" type="text" class="form-control"  value="../user/silentroom/338786519/uploads/" name="presunout_cesta">	
					  </div>				
	
					  
						
					  <div class="form-group"  style="display:none">
						<label for="navrat">navrat:</label>
						<input type="text" class="form-control" value="<?php echo $_SERVER['PHP_SELF'] ?>" name="navrat">
					  </div>
			 						
				
			  		
            </div>	  

      <!-- Modal footer -->
            <div class="modal-footer">
	  						 
				<button  id= "presun" type="submit" class="btn btn-primary">PŘESUNOUT</button>
 				<button type="button" class="btn btn-danger" data-dismiss="modal" style="display: inline">ZPĚT</button>	 
	  
 
        
          </div>
	   </form>
    </div>
  </div>
</div>  

    <!-- The Modal nahrat_zvuk -->
<div class="modal" id="modal_nahrat_zvuk">
  <div class="modal-dialog  ">
    <div class="modal-content bg-success text-white">

      <!-- Modal Header -->
      <div class="modal-header">
            <p>record</p>
		  <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->  
	  
             <div class="modal-body">
     	    	<div class="container text-center">
					
					<button  id="record_button" class="btn btn-primary">ZAČÍT NAHRÁVAT</button> <!--  nahrávání   -->
					<ul id="playlist"></ul> <!--  cíl nahrávání   -->
               </div>		  		
            </div>	  

      <!-- Modal footer -->
            <div class="modal-footer">	 
 				<button type="button" class="btn btn-danger" data-dismiss="modal" style="display: inline">ZPĚT</button>	         
            </div>
	  
    </div>
  </div>
</div>
  

</div>  <!-- KONEC MODALS -->
  
  
  
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
	$('#odeslatxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx').click(function() {
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
  
     $(".deleter_val").click(function(){ 
    
	var val = this.getAttribute("value");
	var label_val = this.getAttribute("name");

    document.getElementById("modal_delete_val_label").innerHTML = label_val;
	 document.getElementById("modal_delete_val_deleter").setAttribute("value", val);
	
  }); 
  
 
  
    $("#modal_delete_deleter").click(function(){ 
    var val_ke_smazani = this.getAttribute("value");
    // nevyužito   
 
  });
  
     $(".presunout").click(function(){ 
    
	var val = this.getAttribute("value");
	var label_val = this.getAttribute("name");

	document.getElementById("modal_presunout_odkud").setAttribute("value", val);
    document.getElementById("modal_presunout_label").innerHTML = label_val;
	document.getElementById("modal_presunout_co").value = label_val;

	 
	
  });  
 
 
  
  
 function zobraz() {
  var elmnt = document.getElementById("k");
  elmnt.scrollIntoView();
} 
  
  
});


</script>

<script>  //kalendář

  document.addEventListener('DOMContentLoaded', function() {
    var calendarEl = document.getElementById('calendar');

    var calendar = new FullCalendar.Calendar(calendarEl, {
       plugins: [ 'interaction', 'dayGrid', 'timeGrid', 'list' ],
      header: {
        left: 'prev,next today',
        center: 'title',
        right: 'dayGridMonth,timeGridWeek,timeGridDay'
      }, 
	  

	 select: function(arg) {
        var title = prompt('akce od:' + arg.startStr + 'do:' + arg.endStr);
        if (title) {
          calendar.addEvent({
            title: title,
            start: arg.start,
            end: arg.end,
            allDay: arg.allDay
          })
        }
		
		
		// vložení eventu do databáze
		
		// if exist databáze_kalendář1  
		   // {
			  // vloz_event(title,start,end),
			  // calendar.render();
		   // },
		   
		   
		   
        calendar.unselect()
      },
	
	
	 locale: 'cs', 
      navLinks: true, // can click day/week names to navigate views
      selectable: true,
      selectMirror: true,
     
      editable: true,
      eventLimit: true, // allow "more" link when too many events
      events: [
        {
          title: 'All Day Event',
          start: '2019-10-12'
        },  
        {
          title: 'Click for Google', 
          start: '2019-08-28'
        }
      ]
    });

    calendar.render();
  });
  
  
   calendar.addEvent({
            title: 'dušan',
            start: 2019-10-12 ,
            end: 2019-10-14  
          });
  
   calendar.render();
 
</script> 


<script> zobraz() </script> 


  <script src="https://webrtc.github.io/adapter/adapter-latest.js"></script>
  <script src="https://unpkg.com/mic-recorder-to-mp3"></script>  
  <script src="js/index.js"></script>
  <script>
    const button = document.getElementById('record_button');
    const recorder = new MicRecorder({
      bitRate: 128
    });

    button.addEventListener('click', startRecording);

    function startRecording() {
      recorder.start().then(() => {
        button.textContent = 'Zastavit nahrávání';
        button.classList.toggle('btn-danger');
        button.removeEventListener('click', startRecording);
        button.addEventListener('click', stopRecording);
      }).catch((e) => {
        console.error(e);
      });
    }

    function stopRecording() {
      recorder.stop().getMp3().then(([buffer, blob]) => {
        console.log(buffer, blob);
        const file = new File(buffer, 'music.mp3', {
          type: blob.type,
          lastModified: Date.now()
        });

        const li = document.createElement('li');
        const player = new Audio(URL.createObjectURL(file));
        player.controls = true;
        li.appendChild(player);
        document.querySelector('#playlist').appendChild(li);

        button.textContent = 'Začít nahrávat';
        button.classList.toggle('btn-danger');
        button.removeEventListener('click', stopRecording);
        button.addEventListener('click', startRecording);
      }).catch((e) => {
        console.error(e);
      });
    }
  </script>
 </body>
</html>

   <?php  
   ; }
  else { 
    require "php/loginbox4.php";
    
  }
?>
  
 