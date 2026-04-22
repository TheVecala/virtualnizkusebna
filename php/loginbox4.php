  <?php session_start(); ?>
  <?php
 $_SESSION['barva1'] ="a7ac38";
 $_SESSION['barva2'] ="yellow";
 $_SESSION['barva_pozadi'] ="202428"; 
  
?>

  <!doctype html>
  <html lang="cz">
   <head> 
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
      <title>Virtuální zkušebna</title>
       <!-- Optional JavaScript --> 
     <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js" integrity="sha384-ApNbgh9B+Y1QKtv3Rn7W3mgPxhU9K/ScQsAP7hUibX39j7fakFPskvXusvfa0b4Q" crossorigin="anonymous"></script>
    <script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js" integrity="sha384-JZR6Spejh4U02d8jOt6vLEHfe/JQGiRRSQQxSfFWpi1MquVdAyjUar5+76PVCmYl" crossorigin="anonymous"></script>
     <!-- Bootstrap CSS -->
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css" integrity="sha384-Gn5384xqQ1aoWXA+058RXPxPg6fy4IWvTNh0E263XmFcJlSAwiGgFAW/dAiS6JXm" crossorigin="anonymous">
    <link href="/css/sticky-footer-navbar.css" rel="stylesheet">
  <link href="/css/cover.css" rel="stylesheet">
  
      <style>
body {	
  background-color: #<?php echo $_SESSION['barva_pozadi'] ?>;
}

  .login_box {	
  background-color: #<?php echo $_SESSION['barva1'] ?>;
}

 </style>
   </head>
   <body>
   
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
	
	
      <div id="hlavni_box" class="card  login_box text-white"> <!-- hlavní menu -->
		   <div class="card-body" style=" text-align:center"> 
			<h1 class="card-title"   >VIRTUÁLNÍ ZKUŠEBNA</h1> 
			<h2 class="card-title"   >Autonomní sdílení souborů</h2>
			<h2 class="card-title"   >Open-code web app</h2>
			
			<button  id="prihlasit"   type="button" class="btn btn-dark prihlasit"  >PŘIHLÁSIT SE</button> 
			<button  id="nova_zkusebna"   type="button" class="btn btn-dark nova_zkusebna"  >VYTVOŘIT NOVÝ PROJEKT</button> 
		  
			<?php
			 
			if (isset($_SESSION['chyba_prihlaseni']) && $_SESSION['chyba_prihlaseni'] == "wrong_heslo") { 
			 echo ' <div id="spatne_heslo" class=" " style="color:red"> Špatné jméno nebo heslo  </div> ';
			 $_SESSION['chyba_prihlaseni'] = "";
			 } ;
			 ?>
		
		   </div> 
		
      </div> <!-- hlavní menu -->
	  
	  <div class=" ">
	    <!-- form přihlášení -->
        <div id="formular_prihlaseni" class="card login_box text-white" style="  display: none"> 
			  <div class="card-body">           
				<h3>PŘIHLÁŠENÍ:</h3>    
			 
				<form action="php/login/login.php" method="post" >     
				   JMÉNO: <input type="text" name="nick" value="" size="17" autofocus="autofocus"  />  <br>  <br> 
				   HESLO: <input type="password" name="heslo" value="" size="17"      />      <br> <br> 
				   <input id="navrat" type="text" value="<?php echo $_SERVER['PHP_SELF']; ?>" name="navrat" style="display:none" >
				   <input class="button btn btn-dark" type="submit" name="submit" value="PŘIHLÁSIT" />
				     <button id="zpet" type="button" class="btn btn-danger zpet"   style="display: inline">ZPĚT</button>
				</form>
				
				
				  <br> 
			  </div>
        </div> <!-- form přihlášení -->
         
        <div id="formular_vytvoreni_zkusebny" style="  display: none" class="card login_box text-white"> <!-- form vytvoření zkušebny -->
	 
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
					<input id=" " type="text" value="hello_world" name="jmeno_adresare" style="display:none" >	 <br>
					<input id=" " type="text" value="<?php echo $_SERVER['PHP_SELF']; ?>" name="navrat" style="display:none" > <br>
					<input id="vytvorit_adresar" type="submit" class="btn btn-dark  " value="VYTVOŘIT" name="submit">	
                 	 <button id="zpet2" type="button" class="btn btn-danger zpet2"   style="display: inline">ZPĚT</button>
				</form>
					   
			</div>
       	    
        </div> <!-- form vytvoření zkušebny -->
	  </div> <!-- cards -->
	
		

	<!-- The Modal INFO-->
<div class="modal modal-centered " id="myModal">
  <div class="modal-dialog">
    <div class="modal-content  text-white">

      <!-- Modal Header -->
      <div class="modal-header">
        <h4 class="modal-title">I N F O </h4>
        <button type="button" class="close" data-dismiss="modal">&times;</button>
      </div>

      <!-- Modal body -->
      <div class="modal-body">
	      <p>
        DIY a Open source projekt ze Štatlu. <br><br>
		Plugin pro organizaci informací o skladbách hudební skupiny <br> a jejich sdílení mezi jejímy členy. <br>   <br>
		Tohle není prostor pro volné ukládání dat většího množství uživatelů. 
		Vhodná je instalace na vlastní doménu.  <br> <br><br>
		Pro více info pište na adresu: <i>  the@vecala.cz  </i> 
	    
		</p>
		<p>
		Thanks to:<br>
		wavesurfer.js<br>
		jahů
		
          </p>
		  <button type="button" class="btn btn-swcondary"  >INSTALACE NA VLASTNÍ DOMÉNĚ</button><br>
          <button type="button" class="btn btn-dark"  >ÚČET NA VIRTUALNIZKUSEBNA.CZ</button>
      </div>

      <!-- Modal footer -->
      <div class="modal-footer">
 
        <button type="button" class="btn btn-danger" data-dismiss="modal">ZAVŘÍT</button>
      </div>

    </div>
  </div>
</div>
	
	
	
   </div> 
 
  
<?php  
  // require "php/console.php";
?>
 

  <script>   /*  ------------ vecalovo   */
$(document).ready(function(){
    $('[data-toggle="popover"]').popover();
	
	
	$('.zmenit_adresar').click(function() { 
	
 $(this).removeClass("btn-sm");
  
   
 
	});	
	
	$('.nova_zkusebna').click(function() { 
	
         $("#formular_vytvoreni_zkusebny").show(700); 
         $("#formular_prihlaseni").hide(200);  
         $("#hlavni_box").hide(200); 
	});		
	
	$('.prihlasit').click(function() { 
	
         $("#formular_prihlaseni").show(700); 
		 $("#formular_vytvoreni_zkusebny").hide(200);  
         $("#hlavni_box").hide(200); 
	});		
	
	$('.zpet').click(function() { 
	
         $("#formular_prihlaseni").hide(500); 
         $("#hlavni_box").show(200); 
	});	

	$('.zpet2').click(function() { 
	 
		 $("#formular_vytvoreni_zkusebny").hide(500);  
         $("#hlavni_box").show(200); 
	});		
});
</script>		


		 </div>
	   </div>
	  </div>
	</div>
	
		
   </body>
  </html>
  