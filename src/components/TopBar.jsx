import { useState, useRef, useEffect } from 'react';
import { Search, Command, Bookmark, ChevronDown, Download, Settings2, Shield, X, Clock, PanelLeft, Lock, LogOut, RefreshCw, Trash2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useSearchStore } from '../store/useSearchStore';
import DropdownMenu, { MenuItem, MenuSeparator, MenuLabel } from './ui/DropdownMenu';
import UniversalExportDialog from './export/UniversalExportDialog';
import { toast } from './ui/Toast';

export default function TopBar() {
  const query = useSearchStore((s) => s.query);
  const setQuery = useSearchStore((s) => s.setQuery);
  const runQuery = useSearchStore((s) => s.runQuery);
  const suggestions = useSearchStore((s) => s.suggestions);
  const fetchSuggestions = useSearchStore((s) => s.fetchSuggestions);
  const clearSuggestions = useSearchStore((s) => s.clearSuggestions);
  const searchHistory = useSearchStore((s) => s.searchHistory);
  const savedSearches = useSearchStore((s) => s.savedSearches);
  const applySavedSearch = useSearchStore((s) => s.applySavedSearch);
  const saveCurrentSearch = useSearchStore((s) => s.saveCurrentSearch);
  const updateSavedSearch = useSearchStore((s) => s.updateSavedSearch);
  const deleteSavedSearch = useSearchStore((s) => s.deleteSavedSearch);
  const dashboardStats = useSearchStore((s) => s.dashboardStats);
  const currentUser = useSearchStore((s) => s.currentUser);
  const logout = useSearchStore((s) => s.logout);

  const appMode = useAppStore((s) => s.appMode);
  const setAppMode = useAppStore((s) => s.setAppMode);
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const pagination = useSearchStore((s) => s.pagination);
  const activeFilterCount = useSearchStore((s) => s.activeFilterCount());

  const [showSuggest, setShowSuggest] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCommandPaletteOpen(true); }
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); inputRef.current?.focus(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setCommandPaletteOpen]);

  const commit = () => {
    runQuery();
    setAppMode('results');
    setShowSuggest(false);
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-surface-border bg-surface-900/80 px-4 backdrop-blur">
      <div className="flex items-center gap-2 pr-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-950/50">
          <Shield size={16} className="text-white" strokeWidth={2.5} />
        </div>
        <div className="leading-tight">
          <div className="text-[13.5px] font-bold tracking-tight text-white">SYLTHARAE</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">File Intelligence</div>
        </div>
      </div>

      <div
        className="hidden items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10.5px] font-medium text-emerald-300 lg:flex"
        title="This workspace only queries, filters, and presents existing records from the live SYLTHARAE database. It cannot create, edit, or delete data."
      >
        <Lock size={10} />
        Read-Only · {(dashboardStats?.totalDocs ?? 0).toLocaleString()} records indexed
      </div>

      <button
        onClick={toggleSidebar}
        title={sidebarOpen ? 'Hide explorer sidebar' : 'Show explorer sidebar'}
        className={`rounded-md border p-1.5 focus-ring ${sidebarOpen ? 'border-blue-500/50 bg-blue-500/10 text-blue-400' : 'border-surface-border bg-surface-800 text-slate-400 hover:text-slate-200'}`}
      >
        <PanelLeft size={15} />
      </button>

      <div className="mx-2 h-6 w-px bg-surface-border" />

      <DropdownMenu
        width={280}
        trigger={
          <button className="flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-800 px-2.5 py-1.5 text-[12.5px] font-medium text-slate-200 hover:border-slate-600 focus-ring">
            <Bookmark size={13} className="text-blue-400" />
            Saved Searches
            <ChevronDown size={13} className="text-slate-500" />
          </button>
        }
      >
        {({ close }) => (
          <>
            <MenuLabel>Saved Searches (server-stored)</MenuLabel>
            {savedSearches.length === 0 && <div className="px-3 py-2 text-[11.5px] text-slate-500">None saved yet</div>}
            {savedSearches.map((v) => (
              <div key={v.id} className="group flex items-center gap-1 px-1">
                <button
                  role="menuitem"
                  onClick={() => { applySavedSearch(v.id); setAppMode('results'); close(); }}
                  className="min-w-0 flex-1 truncate rounded px-2 py-1.5 text-left text-[13px] text-slate-300 hover:bg-surface-700 hover:text-white"
                  title={`Run saved search "${v.name}"`}
                >
                  {v.name} — &quot;{v.query || '(no text query)'}&quot;
                </button>
                <button
                  aria-label={`Update "${v.name}" with the current query and filters`}
                  title="Overwrite with current query & filters"
                  onClick={async () => { await updateSavedSearch(v.id); toast(`"${v.name}" updated`, { type: 'success' }); }}
                  className="shrink-0 rounded p-1 text-slate-500 opacity-0 hover:bg-surface-600 hover:text-blue-300 focus-ring group-hover:opacity-100"
                >
                  <RefreshCw size={12} />
                </button>
                <button
                  aria-label={`Delete saved search "${v.name}"`}
                  title="Delete saved search"
                  onClick={async () => { await deleteSavedSearch(v.id); toast(`"${v.name}" deleted`, { type: 'info' }); }}
                  className="shrink-0 rounded p-1 text-slate-500 opacity-0 hover:bg-red-500/10 hover:text-red-400 focus-ring group-hover:opacity-100"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <MenuSeparator />
            <div className="px-3 py-1.5">
              <SaveSearchInline onSave={saveCurrentSearch} onDone={close} />
            </div>
          </>
        )}
      </DropdownMenu>

      <div className="relative flex-1 max-w-xl">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); if (e.target.value.trim().length >= 2) fetchSuggestions(e.target.value); else clearSuggestions(); }}
            onFocus={() => setShowSuggest(true)}
            onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
            onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
            placeholder='Search files & content… supports "exact phrase", AND / OR / NOT'
            aria-label="Search files and content"
            role="combobox"
            aria-expanded={showSuggest}
            aria-autocomplete="list"
            className="w-full rounded-md border border-surface-border bg-surface-800 py-1.5 pl-8 pr-16 text-[13px] text-slate-200 placeholder:text-slate-500 focus-ring focus:border-blue-500/60"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
            {query && (
              <button aria-label="Clear search" onClick={() => { setQuery(''); clearSuggestions(); }} className="rounded p-0.5 text-slate-500 hover:text-slate-300"><X size={13} /></button>
            )}
            <span className="kbd">Enter</span>
          </div>
        </div>
        {showSuggest && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 animate-fade-in rounded-md border border-surface-border bg-surface-800 py-1 shadow-xl">
            {query.trim().length >= 2 && suggestions.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Autocomplete</div>
                {suggestions.slice(0, 6).map((s, i) => (
                  <button key={i} onMouseDown={() => { setQuery(s.text || s); commit(); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-slate-300 hover:bg-surface-700">
                    <Search size={12} className="text-slate-500" /> {s.text || s}
                  </button>
                ))}
              </>
            )}
            {!query && searchHistory.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Recent Searches</div>
                {searchHistory.slice(0, 6).map((h) => (
                  <button key={h.id} onMouseDown={() => { setQuery(h.query); commit(); }} className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px] text-slate-300 hover:bg-surface-700">
                    <Clock size={12} className="text-slate-500" /> {h.query} <span className="ml-auto text-[10.5px] text-slate-600">{h.result_count} results</span>
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {appMode === 'results' ? (
        <button
          onClick={() => setAppMode('explorer')}
          className="flex items-center gap-1.5 rounded-md border border-blue-500/40 bg-blue-500/10 px-2.5 py-1.5 text-[12px] font-semibold text-blue-300 hover:bg-blue-500/20 focus-ring"
        >
          ← Back to Explorer
        </button>
      ) : ((query && query.trim()) || activeFilterCount > 0 || pagination) && (
        // A committed query/filter set stays "resumable": if a per-record
        // action routed the operator away from the persistent split view
        // (View Duplicates/Similar -> Api's own `appMode: 'explorer'`
        // switch, or a manual trip through the Explorer/Format Browser),
        // this is the one, always-visible way back into the SAME result
        // set -- no re-typing, no re-running a different query, no second
        // "results" concept. See SearchResultsPage's persistence contract.
        <button
          onClick={() => setAppMode('results')}
          title="Return to the persistent search results / document viewer workspace"
          className="flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-[12px] font-semibold text-emerald-300 hover:bg-emerald-500/20 focus-ring"
        >
          Search Workspace{pagination ? ` (${pagination.total.toLocaleString()})` : ''} →
        </button>
      )}

      <button
        onClick={() => setCommandPaletteOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-800 px-2.5 py-1.5 text-[12px] text-slate-400 hover:border-slate-600 hover:text-slate-200 focus-ring"
      >
        <Command size={13} /> Palette <span className="kbd">⌘K</span>
      </button>

      <button
        onClick={() => setExportOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-800 px-2.5 py-1.5 text-[12px] font-medium text-slate-300 hover:border-slate-600 hover:text-white focus-ring"
      >
        <Download size={13} /> Export
      </button>

      <DropdownMenu
        width={200}
        trigger={
          <button className="flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-800 px-2.5 py-1.5 text-[12px] text-slate-300 hover:border-slate-600 focus-ring">
            <Settings2 size={14} /> {currentUser?.username || 'Account'}
          </button>
        }
      >
        {({ close }) => (
          <MenuItem icon={LogOut} label="Sign out" onClick={() => { logout(); close(); }} />
        )}
      </DropdownMenu>

      {exportOpen && <UniversalExportDialog mode="query" onClose={() => setExportOpen(false)} />}
    </header>
  );
}

function SaveSearchInline({ onSave, onDone }) {
  const [name, setName] = useState('');
  return (
    <div className="flex items-center gap-1.5">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Save current search as…"
        className="w-full rounded border border-surface-border bg-surface-900 px-2 py-1 text-[12px] text-slate-200 focus-ring"
        onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) { onSave(name.trim()).then(onDone); setName(''); toast('Search saved', { type: 'success' }); } }}
      />
      <button
        onClick={() => { if (name.trim()) { onSave(name.trim()).then(onDone); setName(''); toast('Search saved', { type: 'success' }); } }}
        className="shrink-0 rounded bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-500"
      >
        Save
      </button>
    </div>
  );
}
