import { useEffect, useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts';
import { Loader2, RefreshCw, Files, HardDrive, AlertCircle } from 'lucide-react';
import { useSearchStore } from '../../store/useSearchStore';
import { useAppStore } from '../../store/useAppStore';
import { formatBytes, formatDate } from '../../lib/format';
import { typeFamilyOf, typeColorOf, typeLabelOf } from '../../lib/domain';
import FileTypeIcon from '../cells/FileTypeIcon';

const tooltipStyle = { background: '#131926', border: '1px solid #232c3d', borderRadius: 8, fontSize: 12, color: '#e2e8f0' };

function OverviewStat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-surface-border bg-surface-850 p-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">
        <Icon size={16} />
      </span>
      <div>
        <div className="text-xl font-bold text-white">{value}</div>
        <div className="text-[11px] text-slate-500">{label}</div>
      </div>
    </div>
  );
}

function FormatCard({ entry, totalCount, onOpen }) {
  const family = typeFamilyOf(entry.extension);
  const color = typeColorOf(entry.extension);
  const label = typeLabelOf(entry.extension);
  const pct = totalCount > 0 ? ((entry.count / totalCount) * 100) : 0;
  const hasFailures = entry.failed > 0;
  const hasPending = entry.pending > 0;

  return (
    <button
      onClick={() => onOpen(entry.extension)}
      className="flex flex-col gap-3 rounded-xl border border-surface-border bg-surface-850 p-4 text-left shadow-panel transition-colors hover:border-blue-500/50 hover:bg-surface-800 focus-ring"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}18` }}>
            <FileTypeIcon family={family} color={color} size={18} />
          </span>
          <div>
            <div className="text-[13.5px] font-bold text-white">{label}</div>
            <div className="text-[11px] text-slate-500">{family}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-white">{entry.count.toLocaleString()}</div>
          <div className="text-[10.5px] text-slate-500">{pct.toFixed(1)}% of corpus</div>
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-700">
        <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }} />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-400">
        <span>Size: <strong className="text-slate-200">{formatBytes(entry.total_size)}</strong></span>
        <span>Avg: <strong className="text-slate-200">{formatBytes(entry.avg_size)}</strong></span>
        <span>Sources: <strong className="text-slate-200">{entry.source_count}</strong></span>
        <span>Sides: <strong className="text-slate-200">{entry.side_count}</strong></span>
        <span>Categorized: <strong className="text-slate-200">{entry.categorized_count}</strong></span>
        <span>Duplicates: <strong className="text-slate-200">{entry.duplicate_count}</strong></span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-surface-border pt-2 text-[10.5px]">
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-300">{entry.processed} processed</span>
        {hasPending && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-300">{entry.pending} pending</span>}
        {hasFailures && <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-semibold text-red-300">{entry.failed} failed</span>}
        {entry.unsupported > 0 && <span className="rounded-full bg-slate-500/15 px-2 py-0.5 font-semibold text-slate-300">{entry.unsupported} unsupported</span>}
      </div>

      {(entry.earliest_date || entry.latest_date) && (
        <div className="text-[10.5px] text-slate-500">
          {formatDate(entry.earliest_date)} – {formatDate(entry.latest_date)}
        </div>
      )}
    </button>
  );
}

// Top-level Format Browser workspace: real per-extension counts/sizes/
// processing state read from `/api/formats/overview` (database.get_format_overview_query,
// the same paths/hash_contexts/hashs tables and duplicate/categorization
// definitions used everywhere else). No fabricated formats, no client-side
// aggregation of raw rows -- every number here is the server's own answer.
export default function FormatOverview() {
  const formatOverview = useSearchStore((s) => s.formatOverview);
  const loading = useSearchStore((s) => s.formatOverviewLoading);
  const error = useSearchStore((s) => s.formatOverviewError);
  const loadFormatOverview = useSearchStore((s) => s.loadFormatOverview);
  const setFilters = useSearchStore((s) => s.setFilters);
  const resetFilters = useSearchStore((s) => s.resetFilters);
  const runQuery = useSearchStore((s) => s.runQuery);
  const setFormatBrowserExtension = useAppStore((s) => s.setFormatBrowserExtension);

  useEffect(() => { if (!formatOverview) loadFormatOverview(); }, [formatOverview, loadFormatOverview]);

  const formats = formatOverview?.formats || [];
  const totals = formatOverview?.totals || { count: 0, total_size: 0 };

  const chartData = useMemo(
    () => formats.map((f) => ({ name: typeLabelOf(f.extension), count: f.count, size: f.total_size, color: typeColorOf(f.extension) })),
    [formats]
  );

  const openFormat = (extension) => {
    resetFilters();
    setFilters({ fileTypes: [extension] });
    runQuery();
    setFormatBrowserExtension(extension);
  };

  if (loading && !formatOverview) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-slate-500">
        <Loader2 size={18} className="animate-spin" /> Loading formats…
      </div>
    );
  }

  if (error && !formatOverview) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <AlertCircle size={22} className="text-red-400" />
        <div className="text-[13px] text-slate-300">{error}</div>
        <button onClick={loadFormatOverview} className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-500">
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  if (formats.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[13px] text-slate-500">
        No file formats are currently available.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-bold text-white">Format Browser</h1>
          <p className="text-[12px] text-slate-500">Explore the corpus by file format — every count read live from the database.</p>
        </div>
        <button onClick={loadFormatOverview} className="flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-800 px-2.5 py-1.5 text-[12px] text-slate-400 hover:text-slate-200">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <OverviewStat icon={Files} label="Total Files" value={totals.count.toLocaleString()} />
        <OverviewStat icon={HardDrive} label="Total Size" value={formatBytes(totals.total_size)} />
        <OverviewStat icon={Files} label="Formats" value={formats.length} />
        <OverviewStat icon={AlertCircle} label="With Failures" value={formats.filter((f) => f.failed > 0).length} />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-surface-border bg-surface-850 p-4">
          <h3 className="mb-2 text-[12.5px] font-semibold text-slate-200">File Count by Format</h3>
          <ResponsiveContainer width="100%" height={Math.max(160, formats.length * 32)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={70} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => v.toLocaleString()} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface-850 p-4">
          <h3 className="mb-2 text-[12.5px] font-semibold text-slate-200">Storage by Format</h3>
          <ResponsiveContainer width="100%" height={Math.max(160, formats.length * 32)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => formatBytes(v)} />
              <YAxis type="category" dataKey="name" width={70} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatBytes(v)} />
              <Bar dataKey="size" radius={[0, 4, 4, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <h2 className="mb-3 text-[13px] font-semibold text-slate-200">All Formats</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {formats.map((entry) => (
          <FormatCard key={entry.extension} entry={entry} totalCount={totals.count} onOpen={openFormat} />
        ))}
      </div>
    </div>
  );
}
