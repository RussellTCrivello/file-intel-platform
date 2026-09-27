import { useState } from 'react';
import { Plus, X, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { useSearchStore } from '../../store/useSearchStore';

// "CURRENT RESEARCH" bar (spec §13/§20): the list of named searches making
// up this session's Search Network. Purely a thin/removable front-end list
// over `useSearchStore.networkSearches` -- adding or removing an entry here
// never writes to or deletes anything in the database, and is completely
// independent of the separate, server-persisted `searchHistory` /
// `savedSearches` features used elsewhere in the app.
export default function ResearchSearchBar() {
  const networkSearches = useSearchStore((s) => s.networkSearches);
  const addNetworkSearch = useSearchStore((s) => s.addNetworkSearch);
  const removeNetworkSearch = useSearchStore((s) => s.removeNetworkSearch);
  const globalQuery = useSearchStore((s) => s.query);
  const [draft, setDraft] = useState('');

  const submit = () => {
    if (!draft.trim()) return;
    addNetworkSearch(draft);
    setDraft('');
  };

  const alreadyHasGlobalQuery = globalQuery?.trim() && networkSearches.some((n) => n.query.toLowerCase() === globalQuery.trim().toLowerCase());

  return (
    <div className="border-b border-surface-border px-4 py-2.5">
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="Add a search to the network (e.g. Accounts)…"
          className="w-72 rounded-md border border-surface-border bg-surface-800 px-2.5 py-1.5 text-[12.5px] text-slate-200 placeholder:text-slate-600 focus-ring"
        />
        <button
          onClick={submit}
          disabled={!draft.trim()}
          className="flex items-center gap-1 rounded-md border border-blue-500/40 bg-blue-500/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-blue-300 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={12} /> Add Search
        </button>
        {globalQuery?.trim() && !alreadyHasGlobalQuery && (
          <button
            onClick={() => addNetworkSearch(globalQuery)}
            title="Add the query currently active in the Search Results Workspace"
            className="flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
          >
            <Sparkles size={12} /> Add current search (“{globalQuery.trim()}”)
          </button>
        )}
      </div>

      {networkSearches.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-600">Current research:</span>
          {networkSearches.map((n) => (
            <span key={n.id} className="flex items-center gap-1.5 rounded-full border border-surface-border bg-surface-800 py-1 pl-2.5 pr-1.5 text-[11.5px] text-slate-300">
              {n.status === 'loading' && <Loader2 size={11} className="animate-spin text-slate-500" />}
              {n.status === 'error' && <AlertCircle size={11} className="text-red-400" />}
              <span className="font-medium">{n.query}</span>
              {n.status === 'ready' && <span className="text-slate-500">· {n.total.toLocaleString()} file{n.total === 1 ? '' : 's'}</span>}
              {n.status === 'error' && <span className="text-red-400">· {n.error}</span>}
              <button onClick={() => removeNetworkSearch(n.id)} title="Remove from this research session (does not delete search history)" className="rounded p-0.5 text-slate-500 hover:bg-surface-700 hover:text-white">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
