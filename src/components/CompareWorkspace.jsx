import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, GitCompare, Plus, Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { formatBytes, formatDate } from '../lib/format';
import { TypeBadge, StatusBadge, SideBadge } from './cells/Badges';
import FileTypeIcon from './cells/FileTypeIcon';
import { files as filesApi } from '../lib/sylthaeApi';
import { adaptDetail } from '../lib/domain';

// Every field below is a real key from `/api/file/<id>/details`
// (Api/routes/api.py) -- no fabricated `confidentiality`/`caseId`/
// `sourceType` column. Records are fetched by id independently of whatever
// page is currently loaded in the search results, since a comparison set
// can span multiple pages/queries.
const FIELDS = [
  { key: 'fileName', label: 'File Name' },
  { key: 'type', label: 'Type', render: (r) => <TypeBadge type={r.type} color={r.typeColor} /> },
  { key: 'size', label: 'Size', render: (r) => formatBytes(r.size), raw: (r) => r.size },
  { key: 'source', label: 'Source' },
  { key: 'side', label: 'Side', render: (r) => <SideBadge side={r.side} /> },
  { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  { key: 'path', label: 'File Path', mono: true },
  { key: 'fileDate', label: 'File Date', render: (r) => formatDate(r.fileDate, { time: true }) },
  { key: 'creationDate', label: 'Creation Date', render: (r) => formatDate(r.creationDate, { time: true }) },
  { key: 'hash', label: 'Content Hash', mono: true, render: (r) => r.hash || '— missing —' },
  { key: 'wordCount', label: 'Word Count' },
  { key: 'contentChunks', label: 'Content Chunks' },
  { key: 'categories', label: 'Categories', render: (r) => (r.categories?.length ? r.categories.map((c) => c.name).join(', ') : '—') },
];

export default function CompareWorkspace() {
  const compareOpen = useAppStore((s) => s.compareOpen);
  const compareIds = useAppStore((s) => s.compareIds);
  const setCompareOpen = useAppStore((s) => s.setCompareOpen);
  const removeFromCompare = useAppStore((s) => s.removeFromCompare);
  const clearCompare = useAppStore((s) => s.clearCompare);

  const [records, setRecords] = useState({}); // id -> adapted detail
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!compareOpen) return;
    const missing = compareIds.filter((id) => !records[id]);
    if (missing.length === 0) return;
    setLoading(true);
    Promise.all(missing.map((id) => filesApi.details(id).then((res) => [id, adaptDetail(res.details)]).catch(() => [id, null])))
      .then((pairs) => {
        setRecords((prev) => {
          const next = { ...prev };
          pairs.forEach(([id, detail]) => { if (detail) next[id] = detail; });
          return next;
        });
        setLoading(false);
      });
  }, [compareOpen, compareIds]);

  if (!compareOpen) return null;
  const loaded = compareIds.map((id) => records[id]).filter(Boolean);

  const isMismatch = (field) => {
    if (loaded.length < 2) return false;
    const key = field.raw ? field.raw : (r) => r[field.key];
    const vals = loaded.map(key);
    return new Set(vals.map((v) => JSON.stringify(v))).size > 1;
  };

  return createPortal(
    <div className="fixed inset-0 z-[320] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm animate-fade-in">
      <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-850 shadow-2xl">
        <div className="flex items-center justify-between border-b border-surface-border px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold text-white">
            <GitCompare size={16} className="text-blue-400" /> File Comparison Workspace
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={clearCompare} className="rounded-md border border-surface-border px-2.5 py-1 text-[11.5px] text-slate-400 hover:bg-surface-800">Clear all</button>
            <button onClick={() => setCompareOpen(false)} className="rounded p-1.5 text-slate-500 hover:bg-surface-800 hover:text-slate-200"><X size={16} /></button>
          </div>
        </div>

        {loading && loaded.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-slate-500">
            <Loader2 size={22} className="animate-spin" />
            <span className="text-[12.5px]">Loading file details…</span>
          </div>
        ) : loaded.length < 2 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center text-slate-500">
            <GitCompare size={28} />
            <p className="text-[13px]">Select at least 2 files to compare. Use "Add to compare" from a file's detail panel or actions menu to add up to 4 at once.</p>
          </div>
        ) : (
          <div className="scrollbar-thin flex-1 overflow-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead className="sticky top-0 z-10 bg-surface-800">
                <tr>
                  <th className="w-40 border-b border-r border-surface-border px-3 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Field</th>
                  {loaded.map((r) => (
                    <th key={r.id} className="min-w-[220px] border-b border-surface-border px-3 py-2.5 text-left">
                      <div className="flex items-center gap-2">
                        <FileTypeIcon family={r.typeFamily} color={r.typeColor} size={15} />
                        <span className="truncate font-semibold text-slate-100">{r.fileName}</span>
                        <button onClick={() => removeFromCompare(r.id)} className="ml-auto rounded p-0.5 text-slate-500 hover:text-red-400"><X size={12} /></button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FIELDS.map((field) => {
                  const mismatch = isMismatch(field);
                  return (
                    <tr key={field.key} className="border-b border-surface-border/60">
                      <td className="border-r border-surface-border px-3 py-2 font-medium text-slate-400">{field.label}</td>
                      {loaded.map((r) => (
                        <td key={r.id} className={`px-3 py-2 align-top ${mismatch ? 'bg-amber-500/10' : ''} ${field.mono ? 'font-mono text-[11.5px]' : ''} text-slate-200`}>
                          {field.render ? field.render(r) : (r[field.key] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-surface-border px-5 py-3 text-[11.5px] text-slate-500">
          <span>{loaded.length} of 4 slots used · differing values highlighted in amber</span>
          <span className="flex items-center gap-1"><Plus size={12} /> Add more files from any view to compare up to 4 at once</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
