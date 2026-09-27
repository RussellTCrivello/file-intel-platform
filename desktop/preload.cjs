// The renderer's only route to the filesystem.
//
// The window runs with contextIsolation on, nodeIntegration off and sandbox
// on, so the renderer has no `require`, no `fs` and no ability to read a file
// path. This bridge exposes exactly the layer-database operations the UI
// needs and nothing else -- no arbitrary path is ever accepted from the
// renderer, every request names a layer id or a download URL.
const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('syltharaeLayers', {
  available: true,

  // Where the database lives, whether it is present, and what is in it.
  status: () => invoke('layers:status'),

  // Read one layer. Resolves to { id, kind, meta, text }.
  read: (id) => invoke('layers:read', id),

  // Create/update a writable layer (user pins, imported GeoJSON).
  write: (id, kind, text, meta) => invoke('layers:write', id, kind, text, meta),

  // Fetch a fresh database from a URL and install it, after validating it.
  download: (url) => invoke('layers:download', url),

  remove: () => invoke('layers:remove'),

  // Subscribe to push notifications from the main process (a completed
  // download, for example) without the renderer polling.
  onChanged: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('layers:changed', listener);
    return () => ipcRenderer.removeListener('layers:changed', listener);
  },
});
