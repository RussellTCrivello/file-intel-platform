import { useEffect, useMemo, useState } from 'react';
import { GeoJSON, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Loader2 } from 'lucide-react';
import { DETAIL_ZOOM, graticuleLines, loadBasemap, selectLabels } from '../../lib/offlineBasemap';
import useBasemapTheme from './useBasemapTheme';
import { useLayerState } from './layers';

const TILE_SOURCES = {
  standard: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    maxNativeZoom: 19,
    subdomains: 'abc',
  },
  aerial: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
    maxNativeZoom: 19,
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org" target="_blank" rel="noreferrer">OpenTopoMap</a> (CC-BY-SA) &mdash; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OSM</a>',
    maxNativeZoom: 17,
    subdomains: 'abc',
  },
};

// Watches the zoom level and hands back basemap geometry for the current
// scale: 110m below DETAIL_ZOOM, 50m above it. loadBasemap always resolves
// asynchronously now because it first checks the layer database on disk.
function useBasemapGeometry() {
  const [zoom, setZoom] = useState(2);
  useMapEvents({ zoomend: (e) => setZoom(e.target.getZoom()) });

  const [geometry, setGeometry] = useState(null);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setPending(true);
    loadBasemap(zoom)
      .then((data) => { if (!cancelled) { setGeometry(data); setPending(false); } })
      .catch((error) => {
        if (cancelled) return;
        console.error('Could not load offline basemap geometry', error);
        setPending(false);
      });
    return () => { cancelled = true; };
  }, [zoom]);

  return { geometry, pending, zoom };
}

// The ocean is a painted background rather than geometry, so it can be
// toggled independently of the land layers.
function OceanLayer() {
  const { active } = useLayerState();
  const palette = useBasemapTheme();
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    container.style.setProperty('background', active.ocean ? palette['--map-ocean'] : 'transparent', 'important');
    return () => { container.style.removeProperty('background'); };
  }, [map, active.ocean, palette]);

  return null;
}

function LiveBasemap({ mode, onTileStatus }) {
  const source = TILE_SOURCES[mode];
  if (!source) return null;
  return (
    <TileLayer
      key={mode}
      url={source.url}
      attribution={source.attribution}
      maxNativeZoom={source.maxNativeZoom}
      maxZoom={19}
      subdomains={source.subdomains}
      eventHandlers={{
        loading: () => onTileStatus?.('loading'),
        load: () => onTileStatus?.('ready'),
        tileerror: () => onTileStatus?.('error'),
      }}
    />
  );
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

// Country names live in their own non-interactive pane. They're built
// imperatively rather than as React children because there are hundreds of
// them: letting Leaflet own the positioning means panning costs no re-render,
// and `interactive: false` guarantees a label can never swallow a click meant
// for a file marker underneath it.
function CountryNameLayer({ labels, color, halo, zoom }) {
  const map = useMap();
  const [visible, setVisible] = useState([]);

  useEffect(() => {
    const pane = map.getPane('labels') || map.createPane('labels');
    pane.style.zIndex = 450;
    pane.style.pointerEvents = 'none';
  }, [map]);

  useEffect(() => {
    setVisible(zoom >= 2 && zoom <= 7 ? selectLabels(labels, zoom) : []);
  }, [labels, zoom]);

  useEffect(() => {
    const group = L.layerGroup(
      visible.map((l) => L.marker([l.at[1], l.at[0]], {
        interactive: false,
        keyboard: false,
        pane: 'labels',
        icon: L.divIcon({
          className: '',
          iconSize: [0, 0],
          html: `<span style="color:${color};text-shadow:${halo}">${escapeHtml(l.name)}</span>`,
        }),
      })),
    );
    group.addTo(map);
    return () => { map.removeLayer(group); };
  }, [map, visible, color, halo]);

  return null;
}

export default function OfflineBasemap({ mode = 'offline', onTileStatus }) {
  const map = useMap();
  const { active } = useLayerState();
  const palette = useBasemapTheme();
  const { geometry, pending, zoom } = useBasemapGeometry();
  const detail = zoom >= DETAIL_ZOOM;
  const online = mode !== 'offline';

  // Keep the local geometry below live tiles. When a tile server is reachable,
  // its detailed map is the visible basemap. When it is not, the same country
  // shapes remain a useful, fully local fallback instead of a blank screen.
  const fallbackPane = useMemo(() => {
    const pane = map.getPane('basemap-fallback') || map.createPane('basemap-fallback');
    pane.style.zIndex = 150;
    return 'basemap-fallback';
  }, [map]);

  const lines = useMemo(() => graticuleLines(zoom >= 6 ? 10 : 20), [zoom]);
  const labelColor = mode === 'aerial' ? '#ffffff' : palette['--map-label'];
  const labelHalo = mode === 'aerial'
    ? '0 0 3px #111827,0 0 3px #111827,0 1px 2px #111827'
    : '0 0 3px #fff,0 0 3px #fff,0 1px 2px #fff';

  return (
    <>
      <OceanLayer />
      {online && <LiveBasemap mode={mode} onTileStatus={onTileStatus} />}

      {geometry && active.land && (
        <GeoJSON
          key={`land-${geometry.id}`}
          data={geometry.land}
          pane={fallbackPane}
          interactive={false}
          style={{ fillColor: palette['--map-land'], fillOpacity: 1, color: palette['--map-border'], weight: detail ? 0.6 : 0.9 }}
        />
      )}

      {geometry && active.countries && (
        <GeoJSON
          key={`countries-${geometry.id}-${mode}`}
          data={geometry.countries}
          style={{
            fillColor: palette['--map-ocean'],
            // Country shading is intentionally quiet on live road/imagery
            // tiles while remaining obvious in the bundled vector view.
            fillOpacity: online ? 0.08 : 0.4,
            color: palette['--map-border'],
            weight: 0.8,
            dashArray: '3 2',
          }}
          onEachFeature={(f, layer) => {
            const name = f.properties?.name;
            if (name) layer.bindTooltip(name, { sticky: true, className: 'map-country-tip' });
          }}
        />
      )}

      {geometry && active.borders && (
        <GeoJSON
          key={`borders-${geometry.id}`}
          data={geometry.countries}
          interactive={false}
          style={{ fill: false, color: palette['--map-border'], weight: detail ? 0.7 : 1 }}
        />
      )}

      {active.graticule && lines.map((line) => (
        <Polyline
          key={`${line.kind}-${line.value}`}
          positions={line.points}
          interactive={false}
          pathOptions={{ color: palette['--map-graticule'], weight: 0.7, opacity: 0.9, noClip: true }}
        />
      ))}

      {geometry && active.labels && (
        <CountryNameLayer labels={geometry.labels} color={labelColor} halo={labelHalo} zoom={zoom} />
      )}

      {pending && (
        <div className="pointer-events-none absolute bottom-12 left-3 z-[500] flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-900/90 px-2 py-1 text-[10.5px] text-slate-500 shadow-panel">
          <Loader2 size={11} className="animate-spin" /> Loading local map detail…
        </div>
      )}
    </>
  );
}
