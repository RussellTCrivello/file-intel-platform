import { useEffect, useMemo, useState } from 'react';
import { Tags, Plus, Pencil, Trash2, Search, FolderOpen, ArrowRight, X, Check, Loader2 } from 'lucide-react';
import { useSearchStore } from '../store/useSearchStore';
import { useAppStore } from '../store/useAppStore';
import { formatRelative } from '../lib/format';
import CreateCategoryDialog from '../components/CreateCategoryDialog';
import { toast } from '../components/ui/Toast';

const SWATCHES = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#14b8a6', '#eab308', '#ef4444', '#06b6d4', '#8b5cf6'];

// The "Analyst Categories Manager" (spec §5): explorer + detail + full CRUD
// against AnalystCategoryService.{list,create,update,delete}_category, plus
// a per-category assignment browser via list_assignments(category_id=...)
// and a "search within category" jump back into the main result surface.
export default function CategoryManagerView() {
  const categories = useSearchStore((s) => s.facetAnalystCategories);
  const loadFacets = useSearchStore((s) => s.loadFacets);
  const updateAnalystCategory = useSearchStore((s) => s.updateAnalystCategory);
  const deleteAnalystCategory = useSearchStore((s) => s.deleteAnalystCategory);
  const assignments = useSearchStore((s) => s.analystAssignments);
  const assignmentsTotal = useSearchStore((s) => s.analystAssignmentsTotal);
  const assignmentsLoading = useSearchStore((s) => s.analystAssignmentsLoading);
  const loadAssignments = useSearchStore((s) => s.loadAnalystAssignments);
  const setAnalystScope = useSearchStore((s) => s.setAnalystScope);
  const setFilters = useSearchStore((s) => s.setFilters);
  const runQuery = useSearchStore((s) => s.runQuery);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const setAppMode = useAppStore((s) => s.setAppMode);

  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null); // { name, description, color }
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fileFilter, setFileFilter] = useState('');

  useEffect(() => { loadFacets(); }, [loadFacets]);

  const filtered = useMemo(
    () => categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())),
    [categories, search]
  );

  const selected = categories.find((c) => c.id === selectedId) || null;

  useEffect(() => {
    if (selectedId != null) {
      loadAssignments({ categoryId: selectedId, fileQuery: fileFilter || undefined, perPage: 50 });
    }
  }, [selectedId, fileFilter, loadAssignments]);

  const startEdit = () => {
    if (!selected) return;
    setEditing({ name: selected.name, description: selected.description || '', color: selected.color || SWATCHES[0] });
  };

  const saveEdit = async () => {
    if (!selected || !editing) return;
    setSaving(true);
    try {
      await updateAnalystCategory(selected.id, editing);
      toast('Category updated', { type: 'success' });
      setEditing(null);
    } catch (e) {
      toast(e.body?.error || e.message || 'Failed to update category', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await deleteAnalystCategory(selected.id);
      toast(`Category "${selected.name}" deleted; files returned to uncategorized`, { type: 'success' });
      setSelectedId(null);
      setConfirmDelete(false);
    } catch (e) {
      toast(e.body?.error || e.message || 'Failed to delete category', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const searchWithinCategory = () => {
    if (!selected) return;
    setAppMode('explorer');
    setAnalystScope('all');
    setFilters({ analystCategoryIds: [selected.id] });
    setViewMode('table');
    runQuery();
  };

  return (
    <div className="flex h-full">
      <div className="flex w-80 shrink-0 flex-col border-r border-surface-border bg-surface-900">
        <div className="border-b border-surface-border p-3">
          <h2 className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-white"><Tags size={14} className="text-blue-400" /> Analyst Categories</h2>
          <div className="relative mb-2">
            <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter categories…" className="w-full rounded-md border border-surface-border bg-surface-850 py-1.5 pl-6 pr-2 text-[12px] text-slate-200 focus-ring" />
          </div>
          <button onClick={() => setCreateOpen(true)} className="flex w-full items-center justify-center gap-1.5 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1.5 text-[12px] font-semibold text-blue-300 hover:bg-blue-500/20">
            <Plus size={13} /> New Category
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-[12px] text-slate-500">{categories.length === 0 ? 'No analyst categories yet.' : 'No categories match your filter.'}</div>
          ) : (
            filtered.map((c) => (
              <button key={c.id} onClick={() => { setSelectedId(c.id); setEditing(null); setConfirmDelete(false); }} className={`flex w-full items-center gap-2 border-b border-surface-border/40 px-3 py-2.5 text-left hover:bg-surface-800 ${selectedId === c.id ? 'bg-surface-800' : ''}`}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color || '#3b82f6' }} />
                <span className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-medium text-slate-200">{c.name}</div>
                  <div className="text-[11px] text-slate-500">{c.file_count} file{c.file_count === 1 ? '' : 's'}</div>
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
        {!selected ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-slate-500">
            <Tags size={28} className="opacity-50" />
            <p className="text-[13px]">Select a category to view details, or create a new one.</p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="h-8 w-8 shrink-0 rounded-full" style={{ backgroundColor: selected.color || '#3b82f6' }} />
                <div>
                  <h1 className="text-[17px] font-bold text-white">{selected.name}</h1>
                  <p className="text-[12px] text-slate-500">{selected.description || 'No description'}</p>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button onClick={startEdit} className="flex items-center gap-1 rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] text-slate-300 hover:bg-surface-800"><Pencil size={12} /> Edit</button>
                <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1 rounded-md border border-red-500/30 px-2.5 py-1.5 text-[12px] text-red-300 hover:bg-red-500/10"><Trash2 size={12} /> Delete</button>
              </div>
            </div>

            {editing && (
              <div className="rounded-xl border border-blue-500/30 bg-blue-500/[0.04] p-4 space-y-3">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Name</label>
                  <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="w-full rounded-md border border-surface-border bg-surface-900 px-2.5 py-2 text-[12.5px] text-slate-200 focus-ring" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Description</label>
                  <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} className="w-full resize-none rounded-md border border-surface-border bg-surface-900 px-2.5 py-2 text-[12.5px] text-slate-200 focus-ring" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Color</label>
                  <div className="flex flex-wrap gap-1.5">
                    {SWATCHES.map((sw) => (
                      <button key={sw} onClick={() => setEditing({ ...editing, color: sw })} className={`h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-surface-850 ${editing.color === sw ? 'ring-white' : 'ring-transparent'}`} style={{ backgroundColor: sw }} />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-500 disabled:opacity-60">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Save
                  </button>
                  <button onClick={() => setEditing(null)} className="flex items-center gap-1.5 rounded-md border border-surface-border px-3 py-1.5 text-[12px] text-slate-300 hover:bg-surface-800"><X size={13} /> Cancel</button>
                </div>
              </div>
            )}

            {confirmDelete && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/[0.05] p-4">
                <p className="mb-2 text-[12.5px] text-red-200">Delete "{selected.name}"? This removes it from {selected.file_count} file{selected.file_count === 1 ? '' : 's'} (files themselves are untouched — they simply become uncategorized). This cannot be undone.</p>
                <div className="flex gap-2">
                  <button onClick={doDelete} disabled={saving} className="rounded-md bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-red-500 disabled:opacity-60">Confirm Delete</button>
                  <button onClick={() => setConfirmDelete(false)} className="rounded-md border border-surface-border px-3 py-1.5 text-[12px] text-slate-300 hover:bg-surface-800">Cancel</button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-surface-border bg-surface-850 p-3">
                <div className="text-[11px] uppercase tracking-wider text-slate-500">Files Assigned</div>
                <div className="text-[18px] font-bold text-white">{selected.file_count}</div>
              </div>
              <div className="rounded-xl border border-surface-border bg-surface-850 p-3">
                <div className="text-[11px] uppercase tracking-wider text-slate-500">Last Assigned</div>
                <div className="text-[13px] font-semibold text-slate-300">{selected.last_assigned_at ? formatRelative(selected.last_assigned_at) : '—'}</div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-wider text-slate-400"><FolderOpen size={13} /> Assigned Files</h3>
                <button onClick={searchWithinCategory} className="flex items-center gap-1 text-[11.5px] font-semibold text-blue-400 hover:text-blue-300">
                  Search within category <ArrowRight size={12} />
                </button>
              </div>
              <div className="relative mb-2">
                <Search size={12} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
                <input value={fileFilter} onChange={(e) => setFileFilter(e.target.value)} placeholder="Filter assigned files by name/path…" className="w-full rounded-md border border-surface-border bg-surface-900 py-1.5 pl-6 pr-2 text-[12px] text-slate-200 focus-ring" />
              </div>
              <div className="rounded-xl border border-surface-border bg-surface-850">
                {assignmentsLoading ? (
                  <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-slate-500" /></div>
                ) : assignments.length === 0 ? (
                  <div className="p-6 text-center text-[12px] text-slate-500">No files assigned to this category yet.</div>
                ) : (
                  <div className="max-h-96 divide-y divide-surface-border/40 overflow-y-auto scrollbar-thin">
                    {assignments.map((a) => (
                      <div key={a.id} className="px-3 py-2 text-[12px]">
                        <div className="truncate font-medium text-slate-200" title={a.file_path}>{a.file_name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                          <span>by {a.assigned_by_username}</span>
                          <span>·</span>
                          <span>{formatRelative(a.assigned_at)}</span>
                          {a.source_query && (<><span>·</span><span className="truncate">from "{a.source_query}"</span></>)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {assignmentsTotal > assignments.length && (
                  <div className="border-t border-surface-border/40 px-3 py-1.5 text-center text-[11px] text-slate-500">Showing {assignments.length} of {assignmentsTotal}</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {createOpen && (
        <CreateCategoryDialog onClose={() => setCreateOpen(false)} onCreated={(data) => { loadFacets(); setSelectedId(data?.category_id ?? null); }} />
      )}
    </div>
  );
}
