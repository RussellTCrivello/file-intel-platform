import { useRef } from 'react';
import clsx from 'clsx';
import { useAppStore } from '../store/useAppStore';
import { formatBytes, formatDate, truncateMiddle } from '../lib/format';
import FileTypeIcon from '../components/cells/FileTypeIcon';
import { StatusBadge, AnalystCategoryChip } from '../components/cells/Badges';
import ActionsMenu from '../components/cells/ActionsMenu';
import EmptyState from '../components/ui/EmptyState';

export default function CompactListView({ rows }) {
  const selectedIds = useAppStore((s) => s.selectedIds);
  const toggleSelect = useAppStore((s) => s.toggleSelect);
  const openDetail = useAppStore((s) => s.openDetail);
  const menuRefs = useRef({});

  if (rows.length === 0) return <EmptyState />;

  return (
    <div className="animate-fade-in divide-y divide-surface-border/60 p-2">
      {rows.map((r) => {
        const selected = selectedIds.includes(r.id);
        return (
          <div
            key={r.id}
            onClick={() => toggleSelect(r.id)}
            onDoubleClick={() => openDetail(r.id)}
            onContextMenu={(e) => menuRefs.current[r.id]?.openAtEvent(e)}
            className={clsx('flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-1.5 text-[12.5px]', selected ? 'bg-blue-500/10' : 'hover:bg-surface-800/60')}
          >
            <input type="checkbox" checked={selected} onChange={() => toggleSelect(r.id)} onClick={(e) => e.stopPropagation()} className="h-3 w-3 shrink-0 rounded border-surface-border bg-surface-800 accent-blue-500" />
            <FileTypeIcon family={r.typeFamily} color={r.typeColor} size={13} className="shrink-0" />
            <span className="w-64 shrink-0 truncate font-medium text-slate-200">{truncateMiddle(r.fileName, 40)}</span>
            <span className="w-36 shrink-0 truncate text-slate-500">{r.source || '—'}</span>
            <span className="w-24 shrink-0 font-mono text-slate-400">{formatBytes(r.size)}</span>
            <span className="w-28 shrink-0 text-slate-500">{formatDate(r.fileDate)}</span>
            <span className="shrink-0"><StatusBadge status={r.status} showLabel={false} /></span>
            {r.analystCategoryDetails?.length > 0 && (
              <span
                className="flex shrink-0 items-center gap-1 rounded-md border-l-[3px] bg-surface-800/80 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-300"
                style={{ borderLeftColor: r.analystCategoryDetails[0].color || '#3b82f6' }}
                title={r.analystCategoryDetails.map((c) => c.name).join(', ')}
              >
                {r.analystCategoryDetails[0].name}
                {r.analystCategoryDetails.length > 1 && <span className="text-slate-500">+{r.analystCategoryDetails.length - 1}</span>}
              </span>
            )}
            <span className="ml-auto shrink-0 truncate text-[10.5px] text-slate-600">{r.relevance ? `score ${r.relevance.toFixed(2)}` : ''}</span>
            <ActionsMenu ref={(el) => (menuRefs.current[r.id] = el)} record={r} onOpen={() => openDetail(r.id)} />
          </div>
        );
      })}
    </div>
  );
}
