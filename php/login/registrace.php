<!doctype html>
<html lang="cz">
  <head>
    <meta charset="utf-8">
  </head>
  <body>
<?php
include "connect.php";
if (isset($_POST["submit"])) {
    $nick       = $mysqli->real_escape_string($_POST["nick"]);
    $heslo      = $_POST["heslo"];
    $over_heslo = $_POST["over_heslo"];
    $md5_heslo  = md5($heslo);
    $email      = $mysqli->real_escape_string($_POST["email"]);

    $user_check = $mysqli->query("SELECT login FROM uzivatele WHERE login='" . $nick . "'");

    if ($nick == "") { echo "Nebyl vyplněn nick!"; }
    elseif ($user_check && $user_check->num_rows) { echo "Tento nick používá již jiný uživatel."; }
    elseif ($heslo == "") { echo "Nebylo vyplněno heslo"; }
    elseif ($over_heslo == "") { echo "Nebylo vyplněno ověřovací heslo"; }
    elseif ($heslo != $over_heslo) { echo "Vyplněná hesla se neshodují"; }
    elseif ($email == "") { echo "Nebyl vyplněn email"; }
    else {
        $mysqli->query("INSERT INTO uzivatele VALUES ('','$nick','$md5_heslo','','$email','','')");
        echo "Registrace byla úspěšně dokončena!";
    }
}
?>
<form action="#" method="post">
    Přezdívka:
    <input type="text" name="nick" value="<?php if(isset($_POST["nick"])){echo htmlspecialchars($_POST["nick"]);}?>" size="25">
    Heslo:
    <input type="password" name="heslo" value="" size="25">
    Ověření hesla:
    <input type="password" name="over_heslo" value="" size="25">
    Email:
    <input type="text" name="email" value="<?php if(isset($_POST["email"])){echo htmlspecialchars($_POST["email"]);}?>" size="25">
    <input type="submit" name="submit" value="Registrovat zkušebnu">
</form>
</body>
</html>