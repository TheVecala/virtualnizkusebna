<?php
 
 require "login/connect.php";
 
$adresa_playlistu=  "playlist_kapela1" ; 

$cas= time();
$poradi= 1;
$nazev_valu= "Vidiek "; 
$bpm= "140 ";
$klic=  "E" ;
$adresa_diskuse=  "diskuse_test_123_123456789" ;
$data1=  "---" ;
$data2=  "---" ;
$data3=  "---" ;
 
 
  //vytvoření tabulky playlistu funguje
   mysql_query("CREATE TABLE $adresa_playlistu (
cas INT(11) NOT NULL,
poradi VARCHAR(50) NOT NULL,
nazev_valu text NOT NULL,
bpm VARCHAR(50) NOT NULL,
klic VARCHAR(50) NOT NULL,
adresa_diskuse VARCHAR(50) NOT NULL,
data1 VARCHAR(50) NOT NULL,
data2 VARCHAR(50) NOT NULL,
data3 VARCHAR(50) NOT NULL
)");
  
 //vložení do tabulky válů funguje
  $vysledek=mysql_query("insert into $adresa_playlistu (cas, poradi, nazev_valu, bpm, klic, adresa_diskuse, data1, data2, data3) 
                                              values ('$cas', '$poradi', '$nazev_valu', '$bpm', '$klic', '$adresa_diskuse', '$data1', '$data2', '$data3')");
?> 



    <script>

console.log("DIY forever!");
console.log("  <?php echo " ........... "; ?>  ");
 
 
</script>