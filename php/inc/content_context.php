<?php
/** Shared directory context for the existing song/rehearsal screens and actions. */
function content_section(): string
{
    return ($_SESSION['content_section'] ?? 'uploads') === 'zkousky' ? 'zkousky' : 'uploads';
}

function content_init_context(array $request): void
{
    $previous = content_section();
    $requested = $request['sekce'] ?? $previous;
    if (!is_string($requested) || !in_array($requested, ['uploads', 'zkousky'], true)) {
        http_response_code(400);
        exit('Neplatná sekce.');
    }
    $_SESSION['content_folders'][$previous] = $_SESSION['slozka_souboru_k_zobrazeni'] ?? '';
    $_SESSION['content_section'] = $requested;
    $_SESSION['slozka_souboru_k_zobrazeni'] = $_SESSION['content_folders'][$requested] ?? '';
}

function content_discussion_prefix(): string
{
    return content_section() === 'zkousky' ? 'zkousky_' : 'diskuse_';
}

// Old shared recording links always refer to uploads, independent of the last view.
$contentRequest = array_merge($_GET, $_POST);
if (!isset($contentRequest['sekce']) && isset($_GET['val'])) {
    $contentRequest['sekce'] = 'uploads';
}
content_init_context($contentRequest);
