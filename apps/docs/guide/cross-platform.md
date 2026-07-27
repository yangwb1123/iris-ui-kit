# Cross-platform (Electron · Tauri · Wails · Cordova)

Iris UI is pure web technology, so it runs **inside any webview wrapper** — Electron, Tauri, Wails, Cordova — largely unchanged. The components mount, route, and respond to input out of the box. The work that remains is **host integration**: a handful of one-time settings in your shell, plus two optional hooks for native file-save and clipboard.

This guide is the checklist. Most items are a single line.

## At a glance

| Concern                                         | Who fixes it     | What to do                                |
| ----------------------------------------------- | ---------------- | ----------------------------------------- |
| Strict CSP blanks the styling                   | Host app         | add `style-src 'self' 'unsafe-inline'`    |
| `file://` 404s assets / breaks routing          | Host build       | `base: './'` + hash routing               |
| CSV/Excel export won't save natively            | **Library hook** | `setFileSaveHandler(...)`                 |
| Copy fails (no `navigator.clipboard`)           | **Library hook** | `setClipboardHandler(...)`                |
| Touch drag (kanban / dashboard / table reorder) | **Automatic**    | nothing — pointer fallback ships built-in |
| Notch / home-bar overlaps toasts & drawers      | Host meta        | `viewport-fit=cover`                      |
| System dark mode not detected                   | Host app         | enable the OS theme signal                |

## Content Security Policy

Iris UI styles components with inline styles and a runtime-injected `<style>` element. Under a **strict** CSP — Electron's recommendation and Tauri's default — those are blocked and the app renders **unstyled but fully functional**. One directive restores it:

```
style-src 'self' 'unsafe-inline';
```

This single directive covers both injected stylesheets and inline `style=` attributes (`style-src-attr` falls back to `style-src`). Inline **styles** are a far weaker vector than inline scripts, and Iris UI never uses an `innerHTML` sink, so this is the industry-normal, low-risk choice — keep `script-src` strict.

> The only feature that needs `script-src` relaxation is the opt-in anti-FOUC skin boot script. If you don't use it, you don't need it.

## Loading from `file://`

Electron and Cordova (and sometimes Wails) load the bundle from `file://`, where absolute asset paths (`/assets/…`) 404 and history-mode routing breaks. In your bundler:

```ts
// vite.config.ts
export default defineConfig({ base: './' })
```

and use **hash** routing rather than history routing. Iris UI itself hardcodes no URLs or `history` calls — this is purely your app/router config. Tauri serves assets from a custom protocol with a real origin, so it is unaffected.

## Native file save (CSV / Excel export)

The browser `<a download>` path that Iris UI uses by default is unreliable in system webviews (WKWebView often ignores the `download` attribute; custom protocols block `blob:`). Register **one** handler at startup and every table export routes through it:

```ts
import { setFileSaveHandler } from '@iris-ui-kit/core'

// Tauri
import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'

setFileSaveHandler(async ({ filename, content }) => {
  const path = await save({ defaultPath: filename })
  if (path) await writeTextFile(path, content)
})
```

The handler receives `{ filename, content, mimeType }`. Return `false` to **decline** a particular save and fall back to the browser download; return anything else (or nothing) and Iris UI skips the web path. Omit the handler entirely on the web or Electron-with-Node and the default download is used.

```ts
// Electron (renderer → main via IPC)
setFileSaveHandler(({ filename, content, mimeType }) =>
  window.electron.saveFile({ filename, content, mimeType }),
)

// Wails
import { SaveFile } from '../wailsjs/go/main/App'
setFileSaveHandler(({ filename, content }) => SaveFile(filename, content))

// Cordova (cordova-plugin-file)
setFileSaveHandler(({ filename, content }) => writeToCordovaFile(filename, content))
```

> The core serializers (`toCsv` / `toJson` / `toHtml` / `toSpreadsheetXml`) already return plain strings, so you can also build a fully custom export flow without the hook.

## Native clipboard (copy buttons)

`navigator.clipboard` needs a secure context and is `undefined` under Cordova `file://` and some custom protocols, so `IrisCopyButton` silently no-ops there. Register a clipboard handler the same way:

```ts
import { setClipboardHandler } from '@iris-ui-kit/core'

// Tauri
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
setClipboardHandler((text) => writeText(text))

// Wails
import { ClipboardSetText } from '../wailsjs/runtime/runtime'
setClipboardHandler((text) => ClipboardSetText(text))
```

Same contract: return `false` to fall through to `navigator.clipboard`; omit it on the web to keep the default.

## Touch drag — automatic

Kanban card moves, dashboard widget moves, and pro-table column reordering use native HTML5 drag-and-drop on the desktop (mouse) and a **built-in pointer fallback** on touch — native HTML5 DnD never fires on touch, so this matters on Cordova and touch laptops. Nothing to wire: the pointer path activates for `touch`/`pen` input automatically and coexists with the mouse path.

## Mobile safe areas

On notch / home-indicator devices, fixed overlays (toasts, drawers) need to clear the inset. Iris UI's Toast viewport and Drawer panels already add `env(safe-area-inset-*)` padding — you just have to opt the webview into drawing under the cutouts:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

## System dark mode

Iris UI reads `prefers-color-scheme`, but the **signal** is host-controlled:

- **Electron** — set `nativeTheme.themeSource = 'system'` in the main process.
- **Tauri / Wails** — the system webview forwards the OS scheme on recent versions; verify on your target OS.

Without it, auto dark mode safely stays light; you can always drive the theme explicitly through the theme store.

## What you don't need to worry about

`forced-colors` / reduced-motion compliance, portals, `position: sticky`, CSS custom properties, `ResizeObserver` / `IntersectionObserver`, and pointer-capture drags all work across WebView2 / WKWebView / WebKitGTK / Android System WebView. Iris UI also deliberately avoids the laggy webview-CSS traps (`:has()`, `@container`, `@layer`, `backdrop-filter`), and tonal surfaces that use `color-mix()` carry a precomputed `--iris-{semantic}-subtle` fallback, so even pre-2022 system WebViews render the right tint. The full visual surface renders correctly across current **and** legacy engines.
