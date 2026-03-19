<?php
define('SITE_NAME', 'OER Search Engine');

// XAMPP on Windows often lacks a CA bundle for cURL.
// Set to true in production with a proper CA bundle.
define('CURL_VERIFY_SSL', false);

$providers = [
    'merlot' => [
        'name'         => 'MERLOT',
        'color'        => '#0066cc',
        'icon'         => 'bi-mortarboard-fill',
        'url'          => 'https://www.merlot.org',
        'searchPrefix' => 'https://www.merlot.org/merlot/materials.htm?keywords=',
    ],
    'oercommons' => [
        'name'         => 'OER Commons',
        'color'        => '#e67e22',
        'icon'         => 'bi-globe2',
        'url'          => 'https://www.oercommons.org',
        'searchPrefix' => 'https://www.oercommons.org/search?q=',
    ],
    'openstax' => [
        'name'         => 'OpenStax',
        'color'        => '#d4450c',
        'icon'         => 'bi-book-half',
        'url'          => 'https://openstax.org',
        'searchPrefix' => 'https://openstax.org/search?q=',
    ],
    'mitocw' => [
        'name'         => 'MIT OpenCourseWare',
        'color'        => '#a31f34',
        'icon'         => 'bi-building',
        'url'          => 'https://ocw.mit.edu',
        'searchPrefix' => 'https://ocw.mit.edu/search/?q=',
    ],
    'opened' => [
        'name'         => 'Edinburgh Open.Ed',
        'color'        => '#005c96',
        'icon'         => 'bi-journal-richtext',
        'url'          => 'https://open.ed.ac.uk',
        'searchPrefix' => 'https://open.ed.ac.uk/?s=',
    ],
    'edmedia' => [
        'name'         => 'Media Hopper Create',
        'color'        => '#7b2d8b',
        'icon'         => 'bi-play-circle-fill',
        'url'          => 'https://media.ed.ac.uk',
        'searchPrefix' => 'https://media.ed.ac.uk/search/entry/list?keyword=',
    ],
];
