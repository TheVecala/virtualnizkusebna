<?php
session_start();
session_unset();
session_destroy();
$adresa_pro_navrat = $_POST["navrat"] ?? "/";

// Smazat session cookie
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}

require "../navrat.php";
?>
