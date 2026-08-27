import { createEffect, onCleanup } from 'solid-js'
import { matchTableKey, normalizeKeymap } from '@iris-ui-kit/core'

/** True when a keyboard target is contained by the table root. */
export function isInsideTableRoot(
  root: () => HTMLElement | undefined,
  target: EventTarget | null,
): boolean {
  if (!target || typeof target !== 'object' || !root()) return false
  return root()!.contains(target as Node)
}

/** Text controls own editing shortcuts and must never be intercepted. */
export function isTextControl(target: EventTarget | null): boolean {
  if (!target || typeof target !== 'object') return false
  const element = target as HTMLElement
  return (
    element.tagName === 'INPUT' ||
    element.tagName === 'TEXTAREA' ||
    element.tagName === 'SELECT' ||
    element.dataset?.irisTableEditor !== undefined ||
    element.closest?.('[data-iris-table-editor]') !== null
  )
}

/** Register a window listener for the lifetime of the current Solid owner. */
export function registerScopedKeydownListener(
  gate: () => boolean,
  handler: (event: KeyboardEvent) => void,
): void {
  let listening = false

  createEffect(() => {
    const enabled = gate()
    if (typeof window === 'undefined') return
    if (enabled && !listening) {
      window.addEventListener('keydown', handler)
      listening = true
    } else if (!enabled && listening) {
      window.removeEventListener('keydown', handler)
      listening = false
    }
  })

  onCleanup(() => {
    if (listening && typeof window !== 'undefined') {
      window.removeEventListener('keydown', handler)
      listening = false
    }
  })
}

/** Build the default table-local undo/redo keyboard handler. */
export function createUndoKeydownHandler(
  enabled: () => boolean,
  root: () => HTMLElement | undefined,
  isEditing: () => boolean,
  onUndo: () => void,
  onRedo: () => void,
): (event: KeyboardEvent) => void {
  const bindings = normalizeKeymap()
  return (event) => {
    if (!enabled() || event.defaultPrevented) return
    if (!isInsideTableRoot(root, event.target)) return
    if (isTextControl(event.target) || isEditing()) return
    if (matchTableKey(event, bindings.undo)) {
      event.preventDefault()
      onUndo()
    } else if (matchTableKey(event, bindings.redo)) {
      event.preventDefault()
      onRedo()
    }
  }
}
