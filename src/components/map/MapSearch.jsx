import { useEffect, useMemo, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import L from './leafletGlobal.js';
import { Crosshair, MapPin, Search, Target, X } from 'lucide-react';
import { parseCoordinates, formatShort, boundingBox, inBoundingBox } from '../../lib/geo/format.js';
import { searchPlaces, nearestPlace, gazetteerLoaded, gazetteerInfo, countryAt } from '../../lib/geo/gazetteer.js';

const MODES = [
  { id: 'coords', label: 'Coordinates' },
  { id: 'place', label: 'Place' },
  { id: 'area', label: 'Area' },
];

/**
 * Offline location search.
 *
 * Coordinates  - type decimal or DMS, go there, and pin it at full precision.
 * Place        - search the local gazetteer by name, ranked by population.
 * Area         - a centre + radius, or two corners, to narrow the file
 *                markers already loaded on the map.
 *
 * Every mode is answered from local data; there is no geocoding service to
 * call, which is the whole point -- this has to work with the machine offline.
 */
export default function MapSearch({ points = [], onSelectArea }) {
  const map = useMap();
  const [mode, setMode] = useState('coords');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [reverse, setReverse] = useState(null);
  const [pin, setPin] = useState(null);
  const [countriesIndex, setCountriesIndex] = useState(null);
  const [area, setArea] = useState({ centre: '', radius: '' });
  const [areaResult, setAreaResult] = useState(null);
  const pinRef = useRef(null);

  // Country outlines, used to name the country under a coordinate. loadBasemap
  // already returns converted GeoJSON FeatureCollections, so there is nothing
  // to run through topojson's feature() here.
  useEffect(() => {
    let cancelled = false;
    import('../../lib/offlineBasemap.js')
      .then((m) => m.loadBasemap(2))
      .then((data) => {
        if (cancelled || !data?.countries?.features) return;
        setCountriesIndex(data.countries);
      })
      .catch((error) => {
        // The country name is a bonus on top of the coordinate; failing to
        // build the index must not take the rest of the search down with it.
        console.warn('Reverse lookup: country outlines unavailable', error);
      });
    return () => { cancelled = true; };
  }, []);

  // Place search against the local gazetteer.
  useEffect(() => {
    if (mode !== 'place') return;
    setError(null);
    if (!gazetteerLoaded()) {
      setResults([]);
      setError('No offline gazetteer is installed. Download map layers in Settings > Map data.');
      return;
    }
    setResults(query.trim() ? searchPlaces(query, { limit: 10 }) : []);
  }, [query, mode]);

  // Pin marker, kept outside React state so it does not re-render the map.
  useEffect(() => {
    if (pinRef.current) { map.removeLayer(pinRef.current); pinRef.current = null; }
    if (!pin) return;
    const marker = L.marker([pin.lat, pin.lng], {
      interactive: false,
      keyboard: false,
      icon: L.divIcon({
        className: '',
        iconSize: [18, 18],
        html: '<span style="display:block;width:18px;height:18px;border-radius:50%;background:#0f766e;border:3px solid #fff;box-shadow:0 1px 4px rgba(15,23,42,.35)"></span>',
      }),
    }).addTo(map);
    pinRef.current = marker;
    return () => { map.removeLayer(marker); pinRef.current = null; };
  }, [map, pin]);

  const submitCoordinates = (raw) => {
    setError(null);
    setReverse(null);
    const parsed = parseCoordinates(raw);
    if (parsed.error) { setError(parsed.error); return; }
    if (parsed.lat === undefined) {
      // Only a latitude was given: ask for the other half rather than
      // guessing a longitude.
      setError('Enter both latitude and longitude, e.g. 52.37, 4.89');
      return;
    }
    setPin({ lat: parsed.lat, lng: parsed.lng, source: 'coordinate' });
    map.flyTo([parsed.lat, parsed.lng], Math.max(map.getZoom(), 9), { duration: 0.6 });
    setReverse(describe(parsed.lat, parsed.lng, countriesIndex));
  };

  const describe = (lat, lng, index) => {
    const near = nearestPlace(lat, lng, { limit: 3 });
    const country = index ? countryAt(index, lat, lng) : null;
    return { lat, lng, near, country };
  };

  const choosePlace = (p) => {
    setError(null);
    setPin({ lat: p.lat, lng: p.lng, source: p.name });
    map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 7), { duration: 0.6 });
    setReverse(describe(p.lat, p.lng, countriesIndex));
    setQuery(p.name);
  };

  const submitArea = (kind) => {
    setError(null);
    setAreaResult(null);

    if (kind === 'radius') {
      const centre = parseCoordinates(area.centre);
      const radiusKm = Number(area.radius);
      if (centre.error || !Number.isFinite(centre.lat)) { setError(centre.error || 'Enter a valid centre coordinate.'); return; }
      if (!Number.isFinite(radiusKm) || radiusKm <= 0) { setError('Enter a radius in kilometres.'); return; }
      const box = boundingBox(centre.lat, centre.lng, radiusKm);
      const inside = points.filter((p) => inBoundingBox(p.lat, p.lng, box));
      setAreaResult({ kind: 'radius', centre, radiusKm, box, count: inside.length, ids: inside.map((p) => p.id) });
      map.flyToBounds([[box.south, box.west], [box.north, box.east]], { duration: 0.6 });
      onSelectArea?.(new Set(inside.map((p) => p.id)));
      return;
    }

    const box = parseCoordinates(area.centre);
    if (box.error || box.lat === undefined || box.lng === undefined) {
      setError('Enter two corners, e.g. 52.0, 4.0 then 53.0, 5.0');
      return;
    }
  };

  // Re-read on every search, so the count appears as soon as the gazetteer
  // finishes loading rather than staying pinned at 0 from the first render.
  const gazCount = query || error ? gazetteerInfo()?.count ?? 0 : 0;

  return (
    <div className="absolute left-3 top-3 z-[1000] w-[290px] rounded-lg border border-surface-border bg-surface-900/95 shadow-panel backdrop-blur">
      <div className="flex items-center gap-1 border-b border-surface-border p-1.5">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); setError(null); setResults([]); }}
            className={`flex-1 rounded px-2 py-1 text-[11px] font-medium ${mode === m.id ? 'bg-teal-50 text-teal-800' : 'text-slate-500 hover:bg-surface-800 hover:text-slate-400'}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="p-2.5">
        {mode === 'coords' && (
          <form onSubmit={(e) => { e.preventDefault(); submitCoordinates(query); }}>
            <div className="flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-800 px-2 py-1.5 focus-within:border-teal-600/50">
              <Crosshair size={13} className="shrink-0 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="52.37, 4.89  or  52°22'12&quot;N 4°53'24&quot;E"
                className="min-w-0 flex-1 bg-transparent font-mono text-[11.5px] text-slate-300 outline-none placeholder:text-slate-500"
              />
              <button type="submit" className="shrink-0 rounded p-0.5 text-slate-500 hover:text-teal-700" aria-label="Go to coordinate">
                <Search size={13} />
              </button>
            </div>
          </form>
        )}

        {mode === 'place' && (
          <>
            <div className="flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-800 px-2 py-1.5 focus-within:border-teal-600/50">
              <Search size={13} className="shrink-0 text-slate-500" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search places offline"
                className="min-w-0 flex-1 bg-transparent text-[11.5px] text-slate-300 outline-none placeholder:text-slate-500"
              />
            </div>
            {results.length > 0 && (
              <ul className="mt-1.5 max-h-56 overflow-y-auto">
                {results.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => choosePlace(p)}
                      className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left hover:bg-surface-800"
                    >
                      <MapPin size={11} className="shrink-0 text-teal-700" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11.5px] text-slate-300">{p.name}</span>
                        <span className="block truncate font-mono text-[10px] text-slate-500">
                          {formatShort(p.lat, p.lng)}{p.population ? ` · ${p.population.toLocaleString()}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {query.trim() && !results.length && !error && gazetteerLoaded() && (
              <p className="mt-2 text-[11px] text-slate-500">No place matches “{query}”.</p>
            )}
            {gazCount > 0 && (
              <p className="mt-2 text-[10px] text-slate-500">{gazCount.toLocaleString()} places indexed offline.</p>
            )}
          </>
        )}

        {mode === 'area' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Centre coordinate</label>
            <input
              value={area.centre}
              onChange={(e) => setArea({ ...area, centre: e.target.value })}
              placeholder="52.37, 4.89"
              className="rounded-md border border-surface-border bg-surface-800 px-2 py-1.5 font-mono text-[11.5px] text-slate-300 outline-none focus:border-teal-600/50"
            />
            <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Radius (km)</label>
            <input
              value={area.radius}
              onChange={(e) => setArea({ ...area, radius: e.target.value })}
              placeholder="25"
              inputMode="decimal"
              className="rounded-md border border-surface-border bg-surface-800 px-2 py-1.5 font-mono text-[11.5px] text-slate-300 outline-none focus:border-teal-600/50"
            />
            <button
              onClick={() => submitArea('radius')}
              className="mt-0.5 flex items-center justify-center gap-1.5 rounded-md bg-teal-700 px-2 py-1.5 text-[11.5px] font-medium text-white hover:bg-teal-800"
            >
              <Target size={12} /> Search this area
            </button>
            {areaResult && (
              <p className="rounded border border-surface-border bg-surface-850 px-2 py-1.5 text-[11px] text-slate-400">
                {areaResult.count} file marker{areaResult.count === 1 ? '' : 's'} inside
                {areaResult.kind === 'radius' ? ` ${areaResult.radiusKm} km` : ' the box'}.
              </p>
            )}
          </div>
        )}

        {error && <p className="mt-2 text-[11px] text-red-500">{error}</p>}

        {reverse && (
          <div className="mt-2 rounded-md border border-surface-border bg-surface-850 p-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Coordinate</div>
                <div className="font-mono text-[11.5px] tabular-nums text-slate-300">
                  {reverse.lat.toFixed(6)}, {reverse.lng.toFixed(6)}
                </div>
                {reverse.country && <div className="mt-0.5 text-[11px] text-slate-400">{reverse.country}</div>}
              </div>
              <button onClick={() => { setPin(null); setReverse(null); }} aria-label="Clear" className="shrink-0 rounded p-0.5 text-slate-500 hover:text-slate-300">
                <X size={12} />
              </button>
            </div>
            {reverse.near.length > 0 && (
              <ul className="mt-1.5 space-y-0.5 border-t border-surface-border pt-1.5">
                {reverse.near.map((n) => (
                  <li key={`${n.id}-${n.distanceKm}`} className="flex justify-between gap-2 text-[10.5px]">
                    <span className="truncate text-slate-400">{n.name}</span>
                    <span className="shrink-0 font-mono tabular-nums text-slate-500">
                      {n.distanceKm < 1 ? `${Math.round(n.distanceKm * 1000)} m` : `${n.distanceKm.toFixed(1)} km`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
