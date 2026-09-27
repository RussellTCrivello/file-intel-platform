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
/** Keeps the coordinate readout in step with the map's real centre. */
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
  // Declared above the early returns so the hook order stays stable.
  const markers = useMemo(() => points.map((p) => {
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

  if (status === 'loading') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
        <Loader2 size={22} className="animate-spin" />
        <span className="text-[13px]">Loading geolocation data…</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
        <MapPinOff size={28} />
        <span className="text-[13px]">{error}</span>
        <button onClick={load} className="mt-2 flex items-center gap-1.5 rounded-md bg-surface-800 px-3 py-1.5 text-[12px] text-slate-300 hover:bg-surface-750">
          <RefreshCw size={13} /> Retry
        </button>
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-slate-500">
        <MapPinOff size={30} />
        <span className="text-[13.5px] font-medium text-slate-400">No geolocation data available</span>
        <p className="max-w-md text-[12px] leading-relaxed text-slate-500">
          None of the ingested files carry GPS coordinates (<code className="text-slate-400">paths.coordinates</code> is empty for every record in this dataset). This view will populate automatically as soon as files with embedded location metadata are ingested.
        </p>
      </div>
    );
  }

  // Normalise the API rows into the shape the imperative marker layers take.
  // Popups are built lazily (a function, not a node) because only one is open
  // at a time and each one is rendered through a single shared React root.
  return (
    // `isolate` creates a fresh stacking context around the map: Leaflet's
    // own CSS gives its panes/controls z-index up to 1000, and without a
    // containing stacking context those values compare directly against
    // *everything else on the page* (portaled drawers/dialogs included),
    // letting map chrome render on top of e.g. the file detail drawer when
    // it's opened from a marker popup. Trapping them here keeps the map's
    // internal layering local to the map only.
    <LayerStateProvider available={MAP_VIEW_LAYERS}>
      <div className="relative isolate h-full animate-fade-in">
        <div className="absolute right-3 top-3 z-[1000] rounded-lg border border-surface-border bg-surface-900/90 px-3 py-1.5 text-[11.5px] text-slate-300 shadow-panel backdrop-blur">
          {points.length} of {total} geotagged file{total === 1 ? '' : 's'}
        </div>
        {/* maxZoom is not optional: leaflet.heat calls map.getMaxZoom() when
            it builds its canvas and throws without it. 12 is also the point
            past which the bundled 50m coastline stops adding information. */}
        <MapContainer center={center} zoom={2} minZoom={2} maxZoom={12} className="h-full w-full">
          <TrackCentre onCentre={trackCentre} />
          <OfflineBasemap />
          <FitBounds points={points} />
          <DataLayers points={markers} />
          {/* These two read the live map (flyTo, cursor tracking), so they must
              be descendants of MapContainer. Leaflet renders children into the
              map pane, and their absolute positioning resolves against the map
              container -- which is the same place they visually belong. */}
          <MapSearch points={markers} />
          <CoordinateReadout centre={viewCentre} />
        </MapContainer>
        <LayerSwitcher />
      </div>
    </LayerStateProvider>
  );
}
