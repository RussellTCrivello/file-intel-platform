import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export default function Modal({ onClose, title, children, width = 460 }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{ width }}
        className="max-h-[85vh] overflow-y-auto rounded-xl border border-surface-border bg-surface-850 shadow-2xl shadow-black/60"
      >
        <div className="flex items-center justify-between border-b border-surface-border px-5 py-3.5">
          <h2 className="text-[14px] font-semibold text-slate-800">{title}</h2>
          <button onClick={onClose} aria-label="Close dialog" className="rounded p-1 text-slate-500 hover:bg-surface-700 hover:text-slate-200 focus-ring">
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
