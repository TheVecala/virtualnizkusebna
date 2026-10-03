<?php
require_once __DIR__ . '/inc/session.php';
app_session_start();
require_once __DIR__ . "/../config.php";

$_SESSION['barva1']        = "a7ac38";
$_SESSION['barva2']        = "yellow";
$_SESSION['barva_pozadi']  = "202428"; 

// Zpracování odeslaného formuláře; jediným údajem zůstává heslo.
$login_unavailable = false;
if (isset($_POST['submit_single'])) {
    try {
        $zadani_hesla = is_string($_POST['heslo'] ?? null) ? $_POST['heslo'] : '';
        if (auth_login($zadani_hesla)) {
            unset($_SESSION['chyba_prihlaseni_single']);
            $deep_link_query = $_SESSION['deep_link_after_login'] ?? '';
            unset($_SESSION['deep_link_after_login']);
            header('Location: /index.php' . ($deep_link_query !== '' ? '?' . $deep_link_query : ''));
            exit;
        }
        $_SESSION['chyba_prihlaseni_single'] = "wrong_heslo";
    } catch (Throwable $e) {
        $login_unavailable = true;
        http_response_code(503);
        unset($_SESSION['chyba_prihlaseni_single']);
        error_log('Zkušebna: přihlášení není dostupné.');
    }
}
$wrong_password = ($_SESSION['chyba_prihlaseni_single'] ?? '') === 'wrong_heslo';
$login_error = $login_unavailable ? 'Přihlášení nyní není dostupné. Zkuste to později.'
    : ($wrong_password ? 'Špatné přístupové heslo!' : '');
?>
<!doctype html>
<html lang="cs">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#111416">
    <title>Přihlášení · Zkušebna DK!</title>
    <style>
        :root { color-scheme: dark; background: #111416; color: #e9ebe6; font: 14px/1.6 system-ui, sans-serif; }
        * { box-sizing: border-box; }
        body { margin: 0; padding: max(28px, env(safe-area-inset-top)) max(24px, env(safe-area-inset-right)) max(28px, env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left)); }
        .login-shell { display: flex; flex-direction: column; width: min(100%, 420px); min-height: calc(100vh - 56px); min-height: calc(100dvh - 56px); margin: auto; }
        .login-brand { display: flex; align-items: center; gap: 10px; color: #a2a8aa; font-size: 11px; font-weight: 650; letter-spacing: .12em; }
        .login-brand b { color: #b5bb51; font-size: 13px; letter-spacing: .03em; }
        .login-brand span { border-left: 1px solid #42484b; padding-left: 10px; }
        .login-content { display: flex; flex: 1; flex-direction: column; align-items: center; justify-content: center; padding: 40px 0; text-align: center; }
        .login-wave { display: flex; align-items: center; gap: 6px; height: 52px; margin-bottom: 29px; }
        .login-wave span { width: 5px; height: 12px; border-radius: 4px; background: #b5bb51; }
        .login-wave span:nth-child(2), .login-wave span:nth-child(6) { height: 24px; }
        .login-wave span:nth-child(3), .login-wave span:nth-child(5) { height: 38px; }
        .login-wave span:nth-child(4) { height: 50px; }
        h1 { margin: 0; font: 700 clamp(36px, 10vw, 54px)/1.12 system-ui, sans-serif; letter-spacing: -.045em; }
        h1 span { color: #b5bb51; }
        .login-subtitle { margin: 20px 0 0; color: #a2a8aa; }
        form { width: min(100%, 320px); margin-top: 32px; text-align: left; }
        label { display: block; margin-bottom: 8px; font-weight: 600; }
        input { width: 100%; min-width: 0; min-height: 48px; padding: 11px 14px; border: 1px solid #42484b; border-radius: 6px; background: #191d20; color: #e9ebe6; font: 16px/1.5 system-ui, sans-serif; }
        input[aria-invalid="true"] { border-color: #ef9494; }
        .login-error { margin: 14px 0 0; color: #ef9494; overflow-wrap: anywhere; }
        button { display: block; width: 100%; min-height: 48px; margin-top: 18px; padding: 12px 16px; border: 1px solid #b5bb51; border-radius: 6px; background: #b5bb51; color: #111416; font: 650 14px/1.5 system-ui, sans-serif; cursor: pointer; }
        button:hover { background: #c5cb67; border-color: #c5cb67; }
        :focus-visible { outline: 2px solid #b5bb51; outline-offset: 4px; }
        @media (max-height: 600px) { .login-content { padding: 28px 0; } .login-wave { height: 38px; margin-bottom: 20px; } .login-wave span { max-height: 38px; } h1 { font-size: 36px; } form { margin-top: 24px; } }
    </style>
</head>
<body>
<main class="login-shell">
    <div class="login-brand"><b>DK</b><span>VIRTUÁLNÍ ZKUŠEBNA</span></div>
    <section id="formular_prihlaseni" class="login-content" aria-labelledby="login-title">
        <div class="login-wave" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
        <h1 id="login-title">Dušanova<br><span>zkušebna</span></h1>
        <p class="login-subtitle">Vstup pro kapelu</p>
        <form action="<?php echo htmlspecialchars($_SERVER['PHP_SELF'], ENT_QUOTES, 'UTF-8'); ?>" method="post">
            <label for="login-password">Heslo</label>
            <input id="login-password" type="password" name="heslo" autocomplete="current-password" required autofocus<?php if ($wrong_password) echo ' aria-invalid="true"'; ?><?php if ($login_error !== '') echo ' aria-describedby="login-error"'; ?>>
            <?php if ($login_error !== ''): ?>
            <p id="login-error" class="login-error" role="alert"><?php echo htmlspecialchars($login_error, ENT_QUOTES, 'UTF-8'); ?></p>
            <?php endif; ?>
            <button type="submit" name="submit_single" value="1">Vstoupit do zkušebny</button>
        </form>
    </section>
</main>
</body>
</html>
