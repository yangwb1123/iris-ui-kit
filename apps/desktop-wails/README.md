# desktop-wails — Wails (Go) desktop shell

Hosts all four Iris UI CMS demos (React / Vue / Solid / Svelte) in one Wails
window, switchable live via the native **Framework** menu (Cmd/Ctrl+1–4). Mirrors
the Electron shell (`../desktop`), but native-Go + WebKitGTK instead of Chromium.

## How it works

- The four CMS builds are copied into `frontend/dist/<fw>/` (`populate-dist.sh`)
  and embedded with `//go:embed`.
- A custom `assetHandler` (main.go) serves the **currently selected** framework
  from the root — so the CMS's absolute `/assets/…` paths resolve — and injects a
  `window.irisNative` shim into `index.html` (before the app's module script).
- That shim wires the framework-agnostic `@iris-ui/core` bridges to Wails:
  `setFileSaveHandler` → `App.SaveFile` (bound Go → native Save dialog +
  `os.WriteFile`), `setClipboardHandler` → `window.runtime.ClipboardSetText`.
  The CMS apps call `registerDesktopBridges()` unchanged — same `window.irisNative`
  contract as the Electron preload.
- `App.SetFramework(fw)` flips the served framework and reloads the window.

## Build & run

Needs Go + the WebKitGTK 4.1 dev libs (`libwebkit2gtk-4.1-dev`, `libgtk-3-dev`)
and the Wails CLI (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`).
Build with the `webkit2_41` tag (Wails defaults to the older 4.0):

```sh
./build.sh                  # builds the 4 CMS, embeds them, compiles the shell
./build/bin/desktop-wails    # run (or: IRIS_FW=svelte ./build/bin/desktop-wails)
```

`build.sh` runs `wails build -tags webkit2_41 -s` (the `-s` skips the Wails
frontend build since we pre-embed the CMS dists).

## Package (release artifacts)

```sh
pnpm --filter iris-desktop-wails dist            # -> release/*.deb + *.tar.gz
```

`dist.sh` builds the release binary then produces a `.deb` (declares
`libwebkit2gtk-4.1-0` / `libgtk-3-0` as runtime deps — not bundled) and a
portable `.tar.gz`. (An AppImage would need `appimagetool` +
`linuxdeploy-plugin-gtk` to bundle WebKitGTK — out of scope; the `.deb` is the
recommended Linux distributable.)

Validated here: the `.deb` is well-formed (`dpkg-deb --info/--contents`) and its
packaged binary boots under `xvfb`.

## Test (headless)

```sh
go test -tags webkit2_41      # asset handler: serves each fw + injects irisNative
                              # + switches framework + SPA fallback (no GUI needed)
```

The compiled binary also boots under `xvfb-run` (WebKitGTK initialises and the
embedded CMS loads) — used here to validate without a display.
