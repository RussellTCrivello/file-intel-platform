import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';

// Same visual contract as the global Pagination component, but decoupled
// from useSearchStore.runQuery(): File Analysis file lists are populated by
// useSearchStore.loadFacetRows(), so paging here re-issues THAT call
// (via onPageChange) instead of re-running the main /api/search query.
export default function FacetPagination({ pagination, perPage, onPageChange, onPerPageChange }) {
  if (!pagination) return null;
  const { page, total, total_pages: totalPages, per_page: shown } = pagination;
  const startIdx = (page - 1) * shown;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-surface-border bg-surface-900 px-4 py-2 text-[12px] text-slate-400">
      <span>
        Showing <strong className="text-slate-200">{total === 0 ? 0 : startIdx + 1}–{Math.min(startIdx + shown, total)}</strong> of <strong className="text-slate-200">{total.toLocaleString()}</strong> files
      </span>

      <div className="flex items-center gap-1.5">
        <span>Rows:</span>
        <select value={perPage} onChange={(e) => onPerPageChange(Number(e.target.value))} className="rounded border border-surface-border bg-surface-800 px-1.5 py-1 text-[12px] text-slate-300 focus-ring">
          {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <nav aria-label="Result pages" className="ml-auto flex items-center gap-1">
        <button aria-label="First page" disabled={page <= 1} onClick={() => onPageChange(1)} className="rounded p-1.5 hover:bg-surface-800 disabled:opacity-30"><ChevronsLeft size={14} /></button>
        <button aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="rounded p-1.5 hover:bg-surface-800 disabled:opacity-30"><ChevronLeft size={14} /></button>
        <span aria-current="page" className="px-2 font-medium text-slate-200">Page {page} of {totalPages}</span>
        <button aria-label="Next page" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="rounded p-1.5 hover:bg-surface-800 disabled:opacity-30"><ChevronRight size={14} /></button>
        <button aria-label="Last page" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)} className="rounded p-1.5 hover:bg-surface-800 disabled:opacity-30"><ChevronsRight size={14} /></button>
      </nav>
    </div>
  );
}
