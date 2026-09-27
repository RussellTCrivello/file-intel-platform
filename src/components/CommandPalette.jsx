import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, ArrowRight, Bookmark } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useSearchStore } from '../store/useSearchStore';
import { VIEW_MODES } from '../lib/viewModes';
import { analytics as analyticsApi } from '../lib/sylthaeApi';
import { typeFamilyOf, typeColorOf } from '../lib/domain';
import FileTypeIcon from './cells/FileTypeIcon';

// Quick-navigate command palette. Views/saved-searches/density are real,
// existing client or server state; the "jump to a file" results come from
// the real `/api/analytics/search-files` name/path lookup (debounced),
// never from a synthetic in-memory file list.
export default function CommandPalette() {
  const open = useAppStore((s) => s.commandPaletteOpen);
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const setAppMode = useAppStore((s) => s.setAppMode);
  const setDensity = useAppStore((s) => s.setDensity);
  const openDetail = useAppStore((s) => s.openDetail);

  const savedSearches = useSearchStore((s) => s.savedSearches);
  const applySavedSearch = useSearchStore((s) => s.applySavedSearch);
  const resetFilters = useSearchStore((s) => s.resetFilters);
  const setQuery = useSearchStore((s) => s.setQuery);
  const runQuery = useSearchStore((s) => s.runQuery);

  const [query, setLocalQuery] = useState('');
  const [idx, setIdx] = useState(0);
  const [fileResults, setFileResults] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => { if (open) { setLocalQuery(''); setIdx(0); setFileResults([]); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) { setFileResults([]); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      analyticsApi.searchFiles(q, { limit: 6 }).then((res) => {
        if (!cancelled) setFileResults(res.files || []);
      }).catch(() => { if (!cancelled) setFileResults([]); });
    }, 220);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  const staticCommands = useMemo(() => [
    ...VIEW_MODES.map((v) => ({ id: `view-${v.id}`, label: `Go to ${v.label} view`, group: 'Navigate', action: () => { setAppMode('explorer'); setViewMode(v.id); }, icon: v.icon })),
    ...savedSearches.map((v) => ({ id: `sv-${v.id}`, label: `Apply saved search: ${v.name}`, group: 'Saved Searches', action: () => { applySavedSearch(v.id); setAppMode('results'); }, icon: Bookmark })),
    { id: 'clear-filters', label: 'Clear all filters & search', group: 'Actions', action: () => { resetFilters(); setQuery(''); runQuery(); } },
    { id: 'density-compact', label: 'Set density: Compact', group: 'Actions', action: () => setDensity('compact') },
    { id: 'density-comfortable', label: 'Set density: Comfortable', group: 'Actions', action: () => setDensity('comfortable') },
    { id: 'density-expanded', label: 'Set density: Expanded', group: 'Actions', action: () => setDensity('expanded') },
  ], [savedSearches]);

  const fileMatches = useMemo(() => fileResults.map((f) => ({
    id: `file-${f.id}`,
    label: f.name,
    sub: `${f.source} · ${f.side}`,
    group: 'Files',
    action: () => openDetail(f.id),
    record: { typeFamily: typeFamilyOf(f.type), typeColor: typeColorOf(f.type) },
  })), [fileResults]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return staticCommands.slice(0, 8);
    const q = query.toLowerCase();
    return staticCommands.filter((c) => c.label.toLowerCase().includes(q));
  }, [query, staticCommands]);

  const all = [...fileMatches, ...filteredCommands];

  useEffect(() => {
    const handler = (e) => {
      if (!open) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(all.length - 1, i + 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
      if (e.key === 'Enter') { e.preventDefault(); all[idx]?.action?.(); setOpen(false); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, all, idx]);

  if (!open) return null;

  let lastGroup = null;

  return createPortal(
    <div className="fixed inset-0 z-[350] flex items-start justify-center bg-black/60 pt-[12vh] backdrop-blur-sm animate-fade-in" onMouseDown={() => setOpen(false)}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-lg overflow-hidden rounded-xl border border-surface-border bg-surface-850 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-surface-border px-4 py-3">
          <Search size={15} className="text-slate-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setLocalQuery(e.target.value); setIdx(0); }}
            placeholder="Type a command or jump to a file by name…"
            className="flex-1 bg-transparent text-[13.5px] text-slate-200 outline-none placeholder:text-slate-500"
          />
          <span className="kbd">ESC</span>
        </div>
        <div className="max-h-80 overflow-y-auto py-1.5">
          {all.length === 0 && <div className="px-4 py-6 text-center text-[12.5px] text-slate-500">No matches found</div>}
          {all.map((c, i) => {
            const showGroup = c.group !== lastGroup;
            lastGroup = c.group;
            return (
              <div key={c.id}>
                {showGroup && <div className="px-4 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">{c.group}</div>}
                <button
                  onMouseEnter={() => setIdx(i)}
                  onClick={() => { c.action(); setOpen(false); }}
                  className={`flex w-full items-center gap-2.5 px-4 py-2 text-left text-[13px] ${i === idx ? 'bg-blue-500/10 text-white' : 'text-slate-300'}`}
                >
                  {c.record ? <FileTypeIcon family={c.record.typeFamily} color={c.record.typeColor} size={14} /> : c.icon ? <c.icon size={14} className="text-slate-500" /> : <ArrowRight size={12} className="text-slate-600" />}
                  <span className="min-w-0 flex-1 truncate">{c.label}</span>
                  {c.sub && <span className="truncate text-[10.5px] text-slate-600">{c.sub}</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}
