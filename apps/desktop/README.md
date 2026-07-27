# iris-desktop — Electron desktop shell demo

A single Electron shell that hosts **any** of the four Iris UI CMS demos
(React / Vue / Solid / Svelte) and wires the framework-agnostic
[`@iris-ui-kit/core`](../../packages/core) native bridges to real OS APIs:

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

Build the CMS apps first, then start the shell. It opens **all four frameworks
in one window** — switch live via the **Framework** menu or **Cmd/Ctrl+1–4**
(1 React · 2 Vue · 3 Solid · 4 Svelte). Each framework's `dist/` is served on its
own loopback port; switching just re-points the window.

```sh
pnpm turbo run build --filter=cms --filter=cms-react --filter=cms-solid --filter=cms-svelte
pnpm --filter iris-desktop start            # opens the switcher (starts on React)
# or jump straight to one framework:
pnpm --filter iris-desktop start:vue        # start:react / start:solid / start:svelte
```

## Package (electron-builder)

Produce a self-contained installer that bundles all four CMS builds (as
`extraResources` under `resources/cms-*`; `main.js` resolves them via
`process.resourcesPath` when `app.isPackaged`). Output goes to `release/`.

```sh
pnpm --filter iris-desktop pack          # unpacked app dir only (fast, no installer)
pnpm --filter iris-desktop dist          # installer(s) for the current OS
pnpm --filter iris-desktop dist:linux    # Linux AppImage
pnpm --filter iris-desktop dist:mac      # macOS dmg   (run on macOS)
pnpm --filter iris-desktop dist:win      # Windows nsis (run on Windows / wine)
```

Each `dist*` script first builds the four CMS apps. The Linux `AppImage` target
is self-contained and needs no system libs; `deb`/`rpm` additionally need `fpm`
(`pnpm --filter iris-desktop dist:linux:deb`). `mac`/`win` installers must be
built on (or cross-built from) their target OS.

Validated here: `electron-builder --dir` + a real `AppImage` both build and,
launched under `xvfb`, boot with `packaged=true`, resolve the four bundled CMS
dists, and load the window.

## Verify headlessly (no display)

```sh
pnpm --filter iris-desktop test            # static-server smoke (pure Node, all 4)
xvfb-run -a electron selftest.js           # real Electron: cycles ALL 4 in one window,
                                           # checks mount + window.irisNative + fw identity
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
