<?php
session_start();
error_reporting(0);
require_once __DIR__ . '/config.php';

// Stejné přihlášení a identita jedné kapely jako na hlavní stránce VZ.
if (empty($_SESSION['logged_in_single'])) {
    require __DIR__ . '/php/loginbox4.php';
    exit;
}

if (empty($_SESSION['role'])) {
    $_SESSION['role'] = 'muzikant';
}

if (empty($_SESSION['kapela'])) {
    $_SESSION['kapela'] = 'kapela';
    $_SESSION['befelemepesseveze'] = '471707760';
}

if (empty($_SESSION['multitrack_csrf'])) {
    $_SESSION['multitrack_csrf'] = bin2hex(random_bytes(32));
}

$can_upload_multitrack = ma_pravo('upload');
?>
<!doctype html>
<html lang="cs">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Multitrack · Virtuální zkušebna</title>
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css"
          crossorigin="anonymous">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css">
    <link rel="stylesheet" href="css/sticky-footer-navbar.css">
    <link rel="stylesheet" href="css/main.css?v=<?= filemtime(__DIR__ . '/css/main.css') ?>">
    <link rel="stylesheet" href="css/multitrack.css?v=<?= filemtime(__DIR__ . '/css/multitrack.css') ?>">
    <style>
        :root {
            --barva: #<?= htmlspecialchars($_SESSION['barva1'] ?? 'a7ac38', ENT_QUOTES) ?>;
            --pozadi: #<?= htmlspecialchars($_SESSION['barva_pozadi'] ?? '202428', ENT_QUOTES) ?>;
        }
    </style>
    <script src="https://code.jquery.com/jquery-3.7.1.min.js" crossorigin="anonymous" defer></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js" crossorigin="anonymous" defer></script>
    <script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js" crossorigin="anonymous" defer></script>
    <script src="https://cdn.jsdelivr.net/npm/idb-keyval@6/dist/umd.js" defer></script>
    <script src="js/multitrack.js?v=<?= filemtime(__DIR__ . '/js/multitrack.js') ?>" defer></script>
<script src="js/multitrack-notes.js?v=<?= filemtime(__DIR__ . '/js/multitrack-notes.js') ?>" defer></script>
<link rel="stylesheet" href="css/workspace.css?v=<?= filemtime(__DIR__ . '/css/workspace.css') ?>">
</head>
<body class="multitrack-page">
<div id="topbar">
    <a class="brand mt-brand-link" href="index.php">ZKUŠEBNA</a>
    <span class="brand">/</span>
    <span class="brand">DK</span>
    <span class="brand">/</span>
    <span class="mt-topbar-title">MULTITRACK</span>
    <nav class="topnav">
        <a href="index.php">zpět do zkušebny</a>
        <a href="php/login/logout.php">odhlásit</a>
    </nav>
</div>

<main id="mt-page">
    <?php require __DIR__ . '/php/inc/multitrack_view.php'; ?>
</main>
<?php require __DIR__ . '/php/inc/multitrack_modals.php'; ?>
<?php require __DIR__ . '/php/inc/multitrack_config.php'; ?>
</body>
</html>
