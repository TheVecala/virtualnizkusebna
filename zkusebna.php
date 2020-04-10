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
		   <!-- kalendář -->	
	<link href='fullcalendar/core/main.css' rel='stylesheet' />
    <link href='fullcalendar/daygrid/main.css' rel='stylesheet' />
    <link href='fullcalendar/timegrid/main.css' rel='stylesheet' />
	<link href='fullcalendar/list/main.css' rel='stylesheet' />
	<script src='fullcalendar/core/main.js'></script>
	<script src='fullcalendar/interaction/main.js'></script>
	<script src='fullcalendar/daygrid/main.js'></script>
	<script src='fullcalendar/timegrid/main.js'></script>
	<script src='fullcalendar/list/main.js'></script> 
	<script src='fullcalendar/core/cs.js'></script> 
	 
	

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
      <?php   require "php/meat/header.php";?>
    </header>
     
	 
 <div class="container-fluid">
    <div id="vycpavka"   style="min-height:58px"> </div>               

    <div class="row">
	
        <div id="adresare" class="col-md-4" style="margin-bottom: 5px ; display:none">  <!--  prvni sloupec   -->		      				  
			<?php   require "php/meat/prvni.php";?>
		</div>  <!--  konec prvniho sloupce   -->  
        
		<!--   druhejstřetím sloupec   -->
	    <div class="col-md-8" >     
	 
         <!--   hlavicka druhyhostretim sloupce -->  
            <div class=" ">
                <?php 	  require "php/meat/druhy_s_tretim.php";	?>
	       </div>
		 <div class="row">
		 
		 	   <!--  nulty sloupec   --> 
			   <div id="wave_jumbo"  style="display:nonexxxxx ;  margin-bottom: 5px; "  class="col-md-12"> 
					<?php 	  require "php/meat/nulty.php";	?>								
			   </div>   <!-- konec nulty sloupec   -->

			   <!--  druhy sloupec   -->
		       <div  id="k" class="col-md-6" style="margin-bottom: 5px"> 
				    <?php 	require "php/meat/druhy.php";	?>
		       </div  > <!-- konec druhý sloupec   -->
  
               <!-- třetí sloupec   --> 
			   <div class="col-md-6" style="margin-bottom: 5px" > 
					<?php   require "php/meat/treti.php";	?>						
			   </div> <!-- konec třetí sloupec   -->
			
      	  </div> <!-- konec row   -->
        </div> <!--   konec druhejstřetím sloupec   -->  
 
        <!-- čtvrtý sloupec   -->
		<div class="col-md-4" style="margin-bottom: 5px" >   
 			<?php   require "php/meat/ctvrty.php";	?>
	    </div> <!-- konec čtvrtý sloupec   --> 	 
	 	 
    </div> <!-- row -->
	
 </div>     <!-- container -->
 
 
 <div>  <!--  MODALS --> 
   	<?php  require "php/meat/modals.php"; ?>				
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
	$("#looper_vysuvka").collapse('show'); 
	
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
	 document.getElementById("test_delky").innerHTML = "";
  });
   
  
   $("#schovat_wave_jumbo").click(function(){ 
      // document.getElementById("waveform").style.display ="none";
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
  
    $("#skin_default").click(function(){ 
     $("#playlist_vysuvka").collapse('show') ;  
     $("#looper_vysuvka").collapse('show');  
     $("#soubory_vysuvka").collapse('show');  
     $("#texty_vysuvka").collapse('show') ;
	 $("#modal_skin").modal("hide");
	
  });
    $("#skin_mini").click(function(){ 
     $("#playlist_vysuvka").collapse('hide') ;  
     $("#looper_vysuvka").collapse('hide');  
     $("#soubory_vysuvka").collapse('hide');  
     $("#texty_vysuvka").collapse('hide'); 
	 $("#modal_skin").modal("hide");
	
  });  
 
 
  

	function rolna_playlist_show(){ $("#playlist_vysuvka").collapse('show') ;  };
	function rolna_playlist_hide(){ $("#playlist_vysuvka").collapse('hide') ;  };	
	function rolna_looper_show(){ $("#looper_vysuvka").collapse('show') ;  };
	function rolna_looper_hide(){ $("#looper_vysuvka").collapse('hide') ;  };
    function rolna_soubory_show(){ $("#soubory_vysuvka").collapse('show') ;  };
	function rolna_soubory_hide(){ $("#soubory_vysuvka").collapse('hide') ;  };	
	function rolna_texty_show(){ $("#texty_vysuvka").collapse('show') ;  };
	function rolna_texty_hide(){ $("#texty_vysuvka").collapse('hide') ;  };
	function rolna_val_show(){ $("#val_vysuvka").collapse('show') ;  };
	function rolna_val_hide(){ $("#val_vysuvka").collapse('hide') ;  };
	

<?php	
 if($_SESSION['rolna_playlist'] == "show")
	   { echo"rolna_playlist_show();";
    } else { echo"rolna_playlist_hide();"; } ; 	
	
 if($_SESSION['rolna_looper'] == "show")
	   { echo"rolna_looper_show();";
    } else { echo"rolna_looper_hide();"; } ;	
		
 if($_SESSION['rolna_soubory'] == "show")
	   { echo"rolna_soubory_show();";
    } else { echo"rolna_soubory_hide();"; } ;	
		
 if($_SESSION['rolna_texty'] == "show")
	   { echo"rolna_texty_show();";
    } else { echo"rolna_texty_hide();"; } ;		
 ?>	
   
  
 // document.getElementById("playlist_vysuvka").setAttribute("class","show");
  
  function pauseOthers(aktualni) {  // zatím nefunguje
                $("audio").not(aktualni).each(function (index, audio) {
                    audio.pause();
                });
            };
 function zobraz() {
  var elmnt = document.getElementById("k");
  elmnt.scrollIntoView();
} 
  ;
  
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


<script> zobraz(); //k ničemu asi	</script> 


  <script src="https://webrtc.github.io/adapter/adapter-latest.js"></script> 
  <script src="https://unpkg.com/mic-recorder-to-mp3"></script>  
  <script src="js/index.js"></script>
  <script>   //recorder 
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
  
 