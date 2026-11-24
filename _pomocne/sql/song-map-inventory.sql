-- Předběžná čtecí inventura pro MariaDB. Vyberte společnou databázi alfy a bety.
-- Pošlete souhrny výsledků. Dotazy nevypisují texty map.
-- Úplnou validaci převodu a otisk provede CLI nástroj v režimu --check.
START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY;

SELECT DATABASE() AS databaze, VERSION() AS verze_mariadb;

SELECT TABLE_NAME AS tabulka, ENGINE AS engine
FROM information_schema.TABLES
WHERE TABLE_SCHEMA=DATABASE()
  AND TABLE_NAME IN ('vz2_collections', 'vz2_documents', 'vz2_document_versions')
ORDER BY TABLE_NAME;

SELECT COLUMN_NAME AS sloupec, COLUMN_TYPE AS typ, CHARACTER_SET_NAME AS kodovani
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE()
  AND ((TABLE_NAME='vz2_documents' AND COLUMN_NAME='kind')
       OR (TABLE_NAME='vz2_document_versions' AND COLUMN_NAME='body'))
ORDER BY TABLE_NAME;

SELECT COUNT(*) AS dokumenty_map_skladby
FROM vz2_documents
WHERE kind='song_map';

SELECT formát, COUNT(*) AS revize,
       COALESCE(SUM(aktualni), 0) AS aktualni_revize,
       MAX(bajty) AS nejvetsi_revize_v_bajtech
FROM (
    SELECT CASE
        WHEN JSON_VALID(v.body)=0 THEN 'Neplatný JSON'
        WHEN JSON_TYPE(JSON_EXTRACT(v.body,'$.schema_version'))='INTEGER'
            AND JSON_VALUE(v.body,'$.schema_version') IN (1,2)
            THEN CONCAT('V',JSON_VALUE(v.body,'$.schema_version'))
        ELSE 'Neočekávané schéma'
    END AS formát,
    v.revision=d.current_revision AS aktualni,
    OCTET_LENGTH(v.body) AS bajty
    FROM vz2_documents d
    JOIN vz2_document_versions v ON v.document_id=d.id
    WHERE d.kind='song_map'
) AS inventura
GROUP BY formát
ORDER BY formát;

SELECT COUNT(*) AS mapy_bez_platne_skladby_nebo_aktualni_revize
FROM vz2_documents d
LEFT JOIN vz2_collections c ON c.id=d.collection_id
LEFT JOIN vz2_document_versions v ON v.document_id=d.id AND v.revision=d.current_revision
WHERE d.kind='song_map' AND (c.id IS NULL OR c.kind<>'song' OR v.document_id IS NULL);

SELECT COUNT(*) AS osiřelé_revize_dokumentu
FROM vz2_document_versions v
LEFT JOIN vz2_documents d ON d.id=v.document_id
WHERE d.id IS NULL;

ROLLBACK;
