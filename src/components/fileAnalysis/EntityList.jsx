import { Loader2, Search, ChevronRight, ChevronLeft } from 'lucide-react';

// Generic paginated, searchable list of "things you can click into" --
// categories, keywords, titles, sources, sides, relations, places. Every
// list this renders is real server data (see each Browser's loader); this
// component only lays it out.
export default function EntityList({
  items, loading, error, search, onSearchChange, searchPlaceholder,
  pagination, onPageChange, renderItem, emptyTitle, emptyHint,
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {onSearchChange && (
        <div className="border-b border-surface-border px-4 py-2.5">
          <div className="relative max-w-sm">
            <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-surface-border bg-surface-800 py-1.5 pl-7 pr-3 text-[12.5px] text-slate-200 placeholder:text-slate-500 focus:border-blue-500/60 focus-ring"
            />
          </div>
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-y-auto scrollbar-thin px-4 py-3">
        {error && <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">{error}</div>}

        {!loading && items.length === 0 && !error && (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-slate-500">
            <span className="text-[13.5px] font-medium text-slate-400">{emptyTitle || 'Nothing here yet'}</span>
            {emptyHint && <p className="max-w-md text-[12px] leading-relaxed text-slate-500">{emptyHint}</p>}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(renderItem)}
        </div>

        {loading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface-950/40">
            <Loader2 size={20} className="animate-spin text-blue-400" />
          </div>
        )}
      </div>

      {pagination && pagination.total_pages > 1 && (
        <div className="flex shrink-0 items-center justify-between border-t border-surface-border bg-surface-900 px-4 py-2 text-[12px] text-slate-400">
          <span>{pagination.total.toLocaleString()} total</span>
          <div className="flex items-center gap-1">
            <button disabled={!pagination.has_prev} onClick={() => onPageChange(pagination.page - 1)} className="rounded p-1.5 hover:bg-surface-800 disabled:opacity-30"><ChevronLeft size={14} /></button>
            <span className="px-2 font-medium text-slate-200">Page {pagination.page} of {pagination.total_pages}</span>
            <button disabled={!pagination.has_next} onClick={() => onPageChange(pagination.page + 1)} className="rounded p-1.5 hover:bg-surface-800 disabled:opacity-30"><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

export function EntityCard({ title, subtitle, stats, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col gap-1.5 rounded-lg border border-surface-border bg-surface-900 p-3 text-left transition-colors hover:border-blue-500/50 hover:bg-surface-850 focus-ring"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-semibold text-slate-100" title={title}>{title}</span>
        <ChevronRight size={14} className="shrink-0 text-slate-600" />
      </div>
      {subtitle && <div className="truncate text-[11px] text-slate-500">{subtitle}</div>}
      {stats && stats.length > 0 && (
        <div className="mt-0.5 flex flex-wrap gap-1.5">
          {stats.map((s, i) => (
            <span key={i} className="rounded-full bg-surface-800 px-2 py-0.5 text-[10.5px] font-medium text-slate-300">
              {s.label}: <strong className="text-slate-100">{s.value}</strong>
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
