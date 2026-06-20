import { createStore, type Store } from './store'
import { generateId } from './utils'

/**
 * `@iris-ui/core/clipboard-history` — a framework-agnostic CLIPBOARD MANAGER: the
 * state engine behind a desktop "clipboard history" (Win+V / macOS clipboard
 * managers). Apps record copied text here (the desktop's `clipboard` permission
 * gates this); the shell lists recent clips, lets the user re-copy / pin / clear,
 * and performs the actual system-clipboard write. Pure + timer-free + testable;
 * off the core path (own subpath). Pinned clips survive `clear`.
 */

export interface ClipEntry {
  id: string
  text: string
  pinned: boolean
}

export interface ClipboardHistoryState {
  /** Clips newest-first; pinned ones are kept across `clear`. */
  entries: ClipEntry[]
}

export interface ClipboardHistory {
  store: Store<ClipboardHistoryState>
  getState(): ClipboardHistoryState
  subscribe(listener: (state: ClipboardHistoryState) => void): () => void
  /**
   * Record `text` at the front. Re-recording existing text moves it to the front
   * (preserving its pinned flag) rather than duplicating. Trims to the cap,
   * evicting oldest UNPINNED first. Empty/whitespace text is ignored (returns null).
   */
  add(text: string): string | null
  remove(id: string): void
  /** Clear all UNPINNED clips (pinned ones remain). */
  clear(): void
  togglePin(id: string): void
  list(): ClipEntry[]
}

export const DEFAULT_CLIPBOARD_MAX = 20

export function createClipboardHistory(options: { max?: number } = {}): ClipboardHistory {
  const max = options.max ?? DEFAULT_CLIPBOARD_MAX
  const store = createStore<ClipboardHistoryState>({ entries: [] })

  /** Drop oldest UNPINNED entries until within `max` (never evicts pinned). */
  const trim = (entries: ClipEntry[]): ClipEntry[] => {
    let over = entries.length - max
    if (over <= 0) return entries
    const kept: ClipEntry[] = []
    // Walk newest→oldest; drop unpinned from the tail by skipping the last `over`.
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      const e = entries[i]!
      if (over > 0 && !e.pinned) {
        over -= 1
        continue
      }
      kept.unshift(e)
    }
    return kept
  }

  return {
    store,
    getState: store.getState,
    subscribe: store.subscribe,
    add(text) {
      const t = text.trim()
      if (!t) return null
      const existing = store.getState().entries.find((e) => e.text === t)
      const id = existing?.id ?? generateId('clip')
      const entry: ClipEntry = { id, text: t, pinned: existing?.pinned ?? false }
      store.setState((s) => ({
        entries: trim([entry, ...s.entries.filter((e) => e.text !== t)]),
      }))
      return id
    },
    remove(id) {
      store.setState((s) => ({ entries: s.entries.filter((e) => e.id !== id) }))
    },
    clear() {
      store.setState((s) => ({ entries: s.entries.filter((e) => e.pinned) }))
    },
    togglePin(id) {
      store.setState((s) => ({
        entries: s.entries.map((e) => (e.id === id ? { ...e, pinned: !e.pinned } : e)),
      }))
    },
    list: () => store.getState().entries,
  }
}
