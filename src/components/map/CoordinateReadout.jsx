import { useState } from 'react';
import { useMapEvents } from 'react-leaflet';
import { Copy, Check } from 'lucide-react';
import { formatDecimal, formatDMSPair } from '../../lib/geo/format.js';

// Live cursor coordinates.
//
// Leaflet's container point -> lat/lng is done by Leaflet itself, so the
// figure shown is exactly the position under the pointer rather than a value
// derived from the view centre. It is read at full precision and only
// rounded for display, and the two formats are switchable because a decimal
// coordinate is what you paste into a search box while DMS is what you read
// off a chart.
function useCursorLatLng() {
  const [at, setAt] = useState(null);
  useMapEvents({
    mousemove: (e) => setAt({ lat: e.latlng.lat, lng: e.latlng.lng }),
    mouseout: () => setAt(null),
  });
  return at;
}

/** The coordinate a marker/pin represents, shown to full precision. */
export function StaticCoordinate({ lat, lng, label, className = '' }) {
  const [format, setFormat] = useState('dd');
  const [copied, setCopied] = useState(false);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard blocked; the number is still visible and selectable */ }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => setFormat((f) => (f === 'dd' ? 'dms' : 'dd'))}
        title="Switch between decimal degrees and degrees/minutes/seconds"
        className="rounded border border-surface-border bg-surface-800 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:bg-surface-750 hover:text-slate-400"
      >
        {format === 'dd' ? 'DD' : 'DMS'}
      </button>
      <span className="font-mono text-[11.5px] tabular-nums text-slate-400">
        {format === 'dd' ? formatDecimal(lat, lng, 6) : formatDMSPair(lat, lng)}
      </span>
      <button
        type="button"
        onClick={copy}
        title="Copy coordinates"
        aria-label="Copy coordinates"
        className="rounded p-0.5 text-slate-500 hover:bg-surface-800 hover:text-slate-300"
      >
        {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
      </button>
      {label && <span className="text-[10.5px] text-slate-500">{label}</span>}
    </div>
  );
}

/**
 * The bottom-left readout. Position under the cursor, plus the view centre,
 * so there is always an exact figure on screen to compare a marker against.
 */
export default function CoordinateReadout({ centre, decimals = 5 }) {
  const cursor = useCursorLatLng();
  const [showDms, setShowDms] = useState(false);

  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 z-[1000] rounded-lg border border-surface-border bg-surface-900/95 px-2.5 py-1.5 font-mono text-[11px] tabular-nums text-slate-400 shadow-panel backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-slate-500">Cursor</span>
        <span className="min-w-[132px]">
          {cursor
            ? (showDms ? formatDMSPair(cursor.lat, cursor.lng) : formatDecimal(cursor.lat, cursor.lng, decimals))
            : <span className="text-slate-500">—</span>}
        </span>
        <button
          type="button"
          onClick={() => setShowDms((v) => !v)}
          className="rounded border border-surface-border px-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-300"
          title="Toggle decimal / DMS"
        >
          {showDms ? 'DMS' : 'DD'}
        </button>
      </div>
      {centre && (
        <div className="mt-0.5 flex items-center gap-2 border-t border-surface-border pt-0.5">
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-slate-500">Centre</span>
          <span>{showDms ? formatDMSPair(centre.lat, centre.lng) : formatDecimal(centre.lat, centre.lng, decimals)}</span>
        </div>
      )}
    </div>
  );
}
