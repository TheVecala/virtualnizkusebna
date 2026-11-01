-- Rucni prevod vsech odkazu na ucet admin na ucet dusan ve VZ2.
-- Pred spustenim zalohovat DB. Spustit cely soubor na jednom spojeni.
-- Pri prvni chybe zastavit a provest ROLLBACK misto COMMIT.
-- Historie aktivit bude take prepsana; ucet admin a jeho role se nemeni.
-- Pri chybejicim nebo nejednoznacnem uctu se nic nezmeni.

SELECT DATABASE() AS target_database;
SELECT id, name, role FROM users WHERE name IN ('admin', 'dusan');

SET @admin_id = (SELECT IF(COUNT(*) = 1, MIN(id), NULL) FROM users WHERE name = 'admin');
SET @dusan_id = (SELECT IF(COUNT(*) = 1, MIN(id), NULL) FROM users WHERE name = 'dusan');
SET @dusan_name = (SELECT name FROM users WHERE id = @dusan_id);
SET @can_reassign = (@admin_id IS NOT NULL AND @dusan_id IS NOT NULL AND @admin_id <> @dusan_id);

SELECT @admin_id AS admin_id, @dusan_id AS dusan_id,
       IF(@can_reassign, 'OK', 'STOP: chybejici nebo nejednoznacne ucty') AS account_check;

START TRANSACTION;

UPDATE vz2_collections
SET created_by = CASE WHEN created_by = @admin_id THEN @dusan_id ELSE created_by END,
    updated_by = CASE WHEN updated_by = @admin_id THEN @dusan_id ELSE updated_by END
WHERE @can_reassign AND (created_by = @admin_id OR updated_by = @admin_id);
SELECT 'vz2_collections' AS table_name, ROW_COUNT() AS changed_rows;

UPDATE vz2_recordings
SET created_by = CASE WHEN created_by = @admin_id THEN @dusan_id ELSE created_by END,
    updated_by = CASE WHEN updated_by = @admin_id THEN @dusan_id ELSE updated_by END,
    summary_created_by = CASE WHEN summary_created_by = @admin_id THEN @dusan_id ELSE summary_created_by END,
    summary_updated_by = CASE WHEN summary_updated_by = @admin_id THEN @dusan_id ELSE summary_updated_by END
WHERE @can_reassign AND (created_by = @admin_id OR updated_by = @admin_id OR summary_created_by = @admin_id OR summary_updated_by = @admin_id);
SELECT 'vz2_recordings' AS table_name, ROW_COUNT() AS changed_rows;

UPDATE vz2_audio_files
SET created_by = CASE WHEN created_by = @admin_id THEN @dusan_id ELSE created_by END,
    updated_by = CASE WHEN updated_by = @admin_id THEN @dusan_id ELSE updated_by END,
    deleted_by = CASE WHEN deleted_by = @admin_id THEN @dusan_id ELSE deleted_by END
WHERE @can_reassign AND (created_by = @admin_id OR updated_by = @admin_id OR deleted_by = @admin_id);
SELECT 'vz2_audio_files' AS table_name, ROW_COUNT() AS changed_rows;

UPDATE vz2_timestamps
SET created_by = CASE WHEN created_by = @admin_id THEN @dusan_id ELSE created_by END,
    updated_by = CASE WHEN updated_by = @admin_id THEN @dusan_id ELSE updated_by END
WHERE @can_reassign AND (created_by = @admin_id OR updated_by = @admin_id);
SELECT 'vz2_timestamps' AS table_name, ROW_COUNT() AS changed_rows;

UPDATE vz2_discussion_posts
SET created_by = CASE WHEN created_by = @admin_id THEN @dusan_id ELSE created_by END,
    updated_by = CASE WHEN updated_by = @admin_id THEN @dusan_id ELSE updated_by END
WHERE @can_reassign AND (created_by = @admin_id OR updated_by = @admin_id);
SELECT 'vz2_discussion_posts' AS table_name, ROW_COUNT() AS changed_rows;

UPDATE vz2_documents
SET created_by = CASE WHEN created_by = @admin_id THEN @dusan_id ELSE created_by END,
    updated_by = CASE WHEN updated_by = @admin_id THEN @dusan_id ELSE updated_by END
WHERE @can_reassign AND (created_by = @admin_id OR updated_by = @admin_id);
SELECT 'vz2_documents' AS table_name, ROW_COUNT() AS changed_rows;

UPDATE vz2_document_versions
SET created_by = CASE WHEN created_by = @admin_id THEN @dusan_id ELSE created_by END
WHERE @can_reassign AND (created_by = @admin_id);
SELECT 'vz2_document_versions' AS table_name, ROW_COUNT() AS changed_rows;

UPDATE vz2_attachments
SET created_by = CASE WHEN created_by = @admin_id THEN @dusan_id ELSE created_by END,
    updated_by = CASE WHEN updated_by = @admin_id THEN @dusan_id ELSE updated_by END,
    deleted_by = CASE WHEN deleted_by = @admin_id THEN @dusan_id ELSE deleted_by END,
    summary_created_by = CASE WHEN summary_created_by = @admin_id THEN @dusan_id ELSE summary_created_by END,
    summary_updated_by = CASE WHEN summary_updated_by = @admin_id THEN @dusan_id ELSE summary_updated_by END
WHERE @can_reassign AND (created_by = @admin_id OR updated_by = @admin_id OR deleted_by = @admin_id OR summary_created_by = @admin_id OR summary_updated_by = @admin_id);
SELECT 'vz2_attachments' AS table_name, ROW_COUNT() AS changed_rows;

UPDATE vz2_file_operations
SET actor_id = CASE WHEN actor_id = @admin_id THEN @dusan_id ELSE actor_id END
WHERE @can_reassign AND (actor_id = @admin_id);
SELECT 'vz2_file_operations' AS table_name, ROW_COUNT() AS changed_rows;

UPDATE vz2_activity_log
SET actor_id = @dusan_id,
    actor_name = @dusan_name
WHERE @can_reassign AND actor_id = @admin_id;
SELECT 'vz2_activity_log' AS table_name, ROW_COUNT() AS changed_rows;

COMMIT;

