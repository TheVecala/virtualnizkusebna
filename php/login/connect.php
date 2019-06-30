<?php
$db_server    = 'localhost'; /* Název serveru, ke kterému se budeme připojovat */
$db_login     = 'hanakdusan'; /* Jméno uživatele do DB */
$db_password  = 'serepes6'; /* Heslo uživatele do DB */
$db_name      = '18810_virtualni_zkusebna'; /* Název databáze, ve které jsme si vytvořili tabulku "uzivatele" */
$spojeni      = @MySQL_Connect($db_server ,$db_login, $db_password);
@MySQL_Select_DB($db_name)or die('<p style="color: red">Nastala chyba v pripojeni k databazi');
mysql_query("set names utf8");


?>
