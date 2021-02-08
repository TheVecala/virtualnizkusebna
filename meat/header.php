      <!-- Fixed navbar -->
      <nav class="navbar navbar-expand-md navbar-dark fixed-top bg-dark" style="padding:0px">


		      <div style="display: inlinexxxxxx; color:white; background-color: #343a40; padding:3px; ">
					   			   	
						 <div class=" " style="text-align: left;"> 
							  <div  style="text-align:left; display: inline ;" >
							  
							   
								<div  class="btn btn-light my-2 my-sm-0"  style="display: inline; background-color: #d5833c;">
								     <img src="/data/icons8-punk-50-2.png" alt="složka" style="max-height:30px;"  >
								<?php echo  $_SESSION['login'] ; ?>
								
								</div>
							  </div>						 
                               	/
							 
							  <button style="display: inline; padding:0px ; padding-right: 15px; background-color: #27a243;" class="btn btn-light my-2 my-sm-0  "  dropdown-toggle" data-toggle="dropdown"  >
							  <img src="/data/icons8-music-record-50.png" alt="vál" style="max-height:30px"   > 
							   <?php echo $slozka_souboru 	?> 
							   <img  src="/data/ikona_colapsedown2.png" alt="vál" style="max-height:12px"> 
							    <!-- 
							   <img onclick="closeNav()" src="/data/123_Maximize_Square-512.png" alt="vál" style="max-height:29px"> 
							    -->
							  </button>
							  <div class="dropdown-menu" style="background-color: rgb(52, 58, 64)">
							  
							     <?php   require "meat/sekce_playlist.php";?>
							  
	                          </div> 
						 </div> 
						 
	      	 </div>	
		
		
        <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarCollapse" aria-controls="navbarCollapse" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarCollapse">
          <ul class="navbar-nav mr-auto" style="text-align: center">
             
	 
		 <li class="nav-item">
                <a class="nav-link " href="index.php">home</a> 
            </li>  
	 <!-- 		
			 <li class="nav-item dropdown">
			  <a class="nav-link dropdown-toggle" href="#" id="navbardrop" data-toggle="dropdown">
				ZKUŠEBNA
			  </a>
			  <div class="dropdown-menu">
				<a class="dropdown-item" href="#" data-toggle="popover" data-trigger="focus" data-content="Tahle funkce zatím nefachá">ZMĚNIT</a> 
				<a class="dropdown-item" href="kalendar.php">ROZVRH</a>
			  </div>
             </li>	 
	-->	

			 <li class="nav-item">
               <a class="nav-link " href="looper.php">looper</a>  
            </li			
            <li class="nav-item">
                  <a class="nav-link  " href="#"  data-toggle="modal" data-target="#myModal"  >info</a>
            </li> 
			 <li class="nav-item">
		      <button id="vybalit_formular"   class="btn btn-sm  btn-secondary"  style=" display: inline" data-toggle="modal" data-target="#modal_vlozit_uzivatele" >Vytvořit uživatele </button> 
		     </li> 
			  
			 <li class="nav-item">
                <a class="nav-link" href="/php/login/logout.php">odhlásit se</a>  
            </li> 
			
          </ul>
          <form class="form-inline mt-2 mt-md-0">
            <a class="navbar-brand" href="index.php" style="text-align: center">  <p style="text-align: center"> VIRTUÁLNÍ ZKUŠEBNA   </p> </a>  
          
          </form>
        </div>
      </nav>