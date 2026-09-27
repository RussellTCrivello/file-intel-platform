# SYLTHARAE File Intelligence

Desktop-first file intelligence interface built with React, Vite, and Electron. The Electron window hosts the packaged interface locally and keeps the renderer isolated from Node.js. No browser or Vite server is required to run an installed app.

## Desktop application

The desktop package includes the user interface, **not** the SYLTHARAE Flask/PostgreSQL data service. The service must be reachable from the computer (locally or over a trusted network). By default the app connects to `http://127.0.0.1:5000`.

Configure another backend by setting `SYLTHARAE_BACKEND_URL` in the environment before launch/build, for example:

```bash
SYLTHARAE_BACKEND_URL=https://syltharae.example.org npm run dev:desktop
```

On Windows PowerShell, use `$env:SYLTHARAE_BACKEND_URL="http://127.0.0.1:5000"` before running the command.

### Run from source

```bash
npm ci
npm run dev:desktop
```

This starts Vite and opens the interface in Electron. `npm run dev` remains available for browser-based frontend development.

### Build installable packages

```bash
npm ci
npm run build:desktop
```

Installers are written to `release/` (DMG/ZIP for macOS, NSIS for Windows, AppImage/DEB for Linux). Build a platform target on its supported operating system. Configure `SYLTHARAE_BACKEND_URL` for the environment where the installed app will be launched; when unset, localhost is used.

## Frontend checks

```bash
npm run build
npm run lint
```
