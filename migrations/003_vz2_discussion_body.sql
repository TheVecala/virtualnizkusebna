-- Stage 4: 20,000 Unicode characters can need 80,000 UTF-8 bytes.
-- Select the existing shared database containing vz2_* before running.
-- Additive widening only; safe to repeat, preserves existing content.
SET SESSION sql_mode = CONCAT_WS(',', NULLIF(@@SESSION.sql_mode, ''), 'STRICT_TRANS_TABLES', 'ERROR_FOR_DIVISION_BY_ZERO', 'NO_ENGINE_SUBSTITUTION');
ALTER TABLE vz2_discussion_posts MODIFY body MEDIUMTEXT NOT NULL;
