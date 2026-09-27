import { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, Layers, Building2, Users, Tag, CheckCircle2, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useSearchStore } from '../store/useSearchStore';
import { typeFamilyOf, typeColorOf, colorForKey } from '../lib/domain';
import { formatBytes } from '../lib/format';
import FileTypeIcon from './cells/FileTypeIcon';

function SectionHeader({ children }) {
  return <div className="mb-1.5 mt-4 px-3 text-[10.5px] font-bold uppercase tracking-wider text-slate-600 first:mt-0">{children}</div>;
}

function Row({ icon, label, count, active, onClick, indent = false, checkbox = false }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${indent ? 'ml-3' : ''} ${
        active ? 'bg-blue-500/15 text-blue-300' : 'text-slate-300 hover:bg-surface-800/70'
      }`}
      style={indent ? { width: 'calc(100% - 0.75rem)' } : undefined}
    >
      {checkbox && (
        <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${active ? 'border-blue-400 bg-blue-500/30' : 'border-surface-border'}`}>
          {active && <span className="h-1.5 w-1.5 rounded-sm bg-blue-400" />}
        </span>
      )}
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count != null && <span className="shrink-0 text-[10.5px] tabular-nums text-slate-500">{count.toLocaleString()}</span>}
    </button>
  );
}

// Every list here is populated live from the database/query layer
// (facet endpoints + dashboard stats loaded by useSearchStore) -- no
// hardcoded enum of "the types/sources/sides that exist". Sources and sides
// intentionally show no per-value count (the real API returns them as a
// plain list, not pre-aggregated counts), per the "no client-side
// full-dataset aggregation" rule; file types DO show a count because the
// backend's own `/api/analytics/file-type-distribution` computes it.
export default function CategoryExplorer() {
  const filters = useSearchStore((s) => s.filters);
  const setFilters = useSearchStore((s) => s.setFilters);
  const resetFilters = useSearchStore((s) => s.resetFilters);
  const runQuery = useSearchStore((s) => s.runQuery);
  const query = useSearchStore((s) => s.query);
  const activeFilterCount = useSearchStore((s) => s.activeFilterCount());
  const facetSources = useSearchStore((s) => s.facetSources);
  const facetSides = useSearchStore((s) => s.facetSides);
  const facetCategories = useSearchStore((s) => s.facetCategories);
  const facetAnalystCategories = useSearchStore((s) => s.facetAnalystCategories);
  const facetFileTypes = useSearchStore((s) => s.facetFileTypes);
  const dashboardStats = useSearchStore((s) => s.dashboardStats);
  const results = useSearchStore((s) => s.results);

  const expandedCategories = useAppStore((s) => s.expandedCategories);
  const toggleCategoryExpanded = useAppStore((s) => s.toggleCategoryExpanded);
  const recentlyViewed = useAppStore((s) => s.recentlyViewed);
  const openDetail = useAppStore((s) => s.openDetail);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const [sourceExpanded, setSourceExpanded] = useState(false);

  const toggle = (key, id) => {
    const arr = filters[key];
    setFilters({ [key]: arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id] });
    runQuery();
  };

  // Group the real file-type-distribution rows by presentational family.
  const byFamily = {};
  facetFileTypes.forEach((t) => {
    const fam = typeFamilyOf(t.type);
    (byFamily[fam] ||= []).push(t);
  });

  const topSources = facetSources;
  const visibleSources = sourceExpanded ? topSources : topSources.slice(0, 8);

  return (
    <aside className="scrollbar-thin flex h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-surface-border bg-surface-900/60 py-3">
      <div className="mb-1 flex items-center justify-between px-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Explorer</span>
        <button onClick={toggleSidebar} title="Collapse sidebar" className="rounded p-1 text-slate-500 hover:bg-surface-800 hover:text-slate-300">
          <X size={13} />
        </button>
      </div>

      <SectionHeader>Quick Views</SectionHeader>
      <Row icon={<Layers size={13} />} label="All Files" count={dashboardStats?.totalDocs} active={activeFilterCount === 0 && !query} onClick={() => { resetFilters(); useSearchStore.getState().setQuery(''); runQuery(); }} />
      {recentlyViewed.length > 0 && (
        <div>
          <button onClick={() => toggleCategoryExpanded('recent')} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] text-slate-300 hover:bg-surface-800/70">
            {expandedCategories.recent ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <Clock size={13} className="text-slate-500" />
            <span className="flex-1">Recently Viewed</span>
            <span className="text-[10.5px] text-slate-500">{recentlyViewed.length}</span>
          </button>
          {expandedCategories.recent && (
            <div className="ml-3 border-l border-surface-border pl-2">
              {recentlyViewed.slice(0, 6).map((id) => {
                const rec = results.find((r) => r.id === id);
                return (
                  <button key={id} onClick={() => openDetail(id)} className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-[11.5px] text-slate-400 hover:bg-surface-800/70 hover:text-slate-200">
                    <span className="truncate">{rec ? rec.file_name : `File #${id}`}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <SectionHeader>File Types</SectionHeader>
      {Object.entries(byFamily).map(([family, types]) => {
        const familyCount = types.reduce((s, t) => s + t.count, 0);
        const familySize = types.reduce((s, t) => s + Number(t.total_size || 0), 0);
        const expanded = expandedCategories[family] ?? false;
        return (
          <div key={family}>
            <button onClick={() => toggleCategoryExpanded(family)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[12.5px] font-medium text-slate-200 hover:bg-surface-800/70">
              {expanded ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronRight size={12} className="text-slate-500" />}
              <span className="flex-1 truncate">{family}</span>
              <span className="text-[10px] text-slate-600">{formatBytes(familySize)}</span>
              <span className="w-9 shrink-0 text-right text-[10.5px] tabular-nums text-slate-500">{familyCount}</span>
            </button>
            {expanded && (
              <div className="ml-3 border-l border-surface-border pl-1">
                {types.map((t) => (
                  <Row
                    key={t.type}
                    checkbox
                    icon={<FileTypeIcon family={typeFamilyOf(t.type)} color={typeColorOf(t.type)} size={12} />}
                    label={t.type.replace(/^\./, '').toUpperCase()}
                    count={t.count}
                    active={filters.fileTypes.includes(t.type)}
                    onClick={() => toggle('fileTypes', t.type)}
                    indent
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      <SectionHeader>Side</SectionHeader>
      {facetSides.map((s) => (
        <Row key={s.id} checkbox icon={<span className="block h-2 w-2 rounded-full" style={{ backgroundColor: colorForKey(s.name) }} />} label={s.name} active={filters.sideIds.includes(s.id)} onClick={() => toggle('sideIds', s.id)} />
      ))}

      <SectionHeader>Status</SectionHeader>
      <Row checkbox icon={<CheckCircle2 size={12} className="text-emerald-400" />} label="Analyzed" count={dashboardStats?.analyzedDocs} active={filters.status.includes('Read')} onClick={() => toggle('status', 'Read')} />
      <Row checkbox icon={<Clock size={12} className="text-amber-400" />} label="Pending Analysis" count={dashboardStats?.pendingDocs} active={filters.status.includes('Unread')} onClick={() => toggle('status', 'Unread')} />

      {facetCategories.length > 0 && (
        <>
          <SectionHeader>Category</SectionHeader>
          {facetCategories.map((c) => (
            <Row key={c.id} checkbox icon={<Tag size={11} />} label={c.name} active={filters.categoryIds.includes(c.id)} onClick={() => toggle('categoryIds', c.id)} />
          ))}
        </>
      )}
      {facetAnalystCategories.length > 0 && (
        <>
          <SectionHeader>Analyst Category</SectionHeader>
          {facetAnalystCategories.map((c) => (
            <Row key={c.id} checkbox icon={<Tag size={11} />} label={c.name} active={filters.analystCategoryIds.includes(c.id)} onClick={() => toggle('analystCategoryIds', c.id)} />
          ))}
        </>
      )}

      <SectionHeader>Sources</SectionHeader>
      {visibleSources.map((s) => (
        <Row key={s.id} checkbox icon={<Building2 size={11} />} label={s.name} active={filters.sourceIds.includes(s.id)} onClick={() => toggle('sourceIds', s.id)} />
      ))}
      {topSources.length > 8 && (
        <button onClick={() => setSourceExpanded((v) => !v)} className="mt-1 px-2.5 text-[11px] font-medium text-blue-400 hover:underline">
          {sourceExpanded ? 'Show less' : `+ ${topSources.length - 8} more sources`}
        </button>
      )}
    </aside>
  );
}
