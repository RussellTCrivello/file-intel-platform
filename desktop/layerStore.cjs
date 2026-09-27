// Main-process owner of the map-layers database.
//
// The renderer runs sandboxed with no filesystem access at all, so every read
// and write of map-layers/ goes through here over IPC.
//
// Folder resolution: the database is meant to live inside the project's own
// directory, readable *and* writable. That works in dev and in portable/zip
// builds, but an installed .dmg / NSIS build sits in a read-only location
// (/Applications, C:\Program Files) where the OS refuses the write. So we
// prefer the program directory and fall back to the per-user application data
// directory when it is not writable -- and we report which one was actually
// used, so the UI never lies about where the data is.
const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const FOLDER_NAME = 'map-layers';
const DB_FILE = 'layers.db';
const MAX_DOWNLOAD_BYTES = 256 * 1024 * 1024;
const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'file:']);
// Overridable so the download path can be exercised without a minute-long wait.
const DOWNLOAD_TIMEOUT_MS = Number(process.env.SYLTHARAE_LAYER_TIMEOUT_MS) || 60_000;

// The binary format lives in src/lib/layerDb.js as an ES module so the
// renderer can use exactly the same reader. Electron's main process can
// dynamically import ES modules, so there is one implementation of a
// checksummed format rather than two that can drift apart. It is added to
// electron-builder's `files` list so it ships inside the asar.
let formatPromise = null;
function format() {
  if (!formatPromise) formatPromise = import('../src/lib/layerDb.js');
  return formatPromise;
}

let resolved = null;

function programDir() {
  // Packaged: the app lives at <Resources>/app.asar, so its directory is
  // <Resources>. In dev __dirname is <project>/desktop, so the project root
  // is one level up.
  return app.isPackaged ? path.join(process.resourcesPath) : path.join(__dirname, '..');
}

function writable(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.write-probe-${process.pid}`);
    fs.writeFileSync(probe, '');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

function resolveFolder() {
  if (resolved) return resolved;

  const preferred = path.join(programDir(), FOLDER_NAME);
  if (writable(preferred)) {
    resolved = { dir: preferred, location: 'program', label: 'program directory' };
    return resolved;
  }

  const fallback = path.join(app.getPath('userData'), FOLDER_NAME);
  if (writable(fallback)) {
    // `preferred` may still hold the copy electron-builder shipped, even though
    // that folder cannot be written to. Remember it so the first read can seed
    // the writable location -- otherwise a fresh install in a read-only place
    // (/Applications, C:\Program Files) would come up with no gazetteer.
    resolved = { dir: fallback, location: 'userData', label: 'per-user application data', seed: preferred };
    return resolved;
  }

  // Neither is writable. Keep the preferred path so the UI can report a
  // concrete location instead of failing silently.
  resolved = { dir: preferred, location: 'unwritable', label: 'program directory (read-only)' };
  return resolved;
}

const dbPath = () => path.join(resolveFolder().dir, DB_FILE);

/** Copy the shipped database into the writable folder the first time we need it. */
function seedFromShipped() {
  const folder = resolveFolder();
  if (!folder.seed) return;
  const from = path.join(folder.seed, DB_FILE);
  const to = dbPath();
  if (fs.existsSync(to) || !fs.existsSync(from)) return;
  try {
    fs.copyFileSync(from, to);
  } catch {
    // Unreadable source, or no room to copy. The map falls back to the bundled
    // Natural Earth import and the settings panel reports what is present.
  }
}

function readRaw() {
  seedFromShipped();
  const file = dbPath();
  if (!fs.existsSync(file)) return null;
  return new Uint8Array(fs.readFileSync(file));
}

async function summary() {
  const folder = resolveFolder();
  seedFromShipped();
  const base = { folder: folder.dir, location: folder.location, locationLabel: folder.label };

  let bytes;
  try { bytes = fs.existsSync(dbPath()) ? fs.statSync(dbPath()).size : null; } catch { bytes = null; }
  if (bytes === null) return { ...base, present: false, sections: [] };

  const stat = fs.statSync(dbPath());
  let index = null;
  let error = null;
  try {
    const raw = readRaw();
    if (!raw) throw new Error('database file is unreadable');
    const { openDatabase } = await format();
    index = openDatabase(raw).index;
  } catch (e) {
    error = e.message;
  }

  return {
    ...base,
    present: true,
    bytes,
    modified: stat.mtime.toISOString(),
    created: index?.created || null,
    generator: index?.generator || null,
    error,
    sections: (index?.sections || []).map((s) => ({
      id: s.id, kind: s.kind, meta: s.meta, length: s.length, rawLength: s.rawLength,
    })),
  };
}

async function readSection(id) {
  const raw = readRaw();
  if (!raw) throw new Error('No layer database found. Download map layers from Settings > Map data.');
  const { openDatabase } = await format();
  const db = openDatabase(raw);
  if (!db.sectionIds.includes(id)) throw new Error(`No such layer: ${id}`);
  return { id, kind: db.meta(id)?.kind, meta: db.meta(id), text: db.readText(id) };
}

/**
 * Rewrite one section, keeping every other section's content. This is what
 * lets the app store user pins and imported layers in the same file it reads
 * its basemap from.
 */
async function writeSection(id, kind, text, meta) {
  const { packDatabase, openDatabase } = await format();

  const existingRaw = readRaw();
  const existing = existingRaw ? openDatabase(existingRaw) : null;

  const sections = existing
    ? existing.index.sections.map((s) => ({
      id: s.id, kind: s.kind, data: existing.readText(s.id), meta: s.meta,
    }))
    : [];
  const at = sections.findIndex((s) => s.id === id);
  const entry = { id, kind, data: text, meta: meta || {} };
  if (at >= 0) sections[at] = entry; else sections.push(entry);

  const packed = packDatabase(sections, {
    created: existing?.index.created || new Date().toISOString(),
    generator: existing?.index.generator || 'SYLTHARAE in-app',
  });
  const file = writeRaw(packed);
  return { path: file, bytes: packed.length, sections: sections.map((s) => s.id) };
}

function writeRaw(raw) {
  if (resolveFolder().location === 'unwritable') {
    throw new Error(
      `Cannot write to ${resolveFolder().dir}. The application is installed in a read-only location; `
      + 'rebuild with the layer database bundled, or move the application to a writable folder.',
    );
  }
  const file = dbPath();
  // Write beside the target and rename, so an interrupted write can never
  // leave a half-written database the renderer would then fail to parse.
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, Buffer.from(raw));
  fs.renameSync(tmp, file);
  return file;
}

function removeDatabase() {
  const file = dbPath();
  if (fs.existsSync(file)) fs.unlinkSync(file);
  return { removed: true, path: file };
}

function fetchOnce(url, redirects, signal) {
  return new Promise((resolvePromise, rejectPromise) => {
    const transport = url.protocol === 'https:' ? require('node:https') : require('node:http');
    const req = transport.get(url, { signal }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirects > 5) { rejectPromise(new Error('Too many redirects')); return; }
        fetchOnce(new URL(res.headers.location, url), redirects + 1, signal)
          .then(resolvePromise, rejectPromise);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        rejectPromise(new Error(`Server returned HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      let total = 0;
      res.on('data', (chunk) => {
        total += chunk.length;
        if (total > MAX_DOWNLOAD_BYTES) {
          req.destroy();
          rejectPromise(new Error('Layer database is larger than the 256 MB limit; refusing to download'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolvePromise(Buffer.concat(chunks)));
      res.on('error', rejectPromise);
    });
    req.on('error', rejectPromise);
  });
}

async function download(urlString) {
  let url;
  try { url = new URL(urlString); }
  catch { throw new Error(`Invalid URL: ${urlString}`); }
  if (!ALLOWED_SCHEMES.has(url.protocol)) {
    throw new Error(`Refusing to download over ${url.protocol}; use http, https, or a local file path`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  let buffer;
  try {
    buffer = await fetchOnce(url, 0, controller.signal);
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`Download timed out (${DOWNLOAD_TIMEOUT_MS} ms limit)`);
    throw e;
  } finally {
    clearTimeout(timer);
  }

  // Validate before overwriting working layers: a truncated or wrong file
  // would otherwise replace good data with something that fails to parse.
  const { openDatabase } = await format();
  let index;
  try {
    index = openDatabase(new Uint8Array(buffer)).index;
  } catch (e) {
    throw new Error(`Downloaded file is not a usable layer database: ${e.message}`);
  }

  const file = writeRaw(new Uint8Array(buffer));
  return {
    path: file,
    bytes: buffer.length,
    created: index.created || null,
    sections: index.sections.map((s) => s.id),
  };
}

module.exports = { FOLDER_NAME, DB_FILE, resolveFolder, dbPath, summary, readSection, writeSection, download, removeDatabase };
