<?php
// Keep existing bookmarks while using the same navigation and panels as the rehearsal room.
$query = ['view' => 'multitrack'];
if (isset($_GET['id']) && is_string($_GET['id'])) $query['id'] = $_GET['id'];
header('Location: index.php?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986), true, 302);
exit;
