		
	      <div  class=" ">   <!-- hlavička sekce složek   -->
			  
               <div class="card bg-dark text-white" style="margin-top: 1px;"> <!--      -->
                   <div class="card-body"> 
				   				 		

			   
		               <h2 style="text-align:left; color:black ;display: inline; background-color: #d5833c; ">  SOUBORY </h2>
					   
  				       <div  style="text-align:right; display: inline">	<!--  tlačítka souboru  -->   	       
				          <button  id="vlozit_soubor"   type="button" class="btn btn-sm  btn-secondary"  style=" display: inline" data-toggle="modal" data-target="#modal_vlozit_soubor" >VLOŽIT</button>  
						  
                          <button  id="nahrat_zvuk"   type="button" class="btn btn-sm  btn-danger"  style=" display: inline" data-toggle="modal" data-target="#modal_nahrat_zvuk" >REC</button> 
		 
					  
			           </div>
	
	               </div>	
				   <button data-toggle="collapse" data-target="#soubory_vysuvka" style="display: inline ; max-height:30px ; padding:0px ; border-width: 0px; background: #27a243; ">
				      <img style="max-height:25px; padding:3px" src="/data/ikona_colapsedown3.png" alt="minimize"> 
				   </button>				
               </div>  
 			

          </div>   <!-- konec hlavičky sekce složek   -->
		
			   
            <!--  odstranenej konec div   -->

 
	
	         <div  id="soubory_vysuvka" class="   ">
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
									 <img src="/data/icons8-music-record-50.png" alt="-" style="max-height:30px" > 	 	 	
									   <?php echo $pole_souboru[$x]; ?>
							      </div> 
								  <button data-toggle="collapse" data-target="#val_vysuvka_<?php echo $x ?>" style="display: inline ; max-height:30px ; padding:0px ; border-width: 0px; background: #27a243; ">
				                      <img style="max-height:15px" src="/data/arrow128.png" alt="minimize"> 
				                  </button>
								 
							    </div> 
 								    							   
							   
							     <div id="val_vysuvka_<?php echo $x ?>" class="card-body stitek_valu collapse" style="   "   > 
							   
								 <?php
								 $FileType = strtolower(pathinfo($soub,PATHINFO_EXTENSION));
								 if ($FileType == "mp3" or $FileType == "wav" )
								 {    
						         ?>
 							 
								  <audio onplay="pauseOthers(this);" controls preload="metadata" style="   height: 30px;  display: inline" >
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
		  </div>	 <!--  konec vysuvka   --> 