import { useEffect, useMemo, useRef } from 'react';
import { useMap } from 'react-leaflet';
// Must come first: it publishes the global `L` the two plugins below need.
import L from './leafletGlobal.js';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.heat';

// leaflet.heat schedules its redraw on requestAnimationFrame but never
// cancels the frame on removal, so a layer removed between scheduling and
// the frame (StrictMode remounts, view switches) crashes on `this._map`
// being null. Make the deferred redraw a no-op once detached.
if (L.HeatLayer && !L.HeatLayer.prototype.__guarded) {
  const redraw = L.HeatLayer.prototype._redraw;
  L.HeatLayer.prototype._redraw = function guardedRedraw(...args) {
    this._frame = null;
    if (!this._map) return undefined;
    return redraw.apply(this, args);
  };
  L.HeatLayer.prototype.__guarded = true;
}
import { renderPopup } from './reactPopup';
import { useLayerState } from './layers.jsx';

// Popups render through a single shared React root (see reactPopup.js). Each
// marker just declares *what* its popup should contain; the content is built
// when the popup actually opens, so a layer of thousands of markers does
// nothing per marker until one is clicked.
function bindPopup(layer, build) {
  layer.bindPopup('');
  layer.on('popupopen', (e) => {
    // Leaflet 1.9 has no getContentElement() (that arrived in 1.10), so go
    // through the public DivOverlay.getElement() and find the content node by
    // class. The private _contentNode is the fallback for the case where the
    // popup hasn't been attached to the DOM yet.
    const root = e.popup.getElement();
    const content = root?.querySelector('.leaflet-popup-content') || e.popup._contentNode;
    if (content) renderPopup(content, build());
  });
}

// Individual file markers, drawn as circle markers on the canvas renderer so
// a few thousand points stay interactive.
function FileMarkers({ points }) {
  const map = useMap();
  const layerRef = useRef(null);
  const { active } = useLayerState();

  useEffect(() => {
    if (!layerRef.current) {
      layerRef.current = L.layerGroup();
    }
    const layer = layerRef.current;
    layer.clearLayers();

    for (const p of points) {
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: p.radius ?? 7,
        color: p.color,
        fillColor: p.color,
        fillOpacity: 0.75,
        weight: 1.5,
      });
      bindPopup(marker, p.popup);
      layer.addLayer(marker);
    }
  }, [points]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    if (active.files) { if (!map.hasLayer(layer)) layer.addTo(map); }
    else if (map.hasLayer(layer)) map.removeLayer(layer);
  }, [map, active.files]);

  useEffect(() => () => { layerRef.current?.remove(); layerRef.current = null; }, []);

  return null;
}

// Same points, grouped. markercluster hides the individual markers itself at
// low zoom and hands back a cluster icon when the count is worth aggregating.
function FileClusters({ points }) {
  const map = useMap();
  const clusterRef = useRef(null);
  const { active } = useLayerState();

  useEffect(() => {
    clusterRef.current?.remove();
    clusterRef.current = null;
  }, [points]);

  useEffect(() => {
    if (!clusterRef.current && points.length) {
      const group = L.markerClusterGroup({
        chunkedLoading: true,
        maxClusterRadius: 45,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        iconCreateFunction: (cluster) => L.divIcon({
          className: '',
          iconSize: [34, 34],
          html: `<span style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:rgba(15,118,110,.85);color:#fff;font-size:11.5px;font-weight:600;border:2px solid #fff;box-shadow:0 1px 3px rgba(15,23,42,.3)">${cluster.getChildCount()}</span>`,
        }),
      });
      for (const p of points) {
        const marker = L.marker([p.lat, p.lng], {
          icon: L.divIcon({
            className: '',
            iconSize: [16, 16],
            html: `<span style="display:block;width:16px;height:16px;border-radius:50%;background:${p.color};border:2px solid #fff;box-shadow:0 1px 2px rgba(15,23,42,.3)"></span>`,
          }),
        });
        bindPopup(marker, p.popup);
        group.addLayer(marker);
      }
      clusterRef.current = group;
    }

    const group = clusterRef.current;
    if (!group) return;
    if (active.clusters) { if (!map.hasLayer(group)) group.addTo(map); }
    else if (map.hasLayer(group)) map.removeLayer(group);
  }, [map, points, active.clusters]);

  useEffect(() => () => { clusterRef.current?.remove(); clusterRef.current = null; }, []);

  return null;
}

// Density surface for "where do files actually concentrate", which stays
// readable at a zoom level where individual markers would be a solid blob.
function Density({ points }) {
  const map = useMap();
  const { active } = useLayerState();
  const layerRef = useRef(null);

  useEffect(() => {
    if (layerRef.current) return;
    const layer = L.heatLayer([], {
      radius: 22,
      blur: 18,
      maxZoom: 8,
      minOpacity: 0.28,
      gradient: { 0.2: '#0d9488', 0.45: '#14b8a6', 0.7: '#f59e0b', 1.0: '#b42318' },
    });
    layerRef.current = layer;
    layer.addTo(map);
    return () => { map.removeLayer(layer); layerRef.current = null; };
  }, [map]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !map.hasLayer(layer)) return;
    if (active.heat && points.length) layer.setLatLngs(points.map((p) => [p.lat, p.lng, p.weight ?? 1]));
    else layer.setLatLngs([]);
  }, [map, points, active.heat]);

  return null;
}

// Place mentions scanned out of file text -- a different dataset from the
// geotagged files, drawn in the brand teal so the two never read as one thing.
function PlaceMarkers({ places }) {
  const map = useMap();
  const layerRef = useRef(null);
  const { active } = useLayerState();

  useEffect(() => {
    if (!layerRef.current) layerRef.current = L.layerGroup();
    const layer = layerRef.current;
    layer.clearLayers();

    for (const p of places) {
      const marker = L.circleMarker([p.lat, p.lng], {
        radius: p.radius ?? 6,
        color: '#0f766e',
        fillColor: '#0f766e',
        fillOpacity: 0.6,
        weight: 1.5,
      });
      bindPopup(marker, p.popup);
      layer.addLayer(marker);
    }
  }, [places]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    if (active.places && places.length) { if (!map.hasLayer(layer)) layer.addTo(map); }
    else if (map.hasLayer(layer)) map.removeLayer(layer);
  }, [map, active.places, places.length]);

  useEffect(() => () => { layerRef.current?.remove(); layerRef.current = null; }, []);

  return null;
}

/**
 * @param points  geotagged files, already normalised to { lat, lng, color, popup }
 * @param places  place mentions, same shape
 */
export default function DataLayers({ points = [], places = [] }) {
  // Bump the array identities only when the underlying data actually changes,
  // so the imperative layers above aren't rebuilt on every parent render.
  const stablePoints = useMemo(() => points, [points]);
  const stablePlaces = useMemo(() => places, [places]);

  return (
    <>
      <Density points={stablePoints} />
      <FileClusters points={stablePoints} />
      <FileMarkers points={stablePoints} />
      <PlaceMarkers places={stablePlaces} />
    </>
  );
}
