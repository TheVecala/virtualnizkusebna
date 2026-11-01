<?php if (!function_exists('admin_vz2_storage_report')) { http_response_code(403); exit; } ?>
<section id="server" class="help-section">
  <h2>Server — obsah VZ2</h2>
  <?php if ($storageError): ?><p class="admin-message error" role="alert"><?= auth_h($storageError) ?></p><?php endif; ?>
  <?php if ($storage !== null): ?>
  <div class="storage-cards">
    <div><span>Evidovaná velikost dostupných souborů</span><strong><?= admin_storage_size((int)$storage['bytes']) ?></strong></div>
    <div><span>Dostupné audio soubory a přílohy</span><strong><?= (int)$storage['files'] ?></strong></div>
    <div><span>Skladby / zkoušky</span><strong><?= (int)$storage['songs'] ?> / <?= (int)$storage['rehearsals'] ?></strong></div>
    <div><span>Nahrávky / dokumenty</span><strong><?= (int)$storage['recordings'] ?> / <?= (int)$storage['documents'] ?></strong></div>
  </div>
  <p class="form-hint">Aktuální evidence obsahu zkušebny. Velikost vychází z databáze; nezahrnuje databázi ani zálohy. Skutečné využití hostingové kvóty najdete v administraci Blueboardu.</p>
  <p><?= defined('VZ2_WRITES_ENABLED') && VZ2_WRITES_ENABLED === true ? 'Zápisy jsou povolené.' : 'Tato instalace je pouze pro čtení.' ?></p>
  <?php if ((int)$storage['pending'] > 0): ?><p class="admin-message error">Nedokončené souborové operace: <?= (int)$storage['pending'] ?>. Dokončete je v přehledu VZ2 před přepnutím webu.</p><?php endif; ?>
  <?php endif; ?>
</section>
