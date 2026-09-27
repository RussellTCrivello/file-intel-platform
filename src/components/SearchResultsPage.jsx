import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpDown, Download, CheckSquare, Square, SquareStack, X,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useSearchStore } from '../store/useSearchStore';
import { useResults } from '../lib/derived';
import { formatBytes, formatDate } from '../lib/format';
import FileTypeIcon from './cells/FileTypeIcon';
import { TypeBadge, StatusBadge } from './cells/Badges';
import ActionsMenu from './cells/ActionsMenu';
import ReaderPane from './ReaderPane';
import UniversalExportDialog from './export/UniversalExportDialog';
import Pagination from './Pagination';
import FilterBar from './FilterBar';
import EmptyState from './ui/EmptyState';

const SORT_FIELDS = [
  ['relevance', 'Relevance'],
  ['name', 'Name'],
  ['size', 'Size'],
  ['type', 'Type'],
  ['date', 'Date'],
];

// The three analyst-categorization scopes the backend actually understands
// (Api/services/analyst_categories.py via useSearchStore.analystScope) --
// same ids/labels as AdvancedFilterPanel's segmented control, just wired to
// apply immediately (like the existing Hide Duplicates toggle below) rather
// than needing the panel's explicit "Apply". Not a second scope concept.
const ANALYST_SCOPES = [
  { id: 'uncategorized', label: 'Uncategorized' },
  { id: 'categorized', label: 'Categorized' },
  { id: 'all', label: 'All Files' },
];

// The dedicated "Search Results | Document Viewer" split view (Layer 4).
// Every row here is exactly what `/api/search` returned for the committed
// query/filters/sort/page held in `useSearchStore` -- sort, duplicate
// visibility and pagination all re-run the real server query; nothing is
// recomputed over the page already on screen.
export default function SearchResultsPage() {
  const query = useSearchStore((s) => s.query);
  const pagination = useSearchStore((s) => s.pagination);
  const sort = useSearchStore((s) => s.sort);
  const setSort = useSearchStore((s) => s.setSort);
  const options = useSearchStore((s) => s.options);
  const setOptions = useSearchStore((s) => s.setOptions);
  const runQuery = useSearchStore((s) => s.runQuery);
  const analystScope = useSearchStore((s) => s.analystScope);
  const setAnalystScope = useSearchStore((s) => s.setAnalystScope);
  const activeFilterCount = useSearchStore((s) => s.activeFilterCount());

  const setAppMode = useAppStore((s) => s.setAppMode);
  const readerActiveId = useAppStore((s) => s.readerActiveId);
  const setReaderActiveId = useAppStore((s) => s.setReaderActiveId);
  const selectedIds = useAppStore((s) => s.selectedIds);
  const toggleSelect = useAppStore((s) => s.toggleSelect);
  const selectMany = useAppStore((s) => s.selectMany);
  const clearSelection = useAppStore((s) => s.clearSelection);

  const [exportOpen, setExportOpen] = useState(false);
  const [selectionExportOpen, setSelectionExportOpen] = useState(false);
  const rows = useResults();
  const menuRefs = useRef({});
  const openDetail = useAppStore((s) => s.openDetail);

  const activeRow = useMemo(() => rows.find((r) => r.id === readerActiveId) || rows[0] || null, [rows, readerActiveId]);

  useEffect(() => {
    if (!readerActiveId && rows.length > 0) setReaderActiveId(rows[0].id);
  }, [rows, readerActiveId, setReaderActiveId]);

  const allSelectedOnPage = rows.length > 0 && rows.every((r) => selectedIds.includes(r.id));

  // This workspace stays reachable and usable even before a text query is
  // typed: a filter-only search (Api/routes/search.py `has_advanced_filters`)
  // is a real, valid `/api/search` request, so an operator who arrived here
  // via the header's "Search Workspace" entry point (rather than by pressing
  // Enter on a text query) can start from Filters/Scope alone. Only the
  // true "nothing has ever been asked for yet" state gets the full-page
  // prompt; the moment there's a query, a filter, or an already-fetched
  // page of results, the persistent split view (list + FilterBar + reader)
  // takes over.
  const hasAnyQueryContext = !!(query && query.trim()) || activeFilterCount > 0 || !!pagination;

  if (!hasAnyQueryContext) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-surface-border px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-white">Search &amp; Investigation Workspace</h2>
            <button onClick={() => setAppMode('explorer')} title="Back to explorer" className="rounded-md p-1.5 text-slate-400 hover:bg-surface-800 hover:text-white">
              <X size={15} />
            </button>
          </div>
        </div>
        <FilterBar />
        <div className="flex flex-1 items-center justify-center">
          <EmptyState title="No search query" hint="Type a search term in the top bar, or open Filters below, to see persistent results here." />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="flex w-[420px] shrink-0 flex-col border-r border-surface-border">
        <div className="border-b border-surface-border px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-white">
              {(pagination?.total ?? rows.length).toLocaleString()} result{pagination?.total === 1 ? '' : 's'}
              {query && query.trim() ? <> for <span className="text-blue-400">“{query}”</span></> : null}
            </h2>
            <button onClick={() => setAppMode('explorer')} title="Back to explorer" className="rounded-md p-1.5 text-slate-400 hover:bg-surface-800 hover:text-white">
              <X size={15} />
            </button>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => { setOptions({ hideDuplicates: !options.hideDuplicates }); runQuery(); }}
              className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium ${options.hideDuplicates ? 'border-blue-500 bg-blue-500/10 text-blue-300' : 'border-surface-border text-slate-400'}`}
              title="Hide documents that share an identical content hash (server-side)"
            >
              <SquareStack size={11} /> Hide duplicates
            </button>

            <div className="ml-auto flex items-center gap-1">
              <ArrowUpDown size={11} className="text-slate-500" />
              <select
                value={sort.by}
                onChange={(e) => { setSort({ by: e.target.value, order: sort.order }); runQuery(); }}
                className="rounded-md border border-surface-border bg-surface-800 px-1.5 py-1 text-[11px] text-slate-300 focus-ring"
              >
                {SORT_FIELDS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
              <button
                onClick={() => { setSort({ by: sort.by, order: sort.order === 'asc' ? 'desc' : 'asc' }); runQuery(); }}
                className="rounded-md border border-surface-border bg-surface-800 px-1.5 py-1 text-[11px] text-slate-400 hover:text-white"
              >
                {sort.order === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center rounded-md border border-surface-border bg-surface-900 p-0.5 text-[11px]">
            {ANALYST_SCOPES.map((s) => (
              <button
                key={s.id}
                onClick={() => { setAnalystScope(s.id); runQuery(); }}
                className={`flex-1 rounded px-2 py-1 font-medium transition-colors ${analystScope === s.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                title="Analyst-categorization scope (server-side, independent of smart categories)"
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button onClick={() => (allSelectedOnPage ? clearSelection() : selectMany(rows.map((r) => r.id)))} className="flex items-center gap-1 rounded-md border border-surface-border px-2 py-1 text-[11px] text-slate-400 hover:text-white">
              {allSelectedOnPage ? <CheckSquare size={11} /> : <Square size={11} />} {allSelectedOnPage ? 'Deselect page' : 'Select page'}
            </button>
            <button onClick={() => setExportOpen(true)} className="flex items-center gap-1 rounded-md border border-surface-border px-2 py-1 text-[11px] text-slate-400 hover:text-white">
              <Download size={11} /> Export results
            </button>
            {selectedIds.length > 0 && (
              <button onClick={() => setSelectionExportOpen(true)} className="flex items-center gap-1 rounded-md border border-blue-500/50 bg-blue-500/10 px-2 py-1 text-[11px] text-blue-300 hover:text-blue-200">
                <Download size={11} /> Export selected ({selectedIds.length})
              </button>
            )}
          </div>
        </div>

        <FilterBar />

        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {rows.length === 0 && (
            <div className="p-6">
              <EmptyState title="No matches" hint="Try a different keyword or adjust your advanced filters/search options." />
            </div>
          )}
          {rows.map((r) => {
            const active = activeRow?.id === r.id;
            const selected = selectedIds.includes(r.id);
            return (
              <div
                key={r.id}
                onClick={() => setReaderActiveId(r.id)}
                onContextMenu={(e) => menuRefs.current[r.id]?.openAtEvent(e)}
                className={`cursor-pointer border-b border-surface-border/60 px-4 py-3 transition-colors ${active ? 'bg-blue-500/10' : 'hover:bg-surface-800/60'}`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={selected}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleSelect(r.id)}
                    className="mt-1 h-3.5 w-3.5 shrink-0 rounded border-surface-border bg-surface-800 accent-blue-500"
                  />
                  <FileTypeIcon family={r.typeFamily} color={r.typeColor} size={15} className="mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`truncate text-[12.5px] font-medium ${active ? 'text-blue-300' : 'text-slate-200'}`}>{r.fileName}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-[10.5px] text-slate-500">
                      <TypeBadge type={r.type} color={r.typeColor} />
                      <StatusBadge status={r.status} showLabel={false} />
                      <span>{formatBytes(r.size)}</span>
                      <span>·</span>
                      <span>{formatDate(r.fileDate)}</span>
                      {r.lineMatchCount > 0 && <span className="rounded bg-amber-500/15 px-1 py-0.5 text-amber-300">{r.lineMatchCount} hit{r.lineMatchCount === 1 ? '' : 's'}</span>}
                    </div>
                    {r.snippetHtml ? (
                      <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-snug text-slate-400 [&_mark]:rounded [&_mark]:bg-amber-400/80 [&_mark]:px-0.5 [&_mark]:text-surface-950" dangerouslySetInnerHTML={{ __html: r.snippetHtml }} />
                    ) : r.snippet ? (
                      <p className="mt-1.5 line-clamp-2 text-[11.5px] leading-snug text-slate-400">{r.snippet}</p>
                    ) : null}
                  </div>
                  <ActionsMenu ref={(el) => (menuRefs.current[r.id] = el)} record={r} onOpen={() => openDetail(r.id)} />
                </div>
              </div>
            );
          })}
        </div>

        <Pagination />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <ReaderPane recordId={activeRow?.id} matchInfo={activeRow} />
      </div>

      {exportOpen && <UniversalExportDialog mode="query" onClose={() => setExportOpen(false)} />}
      {selectionExportOpen && (
        <UniversalExportDialog mode="selection" fileIds={selectedIds} onClose={() => setSelectionExportOpen(false)} />
      )}
    </div>
  );
}
