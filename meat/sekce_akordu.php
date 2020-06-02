 <?php
     $aktualni_text_s_cestou = $slozka_slozek.$slozka_souboru."/texty/".$aktualni_text;
	 
	 if (file_exists($aktualni_text_s_cestou))  { 
	 
	    $akordy = fopen($aktualni_text_s_cestou, "r") ;
	 } 
	 else{
		  $akordy = fopen($aktualni_text_s_cestou, "w") ;
	 } 	 ; 	
	
	 
	 
	 
	 
 ?>


	      <div  class=" ">   <!-- hlavička sekce akordu   -->
			  
               <div class="card bg-dark text-white" style="margin-top: 1px;"> <!--      -->
                   <div class="card-body"> 
				   				 		

			   
		               <h2 style="text-align:left; color:black ;display: inline; background-color: #d5833c; ">  AKORDY </h2>
					   
  				       <div  style="text-align:right; display: inline">	<!--  tlačítka souboru  -->   	       
				          <button  id="vlozit_soubor"   type="button" class="btn btn-sm  btn-secondary"  style=" display: inline" data-toggle="modal" data-target="#modal_zmenit_text" >ZMĚNIT</button>  
						  
                				  
			           </div>
	
	               </div>	
				   <button data-toggle="collapse" data-target="#akordy_vysuvka" style="display: inline ; max-height:30px ; padding:0px ; border-width: 0px; background: #27a243; ">
				      <img style="max-height:25px; padding:3px" src="/data/ikona_colapsedown3.png" alt="minimize"> 
				   </button>				
               </div>  
 			

          </div>   <!-- konec hlavičky sekce akordu   -->
		
          <div  id="akordy_vysuvka" class="collapse show   ">
		  
		   <div> <!--  akordy   --> 
		   
		   <div class="card bg-success text-white" style="margin-bottom: 3px;" > 
							   
	                          <div class="card-header" style= "  "> 
							      <!-- <img src="/data/icons8-sound-wave-50.png" alt="-"  > -->
							      <div style="color:black  ; background-color:white ;  display: inline" >	
											  	 	
									    VERZE
							      </div> 
								  <button data-toggle="collapse" data-target="#akordy_vnitrni_vysuvka_<?php echo $x ?>" style="display: inline ; max-height:30px ; padding:0px ; border-width: 0px; background: #27a243; ">
				                      <img style="max-height:30px" src="/data/ikona_colapsedown4.png" alt="minimize"> 
				                  </button>
								 
							  </div> 
 								    							   
							   
							  <div id="akordy_vnitrni_vysuvka_<?php echo $x ?>" class="card-body stitek_valu collapse show  " style="  "   > 
							   
							  	  <li class="list-group-item vzkaz_karta " style="color:black">
									   <span class="vzkaz" > 
									     <pre style="overflow-x: auto"><?php
											while(!feof($akordy)) {
											  echo fgets($akordy);
											}
											fclose($akordy);
										    ?></pre>
									   </span><br>  
									   <div style="text-align:right; ">
										 <span class="jmeno"  style="font-size:0.6em; "> VLOŽIL:&nbsp </span> 
										 <span class="jmeno"  style="font-size:0.9em; ">  <?php echo strip_tags($zaznam["jmeno"])?> &nbsp </span> 
										 <span class="datum"  style="font-size:0.6em; ">  <?php echo date("j.n.Y G:i:s", ($zaznam["cas"]))?> </span> 
									   </div>
									   
								  </li>
							   
		   					  </div> <!--card body  -->
							   
		   </div> <!-- card   -->
		   
		   
		   </div> <!--  konec info  --> 
		   
		  </div>
