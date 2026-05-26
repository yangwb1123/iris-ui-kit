import * as React from 'react'

export interface IrisHotkeyProps {
  /**
   * Shortcut or list of shortcuts. Format: `'Escape'`, `'Enter'`, `'Mod+s'`,
   * `'Shift+/'`. `Mod` matches Ctrl on Win/Linux and Cmd on macOS.
   */
  shortcut: string | string[]
  onTrigger: (event: KeyboardEvent) => void
  /** Disable the binding (no-op if true). */
  disabled?: boolean
  /**
   * Allow the hotkey to fire even when focus is inside an input / textarea /
   * contentEditable element. Default false (most apps want hotkeys to skip
   * while typing).
   */
  allowInInputs?: boolean
  /** Scope: 'document' (default) or 'window'. */
  scope?: 'document' | 'window'
  children?: React.ReactNode
}

function parseShortcut(spec: string): {
  key: string
  shift: boolean
  alt: boolean
  ctrlOrMeta: boolean
  ctrl: boolean
  meta: boolean
} {
  const parts = spec.split('+').map((p) => p.trim())
  const key = parts[parts.length - 1]!.toLowerCase()
  const mods = new Set(parts.slice(0, -1).map((p) => p.toLowerCase()))
  return {
    key,
    shift: mods.has('shift'),
    alt: mods.has('alt') || mods.has('option'),
    ctrl: mods.has('ctrl') || mods.has('control'),
    meta: mods.has('meta') || mods.has('cmd') || mods.has('command'),
    ctrlOrMeta: mods.has('mod'),
  }
}

function isInputTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return false
}

function matches(event: KeyboardEvent, parsed: ReturnType<typeof parseShortcut>): boolean {
  if (event.key.toLowerCase() !== parsed.key) return false
  if (parsed.shift !== event.shiftKey) return false
  if (parsed.alt !== event.altKey) return false
  if (parsed.ctrlOrMeta) {
    // Mod modifier matches ctrl OR meta — at least one must be down.
    if (!event.ctrlKey && !event.metaKey) return false
  } else {
    if (parsed.ctrl !== event.ctrlKey) return false
    if (parsed.meta !== event.metaKey) return false
  }
  return true
}

/**
 * Behavior wrapper: binds a global keyboard shortcut while children are
 * mounted. Renderless — returns children verbatim (no extra DOM).
 *
 * @example
 *   <IrisHotkey shortcut="Escape" onTrigger={close}>
 *     <IrisDialog>…</IrisDialog>
 *   </IrisHotkey>
 *
 *   <IrisHotkey shortcut={['Mod+s', 'Mod+Shift+s']} onTrigger={save}>
 *     <IrisForm>…</IrisForm>
 *   </IrisHotkey>
 */
export function IrisHotkey({
  shortcut,
  onTrigger,
  disabled = false,
  allowInInputs = false,
  scope = 'document',
  children,
}: IrisHotkeyProps): React.ReactElement {
  // Pin handler in a ref so re-renders don't re-bind the listener.
  const handlerRef = React.useRef(onTrigger)
  handlerRef.current = onTrigger
  const allowRef = React.useRef(allowInInputs)
  allowRef.current = allowInInputs

  React.useEffect(() => {
    if (disabled) return
    const specs = Array.isArray(shortcut) ? shortcut : [shortcut]
    const parsed = specs.map(parseShortcut)
    const target: EventTarget = scope === 'window' ? window : document

    const onKey = (event: Event) => {
      const e = event as KeyboardEvent
      if (!allowRef.current && isInputTarget(e.target)) return
      for (const p of parsed) {
        if (matches(e, p)) {
          handlerRef.current(e)
          return
        }
      }
    }
    target.addEventListener('keydown', onKey)
    return () => {
      target.removeEventListener('keydown', onKey)
    }
  }, [disabled, scope, ...(Array.isArray(shortcut) ? shortcut : [shortcut])])

  return <>{children}</>
}
