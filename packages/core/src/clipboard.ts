/**
 * A host-supplied clipboard-copy handler. Return `false` to DECLINE and fall
 * through to the library default (`navigator.clipboard.writeText`); return
 * anything else (or nothing) to signal the copy was handled natively. Return
 * a Promise if the handler is async — {@link copyText} will await it.
 */
export type ClipboardHandler = (text: string) => void | boolean | Promise<boolean>

let handler: ClipboardHandler | null = null

/**
 * Register a global handler that intercepts every library clipboard copy (e.g.
 * `IrisCopyButton`). Desktop / mobile shells set this ONCE at startup to route
 * copies through a native clipboard API — `navigator.clipboard` requires a
 * secure context and is `undefined` under Cordova `file://` and some custom
 * protocols, where the default silently no-ops. Pass `null` to clear; apps that
 * never set it keep the `navigator.clipboard` default.
 *
 * ```ts
 * // Tauri host, once at startup:
 * setClipboardHandler((text) => writeText(text)) // @tauri-apps/plugin-clipboard-manager
 * ```
 */
export function setClipboardHandler(h: ClipboardHandler | null): void {
  handler = h
}

/** The currently registered handler, or `null` when none is set. */
export function getClipboardHandler(): ClipboardHandler | null {
  return handler
}

/**
 * Route `text` through the registered handler. Returns `true` when a handler
 * took the copy (the caller must then SKIP `navigator.clipboard`), or `false`
 * when there is no handler / it declined by returning `false`.
 *
 * Supports async handlers: if the registered handler returns a Promise, it is
 * awaited before interpreting the result.
 */
export async function copyText(text: string): Promise<boolean> {
  if (!handler) return false
  const result = await handler(text)
  return result !== false
}
