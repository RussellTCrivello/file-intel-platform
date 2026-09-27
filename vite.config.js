import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
const backend = process.env.SYLTHARAE_BACKEND_URL || 'http://127.0.0.1:5000'
const proxy = { target: backend, changeOrigin: true }

export default defineConfig({
  plugins: [react()],
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
