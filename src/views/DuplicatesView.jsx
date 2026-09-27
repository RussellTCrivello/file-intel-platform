import { useEffect, useMemo, useRef, useState } from 'react';
import { ShieldAlert, Copy as CopyLikeIcon, ChevronDown, ChevronRight, Copy, Loader2, RefreshCw } from 'lucide-react';
import { useSearchStore } from '../store/useSearchStore';
import { useAppStore } from '../store/useAppStore';
import { formatBytes, formatDate, copyToClipboard } from '../lib/format';
import { typeFamilyOf, typeColorOf } from '../lib/domain';
import FileTypeIcon from '../components/cells/FileTypeIcon';
import ActionsMenu from '../components/cells/ActionsMenu';
import { toast } from '../components/ui/Toast';

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-surface-border bg-surface-850 p-4">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}18`, color }}>
        <Icon size={16} />
      </span>
      <div>
        <div className="text-xl font-bold text-white">{value}</div>
        <div className="text-[11px] text-slate-500">{label}</div>
      </div>
    </div>
  );
}

// Reads the two real duplicate/similarity groupings from
// `/api/dashboard/similar-files` (Api/routes/api.py) directly -- this is
// its own dataset, independent of the search results page, and is not
// recomputed client-side from whatever rows happen to be on screen.
export default function DuplicatesView() {
  const hashGroups = useSearchStore((s) => s.hashGroups);
  const titleGroups = useSearchStore((s) => s.titleGroups);
  const totals = useSearchStore((s) => s.duplicateTotals);
  const loading = useSearchStore((s) => s.duplicatesLoading);
  const error = useSearchStore((s) => s.duplicatesError);
  const loadDuplicateGroups = useSearchStore((s) => s.loadDuplicateGroups);
  const openDetail = useAppStore((s) => s.openDetail);
  const duplicatesFocus = useAppStore((s) => s.duplicatesFocus);
  const clearDuplicatesFocus = useAppStore((s) => s.clearDuplicatesFocus);
  const [open, setOpen] = useState({});
  const [tab, setTab] = useState('hash');
  const menuRefs = useRef({});
  const groupRefs = useRef({});

  // A per-record "View Similar" / "View Duplicates" action requests a
  // specific file be focused here. Re-fetch at the endpoint's own max cap
  // (500, its own documented ceiling -- not a second/looser inventory) so
  // the group is actually found rather than truncated by this view's
  // normal, smaller default page, then act on the settled response
  // directly (not on reactive store state, which would race an unrelated
  // still-empty render against the fetch that's about to fill it in).
  useEffect(() => {
    if (!duplicatesFocus) return;
    let cancelled = false;
    setTab(duplicatesFocus.tab);
    loadDuplicateGroups({ limit: 500, min_group_size: 2 }).then((data) => {
      if (cancelled) return;
      const groups = (duplicatesFocus.tab === 'hash' ? data.hash_groups : data.title_groups) || [];
      const match = groups.find((g) => g.files.some((f) => f.id === duplicatesFocus.fileId));
      if (!match) {
        toast(`No ${duplicatesFocus.tab === 'hash' ? 'exact duplicates' : 'similar titles'} found for this file`, { type: 'info' });
        clearDuplicatesFocus();
        return;
      }
      const key = `${match.group_type}-${match.group_id}`;
      setOpen((o) => ({ ...o, [key]: true }));
      requestAnimationFrame(() => groupRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      clearDuplicatesFocus();
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicatesFocus]);

  // Default load on mount -- skipped when a focus request already triggers
  // its own (higher-limit) load above, so the two don't race each other.
  useEffect(() => {
    if (duplicatesFocus) return;
    loadDuplicateGroups({ limit: 100, min_group_size: 2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeGroups = tab === 'hash' ? hashGroups : titleGroups;

  const toRecord = (f) => ({
    id: f.id,
    fileName: f.file_name,
    path: f.file_path,
    hash: f.hash,
    size: f.file_size,
    type: f.file_type,
    typeFamily: typeFamilyOf(f.file_type),
    typeColor: typeColorOf(f.file_type),
    source: f.source_name,
    side: f.side_name,
    status: null,
    fileDate: f.file_date,
  });

  if (loading && hashGroups.length === 0 && titleGroups.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-[13px]">Loading duplicate groups…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
        <ShieldAlert size={26} />
        <span className="text-[13px]">{error}</span>
        <button onClick={() => loadDuplicateGroups({ limit: 100, min_group_size: 2 })} className="mt-2 flex items-center gap-1.5 rounded-md bg-surface-800 px-3 py-1.5 text-[12px] text-slate-300 hover:bg-surface-750">
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6 p-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard icon={ShieldAlert} label="Exact-hash duplicate groups" value={totals?.totalHashGroups ?? 0} color="#ef4444" />
        <StatCard icon={CopyLikeIcon} label="Similar-title groups" value={totals?.totalTitleGroups ?? 0} color="#f59e0b" />
        <StatCard icon={Copy} label="Total files involved" value={totals?.totalFiles ?? 0} color="#94a3b8" />
      </div>

      <div className="flex items-center gap-1.5 border-b border-surface-border pb-2">
        <button onClick={() => setTab('hash')} className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${tab === 'hash' ? 'bg-red-500/15 text-red-300' : 'text-slate-400 hover:bg-surface-800'}`}>
          Exact Duplicates (content hash) · {hashGroups.length}
        </button>
        <button onClick={() => setTab('title')} className={`rounded-full px-3 py-1.5 text-[12px] font-medium ${tab === 'title' ? 'bg-amber-500/15 text-amber-300' : 'text-slate-400 hover:bg-surface-800'}`}>
          Similar Titles · {titleGroups.length}
        </button>
      </div>

      {activeGroups.length === 0 && (
        <div className="py-16 text-center text-[13px] text-slate-500">No {tab === 'hash' ? 'exact duplicate' : 'similar-title'} groups found.</div>
      )}

      <div className="space-y-2.5">
        {activeGroups.map((group) => {
          const key = `${group.group_type}-${group.group_id}`;
          const expanded = open[key] ?? false;
          const totalSize = group.files.reduce((s, f) => s + (f.file_size || 0), 0);
          return (
            <div key={key} ref={(el) => (groupRefs.current[key] = el)} className="overflow-hidden rounded-lg border border-surface-border bg-surface-850">
              {/* A real <button> can't legally contain another <button> (the
                  copy-hash action below) -- a div with button semantics avoids
                  the invalid-DOM-nesting/hydration warning while staying
                  keyboard accessible. */}
              <div
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                onClick={() => setOpen((o) => ({ ...o, [key]: !expanded }))}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => ({ ...o, [key]: !expanded })); } }}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-surface-800/50 focus-ring"
              >
                {expanded ? <ChevronDown size={14} className="text-slate-500" /> : <ChevronRight size={14} className="text-slate-500" />}
                <ShieldAlert size={15} className={tab === 'hash' ? 'text-red-400' : 'text-amber-400'} />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold text-slate-200">
                    {tab === 'hash' ? `Group #${group.group_id}` : (group.representative_title || `Group #${group.group_id}`)} · {group.count} matching files
                  </div>
                  {tab === 'hash' ? (
                    <div className="truncate font-mono text-[10.5px] text-slate-500">{group.hash}</div>
                  ) : (
                    <div className="truncate text-[10.5px] text-slate-500">{group.is_identical ? 'Identical titles' : 'Similar titles'}</div>
                  )}
                </div>
                <span className="shrink-0 text-[11.5px] text-slate-500">{formatBytes(totalSize)} total</span>
                {tab === 'hash' && (
                  <button aria-label="Copy content hash" title="Copy content hash" onClick={(e) => { e.stopPropagation(); copyToClipboard(group.hash); toast('Hash copied', { type: 'success' }); }} className="shrink-0 rounded p-1.5 text-slate-500 hover:bg-surface-700 hover:text-slate-200">
                    <Copy size={13} />
                  </button>
                )}
              </div>
              {expanded && (
                <div className="divide-y divide-surface-border/60 border-t border-surface-border">
                  {group.files.map((f) => {
                    const family = typeFamilyOf(f.file_type);
                    const record = toRecord(f);
                    return (
                      <div
                        key={f.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openDetail(f.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(f.id); } }}
                        onContextMenu={(e) => menuRefs.current[f.id]?.openAtEvent(e)}
                        className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-800/40 focus-ring"
                      >
                        <FileTypeIcon family={family} color={typeColorOf(f.file_type)} size={14} />
                        <span className="w-56 shrink-0 truncate text-[12.5px] text-slate-200">{f.file_name}</span>
                        <span className="w-52 shrink-0 truncate font-mono text-[11px] text-slate-500">{f.file_path}</span>
                        <span className="w-32 shrink-0 truncate text-[11.5px] text-slate-400">{f.source_name}</span>
                        <span className="w-24 shrink-0 truncate text-[11px] text-slate-500">{f.side_name}</span>
                        <span className="w-20 shrink-0 font-mono text-[11px] text-slate-500">{formatBytes(f.file_size)}</span>
                        <span className="shrink-0 text-[11px] text-slate-500">{formatDate(f.file_date)}</span>
                        <span className="ml-auto shrink-0">
                          <ActionsMenu ref={(el) => (menuRefs.current[f.id] = el)} record={record} onOpen={() => openDetail(f.id)} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
