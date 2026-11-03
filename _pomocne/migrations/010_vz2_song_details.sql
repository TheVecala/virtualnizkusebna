-- VZ2.1.1: popisek cele skladby, usporadane seznamy temp a taktu.
-- Rucni migrace po 009; nejprve zaloha spolecne DB. Bez zmen existujiciho obsahu.
SET SESSION sql_mode = CONCAT_WS(',', NULLIF(@@SESSION.sql_mode, ''), 'STRICT_TRANS_TABLES', 'ERROR_FOR_DIVISION_BY_ZERO', 'NO_ENGINE_SUBSTITUTION');
SELECT DATABASE() AS migration_database;
ALTER TABLE vz2_collections
    ADD COLUMN IF NOT EXISTS song_description TEXT NULL,
    ADD COLUMN IF NOT EXISTS song_tempos JSON NULL,
    ADD COLUMN IF NOT EXISTS song_meters JSON NULL;
