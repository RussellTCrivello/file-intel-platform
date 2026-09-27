import { useEffect, useMemo } from 'react';
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import {
  Files, HardDrive, Building2, FileType2, CheckCircle2, Clock3, Database, Type, ShieldAlert, Layers,
} from 'lucide-react';
import { useSearchStore } from '../store/useSearchStore';
import { useAppStore } from '../store/useAppStore';
import { formatBytes } from '../lib/format';
import { typeFamilyOf, typeColorOf, typeLabelOf } from '../lib/domain';

function KPI({ icon: Icon, label, value, sub, accent, onClick }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={`flex flex-col gap-2 rounded-xl border border-surface-border bg-surface-850 p-4 text-left shadow-panel ${onClick ? 'cursor-pointer transition-colors hover:border-slate-600' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${accent}18`, color: accent }}>
          <Icon size={14} />
        </span>
      </div>
      <div className="text-2xl font-bold tracking-tight text-white">{value}</div>
      {sub && <div className="text-[11.5px] text-slate-500">{sub}</div>}
    </Comp>
  );
}

function ChartCard({ title, children, right }) {
  return (
    <div className="flex flex-col rounded-xl border border-surface-border bg-surface-850 p-4 shadow-panel">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[12.5px] font-semibold text-slate-200">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

const tooltipStyle = { background: '#131926', border: '1px solid #232c3d', borderRadius: 8, fontSize: 12, color: '#e2e8f0' };
const PERIODS = ['day', 'week', 'month', 'year'];

// Every number here is read directly from the server's own aggregate
// queries (`/api/dashboard/stats`, `/api/analytics/dashboard-summary`,
// `/api/analytics/timeline-data`, `/api/analytics/category-distribution`,
// `/api/analytics/file-type-distribution`) -- nothing is computed from
// rows in the browser. Every drilldown re-runs the real `/api/search`
// query with an explicit filter, then switches to the table view to show it.
export default function DashboardView() {
  const dashboardStats = useSearchStore((s) => s.dashboardStats);
  const analyticsSummary = useSearchStore((s) => s.analyticsSummary);
  const timeline = useSearchStore((s) => s.timeline);
  const timelinePeriod = useSearchStore((s) => s.timelinePeriod);
  const categoryDistribution = useSearchStore((s) => s.categoryDistribution);
  const facetFileTypes = useSearchStore((s) => s.facetFileTypes);
  const facetSources = useSearchStore((s) => s.facetSources);
  const facetSides = useSearchStore((s) => s.facetSides);
  const facetCategories = useSearchStore((s) => s.facetCategories);
  const loadAnalytics = useSearchStore((s) => s.loadAnalytics);
  const setFilters = useSearchStore((s) => s.setFilters);
  const resetFilters = useSearchStore((s) => s.resetFilters);
  const runQuery = useSearchStore((s) => s.runQuery);
  const setViewMode = useAppStore((s) => s.setViewMode);

  useEffect(() => { if (!analyticsSummary) loadAnalytics(); }, [analyticsSummary, loadAnalytics]);

  const drill = (patch) => {
    resetFilters();
    setFilters(patch);
    runQuery();
    setViewMode('table');
  };

  const typeChartData = useMemo(
    () => facetFileTypes.map((t) => ({ name: typeLabelOf(t.type), rawType: t.type, value: t.count, color: typeColorOf(t.type) })),
    [facetFileTypes]
  );

  const timelineChartData = useMemo(() => {
    if (!timeline?.labels) return [];
    return timeline.labels.map((label, i) => ({ label, total: timeline.fileCount[i], processed: timeline.processedCount[i] }));
  }, [timeline]);

  const categoryChartData = useMemo(() => {
    if (!categoryDistribution?.labels) return [];
    return categoryDistribution.labels.map((label, i) => {
      const match = facetCategories.find((c) => c.name === label);
      return { name: label.length > 20 ? label.slice(0, 18) + '…' : label, fullName: label, value: categoryDistribution.values[i], id: match?.id };
    });
  }, [categoryDistribution, facetCategories]);

  return (
    <div className="scrollbar-thin h-full overflow-y-auto">
      <div className="animate-fade-in space-y-5 p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KPI icon={Files} label="Total Files" value={analyticsSummary?.totalFiles ?? '—'} accent="#3b82f6" onClick={() => drill({})} />
          <KPI icon={CheckCircle2} label="Analyzed" value={dashboardStats?.analyzedDocs ?? '—'} sub={analyticsSummary ? `${analyticsSummary.processingRate}% of total` : undefined} accent="#22c55e" onClick={() => drill({ status: ['Read'] })} />
          <KPI icon={Clock3} label="Pending Analysis" value={dashboardStats?.pendingDocs ?? '—'} accent="#eab308" onClick={() => drill({ status: ['Unread'] })} />
          <KPI icon={FileType2} label="File Types" value={analyticsSummary?.uniqueTypes ?? '—'} accent="#a855f7" />
          <KPI icon={HardDrive} label="Total Size" value={analyticsSummary ? formatBytes(Number(analyticsSummary.totalSize)) : '—'} accent="#ec4899" />
          <KPI icon={Database} label="Database Size" value={analyticsSummary ? formatBytes(Number(analyticsSummary.databaseSize)) : '—'} accent="#06b6d4" />
          <KPI icon={Building2} label="Sources" value={facetSources.length} accent="#f97316" />
          <KPI icon={Layers} label="Sides" value={facetSides.length} accent="#14b8a6" />
          <KPI icon={Type} label="Categories" value={analyticsSummary?.totalCategories ?? '—'} accent="#64748b" />
          <KPI icon={Type} label="Words Indexed" value={analyticsSummary?.totalWords ?? '—'} accent="#eab308" />
          <KPI icon={ShieldAlert} label="Keywords" value={analyticsSummary?.totalKeywords ?? '—'} accent="#ef4444" />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <ChartCard title="Files by Type">
            {typeChartData.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-[12px] text-slate-500">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie
                    data={typeChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={80}
                    paddingAngle={2}
                    onClick={(d) => drill({ fileTypes: [d.rawType] })}
                    className="cursor-pointer"
                  >
                    {typeChartData.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, n, p) => [`${v} files`, p.payload.name]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            title="Ingestion Activity"
            right={
              <div className="flex gap-1">
                {PERIODS.map((p) => (
                  <button key={p} onClick={() => loadAnalytics(p)} className={`rounded px-2 py-0.5 text-[10.5px] font-medium capitalize ${timelinePeriod === p ? 'bg-blue-500/20 text-blue-300' : 'text-slate-500 hover:bg-surface-800'}`}>{p}</button>
                ))}
              </div>
            }
          >
            {timelineChartData.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-[12px] text-slate-500">No activity in this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={timelineChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="total" name="Ingested" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="processed" name="Analyzed" fill="#22c55e" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title="Files by Category">
            {categoryChartData.length === 0 ? (
              <div className="flex h-56 flex-col items-center justify-center gap-1 text-center text-[12px] text-slate-500">
                <span>No categorized files yet</span>
                <span className="text-[10.5px] text-slate-600">Categories will appear here once files are categorized</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={categoryChartData} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v, n, p) => [`${v} files`, p.payload.fullName]} />
                  <Bar
                    dataKey="value"
                    fill="#8b5cf6"
                    radius={[0, 3, 3, 0]}
                    onClick={(d) => d.id != null && drill({ categoryIds: [d.id] })}
                    className="cursor-pointer"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        <ChartCard title="Processing Breakdown by File Type">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-surface-border text-[10.5px] uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-4 font-semibold">Type</th>
                  <th className="py-2 pr-4 font-semibold">Total</th>
                  <th className="py-2 pr-4 font-semibold">Analyzed</th>
                  <th className="py-2 pr-4 font-semibold">Pending</th>
                  <th className="py-2 pr-4 font-semibold">Success Rate</th>
                  <th className="py-2 pr-4 font-semibold">Total Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/60">
                {(dashboardStats?.processingStats?.by_type || []).map((row) => (
                  <tr key={row.type} className="cursor-pointer hover:bg-surface-800/40" onClick={() => drill({ fileTypes: [row.type] })}>
                    <td className="py-2 pr-4 font-mono font-semibold" style={{ color: typeColorOf(row.type) }}>{row.type}</td>
                    <td className="py-2 pr-4 text-slate-300">{row.total}</td>
                    <td className="py-2 pr-4 text-slate-300">{row.processed}</td>
                    <td className="py-2 pr-4 text-slate-300">{row.unprocessed}</td>
                    <td className="py-2 pr-4 text-slate-300">{row.success_rate}%</td>
                    <td className="py-2 pr-4 text-slate-300">{formatBytes(Number(row.total_size))}</td>
                  </tr>
                ))}
                {(!dashboardStats?.processingStats?.by_type || dashboardStats.processingStats.by_type.length === 0) && (
                  <tr><td colSpan={6} className="py-6 text-center text-slate-500">No processing data available</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
