import { useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import { colorForKey } from '../../lib/domain';
import {
  adaptedRows, pairwiseConnections, bridgeFiles, searchSourceLinks,
} from '../../lib/searchNetwork';

const FILE_EXPAND_CAP = 30; // per expanded search node, graph-readability cap (never a silent cap: the panel always states "+N more")
const BRIDGE_CAP = 24; // max bridge (shared-across-searches) file nodes actually drawn -- on a corpus where broad queries overlap heavily this can otherwise be hundreds of nodes; the authoritative, uncapped list always remains available via the search<->search connection panel and its Export action, so nothing here is a source of truth loss, only a rendering limit.

// Builds the { nodes, links } graph for one of the three Search Network
// modes. Every count here comes straight from the real, already-fetched
// `networkSearches` rows (see useSearchStore._fetchNetworkSearch) -- this
// function only decides which of those real relationships to draw, it never
// invents or re-ranks anything.
// Prioritizes the bridge files shared by the MOST searches (the most
// "interesting" bridges) when there are more real bridges than can be drawn
// legibly; returns { shown, totalCount, hiddenCount } -- never silently
// drops the count itself, only which individual nodes are rendered.
function capBridges(bridges) {
  const sorted = [...bridges].sort((a, b) => b.searchIds.length - a.searchIds.length);
  return { shown: sorted.slice(0, BRIDGE_CAP), totalCount: bridges.length, hiddenCount: Math.max(0, bridges.length - BRIDGE_CAP) };
}

function buildGraph(networkSearches, mode, expandedSearchIds) {
  const nodes = [];
  const links = [];
  const meta = { hiddenBridgeCount: 0, totalBridgeCount: 0 };
  const ready = networkSearches.filter((n) => n.status === 'ready');

  networkSearches.forEach((n) => {
    nodes.push({
      id: n.id, type: 'search', label: n.query, status: n.status,
      count: n.total || 0, matches: n.totalMatches || 0,
    });
  });

  if (mode === 'searches') {
    pairwiseConnections(ready).forEach((c) => {
      links.push({ source: c.aId, target: c.bId, weight: c.shared.length, kind: 'search-search', connId: c.id });
    });
    return { nodes, links };
  }

  if (mode === 'files') {
    const capped = capBridges(bridgeFiles(ready));
    meta.hiddenBridgeCount = capped.hiddenCount;
    meta.totalBridgeCount = capped.totalCount;
    const drawnFileIds = new Set();
    capped.shown.forEach(({ row, searchIds }) => {
      const fid = `file:${row.id}`;
      nodes.push({ id: fid, type: 'file', label: row.fileName, row, bridge: true });
      drawnFileIds.add(row.id);
      searchIds.forEach((sid) => links.push({ source: sid, target: fid, weight: 1, kind: 'search-file' }));
    });
    ready.forEach((n) => {
      if (!expandedSearchIds.includes(n.id)) return;
      const rows = adaptedRows(n).filter((r) => !drawnFileIds.has(r.id));
      rows.slice(0, FILE_EXPAND_CAP).forEach((r) => {
        const fid = `file:${r.id}`;
        nodes.push({ id: fid, type: 'file', label: r.fileName, row: r, bridge: false });
        links.push({ source: n.id, target: fid, weight: 1, kind: 'search-file' });
      });
    });
    return { nodes, links, meta };
  }

  // mode === 'full': search -> source -> file <- search
  const { links: ssLinks, sources } = searchSourceLinks(ready);
  sources.forEach((s) => nodes.push({ id: `source:${s.name}`, type: 'source', label: s.name, count: s.count, color: colorForKey(s.name) }));
  ssLinks.forEach((l) => links.push({ source: l.searchId, target: `source:${l.source}`, weight: l.count, kind: 'search-source' }));
  const capped = capBridges(bridgeFiles(ready));
  meta.hiddenBridgeCount = capped.hiddenCount;
  meta.totalBridgeCount = capped.totalCount;
  capped.shown.forEach(({ row, searchIds }) => {
    const fid = `file:${row.id}`;
    nodes.push({ id: fid, type: 'file', label: row.fileName, row, bridge: true });
    searchIds.forEach((sid) => links.push({ source: sid, target: fid, weight: 1, kind: 'search-file' }));
    if (row.source) links.push({ source: `source:${row.source}`, target: fid, weight: 1, kind: 'source-file' });
  });
  return { nodes, links, meta };
}

const NODE_COLOR = {
  search: '#1c2434',
  source: '#0f172a',
  file: '#111827',
};
const STROKE_COLOR = {
  search: '#3b82f6',
  source: '#22c55e',
  file: '#f97316',
};

export default function SearchNetworkGraph({
  networkSearches, mode, expandedSearchIds, selectedKey,
  onSelectSearch, onSelectConnection, onSelectFile, onSelectSource,
}) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  const graph = useMemo(() => buildGraph(networkSearches, mode, expandedSearchIds), [networkSearches, mode, expandedSearchIds]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;
    const width = containerRef.current.clientWidth || 600;
    const height = containerRef.current.clientHeight || 400;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    if (graph.nodes.length === 0) return undefined;

    const nodes = graph.nodes.map((d) => ({ ...d }));
    const links = graph.links.map((d) => ({ ...d }));

    const searchSize = d3.scaleSqrt().domain([0, d3.max(nodes.filter((n) => n.type === 'search'), (d) => d.count) || 1]).range([26, 52]);
    const sourceSize = d3.scaleSqrt().domain([0, d3.max(nodes.filter((n) => n.type === 'source'), (d) => d.count) || 1]).range([16, 36]);
    const radiusOf = (d) => (d.type === 'search' ? searchSize(d.count) : d.type === 'source' ? sourceSize(d.count) : 8);

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d) => d.id).distance((l) => (l.kind === 'search-file' ? 70 : 130)).strength(0.4))
      .force('charge', d3.forceManyBody().strength((d) => (d.type === 'search' ? -900 : d.type === 'source' ? -400 : -120)))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius((d) => radiusOf(d) + 16));

    const g = svg.append('g');
    svg.call(d3.zoom().scaleExtent([0.3, 3]).on('zoom', (event) => g.attr('transform', event.transform)));

    const link = g.append('g').selectAll('line').data(links).join('line')
      .attr('stroke', (d) => (d.kind === 'search-search' ? '#60a5fa' : '#334155'))
      .attr('stroke-width', (d) => Math.max(1.2, Math.sqrt(d.weight) * (d.kind === 'search-search' ? 1.8 : 1)))
      .attr('stroke-opacity', (d) => (d.kind === 'search-search' ? 0.75 : 0.45));

    // Clickable numeric badges on search<->search links only -- the
    // "shared files" count the spec insists must be explicit, not just a
    // line thickness (see searchNetwork.pairwiseConnections).
    const linkLabels = g.append('g').selectAll('g').data(links.filter((d) => d.kind === 'search-search'))
      .join('g').style('cursor', 'pointer')
      .on('click', (event, d) => { event.stopPropagation(); onSelectConnection?.(d.connId); });
    linkLabels.append('circle').attr('r', 12).attr('fill', '#0b1220').attr('stroke', '#3b82f6').attr('stroke-width', 1.5);
    linkLabels.append('text').text((d) => d.weight).attr('text-anchor', 'middle').attr('dy', 4)
      .attr('fill', '#93c5fd').attr('font-size', 10).attr('font-weight', 700).style('pointer-events', 'none');

    const node = g.append('g').selectAll('g').data(nodes).join('g')
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (event, d) => { if (!event.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => { if (!event.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

    node.append('circle')
      .attr('r', (d) => radiusOf(d))
      .attr('fill', (d) => NODE_COLOR[d.type])
      .attr('stroke', (d) => {
        const isSelected = selectedKey && ((d.type === 'search' && selectedKey === `search:${d.id}`) || (d.type === 'file' && selectedKey === `file:${d.row?.id}`) || (d.type === 'source' && selectedKey === `source:${d.label}`));
        if (isSelected) return '#facc15';
        if (d.type === 'file' && d.bridge) return '#f97316';
        return STROKE_COLOR[d.type];
      })
      .attr('stroke-width', (d) => (d.type === 'file' && d.bridge ? 3 : 2))
      .attr('stroke-dasharray', (d) => (d.status === 'loading' ? '3,2' : null))
      .attr('opacity', (d) => (d.status === 'error' ? 0.4 : 1));

    node.filter((d) => d.type === 'search').append('text').text((d) => d.count)
      .attr('text-anchor', 'middle').attr('dy', -2).attr('fill', '#93c5fd').attr('font-size', 13).attr('font-weight', 700).style('pointer-events', 'none');
    node.filter((d) => d.type === 'search').append('text').text((d) => (d.status === 'loading' ? 'loading…' : d.status === 'error' ? 'failed' : `${d.matches} hits`))
      .attr('text-anchor', 'middle').attr('dy', 12).attr('fill', '#64748b').attr('font-size', 8.5).style('pointer-events', 'none');
    node.filter((d) => d.type === 'source').append('text').text((d) => d.count)
      .attr('text-anchor', 'middle').attr('dy', 4).attr('fill', '#86efac').attr('font-size', 10).attr('font-weight', 700).style('pointer-events', 'none');

    node.append('text').text((d) => (d.label.length > 22 ? `${d.label.slice(0, 20)}…` : d.label))
      .attr('text-anchor', 'middle').attr('dy', (d) => radiusOf(d) + 13)
      .attr('fill', (d) => (d.type === 'search' ? '#e2e8f0' : d.bridge ? '#fdba74' : '#94a3b8'))
      .attr('font-size', (d) => (d.type === 'search' ? 11.5 : 9.5)).attr('font-weight', (d) => (d.type === 'search' ? 700 : 500))
      .style('pointer-events', 'none');

    node.on('click', (event, d) => {
      event.stopPropagation();
      if (d.type === 'search') onSelectSearch?.(d.id);
      else if (d.type === 'file') onSelectFile?.(d.row);
      else if (d.type === 'source') onSelectSource?.(d.label);
    });

    sim.on('tick', () => {
      link.attr('x1', (d) => d.source.x).attr('y1', (d) => d.source.y).attr('x2', (d) => d.target.x).attr('y2', (d) => d.target.y);
      linkLabels.attr('transform', (d) => `translate(${(d.source.x + d.target.x) / 2},${(d.source.y + d.target.y) / 2})`);
      node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    });

    return () => sim.stop();
  }, [graph, selectedKey, onSelectSearch, onSelectConnection, onSelectFile, onSelectSource]);

  if (graph.nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[12.5px] text-slate-500">
        Add a search above to build the network.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full min-w-0 flex-1">
      {graph.meta?.hiddenBridgeCount > 0 && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-md border border-amber-500/30 bg-surface-950/90 px-2.5 py-1.5 text-[10.5px] text-amber-300 shadow-lg">
          Showing {BRIDGE_CAP} of {graph.meta.totalBridgeCount} shared files (graph-readability limit) — open a search↔search connection in the panel for the complete, exportable list.
        </div>
      )}
      <svg ref={svgRef} className="h-full w-full" />
    </div>
  );
}
