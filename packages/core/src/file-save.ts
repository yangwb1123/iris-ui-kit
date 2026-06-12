/** Payload handed to a host file-save handler. */
export interface SaveFilePayload {
  filename: string
  /** Full file contents as a string (includes any BOM the exporter prepended). */
  content: string
  /** MIME type, e.g. `text/csv;charset=utf-8;`. */
  mimeType: string
}

/**
 * A host-supplied file-save handler. Return `false` to DECLINE and fall through
 * to the library's web default (Blob + `<a download>`); return anything else
 * (or nothing) to signal the save was handled natively.
 */
export type FileSaveHandler = (file: SaveFilePayload) => void | boolean

let handler: FileSaveHandler | null = null

/**
 * Register a global handler that intercepts every library file save (e.g. the
 * table CSV / Excel export helpers). Desktop / mobile shells (Tauri / Wails /
 * Cordova / Electron) set this ONCE at startup to route saves through a native
 * save dialog instead of the browser's `<a download>` — which is unreliable in
 * system webviews (WKWebView often ignores the `download` attribute, and custom
 * protocols block `blob:` navigation). Pass `null` to clear. Web / Electron apps
 * that never set it keep the default browser download.
 *
 * ```ts
 * // Tauri host, once at startup:
 * setFileSaveHandler(async ({ filename, content }) => {
 *   const path = await save({ defaultPath: filename })
 *   if (path) await writeTextFile(path, content)
 * })
 * ```
 */
export function setFileSaveHandler(h: FileSaveHandler | null): void {
  handler = h
}

/** The currently registered handler, or `null` when none is set. */
export function getFileSaveHandler(): FileSaveHandler | null {
  return handler
}

/**
 * Route `file` through the registered handler. Returns `true` when a handler
 * took the save (the caller must then SKIP its web-default download), or `false`
 * when there is no handler / it declined by returning `false`. A throwing
 * handler is allowed to propagate — saving is an explicit user action and the
 * host should surface its own errors.
 */
export function saveFile(file: SaveFilePayload): boolean {
  if (!handler) return false
  return handler(file) !== false
}
