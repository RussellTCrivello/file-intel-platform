// The bundled raster tile pack: map-layers/tiles/<map>/<z>/<x>/<y>.tile
//
// This is the part of the offline map that ships with the application.
// Anything in it is copied into the installer by electron-builder (the
// `map-layers/**` extraResources entry), so tiles collected while online --
// browsed, downloaded with "Save offline", or fetched by
// `npm run tiles:fetch` -- are available to every copy of the build.
//
// Shared by the Vite dev server (vite.config.js), the desktop host
// (desktop/main.cjs) and the build scripts, so all three agree on the layout
// and on what a valid tile request looks like.
const fs = require('node:fs');
const path = require('node:path');

const MAPS = ['standard', 'aerial', 'terrain'];
const TILE_ROUTE = /^tiles\/([a-z]+)\/(\d{1,2})\/(\d{1,7})\/(\d{1,7})(?:\.tile)?$/;
const MAX_TILE_BYTES = 2 * 1024 * 1024;

/** Parse "tiles/<map>/<z>/<x>/<y>" (relative to /layers/). Null if invalid. */
function parseTilePath(name) {
  const m = TILE_ROUTE.exec(name);
  if (!m || !MAPS.includes(m[1])) return null;
  const [z, x, y] = [+m[2], +m[3], +m[4]];
  if (z > 22 || x >= 2 ** z || y >= 2 ** z) return null;
  return { map: m[1], z, x, y };
}

const tileFile = (root, t) => path.join(root, 'tiles', t.map, String(t.z), String(t.x), `${t.y}.tile`);

// Image formats tile servers actually return. Checked on write so the pack
// can only ever hold images, whatever a request body contains.
function isImage(buf) {
  if (buf.length < 12) return false;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true; // PNG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true; // JPEG
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return true;
  return false;
}

function mimeOf(buf) {
  if (buf[0] === 0x89) return 'image/png';
  if (buf[0] === 0xff) return 'image/jpeg';
  return 'image/webp';
}

/** First existing copy of the tile across the given roots, or null. */
function readTile(roots, t) {
  for (const root of roots) {
    if (!root) continue;
    const file = tileFile(root, t);
    try { return fs.readFileSync(file); } catch { /* try the next root */ }
  }
  return null;
}

function writeTile(root, t, buf) {
  if (!buf || buf.length > MAX_TILE_BYTES || !isImage(buf)) throw new Error('Not a tile image');
  const file = tileFile(root, t);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, file);
}

/** { map: { tiles, bytes, zooms: [min, max] } } for the pack under root. */
function summary(root) {
  const out = {};
  for (const map of MAPS) {
    const dir = path.join(root, 'tiles', map);
    const s = { tiles: 0, bytes: 0, zooms: null };
    if (fs.existsSync(dir)) {
      for (const z of fs.readdirSync(dir)) {
        const zDir = path.join(dir, z);
        if (!/^\d+$/.test(z) || !fs.statSync(zDir).isDirectory()) continue;
        for (const x of fs.readdirSync(zDir)) {
          const xDir = path.join(zDir, x);
          if (!fs.statSync(xDir).isDirectory()) continue;
          for (const f of fs.readdirSync(xDir)) {
            if (!f.endsWith('.tile')) continue;
            s.tiles++;
            s.bytes += fs.statSync(path.join(xDir, f)).size;
            s.zooms = s.zooms ? [Math.min(s.zooms[0], +z), Math.max(s.zooms[1], +z)] : [+z, +z];
          }
        }
      }
    }
    out[map] = s;
  }
  return out;
}

/**
 * Connect-style handler for GET/HEAD/PUT /layers/tiles/... . Returns true
 * if it handled the request. `roots` is the read order; writes go to
 * `writeRoot` (null disables writing).
 */
function handleTileRequest(req, res, name, { roots, writeRoot }) {
  if (!name.startsWith('tiles/')) return false;
  const t = parseTilePath(name);
  if (!t) { res.writeHead(400, { 'Content-Type': 'text/plain' }).end('Bad tile path'); return true; }

  if (req.method === 'GET' || req.method === 'HEAD') {
    const buf = readTile(roots, t);
    if (!buf) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Tile not in pack'); return true; }
    res.writeHead(200, { 'Content-Type': mimeOf(buf), 'Content-Length': buf.length, 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : buf);
    return true;
  }

  if (req.method === 'PUT') {
    if (!writeRoot) { res.writeHead(403, { 'Content-Type': 'text/plain' }).end('Tile pack is read-only'); return true; }
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_TILE_BYTES) { req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        writeTile(writeRoot, t, Buffer.concat(chunks));
        res.writeHead(204).end();
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'text/plain' }).end(e.message);
      }
    });
    return true;
  }

  res.writeHead(405, { Allow: 'GET, HEAD, PUT' }).end();
  return true;
}

module.exports = { MAPS, parseTilePath, tileFile, readTile, writeTile, isImage, summary, handleTileRequest };
