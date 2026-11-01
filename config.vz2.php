<?php
// Versioned beta configuration for the existing shared VZ2 dataset.
// When deploying to alpha, change VZ2_ENVIRONMENT to 'alpha' before ending maintenance.
define('VZ2_ENABLED', true);
define('VZ2_WRITES_ENABLED', true);
define('VZ2_ENVIRONMENT', 'beta');
define('VZ2_DATASET_KEY', 'vz2-77d212fe03d7f048f909029c1023cc8ab49bbee48dcda5a4');
// Both installations use the same public root, protected storage and dataset.
define('VZ2_PUBLIC_ROOT', '/data/www/18810/dusanovakapela_cz');
define('VZ2_STORAGE_ROOT', '/data/www/18810/dusanovakapela_cz/_vz2_storage');
define('VZ2_STORAGE_ACCESS', 'http-denied');
// Recorded hosting verification: _pomocne/docs/vz2/storage.md.
// This declaration does not perform or replace an HTTP access check.
define('VZ2_STORAGE_HTTP_VERIFIED', true);
define('VZ2_MAX_UPLOAD_BYTES', 536870912);
define('VZ2_MAX_TRACKS', 20);
