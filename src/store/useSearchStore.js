// The ONE store that talks to the real SYLTHARAE backend. Every "result set"
// on screen -- the explorer table, the cards view, the dashboard drilldowns,
// the search results page -- is a rendering of exactly what this store holds,
// and this store holds exactly what the server returned for the current
// query definition. Nothing in this file re-filters, re-sorts, re-ranks,
// re-paginates, or re-counts anything the server already decided; it only
// stores the server's answer and issues the next request when the operator
// changes what they're asking for.
import { create } from 'zustand';
import { auth as authApi, search as searchApi, facets as facetsApi, dashboard as dashboardApi, analytics as analyticsApi, analyst as analystApi, formats as formatsApi, fileAnalysis as fileAnalysisApi, onSessionExpired } from '../lib/sylthaeApi';
import { toast } from '../components/ui/Toast';

const DEFAULT_FILTERS = {
  fileTypes: [],
  sourceIds: [],
  sideIds: [],
  categoryIds: [],
  analystCategoryIds: [],
  dateFrom: '',
  dateTo: '',
  status: [], // [] = "not restricted" in the UI; sent to the server as both statuses explicitly
};

// The analyst-categorization scope (Api/services/analyst_categories.py) is a
// DIFFERENT axis from `analystCategoryIds` above: it filters by whether a
// file has ANY analyst category at all, independent of which one. 'all' is
// the explicit choice here (rather than omitting the param) so this app
// never silently inherits the backend's own session-persisted default
// ('uncategorized') from some earlier, unrelated request.
const DEFAULT_ANALYST_SCOPE = 'all';

const DEFAULT_OPTIONS = {
  caseSensitive: false,
  wholeWord: false,
  useFuzzy: true,
  useExpansion: true,
  useBM25: true,
  hideDuplicates: false,
};

function buildDefinition(state, extra = {}) {
  const { query, filters, options, sort, page, perPage, analystScope } = state;
  const status = filters.status.length ? filters.status : ['Read', 'Unread'];
  return {
    query,
    file_type: filters.fileTypes.length ? filters.fileTypes : undefined,
    source_ids: filters.sourceIds.length ? filters.sourceIds : undefined,
    side_ids: filters.sideIds.length ? filters.sideIds : undefined,
    category_ids: filters.categoryIds.length ? filters.categoryIds : undefined,
    analyst_category_ids: filters.analystCategoryIds.length ? filters.analystCategoryIds : undefined,
    // Independent analyst-classification scope (FR-2.x): 'uncategorized' |
    // 'categorized' | 'all'. Sent explicitly and always, see DEFAULT_ANALYST_SCOPE.
    analyst_scope: analystScope,
    date_from: filters.dateFrom || undefined,
    date_to: filters.dateTo || undefined,
    status,
    sort_by: sort.by,
    sort_order: sort.order,
    page,
    per_page: perPage,
    use_fulltext: true,
    use_advanced: true,
    use_bm25: options.useBM25,
    use_expansion: options.useExpansion,
    use_fuzzy: options.useFuzzy,
    case_sensitive: options.caseSensitive,
    whole_word: options.wholeWord,
    hide_duplicates: options.hideDuplicates,
    ...extra,
  };
}

let requestSeq = 0;

export const useSearchStore = create((set, get) => ({
  // ---------------- auth ----------------
  authStatus: 'checking', // 'checking' | 'authenticated' | 'anonymous'
  authError: null,
  mustChangePassword: false,
  currentUser: null,

  async bootstrapAuth() {
    try {
      const res = await authApi.me();
      if (res.authenticated) {
        const mustChange = !!res.user?.must_change_password;
        set({
          authStatus: 'authenticated',
          currentUser: res.user,
          mustChangePassword: mustChange,
        });
        if (!mustChange) get().afterAuthenticated();
      } else {
        set({ authStatus: 'anonymous' });
      }
    } catch {
      set({ authStatus: 'anonymous' });
    }
  },
  async login(username, password) {
    set({ authError: null });
    try {
      const res = await authApi.login(username, password);
      const mustChange = !!res.user?.must_change_password;
      set({
        authStatus: 'authenticated',
        currentUser: res.user,
        mustChangePassword: mustChange,
      });
      // The backend correctly 403s every real data endpoint while a password
      // change is pending, so don't fire the whole app-data bootstrap yet --
      // it would just be a wall of rejected requests. Data loads once the
      // gate clears (see changePassword() below).
      if (!mustChange) get().afterAuthenticated();
      return res;
    } catch (e) {
      set({ authError: e.body?.error || e.message || 'Sign-in failed' });
      throw e;
    }
  },
  async changePassword(currentPassword, newPassword) {
    await authApi.changePassword(currentPassword, newPassword);
    set({ mustChangePassword: false });
    get().afterAuthenticated();
  },
  async logout() {
    await authApi.logout();
    set({ authStatus: 'anonymous', currentUser: null, results: [], pagination: null });
  },
  afterAuthenticated() {
    get().loadFacets();
    get().loadDashboard();
    get().loadAnalytics();
    get().loadSavedSearches();
    get().loadHistory();
    // The default, filter-less "browse everything" view: sending an
    // explicit status filter (both values) makes this a valid advanced
    // query server-side even with an empty query string (Api/routes/search.py
    // `has_advanced_filters`), so this is a real query, not a client fallback.
    get().runQuery();
  },

  // ---------------- query definition (server-resolved, never recomputed) ----------------
  query: '',
  filters: { ...DEFAULT_FILTERS },
  options: { ...DEFAULT_OPTIONS },
  sort: { by: 'relevance', order: 'desc' },
  page: 1,
  perPage: 25,
  analystScope: DEFAULT_ANALYST_SCOPE,

  setQuery: (query) => set({ query }),
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch }, page: 1 })),
  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS }, analystScope: DEFAULT_ANALYST_SCOPE, page: 1 }),
  setOptions: (patch) => set((s) => ({ options: { ...s.options, ...patch }, page: 1 })),
  setSort: (sort) => set({ sort, page: 1 }),
  setPage: (page) => set({ page }),
  setPerPage: (perPage) => set({ perPage, page: 1 }),
  setAnalystScope: (analystScope) => set({ analystScope, page: 1 }),

  activeFilterCount() {
    const f = get().filters;
    return f.fileTypes.length + f.sourceIds.length + f.sideIds.length + f.categoryIds.length +
      f.analystCategoryIds.length + (f.dateFrom ? 1 : 0) + (f.dateTo ? 1 : 0) + f.status.length +
      (get().analystScope !== DEFAULT_ANALYST_SCOPE ? 1 : 0);
  },

  // ---------------- results (exactly what the server returned) ----------------
  results: [],
  pagination: null,
  resultMeta: null, // { query, filters, sort } as echoed by the server
  loading: false,
  error: null,

  async runQuery() {
    const seq = ++requestSeq;
    set({ loading: true, error: null });
    try {
      const state = get();
      const definition = buildDefinition(state);
      const data = await searchApi.run(definition);
      if (seq !== requestSeq) return; // a newer request superseded this one
      set({
        results: data.results || [],
        pagination: data.pagination || null,
        resultMeta: { query: data.query, filters: data.filters, sort: data.sort },
        loading: false,
      });
      get().loadHistory();
    } catch (e) {
      if (seq !== requestSeq) return;
      set({ loading: false, error: e.message || 'Search failed', results: [], pagination: null });
    }
  },

  // ---------------- File Analysis facet drill-down ----------------
  // Populates the SAME `results`/`pagination` state `runQuery()` does, just
  // from `/api/file-analysis/rows` instead of `/api/search` -- the rows are
  // normalized server-side into the identical shape, so DataTable, CardView,
  // ActionsMenu, RecordDetail and UniversalExportDialog all keep working
  // completely unchanged (exactly the Format Browser's reuse contract).
  facetContext: null, // { facet, id, label } describing what's currently loaded, for header/breadcrumb display
  async loadFacetRows({ facet, id, label, page = 1, perPage = 50, sourceId, sideId, place }) {
    const seq = ++requestSeq;
    set({ loading: true, error: null, facetContext: { facet, id, label } });
    try {
      const data = await fileAnalysisApi.rows({ facet, id, page, per_page: perPage, source_id: sourceId, side_id: sideId, place });
      if (seq !== requestSeq) return;
      set({ results: data.results || [], pagination: data.pagination || null, loading: false });
    } catch (e) {
      if (seq !== requestSeq) return;
      set({ loading: false, error: e.message || 'Failed to load files', results: [], pagination: null });
    }
  },
  clearFacetContext: () => set({ facetContext: null }),

  buildExportDefinition(exportScope, format, filename, extra = {}) {
    return buildDefinition(get(), { export_scope: exportScope, format, filename, ...extra });
  },
  async exportResults(exportScope, format, filename, columns) {
    return searchApi.exportResults(get().buildExportDefinition(exportScope, format, filename, columns?.length ? { columns } : {}));
  },
  async exportFilenames(exportScope, format, filename) {
    return searchApi.exportFilenames(get().buildExportDefinition(exportScope, format, filename));
  },

  // ---------------- autocomplete ----------------
  suggestions: [],
  async fetchSuggestions(q) {
    try {
      const data = await searchApi.autocomplete(q, 8);
      set({ suggestions: data.suggestions || [] });
    } catch {
      set({ suggestions: [] });
    }
  },
  clearSuggestions: () => set({ suggestions: [] }),

  // ---------------- facets (server-derived, never hardcoded) ----------------
  facetSources: [],
  facetSides: [],
  facetCategories: [],
  facetAnalystCategories: [],
  facetFileTypes: [],
  facetsLoading: false,
  async loadFacets() {
    set({ facetsLoading: true });
    try {
      const [sources, sides, categories, analystCategories, fileTypes] = await Promise.all([
        facetsApi.sources(), facetsApi.sides(), facetsApi.categories(),
        facetsApi.analystCategories(), facetsApi.fileTypes(),
      ]);
      set({
        facetSources: Array.isArray(sources) ? sources : (sources.sources || []),
        facetSides: Array.isArray(sides) ? sides : (sides.sides || []),
        facetCategories: Array.isArray(categories) ? categories : (categories.categories || []),
        facetAnalystCategories: Array.isArray(analystCategories) ? analystCategories : (analystCategories.categories || []),
        facetFileTypes: fileTypes.types || [],
        facetsLoading: false,
      });
    } catch {
      set({ facetsLoading: false });
    }
  },

  // ---------------- format browser (per-extension aggregates, §Format Browser) ----------------
  // One real server aggregate (`/api/formats/overview`) grouped by the same
  // `paths.file_type` extension already used everywhere else in the app
  // (search filter, dashboard "Files by Type" chart, file-type facet).
  // Never recomputed client-side from raw rows.
  formatOverview: null,
  formatOverviewLoading: false,
  formatOverviewError: null,
  async loadFormatOverview() {
    set({ formatOverviewLoading: true, formatOverviewError: null });
    try {
      const data = await formatsApi.overview();
      set({ formatOverview: data, formatOverviewLoading: false });
    } catch (e) {
      set({ formatOverviewLoading: false, formatOverviewError: e.message || 'Failed to load format overview' });
    }
  },

  // ---------------- dashboard (query-derived stats) ----------------
  dashboardStats: null,
  dashboardLoading: false,
  async loadDashboard() {
    set({ dashboardLoading: true });
    try {
      const stats = await dashboardApi.stats();
      set({ dashboardStats: stats, dashboardLoading: false });
    } catch {
      set({ dashboardLoading: false });
    }
  },

  // ---------------- analytics (real aggregate KPIs/charts, §29 reuse) ----------------
  analyticsSummary: null,
  timeline: null, // { labels, fileCount, processedCount } for the current `timelinePeriod`
  timelinePeriod: 'month', // 'day' | 'week' | 'month' | 'year' -- mirrors the server's own vocabulary
  categoryDistribution: null, // { labels, values }
  analyticsLoading: false,
  async loadAnalytics(period) {
    const p = period || get().timelinePeriod;
    set({ analyticsLoading: true, timelinePeriod: p });
    try {
      const [summary, timeline, categoryDist] = await Promise.all([
        analyticsApi.dashboardSummary(),
        analyticsApi.timeline(p),
        analyticsApi.categoryDistribution(),
      ]);
      set({ analyticsSummary: summary, timeline, categoryDistribution: categoryDist, analyticsLoading: false });
    } catch {
      set({ analyticsLoading: false });
    }
  },
  // `/api/dashboard/similar-files` returns two distinct real groupings:
  // exact content-hash duplicates (`hash_groups`) and merely similar-titled
  // files (`title_groups`) -- kept separate rather than merged into one
  // fabricated "duplicates" list, since they mean different things.
  hashGroups: [],
  titleGroups: [],
  duplicateTotals: null,
  duplicatesLoading: false,
  duplicatesError: null,
  async loadDuplicateGroups(params) {
    set({ duplicatesLoading: true, duplicatesError: null });
    try {
      const data = await dashboardApi.similarFiles(params);
      set({
        hashGroups: data.hash_groups || [],
        titleGroups: data.title_groups || [],
        duplicateTotals: {
          totalHashGroups: data.total_hash_groups || 0,
          totalTitleGroups: data.total_title_groups || 0,
          totalFiles: data.total_files || 0,
        },
        duplicatesLoading: false,
      });
      return data;
    } catch (e) {
      set({ duplicatesLoading: false, duplicatesError: e.message || 'Failed to load duplicate groups' });
      throw e;
    }
  },

  // ---------------- analyst classification (Api/services/analyst_categories.py) ----------------
  // Every mutation below re-fetches the analyst-category facet AND re-runs
  // the current query afterward: assigning/removing/creating/deleting a
  // category changes which files match the current analyst scope/category
  // filters, and the server already invalidates its own query cache for
  // exactly this reason (AnalystCategoryService docstrings) -- the frontend
  // must not keep serving the previous, now-stale result set (§40).
  async refreshAfterClassificationChange() {
    await get().loadFacets();
    await get().runQuery();
  },
  /** Assign one category (existing or newly created) to one or many files.
   *  Returns the server's real {requested, assigned, already_assigned,
   *  category_id, category_name} -- callers must present this verbatim,
   *  never invent their own success count (§6). */
  async classifyAssign({ pathIds, categoryId, categoryName, createCategory, sourceQuery }) {
    const data = await analystApi.assign({ pathIds, categoryId, categoryName, createCategory, sourceQuery });
    await get().refreshAfterClassificationChange();
    return data;
  },
  /** Reversible removal (NFR-3); omit categoryIds to clear all analyst categories from the files. */
  async classifyRemove({ pathIds, categoryIds, sourceQuery }) {
    const data = await analystApi.remove({ pathIds, categoryIds, sourceQuery });
    await get().refreshAfterClassificationChange();
    return data;
  },
  async createAnalystCategory(name, description, color) {
    const data = await analystApi.categories.create(name, description, color);
    await get().loadFacets();
    return data;
  },
  async updateAnalystCategory(id, patch) {
    const data = await analystApi.categories.update(id, patch);
    await get().refreshAfterClassificationChange();
    return data;
  },
  async deleteAnalystCategory(id) {
    const data = await analystApi.categories.remove(id);
    await get().refreshAfterClassificationChange();
    return data;
  },

  // Data for the dedicated Analyst Classification / Categories / History
  // workspaces (view modes 'classify' / 'categories' / 'audit') -- these are
  // NOT alternate presentations of the current search result set, so they
  // keep their own loading state rather than reusing `results`/`loading`.
  analystStats: null,
  analystStatsLoading: false,
  async loadAnalystStats() {
    set({ analystStatsLoading: true });
    try {
      const stats = await analystApi.stats();
      set({ analystStats: stats, analystStatsLoading: false });
    } catch {
      set({ analystStatsLoading: false });
    }
  },
  analystsList: [],
  async loadAnalystsList() {
    try {
      set({ analystsList: await analystApi.analysts() });
    } catch { /* non-fatal */ }
  },
  analystAssignments: [],
  analystAssignmentsTotal: 0,
  analystAssignmentsLoading: false,
  async loadAnalystAssignments(params = {}) {
    set({ analystAssignmentsLoading: true });
    try {
      const data = await analystApi.assignments(params);
      set({
        analystAssignments: data.assignments || [],
        analystAssignmentsTotal: data.total || 0,
        analystAssignmentsLoading: false,
      });
      return data;
    } catch (e) {
      set({ analystAssignmentsLoading: false });
      throw e;
    }
  },
  analystLog: [],
  analystLogTotal: 0,
  analystLogLoading: false,
  async loadAnalystLog(params = {}) {
    set({ analystLogLoading: true });
    try {
      const data = await analystApi.log(params);
      set({ analystLog: data.entries || [], analystLogTotal: data.total || 0, analystLogLoading: false });
      return data;
    } catch (e) {
      set({ analystLogLoading: false });
      throw e;
    }
  },

  // ---------------- saved searches & history (existing services, reused) ----------------
  savedSearches: [],
  async loadSavedSearches() {
    try {
      const data = await searchApi.saved.list();
      set({ savedSearches: data.searches || [] });
    } catch { /* non-fatal */ }
  },
  async saveCurrentSearch(name) {
    const state = get();
    const filtersPayload = { ...state.filters, options: state.options, sort_by: state.sort.by, sort_order: state.sort.order };
    await searchApi.saved.create(name, state.query, filtersPayload);
    await get().loadSavedSearches();
  },
  async deleteSavedSearch(id) {
    await searchApi.saved.remove(id);
    await get().loadSavedSearches();
  },
  /** Overwrite an existing saved search with whatever is currently
   *  active -- the real PUT /api/search/saved/<id> (search_service),
   *  not a client-only rename. */
  async updateSavedSearch(id) {
    const state = get();
    const filtersPayload = { ...state.filters, options: state.options, sort_by: state.sort.by, sort_order: state.sort.order };
    await searchApi.saved.update(id, { query: state.query, filters: filtersPayload });
    await get().loadSavedSearches();
  },
  async applySavedSearch(id) {
    const data = await searchApi.saved.get(id);
    const saved = data.search;
    if (!saved) return;
    const f = saved.filters || {};
    set({
      query: saved.query || '',
      filters: {
        ...DEFAULT_FILTERS,
        fileTypes: [].concat(f.file_type || []).filter(Boolean),
        sourceIds: f.source_id ? [f.source_id] : (f.source_ids || []),
        sideIds: f.side_id ? [f.side_id] : (f.side_ids || []),
        categoryIds: f.category_id ? [f.category_id] : (f.category_ids || []),
        dateFrom: f.date_from || '',
        dateTo: f.date_to || '',
        status: f.status || [],
      },
      options: { ...DEFAULT_OPTIONS, hideDuplicates: !!f.hide_duplicates },
      sort: { by: f.sort_by || 'relevance', order: f.sort_order || 'desc' },
      page: 1,
    });
    get().runQuery();
  },

  searchHistory: [],
  async loadHistory() {
    try {
      const data = await searchApi.history.list(20);
      set({ searchHistory: data.history || [] });
    } catch { /* non-fatal */ }
  },
  async clearHistory() {
    await searchApi.history.clear();
    set({ searchHistory: [] });
  },

  // ---------------- Search Network (Network Explorer -> "Searches" mode) ----------------
  // A small, session-local research workspace: the operator adds one or more
  // *named searches* (plain query strings, no separate query language) and
  // this fetches each one's COMPLETE result-id set through the exact same
  // `/api/search` contract everything else uses -- reusing `buildDefinition`
  // so a network search always carries whatever filters/analyst-scope/
  // hide-duplicates settings are currently active elsewhere in the app.
  // There is no second search engine and no server-side persistence: adding
  // or removing a network search never touches `/api/search/history` or any
  // saved-search record (see loadHistory/clearHistory above, which remain
  // fully separate). Removing a search here only forgets it from this
  // in-memory list.
  //
  // Each entry: { id, query, status: 'loading'|'ready'|'error', rows,
  //   total, totalMatches, truncated, error }
  // `rows` are the server's raw result objects (same shape `results` holds)
  // so `adaptSearchResult` can be applied by any consumer exactly like
  // every other view does; nothing here reshapes or renames server fields.
  networkSearches: [],

  addNetworkSearch(query) {
    const q = (query || '').trim();
    if (!q) return null;
    const existing = get().networkSearches.find((s) => s.query.toLowerCase() === q.toLowerCase());
    if (existing) return existing.id;
    const id = `net-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((s) => ({ networkSearches: [...s.networkSearches, { id, query: q, status: 'loading', rows: [], total: 0, totalMatches: 0, truncated: false, error: null }] }));
    get()._fetchNetworkSearch(id);
    return id;
  },

  removeNetworkSearch(id) {
    set((s) => ({ networkSearches: s.networkSearches.filter((n) => n.id !== id) }));
  },

  clearNetworkSearches() {
    set({ networkSearches: [] });
  },

  /** Re-fetch every network search against whatever filters are active now
   *  (e.g. after the operator changes source/side/analyst-scope filters
   *  elsewhere) -- an explicit action, never an implicit refetch-per-keystroke. */
  refreshAllNetworkSearches() {
    get().networkSearches.forEach((n) => get()._fetchNetworkSearch(n.id));
  },

  /** Internal: pages through `/api/search` (same endpoint, same
   *  `buildDefinition`, just a different query + page/per_page) until every
   *  matching file has been collected, or a hard safety cap is hit. The
   *  431-file demo corpus never approaches the cap; the cap exists purely
   *  so a future, much larger corpus fails safely (an honest `truncated`
   *  flag) instead of paging forever. */
  async _fetchNetworkSearch(id) {
    set((s) => ({ networkSearches: s.networkSearches.map((n) => (n.id === id ? { ...n, status: 'loading', error: null } : n)) }));
    const HARD_PAGE_CAP = 10; // 10 * 200 = 2000 rows ceiling
    const PER_PAGE = 200;
    try {
      const target = get().networkSearches.find((n) => n.id === id);
      if (!target) return;
      const baseState = get();
      let page = 1;
      let all = [];
      let total = 0;
      let truncated = false;
      for (;;) {
        const definition = buildDefinition({ ...baseState, query: target.query, page, perPage: PER_PAGE });
        const data = await searchApi.run(definition);
        all = all.concat(data.results || []);
        total = data.pagination?.total ?? all.length;
        const hasNext = !!data.pagination?.has_next;
        if (!hasNext || all.length >= total) break;
        page += 1;
        if (page > HARD_PAGE_CAP) { truncated = true; break; }
      }
      const totalMatches = all.reduce((sum, r) => sum + (r.line_match_count || 0), 0);
      set((s) => ({
        networkSearches: s.networkSearches.map((n) => (n.id === id
          ? { ...n, status: 'ready', rows: all, total, totalMatches, truncated, error: null }
          : n)),
      }));
    } catch (e) {
      set((s) => ({
        networkSearches: s.networkSearches.map((n) => (n.id === id
          ? { ...n, status: 'error', error: e.message || 'Search failed' }
          : n)),
      }));
    }
  },
}));

// A previously-valid session died mid-use (cookie expired, revoked server-
// side, etc.) -- Api response was a real 401 "unauthenticated" from
// core/security/flask_ext.py, not a login-form rejection. Drop back to the
// login screen with an honest explanation instead of leaving every open
// view stuck on a failed request.
onSessionExpired(() => {
  const s = useSearchStore.getState();
  if (s.authStatus !== 'authenticated') return; // already anonymous / mid-login
  useSearchStore.setState({
    authStatus: 'anonymous',
    currentUser: null,
    mustChangePassword: false,
    results: [],
    pagination: null,
  });
  toast('Your session expired. Please sign in again.', { type: 'warning' });
});
