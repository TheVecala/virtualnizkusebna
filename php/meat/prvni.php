
			<div class="card bg-dark text-white"  style="margin-top: 1px;"> <!--hlavička prvního sloupce     -->
               <div class="card-body"> 
	
	             <h2 style="text-align:left; color:black ; display: inline ;background-color: #dc3545;">  PLAYLIST </h2> 
				  
			     <div style="text-align:right; display: inline"   >		                
				    <button  id="nova_slozka"   type="button" class="btn btn-sm btn-secondary"  style=" display: inline" data-toggle="modal" data-target="#modal_nova_slozka"> NOVÁ SKLADBA </button>

					
				 </div>	
				 
	           </div>
			     <button id="playlist_vysuvka_button" data-toggle="collapse" data-target="#playlist_vysuvka" style="display: inline ; max-height:30px ; padding:0px ; border-width: 0px;  background: #27a243;">
				    <img style="max-height:25px; padding:3px" src="/data/ikona_colapsedown3.png" alt="minimize"> 
			     </button>			   
            </div> <!--     -->
	      
		  
            <div> <!--  playlist   -->
			
		  
			  <div  id="playlist_vysuvka" class="collapse  "> <!-- zmšna složky    -->
			
		  		  
					  <table class="table table-bordered  table-dark tabulka" style="color: #343a40; background-color: #27a243;  border-width: 3px;  border-style: solid;    " >
						<thead></thead>
						<tbody>
				  
						<?php 
						for($x = 0; $x < $delka_pole_slozek; $x++) {
							  if ($pole_slozek[$x] == ".")  { continue; };
							  if ($pole_slozek[$x] == "..")  { continue; };
						   $soub = ($slozka_slozek.$pole_slozek[$x]);
						   $label_soub = " test";
						   $label_soub = ($pole_slozek[$x]);  
							if(is_dir($soub))
								
								  {    
								?>
								<div  class=" ">	<!-- tlačítko změny složky    -->  
																									
								  <tr style="  border-width: 2px;  border-style: solid;    "  >
                                   <td style="padding: 0.2rem; max-width: 339px; "> 
								  
									<form action="/php/zmenit_slozku.php" method="post" enctype="multipart/form-data"> 
									 <input id="navrat" type="text" value="<?php echo $_SERVER['PHP_SELF']; ?>" name="navrat" style="display:none" >
									 <input id="cilova_slozka" type="text" value="<?php echo $pole_slozek[$x] ?>" name="cilova_slozka" style="display:none" >
									
                                       <div style=" font-family: Times, serif;  <?php  if ($pole_slozek[$x]==$slozka_souboru)  { echo"  font-size:1.5em;;   color:white " ; } ; ?>  ">
									   
									<?php  if ($pole_slozek[$x]==$slozka_souboru)  {  ?>   
								   							   								   	
									 <img src="/data/glyphicons-145-folder-open.png" alt="složka"  > 	
																		
									 <?php  
  									 }
									 
									 else
									  { ?>
								       <img src="/data/glyphicons-441-folder-closed.png" alt="složka"  >   
									  <?php 
									 	 }
									 ; ?>
									 									 
									 <?php echo $pole_slozek[$x] ?>
                                       </div>
                                																		
								   </td> 
 
							       <td>
								   
								    <?php  if ($pole_slozek[$x]==$slozka_souboru)  {  ?>   
								   							   								
									 <?php  
  									 }
									 
									 else
									  { ?>
								         <button id=" " type="submit" style=" max-width: 120px ; display: inline" class="btn btn-sm btn-warning btn-VZ" value="  <?php echo $pole_slozek[$x] ;?> " name="submit">
                                          OTEVŘÍT
									     </button>
									  <?php 
									 	 }
									 ; ?>
									 									 
									</form>							   
								   	<button    value="<?php echo $soub; ?>" name="<?php echo $label_soub; ?> " type="button" class="btn btn-sm btn-danger btn-VZ  deleter_val"  style=" max-width: 120px ; display: inline" data-toggle="modal" data-target="#modal_delete_val"> 		
									  SMAZAT
									</button> 
								   								   
								   </td> 
								   
								  </tr> 
								</div>	
								 
								<?php
								}
						}
						?>
		  
						</tbody>
						</table>
 
				  </div>
								
		 
			
            </div> <!-- konec playlistu    -->
 