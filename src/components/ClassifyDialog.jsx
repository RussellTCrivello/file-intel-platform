import { useState } from 'react';
import { Tags, Plus, Check, Loader2, AlertTriangle } from 'lucide-react';
import Modal from './ui/Modal';
import { useSearchStore } from '../store/useSearchStore';
import { toast } from './ui/Toast';

const SWATCHES = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#14b8a6', '#eab308', '#ef4444', '#06b6d4', '#8b5cf6'];

// The Classify workflow (spec §4/§6/§7): works identically for one file or a
// batch of hundreds, always shows the real backend result (requested /
// assigned / already_assigned) rather than an invented success count, and
// records the query that surfaced the files as `source_query` for the
// audit trail -- exactly what AnalystCategoryService.assign() expects.
export default function ClassifyDialog({ fileIds, sourceQuery, onClose, onAssigned }) {
  const facetAnalystCategories = useSearchStore((s) => s.facetAnalystCategories);
  const classifyAssign = useSearchStore((s) => s.classifyAssign);

  const [mode, setMode] = useState('existing'); // 'existing' | 'create'
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newColor, setNewColor] = useState(SWATCHES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const count = fileIds.length;

  const submit = async () => {
    setError(null);
    if (mode === 'existing' && !selectedCategoryId) {
      setError('Select a category to assign.');
      return;
    }
    if (mode === 'create' && !newName.trim()) {
      setError('Category name is required.');
      return;
    }
    setSubmitting(true);
    try {
      const data = await classifyAssign({
        pathIds: fileIds,
        categoryId: mode === 'existing' ? selectedCategoryId : undefined,
        categoryName: mode === 'create' ? newName.trim() : undefined,
        createCategory: mode === 'create',
        sourceQuery: sourceQuery || undefined,
      });
      setResult(data);
      toast(`Assigned "${data.category_name}" to ${data.assigned} of ${data.requested} file(s)`, { type: 'success' });
      onAssigned?.(data);
    } catch (e) {
      setError(e.body?.error || e.message || 'Failed to assign category');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Classify" width={480}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 rounded-md border border-surface-border bg-surface-900 px-3 py-2 text-[12.5px] text-slate-300">
          <Tags size={14} className="text-blue-400" />
          <span className="font-semibold text-white">{count}</span> file{count === 1 ? '' : 's'} selected
          {sourceQuery && <span className="ml-auto truncate text-[11px] text-slate-500" title={sourceQuery}>from “{sourceQuery}”</span>}
        </div>

        {result ? (
          <div className="space-y-3">
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-[12.5px] text-emerald-200">
              <div className="mb-1 flex items-center gap-1.5 font-semibold"><Check size={14} /> Assigned to “{result.category_name}”</div>
              <div className="grid grid-cols-3 gap-2 text-center text-[11.5px]">
                <div><div className="text-[15px] font-bold text-white">{result.requested}</div>Requested</div>
                <div><div className="text-[15px] font-bold text-emerald-300">{result.assigned}</div>Newly assigned</div>
                <div><div className="text-[15px] font-bold text-slate-400">{result.already_assigned}</div>Already assigned</div>
              </div>
            </div>
            <button onClick={onClose} className="w-full rounded-md bg-blue-600 px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-blue-500">Done</button>
          </div>
        ) : (
          <>
            <div className="flex rounded-md border border-surface-border bg-surface-900 p-0.5 text-[12px]">
              <button
                onClick={() => setMode('existing')}
                className={`flex-1 rounded px-2 py-1.5 font-medium transition-colors ${mode === 'existing' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Select Existing Category
              </button>
              <button
                onClick={() => setMode('create')}
                className={`flex-1 rounded px-2 py-1.5 font-medium transition-colors ${mode === 'create' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Create New Category
              </button>
            </div>

            {mode === 'existing' ? (
              facetAnalystCategories.length === 0 ? (
                <div className="rounded-md border border-dashed border-surface-border p-4 text-center text-[12px] text-slate-500">
                  No analyst categories exist yet. Switch to “Create New Category” to make the first one.
                </div>
              ) : (
                <div className="scrollbar-thin max-h-56 space-y-1 overflow-y-auto rounded-md border border-surface-border bg-surface-900 p-1.5">
                  {facetAnalystCategories.map((c) => (
                    <label
                      key={c.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-2 text-[12.5px] transition-colors ${selectedCategoryId === c.id ? 'border-blue-500/60 bg-blue-500/10' : 'border-transparent hover:bg-surface-800'}`}
                    >
                      <input type="radio" name="analyst-category" checked={selectedCategoryId === c.id} onChange={() => setSelectedCategoryId(c.id)} className="accent-blue-500" />
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color || '#3b82f6' }} />
                      <span className="min-w-0 flex-1">
                        <div className="truncate font-medium text-slate-200">{c.name}</div>
                        {c.description && <div className="truncate text-[11px] text-slate-500">{c.description}</div>}
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-500">{c.file_count} file{c.file_count === 1 ? '' : 's'}</span>
                    </label>
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-2.5">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Name</label>
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Financial Intelligence" className="w-full rounded-md border border-surface-border bg-surface-900 px-2.5 py-2 text-[12.5px] text-slate-200 focus-ring" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Description</label>
                  <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={2} placeholder="What does this category represent?" className="w-full resize-none rounded-md border border-surface-border bg-surface-900 px-2.5 py-2 text-[12.5px] text-slate-200 focus-ring" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Color</label>
                  <div className="flex flex-wrap gap-1.5">
                    {SWATCHES.map((sw) => (
                      <button key={sw} onClick={() => setNewColor(sw)} className={`h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-surface-850 ${newColor === sw ? 'ring-white' : 'ring-transparent'}`} style={{ backgroundColor: sw }} aria-label={`Choose color ${sw}`} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-1.5 rounded-md bg-red-500/10 px-2.5 py-2 text-[11.5px] text-red-300">
                <AlertTriangle size={13} /> {error}
              </div>
            )}

            <button
              onClick={submit}
              disabled={submitting}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : (mode === 'create' ? <Plus size={14} /> : <Check size={14} />)}
              {mode === 'create' ? 'Create & Assign' : `Assign to ${count} file${count === 1 ? '' : 's'}`}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
