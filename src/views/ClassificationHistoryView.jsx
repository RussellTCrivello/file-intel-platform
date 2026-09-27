import { Fragment, useEffect, useMemo, useState } from 'react';
import { History, PlusCircle, MinusCircle, FolderPlus, ChevronDown, ChevronRight, Search, Download } from 'lucide-react';
import { useSearchStore } from '../store/useSearchStore';
import { useAppStore } from '../store/useAppStore';
import { formatDate, formatRelative } from '../lib/format';
import { analyst as analystApi } from '../lib/sylthaeApi';

const PER_PAGE = 25;

// Classification Audit Trail (spec §12): surfaces `analyst_categorization_log`
// verbatim -- every assign/remove action, who performed it, which category,
// how many files, and the originating search query -- with drill-down to
// the affected file ids. Never a derived/local log; always the DB rows.
export default function ClassificationHistoryView() {
  const entries = useSearchStore((s) => s.analystLog);
  const total = useSearchStore((s) => s.analystLogTotal);
  const loading = useSearchStore((s) => s.analystLogLoading);
  const loadLog = useSearchStore((s) => s.loadAnalystLog);
  const categories = useSearchStore((s) => s.facetAnalystCategories);
  const loadFacets = useSearchStore((s) => s.loadFacets);
  const analystsList = useSearchStore((s) => s.analystsList);
  const loadAnalystsList = useSearchStore((s) => s.loadAnalystsList);
  const setQuery = useSearchStore((s) => s.setQuery);
  const setAnalystScope = useSearchStore((s) => s.setAnalystScope);
  const runQuery = useSearchStore((s) => s.runQuery);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const setAppMode = useAppStore((s) => s.setAppMode);

  const [action, setAction] = useState('');
  const [analystId, setAnalystId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { loadFacets(); loadAnalystsList(); }, [loadFacets, loadAnalystsList]);

  useEffect(() => {
    loadLog({
      action: action || undefined,
      analystId: analystId || undefined,
      categoryId: categoryId || undefined,
      page,
      perPage: PER_PAGE,
    });
  }, [action, analystId, categoryId, page, loadLog]);

  const totalPages = Math.max(Math.ceil(total / PER_PAGE), 1);

  const reRunSearch = (query) => {
    setAppMode('explorer');
    setAnalystScope('all');
    setQuery(query);
    setViewMode('table');
    runQuery();
  };

  const exportUrl = useMemo(
    () => analystApi.exportUrl({ categoryId: categoryId || undefined, analystId: analystId || undefined }),
    [categoryId, analystId]
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-surface-border p-4">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-[16px] font-bold text-white"><History size={17} className="text-blue-400" /> Classification Audit Trail</h1>
          <a href={exportUrl} download className="flex items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] text-slate-300 hover:bg-surface-800">
            <Download size={13} /> Export CSV
          </a>
        </div>
        <p className="mb-3 text-[12px] text-slate-500">Every assign/remove action recorded in analyst_categorization_log, with full traceability.</p>
        <div className="flex flex-wrap gap-2">
          <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="rounded-md border border-surface-border bg-surface-850 px-2 py-1.5 text-[12px] text-slate-300 focus-ring">
            <option value="">All actions</option>
            <option value="assign">Assign</option>
            <option value="remove">Remove</option>
            <option value="category_created">Category Created</option>
          </select>
          <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} className="rounded-md border border-surface-border bg-surface-850 px-2 py-1.5 text-[12px] text-slate-300 focus-ring">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={analystId} onChange={(e) => { setAnalystId(e.target.value); setPage(1); }} className="rounded-md border border-surface-border bg-surface-850 px-2 py-1.5 text-[12px] text-slate-300 focus-ring">
            <option value="">All analysts</option>
            {analystsList.map((a) => <option key={a.id} value={a.id}>{a.username} ({a.assignment_count})</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="py-10 text-center text-[12px] text-slate-500">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="py-10 text-center text-[12px] text-slate-500">No matching audit entries.</div>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-surface-900 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="w-6" />
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Analyst</th>
                <th className="px-3 py-2 text-left">Action</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Files</th>
                <th className="px-3 py-2 text-left">Originating Search</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/40">
              {entries.map((e) => (
                <Fragment key={e.id}>
                  <tr className="cursor-pointer hover:bg-surface-800/60" onClick={() => setExpanded(expanded === e.id ? null : e.id)}>
                    <td className="px-2 text-slate-500">{expanded === e.id ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-400" title={formatDate(e.created_at, { time: true })}>{formatRelative(e.created_at)}</td>
                    <td className="px-3 py-2 text-slate-300">{e.analyst_username || 'unknown'}</td>
                    <td className="px-3 py-2">
                      {e.action === 'assign' && (
                        <span className="flex items-center gap-1 text-emerald-400"><PlusCircle size={12} /> Assign</span>
                      )}
                      {e.action === 'remove' && (
                        <span className="flex items-center gap-1 text-amber-400"><MinusCircle size={12} /> Remove</span>
                      )}
                      {e.action === 'category_created' && (
                        <span className="flex items-center gap-1 text-blue-400"><FolderPlus size={12} /> Category Created</span>
                      )}
                      {!['assign', 'remove', 'category_created'].includes(e.action) && (
                        <span className="text-slate-400">{e.action}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-300">{e.category_name || '—'}</td>
                    <td className="px-3 py-2 text-slate-400">{e.path_count}</td>
                    <td className="max-w-xs truncate px-3 py-2 text-slate-500">
                      {e.source_query ? (
                        <button onClick={(ev) => { ev.stopPropagation(); reRunSearch(e.source_query); }} className="flex items-center gap-1 text-blue-400 hover:text-blue-300" title="Re-run this search">
                          <Search size={11} /> "{e.source_query}"
                        </button>
                      ) : '—'}
                    </td>
                  </tr>
                  {expanded === e.id && (
                    <tr className="bg-surface-850/60">
                      <td />
                      <td colSpan={6} className="px-3 py-2.5 text-[11.5px] text-slate-400">
                        <span className="font-semibold text-slate-500">Affected file ids ({e.path_ids.length}):</span>{' '}
                        <span className="font-mono">{e.path_ids.join(', ') || '—'}</span>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-surface-border px-4 py-2 text-[12px] text-slate-500">
        <span>{total.toLocaleString()} entries</span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-md border border-surface-border px-2 py-1 disabled:opacity-40">Prev</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-md border border-surface-border px-2 py-1 disabled:opacity-40">Next</button>
        </div>
      </div>
    </div>
  );
}
