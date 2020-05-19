
	      <div  class=" ">   <!-- hlavička sekce mixer   -->
			  
               <div class="card bg-dark text-white" style="margin-top: 1px;"> <!--      -->
                   <div class="card-body"> 
				   				 		
		               <h2 style="text-align:left; color:black ;display: inline; background-color: #d5833c; ">  MIXER </h2>

	               </div>	
				   <button data-toggle="collapse" data-target="#mixer_vysuvka" style="display: inline ; max-height:30px ; padding:0px ; border-width: 0px; background: #27a243; ">
				      <img style="max-height:25px; padding:3px" src="/data/ikona_colapsedown3.png" alt="minimize"> 
				   </button>				
               </div>  
 			

          </div>   <!-- konec hlavičky sekce mixer   -->
		  
		  <div  id="mixer_vysuvka" class=" ">
		  
		    <div> <!--  mixer   --> 
		   
		     <div class="card bg-success text-white" style="margin-bottom: 3px;" > 
	
		  
		<tone-content>
			<tone-play-toggle></tone-play-toggle>
			<div id="tracks">
				<tone-channel label="bici" id="johny_bici"></tone-channel>
				<tone-channel label="keys" id="johny_key"></tone-channel>
				<tone-channel label="bass" id="johny_bas"></tone-channel>
			</div>
		</tone-content>
 

	<script type="text/javascript">
		function makeChannel(name){
			var channel = new Tone.Channel().toMaster();
			var player = new Tone.Player({
				url : `./data/${name}.[mp3|ogg]`,
				loop : true
			}).sync().start(0);
			player.chain(channel);

			//bind the UI
			document.querySelector(`#${name}`).bind(channel);
		}

		makeChannel("johny_bici");
		makeChannel("johny_key"); 
		makeChannel("johny_bas"); 

		document.querySelector("tone-play-toggle").bind(Tone.Transport);
	</script>
	
	
	 		 </div> <!-- card   -->
		   		   
		    </div> <!--  konec mixer  --> 
		   
		  </div>