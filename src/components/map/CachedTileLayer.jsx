import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { TILE_SOURCES, loadTile, tileUrl } from '../../lib/tileCache';

// A TileLayer whose tiles come from the offline store first and the network
// second (storing what it fetches). Built imperatively because the tile
// loading hook, createTile, is the part we need to replace.
const CachedLayer = L.TileLayer.extend({
  createTile(coords, done) {
    const img = document.createElement('img');
    img.alt = '';
    img.setAttribute('role', 'presentation');
    const { mode } = this.options;
    const z = this._getZoomForUrl();
    loadTile(mode, z, coords.x, coords.y)
      .then(({ blob }) => {
        const url = URL.createObjectURL(blob);
        img.onload = () => { URL.revokeObjectURL(url); done(null, img); };
        img.onerror = () => { URL.revokeObjectURL(url); done(new Error('Bad tile image'), img); };
        img.src = url;
      })
      .catch((error) => {
        // Not stored and not fetchable with CORS. If we're online, let the
        // browser load it directly (it just won't be kept); if not, report the
        // error so the bundled vector basemap shows through.
        if (navigator.onLine === false) { done(error, img); return; }
        img.onload = () => done(null, img);
        img.onerror = () => done(error, img);
        img.src = tileUrl(mode, z, coords.x, coords.y);
      });
    return img;
  },
});

export default function CachedTileLayer({ mode, onTileStatus }) {
  const map = useMap();
  const statusRef = useRef(onTileStatus);
  statusRef.current = onTileStatus;

  useEffect(() => {
    const source = TILE_SOURCES[mode];
    if (!source) return undefined;
    const layer = new CachedLayer('', {
      mode,
      attribution: source.attribution,
      maxNativeZoom: source.maxNativeZoom,
      maxZoom: 19,
    });
    layer.on('loading', () => statusRef.current?.('loading'));
    layer.on('load', () => statusRef.current?.('ready'));
    layer.on('tileerror', () => statusRef.current?.('error'));
    layer.addTo(map);
    return () => { map.removeLayer(layer); };
  }, [map, mode]);

  return null;
}
