		      <div style="display: inline; color:white; background-color: #343a40; padding:3px; ">
					   			   	
						 <div class="dropdown" style="text-align: left;"> 
							  <div  style="text-align:left; display: inline ;" >
								<div  class="btn btn-success my-2 my-sm-0" type=""  style="display: inline; background-color: white;color:black; padding:1px; margin:2px; "><?php echo  $_SESSION['login'] ; ?></div>
							  </div>						 
                               	/
							  <button style="display: inline; background-color: white;color:black; padding:1px; margin:2px; " type="button" class=" btn  dropdown-toggle" data-toggle="dropdown">
							  <!-- <img src="/data/icons8-music-folder-50-2.png" alt="složka" style=" max-height: 30px;" >  --> 
							   <?php echo $slozka_souboru 	?> 
							  </button>
							  <div class="dropdown-menu" style="background-color: rgb(52, 58, 64)">
							  						 

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
								<div  class="dropdown-item-text">	<!-- tlačítko změny složky    --> 
	
									<form action="/php/zmenit_slozku.php" method="post" enctype="multipart/form-data"> 
									 <input id="navrat" type="text" value="<?php echo $_SERVER['PHP_SELF']; ?>" name="navrat" style="display:none" >
									 <input id="cilova_slozka" type="text" value="<?php echo $pole_slozek[$x] ?>" name="cilova_slozka" style="display:none" >
								
								    <?php 
 									   if ($pole_slozek[$x]==$slozka_souboru)  {   
  									   }									 
									   else
									   { ?>
								   
								         <div> 
		 
                                         </div>
									   
								         <button id=" " type="submit" style=" max-width: 333px ; display: inline" class="btn btn-sm btn-warning" value="  <?php echo $pole_slozek[$x] ;?> " name="submit">
                                           <img src="/data/glyphicons-441-folder-closed.png" alt="složka"  > 
										   <?php echo $pole_slozek[$x] ?>
									     </button>
										 										 
									  <?php 
									 	 }
									 ; ?>
	
									</form>							   
				   
								</div>	
								 
								<?php
								 }
						         }
						        ?>

							    </div>
						 </div> 
						 
	      	 </div>	