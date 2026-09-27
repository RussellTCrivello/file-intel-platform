export function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return '—';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const val = bytes / Math.pow(1024, i);
  return `${val >= 100 || i === 0 ? Math.round(val) : val.toFixed(2)} ${units[i]}`;
}

export function formatDate(iso, { time = false } = {}) {
  if (!iso) return '—';
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  if (!time) return date;
  const t = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${t}`;
}

export function formatRelative(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHr = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHr / 24);
  const diffMonth = Math.round(diffDay / 30.44);
  const diffYear = Math.round(diffDay / 365.25);
  if (Math.abs(diffSec) < 60) return 'just now';
  if (Math.abs(diffMin) < 60) return `${diffMin > 0 ? diffMin : -diffMin}${diffMin > 0 ? ' min ago' : ' min ago'}`;
  if (Math.abs(diffHr) < 24) return `${Math.abs(diffHr)} hr ${diffHr > 0 ? 'ago' : 'from now'}`;
  if (Math.abs(diffDay) < 30) return `${Math.abs(diffDay)} day${Math.abs(diffDay) === 1 ? '' : 's'} ${diffDay > 0 ? 'ago' : 'from now'}`;
  if (Math.abs(diffMonth) < 12) return `${Math.abs(diffMonth)} mo ${diffMonth > 0 ? 'ago' : 'from now'}`;
  return `${Math.abs(diffYear)} yr ${diffYear > 0 ? 'ago' : 'from now'}`;
}

export function truncateMiddle(str, max = 28) {
  if (!str || str.length <= max) return str || '';
  const keep = max - 3;
  const head = Math.ceil(keep * 0.6);
  const tail = keep - head;
  return `${str.slice(0, head)}...${str.slice(str.length - tail)}`;
}

export function truncatePath(path, max = 42) {
  if (!path || path.length <= max) return path || '';
  const parts = path.split('/').filter(Boolean);
  if (parts.length <= 2) return truncateMiddle(path, max);
  const first = parts[0];
  const last = parts[parts.length - 1];
  let result = `/${first}/…/${last}`;
  if (result.length > max) result = `…/${last}`;
  return result;
}

export function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
  return Promise.resolve();
}

export function formatCoords(coords) {
  if (!coords) return '—';
  const { lat, lng } = coords;
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(3)}°${latDir}, ${Math.abs(lng).toFixed(3)}°${lngDir}`;
}
