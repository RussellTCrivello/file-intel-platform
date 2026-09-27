import { useEffect } from 'react';
import { Tags, FolderOpen, Users, CheckCircle2, Circle, Activity, ArrowRight } from 'lucide-react';
import { useSearchStore } from '../store/useSearchStore';
import { useAppStore } from '../store/useAppStore';
import { formatRelative } from '../lib/format';

function StatCard({ label, value, icon: Icon, accent }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-850 p-4">
      <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
        <Icon size={14} style={{ color: accent }} />
      </div>
      <div className="text-[22px] font-bold text-white">{value}</div>
    </div>
  );
}

// The "Analyst Classification Workspace" (spec §3): overview, statistics,
// category distribution and a quick path into the uncategorized-review
// queue, all backed directly by AnalystCategoryService.get_stats() /
// list_categories() / list_assignments() -- no client-side aggregation.
export default function AnalystWorkspaceView() {
  const stats = useSearchStore((s) => s.analystStats);
  const loadStats = useSearchStore((s) => s.loadAnalystStats);
  const facetAnalystCategories = useSearchStore((s) => s.facetAnalystCategories);
  const loadFacets = useSearchStore((s) => s.loadFacets);
  const assignments = useSearchStore((s) => s.analystAssignments);
  const loadAssignments = useSearchStore((s) => s.loadAnalystAssignments);
  const setAnalystScope = useSearchStore((s) => s.setAnalystScope);
  const setFilters = useSearchStore((s) => s.setFilters);
  const runQuery = useSearchStore((s) => s.runQuery);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const setAppMode = useAppStore((s) => s.setAppMode);

  useEffect(() => {
    loadStats();
    loadFacets();
    loadAssignments({ perPage: 8 });
  }, [loadStats, loadFacets, loadAssignments]);

  const reviewUncategorized = () => {
    setAppMode('explorer');
    setAnalystScope('uncategorized');
    setViewMode('table');
    runQuery();
  };

  const openCategory = (categoryId) => {
    setAppMode('explorer');
    setAnalystScope('all');
    setFilters({ analystCategoryIds: [categoryId] });
    setViewMode('table');
    runQuery();
  };

  const total = stats?.total_files || 0;
  const categorized = stats?.categorized_files || 0;
  const pct = total ? Math.round((categorized / total) * 100) : 0;
  const maxCount = Math.max(1, ...facetAnalystCategories.map((c) => c.file_count || 0));

  return (
    <div className="h-full space-y-5 overflow-y-auto scrollbar-thin p-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-[16px] font-bold text-white"><Tags size={17} className="text-blue-400" /> Analyst Classification</h1>
          <p className="text-[12px] text-slate-500">Human-defined classification, kept separate from system/smart categories.</p>
        </div>
        <button onClick={reviewUncategorized} className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-blue-500">
          Review Uncategorized Files <ArrowRight size={13} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Files" value={total.toLocaleString()} icon={FolderOpen} accent="#64748b" />
        <StatCard label="Categorized" value={`${categorized.toLocaleString()} (${pct}%)`} icon={CheckCircle2} accent="#22c55e" />
        <StatCard label="Uncategorized" value={(total - categorized).toLocaleString()} icon={Circle} accent="#eab308" />
        <StatCard label="Categories" value={stats?.category_count ?? 0} icon={Tags} accent="#3b82f6" />
        <StatCard label="Assignments" value={stats?.assignment_count ?? 0} icon={Activity} accent="#a855f7" />
        <StatCard label="Active Analysts" value={stats?.analyst_count ?? 0} icon={Users} accent="#ec4899" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-surface-border bg-surface-850 p-4">
          <div className="mb-3 text-[12px] font-bold uppercase tracking-wider text-slate-400">Category Distribution</div>
          {facetAnalystCategories.length === 0 ? (
            <div className="py-6 text-center text-[12px] text-slate-500">No analyst categories exist yet.</div>
          ) : (
            <div className="space-y-2.5">
              {[...facetAnalystCategories].sort((a, b) => (b.file_count || 0) - (a.file_count || 0)).map((c) => (
                <button key={c.id} onClick={() => openCategory(c.id)} className="block w-full text-left">
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-1.5 text-slate-300"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color || '#3b82f6' }} />{c.name}</span>
                    <span className="text-slate-500">{c.file_count}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-800">
                    <div className="h-full rounded-full" style={{ width: `${((c.file_count || 0) / maxCount) * 100}%`, backgroundColor: c.color || '#3b82f6' }} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-850 p-4">
          <div className="mb-3 text-[12px] font-bold uppercase tracking-wider text-slate-400">Recent Classification Activity</div>
          {assignments.length === 0 ? (
            <div className="py-6 text-center text-[12px] text-slate-500">No classification activity yet.</div>
          ) : (
            <div className="space-y-2">
              {assignments.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[12px] hover:bg-surface-800">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: a.category_color || '#3b82f6' }} />
                  <span className="min-w-0 flex-1 truncate text-slate-300" title={a.file_name}>{a.file_name}</span>
                  <span className="shrink-0 text-slate-500">{a.category_name}</span>
                  <span className="shrink-0 text-slate-600">{formatRelative(a.assigned_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
