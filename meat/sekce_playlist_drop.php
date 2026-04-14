 	      		  
            <div> <!--  playlist   -->
					  
			  <div  id=" "  style=" padding: 3px;"> <!-- zmšna složky    -->
			 
			  	<div style="text-align:center">
					 
					<div>
				      <ul class="list-group list-group-flush">
						<?php 
						for($x = 0; $x < $delka_pole_slozek; $x++) {
							  if ($pole_slozek[$x] == ".")  { continue; };
							  if ($pole_slozek[$x] == "..")  { continue; };
						   $soub = ($slozka_slozek.$pole_slozek[$x]);
						  
						   $label_soub = ($pole_slozek[$x]);  
						   

						   
							if(is_dir($soub))
								  {    
						    $soubor_s_nazvem = $soub."/data/nazev_valu.txt";
	 
	                            if (file_exists($soubor_s_nazvem))  { 
	 
								$cely_nazev = fopen($soubor_s_nazvem, "r") ;
							 } 

 					 
							  
								?>
						<li class="list-group-item list-group-item-action <?php  if ($pole_slozek[$x]==$slozka_souboru)  { echo"  active " ; } ; ?> " style="padding:0px; background-color:#939731; <?php  if ($pole_slozek[$x]==$slozka_souboru)  { echo"  background-color:",$_SESSION['barva1']," ; color: white " ; } ; ?> ">

						<!-- tlačítko změny složky    --> 
											 
                            <div style=" " > 
								  
									<form action="/php/zmenit_slozku.php" method="post" enctype="multipart/form-data"> 
									 <input id="navrat" type="text" value="<?php echo $_SERVER['PHP_SELF']; ?>" name="navrat" style="display:none" >
									 <input id="cilova_slozka" type="text" value="<?php echo $pole_slozek[$x] ?>" name="cilova_slozka" style="display:none" >
									
                                <div class="media border " style="font-size: 0.8rem;     ">
								
																	   
									<?php   
   									   if ($pole_slozek[$x]==$slozka_souboru)  {  ?>   
								   							   								   	
									 <img src="/data/icons8-music-record-50.png" alt="složka" style="max-height:30px" class="mr-3  " > 	
																		
									 <?php  
  									 }
									 
									 else
									  {
									  };
										   
										  ?>
								       
									 
								  				
								   <div class="media-body" style="  max-width: 339px; text-align: center; max-height:100%" >
																
									   <div  style="display: inline; position: absolute;  left: 5px;  margin-right:10px;  "> 
									      <div  style=" text-align: left; color: #a6d8b0; "> 
									 
										  </div> 
									   </div> 
								       <div  style="  display: inline; position: relative;  z-index: 5; " >
 
								  				
								    <?php  if ($pole_slozek[$x]==$slozka_souboru)  {

                                     ?>
									  <h4>
								    <?php 
                                            	while(!feof($cely_nazev)) {
											    echo fgets($cely_nazev);
											    }
										     	fclose($cely_nazev);

                                     ?>
									  </h4> 
								    <?php 
										}
									 else
									  { ?>
								         <button id=" " type="submit" style=" /* max-width: 120px ; */ display: inline; padding: 1px;" class=" " value="  <?php echo $pole_slozek[$x] ;?> " name="submit">
                                               <?php
									     	while(!feof($cely_nazev)) {
											    echo fgets($cely_nazev);
											    }
										     	fclose($cely_nazev);
									      ?> 
									     </button>
									   </div> 
									  <?php 
									 	 }
									 ; ?>
	
									 </form>							   
	   
						            </div >	<!-- media body    -->							
                               	</div>	<!--   media  -->																	
						    </div>                                      
 								   
						</li> 

								<?php
								}
						}
						?>
		                </ul>
					  
				    </div>
   <button id="nova_slozka" type="button" class="btn btn-sm btn-secondary" style="display: inline" data-toggle="modal" data-target="#modal_nova_slozka">+</button>
				</div>  <!-- playlist_vysuvka   --> 

              </div> 
			  
			  
      <?php if ($delka_pole_slozek < 3	) 
		{ ?>
	   	
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
	    ?>			  
			  
			  
			  
			  
            </div> 