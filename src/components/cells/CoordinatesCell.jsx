import { MapPin, MapPinOff } from 'lucide-react';
import { formatCoords } from '../../lib/format';

export default function CoordinatesCell({ coordinates, onOpenMap }) {
  if (!coordinates) {
    return <span className="inline-flex items-center gap-1 text-[11px] text-slate-600"><MapPinOff size={12} /> No geodata</span>;
  }
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onOpenMap && onOpenMap(coordinates); }}
      className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-300 hover:text-blue-400 focus-ring rounded"
      title="Open in map"
    >
      <MapPin size={12} className="text-blue-400" />
      {formatCoords(coordinates)}
    </button>
  );
}
