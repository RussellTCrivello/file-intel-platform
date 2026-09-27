import { useState } from 'react';
import { ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { useLayerState } from './layers';

function Row({ layer, active, onToggle }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11.5px] hover:bg-surface-800">
      <input
        type="checkbox"
        checked={active}
        onChange={() => onToggle(layer.id)}
        className="h-3.5 w-3.5 shrink-0 accent-teal-700"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-slate-300">{layer.label}</span>
        {layer.hint && <span className="block truncate text-[10px] text-slate-500">{layer.hint}</span>}
      </span>
    </label>
  );
}

/**
 * Layer switcher. Rendered outside <MapContainer> (it is plain app chrome,
 * not a Leaflet layer) and positioned by its caller.
 */
export default function LayerSwitcher({ right = 'right-3', bottom = 'bottom-3' }) {
  const { active, usable, toggle } = useLayerState();
  const [collapsed, setCollapsed] = useState(false);

  const groups = [...new Set(usable.map((l) => l.group))];
  const enabledCount = usable.filter((l) => active[l.id]).length;

  return (
    <div
      className="absolute z-[1000] w-56 rounded-lg border border-surface-border bg-surface-900/95 shadow-panel backdrop-blur"
      style={{ right, bottom }}
    >
      <button
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="flex w-full items-center gap-1.5 px-2.5 py-2 text-[11.5px] font-semibold text-slate-300 hover:bg-surface-800 rounded-t-lg"
      >
        <Layers size={13} className="text-teal-700" />
        Layers
        <span className="ml-auto text-[10.5px] font-normal text-slate-500">
          {enabledCount}/{usable.length}
        </span>
        {collapsed ? <ChevronUp size={13} className="text-slate-500" /> : <ChevronDown size={13} className="text-slate-500" />}
      </button>

      {!collapsed && (
        <div className="max-h-[46vh] overflow-y-auto border-t border-surface-border p-1.5">
          {groups.map((group) => (
            <div key={group} className="mb-1.5 last:mb-0">
              <div className="px-1.5 pb-0.5 pt-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                {group}
              </div>
              {usable.filter((l) => l.group === group).map((layer) => (
                <Row key={layer.id} layer={layer} active={active[layer.id]} onToggle={toggle} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
