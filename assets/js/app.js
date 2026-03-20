document.addEventListener('DOMContentLoaded', () => {
    const form       = document.getElementById('searchForm');
    const input      = document.getElementById('searchInput');
    const resultsDiv = document.getElementById('results');
    const welcome    = document.getElementById('welcome');
    const clearBtn   = document.getElementById('clearSearch');
    const filterDiv  = document.getElementById('sourceFilter');
    const providers  = JSON.parse(document.getElementById('providerData').textContent);

    const PAGE_SIZE = 20;

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
        if (activeProviders.size === 0) {
            resultsDiv.innerHTML = '<div class="text-center text-warning py-3">Please select at least one source above before searching.</div>';
            welcome.classList.add('d-none');
            return;
        }
        history.replaceState(null, '', '?q=' + encodeURIComponent(query));
        runSearch(query);
    });

    clearBtn.addEventListener('click', () => {
        input.value = '';
        input.focus();
        history.replaceState(null, '', location.pathname);
        resultsDiv.innerHTML = '';
        clearBtn.classList.add('d-none');
        welcome.classList.remove('d-none');
        providerResults = {};
        providerStatus  = {};
        lastQuery       = '';
        updateFilterCounts();
    });

    // Auto-search if ?q= present in URL
    const params = new URLSearchParams(location.search);
    if (params.get('q')) {
        input.value = params.get('q');
        runSearch(params.get('q'));
    }

    /* ---------- Source filter (pre-search selection) ---------- */
    let activeProviders = new Set(Object.keys(providers));
    let lastQuery       = '';

    // Build filter buttons once at page load
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
                // Late fetch: provider was skipped in last search — fetch it now
                if (lastQuery && providerStatus[id] === 'skipped') {
                    providerStatus[id] = 'loading';
                    providerResults[id] = [];
                    updateFilterCounts();
                    fetchResults(id, lastQuery, info);
                    return; // fetchResults calls updateFilterCounts + renderAll
                }
            }
            updateFilterCounts();
            renderAll(lastQuery);
        });

        filterDiv.appendChild(btn);
    }

    function updateFilterCounts() {
        for (const btn of filterDiv.querySelectorAll('[data-id]')) {
            const id     = btn.dataset.id;
            const info   = providers[id];
            const count  = (providerResults[id] || []).length;
            const active = activeProviders.has(id);
            const status = providerStatus[id]; // undefined before any search

            let countHtml = '';
            if (status === 'loading') {
                countHtml = ` <span class="spinner-border spinner-border-sm" style="width:.6rem;height:.6rem"></span>`;
            } else if (status === 'done') {
                countHtml = ` <span class="badge rounded-pill ms-1" style="background:rgba(0,0,0,.2)">${count}</span>`;
            }
            // 'skipped', 'error', or undefined: no count shown

            btn.innerHTML = (active ? `<i class="bi bi-check-lg me-1"></i>` : '')
                + `${esc(info.name)}`
                + countHtml;
        }
    }

    /* ---------- Search state ---------- */
    let providerResults = {};  // id -> result[]
    let providerStatus  = {};  // id -> 'loading' | 'done' | 'error' | 'skipped'
    let displayedCount  = PAGE_SIZE;

    function runSearch(query) {
        welcome.classList.add('d-none');
        clearBtn.classList.remove('d-none');
        lastQuery      = query;
        displayedCount = PAGE_SIZE;
        providerResults = {};
        providerStatus  = {};

        // Init state: selected providers load, others skipped
        for (const id of Object.keys(providers)) {
            providerResults[id] = [];
            providerStatus[id]  = activeProviders.has(id) ? 'loading' : 'skipped';
        }

        updateFilterCounts();
        renderAll(query);

        // Fire searches only for active providers
        for (const id of activeProviders) {
            fetchResults(id, query, providers[id]);
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
                _searchUrl: searchUrl,
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

        const filtered = Object.fromEntries(
            Object.entries(providerResults).filter(([id]) => activeProviders.has(id))
        );
        const merged = intersperse(filtered);

        if (merged.length === 0) {
            const anyLoading = Object.values(providerStatus).some(s => s === 'loading');
            if (anyLoading) {
                const el = document.createElement('div');
                el.className = 'text-center text-muted py-5';
                el.innerHTML = '<div class="spinner-border text-secondary mb-2"></div>'
                    + '<div>Searching providers…</div>';
                resultsDiv.appendChild(el);
            } else if (lastQuery) {
                const el = document.createElement('div');
                el.className = 'text-center text-muted py-5';
                el.textContent = 'No results found. Try a different search term, or click a provider above to search directly.';
                resultsDiv.appendChild(el);
            }
            return;
        }

        // Paginated result list
        const visible = merged.slice(0, displayedCount);
        const list = document.createElement('div');
        list.className = 'list-group';

        for (const r of visible) {
            const info = providers[r._provider];
            const a = document.createElement('a');
            a.href      = safeUrl(r.url);
            a.target    = '_blank';
            a.rel       = 'noopener';
            a.className = 'list-group-item list-group-item-action result-item';

            const thumbHtml = (r.thumbnail && safeUrl(r.thumbnail) !== '#')
                ? `<img src="${safeUrl(r.thumbnail)}" alt="" class="result-thumb flex-shrink-0" loading="lazy">`
                : `<span class="provider-badge flex-shrink-0" title="${esc(info.name)}" style="background:${info.color}"><i class="bi ${info.icon}"></i></span>`;

            a.innerHTML = `
                <div class="d-flex align-items-start gap-3">
                    ${thumbHtml}
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

        // "Show more" button
        if (merged.length > displayedCount) {
            const remaining   = merged.length - displayedCount;
            const anyLoading  = Object.values(providerStatus).some(s => s === 'loading');
            const moreBtn     = document.createElement('button');
            moreBtn.type      = 'button';
            moreBtn.className = 'btn btn-outline-secondary w-100 mt-3';
            moreBtn.innerHTML = anyLoading
                ? `Show more <span class="badge bg-secondary ms-1">${remaining}+ (still loading…)</span>`
                : `Show more <span class="badge bg-secondary ms-1">${remaining} more</span>`;
            moreBtn.addEventListener('click', () => {
                displayedCount += PAGE_SIZE;
                renderAll(query);
            });
            resultsDiv.appendChild(moreBtn);
        }

        // "Search directly" links for active providers that returned nothing
        const emptyActive = Object.entries(providerStatus).filter(
            ([id, s]) => s === 'done' && activeProviders.has(id) && providerResults[id].length === 0
        );
        if (emptyActive.length > 0) {
            const footer = document.createElement('div');
            footer.className = 'text-center text-muted mt-3 small';
            const links = emptyActive.map(([id]) => {
                const info = providers[id];
                const url  = info.searchPrefix + encodeURIComponent(query);
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

    // Initial render (shows provider names on buttons before any search)
    updateFilterCounts();
});
