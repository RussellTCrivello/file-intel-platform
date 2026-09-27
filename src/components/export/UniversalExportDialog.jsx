import { useEffect, useMemo, useState } from 'react';
import {
  Download, Loader2, FileSpreadsheet, FileJson, FileText, FileArchive,
  FileType2, AtSign, ChevronUp, ChevronDown, Plus, X as XIcon, Info,
} from 'lucide-react';
import Modal from '../ui/Modal';
import { useSearchStore } from '../../store/useSearchStore';
import { search as searchApi, files as filesApi, dashboard as dashboardApi } from '../../lib/sylthaeApi';
import { toast } from '../ui/Toast';

// ---------------------------------------------------------------------
// The ONE export surface for the whole app (Layer 7). Every screen that
// can export something opens this dialog instead of inventing its own --
// it is a thin, honest front end over the real export endpoints:
//
//   Query-reuse exports (re-run the authoritative search/filter query
//   server-side, never trust what the browser happens to be holding):
//     - Api/services/search_export.py  -> /api/search/export            (database columns)
//     - Api/routes/search.py           -> /api/search/export-filenames  (names only)
//
//   Explicit-selection exports (an id list the caller already has):
//     - Api/blueprints/files.py -> /files/export                    (originals / extracted text, ZIP)
//     - Api/blueprints/files.py -> /api/files/names/export          (names only)
//     - Api/blueprints/files.py -> /api/files/first-pages/export    (first-page text/docx)
//     - Api/blueprints/files.py -> /api/files/extract-contacts/export (emails & links)
//
// Nothing here computes a result set, ranks anything, or invents a column
// that the server doesn't already publish -- it only lets the operator
// choose scope / kind / format / columns / filename for a request the
// server answers authoritatively.
// ---------------------------------------------------------------------

const COLUMN_PRESET_KEY = 'sylth.export.columns.v1';
const CAPS = { originals: 500, text: 500, filenames: 5000, 'first-pages': 200, contacts: 200, database: 500 };

const QUERY_KINDS = [
  { id: 'database', label: 'Database Columns', hint: 'Structured fields for every matching record', icon: FileSpreadsheet },
  { id: 'filenames', label: 'File Names Only', hint: 'Just the file name + type of every matching record', icon: FileText },
];
const SELECTION_KINDS = [
  { id: 'originals', label: 'Original Files', hint: 'The exact source files, zipped as stored on disk', icon: FileArchive },
  { id: 'text', label: 'Extracted Text', hint: 'One .txt of extracted content per file, zipped', icon: FileText },
  { id: 'database', label: 'Database Metadata', hint: 'Structured fields for the selected record(s) - same columns as a search export', icon: FileSpreadsheet },
  { id: 'filenames', label: 'File Names Only', hint: 'Just the file name + type of the selected files', icon: FileType2 },
  { id: 'first-pages', label: 'First-Page Extract', hint: 'First-page preview text, combined into one document', icon: FileText },
  { id: 'contacts', label: 'Emails & Links', hint: 'Email addresses and URLs found in the selected files', icon: AtSign },
];

const FORMATS_BY_KIND = {
  database: [['csv', 'CSV', FileText], ['excel', 'Excel', FileSpreadsheet], ['json', 'JSON', FileJson]],
  filenames: [['csv', 'CSV', FileText], ['excel', 'Excel', FileSpreadsheet]],
  'first-pages': [['txt', 'Text (.txt)', FileText], ['docx', 'Word (.docx)', FileType2]],
  contacts: [['csv', 'CSV', FileText], ['xlsx', 'Excel', FileSpreadsheet]],
  excerpt: [['txt', 'Text (.txt)', FileText], ['docx', 'Word (.docx)', FileType2]],
};

const DEFAULT_FORMAT = { database: 'csv', filenames: 'csv', 'first-pages': 'txt', contacts: 'csv', excerpt: 'txt' };

const NAME_TOKENS = ['{name}', '{extension}', '{source}', '{date}', '{id}', '{sequence}'];

function loadColumnPreset() {
  try {
    const raw = localStorage.getItem(COLUMN_PRESET_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveColumnPreset(columns) {
  try { localStorage.setItem(COLUMN_PRESET_KEY, JSON.stringify(columns)); } catch { /* ignore */ }
}

/**
 * @param mode 'query'     -- export what the current search/filters mean (re-run server-side)
 *             'selection' -- export exactly these file ids (a real selection the caller made)
 *             'excerpt'   -- export one already-on-screen piece of text (a manual selection, or
 *                            the context a search already matched on) with its document provenance
 * @param fileIds required for mode='selection'
 * @param excerpt required for mode='excerpt': { fileId, kind: 'selection'|'search_match', text, query? }
 * @param initialKind optional starting "Export" choice (e.g. open the selection dialog straight
 *                    into 'originals' from a Content Viewer "Export Original File" action)
 */
export default function UniversalExportDialog({ onClose, mode = 'query', fileIds = [], excerpt, title, initialKind }) {
  const kinds = mode === 'selection' ? SELECTION_KINDS : mode === 'excerpt' ? [] : QUERY_KINDS;
  const [kind, setKind] = useState((initialKind && kinds.some((k) => k.id === initialKind)) ? initialKind : (kinds[0]?.id || 'excerpt'));
  const [scope, setScope] = useState('filtered');
  const [format, setFormat] = useState(DEFAULT_FORMAT[mode === 'excerpt' ? 'excerpt' : (initialKind || kinds[0]?.id)] || 'csv');
  const [filename, setFilename] = useState('');
  const [namingTemplate, setNamingTemplate] = useState('');
  const [dedupe, setDedupe] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const [allColumns, setAllColumns] = useState(null); // [{key,label,default}]
  const [selectedColumns, setSelectedColumns] = useState([]);

  const [datasetTotal, setDatasetTotal] = useState(null);
  const pagination = useSearchStore((s) => s.pagination);
  const results = useSearchStore((s) => s.results);
  const exportResults = useSearchStore((s) => s.exportResults);
  const exportFilenames = useSearchStore((s) => s.exportFilenames);

  const uniqueFileIds = useMemo(() => Array.from(new Set(fileIds)), [fileIds]);

  // -- load column metadata once (needed only for kind='database') --
  useEffect(() => {
    let cancelled = false;
    searchApi.exportColumns().then((data) => {
      if (cancelled) return;
      const cols = data.columns || [];
      setAllColumns(cols);
      const preset = loadColumnPreset();
      const validKeys = new Set(cols.map((c) => c.key));
      const fromPreset = Array.isArray(preset) ? preset.filter((k) => validKeys.has(k)) : null;
      setSelectedColumns(fromPreset && fromPreset.length ? fromPreset : cols.filter((c) => c.default).map((c) => c.key));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // -- entire-dataset count, only needed for the query dialog's "dataset" scope --
  useEffect(() => {
    if (mode !== 'query') return;
    let cancelled = false;
    dashboardApi.stats().then((data) => { if (!cancelled) setDatasetTotal(data.analyzedDocs ?? data.totalFiles ?? null); }).catch(() => {});
    return () => { cancelled = true; };
  }, [mode]);

  useEffect(() => {
    if (mode === 'excerpt') return;
    setFormat(DEFAULT_FORMAT[kind] || 'csv');
  }, [kind, mode]);

  useEffect(() => {
    setFilename(defaultFilenameFor(mode, kind, scope, excerpt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, kind, scope]);

  const cap = CAPS[kind];
  const overCap = mode === 'selection' && cap && uniqueFileIds.length > cap;

  const scopeOptions = useMemo(() => {
    if (mode === 'selection') {
      return [{ id: 'selected', label: `Selected (${uniqueFileIds.length})`, count: uniqueFileIds.length }];
    }
    const pageCount = results?.length ?? 0;
    const filteredCount = pagination?.total ?? 0;
    return [
      { id: 'page', label: `Current Page (${pageCount})`, count: pageCount },
      { id: 'filtered', label: `All Filtered Results (${filteredCount})`, count: filteredCount },
      { id: 'dataset', label: `All Results in Database (${datasetTotal ?? '…'})`, count: datasetTotal },
    ];
  }, [mode, uniqueFileIds.length, results, pagination, datasetTotal]);

  const activeScope = mode === 'selection' ? 'selected' : scope;
  const activeCount = scopeOptions.find((s) => s.id === activeScope)?.count;

  const toggleColumn = (key) => {
    setSelectedColumns((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };
  const moveColumn = (index, dir) => {
    setSelectedColumns((prev) => {
      const next = [...prev];
      const swap = index + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[index], next[swap]] = [next[swap], next[index]];
      return next;
    });
  };
  const resetColumnsToDefault = () => {
    if (!allColumns) return;
    setSelectedColumns(allColumns.filter((c) => c.default).map((c) => c.key));
  };
  const selectAllColumns = () => { if (allColumns) setSelectedColumns(allColumns.map((c) => c.key)); };

  const run = async () => {
    if (kind === 'database' && selectedColumns.length === 0) {
      toast('Choose at least one column to export', { type: 'warning' });
      return;
    }
    if (overCap) {
      toast(`Select no more than ${cap} files for this export type`, { type: 'warning' });
      return;
    }
    setBusy(true);
    setLastResult(null);
    try {
      let res;
      if (mode === 'query') {
        if (kind === 'database') {
          res = await exportResults(scope, format, filename, selectedColumns);
          saveColumnPreset(selectedColumns);
        } else {
          res = await exportFilenames(scope, format, filename);
        }
      } else if (mode === 'excerpt') {
        res = await filesApi.exportExcerpt({ ...excerpt, format, filename });
      } else {
        if (kind === 'originals' || kind === 'text') {
          res = await filesApi.exportBatch({ fileIds: uniqueFileIds, mode: kind, filename, namingTemplate });
        } else if (kind === 'database') {
          // An explicit id list, not a query - Api/services/search_export.py's
          // 'selected' scope reads these exact rows directly. This never goes
          // through useSearchStore's query-based definition builder, so it
          // cannot be widened/narrowed by whatever the last search happened
          // to be.
          res = await searchApi.exportResults({
            export_scope: 'selected', path_ids: uniqueFileIds, format, filename, columns: selectedColumns,
          });
          saveColumnPreset(selectedColumns);
        } else if (kind === 'filenames') {
          res = await filesApi.exportNames({ scope: 'selected', fileIds: uniqueFileIds, format, filename });
        } else if (kind === 'first-pages') {
          res = await filesApi.exportFirstPages({ fileIds: uniqueFileIds, format, filename });
        } else if (kind === 'contacts') {
          res = await filesApi.exportContacts({ fileIds: uniqueFileIds, format, filename, dedupe });
        }
      }
      setLastResult(res);
      toast(mode === 'excerpt' ? `Exported ${res.filename}` : summarize(kind, res), { type: 'success' });
      onClose();
    } catch (e) {
      const body = e.body;
      let msg = e.message || 'Export failed';
      if (body?.missing_file_ids?.length) msg += ` (${body.missing_file_ids.length} record(s) no longer exist)`;
      if (body?.skipped?.length) msg += ` — ${body.skipped.length} file(s) could not be included`;
      toast(msg, { type: 'warning' });
    } finally {
      setBusy(false);
    }
  };

  const formats = mode === 'excerpt' ? FORMATS_BY_KIND.excerpt : FORMATS_BY_KIND[kind];
  const isZipKind = mode !== 'excerpt' && (kind === 'originals' || kind === 'text');

  return (
    <Modal onClose={onClose} title={title || (mode === 'excerpt' ? (excerpt?.kind === 'search_match' ? 'Export Search Match' : 'Export Selected Text') : mode === 'selection' ? 'Export Selected Files' : 'Export Results')} width={540}>
      <div className="space-y-4">
        {/* Excerpt mode -- one already-on-screen piece of text plus its document provenance. No scope/kind picker: there is exactly one thing to export. */}
        {mode === 'excerpt' && excerpt && (
          <div className="space-y-2 rounded-md border border-surface-border bg-surface-900/60 px-3 py-2 text-[11.5px]">
            <div className="flex justify-between text-slate-500">
              <span>{excerpt.kind === 'search_match' ? 'Search Query' : 'Source'}</span>
            </div>
            {excerpt.kind === 'search_match' && (
              <div className="text-slate-200"><span className="text-slate-500">Query: </span>&ldquo;{excerpt.query}&rdquo;</div>
            )}
            <div className="max-h-28 overflow-y-auto whitespace-pre-wrap rounded border border-surface-border/60 bg-surface-800/60 px-2 py-1.5 font-mono text-[11px] text-slate-300">
              {excerpt.text}
            </div>
            <div className="text-slate-600">Document name, source and side are attached automatically from the record - not retyped here.</div>
          </div>
        )}

        {/* Scope -- always shown, always a real count, never silently narrowed/widened */}
        {mode !== 'excerpt' && (
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Scope</label>
          {mode === 'selection' ? (
            <div className="rounded-md border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-[12.5px] font-medium text-blue-200">
              {scopeOptions[0].label}
            </div>
          ) : (
            <div className="space-y-1.5">
              {scopeOptions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setScope(s.id)}
                  className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left ${scope === s.id ? 'border-blue-500 bg-blue-500/10' : 'border-surface-border hover:border-slate-600'}`}
                >
                  <span className="text-[12.5px] font-medium text-slate-100">{s.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Kind -- what is being exported: original bytes vs. database content */}
        {mode !== 'excerpt' && (
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Export</label>
          <div className={`grid gap-1.5 ${kinds.length > 3 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {kinds.map((k) => (
              <button
                key={k.id}
                onClick={() => setKind(k.id)}
                className={`flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left ${kind === k.id ? 'border-blue-500 bg-blue-500/10' : 'border-surface-border hover:border-slate-600'}`}
              >
                <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-slate-100"><k.icon size={13} /> {k.label}</span>
                <span className="text-[11px] text-slate-500">{k.hint}</span>
              </button>
            ))}
          </div>
          {overCap && (
            <div className="mt-1.5 flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-[11.5px] text-amber-300">
              <Info size={12} /> Select no more than {cap} files for this export type ({uniqueFileIds.length} selected).
            </div>
          )}
        </div>
        )}

        {/* Columns (database export only) */}
        {mode !== 'excerpt' && kind === 'database' && (
          <ColumnPicker
            allColumns={allColumns}
            selectedColumns={selectedColumns}
            onToggle={toggleColumn}
            onMove={moveColumn}
            onSelectAll={selectAllColumns}
            onReset={resetColumnsToDefault}
          />
        )}

        {/* Format (kinds that have one) */}
        {formats && (
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Format</label>
            <div className="grid grid-cols-3 gap-1.5">
              {formats.map(([id, label, Icon]) => (
                <button
                  key={id}
                  onClick={() => setFormat(id)}
                  className={`flex flex-col items-center gap-1 rounded-md border py-2.5 text-[11.5px] font-medium ${format === id ? 'border-blue-500 bg-blue-500/10 text-blue-300' : 'border-surface-border text-slate-400 hover:border-slate-600'}`}
                >
                  <Icon size={16} /> {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {isZipKind && (
          <div className="rounded-md border border-surface-border bg-surface-800 px-3 py-2 text-[11.5px] text-slate-400">
            Delivered as a single <span className="font-medium text-slate-200">.zip</span> archive. Files that can't be included (e.g. a missing original) are skipped and listed inside the archive, not silently dropped.
          </div>
        )}

        {/* Dedupe toggle (contacts only) */}
        {kind === 'contacts' && (
          <label className="flex items-center gap-2 text-[12.5px] text-slate-300">
            <input type="checkbox" checked={dedupe} onChange={(e) => setDedupe(e.target.checked)} className="h-3.5 w-3.5 rounded border-surface-border" />
            Merge duplicate emails/links across all selected files into one row each
          </label>
        )}

        {/* Naming template (zip kinds only) */}
        {isZipKind && (
          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              File naming inside the archive <span className="font-normal normal-case text-slate-600">(optional)</span>
            </label>
            <input
              value={namingTemplate}
              onChange={(e) => setNamingTemplate(e.target.value)}
              placeholder="{name}{extension}  (leave blank to keep original names)"
              className="w-full rounded-md border border-surface-border bg-surface-800 px-3 py-2 text-[12.5px] text-slate-200 focus-ring font-mono"
            />
            <div className="mt-1 flex flex-wrap gap-1">
              {NAME_TOKENS.map((t) => (
                <button
                  key={t}
                  onClick={() => setNamingTemplate((v) => v + t)}
                  className="rounded border border-surface-border px-1.5 py-0.5 text-[10.5px] font-mono text-slate-400 hover:border-slate-500 hover:text-slate-200"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filename */}
        <div>
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">File name</label>
          <input
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            className="w-full rounded-md border border-surface-border bg-surface-800 px-3 py-2 text-[12.5px] text-slate-200 focus-ring"
          />
        </div>

        {/* Preview line */}
        <div className="rounded-md border border-surface-border bg-surface-900/60 px-3 py-2 text-[11.5px] text-slate-500">
          {mode === 'excerpt'
            ? `Will export this ${excerpt?.kind === 'search_match' ? 'search match' : 'text selection'} with its document provenance as ${String(format).toUpperCase()}.`
            : previewLine(kind, activeCount, format, kind === 'database' ? selectedColumns.length : null)}
        </div>

        <button
          onClick={run}
          disabled={busy || overCap}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2.5 text-[13px] font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {busy ? 'Exporting…' : 'Export'}
        </button>
      </div>
    </Modal>
  );
}

function ColumnPicker({ allColumns, selectedColumns, onToggle, onMove, onSelectAll, onReset }) {
  if (!allColumns) {
    return <div className="text-[12px] text-slate-500">Loading available columns…</div>;
  }
  const byKey = Object.fromEntries(allColumns.map((c) => [c.key, c]));
  const unselected = allColumns.filter((c) => !selectedColumns.includes(c.key));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Columns ({selectedColumns.length})</label>
        <div className="flex gap-2">
          <button onClick={onSelectAll} className="text-[11px] text-blue-400 hover:text-blue-300">All</button>
          <button onClick={onReset} className="text-[11px] text-slate-400 hover:text-slate-200">Default</button>
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto rounded-md border border-surface-border">
        {selectedColumns.map((key, index) => (
          <div key={key} className="flex items-center gap-1.5 border-b border-surface-border/60 px-2 py-1.5 last:border-b-0 bg-surface-800/40">
            <div className="flex flex-col">
              <button disabled={index === 0} onClick={() => onMove(index, -1)} className="text-slate-500 hover:text-slate-200 disabled:opacity-20"><ChevronUp size={11} /></button>
              <button disabled={index === selectedColumns.length - 1} onClick={() => onMove(index, 1)} className="text-slate-500 hover:text-slate-200 disabled:opacity-20"><ChevronDown size={11} /></button>
            </div>
            <span className="flex-1 text-[12px] text-slate-200">{byKey[key]?.label || key}</span>
            <button onClick={() => onToggle(key)} className="text-slate-500 hover:text-red-400"><XIcon size={13} /></button>
          </div>
        ))}
        {unselected.length > 0 && (
          <div className="flex flex-wrap gap-1 border-t border-surface-border bg-surface-900/40 px-2 py-1.5">
            {unselected.map((c) => (
              <button
                key={c.key}
                onClick={() => onToggle(c.key)}
                className="flex items-center gap-1 rounded border border-surface-border px-1.5 py-0.5 text-[11px] text-slate-400 hover:border-blue-500 hover:text-blue-300"
              >
                <Plus size={10} /> {c.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function defaultFilenameFor(mode, kind, scope, excerpt) {
  const stamp = new Date().toISOString().slice(0, 10);
  if (mode === 'excerpt') {
    const base = excerpt?.kind === 'search_match' ? 'search-match' : 'selected-text';
    return `${base}-${excerpt?.fileId ?? ''}-${stamp}`;
  }
  if (mode === 'selection') {
    const base = { originals: 'selected-originals', text: 'selected-extracted-text', database: 'selected-metadata', filenames: 'selected-file-names', 'first-pages': 'selected-first-pages', contacts: 'selected-contacts' }[kind] || 'export';
    return `${base}-${stamp}`;
  }
  const base = kind === 'database' ? 'search-results' : 'file-names';
  return `${base}-${scope}-${stamp}`;
}

function previewLine(kind, count, format, columnCount) {
  const countText = count === null || count === undefined ? 'an unknown number of' : count;
  switch (kind) {
    case 'database':
      return `Will export ${countText} record(s), ${columnCount} column(s), as ${String(format).toUpperCase()}.`;
    case 'filenames':
      return `Will export ${countText} file name(s) as ${String(format).toUpperCase()}.`;
    case 'originals':
      return `Will package ${countText} original file(s) into one ZIP.`;
    case 'text':
      return `Will package the extracted text of ${countText} file(s) into one ZIP.`;
    case 'first-pages':
      return `Will combine the first page of ${countText} file(s) into one ${String(format).toUpperCase()} document.`;
    case 'contacts':
      return `Will scan ${countText} file(s) for email addresses and links.`;
    default:
      return '';
  }
}

function summarize(kind, res) {
  if (!res) return 'Export complete';
  switch (kind) {
    case 'database':
      return `Exported ${res.rows || ''} row(s)${res.truncated === 'true' ? ' (truncated at server limit)' : ''} as ${res.filename}`;
    case 'filenames':
      return `Exported ${res.rows || ''} file name(s) as ${res.filename}`;
    case 'originals':
    case 'text':
      return `Exported ${res.included || '?'}/${res.requested || '?'} file(s)${Number(res.skipped) > 0 ? ` (${res.skipped} skipped)` : ''} as ${res.filename}`;
    case 'first-pages':
      return `Exported ${res.documents || '?'} document(s)${Number(res.unavailable) > 0 ? ` (${res.unavailable} unavailable)` : ''} as ${res.filename}`;
    case 'contacts':
      return `Found ${res.entities || '0'} unique item(s) across ${res.documents || '?'} document(s) as ${res.filename}`;
    default:
      return 'Export complete';
  }
}
