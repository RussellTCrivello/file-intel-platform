import { useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { formatBytes, formatDate } from '../lib/format';
import FileTypeIcon from '../components/cells/FileTypeIcon';
import { StatusBadge, AnalystCategoryChip } from '../components/cells/Badges';
import ActionsMenu from '../components/cells/ActionsMenu';
import EmptyState from '../components/ui/EmptyState';

export default function TimelineView({ rows }) {
  const openDetail = useAppStore((s) => s.openDetail);
  const [dateField, setDateField] = useState('fileDate');
  const menuRefs = useRef({});

  const groups = useMemo(() => {
    const map = new Map();
    [...rows]
      .sort((a, b) => new Date(b[dateField]) - new Date(a[dateField]))
      .forEach((r) => {
        const d = new Date(r[dateField]);
        const key = Number.isNaN(d.getTime()) ? 'Unknown date' : d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(r);
      });
    return [...map.entries()];
  }, [rows, dateField]);

  if (rows.length === 0) return <EmptyState />;

  return (
    <div className="animate-fade-in p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Chronology based on</span>
        {[['fileDate', 'File Date'], ['creationDate', 'Creation Date']].map(([k, l]) => (
          <button key={k} onClick={() => setDateField(k)} className={`rounded-full px-2.5 py-1 text-[11.5px] font-medium ${dateField === k ? 'bg-blue-500/15 text-blue-300' : 'bg-surface-800 text-slate-400'}`}>{l}</button>
        ))}
        <span className="ml-auto text-[11px] text-slate-500">Current page only ({rows.length} files) — advance pages to see more</span>
      </div>

      <div className="relative pl-6">
        <div className="absolute bottom-0 left-[7px] top-1 w-px bg-surface-border" />
        {groups.map(([month, items]) => (
          <div key={month} className="relative mb-8">
            <div className="absolute -left-6 top-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface-900 bg-blue-500" />
            <div className="mb-3 flex items-baseline gap-2">
              <h3 className="text-[14px] font-bold text-white">{month}</h3>
              <span className="text-[11.5px] text-slate-500">{items.length} file{items.length === 1 ? '' : 's'}</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((r) => (
                <div
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openDetail(r.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.id); } }}
                  onContextMenu={(e) => menuRefs.current[r.id]?.openAtEvent(e)}
                  className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-surface-border bg-surface-850 p-3 text-left transition-colors hover:border-slate-600 focus-ring"
                >
                  <FileTypeIcon family={r.typeFamily} color={r.typeColor} size={16} className="mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-medium text-slate-200">{r.fileName}</div>
                    <div className="mt-0.5 text-[10.5px] text-slate-500">{formatDate(r[dateField], { time: true })} · {formatBytes(r.size)}</div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      <StatusBadge status={r.status} />
                      {r.analystCategoryDetails?.slice(0, 2).map((c) => (
                        <AnalystCategoryChip key={c.id} name={c.name} color={c.color} size="sm" />
                      ))}
                    </div>
                  </div>
                  <ActionsMenu ref={(el) => (menuRefs.current[r.id] = el)} record={r} onOpen={() => openDetail(r.id)} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
