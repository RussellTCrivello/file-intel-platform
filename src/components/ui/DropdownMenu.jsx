import { useEffect, useRef, useState, cloneElement } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';

export default function DropdownMenu({ trigger, children, align = 'end', width = 220 }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (menuRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const handleEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', handleEsc);
    return () => { document.removeEventListener('mousedown', handle); document.removeEventListener('keydown', handleEsc); };
  }, [open]);

  const openMenu = () => {
    const rect = triggerRef.current.getBoundingClientRect();
    const top = rect.bottom + 6;
    let left = align === 'end' ? rect.right - width : rect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    setCoords({ top, left });
    setOpen((o) => !o);
  };

  return (
    <>
      <span ref={triggerRef} onClick={openMenu} className="inline-flex">
        {trigger}
      </span>
      {open && createPortal(
        <div
          ref={menuRef}
          style={{ top: coords.top, left: coords.left, width }}
          className="fixed z-[200] animate-fade-in overflow-hidden rounded-lg border border-surface-border bg-surface-800 py-1 shadow-2xl shadow-black/50"
          role="menu"
        >
          {typeof children === 'function' ? children({ close: () => setOpen(false) }) : children}
        </div>,
        document.body
      )}
    </>
  );
}

export function MenuItem({ icon: Icon, label, onClick, danger = false, shortcut, disabled = false }) {
  return (
    <button
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[13px] transition-colors',
        disabled ? 'cursor-not-allowed text-slate-600' : danger ? 'text-red-400 hover:bg-red-500/10' : 'text-slate-300 hover:bg-surface-700 hover:text-white'
      )}
    >
      {Icon && <Icon size={14} className="shrink-0" />}
      <span className="flex-1 truncate">{label}</span>
      {shortcut && <span className="kbd">{shortcut}</span>}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="my-1 h-px bg-surface-border" />;
}

export function MenuLabel({ children }) {
  return <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{children}</div>;
}
