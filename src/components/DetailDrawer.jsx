import { createPortal } from 'react-dom';
import { useAppStore } from '../store/useAppStore';
import RecordDetail from './RecordDetail';

export default function DetailDrawer() {
  const detailOpen = useAppStore((s) => s.detailOpen);
  const activeRecordId = useAppStore((s) => s.activeRecordId);
  const closeDetail = useAppStore((s) => s.closeDetail);

  if (!detailOpen || !activeRecordId) return null;

  return createPortal(
    <div className="fixed inset-0 z-[250] flex justify-end">
      <div className="flex-1 bg-black/50 backdrop-blur-[2px] animate-fade-in" onClick={closeDetail} />
      <div className="h-full w-full max-w-md animate-fade-in border-l border-surface-border shadow-2xl shadow-black/60">
        <RecordDetail recordId={activeRecordId} onClose={closeDetail} />
      </div>
    </div>,
    document.body
  );
}
