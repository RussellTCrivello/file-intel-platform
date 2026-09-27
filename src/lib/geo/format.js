// Coordinate parsing and formatting.
//
// Used by the map's search box, the live cursor readout, and every place a
// coordinate is written to the screen. Everything here is pure and offline.

// How many decimals is meaningful at roughly 1 m of resolution.
export const PRECISION_METRES = {
  '0': 0.01, '1': 0.001, '2': 0.0001, '3': 0.00001, '4': 0.000001, '5': 0.0000001, '6': 1e-7,
};

const clampLat = (v) => Math.max(-90, Math.min(90, v));
const clampLng = (v) => {
  // Longitude wraps rather than clamping: 181 is a legitimate way to write -179.
  let x = v;
  while (x > 180) x -= 360;
  while (x < -180) x += 360;
  return x;
};

export function isValidLat(v) { return Number.isFinite(v) && v >= -90 && v <= 90; }
export function isValidLng(v) { return Number.isFinite(v) && v >= -180 && v <= 180; }

/** Rounds to `decimals` without the float dust that toFixed can leave behind. */
export function roundCoord(v, decimals) {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

const HEMISPHERE = { N: 1, S: -1, E: 1, W: -1, n: 1, s: -1, e: 1, w: -1 };

/**
 * Parses one coordinate component. Accepts plain decimals, degrees with
 * decimal minutes, degrees/minutes/seconds, unicode primes, and trailing
 * hemisphere letters with or without a degree sign:
 *
 *   52.37   52°22'12"N   52 22 12 N   52°22.2'N   52.37n   N52.37
 *
 * Returns { value, hemisphere } or null. `hemisphere` is 1/-1/0 (unset).
 */
export function parseComponent(input, { min, max }) {
  if (input == null) return null;
  let text = String(input).trim();
  if (!text) return null;

  // A component may carry a hemisphere letter at either end, and a DMS pair
  // that arrived without a separator can have one on each ("N 4 53 24 E").
  // Collect them all and strip them, so the numeric part is clean.
  const letters = [];
  let m = text.match(/^([NSnsEWew])\s*/);
  if (m) { letters.push(HEMISPHERE[m[1]]); text = text.slice(m[0].length); }
  m = text.match(/\s*([NSnsEWew])\s*$/);
  if (m) { letters.push(HEMISPHERE[m[1]]); text = text.slice(0, m.index); }
  if (letters.some((h) => h !== letters[0])) return null; // "37 N ... W" contradicts itself
  const hemisphere = letters.length ? letters[0] : 0;

  text = text.replace(/[\u00b0\u00ba]/g, ' ')
    .replace(/[\u2032'\u2019]/g, ' ')
    .replace(/[\u2033"\u201c]/g, ' ')
    .replace(/,/g, '.')
    .trim();

  const parts = text.split(/\s+/).filter(Boolean).map(Number);
  if (parts.some((p) => !Number.isFinite(p))) return null;

  let degrees;
  if (parts.length === 0) return null;
  if (parts.length === 1) {
    degrees = parts[0];
  } else if (parts.length === 2) {
    // Decimal minutes: the fractional part of a "degree" is minutes.
    degrees = Math.abs(parts[0]) + (parts[0] < 0 ? -1 : 1) * (parts[1] / 60);
  } else if (parts.length === 3) {
    const sign = parts[0] < 0 ? -1 : 1;
    degrees = Math.abs(parts[0]) + sign * (parts[1] / 60) + sign * (parts[2] / 3600);
  } else {
    return null;
  }

  if (!Number.isFinite(degrees)) return null;
  if (hemisphere) degrees = hemisphere < 0 ? -Math.abs(degrees) : Math.abs(degrees);

  const limit = Math.max(Math.abs(min), Math.abs(max));
  if (Math.abs(degrees) > limit) return null;
  return { value: degrees, hemisphere };
}

/**
 * Parses a full "lat, lng" pair, or a single value when `axis` says which
 * one it is. Returns { lat, lng } or { error }.
 *
 * A comma is ambiguous -- it separates the two halves *and* acts as a decimal
 * mark in much of the world -- so separators are tried one at a time and the
 * first split that yields two valid components wins. That makes "52,37; 4,89"
 * work (European decimal commas plus a semicolon) without special-casing it.
 */
export function parseCoordinates(input, { axis = null } = {}) {
  const text = String(input ?? '').trim();
  if (!text) return { error: 'Enter a coordinate.' };

  const LAT = { min: -90, max: 90 };
  const LNG = { min: -180, max: 180 };

  if (axis === 'lat' || axis === 'lng') {
    const parsed = parseComponent(text, axis === 'lat' ? LAT : LNG);
    if (!parsed) return { error: `Not a valid ${axis === 'lat' ? 'latitude' : 'longitude'}.` };
    return axis === 'lat' ? { lat: parsed.value } : { lng: parsed.value };
  }

  const candidates = [];

  // Semicolon is unambiguous, so it is always tried first.
  for (const m of text.matchAll(/\s*;\s*/g)) {
    candidates.push([text.slice(0, m.index), text.slice(m.index + m[0].length)]);
  }
  // Then every comma: "52.37, 4.89" splits at the only comma, and a string
  // full of decimal commas fails to parse on either side, so it is skipped.
  for (const m of text.matchAll(/\s*,\s*/g)) {
    candidates.push([text.slice(0, m.index), text.slice(m.index + m[0].length)]);
  }
  // Then a DMS pair with no separator at all, where the hemisphere letters do
  // the splitting: 52°22'12"N 4°53'24"E, or "52 22 12 N 4 53 24 E".
  // This is tried before the whitespace split, because splitting that input on
  // whitespace would read "52" and "22" as the two halves of a pair.
  candidates.push(...splitOnHemispheres(text));
  // Finally plain whitespace, and only when it is exactly two tokens.
  const bits = text.split(/\s+/);
  if (bits.length === 2) candidates.push(bits);

  for (const [left, right] of candidates) {
    if (!left || !right) continue;
    const lat = parseComponent(left, LAT);
    const lng = parseComponent(right, LNG);
    if (lat && lng) return { lat: lat.value, lng: lng.value };
  }

  // If the user typed a separator they meant a pair, so say which half was
  // wrong rather than quietly reinterpreting the whole string as a latitude
  // ("0, 200" is a broken pair, not 0 degrees 12'00" north).
  if (/[;,]/.test(text)) {
    const parts = text.split(/\s*[;,]\s*/);
    if (parts.length === 2) {
      if (!parseComponent(parts[0], LAT)) return { error: 'Latitude must be between 90°S and 90°N.' };
      if (!parseComponent(parts[1], LNG)) return { error: 'Longitude must be between 180°W and 180°E.' };
    }
    return { error: 'Not a valid coordinate pair.' };
  }

  // A lone value is treated as a latitude, which is the common shorthand.
  const only = parseComponent(text, LAT);
  if (only) return { lat: only.value };
  if (parseComponent(text, LNG)) return { error: 'Enter a latitude as well as a longitude.' };

  return { error: "Not a valid coordinate. Try 52.37, 4.89 or 52°22'12\"N 4°53'24\"E." };
}

/**
 * Splits "52°22'12"N 4°53'24"E" at its hemisphere letters. Returns no
 * candidates when there is not exactly one N/S and one E/W letter.
 */
function splitOnHemispheres(text) {
  const ns = [...text.matchAll(/[NSns]/g)];
  const ew = [...text.matchAll(/[EWew]/g)];
  if (ns.length !== 1 || ew.length !== 1) return [];
  const n = ns[0];
  const e = ew[0];
  if (n.index === e.index) return [];
  // The N/S letter terminates the latitude; the E/W letter terminates the
  // longitude, whichever came first.
  const latEnd = Math.max(n.index, 0);
  const first = n.index < e.index
    ? [text.slice(0, n.index), text.slice(n.index, e.index + 1)]
    : [text.slice(e.index + 1), text.slice(0, e.index + 1)];
  void latEnd;
  return first[0] && first[1] ? [first] : [];
}

/** Decimal degrees, e.g. "52.37000, 4.89000". */
export function formatDecimal(lat, lng, decimals = 5) {
  return `${lat.toFixed(decimals)}, ${lng.toFixed(decimals)}`;
}

/**
 * Degrees / minutes / seconds, e.g. `52°22'12.0"N 4°53'24.0"E`.
 * Seconds carry one decimal so sub-arcsecond input is not silently rounded
 * away -- 0.1" is about 3 m, which matters when a coordinate came from GPS.
 */
export function formatDMS(value, axis, { secondsDecimals = 1 } = {}) {
  if (!Number.isFinite(value)) return '—';
  const hemisphere = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
  const abs = Math.abs(value);
  const degrees = Math.floor(abs);
  const minutesFull = (abs - degrees) * 60;
  const minutes = Math.floor(minutesFull);
  const seconds = (minutesFull - minutes) * 60;
  // Rounding seconds can carry into minutes/degrees; fold it back.
  let d = degrees;
  let m = minutes;
  let s = Number(seconds.toFixed(secondsDecimals));
  if (s >= 60) { s -= 60; m += 1; }
  if (m >= 60) { m -= 60; d += 1; }
  const secondsText = s.toFixed(secondsDecimals);
  return `${d}°${String(m).padStart(2, '0')}′${secondsText.padStart(3, '0')}″${hemisphere}`;
}

export function formatDMSPair(lat, lng, options) {
  return `${formatDMS(lat, 'lat', options)} ${formatDMS(lng, 'lng', options)}`;
}

/** Compact "52.37, 4.89" for tight spaces like popup corners. */
export function formatShort(lat, lng) {
  return `${roundCoord(lat, 4).toFixed(4)}, ${roundCoord(lng, 4).toFixed(4)}`;
}

/** Great-circle distance in kilometres. */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371.0088;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLng = (lng2 - lng1) * toRad;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial bearing from point 1 to point 2, in degrees from north. */
export function bearingDeg(lat1, lng1, lat2, lng2) {
  const toRad = Math.PI / 180;
  const φ1 = lat1 * toRad;
  const φ2 = lat2 * toRad;
  const Δλ = (lng2 - lng1) * toRad;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) / toRad + 360) % 360;
}

/** Bounding box of a centre point and radius, clamped to valid ranges. */
export function boundingBox(lat, lng, radiusKm) {
  const dLat = radiusKm / 110.574;
  const dLng = radiusKm / (111.320 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
  return {
    south: clampLat(lat - dLat),
    north: clampLat(lat + dLat),
    west: clampLng(lng - dLng),
    east: clampLng(lng + dLng),
  };
}

export function inBoundingBox(lat, lng, box) {
  const longitudeInside = box.west <= box.east
    ? lng >= box.west && lng <= box.east
    : lng >= box.west || lng <= box.east;
  return lat >= box.south && lat <= box.north && longitudeInside;
}
