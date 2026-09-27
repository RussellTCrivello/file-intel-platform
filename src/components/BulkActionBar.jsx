import { useState } from 'react';
import { Bookmark, GitCompare, Copy, X, ShieldCheck, Loader2, Tags, Download } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useSearchStore } from '../store/useSearchStore';
import { toast } from './ui/Toast';
import { copyToClipboard } from '../lib/format';
import { files as filesApi } from '../lib/sylthaeApi';
import { adaptDetail } from '../lib/domain';
import ClassifyDialog from './ClassifyDialog';
import UniversalExportDialog from './export/UniversalExportDialog';

const DETAIL_FETCH_CAP = 50;

// Contextual bulk actions over the current selection. "Copy Paths" and
// "Verify Integrity" need `path`/`hash`, which only exist on
// `/api/file/<id>/details` (not on the lighter `/api/search` result row),
// so they fetch real details for the selected ids -- capped, so a huge
// selection can't turn a read-only convenience into an unbounded scan.
// Export opens the same Universal Export Dialog every other surface uses,
// in its explicit-selection mode (Api/blueprints/files.py's id-bounded
// export routes) -- an arbitrary id set was never something the
// query-reuse export service accepted, and now doesn't need to.
export default function BulkActionBar() {
  const selectedIds = useAppStore((s) => s.selectedIds);
  const clearSelection = useAppStore((s) => s.clearSelection);
  const setCompareIds = useAppStore((s) => s.setCompareIds);
  const setCompareOpen = useAppStore((s) => s.setCompareOpen);
  const addBookmarks = useAppStore((s) => s.addBookmarks);
  const query = useSearchStore((s) => s.query);
  const [busy, setBusy] = useState(null);
  const [classifyOpen, setClassifyOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  if (selectedIds.length === 0) return null;

  const fetchSelectedDetails = async () => {
    const ids = selectedIds.slice(0, DETAIL_FETCH_CAP);
    const results = await Promise.all(ids.map((id) => filesApi.details(id).then((r) => adaptDetail(r.details)).catch(() => null)));
    return results.filter(Boolean);
  };

  const copyPaths = async () => {
    setBusy('paths');
    try {
      const records = await fetchSelectedDetails();
      copyToClipboard(records.map((r) => r.path).filter(Boolean).join('\n'));
      const suffix = selectedIds.length > DETAIL_FETCH_CAP ? ` (capped at first ${DETAIL_FETCH_CAP})` : '';
      toast(`Copied ${records.length} path(s) to clipboard${suffix}`, { type: 'success' });
    } catch {
      toast('Could not fetch file paths', { type: 'warning' });
    } finally { setBusy(null); }
  };

  const verifyIntegrity = async () => {
    setBusy('verify');
    try {
      const records = await fetchSelectedDetails();
      const withHash = records.filter((r) => r.hash).length;
      toast(`${withHash}/${records.length} checked file(s) have a content hash on record`, { type: withHash === records.length ? 'success' : 'warning' });
    } catch {
      toast('Could not verify file integrity', { type: 'warning' });
    } finally { setBusy(null); }
  };

  const bookmarkSelected = () => {
    addBookmarks(selectedIds);
    toast(`${selectedIds.length} file(s) bookmarked for review`, { type: 'success' });
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[150] flex justify-center px-4">
      <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-xl border border-surface-border bg-surface-800/95 px-3 py-2 shadow-2xl shadow-black/50 backdrop-blur animate-fade-in">
        <span className="mr-2 flex items-center gap-1.5 pl-1 text-[12.5px] font-semibold text-white">
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1 text-[11px]">{selectedIds.length}</span>
          selected
        </span>
        <BarBtn icon={Tags} label="Classify" onClick={() => setClassifyOpen(true)} disabled={!!busy} />
        <BarBtn icon={Download} label="Export" onClick={() => setExportOpen(true)} disabled={!!busy} />
        <BarBtn icon={busy === 'paths' ? Loader2 : Copy} spin={busy === 'paths'} label="Copy Paths" onClick={copyPaths} disabled={!!busy} />
        <BarBtn icon={busy === 'verify' ? Loader2 : ShieldCheck} spin={busy === 'verify'} label="Verify Integrity" onClick={verifyIntegrity} disabled={!!busy} />
        <BarBtn icon={Bookmark} label="Bookmark" onClick={bookmarkSelected} disabled={!!busy} />
        <BarBtn
          icon={busy === 'compare' ? Loader2 : GitCompare}
          spin={busy === 'compare'}
          label="Compare"
          disabled={!!busy || selectedIds.length < 2 || selectedIds.length > 4}
          onClick={async () => {
            setBusy('compare');
            try {
              const records = await fetchSelectedDetails();
              setCompareIds(selectedIds, records);
              setCompareOpen(true);
            } finally { setBusy(null); }
          }}
        />
        <span className="mx-1 h-5 w-px bg-surface-border" />
        <button onClick={clearSelection} className="flex items-center gap-1 rounded-md px-2 py-1.5 text-[12px] text-slate-400 hover:bg-surface-700 hover:text-white">
          <X size={13} /> Clear
        </button>
      </div>
      {classifyOpen && (
        <ClassifyDialog
          fileIds={selectedIds}
          sourceQuery={query}
          onClose={() => setClassifyOpen(false)}
        />
      )}
      {exportOpen && (
        <UniversalExportDialog mode="selection" fileIds={selectedIds} onClose={() => setExportOpen(false)} />
      )}
    </div>
  );
}

function BarBtn({ icon: Icon, label, onClick, disabled, spin }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
        disabled ? 'cursor-not-allowed text-slate-600' : 'text-slate-300 hover:bg-surface-700 hover:text-white'
      }`}
    >
      <Icon size={13.5} className={spin ? 'animate-spin' : ''} /> {label}
    </button>
  );
}
