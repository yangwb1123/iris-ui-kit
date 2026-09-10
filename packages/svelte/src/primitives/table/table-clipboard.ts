/** Read clipboard text; null when the browser API is unavailable or denied. */
export async function readClipboardText(): Promise<string | null> {
  if (typeof navigator === 'undefined') return null
  const nav = navigator as Navigator & { clipboard?: { readText?: () => Promise<string> } }
  if (!nav.clipboard?.readText) return null
  try {
    return await nav.clipboard.readText()
  } catch {
    return null
  }
}
