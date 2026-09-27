import { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, Search, X } from 'lucide-react';
import { useSearchStore } from '../../store/useSearchStore';
import { useAppStore } from '../../store/useAppStore';
import { formatBytes, formatDate } from '../../lib/format';
import { typeFamilyOf, typeColorOf, typeLabelOf } from '../../lib/domain';
import FileTypeIcon from '../cells/FileTypeIcon';
import FilterBar from '../FilterBar';
import ContextualStatsBar from '../ContextualStatsBar';
import DataTable from '../table/DataTable';

function Pill({ label, value, tone = 'default' }) {
  const tones = {
    default: 'bg-surface-800 text-slate-300',
    success: 'bg-emerald-500/15 text-emerald-300',
    warning: 'bg-amber-500/15 text-amber-300',
    danger: 'bg-red-500/15 text-red-300',
  };
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ${tones[tone]}`}>
      {label}: <strong>{value}</strong>
    </span>
  );
}

// The Format Browser's file list is NOT a second table or a second search
// implementation: `rows` is exactly what `/api/search` (via useSearchStore)
// returned with `filters.fileTypes` locked to this format, and every piece
// below (FilterBar, ContextualStatsBar, DataTable + its embedded
// ActionsMenu, Pagination in the parent) is the identical component the
// Table view uses. Only the header strip (real per-format aggregate from
// `/api/formats/overview`) and the "back to formats" affordance are new.
export default function FormatDetail({ extension, rows }) {
  const formatOverview = useSearchStore((s) => s.formatOverview);
  const loadFormatOverview = useSearchStore((s) => s.loadFormatOverview);
  const loading = useSearchStore((s) => s.loading);
  const error = useSearchStore((s) => s.error);
  const query = useSearchStore((s) => s.query);
  const setQuery = useSearchStore((s) => s.setQuery);
  const runQuery = useSearchStore((s) => s.runQuery);
  const setFormatBrowserExtension = useAppStore((s) => s.setFormatBrowserExtension);
  const [searchDraft, setSearchDraft] = useState(query);

  useEffect(() => { if (!formatOverview) loadFormatOverview(); }, [formatOverview, loadFormatOverview]);
  useEffect(() => { setSearchDraft(query); }, [query]);

  const label0 = typeLabelOf(extension);
  // Runs the exact same `/api/search` the rest of the app uses (same
  // full-text/BM25/expansion/fuzzy semantics, same filters, same pagination)
  // -- the ONLY thing this does differently from the global TopBar search is
  // that it does NOT flip `appMode` to the separate full-page Search
  // Results screen, so the operator stays inside the Format Browser and its
  // format-locked filter/header stay intact (§11/§12 "Search Result
  // Continuity").
  const submitSearch = (e) => {
    e.preventDefault();
    setQuery(searchDraft);
    runQuery();
  };

  const entry = formatOverview?.formats?.find((f) => f.extension === extension);
  const family = typeFamilyOf(extension);
  const color = typeColorOf(extension);
  const label = typeLabelOf(extension);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-surface-border bg-surface-900 px-4 py-3">
        <button
          onClick={() => setFormatBrowserExtension(null)}
          className="flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-800 px-2.5 py-1.5 text-[12px] font-medium text-slate-400 hover:text-slate-200 focus-ring"
        >
          <ArrowLeft size={13} /> All Formats
        </button>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}18` }}>
          <FileTypeIcon family={family} color={color} size={16} />
        </span>
        <div>
          <div className="text-[14px] font-bold text-white">{label} <span className="font-normal text-slate-500">({family})</span></div>
          {entry && (entry.earliest_date || entry.latest_date) && (
            <div className="text-[11px] text-slate-500">{formatDate(entry.earliest_date)} – {formatDate(entry.latest_date)}</div>
          )}
        </div>

        {entry ? (
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Pill label="Files" value={entry.count.toLocaleString()} />
            <Pill label="Size" value={formatBytes(entry.total_size)} />
            <Pill label="Avg" value={formatBytes(entry.avg_size)} />
            <Pill label="Processed" value={entry.processed} tone="success" />
            {entry.pending > 0 && <Pill label="Pending" value={entry.pending} tone="warning" />}
            {entry.failed > 0 && <Pill label="Failed" value={entry.failed} tone="danger" />}
            <Pill label="Sources" value={entry.source_count} />
            <Pill label="Sides" value={entry.side_count} />
            <Pill label="Categorized" value={entry.categorized_count} />
            <Pill label="Duplicates" value={entry.duplicate_count} />
          </div>
        ) : (
          <span className="ml-auto flex items-center gap-1.5 text-[11.5px] text-slate-500"><Loader2 size={12} className="animate-spin" /> Loading stats…</span>
        )}
      </div>

      <form onSubmit={submitSearch} className="flex items-center gap-2 border-b border-surface-border bg-surface-900/60 px-4 py-2">
        <div className="relative flex-1 max-w-md">
          <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder={`Search within ${label0}…`}
            className="w-full rounded-md border border-surface-border bg-surface-800 py-1.5 pl-7 pr-7 text-[12.5px] text-slate-200 placeholder:text-slate-500 focus:border-blue-500/60 focus-ring"
          />
          {searchDraft && (
            <button
              type="button"
              onClick={() => { setSearchDraft(''); setQuery(''); runQuery(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400"
            >
              <X size={12} />
            </button>
          )}
        </div>
        <button type="submit" className="rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-500">Search</button>
      </form>

      <FilterBar />
      <ContextualStatsBar data={rows} />

      <main className="relative min-h-0 flex-1 overflow-hidden">
        {error && (
          <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-[12px] text-red-300">{error}</div>
        )}
        <DataTable rows={rows} />
        {loading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface-950/40">
            <Loader2 size={22} className="animate-spin text-blue-400" />
          </div>
        )}
      </main>
    </div>
  );
}
