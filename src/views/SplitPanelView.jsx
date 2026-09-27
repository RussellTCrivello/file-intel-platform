import { useRef } from 'react';
import clsx from 'clsx';
import { useAppStore } from '../store/useAppStore';
import { formatBytes, formatDate } from '../lib/format';
import FileTypeIcon from '../components/cells/FileTypeIcon';
import { StatusBadge } from '../components/cells/Badges';
import ActionsMenu from '../components/cells/ActionsMenu';
import RecordDetail from '../components/RecordDetail';
import { PanelRightOpen } from 'lucide-react';

export default function SplitPanelView({ rows }) {
  const activeRecordId = useAppStore((s) => s.activeRecordId);
  const setActiveRecord = useAppStore((s) => s.setActiveRecord);
  const openDetail = useAppStore((s) => s.openDetail);
  const selectedIds = useAppStore((s) => s.selectedIds);
  const toggleSelect = useAppStore((s) => s.toggleSelect);
  const menuRefs = useRef({});

  const activeId = rows.some((r) => r.id === activeRecordId) ? activeRecordId : rows[0]?.id;

  return (
    <div className="flex h-full animate-fade-in overflow-hidden">
      <div className="scrollbar-thin w-[380px] shrink-0 overflow-y-auto border-r border-surface-border">
        {rows.map((r) => {
          const isActive = activeId === r.id;
          const selected = selectedIds.includes(r.id);
          return (
            <div
              key={r.id}
              role="button"
              tabIndex={0}
              onClick={() => setActiveRecord(r.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveRecord(r.id); } }}
              onContextMenu={(e) => menuRefs.current[r.id]?.openAtEvent(e)}
              className={clsx('flex w-full cursor-pointer items-center gap-2.5 border-b border-surface-border/60 px-3.5 py-2.5 text-left transition-colors focus-ring', isActive ? 'bg-blue-500/10' : 'hover:bg-surface-800/60')}
            >
              <input type="checkbox" checked={selected} onClick={(e) => e.stopPropagation()} onChange={() => toggleSelect(r.id)} className="h-3.5 w-3.5 shrink-0 rounded border-surface-border bg-surface-800 accent-blue-500" />
              <FileTypeIcon family={r.typeFamily} color={r.typeColor} size={15} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-medium text-slate-200">{r.fileName}</div>
                <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500">
                  <span>{formatBytes(r.size)}</span> · <span>{formatDate(r.fileDate)}</span>
                </div>
              </div>
              <StatusBadge status={r.status} showLabel={false} />
              <ActionsMenu ref={(el) => (menuRefs.current[r.id] = el)} record={r} onOpen={() => openDetail(r.id)} />
            </div>
          );
        })}
        {rows.length === 0 && <div className="p-6 text-center text-[12px] text-slate-500">No records match your filters.</div>}
      </div>
      <div className="min-w-0 flex-1">
        {activeId ? (
          <RecordDetail recordId={activeId} embedded onNavigate={setActiveRecord} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
            <PanelRightOpen size={28} />
            <span className="text-[13px]">Select a file to view its intelligence report</span>
          </div>
        )}
      </div>
    </div>
  );
}
