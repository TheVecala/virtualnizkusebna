<?php
// Copy to config.vz2.php on the chosen environment AFTER applying migration 002.
// Keep that private file out of Git. These values do not enable VZ2 by themselves.
define('VZ2_ENABLED', true);
define('VZ2_WRITES_ENABLED', false); // Enable after preflight and a verified backup.
define('VZ2_ENVIRONMENT', 'beta');
define('VZ2_DATASET_KEY', 'replace-with-a-unique-dataset-key');
// Absolute PRIVATE directory outside both web roots and ALL old audio directories.
define('VZ2_STORAGE_ROOT', '/absolute/private/vz2-media');
// Create root/.vz2-storage-id manually with exactly VZ2_DATASET_KEY as its text.
define('VZ2_MAX_UPLOAD_BYTES', 536870912);
define('VZ2_MAX_TRACKS', 32);
