<!doctype html>
<html lang="cz">
  <head> 
    <meta charset="utf-8">
</head>
 <body>
<?php
include "connect.php"; 
if(isset($_POST['submit'])) {
    $nick = mysql_real_escape_string($_POST['nick']);
    $heslo = mysql_real_escape_string($_POST['heslo']);
    $over_heslo = mysql_real_escape_string($_POST['over_heslo']);
    $md5_heslo = md5($heslo);
    $email = mysql_real_escape_string($_POST['email']);
    /* Nyní ověříme, zda byly zadané všechny potřebné údaje  */
    $user_check = mysql_query("SELECT login FROM uzivatele WHERE login='".$nick."'");
    if($nick==""){echo"Nebyl vyplněn nick!";}
    else if(mysql_num_rows($user_check)){echo"Tento nick používá již jiný uživatel.";}
    else if($heslo==""){echo"Nebylo vyplněno heslo";}
    else if($over_heslo==""){echo"Nebylo vyplněno ověřovací heslo";}
    else if($heslo!=$over_heslo){echo"Vyplněná hesla se neshodují";}
    else if($email==""){echo"Nebyl vyplněn email";}
    else{
        $sql= mysql_query("INSERT INTO uzivatele VALUES ('','$nick','$md5_heslo','','$email','','')") or die(mysql_error());
        echo"Registrace byla úspěšně dokončena!";
    }
}
 
?>
<form action="#" method="post">     
     
      Přezdívka:  
       <input type="text" name="nick" value="<?php if(isset($_POST["nick"])){echo $_POST["nick"];}?>" size="25" /> 
   
       Heslo:  
      <input type="password" name="heslo" value="" size="25" />
    
      Ověření hesla: 
      <input type="password" name="over_heslo" value="" size="25" />
        
      Email: 
      <input type="text" name="email" value="<?php if(isset($_POST["email"])){echo $_POST["email"];}?>" size="25"/>
    
      <input type="submit" name="submit" value="Registrovat zkušebnu" />
    
  
</form>

</body>
</html>
