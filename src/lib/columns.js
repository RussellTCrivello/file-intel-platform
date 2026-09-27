// Column registry for the table view. Every key here is either a real
// `/api/search` result field (adapted to camelCase by adaptRecord) or a
// value lazily filled in from `/api/file/<id>/details` (path, hash). There
// is no fabricated column (no `confidentiality`, `caseId`, `favorite`).
export const COLUMN_DEFS = [
  { key: 'select', label: '', defaultWidth: 36, alwaysVisible: true, sortable: false },
  { key: 'fileName', label: 'File Name', defaultWidth: 260, alwaysVisible: true },
  { key: 'type', label: 'Type', defaultWidth: 90 },
  { key: 'size', label: 'Size', defaultWidth: 90 },
  { key: 'source', label: 'Source', defaultWidth: 200, sortable: false },
  { key: 'side', label: 'Side', defaultWidth: 130, sortable: false },
  { key: 'status', label: 'Status', defaultWidth: 120, sortable: false },
  { key: 'analystCategories', label: 'Analyst Classification', defaultWidth: 180, sortable: false },
  { key: 'relevance', label: 'Relevance', defaultWidth: 90 },
  { key: 'matchedIn', label: 'Matched In', defaultWidth: 140, sortable: false },
  { key: 'path', label: 'Path', defaultWidth: 260, sortable: false },
  { key: 'fileDate', label: 'File Date', defaultWidth: 150 },
  { key: 'creationDate', label: 'Created', defaultWidth: 150, sortable: false },
  { key: 'hash', label: 'Hash', defaultWidth: 140, sortable: false },
  { key: 'actions', label: '', defaultWidth: 44, alwaysVisible: true, sortable: false },
];

export const DEFAULT_VISIBLE_COLUMNS = [
  'select', 'fileName', 'type', 'size', 'source', 'side', 'status', 'analystCategories', 'relevance', 'fileDate', 'actions',
];

export const DEFAULT_COLUMN_ORDER = COLUMN_DEFS.map((c) => c.key);

// The server only accepts sort_by in {relevance, date, name, type, size}
// (Api/routes/search.py) -- map a column key to that real vocabulary, or
// null when the column has no server-side sort (source/side/status are text
// joined in from other tables and are not part of the sortable set).
export const COLUMN_TO_SORT_FIELD = {
  fileName: 'name',
  type: 'type',
  size: 'size',
  fileDate: 'date',
  relevance: 'relevance',
};
