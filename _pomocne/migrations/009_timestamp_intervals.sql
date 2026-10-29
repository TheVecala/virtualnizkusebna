-- Explicitni pasaze a spolecna vrstva timestampu. Rucni migrace po 008.
-- Pred nasazenim zalohovat DB. Stare pasaze zustavaji bez konce.
SET SESSION sql_mode = CONCAT_WS(',', NULLIF(@@SESSION.sql_mode, ''), 'STRICT_TRANS_TABLES', 'ERROR_FOR_DIVISION_BY_ZERO', 'NO_ENGINE_SUBSTITUTION');
SELECT DATABASE() AS migration_database;
ALTER TABLE vz2_timestamps
    ADD COLUMN IF NOT EXISTS end_time_ms BIGINT UNSIGNED NULL,
    ADD COLUMN IF NOT EXISTS passage_type VARCHAR(24) NULL,
    ADD COLUMN IF NOT EXISTS note_text TEXT NULL,
    ADD COLUMN IF NOT EXISTS song_collection_id INT UNSIGNED NULL,
    ADD COLUMN IF NOT EXISTS parent_timestamp_id INT UNSIGNED NULL;

SET @vz2_fk = IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='vz2_timestamps' AND CONSTRAINT_NAME='fk_vz2_timestamp_song'),
    'SELECT 1', 'ALTER TABLE vz2_timestamps ADD CONSTRAINT fk_vz2_timestamp_song FOREIGN KEY(song_collection_id) REFERENCES vz2_collections(id) ON DELETE RESTRICT ON UPDATE RESTRICT');
PREPARE vz2_stmt FROM @vz2_fk; EXECUTE vz2_stmt; DEALLOCATE PREPARE vz2_stmt;
SET @vz2_fk = IF(EXISTS(SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='vz2_timestamps' AND CONSTRAINT_NAME='fk_vz2_timestamp_parent'),
    'SELECT 1', 'ALTER TABLE vz2_timestamps ADD CONSTRAINT fk_vz2_timestamp_parent FOREIGN KEY(parent_timestamp_id) REFERENCES vz2_timestamps(id) ON DELETE RESTRICT ON UPDATE RESTRICT');
PREPARE vz2_stmt FROM @vz2_fk; EXECUTE vz2_stmt; DEALLOCATE PREPARE vz2_stmt;

UPDATE vz2_timestamps t JOIN vz2_rehearsal_plays p ON p.start_timestamp_id=t.id
SET t.song_collection_id=p.song_collection_id WHERE t.kind='song_start' AND t.song_collection_id IS NULL;
UPDATE vz2_timestamps SET passage_type='custom' WHERE kind='passage' AND passage_type IS NULL;
