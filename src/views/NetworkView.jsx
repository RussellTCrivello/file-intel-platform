import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAppStore } from '../store/useAppStore';
import { useSearchStore } from '../store/useSearchStore';
import { colorForKey } from '../lib/domain';
import FileTypeIcon from '../components/cells/FileTypeIcon';
import { formatDate } from '../lib/format';
import ResearchSearchBar from './network/ResearchSearchBar';
import SearchNetworkGraph from './network/SearchNetworkGraph';
import NetworkDetailPanel from './network/NetworkDetailPanel';

// Four ways to look at the same underlying data, none of them a second
// search/relationship engine: "Sources" is the pre-existing page-level
// Source<->Side graph (unchanged below); "Searches"/"Files"/"Full Network"
// are the new Search Network (spec §16) built entirely from
// `useSearchStore.networkSearches`, i.e. real `/api/search` result sets the
// operator explicitly asked for via the search bar under those three tabs.
const MODES = [
  { id: 'sources', label: 'Sources' },
  { id: 'searches', label: 'Searches' },
  { id: 'files', label: 'Files' },
  { id: 'full', label: 'Full Network' },
];

export default function NetworkView({ rows }) {
  const [mode, setMode] = useState('sources');

  return (
    <div className="flex h-full animate-fade-in flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-1 border-b border-surface-border bg-surface-900 px-3 py-1.5">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-colors focus-ring ${mode === m.id ? 'bg-blue-500/15 text-blue-300' : 'text-slate-400 hover:bg-surface-800 hover:text-slate-200'}`}
          >
            {m.label}
          </button>
        ))}
        <span className="ml-2 text-[10.5px] text-slate-600">
          {mode === 'sources' ? 'Source ↔ Side, current page' : 'Search Network — your added searches'}
        </span>
      </div>

      {mode === 'sources' ? <SourceSideNetwork rows={rows} /> : <SearchNetwork mode={mode} />}
    </div>
  );
}

// ---------------------------------------------------------------------
// Search Network: Searches / Files / Full Network modes (spec §1-§15,17-20)
// ---------------------------------------------------------------------
function SearchNetwork({ mode }) {
  const networkSearches = useSearchStore((s) => s.networkSearches);
  const setQuery = useSearchStore((s) => s.setQuery);
  const setPage = useSearchStore((s) => s.setPage);
  const runQuery = useSearchStore((s) => s.runQuery);
  const setAppMode = useAppStore((s) => s.setAppMode);

  const [selection, setSelection] = useState(null); // {kind:'search'|'connection'|'file'|'source', id|row|label}
  const [expandedSearchIds, setExpandedSearchIds] = useState([]);

  // Reset the on-screen selection whenever the mode changes (a 'source'
  // selection, for instance, makes no sense once you switch to 'searches').
  useEffect(() => { setSelection(null); }, [mode]);

  const selectionKey = !selection ? null
    : selection.kind === 'search' ? `search:${selection.id}`
    : selection.kind === 'file' ? `file:${selection.row.id}`
    : selection.kind === 'source' ? `source:${selection.label}`
    : null;

  // Bridges back into the (already-complete) persistent Search Results
  // Workspace, per spec §17's architecture diagram: the Search Network never
  // becomes its own results viewer, it always hands off to the one that
  // already exists.
  const openResultsFor = (query) => {
    setQuery(query);
    setPage(1);
    runQuery();
    setAppMode('results');
  };

  // Clicking a search node both selects it (for the detail panel) and, in
  // Files/Full mode, expands it in the graph itself (spec §9: "clicking a
  // search node should expand its files"). Selecting it again collapses it.
  const handleSelectSearch = (id) => {
    setSelection({ kind: 'search', id });
    if (mode === 'files' || mode === 'full') {
      setExpandedSearchIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    }
  };

  return (
    <>
      <ResearchSearchBar />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <SearchNetworkGraph
          networkSearches={networkSearches}
          mode={mode}
          expandedSearchIds={expandedSearchIds}
          selectedKey={selectionKey}
          onSelectSearch={handleSelectSearch}
          onSelectConnection={(id) => setSelection({ kind: 'connection', id })}
          onSelectFile={(row) => setSelection({ kind: 'file', row })}
          onSelectSource={(label) => setSelection({ kind: 'source', label })}
        />
        <div className="scrollbar-thin w-80 shrink-0 overflow-y-auto border-l border-surface-border">
          <NetworkDetailPanel
            mode={mode}
            selection={selection}
            expandedSearchIds={expandedSearchIds}
            onSelectConnection={(id) => setSelection({ kind: 'connection', id })}
            onOpenResultsFor={openResultsFor}
          />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------
// Legacy Source <-> Side graph (unchanged behavior, just relocated under the
// new "Sources" tab so it stays the default landing view).
// ---------------------------------------------------------------------
function SourceSideNetwork({ rows }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const openDetail = useAppStore((s) => s.openDetail);
  const query = useSearchStore((s) => s.query);
  const pagination = useSearchStore((s) => s.pagination);

  const totalMatches = pagination?.total ?? rows.length;

  const graph = useMemo(() => {
    const sourceMap = new Map();
    const sideMap = new Map();
    const edgeMap = new Map();

    rows.forEach((r) => {
      if (!r.source || !r.side) return;
      if (!sourceMap.has(r.source)) sourceMap.set(r.source, { id: `src:${r.source}`, type: 'source', label: r.source, count: 0 });
      sourceMap.get(r.source).count++;

      const sideKey = `side:${r.side}`;
      if (!sideMap.has(sideKey)) sideMap.set(sideKey, { id: sideKey, type: 'side', label: r.side, color: colorForKey(r.side), count: 0 });
      sideMap.get(sideKey).count++;

      const edgeKey = `src:${r.source}__${sideKey}`;
      if (!edgeMap.has(edgeKey)) edgeMap.set(edgeKey, { source: `src:${r.source}`, target: sideKey, weight: 0 });
      edgeMap.get(edgeKey).weight++;
    });

    return { nodes: [...sourceMap.values(), ...sideMap.values()], links: [...edgeMap.values()] };
  }, [rows]);

  useEffect(() => {
    if (!svgRef.current || graph.nodes.length === 0) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const nodes = graph.nodes.map((d) => ({ ...d }));
    const links = graph.links.map((d) => ({ ...d }));

    const sizeScale = d3.scaleSqrt().domain([1, d3.max(nodes, (d) => d.count) || 1]).range([8, 34]);

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d) => d.id).distance(90).strength(0.35))
      .force('charge', d3.forceManyBody().strength(-220))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius((d) => sizeScale(d.count) + 14));

    const g = svg.append('g');
    svg.call(d3.zoom().scaleExtent([0.4, 3]).on('zoom', (event) => g.attr('transform', event.transform)));

    const link = g.append('g').selectAll('line').data(links).join('line')
      .attr('stroke', '#334155').attr('stroke-width', (d) => Math.max(1, Math.sqrt(d.weight))).attr('stroke-opacity', 0.5);

    const node = g.append('g').selectAll('g').data(nodes).join('g')
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (event, d) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

    node.append('circle')
      .attr('r', (d) => sizeScale(d.count))
      .attr('fill', (d) => (d.type === 'side' ? d.color || '#3b82f6' : '#1c2434'))
      .attr('stroke', (d) => (d.type === 'side' ? '#0b0e14' : '#3b82f6'))
      .attr('stroke-width', 2);

    node.append('text').text((d) => (d.label.length > 16 ? d.label.slice(0, 14) + '…' : d.label))
      .attr('text-anchor', 'middle').attr('dy', (d) => sizeScale(d.count) + 13)
      .attr('fill', '#cbd5e1').attr('font-size', 10).attr('font-weight', 600).style('pointer-events', 'none');

    node.append('text').text((d) => d.count)
      .attr('text-anchor', 'middle').attr('dy', 4)
      .attr('fill', (d) => (d.type === 'side' ? '#0b0e14' : '#93c5fd'))
      .attr('font-size', 10).attr('font-weight', 700).style('pointer-events', 'none');

    node.on('click', (event, d) => setSelectedNode(d));

    sim.on('tick', () => {
      link.attr('x1', (d) => d.source.x).attr('y1', (d) => d.source.y).attr('x2', (d) => d.target.x).attr('y2', (d) => d.target.y);
      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    return () => sim.stop();
  }, [graph]);

  const relatedFiles = useMemo(() => {
    if (!selectedNode) return [];
    if (selectedNode.type === 'source') return rows.filter((r) => r.source === selectedNode.label);
    return rows.filter((r) => r.side === selectedNode.label);
  }, [selectedNode, rows]);

  return (
    <>
      <div className="flex shrink-0 items-baseline gap-2 border-b border-surface-border px-4 py-2.5">
        <h2 className="text-[13px] font-semibold text-white">
          {totalMatches.toLocaleString()} file{totalMatches === 1 ? '' : 's'} found
          {query?.trim() ? <> for <span className="text-blue-400">“{query}”</span></> : null}
        </h2>
        <span className="text-[11.5px] text-slate-500">
          · graphing {rows.length.toLocaleString()} on this page
          {pagination?.total_pages > 1 ? ` (page ${pagination.page} of ${pagination.total_pages})` : ''}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
      <div ref={containerRef} className="min-w-0 flex-1">
        <svg ref={svgRef} className="h-full w-full" />
      </div>
      <div className="scrollbar-thin w-80 shrink-0 overflow-y-auto border-l border-surface-border p-4">
        <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {selectedNode ? `${selectedNode.type === 'source' ? 'Source' : 'Side'}: ${selectedNode.label}` : 'Network Explorer'}
        </div>
        {!selectedNode && (
          <p className="text-[12.5px] leading-relaxed text-slate-500">
            This graph maps <strong className="text-slate-300">Sources</strong> to the <strong className="text-slate-300">Sides</strong> they contribute files to, built from the current page of results.
            Node size reflects file volume on this page; edge thickness reflects shared file counts. Drag nodes to rearrange, scroll to zoom, click a node to inspect related files.
          </p>
        )}
        {selectedNode && (
          <>
            <div className="mb-3 text-[12.5px] text-slate-400">{relatedFiles.length} related file(s) on this page</div>
            <div className="space-y-1.5">
              {relatedFiles.slice(0, 30).map((r) => (
                <button key={r.id} onClick={() => openDetail(r.id)} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-surface-800">
                  <FileTypeIcon family={r.typeFamily} color={r.typeColor} size={13} />
                  <span className="truncate text-[12px] text-slate-300">{r.fileName}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-slate-600">{formatDate(r.fileDate)}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      </div>
    </>
  );
}
