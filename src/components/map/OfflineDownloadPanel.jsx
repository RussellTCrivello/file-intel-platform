import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Download, HardDriveDownload, Loader2, Trash2, X } from 'lucide-react';
import {
  MAX_DOWNLOAD_TILES, TILE_SOURCES, cacheStats, cacheSupported, clearTiles, countTiles,
  downloadArea, requestPersistentStorage,
} from '../../lib/tileCache';

const fmtBytes = (n) => (n == null ? '—' : n < 1e6 ? `${(n / 1e3).toFixed(0)} KB` : n < 1e9 ? `${(n / 1e6).toFixed(1)} MB` : `${(n / 1e9).toFixed(2)} GB`);
// Rough average tile size, for the pre-download estimate only.
const AVG_TILE_BYTES = { standard: 25e3, aerial: 30e3, terrain: 35e3 };

/**
 * "Save map for offline" control. Downloads the tiles of the chosen live
 * basemap(s) for the visible area over a zoom range, so the map can be
 * browsed at that detail with no connection. Lives inside MapContainer.
 */
export default function OfflineDownloadPanel({ mode }) {
  const map = useMap();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [bounds, setBounds] = useState(null);
  const [zoom, setZoom] = useState(map.getZoom());
  const [minZoom, setMinZoom] = useState(2);
  const [maxZoom, setMaxZoom] = useState(12);
  const [selected, setSelected] = useState(() => new Set([TILE_SOURCES[mode] ? mode : 'standard']));
  const [progress, setProgress] = useState(null);
  const [message, setMessage] = useState(null);
  const [stats, setStats] = useState(null);
  const abortRef = useRef(null);

  const readView = useCallback(() => {
    const b = map.getBounds();
    setBounds({ west: b.getWest(), east: b.getEast(), south: b.getSouth(), north: b.getNorth() });
    setZoom(map.getZoom());
  }, [map]);
  useMapEvents({ moveend: readView });
  useEffect(() => { readView(); }, [readView]);

  useEffect(() => {
    if (rootRef.current) { L.DomEvent.disableClickPropagation(rootRef.current); L.DomEvent.disableScrollPropagation(rootRef.current); }
  }, [open]);

  const refreshStats = useCallback(() => { cacheStats().then(setStats).catch(() => {}); }, []);
  useEffect(() => { if (open) refreshStats(); }, [open, refreshStats]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const estimate = useMemo(() => {
    if (!bounds) return { tiles: 0, bytes: 0 };
    let tiles = 0; let bytes = 0;
    for (const m of selected) {
      const n = countTiles(bounds, minZoom, Math.min(maxZoom, TILE_SOURCES[m].maxNativeZoom));
      tiles += n; bytes += n * AVG_TILE_BYTES[m];
    }
    return { tiles, bytes };
  }, [bounds, minZoom, maxZoom, selected]);

  const tooMany = [...selected].some((m) => bounds && countTiles(bounds, minZoom, Math.min(maxZoom, TILE_SOURCES[m].maxNativeZoom)) > MAX_DOWNLOAD_TILES);
  const running = !!abortRef.current && progress && !progress.finished;

  const start = async () => {
    setMessage(null);
    await requestPersistentStorage();
    const controller = new AbortController();
    abortRef.current = controller;
    const area = { ...bounds };
    const modes = [...selected];
    let acc = { done: 0, total: estimate.tiles, failed: 0, skipped: 0, bytes: 0 };
    setProgress({ ...acc });
    try {
      for (const m of modes) {
        const base = { ...acc };
        const res = await downloadArea({
          mode: m, bounds: area, minZoom, maxZoom, signal: controller.signal,
          onProgress: (p) => setProgress({ ...base, done: base.done + p.done, failed: base.failed + p.failed, skipped: base.skipped + p.skipped, bytes: base.bytes + p.bytes, total: acc.total, current: m }),
        });
        acc = { ...acc, done: base.done + res.done, failed: base.failed + res.failed, skipped: base.skipped + res.skipped, bytes: base.bytes + res.bytes };
        if (res.aborted) break;
      }
      setMessage(controller.signal.aborted
        ? 'Download cancelled. Tiles already saved are kept.'
        : acc.failed ? `Saved with ${acc.failed.toLocaleString()} tile(s) unavailable.` : 'This area is now available offline.');
    } catch (e) {
      setMessage(e.message);
    } finally {
      abortRef.current = null;
      setProgress((p) => (p ? { ...p, ...acc, finished: true } : p));
      refreshStats();
    }
  };

  const toggle = (m) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(m)) { if (next.size > 1) next.delete(m); } else next.add(m);
    return next;
  });

  const totalStored = stats ? Object.values(stats.counts).reduce((a, b) => a + b, 0) : 0;

  return (
    <div ref={rootRef} className="absolute bottom-14 left-3 z-[1000]">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Download this area for offline use"
          className="flex items-center gap-1.5 rounded-lg border border-surface-border bg-surface-900/95 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 shadow-panel backdrop-blur hover:text-slate-200"
        >
          {running ? <Loader2 size={12} className="animate-spin" /> : <HardDriveDownload size={12} />}
          {running ? `Saving ${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` : 'Save offline'}
        </button>
      ) : (
        <div className="w-[270px] rounded-lg border border-surface-border bg-surface-900/95 p-3 text-[11px] text-slate-400 shadow-panel backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-semibold text-slate-200">Save map for offline</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-slate-500 hover:text-slate-300"><X size={13} /></button>
          </div>
          {!cacheSupported() ? (
            <p>Offline storage isn&apos;t available in this environment (it needs a secure context).</p>
          ) : (
            <>
              <p className="mb-2 leading-relaxed text-slate-500">Downloads the visible area (current zoom {zoom}). Anything you browse online is also saved automatically.</p>
              <div className="mb-2 flex flex-wrap gap-1">
                {Object.entries(TILE_SOURCES).map(([id, s]) => (
                  <button key={id} type="button" disabled={running} onClick={() => toggle(id)}
                    className={`rounded px-2 py-1 text-[10.5px] font-medium ${selected.has(id) ? 'bg-teal-700 text-white' : 'border border-surface-border text-slate-500 hover:text-slate-300'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
              <label className="mb-1 flex items-center justify-between gap-2">
                <span>Min zoom</span>
                <input type="range" min={0} max={19} value={minZoom} disabled={running}
                  onChange={(e) => { const v = +e.target.value; setMinZoom(v); if (v > maxZoom) setMaxZoom(v); }} className="flex-1" />
                <span className="w-5 text-right tabular-nums">{minZoom}</span>
              </label>
              <label className="mb-2 flex items-center justify-between gap-2">
                <span>Max zoom</span>
                <input type="range" min={0} max={19} value={maxZoom} disabled={running}
                  onChange={(e) => { const v = +e.target.value; setMaxZoom(v); if (v < minZoom) setMinZoom(v); }} className="flex-1" />
                <span className="w-5 text-right tabular-nums">{maxZoom}</span>
              </label>
              <div className={`mb-2 ${tooMany ? 'text-amber-600' : 'text-slate-500'}`}>
                ≈ {estimate.tiles.toLocaleString()} tiles · ~{fmtBytes(estimate.bytes)}
                {tooMany && <div>Over the {MAX_DOWNLOAD_TILES.toLocaleString()}-tile limit per map — zoom in or lower max zoom.</div>}
              </div>

              {progress && (
                <div className="mb-2">
                  <div className="h-1.5 overflow-hidden rounded bg-surface-800">
                    <div className="h-full bg-teal-600 transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
                  </div>
                  <div className="mt-1 tabular-nums text-slate-500">
                    {progress.done.toLocaleString()} / {progress.total.toLocaleString()} · {fmtBytes(progress.bytes)} new
                    {progress.skipped ? ` · ${progress.skipped.toLocaleString()} already saved` : ''}
                    {progress.failed ? ` · ${progress.failed} failed` : ''}
                  </div>
                </div>
              )}
              {message && <div className="mb-2 text-slate-300">{message}</div>}

              <div className="flex gap-1.5">
                {running ? (
                  <button type="button" onClick={() => abortRef.current?.abort()} className="flex flex-1 items-center justify-center gap-1 rounded border border-surface-border px-2 py-1.5 font-medium text-slate-300">
                    <X size={12} /> Cancel
                  </button>
                ) : (
                  <button type="button" onClick={start} disabled={!bounds || tooMany || estimate.tiles === 0}
                    className="flex flex-1 items-center justify-center gap-1 rounded bg-teal-700 px-2 py-1.5 font-medium text-white disabled:opacity-50">
                    <Download size={12} /> Download area
                  </button>
                )}
              </div>

              <div className="mt-2 flex items-center justify-between border-t border-surface-border pt-2 text-[10.5px] text-slate-500">
                <span>
                  Stored: {totalStored.toLocaleString()} tiles
                  {stats?.usage != null ? ` · ${fmtBytes(stats.usage)}` : ''}
                </span>
                <button type="button" disabled={running || !totalStored}
                  onClick={async () => { if (window.confirm('Delete all saved offline map tiles?')) { await clearTiles(); refreshStats(); setProgress(null); setMessage('Offline tiles cleared.'); } }}
                  className="flex items-center gap-1 hover:text-red-500 disabled:opacity-40">
                  <Trash2 size={11} /> Clear
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
