import { useEffect, useState } from 'react';

// Leaflet paints through the DOM/canvas rather than through Tailwind classes,
// so the map's colours can't just be a `className`. Instead we read the
// --map-* custom properties off <html> and re-read whenever the theme or
// contrast attributes change, so switching "Sage" or "Higher contrast" in
// Settings repaints the map too.
const TOKENS = ['--map-ocean', '--map-land', '--map-border', '--map-graticule', '--map-label'];

const FALLBACK = {
  '--map-ocean': '#dceaf1',
  '--map-land': '#ffffff',
  '--map-border': '#c3d3dd',
  '--map-graticule': '#d5e4ec',
  '--map-label': '#4e5e72',
};

function read() {
  const styles = getComputedStyle(document.documentElement);
  const next = { ...FALLBACK };
  for (const token of TOKENS) {
    const value = styles.getPropertyValue(token).trim();
    if (value) next[token] = value;
  }
  return next;
}

export default function useBasemapTheme() {
  const [palette, setPalette] = useState(read);

  useEffect(() => {
    const root = document.documentElement;
    const update = () => setPalette(read());
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-contrast'] });
    return () => observer.disconnect();
  }, []);

  return palette;
}
