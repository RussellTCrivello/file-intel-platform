import L from 'leaflet';
import simpleheat from 'simpleheat';

// Two of the Leaflet plugins used here predate ES modules and reach for
// globals instead of importing:
//
//   * leaflet.markercluster extends a global `L`
//   * leaflet.heat@0.2.0 depends on a global `simpleheat`, and its published
//     dist neither bundles it nor declares it in `dependencies`
//
// Under a bundler neither global exists, so both throw on load unless they
// are published first. This module exists purely for that side effect; ES
// module evaluation order is guaranteed to follow the order of the import
// statements, so importing it ahead of the plugins reliably runs it first.
if (typeof window !== 'undefined') {
  window.L = L;
  window.simpleheat = simpleheat;
}
if (typeof globalThis !== 'undefined') {
  globalThis.L = L;
  globalThis.simpleheat = simpleheat;
}

export default L;
