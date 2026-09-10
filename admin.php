<?php
session_start();
require_once __DIR__ . '/config.php';
auth_require_admin();
header('Cache-Control: no-store');

$error = '';
$notice = $_SESSION['admin_notice'] ?? '';
unset($_SESSION['admin_notice']);
$available = true;
$users = [];
$guest = [];
try {
    $db = auth_db();
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        auth_check_csrf($_POST);
        $db->begin_transaction();
        try {
            // Jeden společný zámek chrání počet adminů i unikátnost hesel
            // při současném ukládání z více oken nebo z alfa a beta verze.
            $guest = auth_settings($db, true);
            auth_refresh_session();
            if (!auth_is_admin()) {
                $db->rollback();
                auth_require_admin();
            }
            $action = auth_input($_POST, 'action');
            if ($action === 'member') {
                auth_save_member($db, $_POST, $guest);
            } elseif ($action === 'guest') {
                auth_save_guest($db, $_POST, $guest);
            } else {
                throw new InvalidArgumentException('Neplatná akce.');
            }
            $db->commit();
        } catch (Throwable $e) {
            $db->rollback();
            throw $e;
        }
        auth_refresh_session();
        if (!auth_is_admin()) {
            header('Location: index.php', true, 303);
            exit;
        }
        $_SESSION['admin_notice'] = 'Změny byly uloženy.';
        header('Location: admin.php#uzivatele', true, 303);
        exit;
    }
} catch (InvalidArgumentException $e) {
    $error = $e->getMessage();
    http_response_code(422);
} catch (Throwable $e) {
    $error = 'Administrace nyní není dostupná. Zkuste to později.';
    $available = false;
    http_response_code(503);
    error_log('Zkušebna: chyba při načítání nebo ukládání administrace.');
}
if ($available) {
    try {
        $users = $db->query('SELECT id, name, role, active FROM users ORDER BY active DESC, name, id')->fetch_all(MYSQLI_ASSOC);
        $guest = auth_settings($db);
    } catch (Throwable $e) {
        $error = 'Administrace nyní není dostupná. Zkuste to později.';
        $available = false;
        http_response_code(503);
    }
}

function admin_member_form(array $user): void {
    $isNew = empty($user['id']);
    $prefix = $isNew ? 'new' : 'user-' . (int) $user['id'];
    ?>
    <form method="post" action="admin.php#uzivatele" class="admin-form">
      <input type="hidden" name="csrf" value="<?= auth_h(auth_csrf_token()) ?>">
      <input type="hidden" name="action" value="member">
      <input type="hidden" name="id" value="<?= $isNew ? '' : (int) $user['id'] ?>">
      <div class="form-fields">
        <label for="<?= $prefix ?>-name">Jméno<input id="<?= $prefix ?>-name" name="name" maxlength="100" value="<?= auth_h($user['name']) ?>" required autocomplete="off"></label>
        <label for="<?= $prefix ?>-role">Role<select id="<?= $prefix ?>-role" name="role"><option value="muzikant" <?= $user['role'] === 'muzikant' ? 'selected' : '' ?>>muzikant</option><option value="admin" <?= $user['role'] === 'admin' ? 'selected' : '' ?>>admin</option></select></label>
        <label for="<?= $prefix ?>-password">Nové heslo<input id="<?= $prefix ?>-password" type="password" name="password" autocomplete="new-password" <?= $isNew ? 'required' : '' ?>></label>
        <label for="<?= $prefix ?>-confirmation">Potvrzení hesla<input id="<?= $prefix ?>-confirmation" type="password" name="password_confirmation" autocomplete="new-password" <?= $isNew ? 'required' : '' ?>></label>
      </div>
      <label class="check-label"><input type="checkbox" name="active" value="1" <?= (int) $user['active'] ? 'checked' : '' ?>> Aktivní účet</label>
      <p class="form-hint">Heslo alespoň 8 znaků, nejvýše 72 bajtů (diakritika zabere více).<?= $isNew ? '' : ' Prázdné ponechá současné heslo. Při opětovné aktivaci zadejte heslo znovu pro kontrolu shody s jinými přístupy.' ?></p>
      <button type="submit"><?= $isNew ? 'Přidat člena' : 'Uložit změny' ?></button>
    </form>
    <?php
}
?>
<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Administrace · Virtuální zkušebna</title>
  <link rel="stylesheet" href="css/help.css?v=<?= filemtime(__DIR__ . '/css/help.css') ?>">
  <link rel="stylesheet" href="css/admin.css?v=<?= filemtime(__DIR__ . '/css/admin.css') ?>">
</head>
<body class="admin-page">
  <a class="skip-link" href="#obsah">Přeskočit na obsah</a>
  <header class="help-header">
    <a class="help-brand" href="index.php"><span>ZKUŠEBNA</span><small>ADMINISTRACE</small></a>
    <a class="back-link" href="index.php">← Zpět do zkušebny</a>
  </header>
  <div class="help-layout">
    <aside class="help-nav" aria-label="Sekce administrace"><strong>Administrace</strong><nav><a href="#uzivatele" class="active">Uživatelé</a><a href="#server">Server</a><a href="#nastaveni">Nastavení</a></nav></aside>
    <main id="obsah" class="help-content">
      <h1>Administrace</h1>
      <?php if ($error): ?><p class="admin-message error" role="alert"><?= auth_h($error) ?></p><?php endif; ?>
      <?php if ($notice): ?><p class="admin-message" role="status"><?= auth_h($notice) ?></p><?php endif; ?>
      <?php if ($available): ?>
      <section id="uzivatele" class="help-section">
        <h2>Uživatelé</h2>
        <h3>Členové kapely</h3>
        <div class="member-list">
          <?php foreach ($users as $user): ?>
          <details class="member-row" <?= $error && ($_POST['action'] ?? '') === 'member' && ($_POST['id'] ?? '') === (string) $user['id'] ? 'open' : '' ?>>
            <summary><span class="member-name"><?= auth_h($user['name']) ?></span><span class="member-role"><?= auth_h($user['role']) ?></span><span class="member-status"><?= (int) $user['active'] ? 'aktivní' : 'neaktivní' ?></span><span class="edit-label">Upravit</span></summary>
            <?php admin_member_form($user); ?>
          </details>
          <?php endforeach; ?>
        </div>
        <details class="add-member" <?= $error && ($_POST['action'] ?? '') === 'member' && ($_POST['id'] ?? '') === '' ? 'open' : '' ?>>
          <summary>+ Přidat člena</summary>
          <?php admin_member_form(['id' => null, 'name' => '', 'role' => 'muzikant', 'active' => 1]); ?>
        </details>
        <div class="guest-access">
          <h3>Přístup pro hosty</h3>
          <form method="post" action="admin.php#uzivatele" class="admin-form">
            <input type="hidden" name="csrf" value="<?= auth_h(auth_csrf_token()) ?>">
            <input type="hidden" name="action" value="guest">
            <label class="check-label"><input type="checkbox" name="guest_enabled" value="1" <?= (int) $guest['guest_enabled'] ? 'checked' : '' ?>> Povolit hostovský přístup</label>
            <p class="form-hint">Heslo <?= $guest['guest_password_hash'] ? 'je nastavené.' : 'zatím není nastavené.' ?> Při zapnutí zadejte heslo a potvrzení pro kontrolu shody s členy.</p>
            <details <?= $error && ($_POST['action'] ?? '') === 'guest' ? 'open' : '' ?>><summary>Změnit / zadat heslo</summary>
              <div class="form-fields">
                <label>Nové heslo<input type="password" name="password" autocomplete="new-password"></label>
                <label>Potvrzení hesla<input type="password" name="password_confirmation" autocomplete="new-password"></label>
              </div>
              <p class="form-hint">Heslo alespoň 8 znaků, nejvýše 72 bajtů (diakritika zabere více).</p>
            </details>
            <button type="submit">Uložit přístup hostů</button>
          </form>
        </div>
      </section>
      <?php endif; ?>
      <section id="server" class="help-section placeholder-section"><h2>Server</h2><p>Zatím bez nastavení.</p></section>
      <section id="nastaveni" class="help-section placeholder-section"><h2>Nastavení</h2><p>Zatím bez nastavení.</p></section>
    </main>
  </div>
</body>
</html>
