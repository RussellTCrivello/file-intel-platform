// Pure computation for the Search Network (Network Explorer -> Searches /
// Files / Full modes). Every function here only reads the real result rows
// already fetched by `useSearchStore.networkSearches` (each one a complete,
// server-answered `/api/search` result set) and derives relationships from
// authoritative record identity (`id`, the `paths` primary key) -- never
// from filenames, and never by re-querying or re-ranking anything. No
// fabricated data, no client-side full-corpus scan: the inputs are exactly
// as large as the searches the operator chose to add.
import { adaptSearchResult } from './domain';

/** One network search's rows, adapted to the same flat shape every other
 *  view reads (id, fileName, source, side, type, size, lineMatchCount...). */
export function adaptedRows(networkSearch) {
  return (networkSearch.rows || []).map(adaptSearchResult);
}

/** id -> adapted row, for O(1) lookups when computing overlaps. */
function idIndex(rows) {
  const m = new Map();
  rows.forEach((r) => m.set(r.id, r));
  return m;
}

/** Real set intersection of two searches' file ids -> the shared adapted rows. */
export function sharedFiles(a, b) {
  const bIds = new Set((b.rows || []).map((r) => r.id));
  return adaptedRows(a).filter((r) => bIds.has(r.id));
}

/** Every search a given file id belongs to, across the whole research set --
 *  answers "File 42 appears in: Accounts, Shipment, Contracts". */
export function membershipOf(fileId, networkSearches) {
  return networkSearches
    .filter((n) => n.status === 'ready' && (n.rows || []).some((r) => r.id === fileId))
    .map((n) => n.id);
}

/** Per-search real aggregate stats: files / matches / distinct sources /
 *  distinct sides -- the exact metrics the spec insists must never be
 *  conflated (files != matches != sources != sides). */
export function searchStats(networkSearch) {
  const rows = adaptedRows(networkSearch);
  const sources = new Map();
  const sides = new Map();
  rows.forEach((r) => {
    if (r.source) sources.set(r.source, (sources.get(r.source) || 0) + 1);
    if (r.side) sides.set(r.side, (sides.get(r.side) || 0) + 1);
  });
  return {
    files: networkSearch.total ?? rows.length,
    matches: networkSearch.totalMatches ?? 0,
    sources: [...sources.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    sides: [...sides.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    fetchedCount: rows.length,
    truncated: !!networkSearch.truncated,
  };
}

/** All pairwise search<->search connections with a non-zero shared-file
 *  count, sorted strongest-first. Each connection carries the real shared
 *  row list (not just a number) so a click never has to re-derive it. */
export function pairwiseConnections(networkSearches) {
  const ready = networkSearches.filter((n) => n.status === 'ready');
  const out = [];
  for (let i = 0; i < ready.length; i += 1) {
    for (let j = i + 1; j < ready.length; j += 1) {
      const a = ready[i];
      const b = ready[j];
      const shared = sharedFiles(a, b);
      if (shared.length > 0) {
        out.push({ id: `${a.id}__${b.id}`, aId: a.id, bId: b.id, aQuery: a.query, bQuery: b.query, shared });
      }
    }
  }
  return out.sort((x, y) => y.shared.length - x.shared.length);
}

/** Files shared by 2+ searches (the "bridge" files that visually connect
 *  search nodes in Files/Full mode) plus how many total unique files sit
 *  behind each search node (used for the "N more not shown" honesty note). */
export function bridgeFiles(networkSearches) {
  const ready = networkSearches.filter((n) => n.status === 'ready');
  const owners = new Map(); // fileId -> Set(searchId)
  const rowById = new Map();
  ready.forEach((n) => {
    adaptedRows(n).forEach((r) => {
      rowById.set(r.id, r);
      if (!owners.has(r.id)) owners.set(r.id, new Set());
      owners.get(r.id).add(n.id);
    });
  });
  const bridges = [];
  owners.forEach((searchIds, fileId) => {
    if (searchIds.size >= 2) bridges.push({ row: rowById.get(fileId), searchIds: [...searchIds] });
  });
  return bridges;
}

/** Source-node aggregation across ALL ready searches, for Full/Sources
 *  network modes. Each search<->source LINK weight is that one search's own
 *  real file-from-that-source count (spec §5/§12: "Accounts -> Finance, 14
 *  files" is specific to the Accounts search). The source NODE's total is
 *  the deduplicated count of unique files from that source across the union
 *  of every added search -- summing the per-search counts would double
 *  count any file that appears in more than one search, which is exactly
 *  the "never label one metric as another" mistake the spec (§19) warns
 *  against. */
export function searchSourceLinks(networkSearches) {
  const ready = networkSearches.filter((n) => n.status === 'ready');
  const links = []; // { searchId, source, count }
  const sourceFileIds = new Map(); // source -> Set(fileId), for the true deduplicated total
  ready.forEach((n) => {
    const bySource = new Map();
    adaptedRows(n).forEach((r) => {
      if (!r.source) return;
      bySource.set(r.source, (bySource.get(r.source) || 0) + 1);
      if (!sourceFileIds.has(r.source)) sourceFileIds.set(r.source, new Set());
      sourceFileIds.get(r.source).add(r.id);
    });
    bySource.forEach((count, source) => {
      links.push({ searchId: n.id, source, count });
    });
  });
  return { links, sources: [...sourceFileIds.entries()].map(([name, ids]) => ({ name, count: ids.size })) };
}
