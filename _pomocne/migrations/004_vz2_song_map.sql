-- Mapa skladby: spustit rucne ve stavajici DB VZ2 po aktualnim preflightu a zaloze.
-- Zadna automaticka migrace, nova tabulka ani prevod puvodnich tabulatur.
-- Puvodni poradi ENUM zustava; tento prikaz lze opakovat pro toto schema.
-- Predem overit SHOW CREATE TABLE vz2_documents a vz2_document_versions.
SET SESSION sql_mode = CONCAT_WS(',', NULLIF(@@SESSION.sql_mode, ''), 'STRICT_TRANS_TABLES', 'ERROR_FOR_DIVISION_BY_ZERO', 'NO_ENGINE_SUBSTITUTION');
SELECT DATABASE() AS migration_database;
ALTER TABLE vz2_documents MODIFY kind ENUM('lyrics_chords','tablature','song_map') NOT NULL;
