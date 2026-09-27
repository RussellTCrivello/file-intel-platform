import { useState } from 'react';
import { SlidersHorizontal, X, Filter as FilterIcon, Rows, Columns3, Rows2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useSearchStore } from '../store/useSearchStore';
import AdvancedFilterPanel from './AdvancedFilterPanel';
import ColumnManager from './table/ColumnManager';
import DropdownMenu, { MenuItem, MenuLabel } from './ui/DropdownMenu';

function nameFor(list, id) { return list.find((x) => x.id === id)?.name || id; }

export default function FilterBar() {
  const filters = useSearchStore((s) => s.filters);
  const setFilters = useSearchStore((s) => s.setFilters);
  const resetFilters = useSearchStore((s) => s.resetFilters);
  const runQuery = useSearchStore((s) => s.runQuery);
  const activeFilterCount = useSearchStore((s) => s.activeFilterCount());
  const facetSources = useSearchStore((s) => s.facetSources);
  const facetSides = useSearchStore((s) => s.facetSides);
  const facetCategories = useSearchStore((s) => s.facetCategories);
  const facetAnalystCategories = useSearchStore((s) => s.facetAnalystCategories);
  const pagination = useSearchStore((s) => s.pagination);

  const density = useAppStore((s) => s.density);
  const setDensity = useAppStore((s) => s.setDensity);
  const viewMode = useAppStore((s) => s.viewMode);
  const [panelOpen, setPanelOpen] = useState(false);

  const remove = (patch) => { setFilters(patch); runQuery(); };

  const chips = [];
  filters.fileTypes.forEach((t) => chips.push({ label: `Type: ${t}`, clear: () => remove({ fileTypes: filters.fileTypes.filter((x) => x !== t) }) }));
  filters.sourceIds.forEach((id) => chips.push({ label: `Source: ${nameFor(facetSources, id)}`, clear: () => remove({ sourceIds: filters.sourceIds.filter((x) => x !== id) }) }));
  filters.sideIds.forEach((id) => chips.push({ label: `Side: ${nameFor(facetSides, id)}`, clear: () => remove({ sideIds: filters.sideIds.filter((x) => x !== id) }) }));
  filters.categoryIds.forEach((id) => chips.push({ label: `Category: ${nameFor(facetCategories, id)}`, clear: () => remove({ categoryIds: filters.categoryIds.filter((x) => x !== id) }) }));
  filters.analystCategoryIds.forEach((id) => chips.push({ label: `Analyst: ${nameFor(facetAnalystCategories, id)}`, clear: () => remove({ analystCategoryIds: filters.analystCategoryIds.filter((x) => x !== id) }) }));
  filters.status.forEach((s) => chips.push({ label: `Status: ${s === 'Read' ? 'Analyzed' : 'Pending'}`, clear: () => remove({ status: filters.status.filter((x) => x !== s) }) }));
  if (filters.dateFrom) chips.push({ label: `From: ${filters.dateFrom}`, clear: () => remove({ dateFrom: '' }) });
  if (filters.dateTo) chips.push({ label: `To: ${filters.dateTo}`, clear: () => remove({ dateTo: '' }) });

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-surface-border bg-surface-900/60 px-4 py-2">
      <button
        onClick={() => setPanelOpen(true)}
        className="flex shrink-0 items-center gap-1.5 rounded-md border border-dashed border-surface-border px-2.5 py-1 text-[12px] font-medium text-slate-400 hover:border-blue-500/60 hover:text-blue-400 focus-ring"
      >
        <FilterIcon size={13} /> Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
      </button>

      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5 rounded-full border border-surface-border bg-surface-800 py-1 pl-2.5 pr-1.5 text-[11.5px] font-medium text-slate-300 animate-fade-in">
            {c.label}
            <button onClick={c.clear} className="rounded-full p-0.5 text-slate-500 hover:bg-surface-700 hover:text-slate-200"><X size={11} /></button>
          </span>
        ))}
        {chips.length > 0 && (
          <button onClick={() => { resetFilters(); runQuery(); }} className="text-[11.5px] font-medium text-slate-500 hover:text-red-400">Clear all</button>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {pagination && <span className="hidden text-[11.5px] text-slate-500 sm:inline">{pagination.total.toLocaleString()} results</span>}

        <DropdownMenu
          width={170}
          trigger={
            <button className="flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-800 px-2 py-1 text-[12px] text-slate-400 hover:text-slate-200">
              <SlidersHorizontal size={12} /> {density[0].toUpperCase() + density.slice(1)}
            </button>
          }
        >
          {({ close }) => (
            <>
              <MenuLabel>Row Density</MenuLabel>
              {['compact', 'comfortable', 'expanded'].map((d) => (
                <MenuItem key={d} icon={d === 'compact' ? Rows2 : d === 'expanded' ? Columns3 : Rows} label={d[0].toUpperCase() + d.slice(1)} onClick={() => { setDensity(d); close(); }} />
              ))}
            </>
          )}
        </DropdownMenu>

        {viewMode === 'table' && <ColumnManager />}
      </div>

      {panelOpen && <AdvancedFilterPanel onClose={() => setPanelOpen(false)} />}
    </div>
  );
}
