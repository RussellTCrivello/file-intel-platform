// Offline basemap geometry.
//
// Priority is the layer database on disk (map-layers/layers.db), then the copy
// bundled into the JavaScript. Both are Natural Earth via `world-atlas`
// (public domain), so a machine with no database still draws a complete map --
// it just has no 50m detail scale and no gazetteer until one is downloaded.
//
// Nothing in here touches the SYLTHARAE backend; the data-driven layers
// (files, clusters, heat, places) are separate and still read from the API.
import { feature } from 'topojson-client';
import countries110 from 'world-atlas/countries-110m.json';
import land110 from 'world-atlas/land-110m.json';
import { readBasemap } from './layerSource.js';

// At this zoom and above we swap the 110m overview for the 50m detail set.
export const DETAIL_ZOOM = 4;

const built = new Map();
let detailLoading = null;

// Planar centroid of a closed ring (shoelace). Used to place country labels
// without shipping a second label-point dataset.
function ringCentroid(ring) {
  let area = 0;
  let x = 0;
  let y = 0;
  for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const f = xj * yi - xi * yj;
    area += f;
    x += (xj + xi) * f;
    y += (yj + yi) * f;
  }
  if (area === 0) return ring[0];
  return [x / (3 * area), y / (3 * area)];
}

function ringArea(ring) {
  let a = 0;
  for (let i = 0, len = ring.length, j = len - 1; i < len; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(a / 2);
}

// Anchor a label on the largest landmass of a country, and report how big that
// landmass is. A plain bbox centre is wrong for anything straddling the
// antimeridian (Russia, Fiji, Antarctica), because their bounding box spans
// nearly the whole globe.
function labelAnchor(geometry) {
  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates]
    : geometry.type === 'MultiPolygon' ? geometry.coordinates
    : [];
  let best = null;
  let bestArea = -1;
  for (const poly of polygons) {
    const area = ringArea(poly[0]);
    if (area > bestArea) {
      bestArea = area;
      best = ringCentroid(poly[0]);
    }
  }
  return best ? { at: best, area: bestArea } : null;
}

function build(id, countriesTopo, landTopo) {
  const cached = built.get(id);
  if (cached) return cached;

  const countries = feature(countriesTopo, countriesTopo.objects.countries);
  const land = feature(landTopo, landTopo.objects.land);

  const labels = [];
  for (const f of countries.features) {
    const anchor = labelAnchor(f.geometry);
    if (anchor) labels.push({ name: f.properties.name, at: anchor.at, area: anchor.area });
  }

  const dataset = { id, countries, land, labels };
  built.set(id, dataset);
  return dataset;
}

// Minimum landmass area (in square degrees) worth labelling at each zoom.
// Natural Earth's 241 countries include a lot of island states whose labels
// are longer than the country is wide -- Monaco, the Caymans, S. Marino -- so
// an unfiltered layer is an unreadable pile over Europe and the Caribbean.
const LABEL_MIN_AREA = [
  { from: 6, area: 1.2 },
  { from: 5, area: 6 },
  { from: 4, area: 18 },
  { from: 0, area: 80 },
];

/**
 * Which country names to draw at a given zoom. Candidates are taken largest
 * first, then any that would overlap a label already placed is dropped, so
 * the biggest countries always win the space. Overlap is tested in an
 * approximate pixel grid (Leaflet's Web Mercator world is 256 * 2^zoom px
 * wide), which is close enough at these label sizes to keep the map clean.
 */
export function selectLabels(labels, zoom) {
  const min = (LABEL_MIN_AREA.find((t) => zoom >= t.from) || LABEL_MIN_AREA[LABEL_MIN_AREA.length - 1]).area;
  const pxPerDegree = (256 * 2 ** zoom) / 360;
  const placed = [];
  const chosen = [];

  const bySize = [...labels].sort((a, b) => b.area - a.area);
  for (const label of bySize) {
    if (label.area < min) continue;

    const textWidth = label.name.length * 5.4 + 10;
    const cx = (label.at[0] + 180) * pxPerDegree;
    const cy = (90 - label.at[1]) * pxPerDegree;
    const box = { x0: cx - textWidth / 2, x1: cx + textWidth / 2, y0: cy - 7, y1: cy + 7 };

    const collides = placed.some((p) => !(box.x1 < p.x0 || box.x0 > p.x1 || box.y1 < p.y0 || box.y0 > p.y1));
    if (collides) continue;

    placed.push(box);
    chosen.push(label);
  }
  return chosen;
}

/**
 * Basemap geometry for a zoom level. Returns the 110m overview synchronously
 * and the 50m detail set as a promise, which is only ever awaited once the
 * user has zoomed past DETAIL_ZOOM. Vite splits the 50m TopoJSON into its own
 * chunk, so a user who never zooms in never downloads it.
 */
export async function loadBasemap(zoom) {
  const scale = zoom < DETAIL_ZOOM ? '110m' : '50m';

  // 1. The layer database, which the user can update without a rebuild.
  const fromDatabase = await readBasemap(scale);
  if (fromDatabase?.countries?.objects?.countries) {
    return build(scale, fromDatabase.countries, fromDatabase.land);
  }

  // 2. The bundled copy. 110m is in the main bundle; 50m stays in its own
  //    lazily imported chunk so a session that never zooms in never loads it.
  if (scale === '110m') return build('110m', countries110, land110);
  if (!detailLoading) {
    detailLoading = Promise.all([
      import('world-atlas/countries-50m.json'),
      import('world-atlas/land-50m.json'),
    ]).then(([c, l]) => build('50m', c.default || c, l.default || l));
  }
  return detailLoading;
}

// Lat/lon grid, generated rather than shipped.
export function graticuleLines(step = 20) {
  const lines = [];
  for (let lon = -180; lon <= 180; lon += step) {
    const points = [];
    for (let lat = -80; lat <= 80; lat += 5) points.push([lat, lon]);
    lines.push({ kind: 'meridian', value: lon, points });
  }
  for (let lat = -80; lat <= 80; lat += step) {
    const points = [];
    for (let lon = -180; lon <= 180; lon += 5) points.push([lat, lon]);
    lines.push({ kind: 'parallel', value: lat, points });
  }
  return lines;
}
