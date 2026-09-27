import { useState } from 'react';
import { Tags } from 'lucide-react';
import Modal from './ui/Modal';
import { useSearchStore } from '../store/useSearchStore';

const ANALYST_SCOPES = [
  { id: 'uncategorized', label: 'Uncategorized' },
  { id: 'categorized', label: 'Categorized' },
  { id: 'all', label: 'All Files' },
];

function MultiCheck({ options, selected, onToggle, getId = (o) => o.id, getLabel = (o) => o.name, getSub }) {
  if (!options.length) return <div className="py-2 text-[11.5px] text-slate-500">None available</div>;
  return (
    <div className="scrollbar-thin max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-surface-border bg-surface-900 p-1.5">
      {options.map((o) => {
        const id = getId(o);
        const checked = selected.includes(id);
        return (
          <label key={id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[12px] text-slate-300 hover:bg-surface-800">
            <input type="checkbox" checked={checked} onChange={() => onToggle(id)} className="h-3.5 w-3.5 rounded border-surface-border bg-surface-800 accent-blue-500" />
            <span className="flex-1 truncate">{getLabel(o)}</span>
            {getSub && <span className="shrink-0 text-[10.5px] text-slate-500">{getSub(o)}</span>}
          </label>
        );
      })}
    </div>
  );
}

// The fixed set of real filter/search-mode dimensions the backend actually
// supports (Api/routes/search.py) -- file type(s), source(s), side(s), date
// range, category/analyst category, file status, plus the search-mode
// switches (case sensitivity, whole word, fuzzy, expansion, BM25, duplicate
// visibility). There is no generic field/operator/value composer here:
// that would let the UI express conditions the server has no way to run.
export default function AdvancedFilterPanel({ onClose }) {
  const store = useSearchStore();
  const [filters, setLocalFilters] = useState(store.filters);
  const [options, setLocalOptions] = useState(store.options);
  const [analystScope, setLocalAnalystScope] = useState(store.analystScope);

  const toggleIn = (key, id) => setLocalFilters((f) => ({
    ...f,
    [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id],
  }));
  const toggleStatus = (id) => setLocalFilters((f) => ({
    ...f,
    status: f.status.includes(id) ? f.status.filter((x) => x !== id) : [...f.status, id],
  }));

  const apply = () => {
    store.setFilters(filters);
    store.setOptions(options);
    store.setAnalystScope(analystScope);
    store.runQuery();
    onClose();
  };
  const reset = () => {
    store.resetFilters();
    setLocalFilters(store.filters);
    setLocalAnalystScope('all');
  };

  return (
    <Modal onClose={onClose} title="Advanced Filters & Search Options" width={520}>
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">File Type</div>
          <MultiCheck
            options={store.facetFileTypes}
            selected={filters.fileTypes}
            onToggle={(id) => toggleIn('fileTypes', id)}
            getId={(o) => o.type}
            getLabel={(o) => o.type}
            getSub={(o) => `${o.count}`}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Source</div>
            <MultiCheck options={store.facetSources} selected={filters.sourceIds} onToggle={(id) => toggleIn('sourceIds', id)} />
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Side</div>
            <MultiCheck options={store.facetSides} selected={filters.sideIds} onToggle={(id) => toggleIn('sideIds', id)} />
          </div>
        </div>
        {store.facetCategories.length > 0 && (
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Category</div>
            <MultiCheck options={store.facetCategories} selected={filters.categoryIds} onToggle={(id) => toggleIn('categoryIds', id)} />
          </div>
        )}
        {/* Analyst classification controls: deliberately visually distinct
            from "Category" (system/smart) above -- own section, own icon,
            colour-coded chips with the category name always shown alongside
            the colour (never colour alone, §9/§37). */}
        <div className="rounded-md border border-blue-500/20 bg-blue-500/[0.04] p-2.5">
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-blue-300">
            <Tags size={12} /> Analyst Classification
          </div>
          <div className="mb-2 flex rounded-md border border-surface-border bg-surface-900 p-0.5 text-[11.5px]">
            {ANALYST_SCOPES.map((s) => (
              <button
                key={s.id}
                onClick={() => setLocalAnalystScope(s.id)}
                className={`flex-1 rounded px-2 py-1 font-medium transition-colors ${analystScope === s.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {store.facetAnalystCategories.length > 0 && (
            <>
              <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">Analyst Category</div>
              <div className="scrollbar-thin max-h-40 space-y-0.5 overflow-y-auto rounded-md border border-surface-border bg-surface-900 p-1.5">
                {store.facetAnalystCategories.map((c) => {
                  const checked = filters.analystCategoryIds.includes(c.id);
                  return (
                    <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[12px] text-slate-300 hover:bg-surface-800">
                      <input type="checkbox" checked={checked} onChange={() => toggleIn('analystCategoryIds', c.id)} className="h-3.5 w-3.5 rounded border-surface-border bg-surface-800 accent-blue-500" />
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color || '#3b82f6' }} />
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="shrink-0 text-[10.5px] text-slate-500">{c.file_count}</span>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Status</div>
          <div className="flex gap-3">
            {['Read', 'Unread'].map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-[12px] text-slate-300">
                <input type="checkbox" checked={filters.status.includes(s)} onChange={() => toggleStatus(s)} className="h-3.5 w-3.5 rounded border-surface-border bg-surface-800 accent-blue-500" />
                {s === 'Read' ? 'Analyzed' : 'Pending Analysis'}
              </label>
            ))}
            <span className="text-[11px] text-slate-500">(none selected = both)</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Date From</div>
            <input type="date" value={filters.dateFrom} onChange={(e) => setLocalFilters((f) => ({ ...f, dateFrom: e.target.value }))} className="w-full rounded-md border border-surface-border bg-surface-800 px-2 py-1.5 text-[12px] text-slate-200 focus-ring" />
          </div>
          <div>
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Date To</div>
            <input type="date" value={filters.dateTo} onChange={(e) => setLocalFilters((f) => ({ ...f, dateTo: e.target.value }))} className="w-full rounded-md border border-surface-border bg-surface-800 px-2 py-1.5 text-[12px] text-slate-200 focus-ring" />
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Search Options</div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              ['caseSensitive', 'Case sensitive'],
              ['wholeWord', 'Whole word'],
              ['useFuzzy', 'Fuzzy matching'],
              ['useExpansion', 'Query expansion'],
              ['useBM25', 'BM25 ranking'],
              ['hideDuplicates', 'Hide duplicates'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-1.5 text-[12px] text-slate-300">
                <input type="checkbox" checked={options[key]} onChange={() => setLocalOptions((o) => ({ ...o, [key]: !o[key] }))} className="h-3.5 w-3.5 rounded border-surface-border bg-surface-800 accent-blue-500" />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button onClick={apply} className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-blue-500">Apply</button>
          <button onClick={reset} className="rounded-md border border-surface-border px-3 py-2 text-[12.5px] text-slate-300 hover:bg-surface-800">Reset</button>
        </div>
      </div>
    </Modal>
  );
}
