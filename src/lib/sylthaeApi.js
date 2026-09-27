// Thin client for SYLTHARAE's real backend (Flask + PostgreSQL).
//
// This module owns ALL network access to the authoritative system of
// record. It does not compute, rank, filter, sort, paginate, or dedupe
// anything itself -- it only serializes requests and returns the server's
// JSON verbatim (or a Blob for file exports/binary downloads). Every piece
// of "business logic" (relevance, matching, counting, grouping) happens on
// the server; this file exists purely to make those existing endpoints
// convenient to call from React.

let csrfToken = null;
let csrfFetchInFlight = null;

let sessionExpiredHandler = null;
/** Registered once by the store so a mid-session 401 can reset auth state
 *  and surface a real "you were signed out" message, instead of every
 *  screen independently failing against a backend that already dropped it. */
export function onSessionExpired(fn) { sessionExpiredHandler = fn; }

function readCsrfFromDom() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : null;
}

function updateCsrfFromDom() {
  const token = readCsrfFromDom();
  if (token) csrfToken = token;
  return csrfToken;
}

async function coreFetch(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
  const opts = {
    method,
    credentials: 'same-origin',
    headers: { ...headers },
  };
  const isMutating = method !== 'GET' && method !== 'HEAD';
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  if (isMutating) {
    // Proactively obtain a token before the very first mutating call of the
    // session instead of only reacting to a guaranteed-to-fail first attempt
    // (a cold page load previously always burned one failed request + a
    // visible console error on e.g. the initial post-login search).
    if (!csrfToken) { updateCsrfFromDom(); if (!csrfToken) await refreshCsrf(); }
    if (csrfToken) opts.headers['X-CSRFToken'] = csrfToken;
  }

  let res = await fetch(path, opts);

  // Session's CSRF token rotated (e.g. after login) - refresh once and retry.
  if (!res.ok && res.status === 400 && isMutating) {
    let msg = '';
    try { msg = (await res.clone().json()).error || ''; } catch { /* ignore */ }
    if (/csrf|token/i.test(msg)) {
      await refreshCsrf();
      opts.headers['X-CSRFToken'] = csrfToken;
      res = await fetch(path, opts);
    }
  }

  if (res.status === 401) {
    // Preserve the backend's real message/code (e.g. the login endpoint's
    // "Invalid username or password" / invalid_credentials vs. a genuinely
    // expired session's "Authentication required" / unauthenticated --
    // core/security/flask_ext.py) instead of masking both behind one
    // synthetic string, so the UI can show the operator what actually
    // happened.
    let data = null;
    try { data = await res.clone().json(); } catch { /* non-JSON 401 */ }
    const err = new Error(data?.error || data?.message || 'Authentication required');
    err.code = data?.code || 'AUTH_REQUIRED';
    err.status = 401;
    err.body = data;
    // A session that used to be valid just died mid-use (not a login-form
    // rejection, which callers handle locally) -- let the app fall back to
    // the login screen instead of leaving every widget stuck failing silently.
    if (err.code === 'unauthenticated' && sessionExpiredHandler) sessionExpiredHandler();
    throw err;
  }

  if (raw) return res;

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) {
      const err = new Error(data.error || data.message || `Request failed (${res.status})`);
      err.status = res.status;
      err.code = data.code;
      err.body = data;
      throw err;
    }
    return data;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(text || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res;
}

async function refreshCsrf() {
  // Real, dedicated JSON endpoint (apps/web/app.py `get_csrf_token`,
  // explicitly allow-listed alongside login in core/security/flask_ext.py)
  // -- not HTML-scraping, which only worked when the SPA and Flask shared
  // one origin/template. Behind Vite's dev proxy `/` is our own SPA shell,
  // not a Flask-rendered page, so it never carried a csrf-token meta tag;
  // this is the correct fix, not a workaround.
  //
  // Coalesce concurrent callers (e.g. React 18 StrictMode's double-invoked
  // mount effect firing two bootstrap calls back to back) into one network
  // request instead of two racing fetches.
  if (csrfFetchInFlight) return csrfFetchInFlight;
  csrfFetchInFlight = (async () => {
    try {
      const res = await fetch('/api/csrf-token', { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        if (data.csrf_token) csrfToken = data.csrf_token;
      }
    } catch {
      /* keep whatever token we had */
    } finally {
      csrfFetchInFlight = null;
    }
    return csrfToken;
  })();
  return csrfFetchInFlight;
}

function qs(params) {
  const search = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((v) => { if (v !== undefined && v !== null && v !== '') search.append(key, v); });
    } else {
      search.append(key, value);
    }
  });
  const str = search.toString();
  return str ? `?${str}` : '';
}

// ---------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------

export const auth = {
  async login(username, password) {
    await refreshCsrf();
    const data = await coreFetch('/auth/login', { method: 'POST', body: { username, password } });
    await refreshCsrf();
    return data;
  },
  async logout() {
    return coreFetch('/auth/logout', { method: 'POST' }).catch(() => {});
  },
  /**
   * Upstream RES-AUTH-02: the backend now requires the current password
   * (proof of possession beyond just an active session) before it will set
   * a new one -- see core/security/service.py `change_own_password`.
   */
  async changePassword(currentPassword, newPassword) {
    return coreFetch('/auth/change-password', { method: 'POST', body: { current_password: currentPassword, new_password: newPassword } });
  },
  /** GET /auth/me -- the real, dedicated session-identity endpoint. */
  async me() { return coreFetch('/auth/me'); },
};

// ---------------------------------------------------------------------
// Search (Api/routes/search.py, Api/services/search_service.py)
// ---------------------------------------------------------------------

export const search = {
  /** POST /api/search - the single authoritative query/browse endpoint. */
  async run(definition) {
    return coreFetch('/api/search', { method: 'POST', body: definition });
  },
  async autocomplete(query, limit = 10) {
    if (!query || query.trim().length < 2) return { suggestions: [], count: 0 };
    return coreFetch(`/api/search/autocomplete${qs({ query, limit })}`);
  },
  async suggestions(query, limit = 5) {
    if (!query || query.trim().length < 2) return { suggestions: [] };
    return coreFetch(`/api/search/suggestions${qs({ query, limit })}`);
  },
  history: {
    async list(limit = 20) {
      return coreFetch(`/api/search/history${qs({ limit })}`);
    },
    async clear() {
      return coreFetch('/api/search/history', { method: 'DELETE' });
    },
  },
  saved: {
    async list() {
      return coreFetch('/api/search/saved');
    },
    async get(id) {
      return coreFetch(`/api/search/saved/${id}`);
    },
    async create(name, queryStr, filters) {
      return coreFetch('/api/search/saved', { method: 'POST', body: { name, query: queryStr, filters } });
    },
    async update(id, patch) {
      return coreFetch(`/api/search/saved/${id}`, { method: 'PUT', body: patch });
    },
    async remove(id) {
      return coreFetch(`/api/search/saved/${id}`, { method: 'DELETE' });
    },
  },
  /** Re-runs the authoritative query server-side and downloads the file it produces. */
  async exportResults(definition) {
    const res = await coreFetch('/api/search/export', { method: 'POST', body: definition, raw: true });
    if (!res.ok) {
      let msg = 'Export failed';
      try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
      throw new Error(msg);
    }
    return downloadBlobResponse(res);
  },
  async exportFilenames(definition) {
    const res = await coreFetch('/api/search/export-filenames', { method: 'POST', body: definition, raw: true });
    if (!res.ok) {
      let msg = 'Export failed';
      try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
      throw new Error(msg);
    }
    return downloadBlobResponse(res);
  },
  /** The one source of truth for which columns a database export can publish. */
  async exportColumns() { return coreFetch('/api/search/export/columns'); },
};

async function downloadBlobResponse(res) {
  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const filename = match ? match[1] : 'export';
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return {
    filename,
    scope: res.headers.get('x-export-scope'),
    rows: res.headers.get('x-export-rows'),
    total: res.headers.get('x-export-total'),
    truncated: res.headers.get('x-export-truncated'),
  };
}

// ---------------------------------------------------------------------
// Facets: sources / sides / categories / analyst categories / file types
// ---------------------------------------------------------------------

export const facets = {
  async sources() { return coreFetch('/api/sources'); },
  async sides() { return coreFetch('/api/sides'); },
  async categories() { return coreFetch('/api/categories'); },
  async analystCategories() { return coreFetch('/api/analyst/categories'); },
  /** Real per-type counts (Api/blueprints/analytics.py) -- used as the file-type facet. */
  async fileTypes() { return coreFetch('/api/analytics/file-type-distribution'); },
};

// ---------------------------------------------------------------------
// Format Browser (Api/routes/api.py `/api/formats/overview`, backed by
// database.get_format_overview_query) -- one real server-side aggregate per
// extension (count, size range, date range, processing/source/side/analyst/
// duplicate breakdowns). The Format Browser's file list itself is NOT a
// separate query: it is the existing `/api/search` with `file_type` locked
// to the selected extension (see useSearchStore.openFormat).
// ---------------------------------------------------------------------
export const formats = {
  async overview() { return coreFetch('/api/formats/overview'); },
};

// ---------------------------------------------------------------------
// File Analysis (Api/routes/file_analysis.py) -- Category / Keywords /
// Titles / Sources / Sides / Relations / Geolocation. Every list here is a
// real server-side aggregate (join through words_categorys/keywords_hashs/
// hash_contexts); `rows()` normalizes any facet's files into the exact
// shape `/api/search` returns so the caller can drop them straight into
// useSearchStore's `results`/`pagination` and reuse DataTable/ActionsMenu/
// RecordDetail/UniversalExportDialog unchanged (see useSearchStore.loadFacetRows).
// ---------------------------------------------------------------------
export const fileAnalysis = {
  async overview() { return coreFetch('/api/file-analysis/overview'); },
  async categories(params = {}) { return coreFetch(`/api/file-analysis/categories${qs(params)}`); },
  async categoryWords(categoryId, params = {}) { return coreFetch(`/api/file-analysis/categories/${categoryId}/words${qs(params)}`); },
  async categoryKeywords(categoryId, params = {}) { return coreFetch(`/api/file-analysis/categories/${categoryId}/keywords${qs(params)}`); },
  async words(params = {}) { return coreFetch(`/api/file-analysis/words${qs(params)}`); },
  async keywords(params = {}) { return coreFetch(`/api/file-analysis/keywords${qs(params)}`); },
  async titles(params = {}) { return coreFetch(`/api/file-analysis/titles${qs(params)}`); },
  async sources(params = {}) { return coreFetch(`/api/file-analysis/sources${qs(params)}`); },
  async sides(params = {}) { return coreFetch(`/api/file-analysis/sides${qs(params)}`); },
  async sourceCategories(sourceId, params = {}) { return coreFetch(`/api/file-analysis/sources/${sourceId}/categories${qs(params)}`); },
  async sourceWords(sourceId, params = {}) { return coreFetch(`/api/file-analysis/sources/${sourceId}/words${qs(params)}`); },
  async sourceKeywords(sourceId, params = {}) { return coreFetch(`/api/file-analysis/sources/${sourceId}/keywords${qs(params)}`); },
  async sideCategories(sideId, params = {}) { return coreFetch(`/api/file-analysis/sides/${sideId}/categories${qs(params)}`); },
  async sideWords(sideId, params = {}) { return coreFetch(`/api/file-analysis/sides/${sideId}/words${qs(params)}`); },
  async sideKeywords(sideId, params = {}) { return coreFetch(`/api/file-analysis/sides/${sideId}/keywords${qs(params)}`); },

  async relations(params = {}) { return coreFetch(`/api/file-analysis/relations${qs(params)}`); },
  async geoPlaces(params = {}) { return coreFetch(`/api/file-analysis/geolocation/places${qs(params)}`); },
  async geoScan({ force = false } = {}) { return coreFetch(`/api/file-analysis/geolocation/scan${qs({ force })}`, { method: 'POST' }); },
  /** Any facet's files, normalized to the /api/search result shape. */
  async rows(params = {}) { return coreFetch(`/api/file-analysis/rows${qs(params)}`); },
};

// ---------------------------------------------------------------------
// Analyst Classification (Api/routes/analyst_categories.py,
// Api/services/analyst_categories.py) -- the human-defined classification
// namespace, architecturally and functionally separate from smart/system
// categories (`/api/categories`). Every call here reads/writes ONLY
// `analyst_categories` / `analyst_file_categories` / `analyst_categorization_log`
// through the real, existing AnalystCategoryService -- this module adds no
// business logic of its own, it only serializes requests to it.
// ---------------------------------------------------------------------
export const analyst = {
  categories: {
    async list(includeCounts = true) {
      return coreFetch(`/api/analyst/categories${qs({ counts: includeCounts ? 1 : 0 })}`);
    },
    async create(name, description, color) {
      return coreFetch('/api/analyst/categories', { method: 'POST', body: { name, description, color } });
    },
    async update(id, patch) {
      return coreFetch(`/api/analyst/categories/${id}`, { method: 'PATCH', body: patch });
    },
    async remove(id) {
      return coreFetch(`/api/analyst/categories/${id}`, { method: 'DELETE' });
    },
  },
  /** Assign one analyst category (existing or newly created) to a set of files. */
  async assign({ pathIds, categoryId, categoryName, createCategory = false, sourceQuery }) {
    return coreFetch('/api/analyst/assign', {
      method: 'POST',
      body: {
        path_ids: pathIds,
        category_id: categoryId || undefined,
        category_name: categoryName || undefined,
        create_category: !!createCategory,
        source_query: sourceQuery || undefined,
      },
    });
  },
  /** Reversible removal (NFR-3) -- omit categoryIds to clear all analyst categories from the files. */
  async remove({ pathIds, categoryIds, sourceQuery }) {
    return coreFetch('/api/analyst/remove', {
      method: 'POST',
      body: { path_ids: pathIds, category_ids: categoryIds || undefined, source_query: sourceQuery || undefined },
    });
  },
  async assignments(params = {}) {
    const { categoryId, analystId, dateFrom, dateTo, q, fileQuery, fileId, page, perPage } = params;
    return coreFetch(`/api/analyst/assignments${qs({
      category_id: categoryId, analyst_id: analystId, date_from: dateFrom, date_to: dateTo,
      q, file_query: fileQuery, file_id: fileId, page, per_page: perPage,
    })}`);
  },
  async analysts() { return coreFetch('/api/analyst/analysts'); },
  async stats() { return coreFetch('/api/analyst/stats'); },
  async log(params = {}) {
    const { action, analystId, categoryId, page, perPage } = params;
    return coreFetch(`/api/analyst/log${qs({ action, analyst_id: analystId, category_id: categoryId, page, per_page: perPage })}`);
  },
  /** CSV export of the filtered Analyst Categorization View (server re-executes the same filters). */
  exportUrl(params = {}) {
    const { categoryId, analystId, dateFrom, dateTo, q } = params;
    return `/api/analyst/export${qs({ category_id: categoryId, analyst_id: analystId, date_from: dateFrom, date_to: dateTo, q })}`;
  },
};

// ---------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------

export const dashboard = {
  async stats() { return coreFetch('/api/dashboard/stats'); },
  async similarFiles(params = {}) { return coreFetch(`/api/dashboard/similar-files${qs(params)}`); },
};

// ---------------------------------------------------------------------
// Analytics (Api/blueprints/analytics.py) -- real, query-derived aggregate
// stats used to power dashboard KPIs/charts. Every number here comes from a
// GROUP BY / COUNT the server already runs; nothing is aggregated client-side.
// ---------------------------------------------------------------------

export const analytics = {
  async dashboardSummary() { return coreFetch('/api/analytics/dashboard-summary'); },
  async timeline(period = 'month') { return coreFetch(`/api/analytics/timeline-data${qs({ period })}`); },
  async categoryDistribution() { return coreFetch('/api/analytics/category-distribution'); },
  /**
   * Lightweight filename/path lookup (Api/blueprints/analytics.py) -- a
   * genuinely different, existing capability from the full-text/BM25
   * `/api/search`, used only for "jump to a file by name" in the command
   * palette. It is not a second search engine: it does no ranking,
   * relevance scoring, or content matching, only a plain ILIKE lookup the
   * server already runs.
   */
  async searchFiles(q, { type, limit = 8 } = {}) { return coreFetch(`/api/analytics/search-files${qs({ q, type, limit })}`); },
};

// ---------------------------------------------------------------------
// Individual file / document
// ---------------------------------------------------------------------

export const files = {
  async details(fileId) { return coreFetch(`/api/file/${fileId}/details`); },
  /**
   * Original (source) file access (Api/services/original_file.py,
   * Api/blueprints/files.py `/api/file/<id>/original*`) -- describes what
   * the ORIGINAL file on disk is (still readable? which viewer fits it?)
   * separately from the database-extracted `content` on details(). Always
   * returns a payload; a source file missing from disk is a normal,
   * reportable state, not an error.
   */
  async original(fileId) { return coreFetch(`/api/file/${fileId}/original`); },
  originalContentUrl(fileId, { download = false } = {}) {
    return `/api/file/${fileId}/original/content${qs({ download: download ? 1 : undefined })}`;
  },
  /**
   * Bounded, opaque-ID preview (Api/routes/preview.py + services/file_preview.py) --
   * the real, existing "look at the original object" capability. There is no
   * raw-bytes download/original-file endpoint in the backend, so this (plus
   * the full extracted text already returned by details()) is the authentic
   * read-only substitute for "open the original file".
   */
  async preview(fileId, { maxWidth = 1200, maxHeight = 800 } = {}) {
    return coreFetch(`/api/preview/${fileId}${qs({ max_width: maxWidth, max_height: maxHeight })}`);
  },
  previewImageUrl(fileId, { maxWidth = 1200, maxHeight = 800 } = {}) {
    return `/api/preview/${fileId}/image${qs({ max_width: maxWidth, max_height: maxHeight })}`;
  },

  // -------------------------------------------------------------------
  // Explicit-selection (ID-based) exports (Api/blueprints/files.py). These
  // are the four real bulk-export capabilities that operate on a bounded
  // list of `file_ids` the caller already has (a selection), as opposed to
  // the query-re-execution exports above (`search.exportResults` /
  // `exportFilenames`), which regenerate the id list server-side from a
  // query definition. Neither duplicates the other: one is "these exact
  // rows", the other is "whatever this search means right now".
  // -------------------------------------------------------------------

  /** POST /files/export - ZIP of original files or extracted text, for an explicit id list (<=500). */
  async exportBatch({ fileIds, mode = 'text', filename, namingTemplate }) {
    const res = await coreFetch('/files/export', {
      method: 'POST',
      body: { file_ids: fileIds, mode, filename, naming_template: namingTemplate || undefined },
      raw: true,
    });
    if (!res.ok) {
      let msg = 'Export failed';
      let body = null;
      try { body = await res.json(); msg = body.error || msg; } catch { /* ignore */ }
      const err = new Error(msg); err.body = body; throw err;
    }
    const result = await downloadBlobResponse(res);
    return {
      ...result,
      mode: res.headers.get('x-export-mode'),
      requested: res.headers.get('x-export-requested'),
      included: res.headers.get('x-export-included'),
      skipped: res.headers.get('x-export-skipped'),
    };
  },

  /** POST /api/files/names/export - filenames for an explicit selection, a file type, or "all". */
  async exportNames({ scope, fileIds, fileType, format = 'csv', filename }) {
    const res = await coreFetch('/api/files/names/export', {
      method: 'POST',
      body: { scope, file_ids: fileIds, file_type: fileType, format, filename },
      raw: true,
    });
    if (!res.ok) {
      let msg = 'Export failed';
      try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
      throw new Error(msg);
    }
    return downloadBlobResponse(res);
  },

  /** POST /api/files/first-pages/export - first-page text/docx batch, for an explicit id list (<=200). */
  async exportFirstPages({ fileIds, format = 'txt', filename }) {
    const res = await coreFetch('/api/files/first-pages/export', {
      method: 'POST',
      body: { file_ids: fileIds, format, filename },
      raw: true,
    });
    if (!res.ok) {
      let msg = 'Export failed';
      try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
      throw new Error(msg);
    }
    const result = await downloadBlobResponse(res);
    return { ...result, documents: res.headers.get('x-export-documents'), unavailable: res.headers.get('x-export-unavailable') };
  },

  /**
   * POST /api/files/excerpt/export - a small provenance record for one piece
   * of text the Content Viewer already has on screen (a manual selection, or
   * the context a search already matched on). Document identity is looked up
   * server-side from `file_id`; only the excerpt text itself (already visible
   * to the operator) and, for a search match, the query, come from the client.
   */
  async exportExcerpt({ fileId, kind = 'selection', text, query, format = 'txt', filename }) {
    const res = await coreFetch('/api/files/excerpt/export', {
      method: 'POST',
      body: { file_id: fileId, kind, text, query, format, filename },
      raw: true,
    });
    if (!res.ok) {
      let msg = 'Export failed';
      try { msg = (await res.json()).error || msg; } catch { /* ignore */ }
      throw new Error(msg);
    }
    return downloadBlobResponse(res);
  },

  /** POST /api/files/extract-contacts/export - email/URL extraction, for an explicit id list (<=200). */
  async exportContacts({ fileIds, format = 'csv', filename, dedupe = false }) {
    const res = await coreFetch('/api/files/extract-contacts/export', {
      method: 'POST',
      body: { file_ids: fileIds, format, filename, dedupe },
      raw: true,
    });
    if (!res.ok) {
      let msg = 'Export failed';
      let body = null;
      try { body = await res.json(); msg = body.error || msg; } catch { /* ignore */ }
      const err = new Error(msg); err.body = body; throw err;
    }
    const result = await downloadBlobResponse(res);
    return {
      ...result,
      entities: res.headers.get('x-export-entities'),
      documents: res.headers.get('x-export-documents'),
      empty: res.headers.get('x-export-empty'),
      dedupe: res.headers.get('x-export-dedupe'),
    };
  },
};

// ---------------------------------------------------------------------
// Generic browse (no query/filters): reuses the project's own cursor-based
// pagination infrastructure (Api/routes/cursor_api.py) built for exactly
// this - listing a table's rows at scale - instead of inventing a new
// "list everything" query. `/api/search` deliberately refuses to run with
// neither a query nor a filter, by design (Api/routes/search.py), so this
// is what backs the default, filter-less explorer view.
// ---------------------------------------------------------------------

export const browse = {
  async paths({ cursor, limit = 50, sortColumn = 'date_creation', sortDirection = 'DESC' } = {}) {
    return coreFetch(`/api/query/cursor${qs({
      table: 'paths', cursor, limit, sort_column: sortColumn, sort_direction: sortDirection,
    })}`);
  },
};

// ---------------------------------------------------------------------
// Geolocation (Api/routes/archives_api.py `/api/archives/geolocation`) --
// the one real, existing source of file coordinates (`paths.coordinates`).
// As of the current dataset every row is NULL, so this legitimately
// returns an empty list; the map view must show that honestly rather than
// fabricate points.
// ---------------------------------------------------------------------

export const geo = {
  async list({ cursor, limit = 100, search } = {}) {
    return coreFetch(`/api/archives/geolocation${qs({ cursor, limit, search })}`);
  },
};

export { updateCsrfFromDom };
