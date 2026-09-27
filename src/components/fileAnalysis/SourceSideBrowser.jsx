import { useEffect, useState } from 'react';
import { Folder } from 'lucide-react';
import { fileAnalysis as fileAnalysisApi } from '../../lib/sylthaeApi';
import Breadcrumb from './Breadcrumb';
import EntityList, { EntityCard } from './EntityList';
import FacetFileList from './FacetFileList';

// Shared implementation for Sources and Sides: both are
// entity -> (categories with file counts) + (keywords with file counts,
// optionally scoped to a selected category) -> files. Per spec: "Upon
// entering a specific source, the system displays all its categories...
// It also categorizes based on keywords... Clicking a keyword reveals the
// files... When accessing a category, the system displays the keywords
// associated with that category, within the source." Sides mirror this
// exactly, scoped by side instead of source.
export default function SourceSideBrowser({ dimension, onHome }) {
  const isSource = dimension === 'source';
  const label = isSource ? 'Sources' : 'Sides';
  const listFn = isSource ? fileAnalysisApi.sources : fileAnalysisApi.sides;
  const categoriesFn = isSource ? fileAnalysisApi.sourceCategories : fileAnalysisApi.sideCategories;
  const wordsFn = isSource ? fileAnalysisApi.sourceWords : fileAnalysisApi.sideWords;
  const keywordsFn = isSource ? fileAnalysisApi.sourceKeywords : fileAnalysisApi.sideKeywords;
  const idKey = isSource ? 'sourceId' : 'sideId';

  const [entity, setEntity] = useState(null);
  const [category, setCategory] = useState(null);
  const [word, setWord] = useState(null);
  const [keyword, setKeyword] = useState(null);
  const [showAllFiles, setShowAllFiles] = useState(false);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);

  const [cats, setCats] = useState([]);
  const [catsLoading, setCatsLoading] = useState(true);
  const [ws, setWs] = useState([]);
  const [wsLoading, setWsLoading] = useState(true);
  const [kws, setKws] = useState([]);
  const [kwsLoading, setKwsLoading] = useState(true);

  useEffect(() => {
    if (entity) return;
    let alive = true;
    setLoading(true);
    setError(null);
    listFn({ search, page, per_page: 30 })
      .then((d) => { if (!alive) return; setItems(d.data || []); setPagination(d.pagination); })
      .catch((e) => { if (!alive) return; setError(e.message || `Failed to load ${label.toLowerCase()}`); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, search, page]);

  useEffect(() => {
    if (!entity || keyword) return;
    let alive = true;
    setCatsLoading(true);
    categoriesFn(entity.id, { per_page: 100 })
      .then((d) => { if (alive) setCats(d.data || []); })
      .catch(() => { if (alive) setCats([]); })
      .finally(() => { if (alive) setCatsLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, keyword]);

  useEffect(() => {
    if (!entity || word || keyword) return;
    let alive = true;
    setWsLoading(true);
    wordsFn(entity.id, { per_page: 100, category_id: category?.id })
      .then((d) => { if (alive) setWs(d.data || []); })
      .catch(() => { if (alive) setWs([]); })
      .finally(() => { if (alive) setWsLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, category, word, keyword]);

  useEffect(() => {
    if (!entity || word || keyword) return;
    let alive = true;
    setKwsLoading(true);
    keywordsFn(entity.id, { per_page: 100, category_id: category?.id })
      .then((d) => { if (alive) setKws(d.data || []); })
      .catch(() => { if (alive) setKws([]); })
      .finally(() => { if (alive) setKwsLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity, category, word, keyword]);

  const resetEntity = () => { setEntity(null); setCategory(null); setWord(null); setKeyword(null); setShowAllFiles(false); };
  const backToEntity = () => { setCategory(null); setWord(null); setKeyword(null); setShowAllFiles(false); };

  const crumbs = [{ label, onClick: entity ? resetEntity : null }];
  if (entity) crumbs.push({ label: entity.name, onClick: (category || word || keyword || showAllFiles) ? backToEntity : null });
  if (category && !word && !keyword) crumbs.push({ label: `Category: ${category.name}` });
  if (word) crumbs.push({ label: `Word: ${word.name}` });
  if (keyword) crumbs.push({ label: `Keyword: ${keyword.name}` });
  if (showAllFiles) crumbs.push({ label: 'All files' });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-surface-border bg-surface-900">
        <Breadcrumb crumbs={crumbs} onHome={onHome} />
      </div>

      {!entity && (
        <EntityList
          items={items} loading={loading} error={error}
          search={search} onSearchChange={(v) => { setSearch(v); setPage(1); }}
          searchPlaceholder={`Search ${label.toLowerCase()}…`}
          pagination={pagination} onPageChange={setPage}
          emptyTitle={`No ${label.toLowerCase()} with files yet`}
          renderItem={(s) => (
            <EntityCard key={s.id} title={s.name}
              subtitle={isSource ? [s.job, s.country, s.city].filter(Boolean).join(' · ') || undefined : undefined}
              onClick={() => setEntity(s)}
              stats={[{ label: 'Files', value: s.file_count }]} />
          )}
        />
      )}

      {entity && !word && !keyword && !showAllFiles && (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center justify-between border-b border-surface-border bg-surface-900/40 px-4 py-2">
            <span className="text-[12px] text-slate-400">{entity.file_count.toLocaleString()} file{entity.file_count === 1 ? '' : 's'} total in {entity.name}</span>
            <button onClick={() => setShowAllFiles(true)} className="flex items-center gap-1.5 rounded-md border border-surface-border bg-surface-800 px-2.5 py-1.5 text-[12px] font-medium text-slate-300 hover:bg-surface-750">
              <Folder size={13} /> View all {entity.file_count.toLocaleString()} files
            </button>
          </div>
        <div className="grid min-h-0 flex-1 grid-cols-1 divide-x divide-surface-border overflow-hidden md:grid-cols-3">
          <div className="flex min-h-0 flex-col overflow-hidden">
            <div className="border-b border-surface-border bg-surface-900/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Categories in {entity.name}
            </div>
            <EntityList
              items={cats} loading={catsLoading} error={null}
              pagination={null} onPageChange={() => {}}
              emptyTitle="No categories tagged in this source/side yet"
              renderItem={(c) => (
                <EntityCard key={c.id} title={c.name} onClick={() => setCategory(category?.id === c.id ? null : c)}
                  stats={[{ label: 'Files', value: c.file_count }]} />
              )}
            />
          </div>
          <div className="flex min-h-0 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-surface-border bg-surface-900/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <span>Words {category ? `in "${category.name}"` : `in ${entity.name}`}</span>
              {category && <button onClick={() => setCategory(null)} className="normal-case text-blue-400 hover:underline">clear filter</button>}
            </div>
            <EntityList
              items={ws} loading={wsLoading} error={null}
              pagination={null} onPageChange={() => {}}
              emptyTitle="No Category Words tagged here yet"
              renderItem={(w) => (
                <EntityCard key={w.id} title={w.name} subtitle={`Category: ${w.category_name}`} onClick={() => setWord(w)}
                  stats={[{ label: 'Files', value: w.file_count }]} />
              )}
            />
          </div>
          <div className="flex min-h-0 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-surface-border bg-surface-900/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <span>Keywords {category ? `in "${category.name}"` : `in ${entity.name}`}</span>
              {category && <button onClick={() => setCategory(null)} className="normal-case text-blue-400 hover:underline">clear filter</button>}
            </div>
            <EntityList
              items={kws} loading={kwsLoading} error={null}
              pagination={null} onPageChange={() => {}}
              emptyTitle="No keywords tagged here yet"
              renderItem={(k) => (
                <EntityCard key={k.id} title={k.name} subtitle={`Category: ${k.category_name}`} onClick={() => setKeyword(k)}
                  stats={[{ label: 'Files', value: k.file_count }]} />
              )}
            />
          </div>
        </div>
        </div>
      )}

      {entity && showAllFiles && !word && !keyword && (
        <FacetFileList facet={dimension} id={entity.id} label={entity.name} />
      )}

      {entity && word && (
        <FacetFileList facet="word" id={word.id} label={word.name} {...{ [idKey]: entity.id }} />
      )}

      {entity && keyword && (
        <FacetFileList facet="keyword" id={keyword.id} label={keyword.name} {...{ [idKey]: entity.id }} />
      )}
    </div>
  );
}
