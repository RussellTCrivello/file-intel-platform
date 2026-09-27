import { useEffect, useState } from 'react';
import { fileAnalysis as fileAnalysisApi } from '../../lib/sylthaeApi';
import Breadcrumb from './Breadcrumb';
import EntityList, { EntityCard } from './EntityList';
import FacetFileList from './FacetFileList';

// Titles -> Files. Spec: "the system displays the title and the number of
// files sharing that title; clicking a title reveals the specific files."
// Grouped by the real decoded title text (Api/routes/file_analysis.py
// `fa_titles`), so two distinct pieces of content that happen to carry the
// exact same title genuinely count as "sharing that title".
export default function TitleBrowser({ onHome }) {
  const [title, setTitle] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    if (title) return;
    let alive = true;
    setLoading(true);
    setError(null);
    fileAnalysisApi.titles({ search, page, per_page: 30 })
      .then((d) => { if (!alive) return; setItems(d.data || []); setPagination(d.pagination); })
      .catch((e) => { if (!alive) return; setError(e.message || 'Failed to load titles'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [title, search, page]);

  const crumbs = [{ label: 'Titles', onClick: title ? () => setTitle(null) : null }];
  if (title) crumbs.push({ label: title.name });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-surface-border bg-surface-900">
        <Breadcrumb crumbs={crumbs} onHome={onHome} />
      </div>

      {!title && (
        <EntityList
          items={items} loading={loading} error={error}
          search={search} onSearchChange={(v) => { setSearch(v); setPage(1); }}
          searchPlaceholder="Search titles…"
          pagination={pagination} onPageChange={setPage}
          emptyTitle="No titles extracted yet"
          renderItem={(t) => (
            <EntityCard key={t.id} title={t.name} onClick={() => setTitle(t)}
              stats={[{ label: 'Files', value: t.file_count }]} />
          )}
        />
      )}

      {title && <FacetFileList facet="title" id={title.id} label={title.name} />}
    </div>
  );
}
