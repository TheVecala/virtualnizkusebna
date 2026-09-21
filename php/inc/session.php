<?php
declare(strict_types=1);

/** Start every application session with the same cookie policy, before output. */
function app_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;

    $params = session_get_cookie_params();
    // HTTPS is supplied by the webserver. Do not trust client forwarding headers.
    $https = strtolower((string) ($_SERVER['HTTPS'] ?? ''));
    $params['secure'] = $params['secure'] || !in_array($https, ['', 'off', '0'], true);
    $params['httponly'] = true;
    if (empty($params['samesite'])) $params['samesite'] = 'Lax';
    session_set_cookie_params($params);
    if (!session_start()) throw new RuntimeException('Session could not be started.');
}
