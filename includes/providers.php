<?php
/**
 * OER Search Providers
 *
 * Each provider attempts to fetch results via API or HTML scraping.
 * If a provider fails, returns an empty array and the UI
 * shows a "search directly" link instead.
 */

/**
 * Fetch a URL using cURL with timeout and error handling.
 */
function curlFetch(string $url, int $timeout = 10, array $headers = []): ?string
{
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 3,
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        CURLOPT_SSL_VERIFYPEER => CURL_VERIFY_SSL,
        CURLOPT_HTTPHEADER     => $headers,
    ]);
    $body = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($body === false || $code >= 400) return null;
    return $body;
}

/* ------------------------------------------------------------------ */
/*  MERLOT — HTML scraping (REST API requires a license key)          */
/* ------------------------------------------------------------------ */
function searchMerlot(string $query, int $limit = 10): array
{
    $url = 'https://www.merlot.org/merlot/materials.htm?' . http_build_query([
        'keywords'      => $query,
        'sort.property' => 'relevance',
    ]);

    $html = curlFetch($url, 15);
    if (!$html) return [];

    $results = [];

    // Each result is in a <div class="card merlot-material-item">
    // Title: <h4><a href="/merlot/viewMaterial.htm?id=XXXXX">Title</a></h4>
    // Description follows in the card-body
    if (preg_match_all(
        '/<div[^>]*class="card\s+merlot-material-item"[^>]*>(.*?)<\/div>\s*<\/div>\s*<\/div>/si',
        $html, $cards
    )) {
        foreach (array_slice($cards[1], 0, $limit) as $card) {
            $title = '';
            $href  = '';
            $desc  = '';
            $type  = '';

            // Extract title and link from <h4>
            if (preg_match('/<h4>\s*<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/si', $card, $m)) {
                $href  = 'https://www.merlot.org' . $m[1];
                $title = trim(strip_tags($m[2]));
            }

            // Extract description text from card-body paragraph
            if (preg_match('/<p[^>]*>(.*?)<\/p>/si', $card, $m)) {
                $desc = trim(strip_tags($m[1]));
                // Clean up "see more" trailing text from MERLOT
                $desc = preg_replace('/\s*see\s+more\s*$/i', '...', $desc);
                $desc = mb_substr($desc, 0, 250);
            }

            // Extract material type badge
            if (preg_match('/Material Type:\s*([^<]+)/i', $card, $m)) {
                $type = trim($m[1]);
            }

            if ($title && $href) {
                $results[] = [
                    'title'       => html_entity_decode($title, ENT_QUOTES, 'UTF-8'),
                    'url'         => $href,
                    'description' => html_entity_decode($desc, ENT_QUOTES, 'UTF-8'),
                    'type'        => $type,
                ];
            }
        }
    }

    // Fallback: simpler regex if card structure didn't match
    if (empty($results)) {
        if (preg_match_all(
            '/<h4>\s*<a\s+href="(\/merlot\/viewMaterial\.htm\?id=\d+)"[^>]*>(.*?)<\/a>/si',
            $html, $matches, PREG_SET_ORDER
        )) {
            foreach (array_slice($matches, 0, $limit) as $m) {
                $title = trim(strip_tags($m[2]));
                if (!$title) continue;
                $results[] = [
                    'title'       => html_entity_decode($title, ENT_QUOTES, 'UTF-8'),
                    'url'         => 'https://www.merlot.org' . $m[1],
                    'description' => '',
                    'type'        => '',
                ];
            }
        }
    }

    return $results;
}

/* ------------------------------------------------------------------ */
/*  OER Commons                                                       */
/*  Note: Their search API requires an access token and results are   */
/*  JS-rendered, so neither API nor scraping is viable. Returns empty */
/*  so the UI shows a "search directly" link.                         */
/* ------------------------------------------------------------------ */
function searchOERCommons(string $query, int $limit = 10): array
{
    // API requires auth token; search results are JS-rendered
    return [];
}

/* ------------------------------------------------------------------ */
/*  OpenStax — Wagtail CMS JSON API (books)                          */
/* ------------------------------------------------------------------ */
function searchOpenStax(string $query, int $limit = 10): array
{
    $url = 'https://openstax.org/apps/cms/api/v2/pages/?' . http_build_query([
        'type'   => 'books.Book',
        'fields' => 'title,description,book_state',
        'search' => $query,
        'limit'  => $limit,
    ]);

    $json = curlFetch($url, 10, ['Accept: application/json']);
    if (!$json) return [];

    $data = json_decode($json, true);
    if (!$data || empty($data['items'])) return [];

    $results = [];
    foreach ($data['items'] as $item) {
        $meta    = $item['meta'] ?? [];
        $htmlUrl = $meta['html_url'] ?? '';

        $results[] = [
            'title'       => $item['title'] ?? 'Untitled',
            'url'         => $htmlUrl
                ? (str_starts_with($htmlUrl, 'http') ? $htmlUrl : "https://openstax.org{$htmlUrl}")
                : 'https://openstax.org',
            'description' => mb_substr(strip_tags($item['description'] ?? ''), 0, 250),
            'type'        => 'Textbook',
        ];
    }
    return $results;
}

/* ------------------------------------------------------------------ */
/*  MIT OpenCourseWare — MIT Open Learning search API                */
/*  Endpoint: /api/v1/learning_resources_search/ (note the _search)  */
/* ------------------------------------------------------------------ */
function searchMITOCW(string $query, int $limit = 10): array
{
    $url = 'https://api.learn.mit.edu/api/v1/learning_resources_search/?' . http_build_query([
        'q'             => $query,
        'offered_by'    => 'ocw',
        'resource_type' => 'course',
        'limit'         => $limit,
    ]);

    $json = curlFetch($url, 10, ['Accept: application/json']);
    if (!$json) return [];

    $data = json_decode($json, true);
    if (!$data || empty($data['results'])) return [];

    $results = [];
    foreach ($data['results'] as $item) {
        $title = $item['title'] ?? '';
        if (!$title) continue;

        $results[] = [
            'title'       => $title,
            'url'         => $item['url'] ?? 'https://ocw.mit.edu',
            'description' => mb_substr(strip_tags(
                $item['description'] ?? $item['short_description'] ?? ''
            ), 0, 250),
            'type'        => ucfirst(str_replace('_', ' ', $item['resource_type'] ?? 'Course')),
        ];
    }
    return $results;
}

/* ------------------------------------------------------------------ */
/*  Edinburgh Open (open.ed.ac.uk) — WordPress site, HTML scraping   */
/* ------------------------------------------------------------------ */
function searchOpenEd(string $query, int $limit = 10): array
{
    $url = 'https://open.ed.ac.uk/?' . http_build_query(['s' => $query]);

    $html = curlFetch($url, 15);
    if (!$html) return [];

    $results = [];

    // WordPress article structure: <article class="content-excerpt ...">
    if (preg_match_all(
        '/<article[^>]*class="[^"]*content-excerpt[^"]*"[^>]*>(.*?)<\/article>/si',
        $html, $articles
    )) {
        foreach (array_slice($articles[1], 0, $limit) as $article) {
            $title = '';
            $href  = '';
            $desc  = '';

            // Title in <h2 class="entry-title">
            if (preg_match('/<h2[^>]*class="entry-title[^"]*"[^>]*>\s*<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/si', $article, $m)) {
                $href  = $m[1];
                $title = trim(strip_tags($m[2]));
            }

            // Excerpt in <div class="entry clearfix">
            if (preg_match('/<div[^>]*class="entry clearfix"[^>]*>(.*?)<\/div>/si', $article, $m)) {
                $desc = trim(strip_tags($m[1]));
                $desc = preg_replace('/\s*Read more\s*$/i', '', $desc);
                $desc = mb_substr($desc, 0, 250);
            }

            if ($title && $href) {
                $results[] = [
                    'title'       => html_entity_decode($title, ENT_QUOTES, 'UTF-8'),
                    'url'         => $href,
                    'description' => html_entity_decode($desc, ENT_QUOTES, 'UTF-8'),
                    'type'        => 'OER',
                ];
            }
        }
    }
    return $results;
}

/* ------------------------------------------------------------------ */
/*  Edinburgh Media (media.ed.ac.uk) — Kaltura MediaSpace            */
/*  Search results are JS-rendered; cannot be scraped server-side.    */
/*  Returns empty; UI shows direct search link.                       */
/* ------------------------------------------------------------------ */
function searchEdMedia(string $query, int $limit = 10): array
{
    return [];
}

/* ------------------------------------------------------------------ */
/*  Dispatcher helpers                                                */
/* ------------------------------------------------------------------ */

function getSearchUrl(string $provider, string $query): string
{
    global $providers;
    $prefix = $providers[$provider]['searchPrefix'] ?? '#';
    return $prefix . urlencode($query);
}

function searchProvider(string $provider, string $query, int $limit = 10): array
{
    return match ($provider) {
        'merlot'     => searchMerlot($query, $limit),
        'oercommons' => searchOERCommons($query, $limit),
        'openstax'   => searchOpenStax($query, $limit),
        'mitocw'     => searchMITOCW($query, $limit),
        'opened'     => searchOpenEd($query, $limit),
        'edmedia'    => searchEdMedia($query, $limit),
        default      => [],
    };
}
