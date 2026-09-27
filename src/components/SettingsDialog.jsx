import { useState } from 'react';
import { Accessibility, Check, Globe2, RotateCcw, SlidersHorizontal, Sparkles, Table2 } from 'lucide-react';
import Modal from './ui/Modal';
import { useAppStore } from '../store/useAppStore';
import { useSearchStore } from '../store/useSearchStore';

const defaults = {
  theme: 'porcelain', fontScale: 'standard', density: 'comfortable',
  language: 'en', dateFormat: 'locale', timeFormat: '24h', numberFormat: 'locale',
  timezone: 'local', pageSize: 25, reducedMotion: false, highContrast: false,
  showAnimations: true, confirmActions: true,
};
const sections = [
  { id: 'appearance', label: 'Appearance', icon: Sparkles },
  { id: 'formatting', label: 'Formatting', icon: SlidersHorizontal },
  { id: 'language', label: 'Language & region', icon: Globe2 },
  { id: 'tables', label: 'Tables & browsing', icon: Table2 },
  { id: 'accessibility', label: 'Accessibility', icon: Accessibility },
];

function SelectSetting({ label, description, value, onChange, options }) {
  return <label className="grid gap-1.5 sm:grid-cols-[1fr_220px] sm:items-center py-3 border-b border-surface-border last:border-0">
    <span><span className="block text-[13px] font-medium text-slate-700">{label}</span>{description && <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{description}</span>}</span>
    <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-[12px] text-slate-700 outline-none focus:ring-2 focus:ring-teal-600/30">
      {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
    </select>
  </label>;
}
function ToggleSetting({ label, description, checked, onChange }) {
  return <label className="flex cursor-pointer items-center justify-between gap-4 border-b border-surface-border py-3 last:border-0">
    <span><span className="block text-[13px] font-medium text-slate-700">{label}</span><span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">{description}</span></span>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 shrink-0 accent-teal-700" />
  </label>;
}

export default function SettingsDialog({ onClose }) {
  const preferences = useAppStore((s) => ({ ...defaults, ...s.preferences }));
  const updatePreferences = useAppStore((s) => s.updatePreferences);
  const setPerPage = useSearchStore((s) => s.setPerPage);
  const perPage = useSearchStore((s) => s.perPage);
  const [active, setActive] = useState('appearance');
  const set = (key) => (value) => updatePreferences({ [key]: value });
  const reset = () => { updatePreferences(defaults); useAppStore.getState().setDensity(defaults.density); setPerPage(defaults.pageSize); };
  const content = {
    appearance: <>
      <h3 className="mb-1 text-sm font-semibold text-slate-800">A workspace that feels right</h3><p className="mb-3 text-xs text-slate-500">Choose a light surface treatment and tune the density of information.</p>
      <SelectSetting label="Color treatment" description="Light palettes only; your choice is saved on this device." value={preferences.theme} onChange={set('theme')} options={[["porcelain", 'Porcelain · crisp white'], ["mist", 'Mist · cool gray'], ["sage", 'Sage · soft green']]} />
      <SelectSetting label="Interface scale" description="Adjust the overall text size across controls and panels." value={preferences.fontScale} onChange={set('fontScale')} options={[["compact", 'Compact'], ["standard", 'Standard'], ["large", 'Large']]} />
      <SelectSetting label="Information density" description="Controls row and card spacing throughout supported views." value={preferences.density} onChange={(v) => { set('density')(v); useAppStore.getState().setDensity(v); }} options={[["compact", 'Compact'], ["comfortable", 'Comfortable'], ["expanded", 'Expanded']]} />
    </>,
    formatting: <>
      <h3 className="mb-1 text-sm font-semibold text-slate-800">Dates, numbers & time</h3><p className="mb-3 text-xs text-slate-500">Preferences are stored locally and used by locale-aware displays where supported.</p>
      <SelectSetting label="Date format" description="Choose a familiar date order." value={preferences.dateFormat} onChange={set('dateFormat')} options={[["locale", 'Use language default'], ["dmy", 'DD / MM / YYYY'], ["mdy", 'MM / DD / YYYY'], ["ymd", 'YYYY / MM / DD']]} />
      <SelectSetting label="Time format" value={preferences.timeFormat} onChange={set('timeFormat')} options={[["24h", '24-hour clock'], ["12h", '12-hour clock']]} />
      <SelectSetting label="Number format" description="Controls decimal and thousands separators where supported." value={preferences.numberFormat} onChange={set('numberFormat')} options={[["locale", 'Use language default'], ["comma", '1,234.56'], ["period", '1.234,56']]} />
      <SelectSetting label="Time zone" value={preferences.timezone} onChange={set('timezone')} options={[["local", 'Device time zone'], ["UTC", 'UTC']]} />
    </>,
    language: <>
      <h3 className="mb-1 text-sm font-semibold text-slate-800">Language & regional preferences</h3><p className="mb-3 text-xs text-slate-500">Select a preferred locale. Interface copy remains English where translations are not yet available.</p>
      <SelectSetting label="Preferred language" description="Sets the preferred language and locale for translated labels and formatting." value={preferences.language} onChange={set('language')} options={[["en", 'English'], ["nl", 'Nederlands'], ["fr", 'Français'], ["de", 'Deutsch'], ["es", 'Español']]} />
      <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-3 text-[11px] leading-relaxed text-teal-900">Your data and searches are not changed by language or formatting preferences. Preferences are private to this browser profile.</div>
    </>,
    tables: <>
      <h3 className="mb-1 text-sm font-semibold text-slate-800">Results & browsing</h3><p className="mb-3 text-xs text-slate-500">Set a useful default for large file collections and repeated analysis.</p>
      <SelectSetting label="Default page size" description="Rows shown per results page where the view supports this setting." value={String(perPage)} onChange={(v) => { const size = Number(v); set('pageSize')(size); setPerPage(size); }} options={[[25, '25 rows'], [50, '50 rows'], [100, '100 rows'], [200, '200 rows']]} />
      <ToggleSetting label="Confirm destructive actions" description="Ask before removing saved searches or clearing personal selections." checked={preferences.confirmActions} onChange={set('confirmActions')} />
      <div className="mt-3 rounded-lg bg-surface-850 p-3 text-[11px] text-slate-500">Column visibility, widths, pinned columns, view choice, and sidebar state are already saved automatically as you work.</div>
    </>,
    accessibility: <>
      <h3 className="mb-1 text-sm font-semibold text-slate-800">Comfort & accessibility</h3><p className="mb-3 text-xs text-slate-500">Improve readability and reduce motion across supported interface elements.</p>
      <ToggleSetting label="Higher contrast" description="Strengthen borders and text contrast for improved legibility." checked={preferences.highContrast} onChange={set('highContrast')} />
      <ToggleSetting label="Reduce motion" description="Limit non-essential transitions and animated feedback." checked={preferences.reducedMotion} onChange={set('reducedMotion')} />
      <ToggleSetting label="Show interface animations" description="Controls subtle entrance and loading motion where supported." checked={preferences.showAnimations} onChange={set('showAnimations')} />
      <div className="mt-3 rounded-lg bg-surface-850 p-3 text-[11px] text-slate-500">Keyboard: press / to focus search, Ctrl or ⌘ + K for the command palette, and Escape to close dialogs.</div>
    </>,
  };
  return <Modal onClose={onClose} title="Settings" width={850}>
    <div className="-m-5 flex min-h-[470px] flex-col md:flex-row">
      <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto border-b border-surface-border bg-surface-850 p-2 md:w-56 md:shrink-0 md:flex-col md:border-b-0 md:border-r">
        {sections.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setActive(id)} className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-medium ${active === id ? 'bg-teal-50 text-teal-800' : 'text-slate-500 hover:bg-white hover:text-slate-700'}`}><Icon size={15}/>{label}{active === id && <Check size={13} className="ml-auto"/>}</button>)}
      </nav>
      <section className="min-w-0 flex-1 p-5 md:p-6">{content[active]}</section>
    </div>
    <div className="-mx-5 -mb-5 flex items-center justify-between border-t border-surface-border bg-surface-850 px-5 py-3">
      <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-slate-500 hover:bg-white hover:text-slate-700"><RotateCcw size={13}/> Reset preferences</button>
      <button onClick={onClose} className="rounded-lg bg-teal-700 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-800">Done</button>
    </div>
  </Modal>;
}
