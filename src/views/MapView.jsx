import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, useMap, useMapEvents } from 'react-leaflet';
import { MapPinOff, Loader2, RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { geo } from '../lib/sylthaeApi';
import { formatBytes, formatDate } from '../lib/format';
import { typeFamilyOf, typeColorOf } from '../lib/domain';
import FileTypeIcon from '../components/cells/FileTypeIcon';
import { LayerStateProvider } from '../components/map/layers.jsx';
import OfflineBasemap from '../components/map/OfflineBasemap';
import DataLayers from '../components/map/DataLayers';
import LayerSwitcher from '../components/map/LayerSwitcher';
import MapSearch from '../components/map/MapSearch';
import CoordinateReadout from '../components/map/CoordinateReadout';
import { MapNavigationControl, MapTypeControl } from '../components/map/MapControls';

// This view has geotagged files but no place-mention gazetteer, so the
// switcher doesn't offer a "Place mentions" toggle that could only ever be
// empty. Clusters and the density surface are available because they are
// derived from the same file points.
const MAP_VIEW_LAYERS = [
  'ocean', 'land', 'countries', 'borders', 'labels', 'graticule',
  'files', 'clusters', 'heat',
];

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) { map.setView([points[0].latitude, points[0].longitude], 6); return; }
    map.fitBounds(points.map((p) => [p.latitude, p.longitude]), { padding: [40, 40] });
  }, [points, map]);
  return null;
}

// Reads the real, existing `/api/archives/geolocation` endpoint
// (Api/routes/archives_api.py), which surfaces `paths.coordinates` -- the
// only source of geodata in the schema. Independent of the current
// search/filter page: geolocation is its own real dataset, paginated by
// the API's own cursor, not derived from `useSearchStore.results`.
function TrackCentre({ onCentre }) {
  useMapEvents({ moveend: (e) => { const c = e.target.getCenter(); onCentre({ lat: c.lat, lng: c.lng }); } });
  return null;
}

export default function MapView() {
  const openDetail = useAppStore((s) => s.openDetail);
  const [points, setPoints] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);
  const [basemap, setBasemap] = useState('standard');
  const [tileStatus, setTileStatus] = useState('loading');
  const [areaIds, setAreaIds] = useState(null);
  const mounted = useRef(true);

  const load = async () => {
    setStatus('loading');
    setError(null);
    try {
      let cursor;
      let all = [];
      let totalEstimated = 0;
      // Walk the cursor a bounded number of times so the map stays a quick,
      // read-only view rather than an unbounded full-table scan.
      for (let page = 0; page < 20; page++) {
        const res = await geo.list({ cursor, limit: 200 });
        all = all.concat(res.data || []);
        totalEstimated = res.total_estimated ?? totalEstimated;
        if (!res.has_next || !res.next_cursor) break;
        cursor = res.next_cursor;
      }
      if (!mounted.current) return;
      setPoints(all);
      setTotal(totalEstimated);
      setAreaIds(null);
      setStatus('ready');
    } catch (e) {
      if (!mounted.current) return;
      setError(e.message || 'Failed to load geolocation data');
      setStatus('error');
    }
  };

  useEffect(() => { mounted.current = true; load(); return () => { mounted.current = false; }; }, []);

  const center = useMemo(() => [20, 0], []);

  // The view centre, for the readout. Read straight off the map rather than
  // tracked in state, so it is always the position Leaflet actually has.
  const [viewCentre, setViewCentre] = useState(null);
  const trackCentre = useCallback((c) => setViewCentre(c), []);

  // Normalise the API rows into the shape the imperative marker layers take.
  // Popups are built lazily (a function, not a node) because only one is open
  // at a time and each one is rendered through a single shared React root.
  const allMarkers = useMemo(() => points.map((p) => {
    const family = typeFamilyOf(p.file_type);
    const color = typeColorOf(p.file_type);
    return {
      id: p.id,
      lat: p.latitude,
      lng: p.longitude,
      color,
      weight: 1,
      popup: () => (
        <div className="flex min-w-[180px] flex-col gap-1 text-[12px]">
          <div className="flex items-center gap-1.5 font-semibold">
            <FileTypeIcon family={family} color={color} size={13} /> {p.file_name}
          </div>
          <div className="text-slate-600">{p.source_name} · {p.side_name}</div>
          <div className="text-slate-600">{formatBytes(p.file_size)} · {formatDate(p.file_date)}</div>
          <div className="font-mono text-[10.5px] text-slate-500">{p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}</div>
          <button onClick={() => openDetail(p.id)} className="mt-1 rounded bg-blue-600 px-2 py-1 text-[11px] font-medium text-white">Open details</button>
        </div>
      ),
    };
  }), [points, openDetail]);

  const markers = useMemo(
    () => (areaIds ? allMarkers.filter((marker) => areaIds.has(marker.id)) : allMarkers),
    [allMarkers, areaIds],
  );

  const tileMessage = basemap === 'offline'
    ? 'Bundled vector basemap'
    : tileStatus === 'error'
      ? 'Live tiles unavailable · showing local geography'
      : 'Live map tiles';

  return (
    <LayerStateProvider available={MAP_VIEW_LAYERS}>
      <div className="relative isolate h-full animate-fade-in">
        <div className="absolute right-3 top-[78px] z-[1000] rounded-lg border border-surface-border bg-surface-900/90 px-3 py-1.5 text-[11.5px] text-slate-300 shadow-panel backdrop-blur">
          {areaIds ? `${markers.length} of ${allMarkers.length} files in selected area` : `${points.length} of ${total} geotagged file${total === 1 ? '' : 's'}`}
        </div>
        <MapContainer center={center} zoom={2} minZoom={2} maxZoom={19} className="h-full w-full">
          <TrackCentre onCentre={trackCentre} />
          <OfflineBasemap mode={basemap} onTileStatus={setTileStatus} />
          <FitBounds points={points} />
          <DataLayers points={markers} />
          <MapSearch points={allMarkers} onSelectArea={setAreaIds} onClearArea={() => setAreaIds(null)} />
          <CoordinateReadout centre={viewCentre} />
          <MapNavigationControl />
        </MapContainer>
        <MapTypeControl value={basemap} onChange={(value) => { setBasemap(value); setTileStatus(value === 'offline' ? 'ready' : 'loading'); }} tileStatus={tileStatus} />
        <LayerSwitcher />

        {status === 'loading' && (
          <div className="pointer-events-none absolute left-[310px] top-3 z-[1000] flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface-900/90 px-2.5 py-1.5 text-[11px] text-slate-500 shadow-panel backdrop-blur">
            <Loader2 size={12} className="animate-spin" /> Loading geotagged files…
          </div>
        )}
        {status === 'error' && (
          <div className="absolute left-1/2 top-3 z-[1000] flex max-w-[min(420px,calc(100%-24px))] -translate-x-1/2 items-center gap-2 rounded-lg border border-amber-500/30 bg-white/95 px-3 py-2 text-[11px] text-amber-700 shadow-panel">
            <MapPinOff size={14} className="shrink-0" />
            <span className="min-w-0 flex-1">{error}</span>
            <button onClick={load} className="flex shrink-0 items-center gap-1 rounded border border-surface-border px-2 py-1 font-medium text-slate-600 hover:bg-surface-850"><RefreshCw size={11} /> Retry</button>
          </div>
        )}
        {status === 'ready' && points.length === 0 && (
          <div className="pointer-events-none absolute bottom-16 left-1/2 z-[900] -translate-x-1/2 rounded-lg border border-surface-border bg-white/95 px-3 py-2 text-center shadow-panel">
            <div className="flex items-center justify-center gap-1.5 text-[12px] font-medium text-slate-700"><MapPinOff size={14} /> No geotagged files</div>
            <p className="mt-0.5 max-w-[270px] text-[10.5px] leading-relaxed text-slate-500">The basemap, search, coordinate tools and aerial imagery are still available.</p>
          </div>
        )}
        <div className="pointer-events-none absolute bottom-3 right-[116px] z-[900] rounded border border-surface-border bg-white/80 px-1.5 py-0.5 text-[9.5px] text-slate-500 shadow-sm">
          {tileMessage}
        </div>
      </div>
    </LayerStateProvider>
  );
}
