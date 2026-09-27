import clsx from 'clsx';
import { CheckCircle2, Clock, Tags, X } from 'lucide-react';
import { statusDef, colorForKey } from '../../lib/domain';

export function TypeBadge({ type, color, size = 'sm' }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded border font-mono font-semibold tracking-wide',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'
      )}
      style={{ color, borderColor: `${color}55`, backgroundColor: `${color}14` }}
    >
      {type}
    </span>
  );
}

const STATUS_ICONS = { Read: CheckCircle2, Unread: Clock };

// `status` here is the real `file_status` value from the database: 'Read' or
// 'Unread'. There is no richer workflow-status enum on the server (no
// "pending review" / "flagged" / "archived") -- inventing one client-side
// would be exactly the kind of fabricated field the spec forbids.
export function StatusBadge({ status, showLabel = true, size = 'sm' }) {
  const def = statusDef(status);
  const Icon = STATUS_ICONS[status] || Clock;
  return (
    <span
      title={def.label}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      )}
      style={{ color: def.color, borderColor: `${def.color}45`, backgroundColor: `${def.color}12` }}
    >
      <Icon size={11} />
      {showLabel && def.label}
    </span>
  );
}

// Analyst-category chip (Api/services/analyst_categories.py). Deliberately
// styled differently from `TypeBadge`/smart-category chips (Tags icon, a
// left-edge colour bar instead of a flat fill, uppercase-free label) so the
// analyst namespace never reads as "just another smart category" (§2/§9/§37)
// -- colour alone is never the only identifier, the name is always shown too.
export function AnalystCategoryChip({ name, color, size = 'sm', onRemove }) {
  const c = color || '#3b82f6';
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-md border-l-[3px] bg-surface-800/80 pl-1.5 pr-1 font-medium text-slate-200',
        size === 'sm' ? 'py-0.5 text-[11px]' : 'py-1 text-[12px]'
      )}
      style={{ borderLeftColor: c }}
      title={`Analyst category: ${name}`}
    >
      <Tags size={size === 'sm' ? 10 : 12} style={{ color: c }} />
      {name}
      {onRemove && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="ml-0.5 rounded-full p-0.5 text-slate-500 hover:bg-surface-700 hover:text-red-300"
          title={`Remove "${name}" classification`}
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
}

// Sides are real, operator-defined rows from `/api/sides` -- there is no
// fixed enum of "the sides that exist", so the colour is derived
// deterministically from the name instead of a hardcoded lookup table.
export function SideBadge({ side, size = 'sm' }) {
  if (!side) return <span className="text-[11px] text-slate-600">—</span>;
  const color = colorForKey(side);
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded font-medium',
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'
      )}
      style={{ color, backgroundColor: `${color}12` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {side}
    </span>
  );
}
