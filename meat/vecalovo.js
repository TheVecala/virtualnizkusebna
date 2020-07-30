  /*  ------------ vecalovo   */
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
	 document.getElementById("modal_rename_val_label").setAttribute("value", label_val); 
	 document.getElementById("modal_rename_val_label_novy").setAttribute("value", label_val);  
	
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

  //recorder 
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

function openNav() {
  document.getElementById("mySidenav").style.width = "300px";
  
}

/* Set the width of the side navigation to 0 and the left margin of the page content to 0 */
function closeNav() {
  document.getElementById("mySidenav").style.width = "0"; 
} 	
