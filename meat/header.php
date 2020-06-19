      <!-- Fixed navbar -->
      <nav class="navbar navbar-expand-md navbar-dark fixed-top bg-dark" style="padding:0px">


		      <div style="display: inlinexxxxxx; color:white; background-color: #343a40; padding:3px; ">
					   			   	
						 <div class="dropdown" style="text-align: left;"> 
							  <div  style="text-align:left; display: inline ;" >
							  
							   
								<div  class="btn btn-light my-2 my-sm-0"  style="display: inline;    ">
								     <img src="/data/icons8-punk-50-2.png" alt="složka" style="max-height:30px;"  >
								<?php echo  $_SESSION['login'] ; ?>
								
								</div>
							  </div>						 
                               	/
							 
							  <button style="display: inline; padding:0px " class="btn btn-light my-2 my-sm-0 dropdown-toggle" data-toggle="dropdown" >
							  <img src="/data/icons8-rock-music-50.png" alt="vál" style="max-height:30px"   > 
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
		
		
        <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarCollapse" aria-controls="navbarCollapse" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarCollapse">
          <ul class="navbar-nav mr-auto">
             
	 
			 <li class="nav-item">
                <a class="nav-link " href="home.php">home</a> 
            </li>
				  
		    <li class="nav-item">
              <a class="nav-link " href="playlist.php">playlist</a>    
            </li>
			 <li class="nav-item">
               <a class="nav-link " href="looper.php">soubory</a>  
            </li>
			 <li class="nav-item">
               <a class="nav-link " href="mixer.php">mixer</a>  
            </li>				  
            <li class="nav-item">
                  <a class="nav-link  " href="#"  data-toggle="modal" data-target="#myModal"  >info</a>
            </li> 
			 <li class="nav-item">
                <a class="nav-link" href="/php/login/logout.php">odhlásit se</a>  
            </li> 
			
          </ul>
          <form class="form-inline mt-2 mt-md-0">
            <a class="navbar-brand" href="#">VIRTUÁLNÍ ZKUŠEBNA</a>  
          
          </form>
        </div>
      </nav>