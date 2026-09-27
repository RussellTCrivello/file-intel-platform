import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// The single source of truth for what can be switched on and off. The
// renderer and the switcher both read this, so a layer can never appear in the
// panel without something drawing it.
//
// `exclusive` marks the marker layers: clusters and individual markers are
// two views of the same points, so turning one on turns the other off rather
// than drawing every file twice.
export const MAP_LAYERS = [
  { id: 'ocean', group: 'Base', label: 'Ocean', hint: 'Water backdrop', on: true },
  { id: 'land', group: 'Base', label: 'Land', hint: 'Coastline landmass', on: true },
  { id: 'countries', group: 'Base', label: 'Country fills', hint: 'Shaded country areas', on: false },
  { id: 'borders', group: 'Base', label: 'Country borders', hint: 'Internal boundaries', on: true },
  { id: 'labels', group: 'Base', label: 'Country labels', hint: 'Name anchors', on: true },
  { id: 'graticule', group: 'Base', label: 'Graticule', hint: 'Lat / lon grid', on: false },

  { id: 'files', group: 'Data', label: 'Geotagged files', hint: 'One marker per file', on: true, exclusive: 'clusters', needs: 'files' },
  { id: 'clusters', group: 'Data', label: 'File clusters', hint: 'Grouped at low zoom', on: false, exclusive: 'files', needs: 'files' },
  { id: 'heat', group: 'Data', label: 'Density', hint: 'Where files concentrate', on: false, needs: 'files' },
  { id: 'places', group: 'Data', label: 'Place mentions', hint: 'Gazetteer hits from file text', on: true, needs: 'places' },
];

const DEFAULTS = Object.fromEntries(MAP_LAYERS.map((l) => [l.id, l.on]));

const LayerStateContext = createContext(null);

export function LayerStateProvider({ children, available }) {
  // `available` is the set of layer ids this particular map can actually draw
  // (a view with no place-mention data shouldn't offer the places toggle).
  const usable = useMemo(() => MAP_LAYERS.filter((l) => !available || available.includes(l.id)), [available]);
  const [active, setActive] = useState(() => {
    const initial = { ...DEFAULTS };
    for (const layer of MAP_LAYERS) if (available && !available.includes(layer.id)) initial[layer.id] = false;
    return initial;
  });

  const toggle = useCallback((id) => {
    setActive((prev) => {
      const layer = MAP_LAYERS.find((l) => l.id === id);
      const next = { ...prev, [id]: !prev[id] };
      // Enabling an exclusive layer disables its counterpart.
      if (layer?.exclusive && next[id]) next[layer.exclusive] = false;
      return next;
    });
  }, []);

  const value = useMemo(() => ({ active, toggle, usable }), [active, toggle, usable]);
  return <LayerStateContext.Provider value={value}>{children}</LayerStateContext.Provider>;
}

export function useLayerState() {
  const ctx = useContext(LayerStateContext);
  if (!ctx) throw new Error('useLayerState must be used inside <LayerStateProvider>');
  return ctx;
}
