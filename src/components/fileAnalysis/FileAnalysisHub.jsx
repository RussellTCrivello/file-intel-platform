import { useEffect, useState } from 'react';
import { FolderTree, Type, KeyRound, FileText, Building2, Users, GitBranch, MapPin, Loader2 } from 'lucide-react';
import { fileAnalysis as fileAnalysisApi } from '../../lib/sylthaeApi';

const SECTIONS = [
  { id: 'category', label: 'Category', icon: FolderTree, countKey: 'categories', desc: 'Analyst-curated word taxonomy: Category Words and Keywords per category, files per each.' },
  { id: 'words', label: 'Words', icon: Type, countKey: 'words', desc: 'Every single-word taxonomy term, its category, and how many files contain it.' },
  { id: 'keywords', label: 'Keywords', icon: KeyRound, countKey: 'keywords', desc: 'Every curated multi-word keyword phrase, its category, and how many files contain it.' },
  { id: 'titles', label: 'Titles', icon: FileText, countKey: 'titles', desc: 'Real extracted document titles and how many files share each one.' },
  { id: 'sources', label: 'Sources', icon: Building2, countKey: 'sources', desc: 'Every information source, drilling into its categories and keywords.' },
  { id: 'sides', label: 'Sides', icon: Users, countKey: 'sides', desc: 'Every side/party, drilling into its categories and keywords.' },
  { id: 'relations', label: 'Relations', icon: GitBranch, countKey: 'relations', desc: 'Content shared across different sources or sides -- never same source+side.' },
  { id: 'geolocation', label: 'Geolocation', icon: MapPin, countKey: 'geolocation', desc: 'Real place names found by scanning file content against a world gazetteer.' },
];

export default function FileAnalysisHub({ onSelect }) {
  const [counts, setCounts] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    fileAnalysisApi.overview()
      .then((d) => { if (alive) setCounts(d.counts); })
      .catch((e) => { if (alive) setError(e.message || 'Failed to load overview'); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="flex h-full flex-col overflow-y-auto scrollbar-thin px-6 py-6">
      <div className="mb-1 text-[17px] font-bold text-white">File Management and Analysis</div>
      <p className="mb-6 max-w-2xl text-[12.5px] text-slate-500">
        Comprehensive analysis, classification, and insights across categories, keywords, titles, sources, sides, cross-source relations, and content-derived geolocation. Every count below is a real, live aggregate.
      </p>

      {error && <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] text-red-300">{error}</div>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const count = counts ? counts[s.countKey] : null;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className="flex flex-col gap-2.5 rounded-xl border border-surface-border bg-surface-900 p-4 text-left transition-colors hover:border-blue-500/50 hover:bg-surface-850 focus-ring"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/15 text-blue-300">
                  <Icon size={17} />
                </span>
                {counts === null && !error ? (
                  <Loader2 size={14} className="animate-spin text-slate-600" />
                ) : (
                  <span className="text-[20px] font-bold text-white">{(count ?? 0).toLocaleString()}</span>
                )}
              </div>
              <div>
                <div className="text-[14px] font-semibold text-slate-100">{s.label}</div>
                <div className="text-[11px] text-slate-500">{count === 0 ? '0 items' : `${(count ?? 0).toLocaleString()} item${count === 1 ? '' : 's'}`}</div>
              </div>
              <p className="text-[11.5px] leading-relaxed text-slate-500">{s.desc}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
