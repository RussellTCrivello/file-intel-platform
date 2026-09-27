import { useMemo, useRef } from 'react';
import { STATUS_DEFS } from '../lib/domain';
import { useAppStore } from '../store/useAppStore';
import { formatBytes, formatDate } from '../lib/format';
import FileTypeIcon from '../components/cells/FileTypeIcon';
import { SideBadge } from '../components/cells/Badges';
import ActionsMenu from '../components/cells/ActionsMenu';

// Read-only status board: columns group the CURRENT PAGE of retrieved
// records by their real `file_status` value (Read/Unread). No
// drag-and-drop, no fabricated workflow states -- this presents existing
// data, it never edits it.
export default function KanbanView({ rows }) {
  const openDetail = useAppStore((s) => s.openDetail);
  const menuRefs = useRef({});

  const columns = useMemo(() => {
    const map = {};
    STATUS_DEFS.forEach((s) => { map[s.id] = []; });
    rows.forEach((r) => { (map[r.status] ||= []).push(r); });
    return map;
  }, [rows]);

  return (
    <div className="scrollbar-thin flex h-full animate-fade-in gap-3 overflow-x-auto p-4">
      {STATUS_DEFS.map((status) => (
        <div key={status.id} className="flex w-72 shrink-0 flex-col rounded-xl border border-surface-border bg-surface-850/70">
          <div className="flex items-center gap-2 border-b border-surface-border px-3.5 py-2.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: status.color }} />
            <span className="text-[12.5px] font-semibold text-slate-200">{status.label}</span>
            <span className="ml-auto rounded-full bg-surface-800 px-1.5 py-0.5 text-[10.5px] text-slate-400">{columns[status.id]?.length || 0}</span>
          </div>
          <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto p-2.5">
            {(columns[status.id] || []).map((r) => (
              <div
                key={r.id}
                role="button"
                tabIndex={0}
                onClick={() => openDetail(r.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.id); } }}
                onContextMenu={(e) => menuRefs.current[r.id]?.openAtEvent(e)}
                className="w-full cursor-pointer rounded-lg border border-surface-border bg-surface-900 p-2.5 text-left shadow-sm transition-colors hover:border-slate-600 focus-ring"
              >
                <div className="mb-1.5 flex items-center gap-1.5">
                  <FileTypeIcon family={r.typeFamily} color={r.typeColor} size={13} />
                  <span className="truncate text-[12px] font-medium text-slate-200">{r.fileName}</span>
                </div>
                <div className="mb-1.5 flex items-center justify-between text-[10.5px] text-slate-500">
                  <span>{formatBytes(r.size)}</span>
                  <span>{formatDate(r.fileDate)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <SideBadge side={r.side} />
                  <ActionsMenu ref={(el) => (menuRefs.current[r.id] = el)} record={r} onOpen={() => openDetail(r.id)} />
                </div>
              </div>
            ))}
            {columns[status.id]?.length === 0 && <div className="py-6 text-center text-[11px] text-slate-600">No files on this page</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
