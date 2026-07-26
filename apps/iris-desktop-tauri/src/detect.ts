/**
 * Detect whether the app is running inside a Tauri WebView.
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window
}
