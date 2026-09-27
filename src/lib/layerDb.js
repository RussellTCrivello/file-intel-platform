// The layer database: one compressed file holding every offline map layer.
//
// Layout (all little-endian):
//
//   0  .. 7   magic "SYLTLAY1"
//   8  .. 11  format version
//   12 .. 15  flags
//   16 .. 19  index offset
//   20 .. 23  index length (compressed, if flags bit 0 is set)
//   24 .. 27  crc32 of the stored index bytes
//   28 .. 31  crc32 of the whole file with the two crc fields zeroed
//
//   ... index bytes ...
//   ... section payloads, one after another ...
//
// The index is JSON describing each section (id, codec, byte range, metadata).
// Section payloads are deflate-compressed, which is what makes the database
// "compressed": 135k gazetteer rows and two Natural Earth scales fit in a
// few megabytes, and any single section can be inflated without touching the
// rest of the file.
//
// The format is versioned and checksummed on both halves, because the app
// rewrites this file when the user downloads new layers or saves their own
// pins, and a truncated write must fail loudly rather than produce a map that
// silently lost its coastline.
import { deflateSync, inflateSync } from 'fflate';

const MAGIC = 'SYLTLAY1';
const HEADER_BYTES = 32;
export const FORMAT_VERSION = 1;

const FLAG_INDEX_DEFLATED = 1 << 0;

const utf8 = new TextEncoder();
const utf8Decode = new TextDecoder();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u32(view, at) { return view.getUint32(at, true); }
function setU32(view, at, value) { view.setUint32(at, value >>> 0, true); }

/**
 * @param sections  [{ id, kind, data: Uint8Array|string, meta }]
 *                  `kind` is a layer kind ('basemap' | 'gazetteer' | 'user' | ...);
 *                  `meta` is free-form JSON kept in the index for the UI.
 * @param extra     additional top-level index fields (created, generator, ...)
 * @returns Uint8Array ready to write to disk
 */
export function packDatabase(sections, extra = {}) {
  const body = [];
  let offset = 0;
  const indexSections = [];

  for (const section of sections) {
    const raw = typeof section.data === 'string' ? utf8.encode(section.data) : section.data;
    const packed = deflateSync(raw, { level: 9 });
    body.push(packed);
    indexSections.push({
      id: section.id,
      kind: section.kind,
      codec: 'deflate',
      offset,
      length: packed.length,
      rawLength: raw.length,
      meta: section.meta || {},
    });
    offset += packed.length;
  }

  const index = {
    format: FORMAT_VERSION,
    ...extra,
    sections: indexSections,
  };
  const indexBytes = utf8.encode(JSON.stringify(index));
  const indexPacked = deflateSync(indexBytes, { level: 9 });
  const flags = FLAG_INDEX_DEFLATED;

  const file = new Uint8Array(HEADER_BYTES + indexPacked.length + offset);
  const view = new DataView(file.buffer);

  for (let i = 0; i < 8; i++) file[i] = MAGIC.charCodeAt(i);
  setU32(view, 8, FORMAT_VERSION);
  setU32(view, 12, flags);
  setU32(view, 16, HEADER_BYTES);
  setU32(view, 20, indexPacked.length);
  setU32(view, 24, crc32(indexPacked));
  setU32(view, 28, 0); // filled in below, once the body is in place

  file.set(indexPacked, HEADER_BYTES);
  let cursor = HEADER_BYTES + indexPacked.length;
  for (const chunk of body) {
    file.set(chunk, cursor);
    cursor += chunk.length;
  }

  setU32(view, 28, crc32(file));
  return file;
}

export function readHeader(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = String.fromCharCode(...bytes.subarray(0, 8));
  if (magic !== MAGIC) throw new Error(`Not a layer database (bad magic: ${JSON.stringify(magic)})`);
  const version = u32(view, 8);
  if (version > FORMAT_VERSION) {
    throw new Error(`Layer database is format v${version}; this app understands up to v${FORMAT_VERSION}. Update SYLTHARAE to read it.`);
  }
  return {
    version,
    flags: u32(view, 12),
    indexOffset: u32(view, 16),
    indexLength: u32(view, 20),
    indexCrc: u32(view, 24),
    fileCrc: u32(view, 28),
  };
}

/** Parse and verify. Throws with a specific reason on any corruption. */
export function openDatabase(bytes) {
  if (!bytes || bytes.length < HEADER_BYTES) throw new Error('Layer database is empty or truncated');
  const header = readHeader(bytes);

  // Whole-file checksum, with the stored file crc field treated as zero.
  const copy = bytes.slice();
  new DataView(copy.buffer).setUint32(28, 0, true);
  const actualFileCrc = crc32(copy);
  if (actualFileCrc !== header.fileCrc) {
    throw new Error('Layer database failed its integrity check (file is corrupt or was not fully written)');
  }

  const indexStored = bytes.subarray(header.indexOffset, header.indexOffset + header.indexLength);
  if (crc32(indexStored) !== header.indexCrc) {
    throw new Error('Layer database index failed its integrity check');
  }

  const indexBytes = header.flags & FLAG_INDEX_DEFLATED ? inflateSync(indexStored) : indexStored;
  const index = JSON.parse(utf8Decode.decode(indexBytes));

  const bodyStart = header.indexOffset + header.indexLength;
  return {
    header,
    index,
    sectionIds: index.sections.map((s) => s.id),
    meta: (id) => index.sections.find((s) => s.id === id)?.meta,
    /** Inflate one section. Throws if the range is out of bounds. */
    read(id) {
      const section = index.sections.find((s) => s.id === id);
      if (!section) throw new Error(`No such layer: ${id}`);
      const start = bodyStart + section.offset;
      const end = start + section.length;
      if (end > bytes.length) throw new Error(`Layer "${id}" runs past the end of the database`);
      const raw = bytes.subarray(start, end);
      return section.codec === 'deflate' ? inflateSync(raw) : raw;
    },
    readText(id) {
      return utf8Decode.decode(this.read(id));
    },
    readJSON(id) {
      return JSON.parse(this.readText(id));
    },
  };
}

export function sectionSize(db, id) {
  return db.index.sections.find((s) => s.id === id);
}
