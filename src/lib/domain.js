// Small, purely-presentational helpers: icon family/colour for a file
// extension, a deterministic colour for an arbitrary source/side name, and
// the adapter that turns one raw `/api/search` result row into the flat
// shape the view components read. None of this filters, ranks, sorts,
// paginates, or deduplicates anything -- it only renames/decorates fields
// the server already decided.

const TYPE_FAMILY_BY_EXT = {
  pdf: 'Document', doc: 'Document', docx: 'Document', txt: 'Document', rtf: 'Document',
  odt: 'Document', md: 'Document', html: 'Document', htm: 'Document',
  xls: 'Spreadsheet', xlsx: 'Spreadsheet', csv: 'Spreadsheet', ods: 'Spreadsheet',
  ppt: 'Presentation', pptx: 'Presentation', odp: 'Presentation',
  jpg: 'Image', jpeg: 'Image', png: 'Image', gif: 'Image', bmp: 'Image', tif: 'Image', tiff: 'Image', webp: 'Image',
  mp4: 'Video', mov: 'Video', avi: 'Video', mkv: 'Video',
  mp3: 'Audio', wav: 'Audio', flac: 'Audio', m4a: 'Audio',
  eml: 'Email', msg: 'Email',
  zip: 'Archive', rar: 'Archive', '7z': 'Archive',
  json: 'Data', xml: 'Data',
};

const FAMILY_COLOR = {
  Document: '#3b82f6', Spreadsheet: '#22c55e', Presentation: '#f97316', Image: '#a855f7',
  Video: '#ec4899', Audio: '#eab308', Email: '#14b8a6', Archive: '#64748b', Data: '#06b6d4',
};

export function extOf(fileType) {
  return String(fileType || '').replace(/^\./, '').toLowerCase();
}

export function typeFamilyOf(fileType) {
  return TYPE_FAMILY_BY_EXT[extOf(fileType)] || 'Document';
}

export function typeColorOf(fileType) {
  return FAMILY_COLOR[typeFamilyOf(fileType)] || '#64748b';
}

export function typeLabelOf(fileType) {
  const ext = extOf(fileType);
  return ext ? ext.toUpperCase() : 'FILE';
}

// Deterministic colour for a name the server gave us (source, side, ...) so
// the same name always renders the same colour without a hardcoded enum of
// "the sources that exist" (there is no such fixed list -- sources/sides are
// real, operator-defined rows in the database).
const PALETTE = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#14b8a6', '#eab308', '#ef4444', '#06b6d4', '#8b5cf6'];
export function colorForKey(key) {
  const s = String(key || '');
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export const STATUS_DEFS = [
  { id: 'Read', label: 'Analyzed', color: '#22c55e' },
  { id: 'Unread', label: 'Pending Analysis', color: '#eab308' },
];

export function statusDef(status) {
  return STATUS_DEFS.find((s) => s.id === status) || { id: status, label: status || 'Unknown', color: '#64748b' };
}

// One `/api/search` result row -> the flat record shape every view reads.
// Fields that only exist on the detail endpoint (path, hash, coordinates,
// full content) are left null here and filled in lazily by whichever
// component fetches `/api/file/<id>/details`.
export function adaptSearchResult(raw) {
  return {
    id: raw.id,
    fileName: raw.file_name,
    type: typeLabelOf(raw.file_type),
    typeRaw: raw.file_type,
    typeFamily: typeFamilyOf(raw.file_type),
    typeColor: typeColorOf(raw.file_type),
    size: raw.file_size,
    source: raw.source_name,
    sourceId: raw.source_id,
    side: raw.side_name,
    sideId: raw.side_id,
    status: raw.file_status,
    fileDate: raw.file_date,
    creationDate: raw.date_creation,
    relevance: raw.relevance_score,
    snippet: raw.snippet,
    // The server pre-escapes and wraps matches in <mark> for exactly this
    // field (Api/services/search_service.py `_find_matching_lines`) -- the
    // plain `snippet`/`line_text` siblings are NOT html-escaped, so they are
    // rendered as plain React text instead, never via dangerouslySetInnerHTML.
    snippetHtml: raw.line_matches?.[0]?.highlighted_line || null,
    matchedIn: raw.matched_in || [],
    matchFields: raw.match_fields || {},
    lineMatches: raw.line_matches || [],
    lineMatchCount: raw.line_match_count || 0,
    analystCategories: raw.analyst_categories || [],
    // Richer {id, name, color} objects (Api/services/analyst_categories.py
    // `attach_categories_to_results`) -- needed to render colored chips;
    // `analystCategories` above stays as the plain name list for anything
    // that only needs to display/filter on the label.
    analystCategoryDetails: raw.analyst_category_details || [],
    path: null,
    hash: null,
    coordinates: null,
    _raw: raw,
  };
}

// `/api/file/<id>/details` (Api/routes/api.py `api_file_details`) returns a
// differently-shaped, richer object than the search-result row: real
// extraction lineage (parent/derived files), smart categories, similar
// titles, and processing/provenance metadata. Adapted verbatim -- no field
// invented, nothing computed client-side.
export function adaptDetail(detail) {
  return {
    id: detail.id,
    fileName: detail.name,
    type: typeLabelOf(detail.type),
    typeRaw: detail.type,
    typeFamily: typeFamilyOf(detail.type),
    typeColor: typeColorOf(detail.type),
    size: detail.size,
    source: detail.source,
    side: detail.side,
    status: detail.status,
    fileDate: detail.file_date,
    creationDate: detail.date_creation,
    path: detail.path,
    hash: detail.hash,
    hashId: detail.hash_id,
    coordinates: detail.coordinates || null,
    // Real place-name mentions found by scanning this file's own extracted
    // text against the gazetteer (File Analysis: Geolocation --
    // Api/services/geo_extraction_service.py / path_geo_mentions). This is
    // the rich, possibly-multi-place data behind the single-point
    // `coordinates` field above.
    geoMentions: detail.geo_mentions || [],
    content: detail.content || '',
    wordCount: detail.word_count,
    contentChunks: detail.content_chunks,
    categories: detail.categories || [],
    // Analyst classification (Api/services/analyst_categories.py) -- a
    // deliberately separate namespace from `categories` (smart/system)
    // above; never merged into one list (§2/§37).
    analystCategories: detail.analyst_categories || [],
    analystAssignments: detail.analyst_assignments || [],
    title: detail.title,
    similarTitles: detail.similar_titles || [],
    extractionProvenance: detail.extraction_provenance || null,
    hierarchyPath: detail.hierarchy_path,
    processing: detail.processing || null,
    errorMessage: detail.error_message,
    lineage: detail.lineage || null,
    _raw: detail,
  };
}
