<?php
// vytunění sql
 
 require "login/connect.php";
 
 
$cas= time();
$vzkaz= "admin";
$jmeno= "Sem je možno vkládat odkazy na vály, názory a jiný věci";
$adresa_diskuse=  "diskuse_pokus5" ;
 
 
  //vytvoření tabulky funguje
   mysql_query("CREATE TABLE $adresa_diskuse (
cas INT(11) NOT NULL,
vzkaz text NOT NULL,
jmeno VARCHAR(50) NOT NULL
)");
  
 //vložení do tabulky funguje
  $vysledek=mysql_query("insert into $adresa_diskuse (cas, vzkaz, jmeno) values ('$cas', '$vzkaz', '$jmeno')");
?> 



    <script>

console.log("DIY forever!");
console.log("  <?php echo " ........... "; ?>  ");
 
 
</script>