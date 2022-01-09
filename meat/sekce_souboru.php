		
	      <div  class=" ">   <!-- hlavička sekce složek   -->
			  
               <div class="card bg-dark text-white" style="margin-top: 1px;"> <!--      -->
                   <div class="card-body"> 
				   				 		

			   
		               <h2 style="text-align:left; display: inline; color:#ffc107 ; background-color:#343a40; font-weight: bold; text-shadow: 2px -2px 20px #ffc107;">  NAHRÁVKY </h2>
					   

	
	               </div>	
 				
               </div>  
 			

          </div>   <!-- konec hlavičky sekce složek   -->
		
			   
            <!--  odstranenej konec div   -->

          

	
	         <div  id=" " class="   ">
			   <div>  <!--  vypis souboru   -->          
				   
					<?php 

					for($x = 0; $x < $delka_pole_souboru; $x++) {

					   $soub = ($slozka_slozek.$slozka_souboru."/".$pole_souboru[$x]);
					   $label_soub = ($pole_souboru[$x]);  
					   if(is_file($soub))
						{    
						?>
						     
							   <div class="card  text-white" style="margin-bottom: 3px;" > 
							   
							    <div class="card-header" style=  " padding:2px  "> 
							      <div style="color:black  ;  display: inline" >	
									 <img src="/carvadele/zkusebna/data/icons8-rock-music-50.png" alt="-" style="max-height:30px" > 	 	 	
									   <?php echo $pole_souboru[$x]; ?>
							      </div> 
								  <button data-toggle="collapse" data-target=".val_vysuvka_<?php echo $x ?>" style="display: inline ; max-height:30px ; padding:0px ; border-width: 0px; background-color: #<?php echo $_SESSION['barva1'] ?>; ">
				                      <img style="max-height:15px" src="/carvadele/zkusebna/data/arrow128.png" alt="minimize"> 
				                  </button>
									<button    value="<?php echo $soub; ?>" name="<?php echo $label_soub; ?>" type="button" class="btn btn-sm btn-warning btn-VZ wave_loader"  style=" max-width: 120px ; display: inline" >
									   LOOPER
									</button>								 
							    </div> 
 								    							   
							   
							     <div id="" class=" val_vysuvka_<?php echo $x ?>  card-body stitek_valu collapse " style="   "   > 
							   
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
 		 			
	
			
			  		  <div  style="text-align:right;"  class="  text-white" >	<!--  tlačítka souboru  -->   	       
				          <button  id="vlozit_soubor"   type="button" class="btn btn-sm  btn-secondary"  style=" display: inline" data-toggle="modal" data-target="#modal_vlozit_soubor" >VLOŽIT</button>  
						  
                          <button  id="nahrat_zvuk"   type="button" class="btn btn-sm  btn-danger"  style=" display: inline" data-toggle="modal" data-target="#modal_nahrat_zvuk" >REC</button> 
		 
					  
			           </div>		
				</div> <!--  konec vypis souboru   --> 	
		  </div>	 <!--  konec vysuvka   --> 
		  
      <?php if ($delka_pole_souboru < 5	) 
		{ ?>
	   	
	      <div class="card  text-white" style="margin-bottom: 3px;" > 
							   
	                          <div class="card-header" style= " padding:2px "> 
							     <p>zatim tu nic není   </p> 
							  </div>  						   
							   
							  <div id="" class="card-body   " style="  "   > 
							   
						          <img src="/carvadele/zkusebna/data/singer.png" alt="-" style= " max-width:100% " > 
							   
		   					  </div> <!--card body  -->
							   
		  </div> <!-- card   -->	
		   	
	 	<?php
	 	  } 
	    ?>
		
