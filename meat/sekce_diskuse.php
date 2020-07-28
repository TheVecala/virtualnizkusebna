
     
<?php
define ("ROWS", 10);
 require "php/login/connect.php";
 
  if (!isset($_GET["celkem"]))  
  {
    $vysledek=mysql_query("select count(*) as pocet from $aktualni_diskuse ");
    $zaznam=mysql_fetch_array($vysledek);
    $celkem=$zaznam["pocet"];
  }
  else
  {
      $celkem=$_GET["celkem"];
  }
?> 
  
<?php  
  if ($celkem>ROWS)
  {
    if (!isset($_GET["od"])) $od=1; else $od=$_GET["od"];
    $vysledek=mysql_query("select cas, vzkaz, jmeno from $aktualni_diskuse order by cas desc"." limit ".($od-1).", ".ROWS);
  }
  else
  {
    $vysledek=mysql_query("select * from $aktualni_diskuse order by cas desc") ;
  }
?> 
  
 <div>   <!-- hlavička třetího sloupce  -->
      <div id="diskuse" style="font-size:1.5em">
                <div class="card bg-dark text-white"  style="margin-top: 1px;"> <!--      -->
                   <div class="card-body"> 
				   
				     	
				  
		               <h2 style="text-align:left; color:black;  display: inline; background-color: #17a2b8; ">  NÁPADY </h2> 
					   
					   <div style="text-align:right;  display: inline">
                        <button id="vybalit_formular"   class="btn btn-sm  btn-secondary"  style=" display: inline" data-toggle="modal" data-target="#modal_vlozit_komentar" >NAPSAT  </button>  
           			   </div>  	
					   
					   <div  id="od_do" class="bg-dark text-white" style="font-size:0.8em">
						   <?php	   
						   echo ' '.$od.'-';
						   echo (($od+ROWS-1)<=$celkem)?($od+ROWS-1):$celkem;
						   echo ' z '. $celkem.'  ';
						   ?> 				   
					   </div> 					   
	               </div>	
 
               </div> <!--     -->			   
      </div> 
  
 </div> <!-- konec hlavička třetího sloupce  -->  
 <div  id=" "  >
 <div id="prispevek"  style="overflow: auto ">
 <div>   <!-- ovládání třetího sloupce  -->
   
  
	 <div id="navigace" > 
<?php				
       if ($od<>1) echo  ' <a href=" '.$_SERVER["PHP_SELF"].'?celkem='.$celkem.'&amp;od=1">  <div id= "exit_tlac" class="btn btn-dark btn-sm" style="font-size:0.6em"  >NEJNOVĚJŠÍ</div></a>   '. "\n";

  
       if ($od>ROWS) echo ' <a href="'.$_SERVER["PHP_SELF"].'?celkem='.$celkem.'&amp;od='.($od-ROWS).'"> <div id= "exit_tlac"  class="btn btn-dark btn-sm" style="font-size:0.6em">NOVĚJŠÍ</div></a>  '. "\n";
 
 
       if ($od+ROWS<$celkem) echo  '<a href="  '.$_SERVER["PHP_SELF"].'?celkem='.$celkem.'&amp;od='.($od+ROWS).'  ">  <div id= "exit_tlac" class="btn btn-dark btn-sm" style="font-size:0.6em">STARŠÍ</div></a> '. "\n";
 
 
       if ($od<$celkem-ROWS) echo  '<a href="'.$_SERVER["PHP_SELF"].'?celkem='.$celkem.'&amp;od='.($celkem-$celkem%ROWS+1).' "> <div id= "exit_tlac"  class="btn btn-dark btn-sm" style="font-size:0.6em">NEJSTARŠÍ</div></a> '. "\n";
  ?> 
       
	   </div>  
 
   
      
   
   
 </div> <!-- konec ovládání třetího sloupce  --> 
<ul class="list-group sloupec" >
   
<?php
  while ($zaznam=MySQL_Fetch_Array($vysledek))   
  {
?>
    
     
	  <li class="list-group-item vzkaz_karta ">
	   <span class="vzkaz" > <?php echo $zaznam["vzkaz"] ?> </span><br>  
	   <div style="text-align:right; ">
	     <span class="jmeno"  style="font-size:0.6em; "> VLOŽIL:&nbsp </span> 
	     <span class="jmeno"  style="font-size:0.9em; ">  <?php echo strip_tags($zaznam["jmeno"])?> &nbsp </span> 
         <span class="datum"  style="font-size:0.6em; ">  <?php echo date("j.n.Y G:i:s", ($zaznam["cas"]))?> </span> 
       </div>
	   
      </li>
	

	<?php 
 }
?> 
  </ul>
  </div>   
 </div> <!-- konec vysuvka   -->
 