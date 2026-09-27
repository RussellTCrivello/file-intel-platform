const { app, BrowserWindow, shell } = require('electron');
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

const isDev = process.argv.includes('--dev');
const backend = new URL(process.env.SYLTHARAE_BACKEND_URL || 'http://127.0.0.1:5000');
let localServer;

function contentType(file) {
  return ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon' })[path.extname(file).toLowerCase()] || 'application/octet-stream';
}
function startDesktopHost() {
  const dist = path.join(__dirname, '..', 'dist');
  localServer = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
    const localPath = pathname === '/' || pathname === '/index.html' || pathname.startsWith('/assets/') || pathname === '/favicon.svg' || pathname === '/icons.svg';
    if (localPath) {
      const target = path.resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`);
      if (!target.startsWith(`${dist}${path.sep}`) && target !== path.join(dist, 'index.html')) { res.writeHead(403).end(); return; }
      fs.readFile(target, (error, body) => {
        if (error) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Desktop app assets are missing. Run npm run build:desktop first.'); return; }
        res.writeHead(200, { 'Content-Type': contentType(target), 'Cache-Control': 'no-store' }).end(body);
      });
      return;
    }
    // Keep API traffic same-origin for the renderer/session cookies while forwarding
    // requests to the existing authoritative Flask service.
    const transport = backend.protocol === 'https:' ? https : http;
    const headers = { ...req.headers, host: backend.host };
    delete headers.connection;
    // The proxy is a trusted local desktop boundary; present the upstream origin
    // to Flask so its same-origin CSRF checks see the canonical service host.
    if (headers.origin) headers.origin = backend.origin;
    if (headers.referer) headers.referer = `${backend.origin}${pathname}`;
    const upstream = transport.request({ protocol: backend.protocol, hostname: backend.hostname, port: backend.port || undefined, method: req.method, path: `${pathname}${new URL(req.url, 'http://127.0.0.1').search}`, headers }, (response) => {
      res.writeHead(response.statusCode || 502, response.headers);
      response.pipe(res);
    });
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: `Cannot reach SYLTHARAE service at ${backend.origin}` })); });
    req.pipe(upstream);
  });
  return new Promise((resolve, reject) => {
    localServer.once('error', reject);
    localServer.listen(0, '127.0.0.1', () => resolve(`http://127.0.0.1:${localServer.address().port}`));
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 940, minWidth: 900, minHeight: 620,
    title: 'SYLTHARAE · File Intelligence',
    backgroundColor: '#f4f6f8',
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  if (isDev) await win.loadURL('http://127.0.0.1:5173');
  else await win.loadURL(await startDesktopHost());
}

app.whenReady().then(createWindow).catch((error) => { console.error(error); app.quit(); });
app.on('window-all-closed', () => { if (localServer) localServer.close(); if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
