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
	 
	
if(isset($_SESSION['vysledek']))
	   {   $vysledek =$_SESSION['vysledek'];
    } else { $vysledek=  "zadny vysledek " ; } ;
		
if(isset($_SESSION['diskuse']))
	   {   $aktualni_diskuse =$_SESSION['diskuse'];
    } else { $aktualni_diskuse=  "diskuse_kapela1" ; } ; 
 		
if(isset($_SESSION['cely_nazev']))
	   {   $nazev =$_SESSION['cely_nazev'];
    } else { $nazev=  "celý název nebyl nastaven" ; } ; 
 
 ?> 


<?php
 
// $slozka_slozek = "uploads/";

 if($kapela!="kapela nenastavena"){  
	$slozka_slozek ="user/". $kapela."/uploads/"; 	// $slozka_slozek ="../". $kapela."/uploads/"; 	
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
     <div id="vycpavka" id="k" style="min-height:60px"> </div>               
	<div id="wave_jumbo" style="display:none" class="jumbotron bg-success">				
					<div id="label_wave_jumbo"> název souboru</div>
			        <div id="hlaska_nacitani" class="bg-danger" style="display:none">načítám soubor...</div>
                 	<div id="waveform"> 
				
				    </div>
	
	                <div class="controls">
                    <button id="wave_play" class="btn btn-warning" data-action="play"> Play/Pause </button>
                    <button id="schovat_wave_jumbo" class="btn btn-secondary" data-action=" "> zavřít</button>
					 
                    </div>
	
    </div>
   	
    	   
    <div class="row">
        <div id="adresare" class="col-md-3">  <!--  prvni sloupec   -->
		      
 
			 
			 
			<div class="card bg-dark text-white"> <!--     -->
               <div class="card-body"> 
	             <span class="card-title"> PROJEKT: </span>  <h1 style="display: inline"> <?php echo $_SESSION['kapela'] ; ?> </h1> 	 
	           </div>			  
            </div> <!--     -->
	      
			<div  class="card bg-success text-white">   <!--  formular_vytvoreni_slozky  -->
			   <div id="formular_vytvoreni_slozky" class="card-body " style="  display: none" >  
							 
				<form action="/php/vytvorit_adresar.php" method="post" enctype="multipart/form-data">
					vytvořit novou složku:
					<input id="jmeno_adresare" type="text" name="jmeno_adresare" >
					<input id="navrat" type="text" value="<?php echo $_SERVER['PHP_SELF']; ?>" name="navrat" style="display:none" >
					<input id="vytvorit_adresar" type="submit" value="vytvořit" name="submit">
				</form>
					   
			   </div>
			</div>
 
 
			<ul class="list-group">  <!--  vypis složek   -->
				<?php 
				for($x = 0; $x < $delka_pole_slozek; $x++) {
					  if ($pole_slozek[$x] == ".")  { continue; };
					  if ($pole_slozek[$x] == "..")  { continue; };
				   $soub = ($slozka_slozek.$pole_slozek[$x]);
				   
					if(is_dir($soub))
						
						  {    
						?>
						<div class="card  ">		 
						 <li class="list-group-item bg-success text-white">
								
			     			<form action="/php/zmenit_slozku.php" method="post" enctype="multipart/form-data">
							 <img src="/data/glyphicons-441-folder-closed.png" alt="složka"  > 			   
							 <input id="navrat" type="text" value="<?php echo $_SERVER['PHP_SELF']; ?>" name="navrat" style="display:none" >
							 <input id="cilova_slozka" type="text" value="<?php echo $pole_slozek[$x] ?>" name="cilova_slozka" style="display:none" >
							 <input id=" " type="submit" value="<?php echo $pole_slozek[$x] ?>" name="submit">
							</form>
						 </li>
						</div>	
						 
						<?php
						}
				}
				?>
				  <div class="card bg-success text-white">
				    <div class="card-body">	<!--  tlačítko vložení složky  -->   	       
				      <button  id="nova_slozka"   type="button" class="btn btn-secondary"  >NOVÁ SLOŽKA</button>
			        </div>
				  </div>
			</ul>
  
              
  
  

		</div>

		<div  id="k" class="col-md-5"> <!--  druhy sloupec   -->
   			<div class="card bg-dark text-white"> <!--     -->
               <div class="card-body"> 
		         <span> SLOŽKA: </span>   <h3 style="display: inline"> <?php echo $slozka_souboru 	?> 	 </h3>		 
	           </div>			  
            </div> <!--     -->
 
			<div class="card bg-success text-white">
			   
			   <div id="formular_vlozeni_souboru" class="card-body" style="display:none">  
							 
				<form action="/php/upload_uni.php" method="post" enctype="multipart/form-data">
					<h5>Vložit soubor:</h5>
					<input id="fileToUpload" type="file" value="vybrat soubor" name="fileToUpload"  >
					<input id="nahrat" type="submit" value="nahrát soubor" name="submit">
					<input id="navrat" type="text" value="<?php echo $_SERVER['PHP_SELF']; ?>" name="navrat" style="display:none" >
					<input id="" type="text" value="<?php echo $slozka_slozek.$slozka_souboru ?>" name="slozka_pro_vlozeni_souboru" style="display:none" >
				</form>
					   
			   </div>
			   <div class="card-footer">	<!--  tlačítko vložení souboru  -->   	       
				  <button  id="vlozit_soubor"   type="button" class="btn btn-secondary"  >VLOŽIT SOUBOR</button>
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
						  
							   <div class="card bg-success text-white" > 
								   <div class="card-body"> 
									<div style="color:black  ; display: inline" >	
										<img src="/data/glyphicons-18-music.png" alt="vál"  > 			
									 <div style="background-color:white ;  padding:2px ; display: inline"   >  <?php echo $pole_souboru[$x]; ?></div> 
									</div> 
								 
								 <?php
								 $FileType = strtolower(pathinfo($soub,PATHINFO_EXTENSION));
								 if ($FileType == "mp3")
								 {    
						         ?>
 							 
								  <audio controls preload="metadata" style=" width:250px; height: 30px;  display: block" >
	                                  <source src="<?php echo $soub; ?>" type="audio/mpeg">
	                                   Your browser does not support the audio element.
                                  </audio>
								  
								 <?php
								  }  
						         ?> 
								 
								 <a href="<?php echo $soub; ?>" download style="  display: inline"> 
									<button type="button" class="btn btn-sm btn-secondary" >  DOWNLOAD </button> 
								 </a>
								 
								  <?php
								 $FileType = strtolower(pathinfo($soub,PATHINFO_EXTENSION));
								 if ($FileType == "mp3")
								 {    
						         ?>  
									<button value="<?php echo $soub; ?>" name="<?php echo $label_soub; ?> " type="button" class="btn btn-sm btn-warning wave_loader"  style=" max-width: 120px ; display: inline" >										 			
									   OTEVŘÍT
									</button> 
								  <?php
								  }  
						         ?> 
                                  
									<button value="<?php echo $soub; ?>" name="<?php echo $label_soub; ?> " type="button" class="btn btn-sm btn-danger deleter"  style=" max-width: 120px ; display: inline" data-toggle="modal" data-target="#modal_delete">		
									  SMAZAT
									</button> 
								  

 
								 
								  	 					  
								 </div>
							   </div>
						   
							
						<?php
						}
					}
					?>
					
								 
			 
			
			</div>
			  
		   
			   
        </div  > <!-- druhý sloupec   -->
  
        <div class="col-md-4" > <!-- třetí sloupec   -->
 	
	     <section class="">
                   
         
      
<?php

define ("ROWS", 10);
mysql_connect("localhost", "hanakdusan", "serepes6");
mysql_select_db("18810_virtualni_zkusebna");
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
  
  
  if ($celkem>ROWS)
  {
    if (!isset($_GET["od"])) $od=1; else $od=$_GET["od"];
    $vysledek=mysql_query("select cas, vzkaz, jmeno from $aktualni_diskuse order by cas desc"." limit ".($od-1).", ".ROWS);

       echo '<div id="diskuse" style="font-size:1.5em"> ODKAZY';
       echo '  '.$od.'-';
       echo (($od+ROWS-1)<=$celkem)?($od+ROWS-1):$celkem;
       echo ' z '. $celkem.'  ';
       echo '</div> '. "\n"; 
  
         

		echo '<div id="navigace" >'. "\n";
		
		
    if ($od==1) echo '';
      else echo ' <a href=" '.$_SERVER["PHP_SELF"].'?celkem='.$celkem.'&amp;od=1">  <div id= "exit_tlac" class="btn btn-dark btn-sm" style="font-size:0.6em" >NEJNOVĚJŠÍ</div></a>   '. "\n";

  
       if ($od<ROWS) echo '';
      else echo ' <a href="'.$_SERVER["PHP_SELF"].'?celkem='.$celkem.'&amp;od='.($od-ROWS).'"> <div id= "exit_tlac"  class="btn btn-dark btn-sm" style="font-size:0.6em">NOVĚJŠÍ</div></a>  '. "\n";
 
 
       if ($od+ROWS>$celkem) echo '';
      else echo '<a href="  '.$_SERVER["PHP_SELF"].'?celkem='.$celkem.'&amp;od='.($od+ROWS).'  ">  <div id= "exit_tlac" class="btn btn-dark btn-sm" style="font-size:0.6em">STARŠÍ</div></a> '. "\n";
 
 
       if ($od>$celkem-ROWS) echo '';
      else echo '<a href="'.$_SERVER["PHP_SELF"].'?celkem='.$celkem.'&amp;od='.($celkem-$celkem%ROWS+1).' "> <div id= "exit_tlac"  class="btn btn-dark btn-sm" style="font-size:0.6em">NEJSTARŠÍ</div></a> '. "\n";
       
	   echo '</div>';  
  }
  else
  {
    $vysledek=mysql_query("select * from $aktualni_diskuse order by cas desc") ;
	
	    echo '<div id="diskuse" style="font-size:1.5em"> ODKAZY';
       echo '  '.$od.'-';
       echo (($od+ROWS-1)<=$celkem)?($od+ROWS-1):$celkem;
       echo ' z '. $celkem.'  ';
       echo '</div> '; 
     

		echo '<div id="navigace" >';
		
    if ($od==1) echo '';
      else echo ' <a href=" '.$_SERVER["PHP_SELF"].'?celkem='.$celkem.'&amp;od=1">  <div id= "exit_tlac" class="btn btn-dark btn-sm" style="font-size:0.6em" >NEJNOVĚJŠÍ</div></a>   '. "\n";

  
       if ($od<ROWS) echo '';
      else echo ' <a href="'.$_SERVER["PHP_SELF"].'?celkem='.$celkem.'&amp;od='.($od-ROWS).'"> <div id= "exit_tlac"  class="btn btn-dark btn-sm" style="font-size:0.6em">NOVĚJŠÍ</div></a>  '. "\n";
 
 
       if ($od+ROWS>$celkem) echo '';
      else echo '<a href="  '.$_SERVER["PHP_SELF"].'?celkem='.$celkem.'&amp;od='.($od+ROWS).'  ">  <div id= "exit_tlac" class="btn btn-dark btn-sm" style="font-size:0.6em">STARŠÍ</div></a> '. "\n";
 
 
       if ($od>$celkem-ROWS) echo '';
      else echo '<a href="'.$_SERVER["PHP_SELF"].'?celkem='.$celkem.'&amp;od='.($celkem-$celkem%ROWS+1).' "> <div id= "exit_tlac"  class="btn btn-dark btn-sm" style="font-size:0.6em">NEJSTARŠÍ</div></a> '. "\n";
       
	   echo '</div>'; 
     
  }
	   
  ?>    
      	   
	   <div id="form_style" class="form" style="display:none" >  
			<form id="form" name="form" method="post" action="#">
				<!--<h1>Vložení komentáře</h1>-->				 
				<label>Text </label><br>
				<textarea name="vzkaz" rows="5"  id="text"></textarea><br>				 
				<label>Odkaz (pokud chceš) </label><br>	
				<textarea name="odkaz" rows="2"  id="odkaz"></textarea><br>				
				<label>Jméno </label><br>
				<input  name="jmeno" type="text" id="name" /><br>					
				<button  id= "odeslat" type="submit" class=" btn btn-sm btn-secondary">ULOŽIT</button>
			</form>
		</div>
	    <button id="sbalit_formular"  class="ajax-file-upload-red" style="display:none" >ZAVŘÍT FORMULÁŘ</button>
        <button id="vybalit_formular" class="ajax-file-upload-pink"  >VLOŽIT NOVÝ  </button> <br>
             
	   
	   
	   
	  
 <div id="prispevek"  style="overflow: auto "><hr>  

<?php
  while ($zaznam=MySQL_Fetch_Array($vysledek))
  {
    
    echo '<div style=""><span class="vzkaz" >  '.$zaznam["vzkaz"]. ' </span><br>  '. "\n";
	echo '<div style="  text-align:right;  "><span class="jmeno"  style="font-size:0.6em; text-align:right"> VLOŽIL:&nbsp'.'</span> '. "\n";
	echo '<span class="jmeno"  style="font-size:0.9em; text-align:right"> &nbsp'.strip_tags($zaznam["jmeno"]).'&nbsp----&nbsp</span> '. "\n";
    echo '<span class="datum"  style="font-size:0.6em; align:right">'.date("j.n.Y G:i:s", ($zaznam["cas"])).'</span><br> '. "\n";
    echo '</div><hr style="font-size:0.5em;  border-width:5px; margin:0"> </div>'. "\n";
  }
  ?> 
  
  </div>   

    
      
      </section>
 
      </div> <!-- konec třetí sloupec   -->
      	
      
      
    </div> <!-- row -->

	<!-- The Modal -->
<div class="modal modal-centered " id="myModal">
  <div class="modal-dialog">
    <div class="modal-content">

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
	
	
	
 </div>     <!-- container -->
 
 
<!-- The Modal -->
<div class="modal" id="modal_delete">
  <div class="modal-dialog  ">
    <div class="modal-content">

      <!-- Modal Header -->
      <div class="modal-header">
        <p class="modal-title" id="modal_delete_label">  Soubor  </p>
		
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->
      <div class="modal-body">
         <p > Soubor je pouze pro čtení</p>
        
      </div>

      <!-- Modal footer -->
      <div class="modal-footer">
        
		  <button id="modal_delete_deleter" value="soubor_nevlozen" type="button" class="btn btn-warning" >ANO</button>
        <button type="button" class="btn btn-danger" data-dismiss="modal">NE</button>
      </div>

    </div>
  </div>
</div>
 
 
  
    <script>

console.log("DIY forever!");
console.log("  <?php echo "loged =".$loged.",  "."login= ".$login.", "."kapela= ".$kapela.", "."slozka_souboru= ".$slozka_souboru.",   "."slozka_slozek= ".$slozka_slozek.",  "; ?>  ");
console.log("  <?php echo "vysledek= ".$vysledek.",  "."id= ".$_SESSION['id'].",  "."aktualni_diskuse =".$aktualni_diskuse.",  "."SESSION aktualni_diskuse= ".$_SESSION['diskuse'].",  "."nazev= ".$_SESSION['nazev'].",  ";  ?>  ");  
 
</script>
  
  <script>   /*  ------------ vecalovo   */
$(document).ready(function(){
    $('[data-toggle="popover"]').popover();
	
	
	$('.zmenit_adresar').click(function() { 
	
 $(this).removeClass("btn-sm");
  
   var $slozka_souboru = "ztr/"
 
	});	
	
	$('#nova_slozka').click(function() { 
	
         $("#formular_vytvoreni_slozky").toggle(700); 
	});		
	
	$('#vlozit_soubor').click(function() { 
	
         $("#formular_vlozeni_souboru").toggle(700); 
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

				$('#prispevek').prepend($(html)); $("#form_style").hide(500); $('#text').val(""); $('#name').val(""); 
				              $("#vybalit_formular").show(300);   $("#sbalit_formular").hide(900);
			}
		);

		return false;
	});
	
	$('#vybalit_formular').click(function() { $("#form_style").show(500);     $("#sbalit_formular").show(300);  $("#vybalit_formular").hide(900); 
	                                     
	  
	});
	
	$('#sbalit_formular').click(function() { $("#form_style").hide(500);   $("#vybalit_formular").show(300);   $("#sbalit_formular").hide(900);
	                                   
				     
	  
	});
	
	
	$('#odeslat').click(function() { 
	});	
	
 
 $(".modal_open").click(function(){
	 var detaily_name = this.value;
	 
    $("#modal_detail").modal();
  });	
	
	
var wavesurfer = WaveSurfer.create({
    container: '#waveform',
	waveColor: 'black',
});
	
 
	
wavesurfer.on('ready', function () {
 // vložit funkce aktivování controlerů
  document.getElementById("hlaska_nacitani").style.display ="none";
});

  
  $(".wave_loader").click(function(){ 
    var flek = document.getElementById("vycpavka");
      flek.scrollIntoView(); 
    document.getElementById("wave_jumbo").style.display ="block";
    document.getElementById("hlaska_nacitani").style.display ="inline";
	var val = this.getAttribute("value");
	var label_val = this.getAttribute("name");
    wavesurfer.load(val);
	
    document.getElementById("label_wave_jumbo").innerHTML = label_val;
	
  }); 

 $("#wave_play").click(function(){ 
     wavesurfer.playPause()();
  });
  
   $("#schovat_wave_jumbo").click(function(){ 
    document.getElementById("wave_jumbo").style.display ="none";
	 wavesurfer.empty();
	
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
  
 