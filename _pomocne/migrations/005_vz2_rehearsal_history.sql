-- Historie zkouseni a explicitni useky skladeb. Rucni migrace pro sdilenou VZ2 DB.
-- Pred nasazenim: zaloha, beta preflight a SHOW CREATE TABLE dotcenych tabulek.
-- Prikazy jsou opakovatelne na cilovem schematu MariaDB 10.6+.
SET SESSION sql_mode = CONCAT_WS(',', NULLIF(@@SESSION.sql_mode, ''), 'STRICT_TRANS_TABLES', 'ERROR_FOR_DIVISION_BY_ZERO', 'NO_ENGINE_SUBSTITUTION');
SELECT DATABASE() AS migration_database;

ALTER TABLE vz2_collections MODIFY lifecycle ENUM('active','archived','deleting') NOT NULL DEFAULT 'active';

ALTER TABLE vz2_timestamps
    MODIFY kind ENUM('song_start','song_end','passage','note') NOT NULL DEFAULT 'note',
    ADD COLUMN IF NOT EXISTS paired_timestamp_id INT UNSIGNED NULL AFTER body,
    ADD UNIQUE KEY IF NOT EXISTS uq_vz2_timestamp_pair (paired_timestamp_id);

-- MariaDB podporuje IF NOT EXISTS pro sloupce a indexy, ale nikoli v pozici
-- podminenou variantu ADD CONSTRAINT. Cizi klic proto pridame pres
-- information_schema; funguje to i po castecne provedenem prvnim pokusu.
SET @vz2_add_timestamp_pair_fk = IF(
    EXISTS (
        SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE()
          AND TABLE_NAME = 'vz2_timestamps'
          AND CONSTRAINT_NAME = 'fk_vz2_timestamp_pair'
          AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    ),
    'SELECT 1 AS fk_vz2_timestamp_pair_already_exists',
    'ALTER TABLE vz2_timestamps ADD CONSTRAINT fk_vz2_timestamp_pair FOREIGN KEY (paired_timestamp_id) REFERENCES vz2_timestamps (id) ON DELETE RESTRICT ON UPDATE RESTRICT'
);
PREPARE vz2_stmt FROM @vz2_add_timestamp_pair_fk;
EXECUTE vz2_stmt;
DEALLOCATE PREPARE vz2_stmt;

CREATE TABLE IF NOT EXISTS vz2_rehearsal_plays (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    rehearsal_collection_id INT UNSIGNED NOT NULL,
    song_collection_id INT UNSIGNED NOT NULL,
    rehearsal_title_snapshot VARCHAR(200) NOT NULL,
    song_title_snapshot VARCHAR(200) NOT NULL,
    source_recording_id INT UNSIGNED NULL,
    start_timestamp_id INT UNSIGNED NULL,
    end_timestamp_id INT UNSIGNED NULL,
    clip_recording_id INT UNSIGNED NULL,
    revision INT UNSIGNED NOT NULL DEFAULT 1,
    created_by INT UNSIGNED NOT NULL,
    updated_by INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_vz2_play_interval (start_timestamp_id, end_timestamp_id),
    UNIQUE KEY uq_vz2_play_clip (clip_recording_id),
    KEY ix_vz2_play_matrix (rehearsal_collection_id, song_collection_id, id),
    KEY ix_vz2_play_song (song_collection_id, rehearsal_collection_id, id),
    CONSTRAINT fk_vz2_play_rehearsal FOREIGN KEY (rehearsal_collection_id) REFERENCES vz2_collections (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_play_song FOREIGN KEY (song_collection_id) REFERENCES vz2_collections (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_play_source FOREIGN KEY (source_recording_id) REFERENCES vz2_recordings (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_play_start FOREIGN KEY (start_timestamp_id) REFERENCES vz2_timestamps (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_play_end FOREIGN KEY (end_timestamp_id) REFERENCES vz2_timestamps (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_play_clip FOREIGN KEY (clip_recording_id) REFERENCES vz2_recordings (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_play_author FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_play_editor FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_vz2_play_source CHECK (
        (source_recording_id IS NOT NULL AND start_timestamp_id IS NOT NULL AND end_timestamp_id IS NOT NULL)
        OR clip_recording_id IS NOT NULL
    ),
    CONSTRAINT ck_vz2_play_interval_shape CHECK (
        (start_timestamp_id IS NULL AND end_timestamp_id IS NULL AND source_recording_id IS NULL)
        OR (start_timestamp_id IS NOT NULL AND end_timestamp_id IS NOT NULL AND source_recording_id IS NOT NULL)
    ),
    CONSTRAINT ck_vz2_play_revision CHECK (revision > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
