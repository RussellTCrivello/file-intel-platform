import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, Download, FolderOpen, Loader2, Trash2 } from 'lucide-react';
import { isDesktop, canWrite, getStatus, downloadLayers, removeLayers, onLayerDatabaseChange } from '../../lib/layerSource.js';

const DEFAULT_SOURCE = 'http://127.0.0.1:5000/layers/layers.db';

function bytes(n) {
  if (n == null) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function when(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

const KIND_LABEL = { basemap: 'Basemap geometry', gazetteer: 'Place gazetteer', user: 'Saved by you' };

/**
 * Map data: the compressed layer database that lives in the project's own
 * folder, is read on every map load, and is refreshed by downloading a new
 * copy whenever the machine is online.
 */
export default function MapDataPanel() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [source, setSource] = useState(DEFAULT_SOURCE);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getStatus({ refresh: true }));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => onLayerDatabaseChange(() => refresh()), [refresh]);

  const download = async () => {
    setBusy('download');
    setError(null);
    setNotice(null);
    try {
      const result = await downloadLayers(source.trim());
      setNotice(`Installed ${result.sections.length} layers (${bytes(result.bytes)}).`);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('remove');
    setError(null);
    try {
      await removeLayers();
      setNotice('Layer database removed. The map falls back to its bundled overview until you download one again.');
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-800">Map data</h3>
        <p className="text-xs text-slate-500">
          The offline layer database holds the basemap geometry and the place gazetteer that power
          the maps, coordinate search and reverse lookup. It is read from the application's own
          folder and included in the installer.
        </p>
      </div>

      <div className="rounded-lg border border-surface-border bg-surface-850 p-3">
        <div className="flex items-start gap-2">
          <Database size={15} className="mt-0.5 shrink-0 text-teal-700" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[12.5px] font-medium text-slate-700">Location</span>
              {status?.locationLabel && (
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                  status.location === 'program' ? 'bg-emerald-500/10 text-emerald-500'
                    : status.location === 'unwritable' ? 'bg-amber-500/10 text-amber-600'
                      : 'bg-surface-800 text-slate-500'}`}>
                  {status.locationLabel}
                </span>
              )}
            </div>
            <code className="mt-0.5 block break-all font-mono text-[10.5px] text-slate-500">
              {status?.folder || 'resolving…'}
            </code>
            {status?.location === 'userData' && (
              <p className="mt-1 text-[10.5px] leading-relaxed text-slate-500">
                This install lives in a read-only location, so the database is kept in your per-user
                application data folder instead. Both maps still read it normally.
              </p>
            )}
            {status?.location === 'unwritable' && (
              <p className="mt-1 text-[10.5px] leading-relaxed text-amber-600">
                The application folder is read-only and no writable fallback was found, so downloads
                will fail. Move the application to a writable folder, or rebuild it with the layer
                database bundled.
              </p>
            )}
          </div>
        </div>
      </div>

      {status?.present ? (
        <div className="rounded-lg border border-surface-border">
          <div className="flex items-center gap-2 border-b border-surface-border bg-surface-850 px-3 py-2">
            <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
            <span className="text-[12.5px] font-medium text-slate-700">Installed</span>
            <span className="ml-auto font-mono text-[11px] tabular-nums text-slate-500">{bytes(status.bytes)}</span>
          </div>
          <ul className="divide-y divide-surface-border">
            {status.sections.map((s) => (
              <li key={s.id} className="flex items-center gap-2 px-3 py-1.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[11.5px] text-slate-400">
                    {KIND_LABEL[s.kind] && (
                      <span className="mr-1.5 rounded border border-surface-border px-1 py-px align-middle text-[9.5px] uppercase tracking-wide text-slate-500">
                        {KIND_LABEL[s.kind]}
                      </span>
                    )}
                    {s.meta?.label || s.id}
                  </span>
                  {s.meta?.description && (
                    <span className="block truncate text-[10.5px] text-slate-500">{s.meta.description}</span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-slate-500">
                  {bytes(s.length)}
                </span>
              </li>
            ))}
          </ul>
          {status.created && (
            <p className="border-t border-surface-border px-3 py-1.5 text-[10.5px] text-slate-500">
              Built {when(status.created)}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-surface-border bg-surface-850 px-3 py-2.5 text-[11.5px] text-slate-500">
          No layer database found. The maps fall back to the small bundled overview — coastlines and
          country borders still draw, but there is no detailed scale and no place search until you
          download one.
        </div>
      )}

      {status?.error && (
        <div className="flex items-start gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-500">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          <span>The database on disk could not be read: {status.error}</span>
        </div>
      )}

      {isDesktop ? (
        <>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Download source
            </label>
            <div className="flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-800 px-2 py-1.5 focus-within:border-teal-600/50">
              <FolderOpen size={13} className="shrink-0 text-slate-500" />
              <input
                value={source}
                onChange={(e) => setSource(e.target.value)}
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent font-mono text-[11px] text-slate-300 outline-none"
              />
            </div>
            <p className="mt-1 text-[10.5px] leading-relaxed text-slate-500">
              Any http(s) URL or local file path serving a <code>layers.db</code>. Defaults to the
              SYLTHARAE service. The file is validated before it replaces what you have.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={download}
              disabled={busy === 'download' || !source.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-700 px-3 py-1.5 text-[12px] font-medium text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {busy === 'download' ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              Download map layers
            </button>
            {status?.present && (
              <button
                onClick={remove}
                disabled={busy === 'remove'}
                className="inline-flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-800 px-3 py-1.5 text-[12px] text-slate-400 hover:bg-surface-750 disabled:opacity-50"
              >
                {busy === 'remove' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Remove
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="rounded-lg border border-surface-border bg-surface-850 px-3 py-2 text-[11px] text-slate-500">
          {canWrite ? '' : 'In the browser build the database is read-only. Open the desktop '
            + 'application to download or remove map layers.'}
        </p>
      )}

      {notice && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11.5px] text-emerald-500">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11.5px] text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
