import { useEffect, useState } from 'react';
import { GitBranch } from 'lucide-react';
import { fileAnalysis as fileAnalysisApi } from '../../lib/sylthaeApi';
import Breadcrumb from './Breadcrumb';
import EntityList from './EntityList';
import FacetFileList from './FacetFileList';

// Relations: content (a single hash) that shows up under 2+ DISTINCT
// (source, side) pairs -- per spec, same source+same side is NOT a
// relation (that's an ordinary duplicate), only shown when at least one of
// source/side differs. See Api/routes/file_analysis.py `fa_relations` for
// the exact (strict) definition and docs/DATABASE.md for why
// `hash_contexts` makes that check exact rather than approximate.
function RelationCard({ relation, onOpen }) {
  return (
    <button
      onClick={onOpen}
      className="flex flex-col gap-2 rounded-lg border border-surface-border bg-surface-900 p-3 text-left transition-colors hover:border-blue-500/50 hover:bg-surface-850 focus-ring"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[12px] font-semibold text-slate-100">
          <GitBranch size={13} className="text-blue-400" /> {relation.hash_short}…
        </span>
        <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-blue-300">{relation.file_count} files</span>
      </div>
      <div className="flex flex-col gap-1">
        {relation.contexts.map((c, i) => (
          <div key={i} className="flex items-center justify-between rounded bg-surface-800/70 px-2 py-1 text-[11px]">
            <span className="truncate text-slate-300">{c.source_name} <span className="text-slate-600">/</span> {c.side_name}</span>
            <span className="shrink-0 font-semibold text-slate-400">{c.file_count}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

export default function RelationsBrowser({ onHome }) {
  const [relation, setRelation] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    if (relation) return;
    let alive = true;
    setLoading(true);
    setError(null);
    fileAnalysisApi.relations({ page, per_page: 20 })
      .then((d) => { if (!alive) return; setItems(d.data || []); setPagination(d.pagination); })
      .catch((e) => { if (!alive) return; setError(e.message || 'Failed to load relations'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [relation, page]);

  const crumbs = [{ label: 'Relations', onClick: relation ? () => setRelation(null) : null }];
  if (relation) crumbs.push({ label: `${relation.hash_short}…` });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-surface-border bg-surface-900">
        <Breadcrumb crumbs={crumbs} onHome={onHome} />
        {!relation && (
          <p className="px-4 pb-2.5 text-[11.5px] text-slate-500">
            Content that shows up under two or more different source/side combinations -- e.g. the same document filed by both parties, or under a different custodian. Copies under the exact same source and side are ordinary duplicates, not relations, and are excluded.
          </p>
        )}
      </div>

      {!relation && (
        <EntityList
          items={items} loading={loading} error={error}
          pagination={pagination} onPageChange={setPage}
          emptyTitle="No cross-source/side relations found"
          emptyHint="No piece of content in this dataset currently appears under more than one distinct (source, side) combination."
          renderItem={(r) => <RelationCard key={r.id} relation={r} onOpen={() => setRelation(r)} />}
        />
      )}

      {relation && (
        <FacetFileList facet="relation" id={relation.id} label={`${relation.hash_short}…`} />
      )}
    </div>
  );
}
