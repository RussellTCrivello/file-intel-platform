// Pure UI-navigation state. Everything that used to live here and actually
// described "what data is being asked for" (search text, filters, sorts,
// page/pageSize, saved views, recent searches, group-by) has moved to
// `useSearchStore`, which is the only thing that talks to the server and
// the only source of truth for query state. What's left here is legitimate
// client-only presentation state: which view/tab is showing, which rows are
// selected on screen, which panel is open, column layout preferences, and a
// personal (never persisted server-side) bookmark/compare scratch list.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_VISIBLE_COLUMNS, DEFAULT_COLUMN_ORDER } from '../lib/columns';

export const useAppStore = create()(
  persist(
    (set) => ({
      // ----- top-level navigation -----
      appMode: 'explorer', // 'explorer' (browse/filter) | 'results' (query results + reader)
      viewMode: 'dashboard', // which presentation of the current result set is showing
      density: 'comfortable',
      preferences: { theme: 'porcelain', fontScale: 'standard', density: 'comfortable', language: 'en', dateFormat: 'locale', timeFormat: '24h', numberFormat: 'locale', timezone: 'local', pageSize: 50, reducedMotion: false, highContrast: false, showAnimations: true, confirmActions: true },
      sidebarOpen: true,
      expandedCategories: { Document: true, Image: true },
      commandPaletteOpen: false,

      // ----- selection / detail / reader -----
      selectedIds: [],
      activeRecordId: null,
      detailOpen: false,
      readerActiveId: null,
      recentlyViewed: [],

      // ----- column layout (table view) -----
      visibleColumns: DEFAULT_VISIBLE_COLUMNS,
      columnOrder: DEFAULT_COLUMN_ORDER,
      columnWidths: {},
      pinnedColumns: { left: ['select', 'fileName'], right: ['actions'] },

      // ----- comparison workspace (client-side scratch list of ids) -----
      // `compareMeta` is a tiny id -> {fileName, typeFamily, typeColor} cache
      // populated straight from whichever real, already-fetched record the
      // user clicked "Add to compare" on (search result row or file detail)
      // -- it exists only so the floating tray can render a chip without
      // re-fetching or guessing at data for ids that may belong to a page
      // that's no longer loaded. It is never a fabricated/synthetic dataset.
      compareIds: [],
      compareMeta: {},
      compareOpen: false,

      // ----- personal, session-local bookmarking. A workspace convenience
      // layered on top of the read-only dataset; it never mutates a record
      // server-side, it only tracks which ids the user flagged for review. -----
      bookmarkedIds: [],

      // A one-shot deep-link request into the (already-existing) Duplicates
      // workspace: "show me the hash/title group this specific file belongs
      // to", set by a per-record context action and consumed/cleared by
      // DuplicatesView on mount. It never computes a group itself -- it only
      // tells the existing view which already-loaded group to focus.
      duplicatesFocus: null, // { fileId, tab: 'hash' | 'title' } | null

      // Which format (extension) the Format Browser is currently drilled
      // into, or null for the top-level Format Overview grid. Purely
      // client-side navigation state -- the actual file list for a format
      // is just the existing `/api/search` with `file_type` locked to this
      // value (see FormatBrowserView / useSearchStore.filters.fileTypes).
      formatBrowserExtension: null,
      fileAnalysisSection: null, // which of the 7 File Analysis tiles is open (null = hub)

      // The single, shared Full Document Viewer (req #6/#18: one viewer, no
      // per-dimension reimplementations). `origin` is free-form breadcrumb
      // context (e.g. { section: 'categoryWords', category: 'aircraft',
      // word: 'aircraft' } or { section: 'search' }) purely so the modal's
      // header/back-link can say where the user came from -- it is never
      // used to refetch or reshape data, just displayed.
      fullDocument: null, // { fileId, fileName, term, wholeWord, caseSensitive, origin } | null

      // ================= actions =================
      setAppMode: (appMode) => set({ appMode }),
      setViewMode: (viewMode) => set({ viewMode }),
      setDensity: (density) => set({ density }),
      updatePreferences: (patch) => set((s) => ({ preferences: { ...s.preferences, ...patch } })),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleCategoryExpanded: (key) => set((s) => ({ expandedCategories: { ...s.expandedCategories, [key]: !s.expandedCategories[key] } })),
      setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),

      toggleSelect: (id) => set((s) => ({
        selectedIds: s.selectedIds.includes(id) ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id],
      })),
      selectMany: (ids) => set({ selectedIds: ids }),
      clearSelection: () => set({ selectedIds: [] }),

      setActiveRecord: (id) => set((s) => ({
        activeRecordId: id,
        recentlyViewed: [id, ...s.recentlyViewed.filter((x) => x !== id)].slice(0, 12),
      })),
      openDetail: (id) => set((s) => ({
        activeRecordId: id,
        detailOpen: true,
        recentlyViewed: [id, ...s.recentlyViewed.filter((x) => x !== id)].slice(0, 12),
      })),
      closeDetail: () => set({ detailOpen: false }),
      setReaderActiveId: (readerActiveId) => set({ readerActiveId }),

      setVisibleColumns: (visibleColumns) => set({ visibleColumns }),
      toggleColumn: (key) => set((s) => ({
        visibleColumns: s.visibleColumns.includes(key)
          ? s.visibleColumns.filter((k) => k !== key)
          : [...s.visibleColumns, key],
      })),
      setColumnOrder: (columnOrder) => set({ columnOrder }),
      setColumnWidth: (key, width) => set((s) => ({ columnWidths: { ...s.columnWidths, [key]: width } })),
      resetColumns: () => set({ visibleColumns: DEFAULT_VISIBLE_COLUMNS, columnOrder: DEFAULT_COLUMN_ORDER, columnWidths: {} }),
      togglePin: (key, side) => set((s) => {
        const left = s.pinnedColumns.left.filter((k) => k !== key);
        const right = s.pinnedColumns.right.filter((k) => k !== key);
        if (side === 'left') left.push(key);
        if (side === 'right') right.push(key);
        return { pinnedColumns: { left, right } };
      }),

      addToCompare: (record) => set((s) => {
        const id = record?.id ?? record;
        if (s.compareIds.includes(id)) return s;
        const meta = (record && typeof record === 'object')
          ? { fileName: record.fileName, typeFamily: record.typeFamily, typeColor: record.typeColor }
          : s.compareMeta[id];
        return {
          compareIds: [...s.compareIds, id].slice(-4),
          compareMeta: meta ? { ...s.compareMeta, [id]: meta } : s.compareMeta,
        };
      }),
      removeFromCompare: (id) => set((s) => ({ compareIds: s.compareIds.filter((x) => x !== id) })),
      clearCompare: () => set({ compareIds: [], compareOpen: false }),
      setCompareIds: (ids, metaList) => set((s) => ({
        compareIds: ids.slice(0, 4),
        compareMeta: metaList ? { ...s.compareMeta, ...Object.fromEntries(metaList.map((r) => [r.id, { fileName: r.fileName, typeFamily: r.typeFamily, typeColor: r.typeColor }])) } : s.compareMeta,
      })),
      setCompareOpen: (compareOpen) => set({ compareOpen }),

      toggleBookmark: (id) => set((s) => ({
        bookmarkedIds: s.bookmarkedIds.includes(id) ? s.bookmarkedIds.filter((x) => x !== id) : [...s.bookmarkedIds, id],
      })),
      addBookmarks: (ids) => set((s) => ({ bookmarkedIds: [...new Set([...s.bookmarkedIds, ...ids])] })),

      requestDuplicatesFocus: (fileId, tab = 'hash') => set({ appMode: 'explorer', viewMode: 'duplicates', duplicatesFocus: { fileId, tab } }),
      clearDuplicatesFocus: () => set({ duplicatesFocus: null }),

      setFormatBrowserExtension: (formatBrowserExtension) => set({ formatBrowserExtension }),
      setFileAnalysisSection: (fileAnalysisSection) => set({ fileAnalysisSection }),

      openFullDocument: (opts) => set((s) => ({
        fullDocument: {
          fileId: opts.fileId,
          fileName: opts.fileName ?? null,
          term: opts.term ?? '',
          wholeWord: !!opts.wholeWord,
          caseSensitive: !!opts.caseSensitive,
          origin: opts.origin ?? null,
          // The ordered list of file ids from whichever table row this was
          // opened from (DataTable -> ActionsMenu), plus how many the
          // *unpaginated* result set actually has (search/facet pagination
          // total). Together these drive the header's real "N of M" counter
          // and Prev/Next -- carried over from the previous open() when the
          // Prev/Next buttons themselves call openFullDocument() again, so
          // stepping through files never loses the list you started from.
          resultIds: opts.resultIds ?? s.fullDocument?.resultIds ?? null,
          resultTotal: opts.resultTotal ?? s.fullDocument?.resultTotal ?? null,
        },
      })),
      closeFullDocument: () => set({ fullDocument: null }),
    }),
    {
      name: 'file-intel-platform-ui-store',
      partialize: (s) => ({
        density: s.density,
        preferences: s.preferences,
        visibleColumns: s.visibleColumns,
        columnOrder: s.columnOrder,
        columnWidths: s.columnWidths,
        pinnedColumns: s.pinnedColumns,
        viewMode: s.viewMode,
        sidebarOpen: s.sidebarOpen,
        expandedCategories: s.expandedCategories,
        bookmarkedIds: s.bookmarkedIds,
      }),
    }
  )
);
