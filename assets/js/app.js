document.addEventListener('DOMContentLoaded', () => {
    const form       = document.getElementById('searchForm');
    const input      = document.getElementById('searchInput');
    const resultsDiv = document.getElementById('results');
    const welcome    = document.getElementById('welcome');
    const providers  = JSON.parse(document.getElementById('providerData').textContent);

    /* ---------- Dark mode ---------- */
    const themeBtn = document.getElementById('themeToggle');
    const saved    = localStorage.getItem('oer-theme');
    if (saved) applyTheme(saved);

    themeBtn.addEventListener('click', () => {
        const cur  = document.documentElement.getAttribute('data-bs-theme');
        const next = cur === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        localStorage.setItem('oer-theme', next);
    });

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-bs-theme', theme);
        themeBtn.querySelector('i').className =
            theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-fill';
    }

    /* ---------- Search ---------- */
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const query = input.value.trim();
        if (query.length < 2) return;
        history.replaceState(null, '', '?q=' + encodeURIComponent(query));
        runSearch(query);
    });

    // Auto-search if ?q= present in URL
    const params = new URLSearchParams(location.search);
    if (params.get('q')) {
        input.value = params.get('q');
        runSearch(params.get('q'));
    }

    /* ---------- Source filter ---------- */
    const filterDiv     = document.getElementById('sourceFilter');
    let activeProviders = new Set(Object.keys(providers));
    let lastQuery       = '';

    // Build filter buttons once per page load; update counts as results arrive
    (function buildFilter() {
        filterDiv.classList.remove('d-none');
        filterDiv.classList.add('d-flex');
        for (const [id, info] of Object.entries(providers)) {
            const btn = document.createElement('button');
            btn.type           = 'button';
            btn.dataset.id     = id;
            btn.className      = 'btn btn-sm source-filter-btn active';
            btn.style.cssText  = `border-color:${info.color};background:${info.color};color:#fff`;
            btn.addEventListener('click', () => {
                if (activeProviders.has(id)) {
                    activeProviders.delete(id);
                    btn.classList.remove('active');
                    btn.style.cssText = `border-color:${info.color};color:${info.color};background:transparent`;
                } else {
                    activeProviders.add(id);
                    btn.classList.add('active');
                    btn.style.cssText = `border-color:${info.color};background:${info.color};color:#fff`;
                }
                updateFilterCounts();
                renderAll(lastQuery);
            });
            filterDiv.appendChild(btn);
        }
    })();

    function updateFilterCounts() {
        for (const btn of filterDiv.querySelectorAll('[data-id]')) {
            const id     = btn.dataset.id;
            const info   = providers[id];
            const count  = (providerResults[id] || []).length;
            const active = activeProviders.has(id);
            btn.innerHTML = (active ? `<i class="bi bi-check-lg me-1"></i>` : '')
                + `${esc(info.name)}`
                + (providerStatus[id] === 'loading'
                    ? ` <span class="spinner-border spinner-border-sm" style="width:.6rem;height:.6rem"></span>`
                    : ` <span class="badge rounded-pill ms-1" style="background:rgba(0,0,0,.2)">${count}</span>`);
        }
    }

    function resetFilter() {
        activeProviders = new Set(Object.keys(providers));
        for (const btn of filterDiv.querySelectorAll('[data-id]')) {
            const id  = btn.dataset.id;
            const info = providers[id];
            btn.classList.add('active');
            btn.style.cssText = `border-color:${info.color};background:${info.color};color:#fff`;
        }
    }

    /* ---------- Unified search with interspersed results ---------- */

    // State per search run
    let providerResults = {};   // id -> result[]
    let providerStatus  = {};   // id -> 'loading' | 'done' | 'error'

    function runSearch(query) {
        welcome.classList.add('d-none');
        lastQuery       = query;
        providerResults = {};
        providerStatus  = {};
        activeProviders = new Set(Object.keys(providers));

        for (const id of Object.keys(providers)) {
            providerStatus[id] = 'loading';
            providerResults[id] = [];
        }

        resetFilter();
        updateFilterCounts();
        renderAll(query);

        // Fire all provider searches in parallel
        for (const [id, info] of Object.entries(providers)) {
            fetchResults(id, query, info);
        }
    }

    async function fetchResults(id, query, info) {
        const searchUrl = info.searchPrefix + encodeURIComponent(query);
        try {
            const resp = await fetch(
                'api_search.php?provider=' + id + '&q=' + encodeURIComponent(query)
            );
            if (!resp.ok) throw new Error('HTTP ' + resp.status);
            const data = await resp.json();

            providerResults[id] = (data.results || []).map(r => ({
                ...r,
                _provider: id,
                _searchUrl: searchUrl
            }));
            providerStatus[id] = 'done';
        } catch (err) {
            providerResults[id] = [];
            providerStatus[id] = 'error';
        }

        updateFilterCounts();
        renderAll(query);
    }

    function renderAll(query) {
        resultsDiv.innerHTML = '';

        // --- Intersperse results round-robin (active providers only) ---
        const filtered = Object.fromEntries(
            Object.entries(providerResults).filter(([id]) => activeProviders.has(id))
        );
        const merged = intersperse(filtered);

        if (merged.length === 0) {
            // Still loading?
            const anyLoading = Object.values(providerStatus).some(s => s === 'loading');
            if (anyLoading) {
                const loading = document.createElement('div');
                loading.className = 'text-center text-muted py-5';
                loading.innerHTML = '<div class="spinner-border text-secondary mb-2"></div>'
                    + '<div>Searching providers...</div>';
                resultsDiv.appendChild(loading);
            } else {
                const noResults = document.createElement('div');
                noResults.className = 'text-center text-muted py-5';
                noResults.textContent = 'No results found. Try a different search term, or click a provider above to search directly.';
                resultsDiv.appendChild(noResults);
            }
            return;
        }

        // --- Result list ---
        const list = document.createElement('div');
        list.className = 'list-group';
        for (const r of merged) {
            const info = providers[r._provider];
            const a = document.createElement('a');
            a.href = safeUrl(r.url);
            a.target = '_blank';
            a.rel = 'noopener';
            a.className = 'list-group-item list-group-item-action result-item';

            a.innerHTML = `
                <div class="d-flex align-items-start gap-3">
                    <span class="provider-badge flex-shrink-0" title="${esc(info.name)}"
                          style="background:${info.color}">
                        <i class="bi ${info.icon}"></i>
                    </span>
                    <div class="flex-grow-1 min-width-0">
                        <div class="d-flex justify-content-between align-items-start gap-2">
                            <span class="fw-semibold result-title">${esc(r.title)}</span>
                            <span class="d-flex gap-1 flex-shrink-0 text-nowrap">
                                ${r.type ? `<span class="badge bg-secondary-subtle text-secondary-emphasis">${esc(r.type)}</span>` : ''}
                                ${r.license ? `<span class="badge bg-success-subtle text-success-emphasis" title="License">${esc(r.license)}</span>` : ''}
                            </span>
                        </div>
                        ${r.description ? `<small class="text-muted d-block mt-1 result-desc">${esc(r.description)}</small>` : ''}
                        <small class="provider-label" style="color:${info.color}">${esc(info.name)}</small>
                    </div>
                </div>`;
            list.appendChild(a);
        }
        resultsDiv.appendChild(list);

        // --- "Search directly" links for providers with 0 results ---
        const emptyProviders = Object.entries(providerStatus)
            .filter(([id, s]) => s !== 'loading' && providerResults[id].length === 0);

        if (emptyProviders.length > 0) {
            const footer = document.createElement('div');
            footer.className = 'text-center text-muted mt-3 small';
            const links = emptyProviders.map(([id]) => {
                const info = providers[id];
                const url = info.searchPrefix + encodeURIComponent(query);
                return `<a href="${esc(url)}" target="_blank" rel="noopener" class="text-decoration-none">`
                    + `<i class="bi ${info.icon} me-1" style="color:${info.color}"></i>${esc(info.name)}`
                    + ` <i class="bi bi-box-arrow-up-right"></i></a>`;
            });
            footer.innerHTML = 'No results from: ' + links.join(' &middot; ');
            resultsDiv.appendChild(footer);
        }
    }

    /** Intersperse results from multiple providers round-robin */
    function intersperse(providerResults) {
        const queues = Object.entries(providerResults)
            .filter(([_, results]) => results.length > 0)
            .map(([id, results]) => ({ id, items: [...results], i: 0 }));

        if (queues.length === 0) return [];

        const merged = [];
        let remaining = true;
        while (remaining) {
            remaining = false;
            for (const q of queues) {
                if (q.i < q.items.length) {
                    merged.push(q.items[q.i]);
                    q.i++;
                    if (q.i < q.items.length) remaining = true;
                }
            }
        }
        return merged;
    }

    /** Escape HTML to prevent XSS */
    function esc(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    /** Validate URL — only allow http(s) to prevent javascript: injection */
    function safeUrl(url) {
        if (!url || typeof url !== 'string') return '#';
        try {
            const u = new URL(url, location.href);
            if (u.protocol === 'https:' || u.protocol === 'http:') return url;
        } catch (e) {}
        return '#';
    }
});
