import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Eye, Copy, Fingerprint, MoreHorizontal, GitCompare, Bookmark, BookmarkCheck, ImageIcon,
  ExternalLink, FolderOpen, FileType2, FileSpreadsheet, FileText, Search, Network, ShieldAlert,
  Tags, Loader2, Info, Download, ClipboardCopy, BookOpen,
} from 'lucide-react';
import { MenuItem, MenuSeparator, MenuLabel } from '../ui/DropdownMenu';
import Modal from '../ui/Modal';
import { copyToClipboard, formatBytes, formatDate } from '../../lib/format';
import { toast } from '../ui/Toast';
import { useAppStore } from '../../store/useAppStore';
import { useSearchStore } from '../../store/useSearchStore';
import { files as filesApi } from '../../lib/sylthaeApi';
import { adaptDetail } from '../../lib/domain';
import FilePreviewModal from '../FilePreviewModal';
import ClassifyDialog from '../ClassifyDialog';
import UniversalExportDialog from '../export/UniversalExportDialog';

const UNAVAILABLE_REASON = {
  'no-path': 'No source path was recorded for this file.',
  'relative-path': 'The recorded source path is not usable.',
  'missing-on-disk': 'The source file is no longer at the recorded location.',
  'not-a-file': 'The recorded path is not a file.',
  'unreadable': 'The source file exists but cannot be read by the application.',
  'not-found': 'No stored object with that id.',
};

const MENU_WIDTH = 250;
const MENU_MAX_HEIGHT = 460;

// "View Full Content" is the one place every surface that lists files --
// File Analysis's 7 dimensions (via FacetFileList -> loadFacetRows ->
// this same ActionsMenu), Search Results, and RecordDetail's own embedded
// ActionsMenu -- reaches the shared FullDocumentViewer (req #6/#18). The
// search term and analytical breadcrumb ("origin") it opens with are
// derived from whichever real, already-loaded context led here: a File
// Analysis facet drill-down (`useSearchStore.facetContext`, set by
// loadFacetRows) takes priority since it names an exact curated word/
// keyword/title/place, falling back to the free-text search box query.
// Nothing here invents a term that wasn't actually searched/curated.
function deriveViewerContext(facetContext, query, wholeWord, caseSensitive) {
  if (facetContext) {
    const { facet, label } = facetContext;
    switch (facet) {
      case 'category_word':
      case 'word':
        // Exactly one lexical word -- always match on word boundaries so
        // "air" inside "airport" is never mistaken for a hit.
        return { term: label, wholeWord: true, caseSensitive: false, origin: { section: 'words', word: label } };
      case 'keyword':
        return { term: label, wholeWord: true, caseSensitive: false, origin: { section: 'keywords', keyword: label } };
      case 'title':
        // A Title is a normalized document-identity string (often filename-
        // derived), not necessarily literal text inside the document -- do
        // not force a content search for it, just open straight to the file.
        return { term: '', wholeWord: false, caseSensitive: false, origin: { section: 'titles', title: label } };
      case 'geo_place':
        return { term: facetContext.place || label, wholeWord: true, caseSensitive: false, origin: { section: 'geolocation', place: facetContext.place || label } };
      case 'relation':
        return { term: '', wholeWord: false, caseSensitive: false, origin: { section: 'relations' } };
      case 'source':
        return { term: '', wholeWord: false, caseSensitive: false, origin: { section: 'sources', source: label } };
      case 'side':
        return { term: '', wholeWord: false, caseSensitive: false, origin: { section: 'sides', side: label } };
      default:
        return { term: label || '', wholeWord: false, caseSensitive: false, origin: { section: facet } };
    }
  }
  if (query && query.trim()) {
    return { term: query.trim(), wholeWord: !!wholeWord, caseSensitive: !!caseSensitive, origin: { section: 'search' } };
  }
  return { term: '', wholeWord: false, caseSensitive: false, origin: { section: 'recordDetail' } };
}

// -----------------------------------------------------------------------
// The one per-record context-action surface for the whole app: every row
// or card in every view mounts this once, and it is reachable two ways --
// a conventional "..." trigger button (always visible, keyboard/AT
// operable) and a right-click anywhere on the row (`ref.openAtEvent`,
// wired by the parent view's onContextMenu). Both open the identical menu;
// neither is a second implementation of the other.
//
// Nothing here invents a capability: every export goes through the same
// UniversalExportDialog every other export surface uses (mode='selection'
// with a fixed initialKind, or mode='excerpt' for a real search match --
// exactly the contract Content Viewer <-> Export already established), and
// "View Similar"/"View Duplicates" both open the existing Duplicates
// workspace (`/api/dashboard/similar-files`) scoped to this file rather
// than computing a second, parallel similarity/duplicate result set.
// -----------------------------------------------------------------------
const ActionsMenu = forwardRef(function ActionsMenu({ record, onOpen, resultIds, resultTotal }, ref) {
  const [anchor, setAnchor] = useState(null); // {top,left} while menu open
  const [full, setFull] = useState(null); // lazily-fetched /api/file/<id>/details, cached per row
  const [loadingFull, setLoadingFull] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [classifyOpen, setClassifyOpen] = useState(false);
  const [exportConfig, setExportConfig] = useState(null);
  const [originalOpen, setOriginalOpen] = useState(false);
  const [originalInfo, setOriginalInfo] = useState(null);
  const [locateOpen, setLocateOpen] = useState(false);
  const btnRef = useRef(null);

  const query = useSearchStore((s) => s.query);
  const wholeWord = useSearchStore((s) => s.wholeWord);
  const caseSensitive = useSearchStore((s) => s.caseSensitive);
  const facetContext = useSearchStore((s) => s.facetContext);
  const bookmarkedIds = useAppStore((s) => s.bookmarkedIds);
  const toggleBookmark = useAppStore((s) => s.toggleBookmark);
  const addToCompare = useAppStore((s) => s.addToCompare);
  const requestDuplicatesFocus = useAppStore((s) => s.requestDuplicatesFocus);
  const openFullDocument = useAppStore((s) => s.openFullDocument);
  const isBookmarked = bookmarkedIds.includes(record.id);

  const path = full?.path ?? record.path;
  const hash = full?.hash ?? record.hash;

  const ensureFull = async () => {
    if (full || loadingFull) return full;
    setLoadingFull(true);
    try {
      const data = await filesApi.details(record.id);
      const adapted = adaptDetail(data.details);
      setFull(adapted);
      return adapted;
    } catch {
      return null;
    } finally {
      setLoadingFull(false);
    }
  };

  const placeAt = (top, left) => {
    const clampedLeft = Math.max(8, Math.min(left, window.innerWidth - MENU_WIDTH - 8));
    // Keep the WHOLE menu on screen (not just its top edge) so every item is
    // directly clickable without relying on the user finding the internal
    // scrollbar -- flips the anchor upward when there isn't room below.
    const maxTop = Math.max(8, window.innerHeight - MENU_MAX_HEIGHT - 8);
    const clampedTop = Math.min(top, maxTop);
    setAnchor({ top: clampedTop, left: clampedLeft });
    ensureFull();
  };

  const openFromButton = () => {
    const rect = btnRef.current.getBoundingClientRect();
    placeAt(rect.bottom + 6, rect.right - MENU_WIDTH);
  };

  useImperativeHandle(ref, () => ({
    openAtEvent(e) {
      e.preventDefault();
      e.stopPropagation();
      placeAt(e.clientY, e.clientX);
    },
  }));

  const close = () => setAnchor(null);

  const copyDetails = () => {
    const r = full || record;
    const lines = [
      `File Name: ${r.fileName}`, `Type: ${r.type}`, `Size: ${formatBytes(r.size)}`,
      `Source: ${r.source}`, `Side: ${r.side}`, `Status: ${r.status}`,
      `File Date: ${formatDate(r.fileDate, { time: true })}`, `Hash: ${r.hash || 'N/A'}`,
      `Path: ${r.path || 'N/A'}`,
    ];
    copyToClipboard(lines.join('\n'));
    toast('Record details copied to clipboard', { type: 'success' });
  };

  const openOriginal = async () => {
    setOriginalOpen(true);
    if (!originalInfo) {
      try {
        const res = await filesApi.original(record.id);
        setOriginalInfo(res.original || null);
      } catch {
        setOriginalInfo({ available: false, reason: 'not-found' });
      }
    }
  };

  const viewMatchExcerpt = () => {
    const text = record.lineMatches?.[0]?.line_text || record.matchedIn?.join(', ') || '';
    setExportConfig({ mode: 'excerpt', excerpt: { fileId: record.id, kind: 'search_match', query: query || '', text }, title: 'Export Search Match' });
  };

  const hasMatch = record.lineMatches?.length > 0 || record.matchedIn?.length > 0;

  return (
    <div className="flex items-center justify-end gap-0.5">
      {onOpen && (
        <button
          title="View details"
          onClick={(e) => { e.stopPropagation(); onOpen(record); }}
          className="rounded p-1.5 text-slate-400 hover:bg-surface-700 hover:text-blue-400 focus-ring"
        >
          <Eye size={14} />
        </button>
      )}
      <button
        ref={btnRef}
        title="More actions"
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        onClick={(e) => { e.stopPropagation(); openFromButton(); }}
        className="rounded p-1.5 text-slate-400 hover:bg-surface-700 hover:text-slate-200 focus-ring"
      >
        <MoreHorizontal size={14} />
      </button>

      {anchor && createPortal(
        <MenuSurface anchor={anchor} onClose={close}>
          {onOpen && <MenuItem icon={Eye} label="Open / Preview" onClick={() => { onOpen(record); close(); }} />}
          <MenuItem
            icon={BookOpen}
            label="View Full Content"
            onClick={() => {
              const ctx = deriveViewerContext(facetContext, query, wholeWord, caseSensitive);
              openFullDocument({ fileId: record.id, fileName: record.fileName, resultIds, resultTotal, ...ctx });
              close();
            }}
          />
          <MenuItem icon={ImageIcon} label="Preview original" onClick={() => { setPreviewOpen(true); close(); }} />
          <MenuItem icon={ExternalLink} label="Open Original File" onClick={() => { openOriginal(); close(); }} />
          <MenuItem icon={FolderOpen} label="Locate in Folder" onClick={() => { setLocateOpen(true); close(); }} />
          <MenuItem
            icon={isBookmarked ? BookmarkCheck : Bookmark}
            label={isBookmarked ? 'Remove bookmark' : 'Bookmark for review'}
            onClick={() => { toggleBookmark(record.id); close(); }}
          />
          <MenuSeparator />
          <MenuLabel>Copy</MenuLabel>
          <MenuItem icon={Copy} label="Copy file name" onClick={() => { copyToClipboard(record.fileName); toast('File name copied', { type: 'success' }); close(); }} />
          <MenuItem
            icon={Copy}
            label="Copy file path"
            onClick={async () => { const r = await ensureFull(); const p = r?.path ?? path; if (p) { copyToClipboard(p); toast('Path copied', { type: 'success' }); } else toast('No path recorded for this file', { type: 'warning' }); close(); }}
          />
          <MenuItem
            icon={Fingerprint}
            label="Copy hash"
            onClick={async () => { const r = await ensureFull(); const h = r?.hash ?? hash; if (h) { copyToClipboard(h); toast('Hash copied', { type: 'success' }); } else toast('No hash recorded for this file', { type: 'warning' }); close(); }}
          />
          <MenuItem icon={ClipboardCopy} label="Copy record details" onClick={async () => { await ensureFull(); copyDetails(); close(); }} />
          <MenuSeparator />
          <MenuLabel>Export</MenuLabel>
          <MenuItem icon={FileType2} label="Export Original File" onClick={() => { setExportConfig({ mode: 'selection', fileIds: [record.id], initialKind: 'originals', title: 'Export Original File' }); close(); }} />
          <MenuItem icon={FileSpreadsheet} label="Export Database Metadata" onClick={() => { setExportConfig({ mode: 'selection', fileIds: [record.id], initialKind: 'database', title: 'Export Database Metadata' }); close(); }} />
          <MenuItem icon={FileText} label="Export First Page" onClick={() => { setExportConfig({ mode: 'selection', fileIds: [record.id], initialKind: 'first-pages', title: 'Export First Page' }); close(); }} />
          {hasMatch && (
            <MenuItem icon={Search} label="Export Matched Content" onClick={() => { viewMatchExcerpt(); close(); }} />
          )}
          <MenuSeparator />
          <MenuItem icon={GitCompare} label="Add to compare" onClick={() => { addToCompare(record); toast(`${record.fileName} added to comparison tray`, { type: 'success' }); close(); }} />
          <MenuItem icon={Network} label="View Similar" onClick={() => { requestDuplicatesFocus(record.id, 'title'); close(); }} />
          <MenuItem icon={ShieldAlert} label="View Duplicates" onClick={() => { requestDuplicatesFocus(record.id, 'hash'); close(); }} />
          <MenuItem icon={Tags} label="Analyst Classification" onClick={() => { setClassifyOpen(true); close(); }} />
        </MenuSurface>,
        document.body
      )}

      {previewOpen && <FilePreviewModal record={full || record} onClose={() => setPreviewOpen(false)} />}
      {classifyOpen && (
        <ClassifyDialog fileIds={[record.id]} sourceQuery={query} onClose={() => setClassifyOpen(false)} />
      )}
      {exportConfig && <UniversalExportDialog {...exportConfig} onClose={() => setExportConfig(null)} />}
      {originalOpen && (
        <Modal onClose={() => setOriginalOpen(false)} title={`Original File — ${record.fileName}`} width={520}>
          {!originalInfo ? (
            <div className="flex items-center gap-1.5 text-[12px] text-slate-500"><Loader2 size={13} className="animate-spin" /> Checking source file…</div>
          ) : !originalInfo.available ? (
            <div className="flex items-center gap-1.5 text-[12.5px] text-amber-300"><Info size={13} /> {UNAVAILABLE_REASON[originalInfo.reason] || 'The original file is not available.'}</div>
          ) : (
            <div className="space-y-3">
              <div className="text-[11.5px] text-slate-500">
                Editing or replacing this file on disk does not update the extracted Database Content shown elsewhere automatically — the two are independent until this document is re-processed.
              </div>
              {['image', 'pdf', 'text', 'audio', 'video'].includes(originalInfo.kind) ? (
                <iframe title="Original file preview" src={originalInfo.serve_url} className="h-72 w-full rounded border border-surface-border bg-white" />
              ) : (
                <div className="text-[12px] text-slate-500">This file type can't be previewed inline in the browser — use Download to open it in its native application.</div>
              )}
              <div className="flex gap-2 text-[12px]">
                <a href={originalInfo.serve_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded border border-surface-border px-2 py-1 text-blue-300 hover:bg-surface-800"><ExternalLink size={12} /> Open in new tab</a>
                <a href={originalInfo.download_url} className="flex items-center gap-1 rounded border border-surface-border px-2 py-1 text-blue-300 hover:bg-surface-800"><Download size={12} /> Download</a>
              </div>
            </div>
          )}
        </Modal>
      )}
      {locateOpen && (
        <Modal onClose={() => setLocateOpen(false)} title={`Locate in Folder — ${record.fileName}`} width={480}>
          {loadingFull && !path ? (
            <div className="flex items-center gap-1.5 text-[12px] text-slate-500"><Loader2 size={13} className="animate-spin" /> Loading path…</div>
          ) : path ? (
            <div className="space-y-2 text-[12px]">
              <div className="text-slate-500">Browsers can't open your operating system's file manager directly — copy the authoritative stored path below to navigate there yourself.</div>
              <div className="break-all rounded border border-surface-border/60 bg-surface-800/60 px-2 py-1.5 font-mono text-[11px] text-slate-300">{path}</div>
              <div className="flex gap-2">
                <button onClick={() => { copyToClipboard(path); toast('Full path copied', { type: 'success' }); }} className="rounded border border-surface-border px-2 py-1 text-blue-300 hover:bg-surface-800">Copy full path</button>
                <button onClick={() => { const folder = path.replace(/[\\/][^\\/]*$/, '') || path; copyToClipboard(folder); toast('Folder path copied', { type: 'success' }); }} className="rounded border border-surface-border px-2 py-1 text-blue-300 hover:bg-surface-800">Copy folder path</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[12.5px] text-amber-300"><Info size={13} /> No stored path is recorded for this file.</div>
          )}
        </Modal>
      )}
    </div>
  );
});

export default ActionsMenu;

// A minimal self-positioning popover (renders at an arbitrary viewport
// point) so the exact same menu content can open either anchored to the
// "..." button or at the cursor on right-click.
function MenuSurface({ anchor, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const handle = (e) => { if (!ref.current?.contains(e.target)) onClose(); };
    const esc = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', handle); document.removeEventListener('keydown', esc); };
  }, [onClose]);
  return (
    <div
      ref={ref}
      role="menu"
      style={{ position: 'fixed', top: anchor.top, left: anchor.left, width: MENU_WIDTH, maxHeight: MENU_MAX_HEIGHT }}
      className="z-[200] animate-fade-in overflow-y-auto scrollbar-thin rounded-lg border border-surface-border bg-surface-800 py-1 shadow-2xl shadow-black/50"
      onMouseDown={(e) => e.stopPropagation()}
      // Menu items render into a portal on document.body, so a click here
      // still bubbles through the *React* tree (ActionsMenu's real parent
      // is the row/card that mounted it), not the DOM tree stopPropagation
      // already applied to the "..." trigger button covers -- without this,
      // choosing any menu item would also fire the row's own onClick
      // (selecting it / opening its detail view) underneath.
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
