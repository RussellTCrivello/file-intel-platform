import { useState } from 'react';
import { Columns3, GripVertical, RotateCcw, Pin } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { COLUMN_DEFS } from '../../lib/columns';
import DropdownMenu, { MenuLabel, MenuSeparator } from '../ui/DropdownMenu';

export default function ColumnManager() {
  const visibleColumns = useAppStore((s) => s.visibleColumns);
  const toggleColumn = useAppStore((s) => s.toggleColumn);
  const columnOrder = useAppStore((s) => s.columnOrder);
  const setColumnOrder = useAppStore((s) => s.setColumnOrder);
  const resetColumns = useAppStore((s) => s.resetColumns);
  const pinnedColumns = useAppStore((s) => s.pinnedColumns);
  const togglePin = useAppStore((s) => s.togglePin);
  const [dragKey, setDragKey] = useState(null);

  const orderedCols = columnOrder
    .map((key) => COLUMN_DEFS.find((c) => c.key === key))
    .filter((c) => c && !c.alwaysVisible);

  const onDrop = (targetKey) => {
    if (!dragKey || dragKey === targetKey) return;
    const newOrder = [...columnOrder];
    const from = newOrder.indexOf(dragKey);
    const to = newOrder.indexOf(targetKey);
    newOrder.splice(from, 1);
    newOrder.splice(to, 0, dragKey);
    setColumnOrder(newOrder);
    setDragKey(null);
  };

  return (
    <DropdownMenu
      width={260}
      trigger={
        <button className="flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-800 px-2 py-1 text-[12px] text-slate-400 hover:text-slate-200">
          <Columns3 size={13} /> Columns
        </button>
      }
    >
      <MenuLabel>Manage Columns · Drag to reorder</MenuLabel>
      <div className="max-h-72 overflow-y-auto">
        {orderedCols.map((col) => {
          const pinned = pinnedColumns.left.includes(col.key) ? 'left' : pinnedColumns.right.includes(col.key) ? 'right' : null;
          return (
            <div
              key={col.key}
              draggable
              onDragStart={(e) => { setDragKey(col.key); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', col.key); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(col.key)}
              className="flex items-center gap-2 px-3 py-1.5 text-[12.5px] text-slate-300 hover:bg-surface-700"
            >
              <GripVertical size={13} className="shrink-0 cursor-grab text-slate-600" />
              <input
                type="checkbox"
                checked={visibleColumns.includes(col.key)}
                onChange={() => toggleColumn(col.key)}
                className="h-3.5 w-3.5 shrink-0 rounded border-surface-border bg-surface-800 accent-blue-500"
              />
              <span className="flex-1 truncate">{col.label}</span>
              <button
                title="Pin left"
                onClick={() => togglePin(col.key, pinned === 'left' ? null : 'left')}
                className={`rounded p-0.5 ${pinned === 'left' ? 'text-blue-400' : 'text-slate-600 hover:text-slate-300'}`}
              >
                <Pin size={12} />
              </button>
            </div>
          );
        })}
      </div>
      <MenuSeparator />
      <button onClick={resetColumns} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-slate-400 hover:bg-surface-700 hover:text-white">
        <RotateCcw size={13} /> Reset to default
      </button>
    </DropdownMenu>
  );
}
