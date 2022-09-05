		      
    	<div class=" fixed-bottom"  >
	
			<div class="card bg-dark text-white"  style="margin-top: 1px;"> <!--hlavička nultého sloupce     -->
               <div class="card-body" style="text-align: center"> 
			   			   
			            <div  style="text-align:left; display: inline ;" >
					    	<h2 style="text-align:left; display: inline; color:#ffc107 ; background-color:#343a40; font-weight: bold; text-shadow: 2px -2px 20px #ffc107;"> LOOPER </h2> 
						</div>
		
					
	           </div>
		       <button data-toggle="collapse" data-target="#looper_vysuvka" style="display: inline ; max-height:30px ; padding:0px ; border-width: 0px; background: #<?php echo $_SESSION['barva1'] ?>; ">
			     <img style="max-height:25px; padding:3px" src="/data/ikona_colapsedown3_up.png" alt="minimize"> 
			   </button>
            </div> <!--     -->
	      
	        <div  id="looper_vysuvka" class="collapse ">
			

			
			 <div class="jumbotron " style="padding: 0rem 1rem; margin-bottom: 2px;">	

						<div style="display: inline ;  ">
							 <!--<img src="/data/icons8-sound-wave-50.png" alt="složka"  > -->
							 <h4 id="label_wave_jumbo" style="font-family: Times New Roman ; display: inline;  color:black; background-color: white"> soubor nenačten 
							 </h4> 
				        </div>			 
						 <div id="test_delky" style="display: inline ;  ">
						</div>	 
						<div style="text-align:right ; display: inline  ">
							<button id="wave_play" class="btn btn-sm btn-warning" data-action="play"> <img style="max-height:30px" src="/data/icons8-play-50-2.png" alt="play"></button>
							<button id="wave_pause" class="btn btn-sm btn-warning" data-action=" "><img style="max-height:30px" src="/data/icons8-pause-50-2.png" alt="pause"></button>
							<button id="wave_od_zacatku" class="btn btn-sm btn-warning" data-action=" "><img style="max-height:30px" src="/data/icons8-rewind-50.png" alt="od začátku"></button>
							<button id="loop" class="btn btn-sm btn-warning" data-action=" "> <img style="max-height:30px" src="/data/icons8-repeat-50.png" alt="loop"></button>
							<button id="wave_clear_regions" class="btn btn-sm btn-warning" data-action=" "> <img style="max-height:30px" src="/data/icons8-repeat-50_off.png" alt="loop"></button>
							  
						  <!-- <button id="schovat_wave_jumbo" class="btn btn-secondary" data-action=" " style="display: inline; max-height:30px ; padding:0px ; border-width: 0px;" ><img style="max-height:30px" src="/data/icons8-multiply-50.png" alt="zavřít"></button>-->				       
					    </div>	
						<div id="hlaska_nacitani" class="bg-danger" style="display:none">načítám soubor...</div>
						<div id="waveform" style="display:none">  						
						</div>
			
									
			 </div>
          </div>
		  
	</div>	  
		  