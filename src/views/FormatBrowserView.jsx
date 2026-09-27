import { useAppStore } from '../store/useAppStore';
import FormatOverview from '../components/formats/FormatOverview';
import FormatDetail from '../components/formats/FormatDetail';

// Two-level workspace: format list (real per-extension aggregates) drilling
// into the existing search/table infrastructure filtered to that extension.
// See FormatOverview.jsx / FormatDetail.jsx docstrings for the reuse contract.
export default function FormatBrowserView({ rows }) {
  const extension = useAppStore((s) => s.formatBrowserExtension);

  if (!extension) {
    return <div className="h-full overflow-y-auto scrollbar-thin"><FormatOverview /></div>;
  }
  return <FormatDetail extension={extension} rows={rows} />;
}
