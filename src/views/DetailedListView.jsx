import { useRef } from 'react';
import clsx from 'clsx';
import { useAppStore } from '../store/useAppStore';
import { formatBytes, formatDate } from '../lib/format';
import FileTypeIcon from '../components/cells/FileTypeIcon';
import { StatusBadge, SideBadge, TypeBadge, AnalystCategoryChip } from '../components/cells/Badges';
import ActionsMenu from '../components/cells/ActionsMenu';
import EmptyState from '../components/ui/EmptyState';

export default function DetailedListView({ rows }) {
  const selectedIds = useAppStore((s) => s.selectedIds);
  const toggleSelect = useAppStore((s) => s.toggleSelect);
  const openDetail = useAppStore((s) => s.openDetail);
  const menuRefs = useRef({});

  if (rows.length === 0) return <EmptyState />;

  return (
    <div className="animate-fade-in space-y-2 p-4">
      {rows.map((r) => {
        const selected = selectedIds.includes(r.id);
        return (
          <div
            key={r.id}
            onClick={() => toggleSelect(r.id)}
            onDoubleClick={() => openDetail(r.id)}
            onContextMenu={(e) => menuRefs.current[r.id]?.openAtEvent(e)}
            className={clsx(
              'flex cursor-pointer items-start gap-4 rounded-lg border bg-surface-850 p-3.5 transition-colors',
              selected ? 'border-blue-500 bg-blue-500/5' : 'border-surface-border hover:border-slate-600'
            )}
          >
            <input type="checkbox" checked={selected} onChange={() => toggleSelect(r.id)} onClick={(e) => e.stopPropagation()} className="mt-1 h-3.5 w-3.5 shrink-0 rounded border-surface-border bg-surface-800 accent-blue-500" />
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-800 ring-1 ring-inset ring-surface-border">
              <FileTypeIcon family={r.typeFamily} color={r.typeColor} size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-[13.5px] font-semibold text-slate-100">{r.fileName}</span>
                <TypeBadge type={r.type} color={r.typeColor} />
                <StatusBadge status={r.status} />
                <SideBadge side={r.side} />
              </div>
              {r.analystCategoryDetails?.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {r.analystCategoryDetails.map((c) => (
                    <AnalystCategoryChip key={c.id} name={c.name} color={c.color} size="sm" />
                  ))}
                </div>
              )}
              {r.path && <div className="mt-1 truncate font-mono text-[11px] text-slate-500">{r.path}</div>}
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-slate-400">
                <span><span className="text-slate-600">Source:</span> {r.source || '—'}</span>
                <span><span className="text-slate-600">Size:</span> {formatBytes(r.size)}</span>
                <span><span className="text-slate-600">File Date:</span> {formatDate(r.fileDate)}</span>
                <span><span className="text-slate-600">Created:</span> {formatDate(r.creationDate)}</span>
                {r.relevance > 0 && <span><span className="text-slate-600">Relevance:</span> {r.relevance.toFixed(2)}</span>}
              </div>
              {r.snippetHtml ? (
                <p className="mt-2 line-clamp-2 text-[11.5px] leading-snug text-slate-400 [&_mark]:rounded [&_mark]:bg-amber-400/80 [&_mark]:px-0.5 [&_mark]:text-surface-950" dangerouslySetInnerHTML={{ __html: r.snippetHtml }} />
              ) : r.snippet ? (
                <p className="mt-2 line-clamp-2 text-[11.5px] leading-snug text-slate-400">{r.snippet}</p>
              ) : null}
            </div>
            <div className="mt-0.5 shrink-0">
              <ActionsMenu ref={(el) => (menuRefs.current[r.id] = el)} record={r} onOpen={() => openDetail(r.id)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
