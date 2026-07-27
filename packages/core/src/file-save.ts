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
 * (or nothing) to signal the save was handled natively. Return a Promise if
 * the handler is async — {@link saveFile} will await it. A rejecting Promise
 * propagates as an unhandled rejection; hosts that expect async failures
 * should catch and return `false` to fall back to the browser default.
 */
export type FileSaveHandler = (file: SaveFilePayload) => void | boolean | Promise<boolean>

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
 *
 * Supports async handlers: if the registered handler returns a Promise, it is
 * awaited before interpreting the result.
 */
export async function saveFile(file: SaveFilePayload): Promise<boolean> {
  if (!handler) return false
  const result = await handler(file)
  return result !== false
}

interface DownloadAnchor {
  href: string
  download: string
  style: { display: string }
  click(): void
  remove(): void
}

interface DownloadRuntime {
  document?: {
    body?: { appendChild(node: DownloadAnchor): unknown }
    createElement(tag: 'a'): DownloadAnchor
  }
  Blob?: new (parts: string[], options: { type: string }) => unknown
  URL?: {
    createObjectURL(blob: unknown): string
    revokeObjectURL(url: string): void
  }
}

/**
 * Route a file through the host handler, then fall back to a browser download.
 *
 * Returns `true` when either path handled the request and `false` in a
 * non-browser environment with no host handler. Keeping this framework-neutral
 * fallback here prevents every adapter from carrying its own Blob/anchor copy.
 */
export async function downloadFile(file: SaveFilePayload): Promise<boolean> {
  if (await saveFile(file)) return true
  const runtime = globalThis as unknown as DownloadRuntime
  const document = runtime.document
  const Blob = runtime.Blob
  const URL = runtime.URL
  if (!document?.body || !Blob || !URL || typeof URL.createObjectURL !== 'function') {
    return false
  }

  const url = URL.createObjectURL(new Blob([file.content], { type: file.mimeType }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.filename
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
  return true
}
