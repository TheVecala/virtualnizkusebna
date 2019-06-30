<?php
session_start();// Zapneme session
session_destroy();// Smažeme všechna session
header("location: /index.php"); // Presmeruje na přihlašovací stránku
?>
