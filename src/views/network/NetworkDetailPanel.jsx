import { useMemo, useRef, useState } from 'react';
import { Download, ExternalLink, Trash2, CheckCircle2, XCircle, Clock, Network as NetworkIcon } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useSearchStore } from '../../store/useSearchStore';
import ActionsMenu from '../../components/cells/ActionsMenu';
import FileTypeIcon from '../../components/cells/FileTypeIcon';
import UniversalExportDialog from '../../components/export/UniversalExportDialog';
import {
  searchStats, pairwiseConnections, membershipOf, adaptedRows,
} from '../../lib/searchNetwork';

// The context-sensitive right-hand panel for every Search Network mode
// (spec §7/§11/§12/§13). It never invents a capability: opening a file goes
// through the same `openDetail` -> RecordDetail drawer as everywhere else,
// exporting goes through the same `UniversalExportDialog`, and every file
// row carries the real, existing `ActionsMenu` (preview, export, locate,
// classify, duplicates/similar, compare...) exactly like the Results
// workspace and Format Browser do.
export default function NetworkDetailPanel({ mode, selection, expandedSearchIds = [], onSelectConnection, onOpenResultsFor }) {
  const networkSearches = useSearchStore((s) => s.networkSearches);
  const removeNetworkSearch = useSearchStore((s) => s.removeNetworkSearch);
  const openDetail = useAppStore((s) => s.openDetail);
  const [exportConfig, setExportConfig] = useState(null); // { fileIds, title }
  const menuRefs = useRef({});

  const selectedSearch = selection?.kind === 'search' ? networkSearches.find((n) => n.id === selection.id) : null;
  const connection = selection?.kind === 'connection'
    ? pairwiseConnections(networkSearches).find((c) => c.id === selection.id)
    : null;

  const stats = useMemo(() => (selectedSearch ? searchStats(selectedSearch) : null), [selectedSearch]);
  const connectedTo = useMemo(() => {
    if (!selectedSearch) return [];
    return pairwiseConnections(networkSearches).filter((c) => c.aId === selectedSearch.id || c.bId === selectedSearch.id);
  }, [selectedSearch, networkSearches]);

  if (!selection) {
    return (
      <div className="p-4 text-[12.5px] leading-relaxed text-slate-500">
        <p className="mb-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-600"><NetworkIcon size={12} /> Search Network</p>
        {mode === 'searches' && <p>Every node is a search you added above; its size and count reflect its real file total. A connection appears whenever two searches share at least one file — click the number on a connection to see exactly which files.</p>}
        {mode === 'files' && <p>Orange-ringed nodes are files that appear in more than one search — the bridges between your searches. Click a search node to expand its remaining files (capped for readability; the panel always tells you how many more exist).</p>}
        {mode === 'full' && <p>Search → Source → File, combined. Source nodes are real `source_name` values from the database; file nodes shown here are the bridge files shared across searches.</p>}
        <p className="mt-3">Click any node to inspect it here.</p>
      </div>
    );
  }

  if (selectedSearch) {
    return (
      <div className="flex h-full flex-col overflow-y-auto scrollbar-thin p-4">
        <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-600">Search</div>
        <div className="mb-3 text-[15px] font-bold text-white">{selectedSearch.query}</div>

        {selectedSearch.status === 'loading' && <div className="text-[12px] text-slate-500">Fetching real results…</div>}
        {selectedSearch.status === 'error' && <div className="text-[12px] text-red-400">Search failed: {selectedSearch.error}</div>}

        {stats && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2">
              <StatBox label="Files" value={stats.files} />
              <StatBox label="Matches" value={stats.matches} />
              <StatBox label="Sources" value={stats.sources.length} />
              <StatBox label="Sides" value={stats.sides.length} />
            </div>
            {stats.files > 0 && stats.matches === 0 && (
              <div className="mb-3 text-[10.5px] text-slate-600">
                No per-line match count was returned for these results (the server only computes it for content/full-text hits, not filename/fuzzy-only matches) — the file count above is still real.
              </div>
            )}
            {(mode === 'files' || mode === 'full') && (
              <div className="mb-3 text-[10.5px] text-slate-500">
                {expandedSearchIds.includes(selectedSearch.id)
                  ? 'Expanded in graph — click this node again to collapse its individual files.'
                  : 'Click this node in the graph to expand its individual files (bridge files shared with other searches are always shown).'}
              </div>
            )}
            {stats.truncated && (
              <div className="mb-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10.5px] text-amber-300">
                Only the first {stats.fetchedCount.toLocaleString()} matches were fetched for network analysis (safety cap); file/match totals above are still the real server totals.
              </div>
            )}

            {stats.sources.length > 0 && (
              <div className="mb-4">
                <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-600">Sources</div>
                <div className="space-y-1">
                  {stats.sources.slice(0, 6).map((s) => (
                    <div key={s.name} className="flex items-center justify-between text-[12px] text-slate-300">
                      <span className="truncate">{s.name}</span><span className="text-slate-500">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-600">Connections ({connectedTo.length})</div>
              {connectedTo.length === 0 && <div className="text-[12px] text-slate-600">No shared files with other current searches.</div>}
              <div className="space-y-1">
                {connectedTo.map((c) => {
                  const other = c.aId === selectedSearch.id ? c.bQuery : c.aQuery;
                  return (
                    <button key={c.id} onClick={() => onSelectConnection(c.id)} className="flex w-full items-center justify-between rounded-md border border-surface-border px-2 py-1.5 text-left text-[12px] text-slate-300 hover:border-blue-500/50 hover:bg-blue-500/5">
                      <span className="truncate">↔ {other}</span>
                      <span className="shrink-0 rounded bg-blue-500/15 px-1.5 py-0.5 font-semibold text-blue-300">{c.shared.length} shared</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-auto flex flex-col gap-1.5 border-t border-surface-border pt-3">
              <button onClick={() => onOpenResultsFor(selectedSearch.query)} className="flex items-center justify-center gap-1.5 rounded-md border border-surface-border px-2 py-1.5 text-[11.5px] font-medium text-slate-300 hover:bg-surface-800">
                <ExternalLink size={12} /> Open Results
              </button>
              <button onClick={() => setExportConfig({ fileIds: selectedSearch.rows.map((r) => r.id), title: `Export “${selectedSearch.query}” results` })} className="flex items-center justify-center gap-1.5 rounded-md border border-surface-border px-2 py-1.5 text-[11.5px] font-medium text-slate-300 hover:bg-surface-800">
                <Download size={12} /> Export
              </button>
              <button onClick={() => removeNetworkSearch(selectedSearch.id)} className="flex items-center justify-center gap-1.5 rounded-md border border-red-500/30 px-2 py-1.5 text-[11.5px] font-medium text-red-400 hover:bg-red-500/10">
                <Trash2 size={12} /> Remove from research (keeps history)
              </button>
            </div>
          </>
        )}
        {exportConfig && <UniversalExportDialog mode="selection" fileIds={exportConfig.fileIds} title={exportConfig.title} onClose={() => setExportConfig(null)} />}
      </div>
    );
  }

  if (connection) {
    return (
      <div className="flex h-full flex-col overflow-y-auto scrollbar-thin p-4">
        <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-600">Search Relationship</div>
        <div className="mb-3 text-[14px] font-bold text-white">{connection.aQuery} <span className="text-blue-400">↔</span> {connection.bQuery}</div>
        <div className="mb-3 rounded-md border border-blue-500/30 bg-blue-500/10 px-2.5 py-1.5 text-[12.5px] font-semibold text-blue-300">
          {connection.shared.length} shared file{connection.shared.length === 1 ? '' : 's'}
        </div>
        <button onClick={() => setExportConfig({ fileIds: connection.shared.map((r) => r.id), title: `Export shared files (${connection.aQuery} ↔ ${connection.bQuery})` })} className="mb-3 flex items-center justify-center gap-1.5 rounded-md border border-surface-border px-2 py-1.5 text-[11.5px] font-medium text-slate-300 hover:bg-surface-800">
          <Download size={12} /> Export {connection.shared.length} shared files
        </button>
        <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-slate-600">Files</div>
        <div className="space-y-1">
          {connection.shared.map((r) => (
            <div key={r.id} className="flex items-center gap-1.5 rounded-md px-1.5 py-1.5 hover:bg-surface-800">
              <FileTypeIcon family={r.typeFamily} color={r.typeColor} size={13} />
              <button onClick={() => openDetail(r.id)} className="min-w-0 flex-1 truncate text-left text-[12px] text-slate-300 hover:text-blue-300">{r.fileName}</button>
              <span className="shrink-0 text-[10px] text-slate-600">{r.source}</span>
              <ActionsMenu ref={(el) => (menuRefs.current[r.id] = el)} record={r} onOpen={() => openDetail(r.id)} />
            </div>
          ))}
        </div>
        {exportConfig && <UniversalExportDialog mode="selection" fileIds={exportConfig.fileIds} title={exportConfig.title} onClose={() => setExportConfig(null)} />}
      </div>
    );
  }

  if (selection.kind === 'file') {
    const row = selection.row;
    const memberIds = membershipOf(row.id, networkSearches);
    return (
      <div className="flex h-full flex-col overflow-y-auto scrollbar-thin p-4">
        <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-600">File</div>
        <div className="mb-1 flex items-center gap-1.5">
          <FileTypeIcon family={row.typeFamily} color={row.typeColor} size={15} />
          <span className="truncate text-[13.5px] font-semibold text-white">{row.fileName}</span>
        </div>
        <div className="mb-3 text-[11.5px] text-slate-500">{row.source} · {row.side}</div>
        <div className="mb-2 flex items-center gap-1.5">
          <ActionsMenu ref={(el) => (menuRefs.current[row.id] = el)} record={row} onOpen={() => openDetail(row.id)} />
          <button onClick={() => openDetail(row.id)} className="flex-1 rounded-md border border-surface-border px-2 py-1.5 text-[11.5px] font-medium text-slate-300 hover:bg-surface-800">Open Record Detail</button>
        </div>
        <div className="mb-1.5 mt-3 text-[10.5px] font-semibold uppercase tracking-wider text-slate-600">Appears in ({memberIds.length} of {networkSearches.length})</div>
        <div className="space-y-1">
          {networkSearches.map((n) => {
            const isMember = memberIds.includes(n.id);
            return (
              <div key={n.id} className="flex items-center gap-1.5 text-[12px]">
                {n.status !== 'ready' ? <Clock size={13} className="shrink-0 text-slate-600" />
                  : isMember ? <CheckCircle2 size={13} className="shrink-0 text-emerald-400" /> : <XCircle size={13} className="shrink-0 text-slate-700" />}
                <span className={isMember ? 'text-slate-200' : 'text-slate-600'}>{n.query}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (selection.kind === 'source') {
    const rows = networkSearches.filter((n) => n.status === 'ready').flatMap((n) => adaptedRows(n).map((r) => ({ ...r, __search: n.query })))
      .filter((r) => r.source === selection.label)
      .filter((r, i, arr) => arr.findIndex((x) => x.id === r.id) === i);
    return (
      <div className="flex h-full flex-col overflow-y-auto scrollbar-thin p-4">
        <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-slate-600">Source</div>
        <div className="mb-3 text-[15px] font-bold text-white">{selection.label}</div>
        <div className="mb-3 text-[12px] text-slate-500">{rows.length} unique file{rows.length === 1 ? '' : 's'} across your current searches</div>
        <div className="space-y-1">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-1.5 rounded-md px-1.5 py-1.5 hover:bg-surface-800">
              <FileTypeIcon family={r.typeFamily} color={r.typeColor} size={13} />
              <button onClick={() => openDetail(r.id)} className="min-w-0 flex-1 truncate text-left text-[12px] text-slate-300 hover:text-blue-300">{r.fileName}</button>
              <ActionsMenu ref={(el) => (menuRefs.current[r.id] = el)} record={r} onOpen={() => openDetail(r.id)} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

function StatBox({ label, value }) {
  return (
    <div className="rounded-md border border-surface-border bg-surface-800/60 px-2.5 py-2">
      <div className="text-[16px] font-bold text-white">{(value ?? 0).toLocaleString()}</div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}
