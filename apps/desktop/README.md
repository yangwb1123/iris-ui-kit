# iris-desktop — Electron desktop shell demo

A single Electron shell that hosts **any** of the four Iris UI CMS demos
(React / Vue / Solid / Svelte) and wires the framework-agnostic
[`@iris-ui/core`](../../packages/core) native bridges to real OS APIs:

- `setFileSaveHandler` → Electron `dialog.showSaveDialog` + `fs.writeFile`
  (the Table CSV/Excel export saves through a native dialog instead of the
  browser's `<a download>`).
- `setClipboardHandler` → Electron `clipboard.writeText`
  (`IrisCopyButton` copies through the native clipboard).

## Why an HTTP server instead of `file://`

Vite builds reference assets with absolute paths (`/assets/…`), which `file://`
can't resolve. `server.js` serves the chosen `dist/` over `127.0.0.1` (with an
SPA fallback). `main.js` starts it and points a `BrowserWindow` at it.

## How the bridge is wired

`preload.js` exposes a minimal `window.irisNative` (contextIsolated, no
nodeIntegration). Each CMS app calls `registerDesktopBridges()` at startup
(`src/desktopBridge.ts`) which, **only when `window.irisNative` exists**,
registers the core handlers. In a plain browser it's a no-op, so the web demos
are unaffected.

## Run

Build the CMS apps first, then start the shell for a framework:

```sh
pnpm turbo run build --filter=cms --filter=cms-react --filter=cms-solid --filter=cms-svelte
pnpm --filter iris-desktop start:react    # or start:vue / start:solid / start:svelte
```

## Verify headlessly (no display)

```sh
pnpm --filter iris-desktop test            # static-server smoke (pure Node)
IRIS_FW=react xvfb-run -a electron selftest.js   # real Electron load + mount + bridge check
```

## Tauri / Wails

The library is equally ready for Tauri and Wails (same `setFileSaveHandler` /
`setClipboardHandler` hooks — see the cross-platform deployment guide in
`docs/`). They are **not** scaffolded here because building them on Linux needs
the `libwebkit2gtk-4.1` system libraries, which require root to install and were
unavailable in this environment. The Rust (cargo) and Go toolchains themselves
are present, so a Tauri/Wails shell is a drop-in once the WebKit dev libs are
installed; the renderer-side bridge registration (`desktopBridge.ts`) is
identical.
