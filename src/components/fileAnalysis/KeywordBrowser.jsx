import { useEffect, useState } from 'react';
import { fileAnalysis as fileAnalysisApi } from '../../lib/sylthaeApi';
import Breadcrumb from './Breadcrumb';
import EntityList, { EntityCard } from './EntityList';
import FacetFileList from './FacetFileList';

// Flat Keywords list (every keyword, whichever category it belongs to) ->
// Files. Spec: "display all keywords, indicating the category each belongs
// to and the number of files containing that keyword."
export default function KeywordBrowser({ onHome }) {
  const [keyword, setKeyword] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    if (keyword) return;
    let alive = true;
    setLoading(true);
    setError(null);
    fileAnalysisApi.keywords({ search, page, per_page: 30 })
      .then((d) => { if (!alive) return; setItems(d.data || []); setPagination(d.pagination); })
      .catch((e) => { if (!alive) return; setError(e.message || 'Failed to load keywords'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [keyword, search, page]);

  const crumbs = [{ label: 'Keywords', onClick: keyword ? () => setKeyword(null) : null }];
  if (keyword) crumbs.push({ label: keyword.name });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-surface-border bg-surface-900">
        <Breadcrumb crumbs={crumbs} onHome={onHome} />
      </div>

      {!keyword && (
        <EntityList
          items={items} loading={loading} error={error}
          search={search} onSearchChange={(v) => { setSearch(v); setPage(1); }}
          searchPlaceholder="Search keywords…"
          pagination={pagination} onPageChange={setPage}
          emptyTitle="No keywords defined yet"
          emptyHint="Keyword phrases are curated per category (Keywords admin tool) and then matched against file content. None exist in this environment yet -- this is not an error."
          renderItem={(k) => (
            <EntityCard key={k.id} title={k.name} subtitle={`Category: ${k.category_name}`} onClick={() => setKeyword(k)}
              stats={[{ label: 'Files', value: k.file_count }]} />
          )}
        />
      )}

      {keyword && <FacetFileList facet="keyword" id={keyword.id} label={keyword.name} />}
    </div>
  );
}
