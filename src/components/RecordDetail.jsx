import { useEffect, useState } from 'react';
import {
  Fingerprint, MapPin, Copy, GitCompare, Lock, Check,
  FileText, Building2, Calendar, ShieldCheck, Network, ImageIcon, BookOpen,
  Bookmark, BookmarkCheck, ClipboardCopy, Loader2, AlertTriangle, Tag, Tags, Plus,
} from 'lucide-react';
import { formatBytes, formatDate, formatRelative, copyToClipboard } from '../lib/format';
import { StatusBadge, SideBadge, TypeBadge, AnalystCategoryChip } from './cells/Badges';
import FileTypeIcon from './cells/FileTypeIcon';
import { toast } from './ui/Toast';
import { useAppStore } from '../store/useAppStore';
import { useSearchStore } from '../store/useSearchStore';
import { files as filesApi } from '../lib/sylthaeApi';
import { adaptDetail } from '../lib/domain';
import { segmentText, findLiteralRanges } from '../lib/highlight';
import FilePreviewModal from './FilePreviewModal';
import ClassifyDialog from './ClassifyDialog';
import ActionsMenu from './cells/ActionsMenu';

function Section({ title, icon: Icon, children }) {
  return (
    <div className="border-b border-surface-border/70 px-5 py-4 last:border-0">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        <Icon size={13} /> {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value, mono }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-[12.5px]">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className={`text-right text-slate-200 ${mono ? 'font-mono text-[11.5px]' : ''}`}>{value}</span>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className="flex items-center justify-center gap-1.5 rounded-md border border-surface-border px-2.5 py-2 text-[12px] font-medium text-slate-300 transition-colors hover:bg-surface-800">
      <Icon size={13} /> {label}
    </button>
  );
}

function RelatedRow({ label, onClick }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-surface-800">
      <FileText size={13} className="shrink-0 text-slate-500" />
      <span className="truncate text-[12px] text-slate-300">{label}</span>
    </button>
  );
}

// Fetches the real, richer `/api/file/<id>/details` payload lazily -- the
// list/search response deliberately omits path, hash, full content and
// coordinates, so any of those fields are unavailable until a record is
// actually opened here.
export default function RecordDetail({ recordId, onNavigate, onClose, embedded = false }) {
  const [state, setState] = useState({ loading: true, record: null, error: null });
  const [copiedHash, setCopiedHash] = useState(false);
  const [contentOpen, setContentOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [classifyOpen, setClassifyOpen] = useState(false);
  const [removingCategoryId, setRemovingCategoryId] = useState(null);
  const query = useSearchStore((s) => s.query);
  const wholeWord = useSearchStore((s) => s.wholeWord);
  const caseSensitive = useSearchStore((s) => s.caseSensitive);
  const facetContext = useSearchStore((s) => s.facetContext);
  const openFullDocument = useAppStore((s) => s.openFullDocument);
  const classifyRemove = useSearchStore((s) => s.classifyRemove);

  const openDetailAction = useAppStore((s) => s.openDetail);
  const openDetail = onNavigate || openDetailAction;
  const addToCompare = useAppStore((s) => s.addToCompare);
  const compareIds = useAppStore((s) => s.compareIds);
  const bookmarkedIds = useAppStore((s) => s.bookmarkedIds);
  const toggleBookmark = useAppStore((s) => s.toggleBookmark);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const setFileAnalysisSection = useAppStore((s) => s.setFileAnalysisSection);

  const loadRecord = () => {
    setState((s) => ({ ...s, loading: !s.record }));
    return filesApi.details(recordId)
      .then((data) => setState({ loading: false, record: adaptDetail(data.details), error: null }))
      .catch((e) => setState({ loading: false, record: null, error: e.message || 'Could not load file details' }));
  };

  useEffect(() => {
    let alive = true;
    setState({ loading: true, record: null, error: null });
    filesApi.details(recordId)
      .then((data) => { if (alive) setState({ loading: false, record: adaptDetail(data.details), error: null }); })
      .catch((e) => { if (alive) setState({ loading: false, record: null, error: e.message || 'Could not load file details' }); });
    return () => { alive = false; };
  }, [recordId]);

  const removeAnalystCategory = async (categoryId, categoryName) => {
    setRemovingCategoryId(categoryId);
    try {
      await classifyRemove({ pathIds: [recordId], categoryIds: [categoryId], sourceQuery: query || undefined });
      toast(`Removed "${categoryName}" classification`, { type: 'success' });
      await loadRecord();
    } catch (e) {
      toast(e.body?.error || e.message || 'Failed to remove classification', { type: 'error' });
    } finally {
      setRemovingCategoryId(null);
    }
  };

  if (state.loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
        <Loader2 size={20} className="animate-spin" /> <span className="text-[12.5px]">Loading file details…</span>
      </div>
    );
  }
  if (state.error || !state.record) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
        <AlertTriangle size={20} className="text-amber-400" /> <span className="text-[12.5px]">{state.error || 'File not found'}</span>
      </div>
    );
  }

  const record = state.record;
  const isBookmarked = bookmarkedIds.includes(record.id);

  const copyDetails = () => {
    const lines = [
      `File Name: ${record.fileName}`, `Type: ${record.type}`, `Size: ${formatBytes(record.size)}`,
      `Source: ${record.source}`, `Side: ${record.side}`, `Status: ${record.status}`,
      `File Date: ${formatDate(record.fileDate, { time: true })}`, `Hash: ${record.hash || 'N/A'}`,
      `Path: ${record.path}`,
    ];
    copyToClipboard(lines.join('\n'));
    toast('Record details copied to clipboard', { type: 'success' });
  };

  const contentRanges = query?.trim() ? findLiteralRanges(record.content, query.trim()) : [];

  return (
    <div className="flex h-full flex-col overflow-hidden bg-surface-900">
      <div className="flex items-start gap-3 border-b border-surface-border p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-800 ring-1 ring-inset ring-surface-border">
          <FileTypeIcon family={record.typeFamily} color={record.typeColor} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 truncate text-[15px] font-bold text-white" title={record.fileName}>
            {record.fileName}
            {isBookmarked && <Bookmark size={13} className="shrink-0 fill-blue-400 text-blue-400" title="Bookmarked by you" />}
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="flex items-center gap-1 rounded border border-surface-border bg-surface-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500" title="This panel displays existing record data; it cannot be edited here.">
              <Lock size={9} /> Read-Only
            </span>
            <TypeBadge type={record.type} color={record.typeColor} />
            <StatusBadge status={record.status} />
            <SideBadge side={record.side} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ActionsMenu record={record} />
          {!embedded && (
            <button onClick={onClose} className="rounded-md p-1.5 text-slate-500 hover:bg-surface-800 hover:text-slate-200 focus-ring">✕</button>
          )}
        </div>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="p-5 pb-0">
          {record.typeFamily === 'Image' ? (
            <button onClick={() => setPreviewOpen(true)} className="flex h-40 w-full items-center justify-center rounded-lg bg-gradient-to-br from-surface-800 to-surface-900 ring-1 ring-inset ring-surface-border hover:ring-blue-500/50">
              <ImageIcon size={30} className="text-slate-600" />
            </button>
          ) : (
            <div className="flex h-24 items-center justify-center rounded-lg bg-surface-800 ring-1 ring-inset ring-surface-border">
              <FileTypeIcon family={record.typeFamily} color={record.typeColor} size={30} />
            </div>
          )}
        </div>

        <Section title="Identity" icon={FileText}>
          <Field label="File Name" value={record.fileName} />
          <Field label="Type" value={record.type} />
          <Field label="Size" value={formatBytes(record.size)} mono />
          {record.wordCount != null && <Field label="Word Count" value={record.wordCount.toLocaleString()} />}
          <div className="mt-2 flex items-center justify-between rounded-md bg-surface-800 px-2.5 py-2">
            <span className="truncate font-mono text-[11px] text-slate-400">{record.hash || 'No hash recorded'}</span>
            {record.hash && (
              <button onClick={() => { copyToClipboard(record.hash); setCopiedHash(true); setTimeout(() => setCopiedHash(false), 1200); }} className="ml-2 shrink-0 rounded p-1 text-slate-500 hover:text-slate-200">
                {copiedHash ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
              </button>
            )}
          </div>
        </Section>

        <Section title="Origin" icon={Building2}>
          <Field label="Source" value={record.source} />
          <Field label="Side" value={<SideBadge side={record.side} />} />
          <div className="mt-2 flex items-center gap-1.5 rounded-md bg-surface-800 px-2.5 py-2">
            <span className="truncate font-mono text-[11px] text-slate-400" title={record.path}>{record.path || '—'}</span>
            {record.path && (
              <span onClick={() => { copyToClipboard(record.path); toast('Path copied', { type: 'success' }); }} className="ml-auto shrink-0 cursor-pointer rounded p-1 text-slate-500 hover:text-slate-200"><Copy size={13} /></span>
            )}
          </div>
        </Section>

        {record.categories?.length > 0 && (
          <Section title="Smart Categories" icon={Tag}>
            <div className="flex flex-wrap gap-1.5">
              {record.categories.map((c) => (
                <span key={c.id} className="rounded-full bg-surface-800 px-2 py-1 text-[11px] text-slate-300">{c.name} <span className="text-slate-500">· {c.word_count}</span></span>
              ))}
            </div>
          </Section>
        )}

        {/* Analyst Classification: a deliberately separate namespace/section
            from "Smart Categories" above (Api/services/analyst_categories.py,
            §2/§5/§37) -- never merged, never overwritten by system output. */}
        <Section title="Analyst Classification" icon={Tags}>
          {record.analystCategories?.length > 0 ? (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {record.analystCategories.map((c) => (
                <AnalystCategoryChip
                  key={c.id}
                  name={c.name}
                  color={c.color}
                  onRemove={removingCategoryId === c.id ? undefined : () => removeAnalystCategory(c.id, c.name)}
                />
              ))}
            </div>
          ) : (
            <div className="mb-2.5 text-[12px] text-slate-500">Not yet classified by an analyst.</div>
          )}
          <button onClick={() => setClassifyOpen(true)} className="flex items-center gap-1.5 rounded-md border border-surface-border px-2.5 py-1.5 text-[12px] font-medium text-blue-300 hover:bg-surface-800">
            <Plus size={13} /> {record.analystCategories?.length > 0 ? 'Add Another Category' : 'Assign Category'}
          </button>
          {record.analystAssignments?.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-surface-border/60 pt-2.5">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500">Classification History</div>
              {record.analystAssignments.slice(0, 5).map((a) => (
                <div key={a.id} className="text-[11.5px] text-slate-400">
                  <span className="text-slate-300">{a.category_name}</span> by <span className="text-slate-300">{a.assigned_by_username}</span> · {formatRelative(a.assigned_at)}
                  {a.source_query && <span className="block truncate text-slate-600" title={a.source_query}>from search “{a.source_query}”</span>}
                </div>
              ))}
            </div>
          )}
        </Section>
        {classifyOpen && (
          <ClassifyDialog
            fileIds={[record.id]}
            sourceQuery={query}
            onClose={() => setClassifyOpen(false)}
            onAssigned={() => loadRecord()}
          />
        )}

        {!!record.content && (
          <Section title="Document Content" icon={BookOpen}>
            <button onClick={() => setContentOpen((v) => !v)} className="flex items-center gap-1.5 text-[12px] font-medium text-blue-300 hover:text-blue-200">
              <BookOpen size={13} /> {contentOpen ? 'Hide extracted text' : `Browse extracted text in-app (${record.content.length.toLocaleString()} chars)`}
            </button>
            {contentOpen && (
              <div className="scrollbar-thin mt-2 max-h-64 space-y-2.5 overflow-y-auto rounded-md border border-surface-border bg-surface-950/60 p-3">
                {segmentText(record.content, contentRanges).map((seg, i) => (
                  seg.highlight
                    ? <mark key={i} className="rounded bg-amber-400/90 px-0.5 text-surface-950">{seg.text}</mark>
                    : <span key={i} className="whitespace-pre-wrap text-[12px] leading-relaxed text-slate-400">{seg.text}</span>
                ))}
              </div>
            )}
          </Section>
        )}

        <Section title="Temporal Information" icon={Calendar}>
          <Field label="File Date" value={formatDate(record.fileDate, { time: true })} />
          <Field label="Creation Date" value={formatDate(record.creationDate, { time: true })} />
          <Field label="Age" value={formatRelative(record.creationDate)} />
        </Section>

        <Section title="Geographic Information" icon={MapPin}>
          {record.geoMentions?.length > 0 ? (
            <div className="space-y-2">
              <div className="text-[11px] text-slate-500">
                Real place name{record.geoMentions.length === 1 ? '' : 's'} found in this file's own extracted text (File Analysis &rsaquo; Geolocation):
              </div>
              {record.geoMentions.map((m) => (
                <div key={m.place_name} className="flex items-center justify-between gap-3 rounded-md border border-surface-border bg-surface-900/60 px-2.5 py-1.5">
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] font-medium text-slate-200">{m.place_name}{m.country ? `, ${m.country}` : ''}</div>
                    <div className="font-mono text-[10.5px] text-slate-500">{m.latitude?.toFixed?.(5)}, {m.longitude?.toFixed?.(5)}</div>
                  </div>
                  <span className="shrink-0 rounded-full bg-surface-800 px-2 py-0.5 text-[11px] font-medium text-slate-400">
                    {m.mention_count} mention{m.mention_count === 1 ? '' : 's'}
                  </span>
                </div>
              ))}
              <button
                onClick={() => { setViewMode('fileAnalysis'); setFileAnalysisSection('geolocation'); onClose?.(); }}
                className="text-[11.5px] font-medium text-blue-300 hover:text-blue-200"
              >
                View on Geolocation map &rarr;
              </button>
            </div>
          ) : record.coordinates ? (
            <Field label="Coordinates" value={record.coordinates} mono />
          ) : (
            <div className="text-[12px] text-slate-500">No geographic metadata is present for this file (no place-name mentions were found in its extracted text, and no EXIF/GPS data was extracted).</div>
          )}
        </Section>

        <Section title="Processing" icon={ShieldCheck}>
          <Field label="Status" value={<StatusBadge status={record.status} />} />
          <Field label="Hash Verification" value={record.hash ? 'Available' : 'Missing'} />
          {record.processing && <Field label="Extraction" value={record.processing.status} />}
          {record.processing?.attempts != null && <Field label="Attempts" value={record.processing.attempts} />}
          {record.errorMessage && <div className="mt-1.5 rounded-md bg-red-500/10 px-2.5 py-2 text-[11.5px] text-red-300">{record.errorMessage}</div>}
        </Section>

        {(record.lineage?.ancestors?.length > 0 || record.lineage?.descendants?.length > 0 || record.similarTitles?.length > 0) && (
          <Section title="Relationships & Lineage" icon={Network}>
            {record.lineage?.ancestors?.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-[11px] font-semibold text-slate-400">Extracted from ({record.lineage.ancestors.length})</div>
                {record.lineage.ancestors.map((a) => <RelatedRow key={a.id} label={a.file_name} onClick={() => openDetail(a.id)} />)}
              </div>
            )}
            {record.lineage?.descendants?.length > 0 && (
              <div className="mb-3">
                <div className="mb-1 text-[11px] font-semibold text-slate-400">Contains / produced ({record.lineage.descendants.length})</div>
                {record.lineage.descendants.slice(0, 8).map((d) => <RelatedRow key={d.id} label={d.file_name} onClick={() => openDetail(d.id)} />)}
              </div>
            )}
            {record.similarTitles?.length > 0 && (
              <div>
                <div className="mb-1 text-[11px] font-semibold text-slate-400">Titles similar to this one</div>
                {record.similarTitles.slice(0, 6).map((t) => (
                  <button key={t.id} onClick={() => openDetail(t.id)} className="flex w-full items-center justify-between rounded-md px-1.5 py-1 text-left text-[12px] text-slate-400 hover:bg-surface-800 hover:text-slate-200">
                    <span className="truncate">{t.name}</span>
                    <span className="shrink-0 text-slate-600">{t.similarity_percent}%</span>
                  </button>
                ))}
              </div>
            )}
          </Section>
        )}

        <div className="px-5 py-4">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Actions</div>
          <div className="grid grid-cols-2 gap-2">
            <ActionBtn icon={ImageIcon} label="Preview Original" onClick={() => setPreviewOpen(true)} />
            <ActionBtn
              icon={GitCompare}
              label={compareIds.includes(record.id) ? 'Added to Compare' : 'Add to Compare'}
              onClick={() => { addToCompare(record); toast(`${record.fileName} added to comparison tray`, { type: 'success' }); }}
            />
            <ActionBtn icon={isBookmarked ? BookmarkCheck : Bookmark} label={isBookmarked ? 'Remove Bookmark' : 'Bookmark for Review'} onClick={() => toggleBookmark(record.id)} />
            <ActionBtn icon={Fingerprint} label="Copy Hash" onClick={() => { if (record.hash) { copyToClipboard(record.hash); toast('Hash copied', { type: 'success' }); } }} />
            <ActionBtn icon={ClipboardCopy} label="Copy Details" onClick={copyDetails} />
          </div>
        </div>
      </div>
      {previewOpen && <FilePreviewModal record={record} onClose={() => setPreviewOpen(false)} />}
    </div>
  );
}
