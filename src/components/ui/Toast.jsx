import { create } from 'zustand';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

export const useToastStore = create((set) => ({
  toasts: [],
  push: (toast) => set((s) => {
    const id = Date.now() + Math.random();
    setTimeout(() => set((s2) => ({ toasts: s2.toasts.filter((t) => t.id !== id) })), 3200);
    return { toasts: [...s.toasts, { id, ...toast }] };
  }),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function toast(message, opts = {}) {
  useToastStore.getState().push({ message, type: opts.type || 'info' });
}

const ICONS = { success: CheckCircle2, info: Info, warning: AlertTriangle };
const COLORS = { success: '#22c55e', info: '#3b82f6', warning: '#f59e0b' };

export default function ToastHost() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[400] flex flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICONS[t.type] || Info;
        return (
          <div key={t.id} className="pointer-events-auto flex animate-fade-in items-center gap-2.5 rounded-lg border border-surface-border bg-surface-800 px-3.5 py-2.5 shadow-xl shadow-black/40 min-w-[260px]">
            <Icon size={16} style={{ color: COLORS[t.type] }} className="shrink-0" />
            <span className="flex-1 text-[13px] text-slate-200">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="text-slate-500 hover:text-slate-300"><X size={13} /></button>
          </div>
        );
      })}
    </div>
  );
}
