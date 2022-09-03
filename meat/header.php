      <!-- Fixed navbar -->
      <nav class="navbar navbar-expand-md navbar-dark fixed-top bg-dark" style="padding:0px">


		      <div style="display: inlinexxxxxx; color:white; background-color: #343a40; padding:3px; ">
					   			   	
						 <div class=" " style="text-align: left;"> 
							  <div  style="text-align:left; display: inline ;" >
							  
							   
								<div  class="btn btn-light my-2 my-sm-0"  style="display: inline; background-color: #BD9C74;">
								     <img src="/data/icons8-punk-50-2.png" alt="složka" style="max-height:30px;"  >
								<?php echo  $_SESSION['login'] ; ?>
								
								</div>
							  </div>						 
                               	/
							 
							  <button style="display: inline; padding:0px ; padding-right: 15px; background-color: #<?php echo $_SESSION['barva1'] ?>;" class="btn btn-light my-2 my-sm-0  "  dropdown-toggle" data-toggle="dropdown"  >
							  <img src="/data/icons8-music-record-50.png" alt="vál" style="max-height:30px"   > 
							   <?php echo $slozka_souboru 	?> 
							  <!--   <img onclick="openNav()" src="/data/ikona_colapsedown2.png" alt="vál" style="max-height:12px"> 
							   <img onclick="closeNav()" src="/data/123_Maximize_Square-512.png" alt="vál" style="max-height:29px"> 
							    -->
							  </button>
							  <div class="dropdown-menu" style="background-color: rgb(52, 58, 64)">
							  
							     <?php   require "meat/sekce_playlist_drop.php";?>
							  
	                          </div> 
						 </div> 
						 
	      	 </div>	
		
		
        <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarCollapse" aria-controls="navbarCollapse" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarCollapse">
          <ul class="navbar-nav mr-auto" style="text-align: center">
             
	 
	    	 <li class="nav-item">
                <a class="nav-link " href="simple_playlist.php">playlist</a> 
            </li>  
		 			
			 <li class="nav-item">
               <a class="nav-link " href="simple_text.php">texty</a>  
            </li>	 
	         <li class="nav-item">
               <a class="nav-link " href="simple_soubory.php">nahrávky</a>  
            </li>

			 <li class="nav-item">
               <a class="nav-link " href="simple_napady.php">nápady</a>  
            </li			
            <li class="nav-item">
                  <a class="nav-link  " href="#"  data-toggle="modal" data-target="#myModal"  >about</a>
            </li> 
			 <li class="nav-item">
                <a class="nav-link" href="/php/login/logout.php">odhlásit se</a>  
            </li> 
			
          </ul>
          <form class="form-inline mt-2 mt-md-0">
            <a class="navbar-brand" href="index.php" style="text-align: center">  <p style="text-align: center">-VZ-</p> </a>  
          
          </form>
        </div>
      </nav>