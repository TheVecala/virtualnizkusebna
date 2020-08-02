			<div class=" sticky card bg-dark text-white"  style="margin-top: 1px;"> <!--hlavička prvního sloupce     -->
               <div class="card-body"> 
	
	             <h2 style="text-align:left; color:black ; display: inline ;background-color: #dc3545;">  PLAYLIST </h2> 
				  
			     <div style="text-align:right; display: inline"   >		                
				    <button  id="nova_slozka"   type="button" class="btn btn-sm btn-secondary"  style=" display: inline" data-toggle="modal" data-target="#modal_nova_slozka"> NOVÁ SKLADBA </button>
					 <a href="javascript:void(0)" class="closebtn" onclick="closeNav()">&times;</a>
				 </div>	
				 
	           </div>
 		   
            </div> <!--     -->
	      		  
            <div> <!--  playlist   -->
					  
			  <div  id=" "  style="background-color:#27a243; padding: 3px;"> <!-- zmšna složky    -->
			 
			  	<div>
					 
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
						<li class="list-group-item list-group-item-action <?php  if ($pole_slozek[$x]==$slozka_souboru)  { echo"  active " ; } ; ?> " style="padding:0px ; "> <!-- tlačítko změny složky    --> 
											 
                            <div style=" " > 
								  
									<form action="/php/zmenit_slozku.php" method="post" enctype="multipart/form-data"> 
									 <input id="navrat" type="text" value="<?php echo $_SERVER['PHP_SELF']; ?>" name="navrat" style="display:none" >
									 <input id="cilova_slozka" type="text" value="<?php echo $pole_slozek[$x] ?>" name="cilova_slozka" style="display:none" >
									
                                <div class="media border p-1" style="font-size: 1.5rem; padding:1px;    ">
								
																	   
									<?php   
   									   if ($pole_slozek[$x]==$slozka_souboru)  {  ?>   
								   							   								   	
									 <img src="/data/icons8-punk-50-2.png" alt="složka" style="max-height:300px" class="mr-3 mt-3 " > 	
																		
									 <?php  
  									 }
									 
									 else
									  {
										  ?>
								       <img src="/data/icons8-rock-music-50.png" alt="vál" style="max-height:300px" class="mr-3 mt-3  "  >   
									  <?php 
									 	 }
										
									  ?>
								  				
								   <div class="media-body" style="padding: 0.2rem; max-width: 339px" >
																
									   <div> 
									      <?php
									     	while(!feof($cely_nazev)) {
											    echo fgets($cely_nazev);
											    }
										     	fclose($cely_nazev);
									      ?> 
									   </div> 
								
								       <button    value="<?php echo $soub; ?>" name="<?php echo $label_soub; ?> " type="button" class="btn btn-sm btn-secondary btn-VZ  deleter_val"  style=" max-width: 120px ; display: inline" data-toggle="modal" data-target="#modal_delete_val"> 		
									     UPRAVIT
								      	</button>
								  				
								    <?php  if ($pole_slozek[$x]==$slozka_souboru)  { }
									 else
									  { ?>
								         <button id=" " type="submit" style=" max-width: 120px ; display: inline" class="btn btn-sm btn-warning btn-VZ" value="  <?php echo $pole_slozek[$x] ;?> " name="submit">
                                          OTEVŘÍT
									     </button>
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
 
				</div>  <!-- playlist_vysuvka   --> 

              </div> 
			  
			  
      <?php if ($delka_pole_slozek < 3	) 
		{ ?>
	   	
	      <div class="card bg-success text-white" style="margin-bottom: 3px;" > 
							   
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