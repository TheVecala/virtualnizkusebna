<?php
// Copy to config.vz2.php on the chosen environment AFTER applying migration 002.
// Keep that private file out of Git. These values do not enable VZ2 by themselves.
define('VZ2_ENABLED', true);
define('VZ2_WRITES_ENABLED', false); // Enable after preflight and a verified backup.
define('VZ2_ONLY', false); // true: default index opens VZ2; legacy content endpoints return 410.
define('VZ2_ENVIRONMENT', 'beta');
define('VZ2_DATASET_KEY', 'replace-with-a-unique-dataset-key');
// Actual common PUBLIC root, not just the beta installation directory.
define('VZ2_PUBLIC_ROOT', '/data/www/18810/dusanovakapela_cz');
// Proposed sibling of both installations; never inside old audio directories.
define('VZ2_STORAGE_ROOT', '/data/www/18810/dusanovakapela_cz/_vz2_storage');
define('VZ2_STORAGE_ACCESS', 'http-denied'); // Or 'private' outside VZ2_PUBLIC_ROOT.
// Set true ONLY after filesystem checks and anonymous HTTP checks for all aliases.
// This is an operator declaration, not an automatic security test. See docs/vz2/storage.md.
define('VZ2_STORAGE_HTTP_VERIFIED', false);
// Create root/.vz2-storage-id manually with exactly VZ2_DATASET_KEY as its text.
define('VZ2_MAX_UPLOAD_BYTES', 536870912);
define('VZ2_MAX_TRACKS', 20); // Hosting max_file_uploads; total POST limit still applies.
