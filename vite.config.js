import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

// https://vite.dev/config/
const backend = process.env.SYLTHARAE_BACKEND_URL || 'http://127.0.0.1:5000'
const proxy = { target: backend, changeOrigin: true }

// Serve the offline layer database to the renderer, mirroring the route the
// packaged Electron app exposes from its local host. This is what lets the
// map, the gazetteer and the coordinate search work under `npm run dev` with
// no Electron and no IPC bridge.
const layerFolder = path.resolve('map-layers')

function layerMiddleware(req, res, next) {
  const pathname = (req.url || '').split('?')[0]
  if (!pathname.startsWith('/layers/')) { next(); return }
  const name = decodeURIComponent(pathname.slice('/layers/'.length))
  const target = path.resolve(layerFolder, name)
  // Never serve anything outside the layer folder, whatever the request says.
  if (!target.startsWith(layerFolder + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'text/plain')
    res.end('No such layer file. Run `npm run layers:build` to create map-layers/layers.db.')
    return
  }
  const body = fs.readFileSync(target)
  res.setHeader('Content-Type', 'application/octet-stream')
  res.setHeader('Content-Length', body.length)
  res.setHeader('Cache-Control', 'no-store')
  res.end(body)
}

// configureServer / configurePreviewServer are plugin hooks, not `server`
// options -- putting them under `server` is silently ignored and the request
// falls through to the SPA fallback.
const layerPlugin = {
  name: 'syltharae-layer-database',
  configureServer(server) { server.middlewares.use(layerMiddleware) },
  configurePreviewServer(server) { server.middlewares.use(layerMiddleware) },
}

export default defineConfig({
  plugins: [react(), layerPlugin],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    strictPort: false,
    proxy: {
      // All real SYLTHARAE backend endpoints this app talks to. Proxied
      // server-side so the browser only ever sees same-origin requests
      // (cookies from Flask's session survive untouched) and so we never
      // need CORS on the Flask app.
      '/auth': proxy,
      '/api': proxy,
      '/file': proxy,
      '/health': proxy,
      // Legacy server-rendered pages reused wholesale as the format-aware
      // Full Document Viewer (see FullDocumentViewer.jsx) need their own
      // static assets (css/js) and the /file/<id>/content* JSON endpoints
      // they call client-side -- both must be proxied too, or the iframe
      // renders unstyled with "Loading..." stuck forever.
      '/static': proxy,
    },
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
})
