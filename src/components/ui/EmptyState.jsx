import { FolderSearch, X } from 'lucide-react';
import { useSearchStore } from '../../store/useSearchStore';

export default function EmptyState({ title = 'No files match your criteria', hint = 'Try adjusting or clearing your filters.' }) {
  const query = useSearchStore((s) => s.query);
  const activeFilterCount = useSearchStore((s) => s.activeFilterCount());
  const resetFilters = useSearchStore((s) => s.resetFilters);
  const setQuery = useSearchStore((s) => s.setQuery);
  const runQuery = useSearchStore((s) => s.runQuery);

  const hasActive = activeFilterCount > 0 || !!query;

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-800 text-slate-500">
        <FolderSearch size={22} />
      </span>
      <div>
        <div className="text-[13.5px] font-semibold text-slate-200">{title}</div>
        <div className="text-[12px] text-slate-500">{hint}</div>
      </div>

      {hasActive && (
        <div className="mt-1 flex max-w-md flex-wrap items-center justify-center gap-1.5">
          {query && (
            <span className="flex items-center gap-1 rounded-full border border-surface-border bg-surface-800 px-2.5 py-1 text-[11px] text-slate-400">
              Search: "{query}"
              <button onClick={() => { setQuery(''); runQuery(); }} className="text-slate-500 hover:text-red-400"><X size={10} /></button>
            </span>
          )}
          {activeFilterCount > 0 && (
            <span className="flex items-center gap-1 rounded-full border border-surface-border bg-surface-800 px-2.5 py-1 text-[11px] text-slate-400">
              {activeFilterCount} filter{activeFilterCount === 1 ? '' : 's'} applied
            </span>
          )}
        </div>
      )}

      {hasActive && (
        <button
          onClick={() => { resetFilters(); setQuery(''); runQuery(); }}
          className="mt-1 rounded-md bg-blue-600 px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-500"
        >
          Clear search & filters
        </button>
      )}
    </div>
  );
}
