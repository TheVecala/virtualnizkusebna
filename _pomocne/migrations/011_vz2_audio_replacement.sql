-- Apply before deploying the audio replacement feature (shared alpha/beta DB).
ALTER TABLE vz2_file_operations
    MODIFY action ENUM('upload_recording','remove_audio','delete_recording','delete_collection','upload_attachment','remove_attachment','replace_audio') NOT NULL,
    ADD COLUMN payload_json MEDIUMTEXT NULL;
