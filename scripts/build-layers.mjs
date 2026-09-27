#!/usr/bin/env node
// Assembles map-layers/layers.db from the vendored Natural Earth and GeoNames
// data in node_modules. Run via `npm run layers:build`.
//
// This is the "download" step for a build machine: it needs no network, because
// the sources are npm dependencies. The in-app downloader (Settings -> Map
// data) fetches the finished layers.db from a URL instead, which is how a
// deployed install picks up newer layer data without a rebuild.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { packDatabase } from '../src/lib/layerDb.js';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(root, 'map-layers');
const OUT_FILE = path.join(OUT_DIR, 'layers.db');

// GeoNames rows below this are too small to be useful as a search target and
// would roughly quadruple the database. ~26k places, which still covers every
// city anyone is likely to look up.
const MIN_POPULATION = 15000;

function bytes(n) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = n;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
  return `${value.toFixed(1)} ${units[i]}`;
}

function buildGazetteer() {
  const cities = require('all-the-cities');
  const kept = cities.filter((c) => c.population >= MIN_POPULATION);

  // Sorted by name so prefix search can stop early, and so the payload is
  // deterministic across builds (a stable byte-for-byte database is much
  // easier to checksum and to diff).
  kept.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : b.population - a.population));

  const rows = kept.map((c) => ({
    n: c.name,
    c: c.country,
    p: c.population,
    f: c.featureCode,
    // GeoNames stores longitude first.
    x: c.loc.coordinates[0],
    y: c.loc.coordinates[1],
  }));

  return {
    data: JSON.stringify({ minPopulation: MIN_POPULATION, rows }),
    meta: {
      label: 'Offline place gazetteer',
      description: 'GeoNames populated places, used for place search and reverse lookup',
      count: rows.length,
      minPopulation: MIN_POPULATION,
      source: 'all-the-cities (GeoNames, CC BY 4.0)',
    },
  };
}

function buildBasemap() {
  const sections = [];
  for (const scale of ['110m', '50m']) {
    const countries = require(`world-atlas/countries-${scale}.json`);
    const land = require(`world-atlas/land-${scale}.json`);
    sections.push({
      id: `basemap-${scale}`,
      kind: 'basemap',
      data: JSON.stringify({ scale, countries, land }),
      meta: {
        label: `Natural Earth ${scale}`,
        description: scale === '110m'
          ? 'World overview geometry: coastlines and country borders'
          : 'Detailed geometry for zoomed-in views',
        source: 'Natural Earth via world-atlas (public domain)',
        scale,
        countries: countries.objects.countries.geometries.length,
      },
    });
  }
  return sections;
}

function build() {
  const started = Date.now();
  const sections = [...buildBasemap()];

  process.stdout.write('  gazetteer … ');
  const gaz = buildGazetteer();
  sections.push({ id: 'gazetteer', kind: 'gazetteer', data: gaz.data, meta: gaz.meta });
  process.stdout.write(`${gaz.meta.count.toLocaleString()} places\n`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = packDatabase(sections, {
    created: new Date().toISOString(),
    generator: 'scripts/build-layers.mjs',
    app: 'SYLTHARAE File Intelligence',
  });
  fs.writeFileSync(OUT_FILE, file);

  console.log(`\n  wrote ${path.relative(root, OUT_FILE)}  (${bytes(file.length)}) in ${Date.now() - started} ms`);
  for (const s of sections) {
    console.log(`    ${s.id.padEnd(18)} ${s.kind.padEnd(10)} ${bytes(s.data.length)} raw`);
  }
}

build();
