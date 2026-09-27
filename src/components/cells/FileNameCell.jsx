import FileTypeIcon from './FileTypeIcon';
import { truncateMiddle } from '../../lib/format';

export default function FileNameCell({ record, onOpen, compact = false }) {
  return (
    <button
      onClick={() => onOpen && onOpen(record)}
      title={record.fileName}
      className="group flex min-w-0 items-center gap-2 text-left focus-ring rounded"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-800 ring-1 ring-inset ring-surface-border">
        <FileTypeIcon family={record.typeFamily} color={record.typeColor} size={14} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className={`truncate font-medium text-slate-200 group-hover:text-blue-400 group-hover:underline underline-offset-2 ${compact ? 'text-[13px]' : 'text-sm'}`}>
            {truncateMiddle(record.fileName, compact ? 34 : 46)}
          </span>
        </span>
        {!compact && record.source && <span className="block truncate text-[11px] text-slate-500">{record.source}</span>}
      </span>
    </button>
  );
}
