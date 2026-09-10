<?php
// DOČASNÁ migrační stránka: nasadit se STARÝM config.php a loginem.
// Po ověření osobního loginu a administrace ze serveru odstranit.
session_start();
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/php/auth.php';
auth_require_admin();
header('Cache-Control: no-store');
$error = '';
$exists = true;
try {
    $db = auth_db();
    // Ověřit před každým zobrazením; při POST znovu pod zámkem.
    $exists = auth_admin_count($db) > 0;
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        auth_check_csrf($_POST);
        $db->begin_transaction();
        try {
            $guest = auth_settings($db, true);
            if (auth_admin_count($db) > 0) {
                $exists = true;
                throw new InvalidArgumentException('Aktivní administrátor již existuje. Dalšího prvního admina nelze vytvořit.');
            }
            auth_save_member($db, $_POST, $guest, true);
            $db->commit();
        } catch (Throwable $e) {
            $db->rollback();
            throw $e;
        }
        header('Location: create_first_admin.php', true, 303);
        exit;
    }
} catch (InvalidArgumentException $e) {
    $error = $e->getMessage();
    http_response_code(422);
} catch (Throwable $e) {
    $error = 'Bootstrap nyní není dostupný. Ověřte provedení SQL migrace a připojení k databázi.';
    $exists = true;
    http_response_code(503);
    error_log('Zkušebna: chyba bootstrapu prvního admina.');
}
?>
<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>První administrátor · Virtuální zkušebna</title>
  <link rel="stylesheet" href="css/help.css">
  <link rel="stylesheet" href="css/admin.css">
</head>
<body class="admin-page">
  <header class="help-header"><a class="help-brand" href="index.php"><span>ZKUŠEBNA</span></a><a class="back-link" href="index.php">← Zpět do zkušebny</a></header>
  <main class="bootstrap-content">
    <h1>První administrátor</h1>
    <?php if ($error): ?><p class="admin-message error" role="alert"><?= auth_h($error) ?></p><?php endif; ?>
    <?php if ($exists && !$error): ?>
      <p class="admin-message">Aktivní administrátor již existuje. Bootstrap další účet nevytvoří.</p>
      <p>Pokračujte přepnutím beta loginu podle migračního postupu. Po ověření nového přihlášení a administrace tuto dočasnou stránku odstraňte.</p>
    <?php elseif (!$exists): ?>
      <form method="post" action="create_first_admin.php" class="admin-form">
        <input type="hidden" name="csrf" value="<?= auth_h(auth_csrf_token()) ?>">
        <label>Jméno<input name="name" maxlength="100" required autocomplete="off"></label>
        <label>Nové heslo<input type="password" name="password" required autocomplete="new-password"></label>
        <label>Potvrzení hesla<input type="password" name="password_confirmation" required autocomplete="new-password"></label>
        <p class="form-hint">Heslo alespoň 8 znaků, nejvýše 72 bajtů (diakritika zabere více).</p>
        <button type="submit">Vytvořit admina</button>
      </form>
    <?php endif; ?>
  </main>
</body>
</html>
