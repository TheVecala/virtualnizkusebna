-- VZ2 / ETAPA 1 / NEAPLIKOVANY NAVRH. Neni automaticka migrace.
-- Pred spustenim viz design.md a verification.md. Nepouzivat produkcni config.
-- Cil pro izolovane overeni: MariaDB 11.4.5 (verze dolozena starsi dokumentaci).
-- Hosting ani jeho zive schema nebyly overeny. users.id musi byt INT UNSIGNED,
-- PRIMARY KEY, InnoDB podle migrations/001_personal_accounts.sql.
-- Vsechny DATETIME jsou UTC; aplikace nastavi session time_zone = '+00:00'.
-- Povinna pole bez DEFAULT musi dodat server. Zadny seed fiktivnich autoru.
-- Zadny DROP, zadny zasah do users/auth_settings/stareho obsahu.

CREATE TABLE vz2_collection_orders (
    kind ENUM('song','rehearsal') NOT NULL,
    revision INT UNSIGNED NOT NULL DEFAULT 1,
    PRIMARY KEY (kind),
    CONSTRAINT ck_vz2_order_revision CHECK (revision > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO vz2_collection_orders (kind) VALUES ('song'), ('rehearsal');

CREATE TABLE vz2_collections (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    kind ENUM('song','rehearsal') NOT NULL,
    title VARCHAR(200) NOT NULL,
    storage_slug VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    revision INT UNSIGNED NOT NULL DEFAULT 1,
    recordings_revision INT UNSIGNED NOT NULL DEFAULT 1,
    lifecycle ENUM('active','deleting') NOT NULL DEFAULT 'active',
    created_by INT UNSIGNED NOT NULL,
    updated_by INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY ix_vz2_collection_order (kind, sort_order, id),
    CONSTRAINT fk_vz2_collection_kind FOREIGN KEY (kind) REFERENCES vz2_collection_orders (kind) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_collection_author FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_collection_editor FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_vz2_collection_revision CHECK (revision > 0 AND recordings_revision > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vz2_recordings (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    collection_id INT UNSIGNED NOT NULL,
    kind ENUM('single','multitrack') NOT NULL,
    title VARCHAR(200) NOT NULL,
    storage_dir VARCHAR(240) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    summary TEXT NULL,
    summary_created_by INT UNSIGNED NULL,
    summary_created_at DATETIME NULL,
    summary_updated_by INT UNSIGNED NULL,
    summary_updated_at DATETIME NULL,
    duration_ms BIGINT UNSIGNED NULL,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    revision INT UNSIGNED NOT NULL DEFAULT 1,
    timestamps_revision INT UNSIGNED NOT NULL DEFAULT 1,
    lifecycle ENUM('uploading','active','deleting','failed') NOT NULL DEFAULT 'uploading',
    created_by INT UNSIGNED NOT NULL,
    updated_by INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_vz2_recording_dir (storage_dir),
    KEY ix_vz2_recording_list (collection_id, sort_order, id),
    CONSTRAINT fk_vz2_recording_collection FOREIGN KEY (collection_id) REFERENCES vz2_collections (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_recording_author FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_recording_editor FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_summary_author FOREIGN KEY (summary_created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_summary_editor FOREIGN KEY (summary_updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_vz2_recording_revision CHECK (revision > 0 AND timestamps_revision > 0),
    CONSTRAINT ck_vz2_recording_duration CHECK (duration_ms IS NULL OR duration_ms <= 604800000),
    CONSTRAINT ck_vz2_summary_authorship CHECK (
        (summary_created_by IS NULL AND summary_created_at IS NULL AND summary_updated_by IS NULL AND summary_updated_at IS NULL AND summary IS NULL)
        OR (summary_created_by IS NOT NULL AND summary_created_at IS NOT NULL AND summary_updated_by IS NOT NULL AND summary_updated_at IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vz2_audio_files (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    recording_id INT UNSIGNED NOT NULL,
    title VARCHAR(200) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    relative_path VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    format ENUM('mp3','wav','ogg','flac','aac') NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    byte_size BIGINT UNSIGNED NOT NULL,
    sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    duration_ms BIGINT UNSIGNED NULL,
    sort_order INT UNSIGNED NOT NULL DEFAULT 0,
    state ENUM('pending','available','deleting','deleted') NOT NULL DEFAULT 'pending',
    deleted_by INT UNSIGNED NULL,
    deleted_at DATETIME NULL,
    revision INT UNSIGNED NOT NULL DEFAULT 1,
    created_by INT UNSIGNED NOT NULL,
    updated_by INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_vz2_audio_path (relative_path),
    KEY ix_vz2_audio_tracks (recording_id, sort_order, id),
    CONSTRAINT fk_vz2_audio_recording FOREIGN KEY (recording_id) REFERENCES vz2_recordings (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_audio_author FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_audio_editor FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_audio_deleter FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_vz2_audio_revision CHECK (revision > 0),
    CONSTRAINT ck_vz2_audio_duration CHECK (duration_ms IS NULL OR duration_ms <= 604800000),
    CONSTRAINT ck_vz2_audio_deletion CHECK (
        (state = 'deleted' AND deleted_by IS NOT NULL AND deleted_at IS NOT NULL)
        OR (state <> 'deleted' AND deleted_by IS NULL AND deleted_at IS NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vz2_timestamps (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    recording_id INT UNSIGNED NOT NULL,
    kind ENUM('song_start','passage','note') NOT NULL DEFAULT 'note',
    time_ms BIGINT UNSIGNED NOT NULL,
    body TEXT NOT NULL,
    revision INT UNSIGNED NOT NULL DEFAULT 1,
    created_by INT UNSIGNED NOT NULL,
    updated_by INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY ix_vz2_timestamp_list (recording_id, time_ms, id),
    CONSTRAINT fk_vz2_timestamp_recording FOREIGN KEY (recording_id) REFERENCES vz2_recordings (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_timestamp_author FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_timestamp_editor FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_vz2_timestamp_revision CHECK (revision > 0),
    CONSTRAINT ck_vz2_timestamp_time CHECK (time_ms <= 604800000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vz2_discussion_threads (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    collection_id INT UNSIGNED NULL,
    global_key ENUM('ideas') NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_vz2_thread_collection (collection_id),
    UNIQUE KEY uq_vz2_thread_global (global_key),
    CONSTRAINT fk_vz2_thread_collection FOREIGN KEY (collection_id) REFERENCES vz2_collections (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_vz2_thread_target CHECK (
        (collection_id IS NOT NULL AND global_key IS NULL)
        OR (collection_id IS NULL AND global_key IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Technicke vlakno nema autora; kazdy obsahovy prispevek ho ma povinne.
INSERT INTO vz2_discussion_threads (global_key) VALUES ('ideas');

CREATE TABLE vz2_discussion_posts (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    thread_id INT UNSIGNED NOT NULL,
    body TEXT NOT NULL,
    revision INT UNSIGNED NOT NULL DEFAULT 1,
    created_by INT UNSIGNED NOT NULL,
    updated_by INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    KEY ix_vz2_post_list (thread_id, created_at, id),
    CONSTRAINT fk_vz2_post_thread FOREIGN KEY (thread_id) REFERENCES vz2_discussion_threads (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_post_author FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_post_editor FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_vz2_post_revision CHECK (revision > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vz2_documents (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    collection_id INT UNSIGNED NOT NULL,
    kind ENUM('lyrics_chords','tablature') NOT NULL,
    title VARCHAR(200) NOT NULL,
    current_revision INT UNSIGNED NULL,
    created_by INT UNSIGNED NOT NULL,
    updated_by INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_vz2_document_kind (collection_id, kind),
    KEY ix_vz2_document_current (id, current_revision),
    CONSTRAINT fk_vz2_document_collection FOREIGN KEY (collection_id) REFERENCES vz2_collections (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_document_author FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_document_editor FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_vz2_document_revision CHECK (current_revision IS NULL OR current_revision > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vz2_document_versions (
    document_id INT UNSIGNED NOT NULL,
    revision INT UNSIGNED NOT NULL,
    body MEDIUMTEXT NOT NULL,
    created_by INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (document_id, revision),
    CONSTRAINT fk_vz2_version_document FOREIGN KEY (document_id) REFERENCES vz2_documents (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_version_author FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_vz2_version_revision CHECK (revision > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE vz2_documents ADD CONSTRAINT fk_vz2_document_current
    FOREIGN KEY (id, current_revision) REFERENCES vz2_document_versions (document_id, revision)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Zachovani soucasneho uploadu PDF/TXT/obrazku; nejsou to nahravky ani audio.
CREATE TABLE vz2_attachments (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    collection_id INT UNSIGNED NOT NULL,
    title VARCHAR(200) NOT NULL,
    summary TEXT NULL,
    summary_created_by INT UNSIGNED NULL,
    summary_created_at DATETIME NULL,
    summary_updated_by INT UNSIGNED NULL,
    summary_updated_at DATETIME NULL,
    original_name VARCHAR(255) NOT NULL,
    relative_path VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    byte_size BIGINT UNSIGNED NOT NULL,
    sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    state ENUM('pending','available','deleting','deleted') NOT NULL DEFAULT 'pending',
    deleted_by INT UNSIGNED NULL,
    deleted_at DATETIME NULL,
    revision INT UNSIGNED NOT NULL DEFAULT 1,
    created_by INT UNSIGNED NOT NULL,
    updated_by INT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_vz2_attachment_path (relative_path),
    KEY ix_vz2_attachment_list (collection_id, id),
    CONSTRAINT fk_vz2_attachment_collection FOREIGN KEY (collection_id) REFERENCES vz2_collections (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_attachment_author FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_attachment_editor FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_attachment_deleter FOREIGN KEY (deleted_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_attachment_summary_author FOREIGN KEY (summary_created_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_attachment_summary_editor FOREIGN KEY (summary_updated_by) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT ck_vz2_attachment_revision CHECK (revision > 0),
    CONSTRAINT ck_vz2_attachment_summary CHECK (
        (summary_created_by IS NULL AND summary_created_at IS NULL AND summary_updated_by IS NULL AND summary_updated_at IS NULL AND summary IS NULL)
        OR (summary_created_by IS NOT NULL AND summary_created_at IS NOT NULL AND summary_updated_by IS NOT NULL AND summary_updated_at IS NOT NULL)
    ),
    CONSTRAINT ck_vz2_attachment_deletion CHECK (
        (state = 'deleted' AND deleted_by IS NOT NULL AND deleted_at IS NOT NULL)
        OR (state <> 'deleted' AND deleted_by IS NULL AND deleted_at IS NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Mala evidence rozpracovaneho uploadu/mazani, nikoli katalog obsahu.
-- Snapshoty cilovych ID a cest nemaji FK na obsah: musi prezit uplne smazani.
CREATE TABLE vz2_file_operations (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    request_key CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    action ENUM('upload_recording','remove_audio','delete_recording','delete_collection','upload_attachment','remove_attachment') NOT NULL,
    target_type ENUM('recording','collection','attachment') NOT NULL,
    target_id INT UNSIGNED NOT NULL,
    target_title VARCHAR(200) NOT NULL,
    actor_id INT UNSIGNED NOT NULL,
    environment ENUM('alpha','beta') NOT NULL,
    state ENUM('pending','running','failed','completed') NOT NULL DEFAULT 'pending',
    error_code VARCHAR(80) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    completed_at DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_vz2_operation_request (request_key),
    KEY ix_vz2_operation_pending (state, id),
    KEY ix_vz2_operation_target (target_type, target_id, id),
    CONSTRAINT fk_vz2_operation_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vz2_file_operation_items (
    operation_id INT UNSIGNED NOT NULL,
    item_no INT UNSIGNED NOT NULL,
    file_type ENUM('audio','attachment','cache') NOT NULL,
    file_id INT UNSIGNED NULL,
    relative_path VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    staging_path VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin NULL,
    expected_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    state ENUM('pending','done') NOT NULL DEFAULT 'pending',
    PRIMARY KEY (operation_id, item_no),
    CONSTRAINT fk_vz2_operation_item FOREIGN KEY (operation_id) REFERENCES vz2_file_operations (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE vz2_activity_log (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_id INT UNSIGNED NOT NULL,
    actor_name VARCHAR(100) NOT NULL,
    occurred_at DATETIME NOT NULL,
    environment ENUM('alpha','beta') NOT NULL,
    action VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    target_type VARCHAR(40) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    target_id INT UNSIGNED NOT NULL,
    target_title VARCHAR(200) NOT NULL,
    collection_id_snapshot INT UNSIGNED NULL,
    collection_title_snapshot VARCHAR(200) NULL,
    detail VARCHAR(2000) NOT NULL DEFAULT '',
    operation_id INT UNSIGNED NULL,
    PRIMARY KEY (id),
    KEY ix_vz2_log_time (occurred_at, id),
    KEY ix_vz2_log_actor (actor_id, occurred_at, id),
    KEY ix_vz2_log_target (target_type, target_id, id),
    KEY ix_vz2_log_environment (environment, occurred_at, id),
    UNIQUE KEY uq_vz2_log_operation_event (operation_id, action, target_type, target_id),
    CONSTRAINT fk_vz2_log_actor FOREIGN KEY (actor_id) REFERENCES users (id) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT fk_vz2_log_operation FOREIGN KEY (operation_id) REFERENCES vz2_file_operations (id) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
