<?php if (!defined('ADMIN_STORAGE_CACHE_TTL')) { http_response_code(403); exit; } ?>
<section id="server" class="help-section">
  <div class="storage-heading">
    <h2>Server</h2>
    <form method="post" action="admin.php#server" class="admin-form">
      <input type="hidden" name="csrf" value="<?= auth_h(auth_csrf_token()) ?>">
      <input type="hidden" name="action" value="storage_refresh">
      <button type="submit">Přepočítat</button>
    </form>
  </div>
  <?php if ($storageError): ?><p class="admin-message error" role="alert"><?= auth_h($storageError) ?></p><?php endif; ?>
  <?php if ($storage !== null): ?>
  <p class="form-hint">Data aktuální kapely: skladby, zkoušky, multitracky a jejich zápisy. Přehled slouží pouze ke čtení.</p>
  <div class="storage-cards">
    <div><span>Data zkušebny</span><strong><?= admin_storage_size($storage['bytes']) ?></strong></div>
    <div><span>Volné místo na disku</span><strong><?= admin_storage_size($diskFree) ?></strong></div>
    <div><span>Počet souborů</span><strong><?= number_format($storage['files'], 0, ',', ' ') ?></strong></div>
    <div><span>Skladby / zkoušky / multitracky</span><strong><?= $storage['songs'] ?> / <?= $storage['rehearsals'] ?? 0 ?> / <?= $storage['projects'] ?></strong></div>
  </div>
  <p class="form-hint">Poslední přepočet: <?= date('d. m. Y H:i:s', $storage['calculated_at']) ?> (čas serveru). Výsledek se uchovává 10 minut; tlačítko jej obnoví ihned. Počty skladeb a projektů odpovídají přímým podadresářům.</p>
  <?php if ($storage['errors']): ?><p class="admin-message error">Část adresářů nebo souborů se nepodařilo načíst. Zobrazené součty jsou neúplné.</p><?php endif; ?>
  <?php if ($storage['skipped']): ?><p class="form-hint">Vynechané symbolické odkazy: <?= $storage['skipped'] ?>.</p><?php endif; ?>
  <div class="storage-disk">
    <h3>Využití serverového disku</h3>
    <?php if ($diskPercent !== null): ?>
    <progress max="100" value="<?= $diskPercent ?>" aria-label="Využití serverového disku"><?= $diskPercent ?> %</progress>
    <p><?= number_format($diskPercent, 1, ',', ' ') ?> % · <?= admin_storage_size($diskTotal - $diskFree) ?> použito z <?= admin_storage_size($diskTotal) ?></p>
    <?php else: ?><p>Údaje o kapacitě disku nejsou dostupné.</p><?php endif; ?>
    <p class="form-hint">Kapacita celého filesystemu zahrnuje i ostatní data serveru; nejde o kvótu kapely.</p>
  </div>
  <h3>Adresářový strom</h3>
  <p class="form-hint">Rozbalte adresář pro zobrazení podadresářů. Velikosti zahrnují celý jejich obsah, řazení je od největšího.</p>
  <?php if ($storage['trees']): ?>
  <ul class="storage-tree"><?php foreach ($storage['trees'] as $tree) admin_storage_tree($tree, true); ?></ul>
  <?php else: ?><p class="form-hint">Kapela zatím nemá žádné datové adresáře.</p><?php endif; ?>
  <h3>10 největších souborů</h3>
  <?php if ($storage['largest']): ?>
  <div class="storage-table-wrap" tabindex="0" role="region" aria-label="Největší soubory – vodorovně posuvná tabulka">
    <table class="storage-table">
      <thead><tr><th scope="col">Soubor</th><th scope="col">Umístění</th><th scope="col">Velikost</th><th scope="col">Poslední změna</th></tr></thead>
      <tbody><?php foreach ($storage['largest'] as $file): ?>
        <tr><td><span class="storage-filename" title="<?= auth_h($file['name']) ?>"><?= auth_h($file['name']) ?></span></td><td class="storage-location"><?= auth_h($file['path']) ?></td><td><?= admin_storage_size($file['bytes']) ?></td><td><?= date('d. m. Y H:i', $file['modified']) ?></td></tr>
      <?php endforeach; ?></tbody>
    </table>
  </div>
  <p class="form-hint">Poslední změna souboru neudává čas posledního přehrání.</p>
  <?php else: ?><p class="form-hint">V datových adresářích zatím nejsou žádné soubory.</p><?php endif; ?>
  <?php endif; ?>
</section>
