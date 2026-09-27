import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy, Check, ChevronUp, ChevronDown, GitCompare, Bookmark, BookmarkCheck, Loader2, AlertTriangle,
  MapPin, Hash as HashIcon, Tags, Plus, Download, ExternalLink, FolderOpen, ScissorsLineDashed,
  FileSpreadsheet, FileType2, FileText, Search, X as XIcon, Info,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useSearchStore } from '../store/useSearchStore';
import { files as filesApi } from '../lib/sylthaeApi';
import { adaptDetail } from '../lib/domain';
import { segmentText, findLiteralRanges } from '../lib/highlight';
import { formatBytes, formatDate, copyToClipboard } from '../lib/format';
import FileTypeIcon from './cells/FileTypeIcon';
import { TypeBadge, StatusBadge, SideBadge, AnalystCategoryChip } from './cells/Badges';
import { toast } from './ui/Toast';
import ClassifyDialog from './ClassifyDialog';
import UniversalExportDialog from './export/UniversalExportDialog';

function ToolBtn({ icon: Icon, label, onClick, active }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium ${active ? 'border-blue-500 bg-blue-500/10 text-blue-300' : 'border-surface-border bg-surface-800 text-slate-300 hover:border-slate-600 hover:text-white'}`}
    >
      <Icon size={12} /> {label}
    </button>
  );
}

// The read-only "Document/Content Viewer" half of the Search Results | Reader
// split view (Layer 4). It fetches the one real detail endpoint
// (`/api/file/<id>/details`) for the full extracted text, and highlights
// occurrences of the query the server already matched on -- honoring the
// same case-sensitive/whole-word switches the user set in Advanced Search
// -- rather than re-running or re-ranking any search. The "why/where it
// matched" panel renders the server's own `line_matches`/`matched_in`
// fields from the search result row verbatim.
export default function ReaderPane({ recordId, matchInfo }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [matchCursor, setMatchCursor] = useState(0);
  const [classifyOpen, setClassifyOpen] = useState(false);
  const [removingCategoryId, setRemovingCategoryId] = useState(null);
  const [originalInfo, setOriginalInfo] = useState(null);
  const [selectedText, setSelectedText] = useState('');
  const [activeLineMatchIndex, setActiveLineMatchIndex] = useState(0);
  const [exportConfig, setExportConfig] = useState(null); // props for <UniversalExportDialog>, or null
  const [showOriginal, setShowOriginal] = useState(false);
  const [showLocate, setShowLocate] = useState(false);
  const containerRef = useRef(null);
  const markRefs = useRef([]);

  const query = useSearchStore((s) => s.query);
  const options = useSearchStore((s) => s.options);
  const classifyRemove = useSearchStore((s) => s.classifyRemove);
  const bookmarkedIds = useAppStore((s) => s.bookmarkedIds);
  const toggleBookmark = useAppStore((s) => s.toggleBookmark);
  const addToCompare = useAppStore((s) => s.addToCompare);

  const reloadDetail = () => {
    if (!recordId) return;
    filesApi.details(recordId).then((res) => setDetail(adaptDetail(res.details))).catch(() => {});
  };

  useEffect(() => {
    if (!recordId) { setDetail(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    filesApi.details(recordId)
      .then((res) => { if (!cancelled) { setDetail(adaptDetail(res.details)); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(e.message || 'Failed to load document'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [recordId]);

  // "Open Original"/"Locate in Folder" need to know whether a source file is
  // still on disk and what kind of viewer fits it -- Api/services/original_file.py
  // is the one authoritative answer to that; never guessed from the file extension.
  useEffect(() => {
    if (!recordId) { setOriginalInfo(null); return; }
    let cancelled = false;
    setShowOriginal(false);
    setShowLocate(false);
    filesApi.original(recordId)
      .then((res) => { if (!cancelled) setOriginalInfo(res.original || null); })
      .catch(() => { if (!cancelled) setOriginalInfo(null); });
    return () => { cancelled = true; };
  }, [recordId]);

  useEffect(() => { setSelectedText(''); setActiveLineMatchIndex(0); }, [recordId]);

  // Manual text selection inside the extracted-content pane -- the only
  // source for "Export Selected Text"; never inferred or re-typed.
  const handleSelectionChange = () => {
    const sel = window.getSelection?.();
    const text = sel ? sel.toString() : '';
    if (text && containerRef.current && sel.anchorNode && containerRef.current.contains(sel.anchorNode)) {
      setSelectedText(text);
    } else if (!text) {
      setSelectedText('');
    }
  };

  const removeCategory = async (categoryId, categoryName) => {
    setRemovingCategoryId(categoryId);
    try {
      await classifyRemove({ pathIds: [recordId], categoryIds: [categoryId], sourceQuery: query || undefined });
      toast(`Removed "${categoryName}" classification`, { type: 'success' });
      reloadDetail();
    } catch (e) {
      toast(e.body?.error || e.message || 'Failed to remove classification', { type: 'error' });
    } finally {
      setRemovingCategoryId(null);
    }
  };

  const ranges = useMemo(() => {
    if (!detail?.content || !query?.trim()) return [];
    return findLiteralRanges(detail.content, query.trim(), { caseSensitive: options.caseSensitive, wholeWord: options.wholeWord });
  }, [detail, query, options.caseSensitive, options.wholeWord]);

  useEffect(() => { setMatchCursor(0); markRefs.current = []; }, [recordId, ranges.length]);

  const jumpToMatch = (dir) => {
    if (ranges.length === 0) return;
    const next = (matchCursor + dir + ranges.length) % ranges.length;
    setMatchCursor(next);
    markRefs.current[next]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const jumpToLineMatch = (lineText, lineIndex) => {
    if (lineIndex != null) setActiveLineMatchIndex(lineIndex);
    if (!lineText || !detail?.content) return;
    const idx = detail.content.indexOf(lineText.trim().slice(0, 60));
    if (idx === -1) { toast('Could not locate this line in the extracted text', { type: 'info' }); return; }
    const rangeIdx = ranges.findIndex((r) => r.start >= idx);
    if (rangeIdx >= 0) { setMatchCursor(rangeIdx); requestAnimationFrame(() => markRefs.current[rangeIdx]?.scrollIntoView({ block: 'center', behavior: 'smooth' })); }
  };

  const activeLineMatch = matchInfo?.lineMatches?.[activeLineMatchIndex] || matchInfo?.lineMatches?.[0] || null;

  const originalUnavailableReason = {
    'no-path': 'No source path was recorded for this file.',
    'relative-path': 'The recorded source path is not usable.',
    'missing-on-disk': 'The source file is no longer at the recorded location.',
    'not-a-file': 'The recorded path is not a file.',
    'unreadable': 'The source file exists but cannot be read by the application.',
    'not-found': 'No stored object with that id.',
  };

  if (!recordId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
        <FileTypeIcon family="Document" color="#64748b" size={28} />
        <span className="text-[13px]">Select a result to read its content</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-[13px]">Loading document…</span>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
        <AlertTriangle size={24} />
        <span className="text-[13px]">{error || 'Document not found'}</span>
      </div>
    );
  }

  let globalCursor = 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-surface-border px-4 py-3">
        <div className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-800 ring-1 ring-inset ring-surface-border">
            <FileTypeIcon family={detail.typeFamily} color={detail.typeColor} size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[13.5px] font-semibold text-white">{detail.fileName}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <TypeBadge type={detail.type} color={detail.typeColor} />
              <StatusBadge status={detail.status} />
              <SideBadge side={detail.side} />
              <span className="text-[10.5px] text-slate-500">{formatBytes(detail.size)} · {formatDate(detail.fileDate)}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <ToolBtn
            icon={copiedAll ? Check : Copy}
            label="Copy full text"
            onClick={() => { copyToClipboard(detail.content); setCopiedAll(true); toast('Full text copied', { type: 'success' }); setTimeout(() => setCopiedAll(false), 1200); }}
          />
          <ToolBtn icon={GitCompare} label="Add to compare" onClick={() => { addToCompare(detail); toast('Added to comparison tray', { type: 'success' }); }} />
          <ToolBtn
            icon={bookmarkedIds.includes(detail.id) ? BookmarkCheck : Bookmark}
            label={bookmarkedIds.includes(detail.id) ? 'Remove bookmark' : 'Bookmark'}
            active={bookmarkedIds.includes(detail.id)}
            onClick={() => toggleBookmark(detail.id)}
          />
          {ranges.length > 0 && (
            <div className="ml-auto flex items-center gap-1 rounded-md border border-surface-border bg-surface-800 px-1.5 py-1 text-[11px] text-slate-400">
              <span aria-live="polite">{matchCursor + 1}/{ranges.length} "{query}" matches</span>
              <button aria-label="Previous match" title="Previous match" onClick={() => jumpToMatch(-1)} className="rounded p-0.5 hover:bg-surface-700 hover:text-slate-200"><ChevronUp size={12} /></button>
              <button aria-label="Next match" title="Next match" onClick={() => jumpToMatch(1)} className="rounded p-0.5 hover:bg-surface-700 hover:text-slate-200"><ChevronDown size={12} /></button>
            </div>
          )}
        </div>

        {/* Export / original-file / locate actions (Content Viewer <-> Universal
            Export integration) -- every export here opens the SAME UniversalExportDialog
            the rest of the app uses; nothing is computed or written to a file in React. */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-surface-border/60 pt-2">
          <ToolBtn
            icon={FileType2}
            label="Export Original File"
            onClick={() => setExportConfig({ mode: 'selection', fileIds: [detail.id], initialKind: 'originals', title: 'Export Original File' })}
          />
          <ToolBtn
            icon={FileSpreadsheet}
            label="Export Database Metadata"
            onClick={() => setExportConfig({ mode: 'selection', fileIds: [detail.id], initialKind: 'database', title: 'Export Database Metadata' })}
          />
          <ToolBtn
            icon={ScissorsLineDashed}
            label="Export Selected Text"
            active={!!selectedText}
            onClick={() => {
              if (!selectedText) { toast('Select some text in the document first', { type: 'info' }); return; }
              setExportConfig({ mode: 'excerpt', excerpt: { fileId: detail.id, kind: 'selection', text: selectedText }, title: 'Export Selected Text' });
            }}
          />
          <ToolBtn
            icon={FileText}
            label="Export First Page"
            onClick={() => setExportConfig({ mode: 'selection', fileIds: [detail.id], initialKind: 'first-pages', title: 'Export First Page' })}
          />
          {matchInfo?.lineMatches?.length > 0 && (
            <ToolBtn
              icon={Search}
              label="Export Search Match"
              onClick={() => setExportConfig({
                mode: 'excerpt',
                excerpt: { fileId: detail.id, kind: 'search_match', query: query || '', text: activeLineMatch?.line_text || matchInfo.matchedIn?.join(', ') || '' },
                title: 'Export Search Match',
              })}
            />
          )}
          <ToolBtn icon={ExternalLink} label="Open Original" active={showOriginal} onClick={() => { setShowOriginal((v) => !v); setShowLocate(false); }} />
          <ToolBtn icon={FolderOpen} label="Locate in Folder" active={showLocate} onClick={() => { setShowLocate((v) => !v); setShowOriginal(false); }} />
        </div>

        {showOriginal && (
          <div className="mt-2 rounded-md border border-surface-border bg-surface-900/70 px-3 py-2.5 text-[11.5px]">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-semibold uppercase tracking-wider text-slate-500">Original File <span className="font-normal normal-case text-slate-600">(native format - separate from the Database Content extracted below)</span></span>
              <button onClick={() => setShowOriginal(false)} className="text-slate-500 hover:text-slate-200"><XIcon size={13} /></button>
            </div>
            {!originalInfo ? (
              <div className="flex items-center gap-1.5 text-slate-500"><Loader2 size={12} className="animate-spin" /> Checking source file…</div>
            ) : !originalInfo.available ? (
              <div className="flex items-center gap-1.5 text-amber-300"><Info size={12} /> {originalUnavailableReason[originalInfo.reason] || 'The original file is not available.'}</div>
            ) : (
              <div className="space-y-2">
                <div className="text-slate-400">
                  Editing or replacing this file on disk does not update the extracted Database Content shown below automatically - the two are independent until this document is re-processed.
                </div>
                {['image', 'pdf', 'text', 'audio', 'video'].includes(originalInfo.kind) ? (
                  <iframe title="Original file preview" src={originalInfo.serve_url} className="h-72 w-full rounded border border-surface-border bg-white" />
                ) : (
                  <div className="text-slate-500">This file type can't be previewed inline in the browser - use Download to open it in its native application.</div>
                )}
                <div className="flex gap-2">
                  <a href={originalInfo.serve_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded border border-surface-border px-2 py-1 text-blue-300 hover:bg-surface-800"><ExternalLink size={11} /> Open in new tab</a>
                  <a href={originalInfo.download_url} className="flex items-center gap-1 rounded border border-surface-border px-2 py-1 text-blue-300 hover:bg-surface-800"><Download size={11} /> Download</a>
                </div>
              </div>
            )}
          </div>
        )}

        {showLocate && (
          <div className="mt-2 rounded-md border border-surface-border bg-surface-900/70 px-3 py-2.5 text-[11.5px]">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-semibold uppercase tracking-wider text-slate-500">Locate in Folder</span>
              <button onClick={() => setShowLocate(false)} className="text-slate-500 hover:text-slate-200"><XIcon size={13} /></button>
            </div>
            {detail.path ? (
              <div className="space-y-1.5">
                <div className="text-slate-500">Browsers can't open your operating system's file manager directly - copy the authoritative stored path below to navigate there yourself.</div>
                <div className="break-all rounded border border-surface-border/60 bg-surface-800/60 px-2 py-1.5 font-mono text-[11px] text-slate-300">{detail.path}</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { copyToClipboard(detail.path); toast('Full path copied', { type: 'success' }); }}
                    className="rounded border border-surface-border px-2 py-1 text-blue-300 hover:bg-surface-800"
                  >Copy full path</button>
                  <button
                    onClick={() => { const folder = detail.path.replace(/[\\/][^\\/]*$/, '') || detail.path; copyToClipboard(folder); toast('Folder path copied', { type: 'success' }); }}
                    className="rounded border border-surface-border px-2 py-1 text-blue-300 hover:bg-surface-800"
                  >Copy folder path</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-amber-300"><Info size={12} /> No stored path is recorded for this file.</div>
            )}
          </div>
        )}

        {exportConfig && (
          <UniversalExportDialog {...exportConfig} onClose={() => setExportConfig(null)} />
        )}

        {/* Classify directly from the content viewer (§31) -- same
            AnalystCategoryService.assign() the results-grid bulk action and
            file-detail panel use, so all three surfaces agree afterward. */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-surface-border/60 pt-2.5">
          <Tags size={12} className="shrink-0 text-slate-500" />
          {detail.analystCategories?.length > 0 ? (
            detail.analystCategories.map((c) => (
              <AnalystCategoryChip
                key={c.id}
                name={c.name}
                color={c.color}
                onRemove={removingCategoryId === c.id ? undefined : () => removeCategory(c.id, c.name)}
              />
            ))
          ) : (
            <span className="text-[11px] text-slate-500">Not classified</span>
          )}
          <button onClick={() => setClassifyOpen(true)} className="ml-auto flex items-center gap-1 rounded-md border border-surface-border px-2 py-1 text-[11px] font-medium text-blue-300 hover:bg-surface-800">
            <Plus size={11} /> Assign Category
          </button>
        </div>
      </div>
      {classifyOpen && (
        <ClassifyDialog fileIds={[detail.id]} sourceQuery={query} onClose={() => setClassifyOpen(false)} onAssigned={reloadDetail} />
      )}

      {matchInfo && ((matchInfo.matchedIn?.length > 0) || (matchInfo.lineMatches?.length > 0)) && (
        <div className="border-b border-surface-border bg-surface-900/60 px-4 py-3">
          <div className="mb-2 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">
            <HashIcon size={11} /> Why this matched
            {matchInfo.relevance > 0 && <span className="ml-auto font-mono normal-case tracking-normal text-slate-400">score {matchInfo.relevance.toFixed(2)}</span>}
          </div>
          {matchInfo.matchedIn?.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {matchInfo.matchedIn.map((f) => <span key={f} className="rounded bg-surface-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">{f}</span>)}
            </div>
          )}
          {matchInfo.lineMatches?.length > 0 && (
            <div className="scrollbar-thin max-h-28 space-y-1 overflow-y-auto">
              {matchInfo.lineMatches.map((m, i) => (
                <button
                  key={i}
                  onClick={() => jumpToLineMatch(m.line_text, i)}
                  className={`flex w-full items-start gap-1.5 rounded px-1.5 py-1 text-left text-[11px] hover:bg-surface-800 ${i === activeLineMatchIndex ? 'bg-surface-800/70 ring-1 ring-inset ring-blue-500/40' : ''}`}
                >
                  <MapPin size={11} className="mt-0.5 shrink-0 text-slate-500" />
                  <span className="shrink-0 font-mono text-slate-500">{m.location || (m.line_number != null ? `L${m.line_number}` : '')}</span>
                  <span
                    className="min-w-0 flex-1 truncate text-slate-400 [&_mark]:rounded [&_mark]:bg-amber-400/80 [&_mark]:px-0.5 [&_mark]:text-surface-950"
                    dangerouslySetInnerHTML={{ __html: m.highlighted_line || m.line_text || '' }}
                  />
                </button>
              ))}
              {matchInfo.lineMatchCount > matchInfo.lineMatches.length && (
                <div className="px-1.5 pt-1 text-[10px] text-slate-600">+{matchInfo.lineMatchCount - matchInfo.lineMatches.length} more matching line(s) not shown</div>
              )}
            </div>
          )}
        </div>
      )}

      <div
        ref={containerRef}
        onMouseUp={handleSelectionChange}
        onKeyUp={handleSelectionChange}
        className="scrollbar-thin flex-1 select-text overflow-y-auto px-5 py-4"
      >
        {!detail.content && (
          <div className="py-10 text-center text-[12.5px] text-slate-500">This file type has no extractable text content to browse in-app.</div>
        )}
        {detail.content && detail.content.split(/\n{2,}/).map((para, pIdx) => {
          const paraStart = detail.content.indexOf(para, globalCursor);
          const paraEnd = paraStart + para.length;
          const localRanges = ranges
            .filter((r) => r.start >= paraStart && r.end <= paraEnd)
            .map((r) => ({ start: r.start - paraStart, end: r.end - paraStart, globalStart: r.start }));
          globalCursor = paraEnd;
          const segments = segmentText(para, localRanges);
          let segRangeIdx = 0;
          return (
            <p key={pIdx} className="mb-4 whitespace-pre-wrap text-[13.5px] leading-relaxed text-slate-300">
              {segments.map((seg, i) => {
                if (!seg.highlight) return <span key={i}>{seg.text}</span>;
                const thisRange = localRanges[segRangeIdx];
                const globalIdx = ranges.findIndex((r) => r.start === thisRange?.globalStart);
                segRangeIdx += 1;
                return (
                  <mark
                    key={i}
                    ref={(el) => { if (el && globalIdx >= 0) markRefs.current[globalIdx] = el; }}
                    className={`rounded px-0.5 text-surface-950 ${globalIdx === matchCursor ? 'bg-blue-400' : 'bg-amber-400/90'}`}
                  >
                    {seg.text}
                  </mark>
                );
              })}
            </p>
          );
        })}
      </div>
    </div>
  );
}
