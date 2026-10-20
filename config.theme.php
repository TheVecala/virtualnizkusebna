<?php
declare(strict_types=1);

// Jediná volba vzhledu pro všechny uživatele: 'dark' nebo 'light'.
const SITE_THEME = 'dark';

function site_theme(): string {
    return SITE_THEME === 'light' ? 'light' : 'dark';
}
