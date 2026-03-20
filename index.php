<?php
require __DIR__ . '/includes/config.php';
$pageTitle = SITE_NAME;
require __DIR__ . '/includes/header.php';
?>

<div class="text-center mb-4">
    <h1 class="display-5 fw-bold"><i class="bi bi-search me-2"></i><?= SITE_NAME ?></h1>
    <p class="lead text-muted">Search across open educational resource repositories</p>
</div>

<!-- Provider config for JS -->
<script type="application/json" id="providerData"><?php
    $pData = [];
    foreach ($providers as $id => $p) {
        $pData[$id] = [
            'name'         => $p['name'],
            'color'        => $p['color'],
            'icon'         => $p['icon'],
            'searchPrefix' => $p['searchPrefix'],
        ];
    }
    echo json_encode($pData);
?></script>

<!-- Source filter — always visible, choose before searching -->
<div class="text-center mb-3">
    <p class="small text-muted mb-2">Search in:</p>
    <div id="sourceFilter" class="d-flex justify-content-center flex-wrap gap-2"></div>
</div>

<form id="searchForm" class="row g-2 justify-content-center mb-4">
    <div class="col-md-8 col-lg-6">
        <div class="input-group input-group-lg">
            <input type="text" id="searchInput" class="form-control" name="q"
                   placeholder="Search for courses, textbooks, materials..."
                   autofocus required minlength="2">
            <button class="btn btn-primary" type="submit">
                <i class="bi bi-search me-1"></i> Search
            </button>
            <button class="btn btn-outline-secondary d-none" type="button" id="clearSearch">
                <i class="bi bi-x-lg"></i>
            </button>
        </div>
    </div>
</form>

<div id="results"></div>

<!-- Welcome panel shown before first search -->
<div id="welcome" class="text-center text-muted mt-5">
    <i class="bi bi-mortarboard fs-1 mb-3 d-block opacity-25"></i>
    <p>Select sources above and enter a search term to find open educational resources.</p>
</div>

<?php require __DIR__ . '/includes/footer.php'; ?>
