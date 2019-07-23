  <?php session_start(); ?>
  <!doctype html>
  <html lang="cz">
   <head> 
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
      <title>Virtuální zkušebna</title>
       <!-- Optional JavaScript --> 
     <script src="/js/jquery-3.3.1.min.js" type="text/javascript"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js" integrity="sha384-ApNbgh9B+Y1QKtv3Rn7W3mgPxhU9K/ScQsAP7hUibX39j7fakFPskvXusvfa0b4Q" crossorigin="anonymous"></script>
    <script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js" integrity="sha384-JZR6Spejh4U02d8jOt6vLEHfe/JQGiRRSQQxSfFWpi1MquVdAyjUar5+76PVCmYl" crossorigin="anonymous"></script>
     <!-- Bootstrap CSS -->
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
    <link href="/css/sticky-footer-navbar.css" rel="stylesheet">
  <link href="/css/cover.css" rel="stylesheet">
   </head>
   <body style="background-color: #b4b4b4" >
   
   
     <header>
      <!-- Fixed navbar -->
      <nav class="navbar navbar-expand-md navbar-dark fixed-top bg-dark">
        <a class="navbar-brand" href="#">VIRTUÁLNÍ ZKUŠEBNA</a>
        <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#navbarCollapse" aria-controls="navbarCollapse" aria-expanded="false" aria-label="Toggle navigation">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarCollapse">
          <ul class="navbar-nav mr-auto">
            <li class="nav-item  ">
              <a class="nav-link prihlasit"   href="#" data-toggle="popover" data-trigger="focus"  data-content="">PŘIHLÁSIT SE<span class="sr-only">(current)</span></a>
            </li>
            <li class="nav-item">
              <a class="nav-link nova_zkusebna" href="#" data-toggle="popover" data-trigger="focus"  data-content="">VYTVOŘIT</a>
            </li>
            <li class="nav-item">
              <a class="nav-link disabled" href="#"  data-toggle="modal" data-target="#myModal"  >INFO</a>
            </li>
          </ul>
          
        </div>
      </nav>
    </header>
   
   <div class="site-wrapper">

      <div class="site-wrapper-inner">

        <div class="cover-container">

           <div class="inner cover">
  
   
   
   
   
   
    <div class="container" >
	
	
      <div class="card bg-success text-white"> <!-- hlavní menu -->
       <div class="card-body" style=" text-align:center"> 
	    <h1 class="card-title"   >  VIRTUÁLNÍ ZKUŠEBNA</h1>
        
	    <button  id="prihlasit"   type="button" class="btn btn-dark prihlasit"  >PŘIHLÁSIT SE</button> 
	    <button  id="nova_zkusebna"   type="button" class="btn btn-dark nova_zkusebna"  >VYTVOŘIT NOVÝ PROJEKT</button> 
	  
		<?php
		 
		if ($_SESSION['chyba_prihlaseni'] == "wrong_heslo") { 
	     echo ' <div id="spatne_heslo" class=" " style="color:red"> Špatný jméno nebo heslo  </div> ';
		 $_SESSION['chyba_prihlaseni'] = "";
		 } ;
	     ?>
	
	   </div> 
    
      </div> <!-- hlavní menu -->
	  
	   <div class=" ">
	    <!-- form přihlášení -->
        <div id="formular_prihlaseni" class="card bg-success text-white" style="  display: none"> 
          <div class="card-body">           
            <h3>OTEVŘENÍ PROJEKTU:</h3>    
         
            <form action="php/login/login.php" method="post" >     
      NÁZEV: <input type="text" name="nick" value="" size="17" autofocus="autofocus"  />  <br>  <br> 
      HESLO: <input type="password" name="heslo" value="" size="17"      />      <br> <br> 
	         <input id="navrat" type="text" value="<?php echo $_SERVER['PHP_SELF']; ?>" name="navrat" style="display:none" >
             <input class="button" type="submit" name="submit" value="OTEVŘÍT" />
            </form>
			
			
              <br> 
          </div>
        </div> <!-- form přihlášení -->
         
        <div id="formular_vytvoreni_zkusebny" style="  display: none" class="card bg-success text-white"> <!-- form vytvoření zkušebny -->
	 
	 	 
            <div  class="card-body " >  
							 
				<form action="php/vytvorit_bezpecnou_zkusebnu.php" method="post" enctype="multipart/form-data">
					<h2>   VYTVOŘENÍ NOVÉHO PROJEKTU </h2>    <br>
					PŘIHLAŠOVACÍ JMÉNO: 
					<input id=" " type="text" name="nick" > <br>
					CELÝ NÁZEV PROJEKTU: 
					<input id=" " type="text" name="jmeno_zkusebny" > <br>
					ZVOLTE HESLO PRO PŘÍSTUP:
					<input id=" " type="password" name="heslo" > <br>
					ZNOVU HESLO:
					<input id=" " type="password" name="over_heslo" > <br>
					EMAIL:
			     	<input id=" " type="text" name="email" > <br>
					<input id=" " type="text" value="první" name="jmeno_adresare" style="display:none" >	 <br>
					<input id=" " type="text" value="<?php echo $_SERVER['PHP_SELF']; ?>" name="navrat" style="display:none" > <br>
					<input id="vytvorit_adresar" type="submit" value="vytvořit" name="submit">
				
				
				</form>
					   
			</div>
       	    
        </div> <!-- form vytvoření zkušebny -->
	  </div> <!-- cards -->
	
		
<!-- The Modal -->
<div class="modal modal-centered " id="myModal">
  <div class="modal-dialog">
    <div class="modal-content">

      <!-- Modal Header -->
      <div class="modal-header">
        <h4 class="modal-title">I N F O </h4>
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->
      <div class="modal-body">
	      <p>
       DIY a Open source projekt ze Štatlu. <br>
		Plugin pro sdílení nahrávek hudebních skupin mezi jejímy členy. <br>   
		Tohle není prostor pro volné ukládání dat většího množství uživatelů. 
		Vhodná je instalace na vlastní doménu.  <br> <br>
		Pro více info pište na adresu: <i>  the@vecala.cz  </i> 
	
         </p>
      </div>

      <!-- Modal footer -->
      <div class="modal-footer">
        <button type="button" class="btn btn-danger" data-dismiss="modal">ZAVŘÍT</button>
      </div>

    </div>
  </div>
</div>
	
	
	
	
    </div> 
                
 

  <script>

console.log("DIY forever!");
console.log("  <?php echo "loged =".$loged.",  "."login= ".$login.", "."kapela= ".$kapela.", "."slozka_souboru= ".$slozka_souboru.",   "."slozka_slozek= ".$slozka_slozek.",  "; ?>  ");
console.log("  <?php echo "vysledek= ".$vysledek.",  "."id= ".$_SESSION['id'].",  "."aktualni_diskuse =".$aktualni_diskuse.",  "."SESSION aktualni_diskuse= ".$_SESSION['diskuse'].",  "."nazev= ".$_SESSION['nazev'].", SESSION['chyba_prihlaseni= ". $_SESSION['chyba_prihlaseni'];  ?>  ");  
 
</script>

  <script>   /*  ------------ vecalovo   */
$(document).ready(function(){
    $('[data-toggle="popover"]').popover();
	
	
	$('.zmenit_adresar').click(function() { 
	
 $(this).removeClass("btn-sm");
  
   
 
	});	
	
	$('.nova_zkusebna').click(function() { 
	
         $("#formular_vytvoreni_zkusebny").toggle(700); 
         $("#formular_prihlaseni").hide(200); 
	});		
	
	$('.prihlasit').click(function() { 
	
         $("#formular_prihlaseni").toggle(700); 
		 $("#formular_vytvoreni_zkusebny").hide(200);
	});		
	
});
</script>		


     </div>

    </div>
  </div>
</div>
	
		
   </body>
  </html>
  