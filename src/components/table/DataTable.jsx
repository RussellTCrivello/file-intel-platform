import { useMemo, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowUp, ArrowDown, ChevronsUpDown } from 'lucide-react';
import clsx from 'clsx';
import { useAppStore } from '../../store/useAppStore';
import { useSearchStore } from '../../store/useSearchStore';
import { COLUMN_DEFS, COLUMN_TO_SORT_FIELD } from '../../lib/columns';
import { formatBytes, formatDate } from '../../lib/format';
import FileNameCell from '../cells/FileNameCell';
import { TypeBadge, StatusBadge, SideBadge, AnalystCategoryChip } from '../cells/Badges';
import PathCell from '../cells/PathCell';
import HashCell from '../cells/HashCell';
import ActionsMenu from '../cells/ActionsMenu';
import { useVisibleHashIndex } from '../../lib/derived';
import EmptyState from '../ui/EmptyState';

const DENSITY_ROW_H = { compact: 34, comfortable: 46, expanded: 64 };

export default function DataTable({ rows, onInspect }) {
  const density = useAppStore((s) => s.density);
  const visibleColumns = useAppStore((s) => s.visibleColumns);
  const columnOrder = useAppStore((s) => s.columnOrder);
  const columnWidths = useAppStore((s) => s.columnWidths);
  const setColumnWidth = useAppStore((s) => s.setColumnWidth);
  const pinnedColumns = useAppStore((s) => s.pinnedColumns);
  const selectedIds = useAppStore((s) => s.selectedIds);
  const toggleSelect = useAppStore((s) => s.toggleSelect);
  const selectMany = useAppStore((s) => s.selectMany);
  const openDetail = useAppStore((s) => s.openDetail);

  const sort = useSearchStore((s) => s.sort);
  const setSort = useSearchStore((s) => s.setSort);
  const runQuery = useSearchStore((s) => s.runQuery);
  const pagination = useSearchStore((s) => s.pagination);

  const hashIndex = useVisibleHashIndex(rows);
  const menuRefs = useRef({});

  // The ordered ids of the rows actually on screen -- passed through to the
  // Full Document Viewer (req #10) so its header shows a real "File N of M"
  // counter with working Prev/Next *within this exact list*, instead of the
  // legacy reader's own page-agnostic global counter. `resultTotal` (the
  // unpaginated count from this same search/facet request) is carried too so
  // the counter can honestly say "row 7 of 50 shown (380 total)" rather than
  // implying these 50 are everything.
  const resultIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const resultTotal = pagination?.total ?? null;

  const cols = useMemo(
    () => columnOrder.map((k) => COLUMN_DEFS.find((c) => c.key === k)).filter((c) => c && (visibleColumns.includes(c.key) || c.alwaysVisible)),
    [columnOrder, visibleColumns]
  );

  const getWidth = (key) => columnWidths[key] || COLUMN_DEFS.find((c) => c.key === key)?.defaultWidth || 140;

  const leftOffsets = {};
  let acc = 0;
  cols.forEach((c) => {
    if (pinnedColumns.left.includes(c.key)) { leftOffsets[c.key] = acc; acc += getWidth(c.key); }
  });
  const rightOffsets = {};
  let accR = 0;
  [...cols].reverse().forEach((c) => {
    if (pinnedColumns.right.includes(c.key)) { rightOffsets[c.key] = accR; accR += getWidth(c.key); }
  });

  const rowHeight = DENSITY_ROW_H[density];
  const parentRef = useRef(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });

  const allChecked = rows.length > 0 && rows.every((r) => selectedIds.includes(r.id));
  const someChecked = rows.some((r) => selectedIds.includes(r.id)) && !allChecked;

  const toggleAll = () => {
    if (allChecked) selectMany(selectedIds.filter((id) => !rows.some((r) => r.id === id)));
    else selectMany([...new Set([...selectedIds, ...rows.map((r) => r.id)])]);
  };

  const resizeStart = useCallback((e, key) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = getWidth(key);
    const onMove = (ev) => setColumnWidth(key, Math.max(60, startWidth + (ev.clientX - startX)));
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [columnWidths]);

  // Real server sort vocabulary only (Api/routes/search.py sort_by in
  // {relevance, date, name, type, size}) — columns without a mapping simply
  // are not sortable, rather than faking a client-side sort over one page.
  const clickSort = (col) => {
    const field = COLUMN_TO_SORT_FIELD[col.key];
    if (!field) return;
    const nextOrder = sort.by === field && sort.order === 'desc' ? 'asc' : 'desc';
    setSort({ by: field, order: nextOrder });
    runQuery();
  };

  const renderCell = (col, record) => {
    switch (col.key) {
      case 'select':
        return (
          <input
            type="checkbox"
            checked={selectedIds.includes(record.id)}
            onChange={() => toggleSelect(record.id)}
            onClick={(e) => e.stopPropagation()}
            className="h-3.5 w-3.5 rounded border-surface-border bg-surface-800 accent-blue-500"
          />
        );
      case 'fileName':
        return <FileNameCell record={record} onOpen={() => openDetail(record.id)} compact={density === 'compact'} />;
      case 'type':
        return <TypeBadge type={record.type} color={record.typeColor} />;
      case 'size':
        return <span className="font-mono text-[12.5px] text-slate-300">{formatBytes(record.size)}</span>;
      case 'source':
        return <div className="truncate text-[12.5px] font-medium text-slate-200">{record.source || '—'}</div>;
      case 'side':
        return <SideBadge side={record.side} />;
      case 'status':
        return <StatusBadge status={record.status} size={density === 'compact' ? 'sm' : 'md'} />;
      case 'analystCategories':
        return record.analystCategoryDetails?.length ? (
          <div className="flex flex-wrap gap-1">
            {record.analystCategoryDetails.map((c) => <AnalystCategoryChip key={c.id} name={c.name} color={c.color} />)}
          </div>
        ) : <span className="text-[11px] text-slate-600">Uncategorized</span>;
      case 'relevance':
        return record.relevance ? <span className="font-mono text-[11.5px] text-slate-400">{record.relevance.toFixed(2)}</span> : <span className="text-slate-600">—</span>;
      case 'matchedIn':
        return record.matchedIn?.length ? (
          <div className="flex flex-wrap gap-1">
            {record.matchedIn.map((f) => <span key={f} className="rounded bg-surface-800 px-1.5 py-0.5 text-[10px] text-slate-400">{f}</span>)}
          </div>
        ) : <span className="text-slate-600">—</span>;
      case 'path':
        return <PathCell path={record.path} onInspect={() => onInspect?.(record)} />;
      case 'fileDate':
        return <span className="text-[12.5px] text-slate-300">{formatDate(record.fileDate, { time: density === 'expanded' })}</span>;
      case 'creationDate':
        return <span className="text-[12.5px] text-slate-400">{formatDate(record.creationDate, { time: density === 'expanded' })}</span>;
      case 'hash':
        return <HashCell hash={record.hash} duplicateCount={record.hash ? hashIndex.get(record.hash)?.length || 0 : 0} />;
      case 'actions':
        return (
          <ActionsMenu
            ref={(el) => (menuRefs.current[record.id] = el)}
            record={record}
            onOpen={() => openDetail(record.id)}
            resultIds={resultIds}
            resultTotal={resultTotal}
          />
        );
      default:
        return record[col.key];
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div ref={parentRef} className="scrollbar-thin flex-1 overflow-auto" role="grid" aria-rowcount={rows.length}>
        <div style={{ minWidth: cols.reduce((s, c) => s + getWidth(c.key), 0) }}>
          <div className="sticky top-0 z-20 flex border-b border-surface-border bg-surface-850/95 backdrop-blur" role="row">
            {cols.map((col) => {
              const field = COLUMN_TO_SORT_FIELD[col.key];
              const isSorted = field && sort.by === field;
              const pinnedLeft = pinnedColumns.left.includes(col.key);
              const pinnedRight = pinnedColumns.right.includes(col.key);
              return (
                <div
                  key={col.key}
                  role="columnheader"
                  style={{ width: getWidth(col.key), left: pinnedLeft ? leftOffsets[col.key] : undefined, right: pinnedRight ? rightOffsets[col.key] : undefined }}
                  className={clsx(
                    'group relative flex shrink-0 items-center gap-1 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400',
                    (pinnedLeft || pinnedRight) && 'sticky z-10 bg-surface-850'
                  )}
                >
                  {col.key === 'select' ? (
                    <input type="checkbox" checked={allChecked} ref={(el) => el && (el.indeterminate = someChecked)} onChange={toggleAll} className="h-3.5 w-3.5 rounded border-surface-border bg-surface-800 accent-blue-500" />
                  ) : !field ? (
                    <span>{col.label}</span>
                  ) : (
                    <button onClick={() => clickSort(col)} className="flex items-center gap-1 hover:text-slate-100 focus-ring rounded" title="Click to sort (server-side)">
                      {col.label}
                      {isSorted ? (
                        <span className="text-blue-400">{sort.order === 'desc' ? <ArrowDown size={11} /> : <ArrowUp size={11} />}</span>
                      ) : (
                        <ChevronsUpDown size={11} className="opacity-0 group-hover:opacity-60" />
                      )}
                    </button>
                  )}
                  {col.key !== 'actions' && (
                    <span onMouseDown={(e) => resizeStart(e, col.key)} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-500/50" />
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((vRow) => {
              const record = rows[vRow.index];
              if (!record) return null;
              const selected = selectedIds.includes(record.id);
              return (
                <div
                  key={record.id}
                  style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${vRow.start}px)`, height: vRow.size }}
                  onClick={() => toggleSelect(record.id)}
                  onDoubleClick={() => openDetail(record.id)}
                  onContextMenu={(e) => menuRefs.current[record.id]?.openAtEvent(e)}
                  role="row"
                  aria-selected={selected}
                  className={clsx('flex cursor-pointer border-b border-surface-border/70 transition-colors', selected ? 'bg-blue-500/10' : 'hover:bg-surface-800/60')}
                >
                  {cols.map((col) => {
                    const pinnedLeft = pinnedColumns.left.includes(col.key);
                    const pinnedRight = pinnedColumns.right.includes(col.key);
                    return (
                      <div
                        key={col.key}
                        style={{ width: getWidth(col.key), left: pinnedLeft ? leftOffsets[col.key] : undefined, right: pinnedRight ? rightOffsets[col.key] : undefined }}
                        className={clsx('flex shrink-0 items-center overflow-hidden px-3', (pinnedLeft || pinnedRight) && (selected ? 'sticky z-10 bg-[#101a2e]' : 'sticky z-10 bg-surface-900'))}
                      >
                        {renderCell(col, record)}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          {rows.length === 0 && <EmptyState />}
        </div>
      </div>
    </div>
  );
}
