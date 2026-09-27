import {
  LayoutDashboard, Table2, LayoutGrid, List, Rows3, PanelRightOpen,
  KanbanSquare, GanttChartSquare, Map as MapIcon, Share2, Copy,
  Tags, FolderKanban, History, FolderTree, LayoutList,
} from 'lucide-react';

export const VIEW_MODES = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'formats', label: 'Format Browser', icon: FolderTree },
  { id: 'fileAnalysis', label: 'File Analysis', icon: LayoutList },
  { id: 'table', label: 'Table', icon: Table2 },
  { id: 'cards', label: 'Cards', icon: LayoutGrid },
  { id: 'compact', label: 'Compact', icon: List },
  { id: 'detailed', label: 'Detailed List', icon: Rows3 },
  { id: 'split', label: 'Split Panel', icon: PanelRightOpen },
  { id: 'kanban', label: 'Kanban', icon: KanbanSquare },
  { id: 'timeline', label: 'Timeline', icon: GanttChartSquare },
  { id: 'map', label: 'Map', icon: MapIcon },
  { id: 'network', label: 'Network', icon: Share2 },
  { id: 'duplicates', label: 'Duplicates', icon: Copy },
];

// Standalone Analyst Classification workspace pages (spec §3/§5/§12) --
// full-width admin-style surfaces, not alternate presentations of the
// current search result set, so they're listed separately from
// VIEW_MODES/SIDEBAR_VIEWS and rendered without the filter/sidebar/pagination
// chrome (see App.jsx FULL_WIDTH_VIEWS).
export const ANALYST_WORKSPACE_VIEWS = [
  { id: 'classify', label: 'Analyst Workspace', icon: Tags },
  { id: 'categories', label: 'Categories Manager', icon: FolderKanban },
  { id: 'audit', label: 'Classification History', icon: History },
];
