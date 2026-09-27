import { ChevronRight, LayoutGrid } from 'lucide-react';

// crumbs: [{ label, onClick }] -- the last entry is the current, non-clickable step.
export default function Breadcrumb({ crumbs, onHome }) {
  return (
    <nav aria-label="File Analysis breadcrumb" className="flex flex-wrap items-center gap-1 px-4 py-2.5 text-[12.5px]">
      <button onClick={onHome} aria-label="Back to File Analysis hub" className="flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-slate-400 hover:bg-surface-800 hover:text-slate-200 focus-ring">
        <LayoutGrid size={12.5} /> File Analysis
      </button>
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight size={12} className="text-slate-600" />
          {i === crumbs.length - 1 || !c.onClick ? (
            <span className="rounded px-1.5 py-0.5 font-semibold text-white">{c.label}</span>
          ) : (
            <button onClick={c.onClick} className="rounded px-1.5 py-0.5 font-medium text-slate-400 hover:bg-surface-800 hover:text-slate-200 focus-ring">{c.label}</button>
          )}
        </span>
      ))}
    </nav>
  );
}
