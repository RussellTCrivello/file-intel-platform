// Offline raster tile store.
//
// Every live basemap (Standard, Aerial, Terrain) goes through this module:
//
//   * Browsing is cache-first. A tile that is already stored is drawn from
//     disk without touching the network; a tile that is fetched live is
//     written to the store as it arrives, so anywhere you have looked at
//     stays viewable after the connection drops.
//   * An area can be downloaded ahead of time for a zoom range, so a region
//     can be browsed in full detail with no connection at all.
//
// Storage is the browser Cache Storage API, which is persistent on disk in
// both Electron and a normal browser, and needs no backend support. Keys are
// normalised (no subdomain), so a tile fetched from a.tile… and b.tile… is
// stored once.

export const TILE_SOURCES = {
  standard: {
    label: 'Standard',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    maxNativeZoom: 19,
  },
  aerial: {
    label: 'Aerial',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
    maxNativeZoom: 19,
  },
  terrain: {
    label: 'Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org" target="_blank" rel="noreferrer">OpenTopoMap</a> (CC-BY-SA) &mdash; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OSM</a>',
    maxNativeZoom: 17,
    subdomains: 'abc',
  },
};

const CACHE_NAME = 'syltharae-map-tiles-v1';
const KEY_ORIGIN = 'https://tile-cache.invalid';
// A hard ceiling on a single download so a misclick at zoom 18 over a
// continent can't try to pull tens of millions of tiles.
export const MAX_DOWNLOAD_TILES = 60000;

export const cacheSupported = () => typeof caches !== 'undefined' && typeof fetch === 'function';

let cachePromise = null;
function openCache() {
  if (!cacheSupported()) return Promise.resolve(null);
  if (!cachePromise) cachePromise = caches.open(CACHE_NAME).catch(() => null);
  return cachePromise;
}

const tileKey = (mode, z, x, y) => `${KEY_ORIGIN}/${mode}/${z}/${x}/${y}`;

export function tileUrl(mode, z, x, y) {
  const source = TILE_SOURCES[mode];
  const subs = source.subdomains || '';
  const s = subs ? subs[Math.abs(x + y) % subs.length] : '';
  return source.url.replace('{s}', s).replace('{z}', z).replace('{x}', x).replace('{y}', y);
}

/** A stored tile as a Blob, or null. */
export async function getCachedTile(mode, z, x, y) {
  const cache = await openCache();
  if (!cache) return null;
  try {
    const hit = await cache.match(tileKey(mode, z, x, y));
    return hit ? await hit.blob() : null;
  } catch { return null; }
}

/** Fetch a tile from the network and store it. Resolves to a Blob. */
export async function fetchAndStoreTile(mode, z, x, y, signal) {
  const res = await fetch(tileUrl(mode, z, x, y), { mode: 'cors', credentials: 'omit', signal });
  if (!res.ok) throw new Error(`Tile ${z}/${x}/${y}: HTTP ${res.status}`);
  const blob = await res.blob();
  const cache = await openCache();
  if (cache) {
    try {
      await cache.put(tileKey(mode, z, x, y), new Response(blob, {
        headers: { 'Content-Type': blob.type || 'image/png', 'X-Stored-At': String(Date.now()) },
      }));
    } catch { /* Quota exceeded: still show the tile, just don't keep it. */ }
  }
  return blob;
}

/** Cache-first tile load used while browsing. */
export async function loadTile(mode, z, x, y) {
  const cached = await getCachedTile(mode, z, x, y);
  if (cached) return { blob: cached, fromCache: true };
  return { blob: await fetchAndStoreTile(mode, z, x, y), fromCache: false };
}

// --- Area downloads -------------------------------------------------------

const lon2x = (lng, z) => Math.floor(((lng + 180) / 360) * 2 ** z);
const lat2y = (lat, z) => {
  const clamped = Math.max(-85.0511, Math.min(85.0511, lat));
  const r = (clamped * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

function tileRange(bounds, z) {
  const max = 2 ** z - 1;
  const clamp = (v) => Math.max(0, Math.min(max, v));
  return {
    x0: clamp(lon2x(Math.max(-180, bounds.west), z)),
    x1: clamp(lon2x(Math.min(179.9999, bounds.east), z)),
    y0: clamp(lat2y(bounds.north, z)),
    y1: clamp(lat2y(bounds.south, z)),
  };
}

/** Number of tiles an area covers across [minZoom, maxZoom]. */
export function countTiles(bounds, minZoom, maxZoom) {
  let n = 0;
  for (let z = minZoom; z <= maxZoom; z++) {
    const r = tileRange(bounds, z);
    n += (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
  }
  return n;
}

function* enumerateTiles(bounds, minZoom, maxZoom) {
  for (let z = minZoom; z <= maxZoom; z++) {
    const r = tileRange(bounds, z);
    for (let x = r.x0; x <= r.x1; x++) for (let y = r.y0; y <= r.y1; y++) yield [z, x, y];
  }
}

/**
 * Download every tile of `mode` covering `bounds` for the zoom range.
 * Already-stored tiles are skipped. Calls onProgress({ done, total, failed,
 * skipped, bytes }). Abort with the AbortSignal.
 */
export async function downloadArea({ mode, bounds, minZoom, maxZoom, signal, onProgress, concurrency = 6 }) {
  const source = TILE_SOURCES[mode];
  if (!source) throw new Error(`Unknown basemap "${mode}"`);
  if (!cacheSupported()) throw new Error('Offline storage is not available in this environment.');
  const top = Math.min(maxZoom, source.maxNativeZoom);
  const total = countTiles(bounds, minZoom, top);
  if (total > MAX_DOWNLOAD_TILES) {
    throw new Error(`That area is ${total.toLocaleString()} tiles; the limit is ${MAX_DOWNLOAD_TILES.toLocaleString()}. Zoom in or lower the maximum zoom.`);
  }
  const cache = await openCache();
  const progress = { done: 0, total, failed: 0, skipped: 0, bytes: 0 };
  const iter = enumerateTiles(bounds, minZoom, top);

  const worker = async () => {
    for (;;) {
      if (signal?.aborted) return;
      const next = iter.next();
      if (next.done) return;
      const [z, x, y] = next.value;
      try {
        if (cache && await cache.match(tileKey(mode, z, x, y))) progress.skipped++;
        else progress.bytes += (await fetchAndStoreTile(mode, z, x, y, signal)).size;
      } catch (e) {
        if (signal?.aborted) return;
        progress.failed++;
      }
      progress.done++;
      onProgress?.({ ...progress });
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { ...progress, aborted: !!signal?.aborted };
}

/** Per-basemap stored tile counts. */
export async function cacheStats() {
  const cache = await openCache();
  const counts = Object.fromEntries(Object.keys(TILE_SOURCES).map((k) => [k, 0]));
  if (cache) {
    for (const req of await cache.keys()) {
      const mode = new URL(req.url).pathname.split('/')[1];
      if (mode in counts) counts[mode]++;
    }
  }
  let usage = null;
  let quota = null;
  try { ({ usage, quota } = await navigator.storage.estimate()); } catch { /* optional */ }
  return { counts, usage, quota };
}

/** Delete stored tiles, for one basemap or all of them. */
export async function clearTiles(mode) {
  if (!cacheSupported()) return;
  if (!mode) { await caches.delete(CACHE_NAME); cachePromise = null; return; }
  const cache = await openCache();
  if (!cache) return;
  const prefix = `${KEY_ORIGIN}/${mode}/`;
  await Promise.all((await cache.keys()).filter((r) => r.url.startsWith(prefix)).map((r) => cache.delete(r)));
}

/** Ask the browser not to evict the tile store under storage pressure. */
export async function requestPersistentStorage() {
  try { return await navigator.storage?.persist?.(); } catch { return false; }
}
