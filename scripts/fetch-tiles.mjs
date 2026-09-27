#!/usr/bin/env node
// Download raster tiles straight into the bundled tile pack
// (map-layers/tiles), headless, before `npm run build:desktop`.
//
//   npm run tiles:fetch -- --maps standard,aerial --bbox 4.7,52.3,5.1,52.45 --zoom 2-14
//   npm run tiles:fetch -- --summary
//
//   --maps     comma list of standard | aerial | terrain   (default: standard)
//   --bbox     west,south,east,north in degrees             (default: whole world)
//   --zoom     min-max                                      (default: 0-5)
//   --concurrency N                                         (default: 4)
//
// Tiles already in the pack are skipped, so a run can be resumed. Respect
// each provider's tile usage policy -- OpenStreetMap in particular forbids
// heavy bulk downloading.
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { TILE_SOURCES, countTiles, tileUrl } from '../src/lib/tileCache.js';

const require = createRequire(import.meta.url);
const tilePack = require('../desktop/tilePack.cjs');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packRoot = path.join(root, 'map-layers');
const LIMIT = 250000;

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;
function printSummary() {
  const s = tilePack.summary(packRoot);
  console.log('\n  tile pack (map-layers/tiles):');
  for (const [map, v] of Object.entries(s)) {
    console.log(`    ${map.padEnd(9)} ${String(v.tiles).padStart(8)} tiles  ${mb(v.bytes).padStart(10)}  ${v.zooms ? `z${v.zooms[0]}–${v.zooms[1]}` : ''}`);
  }
}

if (args.summary) { printSummary(); process.exit(0); }

const maps = String(args.maps || 'standard').split(',').map((m) => m.trim()).filter(Boolean);
for (const m of maps) if (!TILE_SOURCES[m]) { console.error(`Unknown map "${m}". Use: ${Object.keys(TILE_SOURCES).join(', ')}`); process.exit(1); }
const [west, south, east, north] = args.bbox ? String(args.bbox).split(',').map(Number) : [-180, -85, 180, 85];
if (![west, south, east, north].every(Number.isFinite)) { console.error('--bbox must be west,south,east,north'); process.exit(1); }
const [minZoom, maxZoom] = String(args.zoom || '0-5').split('-').map(Number);
const bounds = { west, south, east, north };
const concurrency = Math.max(1, Math.min(16, Number(args.concurrency) || 4));

for (const map of maps) {
  const top = Math.min(maxZoom ?? minZoom, TILE_SOURCES[map].maxNativeZoom);
  const total = countTiles(bounds, minZoom, top);
  if (total > LIMIT) { console.error(`${map}: ${total.toLocaleString()} tiles exceeds ${LIMIT.toLocaleString()}; narrow --bbox or --zoom.`); process.exit(1); }
  console.log(`\n  ${map}: ${total.toLocaleString()} tiles, z${minZoom}–${top}`);

  const queue = [];
  for (let z = minZoom; z <= top; z++) {
    const n = 2 ** z;
    const x0 = Math.max(0, Math.floor(((west + 180) / 360) * n));
    const x1 = Math.min(n - 1, Math.floor(((Math.min(east, 179.9999) + 180) / 360) * n));
    const ty = (lat) => { const r = (Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180; return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n); };
    const y0 = Math.max(0, ty(north)); const y1 = Math.min(n - 1, ty(south));
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) queue.push({ map, z, x, y });
  }

  let done = 0; let got = 0; let skipped = 0; let failed = 0; let bytes = 0;
  const tick = () => process.stdout.write(`\r    ${done}/${total}  new ${got}  skipped ${skipped}  failed ${failed}  ${mb(bytes)}   `);
  const worker = async () => {
    for (let t = queue.shift(); t; t = queue.shift()) {
      if (fs.existsSync(tilePack.tileFile(packRoot, t))) skipped++;
      else {
        try {
          const res = await fetch(tileUrl(map, t.z, t.x, t.y), { headers: { 'User-Agent': 'SYLTHARAE-File-Intelligence tile packer' } });
          if (!res.ok) throw new Error(res.status);
          const buf = Buffer.from(await res.arrayBuffer());
          tilePack.writeTile(packRoot, t, buf);
          got++; bytes += buf.length;
        } catch { failed++; }
      }
      done++;
      if (done % 25 === 0 || done === total) tick();
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  tick();
  console.log('');
}
printSummary();
