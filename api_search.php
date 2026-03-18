<?php
require __DIR__ . '/includes/config.php';
require __DIR__ . '/includes/providers.php';

header('Content-Type: application/json');
header('Cache-Control: public, max-age=300');

$provider = $_GET['provider'] ?? '';
$query    = trim($_GET['q'] ?? '');

if (!$query || !isset($providers[$provider])) {
    http_response_code(400);
    echo json_encode(['results' => [], 'error' => 'Invalid request']);
    exit;
}

if (mb_strlen($query) < 2) {
    echo json_encode(['results' => [], 'error' => 'Query too short']);
    exit;
}

$results   = searchProvider($provider, $query);
$searchUrl = getSearchUrl($provider, $query);

echo json_encode([
    'results'   => $results,
    'searchUrl' => $searchUrl,
    'provider'  => $provider,
]);
