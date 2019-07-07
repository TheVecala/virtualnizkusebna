<?php
// vytunění sql
 
 require "login/connect.php";
 
$adresa_playlistu=  "playlist_pokus_123" ; 
$cas= time();
$poradi= 1;
$nazev_valu= "Vidiek "; 
$bpm= "140 ";
$key=  "E" ;
 
 
  //vytvoření tabulky funguje
   mysql_query("CREATE TABLE $adresa_playlistu (
cas INT(11) NOT NULL,
poradi VARCHAR(50) NOT NULL,
nazev_valu text NOT NULL,
bpm VARCHAR(50) NOT NULL,
key VARCHAR(50) NOT NULL
)");
  
 //vložení do tabulky funguje
  $vysledek=mysql_query("insert into $adresa_playlistu (cas, poradi, nazev_valu, bpm,key) values ('$cas', '$poradi', '$nazev_valu', '$bpm', '$key')");
?> 



    <script>

console.log("DIY forever!");
console.log("  <?php echo " ........... "; ?>  ");
 
 
</script>