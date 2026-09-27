import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useSearchStore } from '../../store/useSearchStore';
import { useResults } from '../../lib/derived';
import DataTable from '../table/DataTable';
import FacetPagination from './FacetPagination';

// The file list at the bottom of every File Analysis drill-down. It is NOT
// a new table implementation: `loadFacetRows` (useSearchStore) populates the
// exact same `results`/`pagination` state `/api/search` does, normalized
// server-side (Api/routes/file_analysis.py `_rows_to_search_shape`), so this
// renders the real DataTable -- full ActionsMenu (classify/duplicates/
// export/locate-in-folder), RecordDetail, UniversalExportDialog, row
// selection and bulk actions all come for free, unchanged.
export default function FacetFileList({ facet, id, label, sourceId, sideId, place }) {
  const loadFacetRows = useSearchStore((s) => s.loadFacetRows);
  const loading = useSearchStore((s) => s.loading);
  const error = useSearchStore((s) => s.error);
  const pagination = useSearchStore((s) => s.pagination);
  const rows = useResults();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(50);

  useEffect(() => { setPage(1); }, [facet, id, sourceId, sideId, place]);

  useEffect(() => {
    loadFacetRows({ facet, id, label, page, perPage, sourceId, sideId, place });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facet, id, sourceId, sideId, place, page, perPage]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <main className="relative min-h-0 flex-1 overflow-hidden">
        {error && <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-[12px] text-red-300">{error}</div>}
        <DataTable rows={rows} />
        {loading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface-950/40">
            <Loader2 size={22} className="animate-spin text-blue-400" />
          </div>
        )}
      </main>
      <FacetPagination pagination={pagination} perPage={perPage} onPageChange={setPage} onPerPageChange={(n) => { setPerPage(n); setPage(1); }} />
    </div>
  );
}
