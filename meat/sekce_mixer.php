
	      <div  class=" ">   <!-- hlavička sekce mixer   -->
			  
               <div class="card bg-dark text-white" style="margin-top: 1px;"> <!--      -->
                   <div class="card-body"> 
				   				 		
		               <h2 style="text-align:left;  display: inline; color:#ffc107 ; background-color:#343a40; font-weight: bold; text-shadow: 2px -2px 20px #ffc107; ">  MIXER </h2>

	               </div>	
 				
               </div>  
 			

          </div>   <!-- konec hlavičky sekce mixer   -->
		  
		  <div  id=" "  >
		  
		    <div > <!--  mixer   --> 
		         
		     <div class="card bg-success text-white" style="margin-bottom: 3px;" > 
	               <div id="loading"> načítám...   </div> 
		  
		<tone-content>
			<tone-play-toggle></tone-play-toggle>
			<div id="tracks">
				<tone-channel label="bicí automat" id="tonic_42_1_bici"></tone-channel>
				<tone-channel label="basa Dušan" id="tonic_42_1_basa"></tone-channel>
				<tone-channel label="kytara Marec" id="tonic_42_1_kytara"></tone-channel>
				<tone-channel label="zpěv Vodys" id="tonic_42_1_zpev"></tone-channel>
			</div>
		</tone-content>
 

	<script type="text/javascript">
	
	  function nahrano() {
		 document.getElementById("loading").style.display ="none"; 
		  
	  };
	
		function makeChannel(name){
			var channel = new Tone.Channel().toMaster();
			var player = new Tone.Player({
				url : `./user/carvadele/2106703441/uploads/to nic neni/mixer/${name}.[mp3|ogg]`,
				loop : true,
				onload: nahrano()
			}).sync().start(0);
			player.chain(channel);

			//bind the UI
			document.querySelector(`#${name}`).bind(channel);
		};

		makeChannel("tonic_42_1_bici"); 
		makeChannel("tonic_42_1_basa");
		makeChannel("tonic_42_1_kytara");  
		makeChannel("tonic_42_1_zpev"); 

		document.querySelector("tone-play-toggle").bind(Tone.Transport);
	</script>
	
	
	 		 </div> <!-- card   -->
		   		   
		    </div> <!--  konec mixer  --> 
		   
		  </div>