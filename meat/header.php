      <!-- Fixed navbar -->
      <nav class="navbar navbar-expand-md navbar-dark fixed-top bg-dark" style="padding:0px">


		      <div style="display: inlinexxxxxx; color:white; background-color: #343a40; padding:3px; ">
					   			   	
						 <div class=" " style="text-align: left;"> 
							  <div  style="text-align:left; display: inline ;" >
							  
							   
								<div  class="btn btn-light my-2 my-sm-0"  style="display: inline;    ">
								     <img src="/data/icons8-punk-50-2.png" alt="složka" style="max-height:30px;"  >
								<?php echo  $_SESSION['login'] ; ?>
								
								</div>
							  </div>						 
                               	/
							 
							  <button onclick="openNav()" style="display: inline; padding:0px " class="btn btn-light my-2 my-sm-0  "   >
							  <img src="/data/icons8-music-record-50.png" alt="vál" style="max-height:30px"   > 
							   <?php echo $slozka_souboru 	?> 
							  </button>
							  
	 
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