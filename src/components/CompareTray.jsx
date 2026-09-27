import { GitCompare, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import FileTypeIcon from './cells/FileTypeIcon';

// Reads only `compareMeta`, the tiny id -> {fileName, typeFamily, typeColor}
// cache captured from the real record the user was looking at when they
// clicked "Add to compare" (see useAppStore.addToCompare) -- there is no
// synthetic in-memory "all files" dataset to look ids up in anymore.
export default function CompareTray() {
  const compareIds = useAppStore((s) => s.compareIds);
  const compareOpen = useAppStore((s) => s.compareOpen);
  const compareMeta = useAppStore((s) => s.compareMeta);
  const removeFromCompare = useAppStore((s) => s.removeFromCompare);
  const clearCompare = useAppStore((s) => s.clearCompare);
  const setCompareOpen = useAppStore((s) => s.setCompareOpen);

  if (compareIds.length === 0 || compareOpen) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 left-5 z-[140]">
      <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-surface-border bg-surface-800/95 px-3 py-2 shadow-2xl shadow-black/50 backdrop-blur animate-fade-in">
        <GitCompare size={15} className="text-blue-400" />
        <div className="flex items-center gap-1.5">
          {compareIds.map((id) => {
            const meta = compareMeta[id];
            const label = meta?.fileName || `File #${id}`;
            return (
              <span key={id} title={label} className="flex items-center gap-1 rounded-full bg-surface-700 px-2 py-1 text-[11px] text-slate-200">
                <FileTypeIcon family={meta?.typeFamily || 'Document'} color={meta?.typeColor || '#64748b'} size={11} />
                {label.length > 16 ? label.slice(0, 14) + '…' : label}
                <button onClick={() => removeFromCompare(id)} className="text-slate-400 hover:text-red-400"><X size={10} /></button>
              </span>
            );
          })}
        </div>
        <button
          disabled={compareIds.length < 2}
          onClick={() => setCompareOpen(true)}
          className="rounded-md bg-blue-600 px-2.5 py-1 text-[11.5px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40 hover:bg-blue-500"
        >
          Compare ({compareIds.length})
        </button>
        <button onClick={clearCompare} className="rounded p-1 text-slate-500 hover:text-slate-200"><X size={13} /></button>
      </div>
    </div>
  );
}
