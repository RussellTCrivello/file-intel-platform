import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';
import { useSearchStore } from '../store/useSearchStore';

export default function Pagination() {
  const pagination = useSearchStore((s) => s.pagination);
  const perPage = useSearchStore((s) => s.perPage);
  const setPage = useSearchStore((s) => s.setPage);
  const setPerPage = useSearchStore((s) => s.setPerPage);
  const runQuery = useSearchStore((s) => s.runQuery);

  if (!pagination) return null;
  const { page, total, total_pages: totalPages, per_page: shown } = pagination;
  const startIdx = (page - 1) * shown;

  const go = (p) => { setPage(p); runQuery(); };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-surface-border bg-surface-900 px-4 py-2 text-[12px] text-slate-400">
      <span>
        Showing <strong className="text-slate-200">{total === 0 ? 0 : startIdx + 1}–{Math.min(startIdx + shown, total)}</strong> of <strong className="text-slate-200">{total.toLocaleString()}</strong> files
      </span>

      <div className="flex items-center gap-1.5">
        <span>Rows:</span>
        <select value={perPage} onChange={(e) => { setPerPage(Number(e.target.value)); runQuery(); }} className="rounded border border-surface-border bg-surface-800 px-1.5 py-1 text-[12px] text-slate-300 focus-ring">
          {[25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <nav aria-label="Result pages" className="ml-auto flex items-center gap-1">
        <button aria-label="First page" disabled={page <= 1} onClick={() => go(1)} className="rounded p-1.5 hover:bg-surface-800 disabled:opacity-30"><ChevronsLeft size={14} /></button>
        <button aria-label="Previous page" disabled={page <= 1} onClick={() => go(page - 1)} className="rounded p-1.5 hover:bg-surface-800 disabled:opacity-30"><ChevronLeft size={14} /></button>
        <span aria-current="page" className="px-2 font-medium text-slate-200">Page {page} of {totalPages}</span>
        <button aria-label="Next page" disabled={page >= totalPages} onClick={() => go(page + 1)} className="rounded p-1.5 hover:bg-surface-800 disabled:opacity-30"><ChevronRight size={14} /></button>
        <button aria-label="Last page" disabled={page >= totalPages} onClick={() => go(totalPages)} className="rounded p-1.5 hover:bg-surface-800 disabled:opacity-30"><ChevronsRight size={14} /></button>
      </nav>
    </div>
  );
}
