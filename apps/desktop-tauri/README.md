# desktop-tauri — Tauri (Rust) desktop shell

Hosts all four Iris UI CMS demos (React / Vue / Solid / Svelte) in one Tauri
window, switchable live via the native **Framework** menu. Mirrors the Electron
(`../desktop`) and Wails (`../desktop-wails`) shells, but Rust + WebKitGTK and a
custom `iris://` URI-scheme protocol.

## How it works

- The four CMS builds are copied into `dist/<fw>/` (`populate-dist.sh`) and
  embedded into the binary with `rust-embed`.
- A custom `iris://` URI-scheme protocol serves the **currently selected**
  framework from the root (so the CMS's absolute `/assets/…` paths resolve) and
  injects a `window.irisNative` shim into `index.html` (before the app's module
  script). The window loads `iris://localhost/`.
- The shim wires the framework-agnostic `@iris-ui-kit/core` bridges to Tauri
  commands: `setFileSaveHandler` → `save_file` (native Save dialog via
  `tauri-plugin-dialog` + `std::fs::write`), `setClipboardHandler` →
  `write_clipboard` (`tauri-plugin-clipboard-manager`). The CMS apps call
  `registerDesktopBridges()` unchanged — same `window.irisNative` contract as the
  Electron preload / Wails shim.
- The **Framework** menu flips a shared `Mutex<String>` and reloads the window,
  so the protocol serves the newly-selected build.

## Build & run

Needs Rust + the WebKitGTK 4.1 dev libs (`libwebkit2gtk-4.1-dev`, `libgtk-3-dev`,
`librsvg2-dev`):

```sh
./build.sh                                  # builds the 4 CMS, embeds them, compiles
./src-tauri/target/release/iris-desktop-tauri   # run (IRIS_FW=vue … to pick the start framework)
```

## Package (release artifacts)

Tauri's own bundler produces a Linux `.deb` (the recommended format for a GTK
app — it declares the system WebKitGTK/GTK as runtime dependencies instead of
bundling them):

```sh
pnpm --filter iris-desktop-tauri dist            # -> src-tauri/target/release/bundle/deb/*.deb
pnpm --filter iris-desktop-tauri dist:appimage   # also build an .AppImage (see caveat)
```

`dist` runs `cargo tauri build` (default target `deb`). **AppImage is opt-in**:
it runs `linuxdeploy` + `linuxdeploy-plugin-gtk`, which need a desktop/FUSE
environment — they fail in headless/FUSE-less containers (set
`APPIMAGE_EXTRACT_AND_RUN=1` and ensure FUSE on a real machine). `dmg`/`nsis`
build on macOS/Windows (`cargo tauri build --bundles dmg|nsis`).

Validated here: `cargo tauri build` produces the `.deb`, and its packaged binary
boots under `xvfb` (WebKitGTK + the `iris://` protocol load the embedded CMS).

## Test (headless)

```sh
cd src-tauri && cargo test --release        # serve_asset: each fw + irisNative
                                            # injected before module script + SPA fallback
```

The compiled binary also boots under `xvfb-run` (WebKitGTK initialises and the
`iris://` protocol loads the embedded CMS) — used here to validate without a
display.
