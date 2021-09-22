 <?php
     $aktualni_text_s_cestou = $slozka_slozek.$slozka_souboru."/texty/".$aktualni_text;
	 
	 if (file_exists($aktualni_text_s_cestou))  { 
	 
	    $akordy = fopen($aktualni_text_s_cestou, "r") ;
	 } 
	 else{
		  $akordy = "akordy_neexistuji" ;
	 } 	 ; 	
	 
 ?>


	      <div  class=" ">   <!-- hlavička sekce akordu   -->
			  
               <div class="card bg-dark text-white" style="margin-top: 1px;"> <!--      -->
                   <div class="card-body"> 
				   				 		

			   
		               <h2 style="text-align:left;  display: inline; color:#ffc107 ; background-color:#343a40; font-weight: bold; text-shadow: 2px -2px 20px #ffc107; ">TEXT</h2>
					   
 
	
	               </div>	
 			
               </div>  
 			

          </div>   <!-- konec hlavičky sekce akordu   -->
		
          <div  id=" "  >
		  
		   <div> <!--  akordy   --> 
		   
	

          	<div class="card  text-white" style="margin-bottom: 3px;" > 
							   
	                          <div class="card-header" style= "  "> 
							      <!-- <img src="/data/icons8-sound-wave-50.png" alt="-"  > -->
							      <div style="color:black  ; background-color:#faf9f999 ;  display: inline" >	
											  	 	
									  <?php echo $slozka_souboru 	?> 
									  
							      </div> 
								  <button data-toggle="collapse" data-target="#akordy_vnitrni_vysuvka_<?php echo $x ?>" style="display: inline ; max-height:30px ; padding:0px ; border-width: 0px; background-color: #<?php echo $_SESSION['barva1'] ?>; ">
				                      <img style="max-height:30px" src="/data/ikona_colapsedown4.png" alt="minimize"> 
				                  </button>
								 
							  </div> 
 								    							   
							   
	
	 <?php
 	 if ($akordy == "akordy_neexistuji")  { 
	  ?>
	 
	                      <div class="card  text-white" style="margin-bottom: 3px;" > 
							   
	                          <div class="card-header" style= "  "> 
							     <p>zatim tu nic není   </p> 
							  </div>  						   
							   
							  <div id="" class="card-body   " style="  "   > 
							   
						          <img src="/data/singer.png" alt="-" style= " max-width:100% " > 
							   
		   					  </div> <!--card body  -->
							   
		                 </div> <!-- card   -->	
	  
	 <?php  
	 } 
	 else{
	 ?>

	

	
						      <div id="akordy_vnitrni_vysuvka_<?php echo $x ?>" class="card-body stitek_valu collapse show  " style="  "   > 
							   
							  	  <li class="list-group-item vzkaz_karta " style="color:black; background-color:#faf9f999">
									   <span class="vzkaz" > 
									     <pre style="overflow-x: auto"><?php
											while(!feof($akordy)) {
											  echo fgets($akordy);
											}
											fclose($akordy);
										    ?></pre>
									   </span>
			     	<!-- 	 <br>      -->  
								
								
									   
								  </li>

  				       <div  style="text-align:right;">	<!--  tlačítka souboru  -->   	       
				          <button  id="vlozit_soubor"   type="button" class="btn btn-sm  btn-secondary"  style=" display: inline" data-toggle="modal" data-target="#modal_zmenit_text" >ZMĚNIT</button>  
						  
                				  
			           </div>							   
							   
							   
		   					  </div> <!--card body  -->
							  
							  
							  
							  
		 <?php		 
	  } ; 	
	 ?>
							  
							  
							  
							   
		   </div> <!-- card   -->
		   
		   
		   </div> <!--  konec info  --> 
		   
		  </div>
