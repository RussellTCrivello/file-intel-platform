import { useRef } from 'react';
import { VIEW_MODES, ANALYST_WORKSPACE_VIEWS } from '../lib/viewModes';
import { useAppStore } from '../store/useAppStore';
import clsx from 'clsx';

function Tab({ v, viewMode, setViewMode }) {
  return (
    <button
      key={v.id}
      onClick={() => setViewMode(v.id)}
      className={clsx(
        'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-colors focus-ring',
        viewMode === v.id ? 'bg-blue-500/15 text-blue-300' : 'text-slate-400 hover:bg-surface-800 hover:text-slate-200'
      )}
      aria-current={viewMode === v.id}
    >
      <v.icon size={14} />
      {v.label}
    </button>
  );
}

export default function ViewTabs() {
  const viewMode = useAppStore((s) => s.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const scrollRef = useRef(null);

  return (
    <div ref={scrollRef} className="scrollbar-thin flex items-center gap-1 overflow-x-auto border-b border-surface-border bg-surface-900 px-3 py-1.5">
      {VIEW_MODES.map((v) => <Tab key={v.id} v={v} viewMode={viewMode} setViewMode={setViewMode} />)}
      <span className="mx-1 h-5 w-px shrink-0 bg-surface-border" aria-hidden="true" />
      {ANALYST_WORKSPACE_VIEWS.map((v) => <Tab key={v.id} v={v} viewMode={viewMode} setViewMode={setViewMode} />)}
    </div>
  );
}
