import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { files as filesApi } from '../lib/sylthaeApi';

// The one, shared Full Document Viewer (req #6/#18): every File Analysis
// dimension, Search Results, and RecordDetail open the SAME component for
// "show me this file's real content", rather than each growing its own
// spreadsheet/PDF/docx renderer.
//
// Deliberately NOT reimplemented from scratch. The legacy server-rendered
// reader at /file/<id>/full-content (templates/file/full_content.html +
// static/js/pages/full-content-page.js + modules/content-formatter.js) is
// a fully working, format-aware, already-tested renderer: real spreadsheet
// grids (worksheet columns/rows, not a flattened text dump), paragraph/
// heading structure for docx, native PDF embed, search-in-document with
// case/whole-word toggles and Prev/Next match navigation that lands on the
// actual cell/paragraph (see its own "Match N of M · <cell>" indicator).
// It already accepts ?q=/?whole_word=/?case_sensitive= and auto-locates the
// term on load. We frame it in an iframe (same-origin via the Vite proxy in
// dev, and the reverse proxy in production -- see vite.config.js) with
// ?embed=1, which the Flask view (Api/blueprints/files.py
// file_full_content) uses to relax X-Frame-Options/CSP for this one route
// only, and which base.html/full_content.html use to hide the app chrome
// (sidebar, top nav, "Page Tips") that would otherwise double up with this
// modal's own header.
export default function FullDocumentViewer() {
  const doc = useAppStore((s) => s.fullDocument);
  const close = useAppStore((s) => s.closeFullDocument);

  useEffect(() => {
    if (!doc) return undefined;
    const handler = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [doc, close]);

  if (!doc) return null;
  return createPortal(<ViewerBody doc={doc} close={close} />, document.body);
}

function ViewerBody({ doc, close }) {
  const openFullDocument = useAppStore((s) => s.openFullDocument);
  const [meta, setMeta] = useState({ loading: true, fileName: doc.fileName, error: null });
  const [frameLoaded, setFrameLoaded] = useState(false);

  // Position within the list this file was opened *from* (req #10's
  // "position-counter"/"N of M" and Prev/Next) -- not a global file count.
  // `resultIds` is the ordered id list the originating table actually
  // rendered (DataTable -> ActionsMenu -> openFullDocument); if this file
  // isn't in it (or none was carried, e.g. opened from RecordDetail with no
  // backing list) there is nothing honest to show, so the counter is simply
  // omitted rather than inventing a "1 of 1".
  const resultIds = doc.resultIds;
  const posIndex = resultIds ? resultIds.indexOf(doc.fileId) : -1;
  const hasPosition = resultIds && resultIds.length > 1 && posIndex !== -1;
  const goTo = useCallback((delta) => {
    if (!hasPosition) return;
    const nextIdx = posIndex + delta;
    if (nextIdx < 0 || nextIdx >= resultIds.length) return;
    openFullDocument({
      fileId: resultIds[nextIdx],
      fileName: null, // refetched below via /details, same as the initial open
      term: doc.term, wholeWord: doc.wholeWord, caseSensitive: doc.caseSensitive,
      origin: doc.origin, resultIds, resultTotal: doc.resultTotal,
    });
  }, [hasPosition, posIndex, resultIds, doc, openFullDocument]);

  useEffect(() => {
    if (!hasPosition) return undefined;
    const handler = (e) => {
      if (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowLeft' && e.altKey) goTo(-1);
      if (e.key === 'ArrowRight' && e.altKey) goTo(1);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [hasPosition, goTo]);

  // Header metadata (filename/type) comes from the same /api/file/<id>/details
  // endpoint RecordDetail already uses -- one file-identity source, not a
  // second lookup invented for this component.
  useEffect(() => {
    let alive = true;
    setFrameLoaded(false);
    filesApi.details(doc.fileId)
      .then((d) => { if (alive) setMeta({ loading: false, fileName: d?.details?.name || doc.fileName, error: null }); })
      .catch((e) => { if (alive) setMeta({ loading: false, fileName: doc.fileName, error: e.message || null }); });
    return () => { alive = false; };
  }, [doc.fileId]); // eslint-disable-line react-hooks/exhaustive-deps

  const embedSrc = useMemo(() => buildViewerUrl(doc, { embed: true }), [doc]);
  const newTabSrc = useMemo(() => buildViewerUrl(doc, { embed: false }), [doc]);

  const originLabel = describeOrigin(doc.origin);

  return (
    <div className="fixed inset-0 z-[400] flex flex-col bg-black/70 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true" aria-label="Full document viewer">
      <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col overflow-hidden border-x border-surface-border bg-surface-900 shadow-2xl shadow-black/60 sm:my-3 sm:h-[calc(100%-24px)] sm:rounded-xl sm:border">
        {/* Header: back-to-origin / filename / position / open-in-new-tab / close */}
        <div className="flex items-center gap-3 border-b border-surface-border bg-surface-850 px-4 py-2.5">
          <button
            onClick={close}
            className="flex items-center gap-1.5 rounded p-1.5 text-slate-400 hover:bg-surface-700 hover:text-slate-200 focus-ring"
            title={originLabel ? `Back to ${originLabel}` : 'Back'}
            aria-label="Close viewer"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 truncate text-[13.5px] font-semibold text-white">
              {meta.loading && <Loader2 size={13} className="animate-spin text-slate-500" />}
              <span className="truncate">{meta.fileName || `File #${doc.fileId}`}</span>
            </div>
            {originLabel && (
              <div className="truncate text-[11px] text-slate-500">
                Opened from {originLabel}
                {doc.term ? <> · searching for <span className="text-slate-300">&ldquo;{doc.term}&rdquo;</span></> : null}
              </div>
            )}
          </div>
          {hasPosition && (
            <div className="flex items-center gap-1 rounded-md border border-surface-border bg-surface-800/60 px-1 py-1 text-[12px] text-slate-300">
              <button
                onClick={() => goTo(-1)}
                disabled={posIndex <= 0}
                title="Previous file in this list (Alt+←)"
                aria-label="Previous file"
                className="rounded p-1 hover:bg-surface-700 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent focus-ring"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="whitespace-nowrap px-1 font-medium tabular-nums">
                {posIndex + 1} of {resultIds.length}
                {doc.resultTotal != null && doc.resultTotal > resultIds.length ? ` (${doc.resultTotal} total)` : ''}
              </span>
              <button
                onClick={() => goTo(1)}
                disabled={posIndex >= resultIds.length - 1}
                title="Next file in this list (Alt+→)"
                aria-label="Next file"
                className="rounded p-1 hover:bg-surface-700 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent focus-ring"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
          <a
            href={newTabSrc}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] font-medium text-slate-300 hover:bg-surface-700 hover:text-white focus-ring"
          >
            <ExternalLink size={13} /> Open in New Tab
          </a>
          <button
            onClick={close}
            className="rounded p-1.5 text-slate-400 hover:bg-surface-700 hover:text-slate-200 focus-ring"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content: the reused, format-aware reader, framed same-origin */}
        <div className="relative flex-1 bg-white">
          {!frameLoaded && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-surface-900 text-slate-500">
              <Loader2 size={16} className="animate-spin" /> Loading document…
            </div>
          )}
          <iframe
            key={embedSrc}
            src={embedSrc}
            title={meta.fileName || 'Document viewer'}
            className="h-full w-full border-0"
            onLoad={() => setFrameLoaded(true)}
          />
        </div>
      </div>
    </div>
  );
}

function buildViewerUrl(doc, { embed }) {
  const params = new URLSearchParams();
  if (embed) params.set('embed', '1');
  if (doc.term) {
    params.set('q', doc.term);
    if (doc.wholeWord) params.set('whole_word', '1');
    if (doc.caseSensitive) params.set('case_sensitive', '1');
  }
  const qs = params.toString();
  return `/file/${doc.fileId}/full-content${qs ? `?${qs}` : ''}`;
}

function describeOrigin(origin) {
  if (!origin || typeof origin !== 'object') return null;
  const { section, category, word, keyword, title, source, side, place } = origin;
  switch (section) {
    case 'categoryWords': return category ? `Categories → ${category} → Words${word ? ` → “${word}”` : ''}` : 'Category Words';
    case 'categoryKeywords': return category ? `Categories → ${category} → Keywords${keyword ? ` → “${keyword}”` : ''}` : 'Category Keywords';
    case 'words': return word ? `Words → “${word}”` : 'Words';
    case 'keywords': return keyword ? `Keywords → “${keyword}”` : 'Keywords';
    case 'titles': return title ? `Titles → “${title}”` : 'Titles';
    case 'sources': return source ? `Sources → ${source}` : 'Sources';
    case 'sides': return side ? `Sides → ${side}` : 'Sides';
    case 'relations': return (source || side) ? `Relations → ${source || '?'} × ${side || '?'}` : 'Relations';
    case 'geolocation': return place ? `Geolocation → ${place}` : 'Geolocation';
    case 'search': return 'Search Results';
    case 'recordDetail': return 'File Details';
    default: return section || null;
  }
}
