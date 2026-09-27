import { useEffect, useState } from 'react';
import { Check, Crosshair, LocateFixed, Map as MapIcon, Maximize2, Minimize2, Mountain, RotateCcw, Satellite, WifiOff } from 'lucide-react';
import { useMap } from 'react-leaflet';

// These are deliberately public, attribution-bearing tile sources. The vector
// Natural Earth map remains underneath them, so a lost connection never turns
// the map into a blank panel; it simply falls back to the bundled basemap.
const BASEMAP_OPTIONS = [
  { id: 'standard', label: 'Standard', shortLabel: 'Standard', icon: MapIcon, description: 'Roads, places and boundaries', online: true },
  { id: 'aerial', label: 'Aerial', shortLabel: 'Aerial', icon: Satellite, description: 'Satellite and aerial imagery', online: true },
  { id: 'terrain', label: 'Terrain', shortLabel: 'Terrain', icon: Mountain, description: 'Terrain and elevation', online: true },
  { id: 'offline', label: 'Offline', shortLabel: 'Offline', icon: WifiOff, description: 'Bundled vector basemap', online: false },
];

export function MapTypeControl({ value, onChange, tileStatus = 'idle' }) {
  return (
    <div className="absolute right-3 top-3 z-[1000] rounded-lg border border-surface-border bg-surface-900/95 p-1 shadow-panel backdrop-blur">
      <div className="flex items-center gap-1 px-1 pb-1">
        <span className="px-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">Map view</span>
        {tileStatus === 'error' && value !== 'offline' && (
          <span className="ml-auto flex items-center gap-1 text-[9.5px] text-amber-600" title="Live tiles are unavailable; bundled geography remains visible">
            <WifiOff size={10} /> Offline fallback
          </span>
        )}
      </div>
      <div className="flex items-center gap-0.5">
        {BASEMAP_OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              aria-pressed={selected}
              title={`${option.label}: ${option.description}`}
              className={`flex items-center gap-1 rounded px-2 py-1.5 text-[10.5px] font-medium transition-colors ${
                selected ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-500 hover:bg-surface-800 hover:text-slate-300'
              }`}
            >
              <Icon size={12} />
              <span className="hidden sm:inline">{option.shortLabel}</span>
              {selected && <Check size={10} className="hidden sm:inline" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MapButton({ label, children, onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-surface-800 hover:text-slate-300 disabled:cursor-wait disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/** Leaflet map actions kept in one small, keyboard-accessible control. */
export function MapNavigationControl({ defaultView = [20, 0], defaultZoom = 2 }) {
  const map = useMap();
  const [locating, setLocating] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(document.fullscreenElement === map.getContainer());
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => document.removeEventListener('fullscreenchange', onFullscreen);
  }, [map]);

  const reset = () => map.setView(defaultView, defaultZoom, { animate: true });

  const locate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        map.flyTo([coords.latitude, coords.longitude], Math.max(map.getZoom(), 10), { duration: 0.7 });
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 },
    );
  };

  const toggleFullscreen = async () => {
    const container = map.getContainer();
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await container.requestFullscreen();
    } catch { /* Fullscreen is optional and can be blocked by the host. */ }
  };

  return (
    <div className="absolute bottom-3 right-[236px] z-[1000] flex flex-col divide-y divide-surface-border rounded-lg border border-surface-border bg-surface-900/95 shadow-panel backdrop-blur">
      <MapButton label="Reset world view" onClick={reset}><RotateCcw size={13} /></MapButton>
      <MapButton label="Use my location" onClick={locate} disabled={locating}>
        {locating ? <span className="animate-pulse"><LocateFixed size={13} /></span> : <Crosshair size={13} />}
      </MapButton>
      <MapButton label={fullscreen ? 'Exit fullscreen map' : 'Open fullscreen map'} onClick={toggleFullscreen}>
        {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
      </MapButton>
    </div>
  );
}
