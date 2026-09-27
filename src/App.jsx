import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAppStore } from './store/useAppStore';
import { useSearchStore } from './store/useSearchStore';
import { useResults } from './lib/derived';
import TopBar from './components/TopBar';
import FilterBar from './components/FilterBar';
import ViewTabs from './components/ViewTabs';
import ContextualStatsBar from './components/ContextualStatsBar';
import CategoryExplorer from './components/CategoryExplorer';
import Pagination from './components/Pagination';
import BulkActionBar from './components/BulkActionBar';
import DetailDrawer from './components/DetailDrawer';
import FullDocumentViewer from './components/FullDocumentViewer';
import CommandPalette from './components/CommandPalette';
import CompareWorkspace from './components/CompareWorkspace';
import CompareTray from './components/CompareTray';
import SearchResultsPage from './components/SearchResultsPage';
import LoginScreen from './components/LoginScreen';
import ChangePasswordScreen from './components/ChangePasswordScreen';
import ToastHost from './components/ui/Toast';

import DataTable from './components/table/DataTable';
import DashboardView from './views/DashboardView';
import CardView from './views/CardView';
import CompactListView from './views/CompactListView';
import DetailedListView from './views/DetailedListView';
import SplitPanelView from './views/SplitPanelView';
import KanbanView from './views/KanbanView';
import TimelineView from './views/TimelineView';
import MapView from './views/MapView';
import NetworkView from './views/NetworkView';
import DuplicatesView from './views/DuplicatesView';
import AnalystWorkspaceView from './views/AnalystWorkspaceView';
import CategoryManagerView from './views/CategoryManagerView';
import ClassificationHistoryView from './views/ClassificationHistoryView';
import FormatBrowserView from './views/FormatBrowserView';
import FileAnalysisView from './views/FileAnalysisView';

const SIDEBAR_VIEWS = ['table', 'cards', 'compact', 'detailed', 'split', 'kanban', 'timeline', 'duplicates'];
// Standalone Analyst Classification admin pages (spec §3/§5/§12): full-width,
// no result-set filter chrome, sidebar or pagination -- same treatment as
// 'dashboard'. 'formats' joins this list too: the Format Browser brings its
// own FilterBar/ContextualStatsBar/Pagination inside FormatDetail (only once
// a format is selected) rather than always showing them, since the top-level
// Format Overview grid isn't a result-set view at all. 'fileAnalysis' is the
// same shape as 'formats': a hub of independent facets, each bringing its
// own file list (FacetFileList) only once you've drilled into one.
const FULL_WIDTH_VIEWS = ['dashboard', 'classify', 'categories', 'audit', 'formats', 'fileAnalysis'];

export default function App() {
  const authStatus = useSearchStore((s) => s.authStatus);
  const mustChangePassword = useSearchStore((s) => s.mustChangePassword);
  const bootstrapAuth = useSearchStore((s) => s.bootstrapAuth);
  const loading = useSearchStore((s) => s.loading);
  const error = useSearchStore((s) => s.error);

  useEffect(() => { bootstrapAuth(); }, [bootstrapAuth]);

  const viewMode = useAppStore((s) => s.viewMode);
  const appMode = useAppStore((s) => s.appMode);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const preferences = useAppStore((s) => s.preferences);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = preferences?.theme || 'porcelain';
    root.dataset.scale = preferences?.fontScale || 'standard';
    root.dataset.contrast = preferences?.highContrast ? 'high' : 'normal';
    root.lang = preferences?.language || 'en';
    root.classList.toggle('reduce-motion', !!preferences?.reducedMotion || preferences?.showAnimations === false);
  }, [preferences]);

  const rows = useResults();

  if (authStatus === 'checking') {
    return (
      <div className="flex h-screen items-center justify-center gap-2 bg-surface-950 text-slate-500">
        <Loader2 size={18} className="animate-spin" /> Connecting to SYLTHARAE…
      </div>
    );
  }
  if (authStatus === 'anonymous') return <LoginScreen />;
  if (mustChangePassword) return <ChangePasswordScreen />;

  const showSidebar = sidebarOpen && SIDEBAR_VIEWS.includes(viewMode) && appMode === 'explorer';
  const showStatsBar = !FULL_WIDTH_VIEWS.includes(viewMode) && appMode === 'explorer';

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface-950">
      <TopBar />
      {appMode === 'explorer' && <ViewTabs />}

      {appMode === 'results' ? (
        <SearchResultsPage />
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {showSidebar && <CategoryExplorer />}

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {!FULL_WIDTH_VIEWS.includes(viewMode) && <FilterBar />}
            {showStatsBar && <ContextualStatsBar data={rows} />}

            <main className="relative min-h-0 flex-1 overflow-hidden">
              {error && (
                <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-[12px] text-red-300">{error}</div>
              )}
              {viewMode === 'dashboard' && (
                <div className="h-full overflow-y-auto scrollbar-thin"><DashboardView /></div>
              )}
              {viewMode === 'formats' && <FormatBrowserView rows={rows} />}
              {viewMode === 'fileAnalysis' && <FileAnalysisView />}
              {viewMode === 'table' && <DataTable rows={rows} />}
              {viewMode === 'cards' && <div className="h-full overflow-y-auto scrollbar-thin"><CardView rows={rows} /></div>}
              {viewMode === 'compact' && <div className="h-full overflow-y-auto scrollbar-thin"><CompactListView rows={rows} /></div>}
              {viewMode === 'detailed' && <div className="h-full overflow-y-auto scrollbar-thin"><DetailedListView rows={rows} /></div>}
              {viewMode === 'split' && <SplitPanelView rows={rows} />}
              {viewMode === 'kanban' && <KanbanView rows={rows} />}
              {viewMode === 'timeline' && <div className="h-full overflow-y-auto scrollbar-thin"><TimelineView rows={rows} /></div>}
              {viewMode === 'map' && <MapView />}
              {viewMode === 'network' && <NetworkView rows={rows} />}
              {viewMode === 'duplicates' && <div className="h-full overflow-y-auto scrollbar-thin"><DuplicatesView /></div>}
              {viewMode === 'classify' && <AnalystWorkspaceView />}
              {viewMode === 'categories' && <CategoryManagerView />}
              {viewMode === 'audit' && <ClassificationHistoryView />}
              {loading && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface-950/40">
                  <Loader2 size={22} className="animate-spin text-blue-400" />
                </div>
              )}
            </main>

            {!FULL_WIDTH_VIEWS.includes(viewMode) && viewMode !== 'network' && viewMode !== 'map' && <Pagination />}
          </div>
        </div>
      )}

      <BulkActionBar />
      <CompareTray />
      <DetailDrawer />
      <FullDocumentViewer />
      <CompareWorkspace />
      <CommandPalette />
      <ToastHost />
    </div>
  );
}
