// Renderer-side access to the layer database.
//
// Reads go over HTTP from the app's own local host (`/layers/layers.db`),
// which is served both by the packaged Electron app and by the Vite dev
// server, so there is a single read path in either environment. Writes go
// through the preload bridge, because they change the file.
//
// Everything degrades: if there is no database, or it is corrupt, or this is a
// browser with no server, the basemap falls back to the data bundled into the
// JavaScript so the map still draws. The gazetteer simply stays empty, and
// place search says so, rather than the whole map disappearing.
import { openDatabase } from './layerDb.js';
import { loadGazetteer, gazetteerLoaded } from './geo/gazetteer.js';

const DB_URL = '/layers/layers.db';

const bridge = typeof window !== 'undefined' ? window.syltharaeLayers : undefined;

export const isDesktop = !!bridge?.available;
export const canWrite = isDesktop;

let dbPromise = null;
let statusCache = null;
const listeners = new Set();

function notify(payload) {
  for (const fn of listeners) { try { fn(payload); } catch { /* a bad listener must not break the others */ } }
}

export function onLayerDatabaseChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function loadOnce() {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    try {
      const response = await fetch(DB_URL, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.length) throw new Error('empty');
      const db = openDatabase(bytes);
      // Pull the gazetteer in eagerly: it is the one section every feature
      // that is not just "draw the map" depends on, and at ~700 KB
      // compressed it is a few milliseconds to inflate.
      if (db.sectionIds.includes('gazetteer')) loadGazetteer(db.readText('gazetteer'));
      return { ok: true, db, source: 'database' };
    } catch (error) {
      return { ok: false, error, source: 'bundled' };
    }
  })();
  return dbPromise;
}

/** Forget the cached database so the next read re-fetches (after a write). */
export function invalidateLayerDatabase() {
  dbPromise = null;
}

export async function getLayerDatabase() {
  return loadOnce();
}

/** Read one layer's text, or null if it is not in the database. */
export async function readLayer(id) {
  const result = await loadOnce();
  if (!result.ok) return null;
  try { return result.db.readText(id); } catch { return null; }
}

/** Read a TopoJSON basemap scale from the database, falling back to bundled. */
export async function readBasemap(scale) {
  const text = await readLayer(`basemap-${scale}`);
  if (text) return JSON.parse(text);
  return null;
}

export function hasGazetteer() {
  return gazetteerLoaded();
}

export async function getStatus({ refresh = false } = {}) {
  if (isDesktop) {
    if (statusCache && !refresh) return statusCache;
    const reply = await bridge.status();
    if (!reply.ok) throw new Error(reply.error);
    statusCache = reply.value;
    return statusCache;
  }
  // Browser: report what the HTTP layer told us.
  if (statusCache && !refresh) return statusCache;
  const result = await loadOnce();
  statusCache = {
    folder: '(read from the dev server)',
    location: 'dev',
    locationLabel: 'dev server',
    present: result.ok,
    bytes: null,
    sections: result.ok ? result.db.index.sections.map((s) => ({ id: s.id, kind: s.kind, meta: s.meta, length: s.length, rawLength: s.rawLength })) : [],
    created: result.ok ? result.db.index.created : null,
    error: result.ok ? null : String(result.error?.message || result.error),
  };
  return statusCache;
}

/** Persist a writable layer (user pins, imported GeoJSON). Desktop only. */
export async function writeLayer(id, kind, payload, meta) {
  if (!canWrite) throw new Error('Saving map layers needs the desktop application; the browser build can only read them.');
  const reply = await bridge.write(id, kind, typeof payload === 'string' ? payload : JSON.stringify(payload), meta);
  if (!reply.ok) throw new Error(reply.error);
  invalidateLayerDatabase();
  notify({ reason: 'write', id });
  return reply.value;
}

export async function downloadLayers(url) {
  if (!isDesktop) throw new Error('Downloading layers needs the desktop application; the browser build can only read the layers already on disk.');
  const reply = await bridge.download(url);
  if (!reply.ok) throw new Error(reply.error);
  invalidateLayerDatabase();
  notify({ reason: 'download' });
  return reply.value;
}

export async function removeLayers() {
  if (!isDesktop) throw new Error('Removing layers needs the desktop application.');
  const reply = await bridge.remove();
  if (!reply.ok) throw new Error(reply.error);
  invalidateLayerDatabase();
  notify({ reason: 'remove' });
  return reply.value;
}

if (isDesktop && bridge.onChanged) {
  bridge.onChanged((payload) => {
    if (payload?.reason !== 'ready') { invalidateLayerDatabase(); notify(payload); }
  });
}
