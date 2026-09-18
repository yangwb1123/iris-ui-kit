export type TabAction =
  'refresh' | 'close' | 'closeLeft' | 'closeRight' | 'closeOthers' | 'closeAll'

export type TabShortcut = string | string[]
export type TabShortcutMap = Partial<Record<TabAction, TabShortcut>>

export const DEFAULT_TAB_SHORTCUTS: TabShortcutMap = {
  refresh: 'Mod+Shift+R',
  close: 'Mod+W',
}

export function firstShortcut(shortcut: TabShortcut | undefined): string | undefined {
  if (Array.isArray(shortcut)) return shortcut[0]
  return shortcut
}

export function shortcutSpecs(shortcut: TabShortcut | undefined): string[] {
  if (Array.isArray(shortcut)) return shortcut.filter(Boolean)
  return shortcut ? [shortcut] : []
}

export function isInputTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element) return false
  return (
    element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    element.tagName === 'SELECT' ||
    element.isContentEditable ||
    (typeof element.closest === 'function' && Boolean(element.closest('[contenteditable="true"]')))
  )
}

export function matchesShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parts = shortcut
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
  const key = parts.pop()
  if (!key) return false
  const modifiers = new Set(parts)
  const ctrlOrMeta = modifiers.has('mod')
  const ctrl = event.ctrlKey || event.metaKey
  if (event.key.toLowerCase() !== key) return false
  if (event.shiftKey !== modifiers.has('shift')) return false
  if (event.altKey !== (modifiers.has('alt') || modifiers.has('option'))) return false
  if (ctrlOrMeta) return ctrl
  return event.ctrlKey === modifiers.has('ctrl') && event.metaKey === modifiers.has('meta')
}
