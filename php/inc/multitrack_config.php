
<script>
window.MULTITRACK_CONFIG = <?= json_encode([
    'listUrl' => 'php/ajax/multitracky.php',
    'detailUrl' => 'php/ajax/multitracky.php?id={id}',
    'uploadUrl' => 'php/actions/upload_multitrack.php',
    'csrfToken' => $_SESSION['multitrack_csrf'],
    'canUpload' => $can_upload_multitrack,
    'canComment' => ma_pravo('comment'),
    'notesUrl' => 'php/ajax/multitrack_notes.php',
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
</script>
