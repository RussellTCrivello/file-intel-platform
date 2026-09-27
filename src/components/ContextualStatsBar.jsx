import { useMemo } from 'react';
import { Files, HardDrive, CalendarRange } from 'lucide-react';
import { formatBytes, formatDate } from '../lib/format';

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <Icon size={12} className="text-slate-500" />
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-200">{value}</span>
    </div>
  );
}

// A lightweight summary of the rows currently on screen (one page, at most a
// couple hundred records) -- not a full-dataset aggregation. The
// authoritative totals live in the dashboard (server-computed stats).
export default function ContextualStatsBar({ data }) {
  const stats = useMemo(() => {
    if (data.length === 0) return null;
    const totalSize = data.reduce((s, r) => s + (r.size || 0), 0);
    const dates = data.map((r) => new Date(r.fileDate).getTime()).filter((t) => !Number.isNaN(t));
    if (dates.length === 0) return { totalSize, avg: totalSize / data.length };
    const earliest = new Date(Math.min(...dates));
    const latest = new Date(Math.max(...dates));
    return { totalSize, earliest, latest, avg: totalSize / data.length };
  }, [data]);

  if (!stats) return null;

  return (
    <div className="scrollbar-thin flex items-center gap-5 overflow-x-auto border-b border-surface-border bg-surface-900/40 px-4 py-1.5 text-[11.5px]">
      <Stat icon={Files} label="This page" value={data.length.toLocaleString()} />
      <Stat icon={HardDrive} label="Total" value={formatBytes(stats.totalSize)} />
      <Stat icon={HardDrive} label="Avg" value={formatBytes(stats.avg)} />
      {stats.earliest && <Stat icon={CalendarRange} label="Range" value={`${formatDate(stats.earliest)} → ${formatDate(stats.latest)}`} />}
    </div>
  );
}
