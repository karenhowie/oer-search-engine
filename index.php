<?php
require __DIR__ . '/includes/config.php';
$pageTitle = SITE_NAME;
require __DIR__ . '/includes/header.php';
?>

<div class="text-center mb-4">
    <h1 class="display-5 fw-bold"><i class="bi bi-search me-2"></i><?= SITE_NAME ?></h1>
    <p class="lead text-muted">Search across open educational resource repositories</p>
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
        </div>
    </div>
</form>

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

<div id="sourceFilter" class="d-none justify-content-center flex-wrap gap-2 mb-3"></div>

<div id="results"></div>

<!-- Welcome panel shown before first search -->
<div id="welcome" class="text-center text-muted mt-5">
    <div class="row justify-content-center">
        <?php foreach ($providers as $id => $p): ?>
        <div class="col-6 col-md-3 mb-3">
            <div class="p-3">
                <i class="bi <?= $p['icon'] ?> fs-1" style="color: <?= $p['color'] ?>"></i>
                <div class="mt-2 small fw-semibold"><?= $p['name'] ?></div>
            </div>
        </div>
        <?php endforeach; ?>
    </div>
    <p class="mt-3">Enter a search term to find open educational resources across all providers.</p>
</div>

<?php require __DIR__ . '/includes/footer.php'; ?>
