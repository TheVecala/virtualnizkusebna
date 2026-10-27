-- Krok 1: jednou ve společné databázi alfa + beta, PŘED nasazením nového loginu.
-- Během migrace a přepnutí obou instalací pozastavte správu účtů.
-- Původní účty, ID, jména, hesla a role se nemění. Starý login zůstává kompatibilní.
ALTER TABLE users
    ADD COLUMN username VARCHAR(32) CHARACTER SET ascii COLLATE ascii_general_ci NULL AFTER id,
    ADD COLUMN auth_generation INT UNSIGNED NOT NULL DEFAULT 0,
    ADD UNIQUE KEY uq_users_username (username),
    ADD CONSTRAINT chk_users_username CHECK (username IS NULL OR
        (username REGEXP '^[a-z0-9][a-z0-9._-]{2,31}$'
            AND username NOT REGEXP '[^a-z0-9._-]' AND username <> 'host'));

-- Jednoznačné výchozí jméno i pro stejnojmenné a neaktivní členy.
-- Před přepnutím lze upravit podle ID (např. na dusan); nikoli podle jména/hesla.
UPDATE users SET username = CONCAT('clen-', id) WHERE username IS NULL;

ALTER TABLE auth_settings
    ADD COLUMN username_login_finalized TINYINT(1) NOT NULL DEFAULT 0,
    ADD COLUMN guest_auth_generation INT UNSIGNED NOT NULL DEFAULT 0;

-- Nejvýše 50 neúspěšných pokusů za 15 minut z jedné adresy, společně pro alfu/betu.
-- IP adresa je uložená pouze jako hash; neukládáme heslo ani zadané jméno.
CREATE TABLE auth_login_attempts (
    source_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    failures INT UNSIGNED NOT NULL DEFAULT 0,
    expires_at DATETIME NOT NULL,
    PRIMARY KEY (source_key),
    INDEX idx_auth_login_attempts_expiry (expires_at)
) ENGINE=InnoDB;
