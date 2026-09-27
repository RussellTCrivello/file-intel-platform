import { createRoot } from 'react-dom/client';

// The marker layers manage potentially thousands of markers imperatively, so
// popups cannot be react-leaflet <Popup> children -- that would mean a React
// subtree per marker, and the map stutters long before the data runs out.
//
// Instead exactly one React root exists for the whole map. Only one popup can
// be open at a time, so the root's single container div is moved into whichever
// popup just opened and re-rendered with that marker's content. Re-parenting
// the container is harmless: React only ever appends children into it.
let root = null;
let container = null;

export function renderPopup(contentElement, element) {
  if (!root) {
    container = document.createElement('div');
    root = createRoot(container);
  }
  contentElement.replaceChildren(container);
  root.render(element);
}
