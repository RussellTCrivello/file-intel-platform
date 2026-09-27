import { useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { formatBytes, formatDate } from '../lib/format';
import FileTypeIcon from '../components/cells/FileTypeIcon';
import { TypeBadge, StatusBadge, SideBadge, AnalystCategoryChip } from '../components/cells/Badges';
import ActionsMenu from '../components/cells/ActionsMenu';
import EmptyState from '../components/ui/EmptyState';
import clsx from 'clsx';

export default function CardView({ rows }) {
  const selectedIds = useAppStore((s) => s.selectedIds);
  const toggleSelect = useAppStore((s) => s.toggleSelect);
  const openDetail = useAppStore((s) => s.openDetail);
  const density = useAppStore((s) => s.density);
  const menuRefs = useRef({});

  if (rows.length === 0) return <EmptyState />;

  return (
    <div className={clsx('grid animate-fade-in gap-4 p-5', density === 'compact' ? 'grid-cols-[repeat(auto-fill,minmax(220px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(280px,1fr))]')}>
      {rows.map((r) => {
        const selected = selectedIds.includes(r.id);
        return (
          <div
            key={r.id}
            onClick={() => toggleSelect(r.id)}
            onDoubleClick={() => openDetail(r.id)}
            onContextMenu={(e) => menuRefs.current[r.id]?.openAtEvent(e)}
            className={clsx(
              'group flex cursor-pointer flex-col gap-3 rounded-xl border bg-surface-850 p-4 shadow-panel transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30',
              selected ? 'border-blue-500 ring-1 ring-blue-500/40' : 'border-surface-border hover:border-slate-600'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-800 ring-1 ring-inset ring-surface-border">
                  <FileTypeIcon family={r.typeFamily} color={r.typeColor} size={19} />
                </span>
                <div className="min-w-0">
                  <span className="truncate text-[13px] font-semibold text-slate-100" title={r.fileName}>{r.fileName}</span>
                  <div className="text-[10.5px] text-slate-500">{r.source || '—'}</div>
                </div>
              </div>
              <input type="checkbox" checked={selected} onChange={() => toggleSelect(r.id)} onClick={(e) => e.stopPropagation()} className="h-3.5 w-3.5 rounded border-surface-border bg-surface-800 accent-blue-500" />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <TypeBadge type={r.type} color={r.typeColor} />
              <StatusBadge status={r.status} />
              <SideBadge side={r.side} />
            </div>

            {r.analystCategoryDetails?.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                {r.analystCategoryDetails.map((c) => <AnalystCategoryChip key={c.id} name={c.name} color={c.color} />)}
              </div>
            )}

            <div className="grid grid-cols-2 gap-y-1.5 text-[11.5px] text-slate-400">
              <span className="text-slate-500">Size</span>
              <span className="text-right font-mono text-slate-300">{formatBytes(r.size)}</span>
              <span className="text-slate-500">File Date</span>
              <span className="text-right text-slate-300">{formatDate(r.fileDate)}</span>
              {r.relevance > 0 && (
                <>
                  <span className="text-slate-500">Relevance</span>
                  <span className="text-right font-mono text-slate-300">{r.relevance.toFixed(2)}</span>
                </>
              )}
            </div>

            {r.snippetHtml ? (
              <p className="line-clamp-2 rounded-md bg-surface-900/60 px-2 py-1.5 text-[11px] leading-snug text-slate-400 [&_mark]:rounded [&_mark]:bg-amber-400/80 [&_mark]:px-0.5 [&_mark]:text-surface-950" dangerouslySetInnerHTML={{ __html: r.snippetHtml }} />
            ) : r.snippet ? (
              <p className="line-clamp-2 rounded-md bg-surface-900/60 px-2 py-1.5 text-[11px] leading-snug text-slate-400">{r.snippet}</p>
            ) : null}

            <div className="flex items-center justify-between border-t border-surface-border pt-2.5">
              <span className="truncate font-mono text-[10.5px] text-slate-600">{r.matchedIn?.length ? r.matchedIn.join(', ') : ''}</span>
              <ActionsMenu ref={(el) => (menuRefs.current[r.id] = el)} record={r} onOpen={() => openDetail(r.id)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
