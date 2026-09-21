<?php
require_once __DIR__ . '/../inc/session.php';
app_session_start();
session_unset();
session_destroy();
$adresa_pro_navrat = $_POST["navrat"] ?? "/";

// Smazat session cookie
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    unset($params['lifetime']);
    setcookie(session_name(), '', ['expires' => time() - 42000] + $params);
}

require __DIR__ . "/../inc/navrat.php";
?>
