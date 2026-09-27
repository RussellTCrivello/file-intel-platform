import { useAppStore } from '../store/useAppStore';
import FileAnalysisHub from '../components/fileAnalysis/FileAnalysisHub';
import CategoryBrowser from '../components/fileAnalysis/CategoryBrowser';
import WordBrowser from '../components/fileAnalysis/WordBrowser';
import KeywordBrowser from '../components/fileAnalysis/KeywordBrowser';
import TitleBrowser from '../components/fileAnalysis/TitleBrowser';
import SourceSideBrowser from '../components/fileAnalysis/SourceSideBrowser';
import RelationsBrowser from '../components/fileAnalysis/RelationsBrowser';
import GeolocationBrowser from '../components/fileAnalysis/GeolocationBrowser';

// Top-level File Analysis workspace: a hub of 7 real, independently
// queryable dimensions (Category, Keywords, Titles, Sources, Sides,
// Relations, Geolocation), each drilling down to the real file list via the
// exact same DataTable/ActionsMenu/RecordDetail/UniversalExportDialog the
// rest of the app uses (see FacetFileList). Mirrors, and modernizes, the
// legacy `File_Management_Analysis_System.html` page's structure.
export default function FileAnalysisView() {
  const section = useAppStore((s) => s.fileAnalysisSection);
  const setSection = useAppStore((s) => s.setFileAnalysisSection);

  const onHome = () => setSection(null);

  if (!section) return <FileAnalysisHub onSelect={setSection} />;
  if (section === 'category') return <CategoryBrowser onHome={onHome} />;
  if (section === 'words') return <WordBrowser onHome={onHome} />;
  if (section === 'keywords') return <KeywordBrowser onHome={onHome} />;
  if (section === 'titles') return <TitleBrowser onHome={onHome} />;
  if (section === 'sources') return <SourceSideBrowser dimension="source" onHome={onHome} />;
  if (section === 'sides') return <SourceSideBrowser dimension="side" onHome={onHome} />;
  if (section === 'relations') return <RelationsBrowser onHome={onHome} />;
  if (section === 'geolocation') return <GeolocationBrowser onHome={onHome} />;
  return <FileAnalysisHub onSelect={setSection} />;
}
