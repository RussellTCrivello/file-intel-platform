import { useState } from 'react';
import { Copy, Info, Check } from 'lucide-react';
import { truncatePath, copyToClipboard } from '../../lib/format';

// `path` is only known once `/api/file/<id>/details` has been fetched (it is
// deliberately not part of the `/api/search` list payload). Until then this
// renders an honest placeholder instead of a fabricated value.
export default function PathCell({ path, onInspect }) {
  const [copied, setCopied] = useState(false);
  if (!path) {
    return (
      <button onClick={() => onInspect && onInspect()} className="text-[11px] text-slate-600 hover:text-blue-400 focus-ring rounded">
        Open details to load path…
      </button>
    );
  }
  return (
    <div className="group flex min-w-0 items-center gap-1.5">
      <span className="truncate font-mono text-[12px] text-slate-400" title={path}>
        {truncatePath(path)}
      </span>
      <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
        <button
          title="Copy path"
          onClick={(e) => { e.stopPropagation(); copyToClipboard(path); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
          className="rounded p-1 text-slate-500 hover:bg-surface-700 hover:text-slate-200 focus-ring"
        >
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
        </button>
        <button
          title="View full details"
          onClick={(e) => { e.stopPropagation(); onInspect && onInspect(); }}
          className="rounded p-1 text-slate-500 hover:bg-surface-700 hover:text-slate-200 focus-ring"
        >
          <Info size={12} />
        </button>
      </span>
    </div>
  );
}
