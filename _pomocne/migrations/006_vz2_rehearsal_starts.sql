-- Verzovany textovy prehled zacatku skladeb pro zkousku.
-- Spustit rucne po migraci 005 a overeni aktualniho schematu.
SET SESSION sql_mode = CONCAT_WS(',', NULLIF(@@SESSION.sql_mode, ''), 'STRICT_TRANS_TABLES', 'ERROR_FOR_DIVISION_BY_ZERO', 'NO_ENGINE_SUBSTITUTION');
SELECT DATABASE() AS migration_database;
ALTER TABLE vz2_documents MODIFY kind ENUM('lyrics_chords','tablature','song_map','rehearsal_starts') NOT NULL;
