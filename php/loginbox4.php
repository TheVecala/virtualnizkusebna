 <?php 
if (session_status() == PHP_SESSION_NONE) {
    session_start();
}
require_once __DIR__ . "/../config.php";

$_SESSION['barva1']        = "a7ac38";
$_SESSION['barva2']        = "yellow";
$_SESSION['barva_pozadi']  = "202428"; 

// Zpracování odeslaného formuláře
if (isset($_POST['submit_single'])) {
    $zadani_hesla = $_POST['heslo'] ?? '';

    if ($zadani_hesla === HESLO_ADMIN) {
        $_SESSION['role']             = 'admin';
        $_SESSION['logged_in_single'] = true;
        unset($_SESSION['chyba_prihlaseni_single']);
        header("Location: " . $_SERVER['PHP_SELF']); exit;
    } elseif ($zadani_hesla === HESLO_MUZIKANT) {
        $_SESSION['role']             = 'muzikant';
        $_SESSION['logged_in_single'] = true;
        unset($_SESSION['chyba_prihlaseni_single']);
        header("Location: " . $_SERVER['PHP_SELF']); exit;
    } elseif ($zadani_hesla === HESLO_HOST) {
        $_SESSION['role']             = 'host';
        $_SESSION['logged_in_single'] = true;
        unset($_SESSION['chyba_prihlaseni_single']);
        header("Location: " . $_SERVER['PHP_SELF']); exit;
    } else {
        $_SESSION['chyba_prihlaseni_single'] = "wrong_heslo";
    }
}
?>
<!doctype html>
<html lang="cs">
<head> 
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <title>Zkušebna DK</title>
    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/popper.js/1.12.9/umd/popper.min.js"></script>
    <script src="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/js/bootstrap.min.js"></script>
    <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/4.0.0/css/bootstrap.min.css">
    <link href="/css/sticky-footer-navbar.css" rel="stylesheet">
    <link href="/css/cover.css" rel="stylesheet">
    <style>
        body { background-color: #<?php echo $_SESSION['barva_pozadi'] ?>; }
        .login_box { background-color: #<?php echo $_SESSION['barva1'] ?>; }
    </style>
</head>
<body>
 
<!-- ── BOTTOM NAV ── 
<header>
    <nav class="navbar navbar-expand-md navbar-dark fixed-top bg-dark">
        <a class="navbar-brand" href="#">VIRTUÁLNÍ ZKUŠEBNA - SEKCE KAPELY</a>
    </nav>
</header>
   --> 
   
<div class="site-wrapper">
    <div class="site-wrapper-inner">
        <div class="cover-container">
            <div class="inner cover">
                <div class="container">
	
                    <div id="formular_prihlaseni" class="card login_box text-white"> 
                        <div class="card-body" style="text-align:center">           
                            <h1 class="card-title">ZKUŠEBNA DK!</h1> 
                            <h4 class="mb-4">VSTUP PRO KAPELU</h4>    
                            
                            <form action="<?php echo htmlspecialchars($_SERVER['PHP_SELF']); ?>" method="post">     
                                <div class="form-group d-flex justify-content-center align-items-center gap-2" style="max-width: 320px; margin: 0 auto 15px;">
                                    <label class="mr-2 mb-0" style="font-weight: bold;">HESLO:</label>
                                    <input type="password" name="heslo" class="form-control " autofocus style="background: #1a1d20; color: #fff; border: 1px solid #3a3e44;" />
                                </div>
                                
                                <?php
                                if (isset($_SESSION['chyba_prihlaseni_single']) && $_SESSION['chyba_prihlaseni_single'] == "wrong_heslo") { 
                                    echo '<div id="spatne_heslo" class="mb-3" style="color:#ff6b6b; font-weight:bold;">Špatné přístupové heslo!</div>';
                                }
                                ?>
                                
                                <input class="btn btn-dark px-4 font-weight-bold" type="submit" name="submit_single" value="VSTOUPIT" />
                            </form>
                        </div>
                    </div> </div> </div>
        </div>
    </div>
</div>
	
</body>
</html>