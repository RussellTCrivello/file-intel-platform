import { useEffect, useState } from 'react';
import { fileAnalysis as fileAnalysisApi } from '../../lib/sylthaeApi';
import Breadcrumb from './Breadcrumb';
import EntityList, { EntityCard } from './EntityList';
import FacetFileList from './FacetFileList';

// Flat Category Words list (every single-word taxonomy term, whichever
// category it belongs to) -> Files. Mirrors KeywordBrowser exactly, but
// sources from `words_categorys` (single words only) instead of `keywords`
// (2+ word phrases) -- the two taxonomies are never conflated.
export default function WordBrowser({ onHome }) {
  const [word, setWord] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    if (word) return;
    let alive = true;
    setLoading(true);
    setError(null);
    fileAnalysisApi.words({ search, page, per_page: 30 })
      .then((d) => { if (!alive) return; setItems(d.data || []); setPagination(d.pagination); })
      .catch((e) => { if (!alive) return; setError(e.message || 'Failed to load words'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [word, search, page]);

  const crumbs = [{ label: 'Words', onClick: word ? () => setWord(null) : null }];
  if (word) crumbs.push({ label: word.name });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-surface-border bg-surface-900">
        <Breadcrumb crumbs={crumbs} onHome={onHome} />
      </div>

      {!word && (
        <EntityList
          items={items} loading={loading} error={error}
          search={search} onSearchChange={(v) => { setSearch(v); setPage(1); }}
          searchPlaceholder="Search words…"
          pagination={pagination} onPageChange={setPage}
          emptyTitle="No Category Words defined yet"
          emptyHint="Category Words are single-word taxonomy terms curated per category (Categories admin tool) and then matched against file content. None exist in this environment yet -- this is not an error."
          renderItem={(w) => (
            <EntityCard key={w.id} title={w.name} subtitle={`Category: ${w.category_name}`} onClick={() => setWord(w)}
              stats={[{ label: 'Files', value: w.file_count }, { label: 'Occurrences', value: w.occurrence_count }]} />
          )}
        />
      )}

      {word && <FacetFileList facet="word" id={word.id} label={word.name} />}
    </div>
  );
}
