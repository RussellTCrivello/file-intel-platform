import { useEffect, useState } from 'react';
import { Loader2, AlertTriangle, FileWarning } from 'lucide-react';
import Modal from './ui/Modal';
import FileTypeIcon from './cells/FileTypeIcon';
import { files as filesApi } from '../lib/sylthaeApi';

// The real, existing read-only "open the original object" capability
// (Api/routes/preview.py + Api/services/file_preview.py) -- a bounded raster
// for images/PDFs, or extracted text for text-like files. There is no
// raw-file download endpoint in the backend, so this plus the full text
// already shown in the reader/detail view is the authentic substitute for
// "open in native app" / "open original".
export default function FilePreviewModal({ record, onClose }) {
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let alive = true;
    setState({ loading: true, data: null, error: null });
    filesApi.preview(record.id)
      .then((data) => { if (alive) setState({ loading: false, data, error: null }); })
      .catch((e) => { if (alive) setState({ loading: false, data: null, error: e.message || 'Preview failed' }); });
    return () => { alive = false; };
  }, [record.id]);

  return (
    <Modal onClose={onClose} title="File Preview" width={640}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-800 ring-1 ring-inset ring-surface-border">
          <FileTypeIcon family={record.typeFamily} color={record.typeColor} size={17} />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold text-white">{record.fileName}</div>
          <div className="text-[11px] text-slate-500">Server-rendered preview · read-only</div>
        </div>
      </div>

      {state.loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 size={16} className="animate-spin" /> Loading preview…
        </div>
      )}

      {!state.loading && state.error && (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-slate-500">
          <AlertTriangle size={22} className="text-amber-400" />
          <span className="text-[12.5px]">{state.error}</span>
        </div>
      )}

      {!state.loading && state.data && (
        <PreviewBody data={state.data} record={record} />
      )}
    </Modal>
  );
}

function PreviewBody({ data, record }) {
  if (data.preview_type === 'error' || data.preview_type === 'unsupported') {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center text-slate-500">
        <FileWarning size={22} />
        <span className="text-[12.5px]">{data.error || data.message || 'No preview is available for this file type.'}</span>
      </div>
    );
  }
  if (data.image_url) {
    return (
      <div className="flex max-h-[65vh] justify-center overflow-auto rounded-lg border border-surface-border bg-surface-950 p-2">
        <img src={data.image_url} alt={record.fileName} className="max-w-full rounded" />
      </div>
    );
  }
  if (typeof data.data === 'string') {
    return (
      <pre className="scrollbar-thin max-h-[65vh] overflow-auto whitespace-pre-wrap rounded-lg border border-surface-border bg-surface-950 p-3 font-mono text-[12px] leading-relaxed text-slate-300">
        {data.data}
      </pre>
    );
  }
  return <div className="py-10 text-center text-[12.5px] text-slate-500">No preview content returned.</div>;
}
