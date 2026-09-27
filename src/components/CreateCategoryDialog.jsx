import { useState } from 'react';
import { Plus, Loader2, AlertTriangle } from 'lucide-react';
import Modal from './ui/Modal';
import { useSearchStore } from '../store/useSearchStore';
import { toast } from './ui/Toast';

const SWATCHES = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#14b8a6', '#eab308', '#ef4444', '#06b6d4', '#8b5cf6'];

// Standalone category creation (Category Manager §8) -- distinct from
// ClassifyDialog's "create at assignment" shortcut (§7): this one calls
// POST /api/analyst/categories directly with no file selection required.
export default function CreateCategoryDialog({ onClose, onCreated }) {
  const createAnalystCategory = useSearchStore((s) => s.createAnalystCategory);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(SWATCHES[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!name.trim()) { setError('Category name is required.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const data = await createAnalystCategory(name.trim(), description.trim() || null, color);
      toast(`Analyst category "${name.trim()}" created`, { type: 'success' });
      onCreated?.(data);
      onClose();
    } catch (e) {
      setError(e.body?.error || e.message || 'Failed to create category');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} title="Create Analyst Category" width={420}>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Strategic Infrastructure" className="w-full rounded-md border border-surface-border bg-surface-900 px-2.5 py-2 text-[12.5px] text-slate-200 focus-ring" autoFocus />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What does this category represent?" className="w-full resize-none rounded-md border border-surface-border bg-surface-900 px-2.5 py-2 text-[12.5px] text-slate-200 focus-ring" />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Color</label>
          <div className="flex flex-wrap gap-1.5">
            {SWATCHES.map((sw) => (
              <button key={sw} onClick={() => setColor(sw)} className={`h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-surface-850 ${color === sw ? 'ring-white' : 'ring-transparent'}`} style={{ backgroundColor: sw }} aria-label={`Choose color ${sw}`} />
            ))}
          </div>
        </div>
        {error && (
          <div className="flex items-center gap-1.5 rounded-md bg-red-500/10 px-2.5 py-2 text-[11.5px] text-red-300">
            <AlertTriangle size={13} /> {error}
          </div>
        )}
        <button onClick={submit} disabled={submitting} className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-[12.5px] font-semibold text-white hover:bg-blue-500 disabled:opacity-60">
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Create Category
        </button>
      </div>
    </Modal>
  );
}
