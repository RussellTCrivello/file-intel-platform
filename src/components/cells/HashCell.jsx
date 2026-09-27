import { useState } from 'react';
import { Copy, Check, ShieldAlert, ShieldQuestion } from 'lucide-react';

export default function HashCell({ hash, duplicateCount = 0 }) {
  const [copied, setCopied] = useState(false);
  if (!hash) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-500/90">
        <ShieldQuestion size={13} /> Missing
      </span>
    );
  }
  const short = `${hash.slice(0, 8).toUpperCase()}…${hash.slice(-4).toUpperCase()}`;
  return (
    <div className="group flex items-center gap-1.5">
      <span className="font-mono text-[12px] text-slate-300" title={hash}>{short}</span>
      {duplicateCount > 1 && (
        <span title={`${duplicateCount} files share this hash`} className="inline-flex items-center gap-0.5 rounded bg-red-500/10 px-1 py-0.5 text-[10px] font-semibold text-red-400">
          <ShieldAlert size={10} /> {duplicateCount}
        </span>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(hash); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
        className="hidden rounded p-0.5 text-slate-500 hover:bg-surface-700 hover:text-slate-200 group-hover:inline-flex focus-ring"
        title="Copy hash"
      >
        {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
      </button>
    </div>
  );
}
