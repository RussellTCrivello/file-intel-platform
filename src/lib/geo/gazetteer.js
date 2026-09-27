// Offline place search.
//
// Backed by the `gazetteer` section of the layer database (GeoNames populated
// places). Everything here runs locally -- there is no geocoding service to
// call, and none is needed once the database is on disk.
//
// The rows arrive pre-sorted by name, which lets prefix search binary-search
// instead of scanning, and lets a free-text search fall back to a linear scan
// only when the user has typed enough characters to justify one.
import { haversineKm } from './format.js';

let index = null;
let rows = [];
let lowerNames = null;

export function loadGazetteer(payload) {
  const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
  rows = data.rows || [];
  lowerNames = rows.map((r) => r.n.toLowerCase());
  index = {
    count: rows.length,
    minPopulation: data.minPopulation ?? 0,
    // Names, ready to render in a list, cheapest thing to build on load.
    names: rows.map((r) => r.n),
  };
  return index;
}

export function gazetteerLoaded() {
  return !!index;
}

export function gazetteerInfo() {
  return index;
}

/**
 * Search places by name.
 *
 * Ranking, in order: exact name, then names starting with the query, then
 * substring matches; within each of those, larger populations first. That puts
 * "London" ahead of "London Bridge" and "Londonderry" without needing a
 * fuzzy-matching library.
 */
export function searchPlaces(query, { limit = 12, minPopulation = 0 } = {}) {
  if (!index) return [];
  const q = String(query || '').trim();
  if (!q) return [];
  const lower = q.toLowerCase();

  // Binary search for the first row whose name is >= q (rows are name-sorted).
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (lowerNames[mid] < lower) lo = mid + 1; else hi = mid;
  }

  const exact = [];
  const prefix = [];
  for (let i = lo; i < rows.length; i++) {
    if (!lowerNames[i].startsWith(lower)) break;
    (lowerNames[i] === lower ? exact : prefix).push(rows[i]);
  }

  // Only scan the whole table for substring hits once the prefix run is short,
  // so a one-letter query does not cost 24k comparisons.
  let contains = [];
  if (q.length >= 4 && exact.length + prefix.length < limit) {
    contains = rows.filter((r, i) => !lowerNames[i].startsWith(lower) && lowerNames[i].includes(lower));
  }

  const byPopulation = (a, b) => b.p - a.p;
  return [...exact, ...prefix, ...contains]
    .filter((r) => r.p >= minPopulation)
    .sort((a, b) => byPopulation(a, b) || (a.n < b.n ? -1 : 1))
    .slice(0, limit)
    .map(shape);
}

function shape(r) {
  return {
    id: `${r.c}/${r.n}`,
    name: r.n,
    country: r.c,
    population: r.p,
    featureCode: r.f,
    lat: r.y,
    lng: r.x,
  };
}

/**
 * Nearest known place to a coordinate. Scans the full table, which is fine for
 * a single lookup but is never done in a render loop.
 */
export function nearestPlace(lat, lng, { limit = 5 } = {}) {
  if (!index) return [];
  const found = [];
  for (const r of rows) {
    // Cheap degree-space rejection before the haversine.
    if (Math.abs(r.y - lat) > 12 || Math.abs(r.x - lng) > 12) continue;
    found.push({ row: r, km: haversineKm(lat, lng, r.y, r.x) });
  }
  found.sort((a, b) => a.km - b.km);
  return found.slice(0, limit).map((f) => ({ ...shape(f.row), distanceKm: f.km }));
}

/** Which country polygon contains this point, from the basemap index. */
export function countryAt(countriesGeoJson, lat, lng) {
  if (!countriesGeoJson?.features) return null;
  for (const f of countriesGeoJson.features) {
    if (pointInGeometry(lng, lat, f.geometry)) return f.properties?.name || null;
  }
  return null;
}

function pointInGeometry(x, y, geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates]
    : geometry.type === 'MultiPolygon' ? geometry.coordinates
    : [];
  return polygons.some((poly) => ringContains(x, y, poly[0]) && !poly.slice(1).some((hole) => ringContains(x, y, hole)));
}

function ringContains(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
