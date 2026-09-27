import { useEffect, useState } from 'react';
import { fileAnalysis as fileAnalysisApi } from '../../lib/sylthaeApi';
import Breadcrumb from './Breadcrumb';
import EntityList, { EntityCard } from './EntityList';
import FacetFileList from './FacetFileList';

// Category -> { Category Words | Keywords } -> Files.
//
// Taxonomy rule (never conflate): a Category Word is a single lexical word
// attached to a category via `words_categorys`; a Keyword is a 2+ word
// phrase attached via `keywords`/`keywords_hashs`. They are sibling children
// of a Category -- separate tables, separate tabs, separate drill-downs.
export default function CategoryBrowser({ onHome }) {
  const [category, setCategory] = useState(null); // { id, name }
  const [tab, setTab] = useState('words'); // 'words' | 'keywords', once a category is selected
  const [entry, setEntry] = useState(null); // the selected word or keyword { id, name, kind }

  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState(null);
  const [catSearch, setCatSearch] = useState('');
  const [catPage, setCatPage] = useState(1);
  const [catPagination, setCatPagination] = useState(null);

  const [words, setWords] = useState([]);
  const [wLoading, setWLoading] = useState(true);
  const [wError, setWError] = useState(null);
  const [wPage, setWPage] = useState(1);
  const [wPagination, setWPagination] = useState(null);

  const [keywords, setKeywords] = useState([]);
  const [kwLoading, setKwLoading] = useState(true);
  const [kwError, setKwError] = useState(null);
  const [kwPage, setKwPage] = useState(1);
  const [kwPagination, setKwPagination] = useState(null);

  useEffect(() => {
    if (category) return;
    let alive = true;
    setCatLoading(true);
    setCatError(null);
    fileAnalysisApi.categories({ search: catSearch, page: catPage, per_page: 30 })
      .then((d) => { if (!alive) return; setCategories(d.data || []); setCatPagination(d.pagination); })
      .catch((e) => { if (!alive) return; setCatError(e.message || 'Failed to load categories'); })
      .finally(() => { if (alive) setCatLoading(false); });
    return () => { alive = false; };
  }, [category, catSearch, catPage]);

  useEffect(() => {
    if (!category || tab !== 'words' || entry) return;
    let alive = true;
    setWLoading(true);
    setWError(null);
    fileAnalysisApi.categoryWords(category.id, { page: wPage, per_page: 30 })
      .then((d) => { if (!alive) return; setWords(d.data || []); setWPagination(d.pagination); })
      .catch((e) => { if (!alive) return; setWError(e.message || 'Failed to load category words'); })
      .finally(() => { if (alive) setWLoading(false); });
    return () => { alive = false; };
  }, [category, tab, entry, wPage]);

  useEffect(() => {
    if (!category || tab !== 'keywords' || entry) return;
    let alive = true;
    setKwLoading(true);
    setKwError(null);
    fileAnalysisApi.categoryKeywords(category.id, { page: kwPage, per_page: 30 })
      .then((d) => { if (!alive) return; setKeywords(d.data || []); setKwPagination(d.pagination); })
      .catch((e) => { if (!alive) return; setKwError(e.message || 'Failed to load keywords'); })
      .finally(() => { if (alive) setKwLoading(false); });
    return () => { alive = false; };
  }, [category, tab, entry, kwPage]);

  function selectCategory(c) {
    setCategory(c);
    setTab('words');
    setEntry(null);
  }

  function backToCategory() {
    setEntry(null);
  }

  const crumbs = [{ label: 'Category', onClick: category ? () => { setCategory(null); setEntry(null); } : null }];
  if (category) crumbs.push({ label: category.name, onClick: entry ? backToCategory : null });
  if (entry) crumbs.push({ label: entry.kind === 'word' ? `Word: ${entry.name}` : `Keyword: ${entry.name}` });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-surface-border bg-surface-900">
        <Breadcrumb crumbs={crumbs} onHome={onHome} />
      </div>

      {!category && (
        <EntityList
          items={categories} loading={catLoading} error={catError}
          search={catSearch} onSearchChange={(v) => { setCatSearch(v); setCatPage(1); }}
          searchPlaceholder="Search categories…"
          pagination={catPagination} onPageChange={setCatPage}
          emptyTitle="No categories defined yet"
          emptyHint="Categories are the analyst-curated word taxonomy (Categories admin tool). None have been created in this environment yet, so there is nothing to browse -- this is not an error."
          renderItem={(c) => (
            <EntityCard key={c.id} title={c.name} onClick={() => selectCategory(c)}
              stats={[
                { label: 'Words', value: c.word_count },
                { label: 'Keywords', value: c.keyword_count },
                { label: 'Files', value: c.file_count },
                { label: 'Word matches', value: c.word_matches },
                { label: 'Keyword matches', value: c.keyword_matches },
              ]} />
          )}
        />
      )}

      {category && !entry && (
        <>
          <div className="flex shrink-0 gap-1 border-b border-surface-border bg-surface-900 px-4 pt-2">
            {[
              { id: 'words', label: 'Category Words' },
              { id: 'keywords', label: 'Keywords' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-t-md border border-b-0 px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                  tab === t.id
                    ? 'border-surface-border bg-surface-800 text-slate-100'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'words' && (
            <EntityList
              items={words} loading={wLoading} error={wError}
              pagination={wPagination} onPageChange={setWPage}
              emptyTitle={`No Category Words defined under "${category.name}" yet`}
              emptyHint='Category Words are single-word taxonomy terms attached to this category (Categories admin tool, "Category Words") and matched against file content. None exist for this category yet.'
              renderItem={(w) => (
                <EntityCard key={w.id} title={w.name} onClick={() => setEntry({ ...w, kind: 'word' })}
                  stats={[{ label: 'Files', value: w.file_count }, { label: 'Occurrences', value: w.occurrence_count }]} />
              )}
            />
          )}

          {tab === 'keywords' && (
            <EntityList
              items={keywords} loading={kwLoading} error={kwError}
              pagination={kwPagination} onPageChange={setKwPage}
              emptyTitle={`No Keywords defined under "${category.name}" yet`}
              emptyHint="Keywords are multi-word phrases (2+ words) curated per category (Keywords admin tool) and matched against file content. None exist for this category yet."
              renderItem={(k) => (
                <EntityCard key={k.id} title={k.name} onClick={() => setEntry({ ...k, kind: 'keyword' })}
                  stats={[{ label: 'Files', value: k.file_count }, { label: 'Occurrences', value: k.occurrence_count }]} />
              )}
            />
          )}
        </>
      )}

      {category && entry && (
        <FacetFileList facet={entry.kind === 'word' ? 'word' : 'keyword'} id={entry.id} label={entry.name} />
      )}
    </div>
  );
}
