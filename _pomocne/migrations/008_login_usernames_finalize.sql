-- Krok 2: POUZE po přepnutí a ověření nového loginu na alfě I betě.
-- Nespouštět automaticky společně s migrací 007. Viz docs/prihlasovani-jmenem.md.
-- Správa účtů je stále pozastavená; všechny účty včetně neaktivních mají username.
SET SESSION sql_mode = CONCAT_WS(',', @@SESSION.sql_mode,
    'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION');

-- Při chybě zde ZASTAVTE. Následující UPDATE se nesmí provést samostatně.
ALTER TABLE users
    MODIFY COLUMN username VARCHAR(32) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL;

-- Uvolní shodná hesla a reaktivaci bez jejich opětovného zadávání.
-- Od tohoto okamžiku nelze bezpečně obnovit starý login založený jen na hesle.
UPDATE auth_settings SET username_login_finalized = 1 WHERE id = 1;
