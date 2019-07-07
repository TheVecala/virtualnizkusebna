<?php
// vytunění sql
 
 require "login/connect.php";
 
 
$cas= time();
$vzkaz= "140";
$nazev= "Michael Jackson -  s2";
$bpm= "1";
$key= "E";
$adresa_diskuse=  "playlist_pokus_127" ;
 
 
  //vytvoření tabulky funguje
   mysql_query("CREATE TABLE $adresa_diskuse (
cas INT(11) NOT NULL,
vzkaz text NOT NULL,
nazev VARCHAR(50) NOT NULL,
bpm VARCHAR(50) NOT NULL
)");
  
 //vložení do tabulky funguje
  $vysledek=mysql_query("insert into $adresa_diskuse (cas, vzkaz, nazev) values ('$cas', '$vzkaz', '$nazev')");
?> 



    <script>

console.log("DIY forever!");
console.log("  <?php echo " ........... "; ?>  ");
 
 
</script>