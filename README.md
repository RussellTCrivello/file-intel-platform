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

`build:desktop` rebuilds the map layer database first, so the `map-layers/` folder
described below is always present in the installer. It is shipped through
`extraResources`, which places it outside the read-only `app.asar` so the app can
both read and rewrite it after installation.

## Maps

Both map views (Geolocation, and the Geolocation section of File Analysis) draw from
a local layer database and include a full offline vector fallback. The map-view control
also offers real live basemaps when connected: **Standard** (OpenStreetMap roads and
places), **Aerial** (Esri World Imagery), and **Terrain** (OpenTopoMap). Choose
**Offline** for a session with no tile requests. If a live tile source becomes
unavailable, the bundled Natural Earth coastline and country geometry remains visible
and the map reports that it is using the local fallback.

### The layer database

Map data lives in a single compressed file, `map-layers/layers.db`, inside the
program's own directory:

| Section | Kind | Contents |
| --- | --- | --- |
| `basemap-110m` | basemap | Natural Earth 110m country and land geometry (177 countries) |
| `basemap-50m` | basemap | Natural Earth 50m geometry, used once zoomed past zoom 4 (241 countries) |
| `gazetteer` | gazetteer | 24,323 place names, population 15,000 and over |

The whole file is about 1.0 MB, down from roughly 3 MB of raw geometry, because
each section is deflate-compressed individually. The container (`src/lib/layerDb.js`)
is versioned and checksummed: an 8-byte magic, a header with the format version and
flags, a JSON index, and a CRC32 over both the index and the entire file. A truncated
or corrupted file is rejected on open rather than producing a half-populated map.

Sources: [Natural Earth](https://www.naturalearthdata.com/) (public domain) via the
`world-atlas` package, and [all-the-cities](https://www.npmjs.com/package/all-the-cities)
(GeoNames, CC BY 4.0). Both are ordinary npm dependencies, so the database is built
with no network access to any map or gazetteer host.

### Building it

```bash
npm run layers:build
```

`scripts/build-layers.mjs` reads the two packages and writes `map-layers/layers.db`.
It takes under a second and is wired into `prebuild` and `dev:desktop`, so it runs
automatically before a build or a development launch. The folder is git-ignored
because it is a generated artifact; recreate it with the command above.

### Where it is stored

The application prefers the program's own directory, which is the project root in
development and the resources directory in an installed build. Installs on macOS
(`/Applications`) and Windows (`C:\Program Files`) are read-only, so when that folder
cannot be written the app falls back to the per-user application data directory. On
first read in that situation it copies the shipped database across, so a fresh
install still starts with a complete gazetteer rather than an empty one.

**Settings → Map data** always shows the resolved location, whether the program
directory is being used, which fallback is in play, and the size and contents of the
current database.

### Updating it

The same panel can download a new database from an `http`, `https` or `file` URL, or
accept a local file path. Downloads are capped at 256 MB and 60 seconds with at most
five redirects. The incoming file is parsed and checksum-verified **before** the
working copy is touched, and the replacement is written to a temporary file and
renamed into place, so an interrupted or bad download can never destroy working map
data. Writes from the app (for example saved pins) go through the same atomic path
and preserve every other section.

The renderer is sandboxed and has no filesystem access. All reads and writes are
handled by the Electron main process (`desktop/layerStore.cjs`) and reached from the
renderer only through a narrow preload bridge (`desktop/preload.cjs`).

### Searching and coordinates

The **Search** panel in the top-left of either map offers three modes, all served
from the local database:

- **Coordinates** — jump to a point and resolve it. Decimal, DMS and DDM are
  accepted, with hemisphere letters on either end (`40°42'46"N 74°00'21"W`,
  `N40 42 46.0 W74 00 21.0`, `40.7128, -74.0060`), comma, semicolon or space
  separators, and Unicode degree and prime symbols. Out-of-range values are
  rejected with a message naming the limit rather than silently wrapping. The
  result lists the country, the nearest named place, and the closest smaller
  places with their distances.
- **Place** — substring search over the 24,323 indexed place names, ranked by
  population. The panel reports how many places are indexed offline so it is
  clear whether the gazetteer is present.
- **Area** — filter the file markers on the map to a radius around a centre point,
  reporting how many fall inside.

The **coordinate readout** in the bottom-left shows the live cursor position and,
once you have moved, the map centre. It offers a decimal/DMS toggle, always keeps
six decimal places so the value round-trips without loss, and can copy the current
value to the clipboard.

### In the browser

`npm run dev` and `npm run preview` serve `/layers/` from `map-layers/` through a
small Vite plugin, so the browser build reads the same database as the desktop app.
Path traversal is rejected and missing files return 404. Running
`npm run dev:desktop` instead loads the database over IPC, which is what the
packaged app does.

### What still needs the backend

The **Base** layers, the gazetteer, the place search and the coordinate tools are
entirely self-contained. The **Data** layers — geotagged files, file clusters,
density and place mentions — are still served by the SYLTHARAE Flask/PostgreSQL
backend, and so are file records and keyword search. The desktop package therefore
requires that service to be reachable, as described under
[Desktop application](#desktop-application).

## Frontend checks

```bash
npm run build
npm run lint
```
