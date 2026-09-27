import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import { MapPinOff, Loader2, ScanSearch, RefreshCw } from 'lucide-react';
import { fileAnalysis as fileAnalysisApi } from '../../lib/sylthaeApi';
import Breadcrumb from './Breadcrumb';
import EntityList, { EntityCard } from './EntityList';
import FacetFileList from './FacetFileList';

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) { map.setView([points[0].latitude, points[0].longitude], 5); return; }
    map.fitBounds(points.map((p) => [p.latitude, p.longitude]), { padding: [30, 30] });
  }, [points, map]);
  return null;
}

// Geolocation: real place names found inside files' own extracted text
// (a small gazetteer scan against contents_raw -- see
// Api/services/geo_extraction_service.py), not a fabricated location and
// not a "where the source is based" fallback. Clicking a place (list or map
// marker) drills into the files that actually mention it.
export default function GeolocationBrowser({ onHome }) {
  const [place, setPlace] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanSummary, setScanSummary] = useState(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fileAnalysisApi.geoPlaces({ per_page: 200 })
      .then((d) => setItems(d.data || []))
      .catch((e) => setError(e.message || 'Failed to load geolocation data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (!place) load(); }, [place]);

  const scan = async () => {
    setScanning(true);
    setScanSummary(null);
    try {
      const res = await fileAnalysisApi.geoScan({});
      setScanSummary(res.summary);
      load();
    } catch (e) {
      setError(e.message || 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const crumbs = [{ label: 'Geolocation', onClick: place ? () => setPlace(null) : null }];
  if (place) crumbs.push({ label: place.place_name });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-surface-border bg-surface-900">
        <Breadcrumb crumbs={crumbs} onHome={onHome} />
        {!place && (
          <div className="flex flex-wrap items-center gap-2 px-4 pb-2.5">
            <p className="text-[11.5px] text-slate-500">
              Real place names found by scanning each file's own extracted text against a world-places gazetteer -- not derived from source location.
            </p>
            <button onClick={scan} disabled={scanning} className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md border border-surface-border bg-surface-800 px-2.5 py-1.5 text-[12px] font-medium text-slate-300 hover:bg-surface-750 disabled:opacity-50">
              {scanning ? <Loader2 size={13} className="animate-spin" /> : <ScanSearch size={13} />}
              {scanning ? 'Scanning…' : 'Scan for locations'}
            </button>
          </div>
        )}
        {scanSummary && !place && (
          <div className="mx-4 mb-2.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[11.5px] text-emerald-300">
            Scanned {scanSummary.hashes_scanned} new document{scanSummary.hashes_scanned === 1 ? '' : 's'} -- found {scanSummary.distinct_places} place{scanSummary.distinct_places === 1 ? '' : 's'} across {scanSummary.files_tagged} file{scanSummary.files_tagged === 1 ? '' : 's'}.
          </div>
        )}
      </div>

      {!place && (
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_320px]">
          {/* `isolate`: contain Leaflet's internal z-index scale (its
              panes/controls go up to 1000 by default) to this box, so it can
              never render above app chrome like the file detail drawer
              (z-[250]) or dialogs that sit elsewhere in the DOM. */}
          <div className="relative isolate h-64 lg:h-full">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-slate-500">
                {loading ? <Loader2 size={22} className="animate-spin" /> : (
                  <>
                    <MapPinOff size={28} />
                    <span className="text-[13px] font-medium text-slate-400">No place mentions found yet</span>
                    <p className="max-w-sm text-[12px] leading-relaxed text-slate-500">Run "Scan for locations" to search every document's real text for gazetteer place names.</p>
                  </>
                )}
              </div>
            ) : (
              <MapContainer center={[20, 0]} zoom={2} className="h-full w-full" style={{ background: '#0b0e14' }}>
                <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <FitBounds points={items} />
                {items.map((p) => (
                  <CircleMarker key={p.place_name} center={[p.latitude, p.longitude]} radius={6 + Math.min(10, Math.sqrt(p.file_count) * 3)}
                    pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.6, weight: 1.5 }}
                    eventHandlers={{ click: () => setPlace(p) }}>
                    <Popup>
                      <div className="flex min-w-[160px] flex-col gap-1 text-[12px]">
                        <div className="font-semibold">{p.place_name}{p.country ? `, ${p.country}` : ''}</div>
                        <div className="text-slate-600">{p.file_count} file{p.file_count === 1 ? '' : 's'} · {p.mention_count} mention{p.mention_count === 1 ? '' : 's'}</div>
                        <button onClick={() => setPlace(p)} className="mt-1 rounded bg-blue-600 px-2 py-1 text-[11px] font-medium text-white">View files</button>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            )}
          </div>
          <div className="min-h-0 overflow-hidden border-t border-surface-border lg:border-l lg:border-t-0">
            <EntityList
              items={items} loading={loading} error={error}
              pagination={null} onPageChange={() => {}}
              emptyTitle="No places yet"
              renderItem={(p) => (
                <EntityCard key={p.place_name} title={p.place_name} subtitle={p.country} onClick={() => setPlace(p)}
                  stats={[{ label: 'Files', value: p.file_count }, { label: 'Mentions', value: p.mention_count }]} />
              )}
            />
          </div>
        </div>
      )}

      {place && <FacetFileList facet="geo_place" id={0} place={place.place_name} label={place.place_name} />}
    </div>
  );
}
